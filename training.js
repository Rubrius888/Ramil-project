// ======================== ЖУРНАЛ ОБУЧЕНИЙ v2 ========================
// Логика:
//   • Полный цикл: План → В процессе → Завершено (с авто-применением к матрице)
//   • Применение к матрице: во все дни от startDate до validDate (или +duration)
//   • Приоритет уровней через sync.js — не понижает
//   • Привязка к участку (sectionId, shift) — обратно совместимо
//   • Фильтры, поиск, массовые операции
//   • Автоподстановка duration из поста, level из текущего уровня оператора
//   • Валидация: даты, конфликты, дубли

console.log('[training.js] Загружен (v2)');

// ==================== СОСТОЯНИЕ ====================

let trainingCalendarMonth = new Date().getMonth();
let trainingCalendarYear  = new Date().getFullYear();
let trainingView = 'month';
let trainingWeekStart = startOfWeek(new Date());
let draggedTrainingIdx = -1;

let trainingFilters = {
  operator: '',
  post: '',
  status: '',
  formator: '',
  search: '',
  onlyCurrentSection: true,
};

let trainingSelected = new Set();

// ==================== УТИЛИТЫ ====================

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function getDefaultFormator() {
  const ops = getCurrentOperators();
  const nu = ops.find(o => o.role === 'НУ');
  if (nu) return nu.name;
  const so = ops.find(o => o.role === 'СО');
  if (so) return so.name;
  const f = ops.find(o => o.role === 'Ф');
  if (f) return f.name;
  return '';
}

function getTrainingRecordInfo(r, idx) {
  const start = parseRuDate(r.startDate);
  let end = parseRuDate(r.validDate);
  if (!end && start && r.duration) {
    end = new Date(start);
    end.setDate(end.getDate() + parseInt(r.duration));
  }
  return {
    rec: r,
    idx,
    start,
    end: end || start,
    isOverdue: end && end < new Date() && r.status !== 'Завершено',
  };
}

function getFilteredTrainingRecords() {
  const sys = getSystem();
  const all = sys.trainingRecords || [];
  const section = getCurrentSection();
  const shift = getCurrentShift();

  return all.map((r, idx) => ({ r, idx })).filter(({ r }) => {
    if (trainingFilters.onlyCurrentSection) {
      if (r.sectionId && r.sectionId !== section.id) return false;
      if (r.shift && r.shift !== shift && r.sectionId === section.id) return false;
    }

    if (trainingFilters.operator && r.op !== trainingFilters.operator) return false;
    if (trainingFilters.post && r.post !== trainingFilters.post) return false;
    if (trainingFilters.status && r.status !== trainingFilters.status) return false;
    if (trainingFilters.formator && r.formator !== trainingFilters.formator) return false;

    if (trainingFilters.search) {
      const q = trainingFilters.search.toLowerCase();
      const hay = `${r.op} ${r.post} ${r.formator} ${r.comment}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}

// ==================== ДИАЛОГ ДОБАВЛЕНИЯ / РЕДАКТИРОВАНИЯ ====================

function openAddTrainingDialog() {
  openTrainingDialog(-1);
}

function openEditTrainingDialog(idx) {
  openTrainingDialog(idx);
}

function openTrainingDialog(idx) {
  const sys = getSystem();
  const allRecords = sys.trainingRecords || [];
  const isEdit = idx >= 0 && idx < allRecords.length;
  const existing = isEdit ? allRecords[idx] : null;

  const now = new Date();
  const section = getCurrentSection();
  const shift = getCurrentShift();

  const ops = getCurrentOperators().map(o => o.name);
  const psts = section.posts.map(p => p.name);

  if (ops.length === 0 || psts.length === 0) {
    alert('Сначала добавьте хотя бы одного оператора и один пост');
    return;
  }

  const formaters = getCurrentOperators()
    .filter(o => o.role === 'Ф' || o.role === 'СО' || o.role === 'НУ')
    .map(o => o.name);

  const defaultFormator = getDefaultFormator();
  const formatorOptions = [{ value: '', label: '— не указан —' }]
    .concat(formaters.map(f => ({ value: f, label: f })));

  const defaultOp = existing ? existing.op : ops[0];
  const defaultPost = existing ? existing.post : psts[0];
  const defaultLevel = existing ? existing.level : 'I';
  const defaultStatus = existing ? existing.status : 'План';
  const defaultForm = existing ? existing.formator : defaultFormator;
  const defaultStart = existing ? existing.startDate : now.toLocaleDateString('ru-RU');
  const defaultValid = existing ? existing.validDate : '—';
  const defaultDuration = existing ? existing.duration : (() => {
    const post = section.posts.find(p => p.name === defaultPost);
    return post ? post.trainingDays : 5;
  })();
  const defaultComment = existing ? existing.comment : '';

  showModal(isEdit ? '✏️ Редактировать обучение' : '🎓 Новая запись обучения', [
    { name: 'op', label: 'Оператор', type: 'select', value: defaultOp,
      options: ops.map(o => ({ value: o, label: o })) },
    { name: 'post', label: 'Пост', type: 'select', value: defaultPost,
      options: psts.map(p => ({ value: p, label: p })) },
    { name: 'level', label: 'Уровень', type: 'select', value: defaultLevel,
      options: [
        { value: 'Iкр', label: 'Iкр' }, { value: 'I', label: 'I' },
        { value: 'Lкр', label: 'Lкр' }, { value: 'L', label: 'L' },
        { value: 'U',   label: 'U' }
      ]},
    { name: 'status', label: 'Статус', type: 'select', value: defaultStatus,
      options: [
        { value: 'План',       label: '📋 План' },
        { value: 'В процессе', label: '⏳ В процессе' },
        { value: 'Завершено',  label: '✅ Завершено' }
      ]},
    { name: 'formator', label: 'Форматор', type: 'select', value: defaultForm,
      options: formatorOptions },
    { name: 'startDate', label: 'Дата начала (ДД.ММ.ГГГГ)', value: defaultStart },
    { name: 'validDate', label: 'Дата валидации (ДД.ММ.ГГГГ) — пусто если не завершено', value: defaultValid },
    { name: 'duration',  label: 'Срок (рабочих дней)', type: 'number', value: String(defaultDuration) },
    { name: 'comment',   label: 'Комментарий', value: defaultComment }
  ], (v, overlay) => {
    const validation = validateTrainingInput(v, idx, isEdit);
    if (!validation.ok) {
      alert('⚠️ ' + validation.error);
      return;
    }

    const finalStatus = autoStatus(v.status, v.startDate, v.validDate);

    const record = {
      year: existing ? existing.year : now.getFullYear(),
      month: existing ? existing.month : now.toLocaleString('ru-RU', { month: 'long' }),
      post: v.post,
      op: v.op,
      level: v.level,
      status: finalStatus,
      formator: v.formator || '—',
      startDate: v.startDate || '—',
      validDate: v.validDate || '—',
      duration: parseInt(v.duration) || 5,
      comment: v.comment || '—',
      sectionId: existing?.sectionId || section.id,
      shift: existing?.shift || shift,
    };

    const records = getSystem().trainingRecords || [];
    if (isEdit) {
      records[idx] = record;
      logAudit('update_training', `${record.op} → ${record.post}`,
        `Уровень ${record.level} · ${record.status}`);
    } else {
      records.push(record);
      logAudit('add_training', `${record.op} → ${record.post}`,
        `Уровень ${record.level} · ${record.status}`);
    }
    getSystem().trainingRecords = records;

    applyTrainingToMatrixByStatus(record);

    saveSystem();
    overlay.remove();
    renderTrainingCalendar();
    renderTrainingTable();
    renderTrainingStats();
    if (typeof renderMatrix === 'function') renderMatrix();
    if (typeof renderSE8Blank === 'function') renderSE8Blank();
    if (typeof renderSyncPanel === 'function') renderSyncPanel();
    if (typeof showToast === 'function') {
      showToast(isEdit ? '✏️ Запись обновлена' : '✅ Запись добавлена');
    }
  });
}

function validateTrainingInput(v, idx, isEdit) {
  if (!v.op || !v.post) return { ok: false, error: 'Выберите оператора и пост' };

  const start = parseRuDate(v.startDate);
  const valid = parseRuDate(v.validDate);
  if (!start) return { ok: false, error: 'Неверная дата начала (формат ДД.ММ.ГГГГ)' };
  if (v.validDate && v.validDate !== '—' && !valid) {
    return { ok: false, error: 'Неверная дата валидации (формат ДД.ММ.ГГГГ)' };
  }
  if (valid && valid < start) {
    return { ok: false, error: 'Дата валидации раньше даты начала' };
  }

  const records = getSystem().trainingRecords || [];
  const dupIdx = records.findIndex((r, i) => {
    if (isEdit && i === idx) return false;
    if (r.op !== v.op || r.post !== v.post) return false;
    if (r.status === 'Завершено') return false;
    const rStart = parseRuDate(r.startDate);
    let rEnd = parseRuDate(r.validDate);
    if (!rEnd && rStart && r.duration) {
      rEnd = new Date(rStart);
      rEnd.setDate(rEnd.getDate() + parseInt(r.duration));
    }
    if (!rStart) return false;
    if (!rEnd) rEnd = rStart;
    const a1 = start, a2 = valid || start;
    const b1 = rStart, b2 = rEnd;
    return a1 <= b2 && b1 <= a2;
  });

  if (dupIdx >= 0) {
    const conflict = records[dupIdx];
    const ok = confirm(
      `⚠️ Конфликт: у ${v.op} уже есть активное обучение на посте «${v.post}»\n` +
      `(${conflict.status}, ${conflict.startDate} — ${conflict.validDate})\n\n` +
      `Всё равно сохранить?`
    );
    if (!ok) return { ok: false, error: 'Отменено пользователем' };
  }

  return { ok: true };
}

function autoStatus(currentStatus, startDate, validDate) {
  if (validDate && validDate.trim() !== '' && validDate !== '—') return 'Завершено';
  if (startDate && startDate.trim() !== '' && startDate !== '—') {
    const today = new Date();
    const [d, m, y] = startDate.split('.').map(Number);
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
      const start = new Date(y, m - 1, d);
      if (start <= today) return 'В процессе';
    }
  }
  return currentStatus || 'План';
}

// ==================== ПРИМЕНЕНИЕ К МАТРИЦЕ ====================

/**
 * Применяет запись обучения к матрице в зависимости от статуса.
 *   • План → ничего
 *   • В процессе → Iкр на все дни
 *   • Завершено → финальный уровень на все дни
 *
 * Использует sync.applyLevelToDateRange (приоритет уровней — не понижает).
 */
function applyTrainingToMatrixByStatus(record) {
  if (record.status === 'План') return;

  const section = getSystem().sections.find(s => s.id === record.sectionId)
                || getCurrentSection();
  if (!section) return;

  const post = section.posts.find(p => p.name === record.post);
  if (!post) return;

  let matrixLevel;
  if (record.status === 'В процессе') {
    matrixLevel = 'Iкр';
  } else if (record.status === 'Завершено') {
    matrixLevel = record.level;
  } else {
    return;
  }

  const start = parseRuDate(record.startDate);
  let end = parseRuDate(record.validDate);
  if (!end && start && record.duration) {
    end = new Date(start);
    end.setDate(end.getDate() + parseInt(record.duration));
  }
  if (!start) return;
  if (!end) end = start;

  SHIFTS.forEach(shift => {
    const sd = section.shifts[shift];
    if (!sd) return;
    const op = (sd.operators || []).find(o => o.name === record.op);
    if (!op) return;

    if (window.sync && typeof window.sync.applyLevelToDateRange === 'function') {
      window.sync.applyLevelToDateRange(section, post.id, op.id, matrixLevel, start, end);
    } else {
      Object.keys(sd.days || {}).forEach(dateStr => {
        const date = parseRuDate(dateStr);
        if (!date) return;
        if (date < start) return;
        if (date > end) return;
        const day = sd.days[dateStr];
        if (!day.levels) day.levels = {};
        if (!day.levels[post.id]) day.levels[post.id] = {};
        day.levels[post.id][op.id] = matrixLevel;
      });
    }
  });

  saveSystem();
}

// ==================== УДАЛЕНИЕ ====================

function deleteTrainingRecord(i) {
  const records = getSystem().trainingRecords || [];
  const rec = records[i];
  if (!rec) return;
  if (!confirm(`Удалить запись «${rec.op} → ${rec.post}»?`)) return;

  records.splice(i, 1);
  getSystem().trainingRecords = records;
  saveSystem();
  logAudit('delete_training', `${rec.op} → ${rec.post}`, '');
  renderTrainingCalendar();
  renderTrainingTable();
  renderTrainingStats();
  if (typeof renderSyncPanel === 'function') renderSyncPanel();
  if (typeof showToast === 'function') showToast('🗑 Запись удалена');
}

function deleteSelectedTrainings() {
  if (trainingSelected.size === 0) {
    alert('Не выбрано ни одной записи');
    return;
  }
  if (!confirm(`Удалить ${trainingSelected.size} записей?`)) return;

  const records = getSystem().trainingRecords || [];
  const toDelete = Array.from(trainingSelected).sort((a, b) => b - a);
  toDelete.forEach(idx => {
    if (records[idx]) records.splice(idx, 1);
  });
  getSystem().trainingRecords = records;
  trainingSelected.clear();
  saveSystem();
  logAudit('delete_training', 'Массовое', `Удалено: ${toDelete.length}`);
  renderTrainingCalendar();
  renderTrainingTable();
  renderTrainingStats();
  if (typeof renderSyncPanel === 'function') renderSyncPanel();
  if (typeof showToast === 'function') showToast(`🗑 Удалено: ${toDelete.length}`);
}

// ==================== МАССОВАЯ СМЕНА СТАТУСА ====================

function bulkChangeStatus(newStatus) {
  if (trainingSelected.size === 0) {
    alert('Не выбрано ни одной записи');
    return;
  }
  if (!['План', 'В процессе', 'Завершено'].includes(newStatus)) return;
  if (!confirm(`Сменить статус у ${trainingSelected.size} записей на «${newStatus}»?`)) return;

  const records = getSystem().trainingRecords || [];
  const today = new Date().toLocaleDateString('ru-RU');
  const count = trainingSelected.size;

  Array.from(trainingSelected).forEach(idx => {
    const r = records[idx];
    if (!r) return;
    r.status = newStatus;
    if (newStatus === 'Завершено' && (r.validDate === '—' || !r.validDate)) {
      r.validDate = today;
    }
    applyTrainingToMatrixByStatus(r);
  });

  saveSystem();
  trainingSelected.clear();
  logAudit('update_training', 'Массовая смена', `Статус: ${newStatus} · ${count}`);
  renderTrainingCalendar();
  renderTrainingTable();
  renderTrainingStats();
  if (typeof renderMatrix === 'function') renderMatrix();
  if (typeof renderSyncPanel === 'function') renderSyncPanel();
  if (typeof showToast === 'function') showToast(`✅ Изменено: ${count}`);
}

// ==================== ПРИМЕНЕНИЕ ОДИНОЧНОЙ ЗАПИСИ ====================

function applyTrainingRecord(i) {
  const records = getSystem().trainingRecords || [];
  const r = records[i];
  if (!r) return;
  if (!confirm(`Применить уровень «${r.level}» оператору ${r.op} на пост «${r.post}»?\n\n` +
               `Будет применено ко всем дням с ${r.startDate}`)) return;

  applyTrainingToMatrixByStatus(r);
  logAudit('apply_training', `${r.op} → ${r.post}`, `Уровень ${r.level}`);
  if (typeof renderMatrix === 'function') renderMatrix();
  if (typeof renderSE8Blank === 'function') renderSE8Blank();
  if (typeof renderSyncPanel === 'function') renderSyncPanel();
  if (typeof showToast === 'function') showToast('✔ Уровень применён');
}

// ==================== ВИД / КАЛЕНДАРЬ ====================

function setTrainingView(view) {
  trainingView = view;
  const monthBtn = document.getElementById('viewMonthBtn');
  const weekBtn = document.getElementById('viewWeekBtn');
  if (monthBtn) monthBtn.classList.toggle('active', view === 'month');
  if (weekBtn) weekBtn.classList.toggle('active', view === 'week');
  const monthSel = document.getElementById('trainingMonthSelect');
  const yearSel = document.getElementById('trainingYearSelect');
  const prevBtn = document.getElementById('weekPrevBtn');
  const nextBtn = document.getElementById('weekNextBtn');
  if (monthSel) monthSel.style.display = view === 'month' ? '' : 'none';
  if (yearSel) yearSel.style.display = view === 'month' ? '' : 'none';
  if (prevBtn) prevBtn.style.display = view === 'week' ? '' : 'none';
  if (nextBtn) nextBtn.style.display = view === 'week' ? '' : 'none';
  renderTrainingCalendar();
}

function trainingWeekPrev() {
  trainingWeekStart.setDate(trainingWeekStart.getDate() - 7);
  renderTrainingCalendar();
}
function trainingWeekNext() {
  trainingWeekStart.setDate(trainingWeekStart.getDate() + 7);
  renderTrainingCalendar();
}

// ==================== РЕНДЕР КАЛЕНДАРЯ ====================

function renderTrainingCalendar() {
  const thead = document.querySelector('#trainingCalendarTable thead');
  const tbody = document.querySelector('#trainingCalendarTable tbody');
  const title = document.getElementById('trainingCalendarTitle');
  if (!thead || !tbody) return;

  const monthSel = document.getElementById('trainingMonthSelect');
  const yearSel  = document.getElementById('trainingYearSelect');
  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const now = new Date();
  if (monthSel && !monthSel.options.length) {
    monthSel.innerHTML = months.map((m, i) =>
      `<option value="${i}" ${i === now.getMonth() ? 'selected' : ''}>${m}</option>`
    ).join('');
  }
  if (yearSel && !yearSel.options.length) {
    let html = '';
    for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 2; y++) {
      html += `<option value="${y}" ${y === now.getFullYear() ? 'selected' : ''}>${y}</option>`;
    }
    yearSel.innerHTML = html;
  }
  if (monthSel && yearSel) {
    trainingCalendarMonth = parseInt(monthSel.value);
    trainingCalendarYear  = parseInt(yearSel.value);
  }

  const psts = getCurrentSection().posts.map(p => p.name);
  if (psts.length === 0) {
    thead.innerHTML = '';
    tbody.innerHTML = '<tr><td style="text-align:center;color:#94a3b8;padding:40px;">Нет постов</td></tr>';
    return;
  }

  let days = [];
  if (trainingView === 'month') {
    const monthName = months[trainingCalendarMonth];
    if (title) title.textContent = `Календарь обучений — ${monthName} ${trainingCalendarYear}`;
    const daysInMonth = new Date(trainingCalendarYear, trainingCalendarMonth + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(trainingCalendarYear, trainingCalendarMonth, d));
    }
  } else {
    const end = new Date(trainingWeekStart);
    end.setDate(end.getDate() + 6);
    if (title) title.textContent = `Календарь обучений — неделя ${formatRuDate(trainingWeekStart)} — ${formatRuDate(end)}`;
    for (let i = 0; i < 7; i++) {
      const d = new Date(trainingWeekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
  }

  let headerHTML = '<tr><th>Пост</th>';
  days.forEach(date => {
    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const label = trainingView === 'month'
      ? date.getDate()
      : `${date.getDate()}<br><small>${['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][dow]}</small>`;
    headerHTML += `<th style="${isWeekend ? 'background:#cbd5e1;' : ''}">${label}</th>`;
  });
  headerHTML += '</tr>';
  thead.innerHTML = headerHTML;

  const filtered = getFilteredTrainingRecords();
  const recordsByPost = new Map();
  filtered.forEach(({ r, idx }) => {
    const list = recordsByPost.get(r.post);
    if (list) list.push({ rec: r, i: idx });
    else recordsByPost.set(r.post, [{ rec: r, i: idx }]);
  });

  const frag = document.createDocumentFragment();
  for (let r = 0; r < psts.length; r++) {
    const postName = psts[r];
    const tr = document.createElement('tr');

    const tdPost = document.createElement('td');
    tdPost.textContent = postName;
    tr.appendChild(tdPost);

    const candidates = recordsByPost.get(postName) || [];

    days.forEach(date => {
      const dow = date.getDay();
      const isWeekend = dow === 0 || dow === 6;

      const trainings = [];
      for (let ci = 0; ci < candidates.length; ci++) {
        const rec = candidates[ci].rec;
        const info = getTrainingRecordInfo(rec, candidates[ci].i);
        if (date >= info.start && date <= info.end) {
          trainings.push({ info, idx: candidates[ci].i });
        }
      }

      const td = document.createElement('td');
      const dateStr = formatRuDate(date);
      td.ondragover = onTrainingDragOver;
      td.ondragleave = onTrainingDragLeave;
      td.ondrop = (e) => onTrainingDrop(e, postName, dateStr);
      td.ondblclick = () => {
        if (trainings.length > 0) {
          openEditTrainingDialog(trainings[0].idx);
        } else {
          openAddTrainingDialog();
        }
      };
      if (isWeekend) td.style.background = '#e2e8f0';

      if (trainings.length === 0) {
        td.textContent = '—';
      } else if (trainings.length > 1) {
        td.className = 'has-conflict';
        td.textContent = '⚠ ' + trainings.length;
        td.title = 'Конфликт: ' + trainings.map(t => t.info.rec.op).join(', ');
      } else {
        const t = trainings[0];
        const rec = t.info.rec;
        const idx = t.idx;
        const isCompleted = rec.status === 'Завершено';
        const isOverdue = t.info.isOverdue;

        if (isOverdue) {
          td.className = 'has-conflict';
          td.style.background = '#fecaca';
          td.style.animation = 'blink-red 1.5s infinite';
        } else {
          td.className = isCompleted ? 'has-training-completed' : 'has-training';
        }

        const shortName = rec.op.split(' ')[0];
        const formator = rec.formator && rec.formator !== '—' ? rec.formator.split(' ')[0] : '';
        td.innerHTML = `<div style="font-weight:700;font-size:11px;">${escapeHtml(shortName)}</div>` +
                       (formator ? `<div style="font-size:9px;color:#64748b;">${escapeHtml(formator)}</div>` : '');
        td.title = `${rec.op} · ${rec.level} · ${rec.status} · Форматор: ${rec.formator}`;
        td.draggable = true;
        td.ondragstart = (e) => onTrainingDragStart(e, idx);
        td.ondragend = onTrainingDragEnd;
        td.onclick = (e) => {
          if (e.target.closest('[data-action]')) return;
          showTrainingCard(idx);
        };
      }
      tr.appendChild(td);
    });

    frag.appendChild(tr);
  }
  tbody.innerHTML = '';
  tbody.appendChild(frag);
}

// ==================== DRAG-N-DROP ====================

function onTrainingDragStart(e, idx) {
  draggedTrainingIdx = idx;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(idx));
  e.target.classList.add('training-cell-dragging');
}
function onTrainingDragEnd(e) {
  e.target.classList.remove('training-cell-dragging');
  document.querySelectorAll('td.drop-target').forEach(td => td.classList.remove('drop-target'));
}
function onTrainingDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drop-target');
}
function onTrainingDragLeave(e) {
  e.currentTarget.classList.remove('drop-target');
}
function onTrainingDrop(e, newPost, newStartDateStr) {
  e.preventDefault();
  e.currentTarget.classList.remove('drop-target');
  if (draggedTrainingIdx < 0) return;

  const records = getSystem().trainingRecords || [];
  const rec = records[draggedTrainingIdx];
  if (!rec) return;

  const oldStart = parseRuDate(rec.startDate);
  const newStart = parseRuDate(newStartDateStr);
  if (!newStart) return;

  let dayShift = 0;
  if (oldStart) dayShift = Math.round((newStart - oldStart) / 86400000);

  const oldValid = parseRuDate(rec.validDate);
  let newValidStr = rec.validDate;
  if (oldValid) {
    const newValid = new Date(oldValid);
    newValid.setDate(newValid.getDate() + dayShift);
    newValidStr = formatRuDate(newValid);
  }

  const conflictCheck = validateTrainingInput({
    op: rec.op,
    post: newPost,
    startDate: newStartDateStr,
    validDate: newValidStr,
    duration: rec.duration,
  }, draggedTrainingIdx, true);

  if (!conflictCheck.ok && conflictCheck.error === 'Отменено пользователем') return;

  rec.post = newPost;
  rec.startDate = newStartDateStr;
  if (newValidStr && newValidStr !== '—') rec.validDate = newValidStr;

  saveSystem();
  logAudit('update_training', `${rec.op} → ${rec.post}`, `Перенесено на ${newStartDateStr}`);
  renderTrainingCalendar();
  renderTrainingTable();
  renderTrainingStats();
  draggedTrainingIdx = -1;
}

// ==================== КАРТОЧКА ЗАПИСИ ====================

function showTrainingCard(idx) {
  const records = getSystem().trainingRecords || [];
  const r = records[idx];
  if (!r) return;

  const info = getTrainingRecordInfo(r, idx);
  const isOverdue = info.isOverdue;
  const overdueDays = isOverdue ? Math.floor((new Date() - info.end) / 86400000) : 0;

  const statusIcon = r.status === 'Завершено' ? '✅'
                   : r.status === 'В процессе' ? '⏳'
                   : '📋';

  let html = `
    <div style="font-size:13px;line-height:1.6;">
      <div style="font-size:16px;font-weight:700;margin-bottom:8px;">
        ${statusIcon} ${escapeHtml(r.op)}
      </div>
      <div><b>Пост:</b> ${escapeHtml(r.post)}</div>
      <div><b>Уровень:</b> <span style="font-weight:700;">${escapeHtml(r.level)}</span></div>
      <div><b>Статус:</b> <span style="color:${
        r.status === 'Завершено' ? '#16a34a' :
        r.status === 'В процессе' ? '#f59e0b' : '#64748b'
      };font-weight:700;">${escapeHtml(r.status)}</span></div>
      <div><b>Форматор:</b> ${escapeHtml(r.formator)}</div>
      <div><b>Начало:</b> ${escapeHtml(r.startDate)}</div>
      <div><b>Валидация:</b> ${escapeHtml(r.validDate)}</div>
      <div><b>Срок:</b> ${r.duration} дн.</div>
      ${r.comment && r.comment !== '—' ? `<div><b>Комментарий:</b> ${escapeHtml(r.comment)}</div>` : ''}
      ${isOverdue ? `<div style="color:#ef4444;font-weight:700;margin-top:8px;">⚠️ Просрочено на ${overdueDays} дн.</div>` : ''}
    </div>
  `;

  const old = document.querySelector('.modal-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9999;display:flex;align-items:center;justify-content:center;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:white;border-radius:12px;padding:20px;min-width:360px;max-width:90vw;';

  modal.innerHTML = `
    <h3 style="margin-bottom:14px;font-size:15px;">Карточка обучения</h3>
    ${html}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;padding-top:12px;border-top:1px solid #e2e8f0;">
      <button class="btn-small" onclick="this.closest('.modal-overlay').remove()">Закрыть</button>
      <button class="btn-small" id="trainingCardEditBtn">✏️ Редактировать</button>
      <button class="btn-small" id="trainingCardApplyBtn" style="background:#16a34a;color:#fff;border-color:#16a34a;">✔ Применить</button>
      <button class="btn-small danger" id="trainingCardDeleteBtn">🗑 Удалить</button>
    </div>
  `;

  overlay.appendChild(modal);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);

  document.getElementById('trainingCardEditBtn').onclick = () => {
    overlay.remove();
    openEditTrainingDialog(idx);
  };
  document.getElementById('trainingCardApplyBtn').onclick = () => {
    overlay.remove();
    applyTrainingRecord(idx);
  };
  document.getElementById('trainingCardDeleteBtn').onclick = () => {
    overlay.remove();
    deleteTrainingRecord(idx);
  };
}

// ==================== СПИСОК ЗАПИСЕЙ ====================

function renderTrainingTable() {
  const tbody = document.querySelector('#trainingTable tbody');
  if (!tbody) return;

  const thead = document.querySelector('#trainingTable thead');
  if (thead && !thead.dataset.filterReady) {
    thead.dataset.filterReady = '1';
    const firstRow = thead.querySelector('tr');
    if (firstRow && !firstRow.querySelector('.training-filter-row')) {
      const filterRow = document.createElement('tr');
      filterRow.className = 'training-filter-row';
      filterRow.style.cssText = 'background:#f8fafc;';
      filterRow.innerHTML = `
        <td colspan="13" style="padding:8px;text-align:left;border:1px solid #cbd5e1;font-size:12px;">
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <b>Фильтры:</b>
            <label style="display:flex;align-items:center;gap:4px;">
              <input type="checkbox" id="trainingOnlyCurrentSection" ${trainingFilters.onlyCurrentSection ? 'checked' : ''}
                     onchange="trainingFilters.onlyCurrentSection = this.checked; renderTrainingTable(); renderTrainingCalendar();">
              <span>Только текущий участок</span>
            </label>
            <select id="trainingFilterStatus" style="padding:3px 6px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px;"
                    onchange="trainingFilters.status = this.value; renderTrainingTable(); renderTrainingCalendar();">
              <option value="">— все статусы —</option>
              <option value="План">📋 План</option>
              <option value="В процессе">⏳ В процессе</option>
              <option value="Завершено">✅ Завершено</option>
            </select>
            <input type="text" id="trainingFilterSearch" placeholder="Поиск…"
                   style="padding:3px 8px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px;width:160px;"
                   oninput="trainingFilters.search = this.value; renderTrainingTable(); renderTrainingCalendar();">
            <span style="border-left:1px solid #cbd5e1;height:16px;"></span>
            <button class="btn-small" style="font-size:11px;padding:3px 8px;"
                    onclick="bulkChangeStatus('Завершено')" title="Сменить статус выбранным на «Завершено»">
              ✅ Завершить
            </button>
            <button class="btn-small" style="font-size:11px;padding:3px 8px;"
                    onclick="bulkChangeStatus('В процессе')" title="Сменить статус выбранным на «В процессе»">
              ⏳ В процесс
            </button>
            <button class="btn-small danger" style="font-size:11px;padding:3px 8px;"
                    onclick="deleteSelectedTrainings()" title="Удалить выбранные">
              🗑 Удалить
            </button>
            <span id="trainingSelectedCount" style="color:#64748b;font-size:11px;"></span>
          </div>
        </td>
      `;
      if (firstRow && firstRow.parentNode) {
        firstRow.parentNode.insertBefore(filterRow, firstRow.nextSibling);
      }
    }
  }

  setTimeout(() => {
    const statusEl = document.getElementById('trainingFilterStatus');
    if (statusEl) statusEl.value = trainingFilters.status;
    const searchEl = document.getElementById('trainingFilterSearch');
    if (searchEl) searchEl.value = trainingFilters.search;
  }, 0);

  const filtered = getFilteredTrainingRecords();

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="13" style="text-align:center;color:#94a3b8;padding:40px;">Нет записей</td></tr>';
    updateSelectedCount();
    return;
  }

  const frag = document.createDocumentFragment();
  filtered.forEach(({ r, idx }) => {
    const tr = document.createElement('tr');
    if (trainingSelected.has(idx)) tr.style.background = '#dbeafe';

    const tdCheck = document.createElement('td');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = trainingSelected.has(idx);
    cb.onchange = () => {
      if (cb.checked) trainingSelected.add(idx);
      else trainingSelected.delete(idx);
      renderTrainingTable();
    };
    tdCheck.appendChild(cb);
    tr.appendChild(tdCheck);

    const cells = [r.year, r.month, r.post, r.op, r.level];
    cells.forEach(v => {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    });

    const tdStatus = document.createElement('td');
    tdStatus.textContent = r.status;
    tdStatus.style.fontWeight = '700';
    if (r.status === 'Завершено') tdStatus.style.color = '#16a34a';
    else if (r.status === 'В процессе') tdStatus.style.color = '#f59e0b';
    else tdStatus.style.color = '#64748b';
    tr.appendChild(tdStatus);

    [r.formator, r.startDate, r.validDate, r.duration, r.comment].forEach(v => {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    });

    const tdActions = document.createElement('td');
    tdActions.style.cssText = 'white-space:nowrap;';

    const editSpan = document.createElement('span');
    editSpan.textContent = '✏️';
    editSpan.title = 'Редактировать';
    editSpan.style.cssText = 'cursor:pointer;margin-right:6px;';
    editSpan.onclick = () => openEditTrainingDialog(idx);
    tdActions.appendChild(editSpan);

    const applySpan = document.createElement('span');
    applySpan.textContent = '✔';
    applySpan.title = 'Применить к матрице';
    applySpan.style.cssText = 'cursor:pointer;color:#16a34a;margin-right:6px;';
    applySpan.onclick = () => applyTrainingRecord(idx);
    tdActions.appendChild(applySpan);

    const delSpan = document.createElement('span');
    delSpan.textContent = '✕';
    delSpan.style.cssText = 'cursor:pointer;color:#ef4444;';
    delSpan.onclick = () => deleteTrainingRecord(idx);
    tdActions.appendChild(delSpan);

    tr.appendChild(tdActions);
    frag.appendChild(tr);
  });
  tbody.innerHTML = '';
  tbody.appendChild(frag);
  updateSelectedCount();
}

function updateSelectedCount() {
  const el = document.getElementById('trainingSelectedCount');
  if (el) {
    if (trainingSelected.size > 0) {
      el.textContent = `Выбрано: ${trainingSelected.size}`;
      el.style.fontWeight = '700';
      el.style.color = '#3b82f6';
    } else {
      el.textContent = '';
    }
  }
}

// ==================== СТАТИСТИКА ====================

function renderTrainingStats() {
  const cont = document.getElementById('trainingStats');
  if (!cont) return;

  const records = getFilteredTrainingRecords().map(x => x.r);
  const total = records.length;
  let inProgress = 0, completed = 0, overdue = 0;
  let totalDuration = 0, durationCount = 0;

  const today = new Date();
  records.forEach(r => {
    if (r.status === 'В процессе') inProgress++;
    if (r.status === 'Завершено') completed++;
    const start = parseRuDate(r.startDate);
    let end = parseRuDate(r.validDate);
    if (!end && start && r.duration) {
      end = new Date(start);
      end.setDate(end.getDate() + parseInt(r.duration));
    }
    if (end && end < today && r.status !== 'Завершено') overdue++;
    if (r.duration) {
      totalDuration += parseInt(r.duration) || 0;
      durationCount++;
    }
  });

  const avgDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;

  cont.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;">
      <div class="training-stat-card" style="background:#f1f5f9;border-radius:8px;padding:10px 16px;text-align:center;min-width:110px;">
        <div style="font-size:22px;font-weight:800;">${total}</div>
        <div style="font-size:10px;text-transform:uppercase;color:#64748b;">Всего</div>
      </div>
      <div class="training-stat-card" style="background:#fef3c7;border-radius:8px;padding:10px 16px;text-align:center;min-width:110px;">
        <div style="font-size:22px;font-weight:800;color:#f59e0b;">${inProgress}</div>
        <div style="font-size:10px;text-transform:uppercase;color:#64748b;">В процессе</div>
      </div>
      <div class="training-stat-card" style="background:#dcfce7;border-radius:8px;padding:10px 16px;text-align:center;min-width:110px;">
        <div style="font-size:22px;font-weight:800;color:#16a34a;">${completed}</div>
        <div style="font-size:10px;text-transform:uppercase;color:#64748b;">Завершено</div>
      </div>
      <div class="training-stat-card" style="background:#fee2e2;border-radius:8px;padding:10px 16px;text-align:center;min-width:110px;">
        <div style="font-size:22px;font-weight:800;color:#ef4444;">${overdue}</div>
        <div style="font-size:10px;text-transform:uppercase;color:#64748b;">Просрочено</div>
      </div>
      <div class="training-stat-card" style="background:#dbeafe;border-radius:8px;padding:10px 16px;text-align:center;min-width:110px;">
        <div style="font-size:22px;font-weight:800;color:#3b82f6;">${avgDuration}</div>
        <div style="font-size:10px;text-transform:uppercase;color:#64748b;">Ср. срок (дн.)</div>
      </div>
    </div>
  `;
}

// ==================== ЭКСПОРТ В EXCEL ====================

function exportTrainingsToExcel() {
  if (typeof XLSX === 'undefined') { alert('Библиотека XLSX не загружена'); return; }
  const records = getFilteredTrainingRecords().map(x => x.r);
  if (records.length === 0) { alert('Нет записей для экспорта'); return; }

  const rows = [['Год', 'Месяц', 'Пост', 'Оператор', 'Уровень', 'Статус',
                 'Форматор', 'Дата начала', 'Дата валидации', 'Срок', 'Комментарий']];
  records.forEach(r => rows.push([
    r.year, r.month, r.post, r.op, r.level, r.status, r.formator,
    r.startDate, r.validDate, r.duration, r.comment
  ]));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Обучения');
  XLSX.writeFile(wb, `Обучения_${formatDate().replace(/\./g, '-')}.xlsx`);
  logAudit('export_excel', 'Обучения', `Записей: ${records.length}`);
}

// ==================== ПЕЧАТЬ КАЛЕНДАРЯ ====================

function printTrainingCalendar() {
  const section = getCurrentSection();
  const shift = getCurrentShift();
  const monthName = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                     'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][trainingCalendarMonth];

  const printWindow = window.open('', '_blank', 'width=1200,height=800');
  if (!printWindow) { alert('Разрешите всплывающие окна для печати'); return; }

  const table = document.getElementById('trainingCalendarTable');
  const tableHTML = table ? table.outerHTML : '<p>Нет данных</p>';

  const html = `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <title>Обучения — ${escapeHtml(section.name)} — ${escapeHtml(monthName)} ${trainingCalendarYear}</title>
      <style>
        @page { size: A4 landscape; margin: 8mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; color: #1e293b; padding: 10px; }
        h1 { font-size: 16px; margin: 0 0 4px; }
        .sub { font-size: 11px; color: #64748b; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th, td { border: 1px solid #cbd5e1; padding: 3px 4px; text-align: center; }
        th { background: #f1f5f9; font-weight: 700; }
        td:first-child { text-align: left; font-weight: 600; min-width: 120px; }
        .has-training { background: #dbeafe; }
        .has-training-completed { background: #bbf7d0; }
        .has-conflict { background: #fecaca; }
      </style>
    </head>
    <body>
      <h1>Календарь обучений — ${escapeHtml(section.name)}</h1>
      <div class="sub">Смена: <b>${escapeHtml(shift)}</b> · Период: <b>${escapeHtml(monthName)} ${trainingCalendarYear}</b></div>
      ${tableHTML}
      <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); }<\/script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

// ==================== ПУБЛИЧНЫЕ ФУНКЦИИ ДЛЯ UI ====================

function onTrainingFilterChange() {
  const sectionEl = document.getElementById('trainingOnlyCurrentSection');
  if (sectionEl) trainingFilters.onlyCurrentSection = sectionEl.checked;

  const statusEl = document.getElementById('trainingFilterStatus');
  if (statusEl) trainingFilters.status = statusEl.value;

  const searchEl = document.getElementById('trainingFilterSearch');
  if (searchEl) trainingFilters.search = searchEl.value;

  renderTrainingCalendar();
  renderTrainingTable();
  renderTrainingStats();
}

// Инициализация
window.addEventListener('load', () => {
  setTimeout(() => {
    if (document.getElementById('training')?.classList.contains('active')) {
      renderTrainingCalendar();
      renderTrainingTable();
      renderTrainingStats();
    }
  }, 200);
});