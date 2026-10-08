// ======================== СИНХРОНИЗАЦИЯ МОДУЛЕЙ ========================

console.log('[sync.js] Загружен');

// ==================== ПРИОРИТЕТ УРОВНЕЙ ====================
const LEVEL_PRIORITY = {
  'U':   6,
  'Lкр': 5,
  'L':   4,
  'Iкр': 3,
  'I':   2,
  '':    1,
  null:  0,
  undefined: 0,
};

function getLevelPriority(level) {
  if (level === null || level === undefined) return 0;
  return LEVEL_PRIORITY[level] || 0;
}

function applyPriorityLevel(current, newLevel) {
  const pCur = getLevelPriority(current);
  const pNew = getLevelPriority(newLevel);
  if (pNew > pCur) return newLevel;
  return current;
}

// ==================== АКТИВНЫЕ ОБУЧЕНИЯ ====================

function getActiveTrainingsByOp(opName) {
  const records = getSystem().trainingRecords || [];
  return records.filter(r =>
    r.op === opName &&
    (r.status === 'План' || r.status === 'В процессе')
  );
}

function getActiveTrainingsForOpOnDay(opName, dateStr) {
  const records = getSystem().trainingRecords || [];
  const day = parseRuDate(dateStr);
  if (!day) return [];

  return records.filter(r => {
    if (r.op !== opName) return false;
    if (r.status !== 'План' && r.status !== 'В процессе') return false;
    const start = parseRuDate(r.startDate);
    if (!start) return false;
    let end = parseRuDate(r.validDate);
    if (!end && r.duration) {
      end = new Date(start);
      end.setDate(end.getDate() + parseInt(r.duration));
    }
    if (!end) end = start;
    return day >= start && day <= end;
  });
}

function isOpTrainingOnDay(opName, dateStr) {
  return getActiveTrainingsForOpOnDay(opName, dateStr).length > 0;
}

function isOpTrainingOnDayIdx(opName, dayIdx, year, month) {
  const dateObj = new Date(year, month, dayIdx + 1);
  const dateStr = formatDate(dateObj);
  return isOpTrainingOnDay(opName, dateStr);
}

function getTrainingEndDate(record) {
  const start = parseRuDate(record.startDate);
  if (!start) return null;
  let end = parseRuDate(record.validDate);
  if (!end && record.duration) {
    end = new Date(start);
    end.setDate(end.getDate() + parseInt(record.duration));
  }
  return end || start;
}

// ==================== ПРИМЕНЕНИЕ УРОВНЯ К МАТРИЦЕ ====================

function applyLevelWithPriority(section, postId, opId, newLevel, dateStr) {
  if (!section.shifts) return false;
  let changed = false;

  SHIFTS.forEach(shift => {
    const sd = section.shifts[shift];
    if (!sd || !sd.days) return;
    const day = sd.days[dateStr];
    if (!day) return;

    if (!day.levels[postId]) day.levels[postId] = {};
    const current = day.levels[postId][opId];
    const result = applyPriorityLevel(current, newLevel);

    if (result !== current) {
      day.levels[postId][opId] = result;
      changed = true;
    }
  });

  return changed;
}

function applyLevelToDateRange(section, postId, opId, newLevel, startDate, endDate) {
  let changed = 0;
  SHIFTS.forEach(shift => {
    const sd = section.shifts[shift];
    if (!sd || !sd.days) return;
    Object.keys(sd.days).forEach(dateStr => {
      const date = parseRuDate(dateStr);
      if (!date) return;
      if (date < startDate) return;
      if (date > endDate) return;

      const day = sd.days[dateStr];
      if (!day.levels[postId]) day.levels[postId] = {};
      const current = day.levels[postId][opId];
      const result = applyPriorityLevel(current, newLevel);

      if (result !== current) {
        day.levels[postId][opId] = result;
        changed++;
      }
    });
  });
  return changed;
}

function getCurrentLevelForOp(section, postId, opId, shift) {
  const sd = section.shifts?.[shift];
  if (!sd || !sd.days) return null;

  let maxLevel = null;
  let maxPrio = 0;
  Object.keys(sd.days).forEach(dateStr => {
    const day = sd.days[dateStr];
    if (!day.levels?.[postId]) return;
    const lvl = day.levels[postId][opId];
    const prio = getLevelPriority(lvl);
    if (prio > maxPrio) {
      maxPrio = prio;
      maxLevel = lvl;
    }
  });
  return maxLevel;
}

// ==================== РАСХОЖДЕНИЯ ====================

function findDiscrepancies() {
  const sys = getSystem();
  const discrepancies = [];
  const records = sys.trainingRecords || [];

  const completedLevels = ['L', 'Lкр', 'U'];

  sys.sections.forEach(section => {
    SHIFTS.forEach(shift => {
      const sd = section.shifts?.[shift];
      if (!sd) return;
      (sd.operators || []).forEach(op => {
        section.posts.forEach(post => {
          const currentLevel = getCurrentLevelForOp(section, post.id, op.id, shift);
          if (!currentLevel) return;

          const hasTraining = records.some(r =>
            r.op === op.name &&
            r.post === post.name &&
            (r.status === 'Завершено' || r.status === 'В процессе' || r.status === 'План')
          );

          if (completedLevels.includes(currentLevel) && !hasTraining) {
            discrepancies.push({
              type: 'matrix_only',
              opName: op.name,
              postName: post.name,
              sectionId: section.id,
              sectionName: section.name,
              matrixLevel: currentLevel,
            });
          }

          const completedTraining = records.find(r =>
            r.op === op.name &&
            r.post === post.name &&
            r.status === 'Завершено' &&
            r.validDate && r.validDate !== '—'
          );
          if (completedTraining) {
            const trainingPrio = getLevelPriority(completedTraining.level);
            const matrixPrio = getLevelPriority(currentLevel);
            if (trainingPrio > matrixPrio) {
              discrepancies.push({
                type: 'training_only',
                opName: op.name,
                postName: post.name,
                sectionId: section.id,
                sectionName: section.name,
                matrixLevel: currentLevel,
                trainingLevel: completedTraining.level,
                trainingStatus: completedTraining.status,
              });
            }
          }
        });
      });
    });
  });

  const seen = new Set();
  return discrepancies.filter(d => {
    const key = `${d.type}|${d.opName}|${d.postName}|${d.sectionId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ==================== СИНХРОНИЗАЦИЯ ====================

function syncMatrixFromTrainings() {
  const sys = getSystem();
  const records = sys.trainingRecords || [];
  let changed = 0;

  records.forEach(rec => {
    if (rec.status !== 'Завершено' && rec.status !== 'В процессе') return;

    const section = sys.sections.find(s =>
      s.id === rec.sectionId ||
      (!rec.sectionId && s.posts.some(p => p.name === rec.post))
    );
    if (!section) return;

    const post = section.posts.find(p => p.name === rec.post);
    if (!post) return;

    const matrixLevel = rec.status === 'В процессе' ? 'Iкр' : rec.level;

    const start = parseRuDate(rec.startDate);
    if (!start) return;
    let end = parseRuDate(rec.validDate);
    if (!end && rec.duration) {
      end = new Date(start);
      end.setDate(end.getDate() + parseInt(rec.duration));
    }
    if (!end) end = start;

    SHIFTS.forEach(shift => {
      const sd = section.shifts[shift];
      if (!sd) return;
      const op = (sd.operators || []).find(o => o.name === rec.op);
      if (!op) return;

      const c = applyLevelToDateRange(section, post.id, op.id, matrixLevel, start, end);
      changed += c;
    });
  });

  if (changed > 0) {
    saveSystem();
    logAudit('sync_matrix', 'Синхронизация', `Обновлено ячеек: ${changed}`);
  }

  return changed;
}

function syncTrainingsFromMatrix() {
  const sys = getSystem();
  const records = sys.trainingRecords || [];
  const discrepancies = findDiscrepancies();
  const matrixOnly = discrepancies.filter(d => d.type === 'matrix_only');

  let created = 0;
  const today = formatDate();

  matrixOnly.forEach(d => {
    records.push({
      year: new Date().getFullYear(),
      month: new Date().toLocaleString('ru-RU', { month: 'long' }),
      post: d.postName,
      op: d.opName,
      level: d.matrixLevel,
      status: 'Завершено',
      formator: '—',
      startDate: today,
      validDate: today,
      duration: 1,
      comment: 'Создано при синхронизации из матрицы',
      sectionId: d.sectionId,
      shift: getCurrentShift(),
    });
    created++;
  });

  if (created > 0) {
    sys.trainingRecords = records;
    saveSystem();
    logAudit('sync_trainings', 'Синхронизация', `Создано записей: ${created}`);
  }

  return created;
}

// ==================== UI: ПАНЕЛЬ СИНХРОНИЗАЦИИ ====================

function renderSyncPanel() {
  const cont = document.getElementById('syncPanel');
  if (!cont) return;

  const discrepancies = findDiscrepancies();
  const matrixOnly = discrepancies.filter(d => d.type === 'matrix_only');
  const trainingOnly = discrepancies.filter(d => d.type === 'training_only');

  let html = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:12px;">
      <div style="background:#dbeafe;border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#3b82f6;">${matrixOnly.length}</div>
        <div style="font-size:10px;text-transform:uppercase;color:#64748b;">Только в матрице</div>
      </div>
      <div style="background:#fef3c7;border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#f59e0b;">${trainingOnly.length}</div>
        <div style="font-size:10px;text-transform:uppercase;color:#64748b;">Только в обучении</div>
      </div>
    </div>
  `;

  if (discrepancies.length === 0) {
    html += `<div style="padding:20px;text-align:center;color:#16a34a;font-size:13px;">✅ Расхождений не обнаружено — матрица и обучения синхронизированы</div>`;
    cont.innerHTML = html;
    return;
  }

  html += `<div style="max-height:300px;overflow-y:auto;border:1px solid #cbd5e1;border-radius:8px;">`;
  html += `<table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead style="position:sticky;top:0;background:#f1f5f9;z-index:1;">
      <tr>
        <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #cbd5e1;">Оператор</th>
        <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #cbd5e1;">Пост</th>
        <th style="padding:6px 8px;border-bottom:1px solid #cbd5e1;width:80px;">Матрица</th>
        <th style="padding:6px 8px;border-bottom:1px solid #cbd5e1;width:80px;">Обучение</th>
        <th style="padding:6px 8px;border-bottom:1px solid #cbd5e1;width:100px;">Что делать</th>
      </tr>
    </thead>
    <tbody>`;

  discrepancies.slice(0, 100).forEach((d, i) => {
    let actionLabel, actionColor;
    if (d.type === 'matrix_only') {
      actionLabel = '📝 Создать запись';
      actionColor = '#3b82f6';
    } else {
      actionLabel = '⬆️ Поднять уровень';
      actionColor = '#f59e0b';
    }

    html += `
      <tr>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(d.opName)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(d.postName)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:700;">${escapeHtml(d.matrixLevel || '—')}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:700;color:${d.trainingLevel ? '#16a34a' : '#94a3b8'};">${escapeHtml(d.trainingLevel || '—')}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;text-align:center;">
          <span style="color:${actionColor};font-size:11px;font-weight:600;">${actionLabel}</span>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;

  if (discrepancies.length > 100) {
    html += `<div style="padding:6px;text-align:center;color:#94a3b8;font-size:11px;">Показаны первые 100 из ${discrepancies.length}</div>`;
  }

  cont.innerHTML = html;
}

function onSyncMatrixClick() {
  if (!confirm('Синхронизировать матрицу из обучений?\n\nЗавершённые и активные обучения будут применены ко всем дням. Уровни не понижаются.')) return;
  const changed = syncMatrixFromTrainings();
  if (changed > 0) {
    if (typeof showToast === 'function') showToast(`✅ Обновлено ячеек: ${changed}`);
    if (typeof renderMatrix === 'function') renderMatrix();
    if (typeof renderSE8Blank === 'function') renderSE8Blank();
  } else {
    if (typeof showToast === 'function') showToast('ℹ️ Изменений нет');
  }
  renderSyncPanel();
}

function onSyncTrainingsClick() {
  const discrepancies = findDiscrepancies();
  const matrixOnly = discrepancies.filter(d => d.type === 'matrix_only');
  if (matrixOnly.length === 0) {
    if (typeof showToast === 'function') showToast('ℹ️ Нет записей для создания');
    return;
  }
  if (!confirm(`Создать ${matrixOnly.length} записей обучения на основе уровней в матрице?`)) return;
  const created = syncTrainingsFromMatrix();
  if (created > 0) {
    if (typeof showToast === 'function') showToast(`✅ Создано записей: ${created}`);
    if (typeof renderTrainingTable === 'function') renderTrainingTable();
    if (typeof renderTrainingCalendar === 'function') renderTrainingCalendar();
  }
  renderSyncPanel();
}

function onRecheckSyncClick() {
  renderSyncPanel();
  if (typeof showToast === 'function') showToast('🔍 Проверка завершена');
}

// ==================== 4 ПОСЛЕДНИХ РАБОЧИХ ДНЯ ====================
// Возвращает массив из 4 дат (ДД.ММ.ГГГГ) — последние рабочие дни,
// включая сегодня (если сегодня рабочий).
// Порядок: [Н-3, Н-2, Н-1, Н]

function getLast4WorkingDays() {
  const today = new Date();
  const result = [];
  const d = new Date(today);

  let safety = 0;
  while (result.length < 4 && safety < 30) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      result.unshift(formatDate(d));
    }
    d.setDate(d.getDate() - 1);
    safety++;
  }

  while (result.length < 4) {
    result.unshift(result[0] || formatDate(today));
  }

  return result;
}

// ==================== ЭКСПОРТ ====================
window.sync = {
  getLevelPriority,
  applyPriorityLevel,
  getActiveTrainingsByOp,
  getActiveTrainingsForOpOnDay,
  isOpTrainingOnDay,
  isOpTrainingDayIdx: isOpTrainingOnDayIdx,
  getTrainingEndDate,
  applyLevelWithPriority,
  applyLevelToDateRange,
  getCurrentLevelForOp,
  findDiscrepancies,
  syncMatrixFromTrainings,
  syncTrainingsFromMatrix,
  renderSyncPanel,
  onSyncMatrixClick,
  onSyncTrainingsClick,
  onRecheckSyncClick,
  getLast4WorkingDays,
};