// ======================== МИГРАЦИЯ: ПЕРЕНОС ILU НА СЛЕДУЮЩИЕ ДНИ ========================
// Утилита для заполнения ПУСТЫХ дней уровнями (и опционально назначениями/явкой)
// из предыдущего непустого дня той же смены.
//
// Логика:
//   1. Сортируем дни смены по дате.
//   2. Идём по порядку.
//   3. Если день непустой — он становится новым шаблоном.
//   4. Если день пустой — берём данные из последнего шаблона, заполняем
//      только null-ячейки, и САМ СТАНОВИТСЯ новым шаблоном (каскад).
//
// Также есть модальное окно для переноса на КОНКРЕТНЫЙ диапазон дат.

/**
 * Проверяет, есть ли в дне хотя бы один непустой уровень.
 */
function dayHasAnyLevel(day) {
  if (!day || !day.levels) return false;
  for (const pid in day.levels) {
    const lm = day.levels[pid];
    if (!lm) continue;
    for (const oid in lm) {
      const v = lm[oid];
      if (v !== null && v !== undefined && v !== '') return true;
    }
  }
  return false;
}

/**
 * Переносит данные из templateDay в targetDay.
 * Заполняет ТОЛЬКО null-ячейки.
 * @param {Object} targetDay
 * @param {Object} templateDay
 * @param {Object} opts — { levels: true, assignments: false, attendance: false }
 * @returns {number} сколько ячеек заполнено
 */
function transferDayFromTemplate(targetDay, templateDay, opts) {
  opts = opts || {};
  const doLevels = opts.levels !== false;       // по умолчанию уровни — да
  const doAssignments = opts.assignments === true;  // по умолчанию назначения — НЕТ
  const doAttendance = opts.attendance === true;    // по умолчанию явка — НЕТ

  if (!templateDay) return 0;
  if (!targetDay.levels) targetDay.levels = {};
  if (!targetDay.assignments) targetDay.assignments = {};
  if (!targetDay.attendance) targetDay.attendance = {};

  let filled = 0;

  // -------- УРОВНИ --------
  if (doLevels && templateDay.levels) {
    for (const pid in templateDay.levels) {
      const templateLm = templateDay.levels[pid];
      if (!templateLm) continue;
      if (!targetDay.levels[pid]) targetDay.levels[pid] = {};
      const targetLm = targetDay.levels[pid];
      for (const oid in templateLm) {
        const srcVal = templateLm[oid];
        if (srcVal === null || srcVal === undefined || srcVal === '') continue;
        const curVal = targetLm[oid];
        if (curVal === null || curVal === undefined || curVal === '') {
          targetLm[oid] = srcVal;
          filled++;
        }
      }
    }
  }

  // -------- НАЗНАЧЕНИЯ --------
  if (doAssignments && templateDay.assignments) {
    for (const pid in templateDay.assignments) {
      const srcVal = templateDay.assignments[pid];
      if (srcVal === null || srcVal === undefined) continue;
      const curVal = targetDay.assignments[pid];
      if (curVal === null || curVal === undefined) {
        targetDay.assignments[pid] = JSON.parse(JSON.stringify(srcVal));
        filled++;
      }
    }
  }

  // -------- ЯВКА --------
  if (doAttendance && templateDay.attendance) {
    for (const oid in templateDay.attendance) {
      const srcVal = templateDay.attendance[oid];
      if (srcVal === null || srcVal === undefined || srcVal === '') continue;
      const curVal = targetDay.attendance[oid];
      if (curVal === null || curVal === undefined || curVal === '' || curVal === 'Я') {
        // для явки «Я» считается значением по умолчанию
        if (srcVal !== 'Я' || curVal !== 'Я') {
          targetDay.attendance[oid] = srcVal;
          filled++;
        }
      }
    }
  }

  return filled;
}

/**
 * Считает, сколько ячеек можно было бы заполнить (для dry-run).
 */
function countTransferableCells(targetDay, templateDay, opts) {
  if (!templateDay) return 0;
  opts = opts || {};
  const doLevels = opts.levels !== false;
  const doAssignments = opts.assignments === true;
  const doAttendance = opts.attendance === true;

  let count = 0;

  if (doLevels && templateDay.levels) {
    for (const pid in templateDay.levels) {
      const lm = templateDay.levels[pid];
      if (!lm) continue;
      for (const oid in lm) {
        const v = lm[oid];
        if (v === null || v === undefined || v === '') continue;
        const cur = targetDay?.levels?.[pid]?.[oid];
        if (cur === null || cur === undefined || cur === '') count++;
      }
    }
  }
  if (doAssignments && templateDay.assignments) {
    for (const pid in templateDay.assignments) {
      const v = templateDay.assignments[pid];
      if (v === null || v === undefined) continue;
      const cur = targetDay?.assignments?.[pid];
      if (cur === null || cur === undefined) count++;
    }
  }
  if (doAttendance && templateDay.attendance) {
    for (const oid in templateDay.attendance) {
      const v = templateDay.attendance[oid];
      if (v === null || v === undefined || v === '') continue;
      const cur = targetDay?.attendance?.[oid];
      if (cur === null || cur === undefined || cur === '') count++;
    }
  }
  return count;
}

/**
 * Основная функция миграции (полная, каскадная).
 * @param {Object} opts
 * @param {boolean} opts.dryRun — если true, только считает, не сохраняет
 * @param {boolean} opts.levels — копировать уровни (по умолчанию true)
 * @param {boolean} opts.assignments — копировать назначения (по умолчанию false)
 * @param {boolean} opts.attendance — копировать явку (по умолчанию false)
 * @param {string} opts.sectionId — ограничить участком (опционально)
 * @param {string} opts.shift — ограничить сменой A/B/C (опционально)
 * @returns {{sections:number, shifts:number, days:number, cells:number}}
 */
function migrateHistoricalDays(opts) {
  opts = opts || {};
  const dryRun = !!opts.dryRun;

  const sys = getSystem();
  const report = { sections: 0, shifts: 0, days: 0, cells: 0 };

  (sys.sections || []).forEach(section => {
    if (opts.sectionId && section.id !== opts.sectionId) return;
    let sectionTouched = false;

    const shiftsToProcess = opts.shift ? [opts.shift] : SHIFTS;

    shiftsToProcess.forEach(shift => {
      const shiftData = section.shifts?.[shift];
      if (!shiftData || !shiftData.days) return;

      // Сортируем даты по возрастанию
      const dates = Object.keys(shiftData.days)
        .map(d => ({ date: d, ms: parseDate(d)?.getTime() || 0 }))
        .sort((a, b) => a.ms - b.ms);

      let lastNonEmptyDay = null;
      let shiftTouched = false;

      dates.forEach(({ date }) => {
        const day = shiftData.days[date];
        if (!day) return;

        const hasLevels = dayHasAnyLevel(day);

        if (hasLevels) {
          lastNonEmptyDay = day;
          return;
        }

        if (!lastNonEmptyDay) return;

        if (dryRun) {
          const wouldFill = countTransferableCells(day, lastNonEmptyDay, opts);
          if (wouldFill > 0) {
            report.days++;
            report.cells += wouldFill;
            sectionTouched = true;
            shiftTouched = true;
            lastNonEmptyDay = day;
          }
        } else {
          const filled = transferDayFromTemplate(day, lastNonEmptyDay, opts);
          if (filled > 0) {
            report.days++;
            report.cells += filled;
            sectionTouched = true;
            shiftTouched = true;
          }
          // КЛЮЧЕВОЕ: даже если 0 заполнено — день становится шаблоном,
          // чтобы цепочка пустых дней работала каскадно
          lastNonEmptyDay = day;
        }
      });

      if (shiftTouched) report.shifts++;
    });

    if (sectionTouched) report.sections++;
  });

  if (!dryRun && report.cells > 0) {
    saveSystem();
    logAudit('migrate_ilu_days', 'Система',
      `Заполнено ячеек: ${report.cells} · дней: ${report.days}`);
  }

  return report;
}

// ======================== МОДАЛЬНОЕ ОКНО ========================
// Открывает окно с настройками переноса и выбором диапазона дат.

let _migrateModalState = {
  sectionId: '',
  shift: 'A',
  dateFrom: '',
  dateTo: '',
  templateMode: 'previous', // 'previous' | 'specific'
  specificTemplateDate: '',
  copyLevels: true,
  copyAssignments: false,
  copyAttendance: false
};

function openMigrateDialog() {
  _migrateModalState.sectionId = getCurrentSection().id;
  _migrateModalState.shift = getCurrentShift();

  // По умолчанию — последние 10 дней
  const dates = getAvailableDates();
  _migrateModalState.dateFrom = dates[dates.length - 1] || formatDate();
  _migrateModalState.dateTo = dates[0] || formatDate();

  renderMigrateDialog();
}

function renderMigrateDialog() {
  const old = document.getElementById('migrateModal');
  if (old) old.remove();

  const sys = getSystem();
  const sections = sys.sections || [];
  const state = _migrateModalState;

  const overlay = document.createElement('div');
  overlay.id = 'migrateModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:var(--card);color:var(--text);border-radius:12px;padding:20px;min-width:520px;max-width:92vw;max-height:92vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,0.3);';

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <h3 style="font-size:16px;font-weight:700;margin:0;">📅 Перенос данных ILU на даты</h3>
      <button class="btn-small" onclick="closeMigrateDialog()">✕</button>
    </div>

    <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;line-height:1.5;">
      Заполняет <b>пустые</b> дни данными из предыдущего непустого дня той же смены.
      Заполненные ячейки не перезаписываются.
    </div>

    <div style="display:flex;flex-direction:column;gap:12px;">

      <div style="display:grid;grid-template-columns:140px 1fr;gap:10px;align-items:center;">
        <label style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);text-align:right;">Участок</label>
        <select id="migSection" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--bg);color:var(--text);">
          ${sections.map(s => `<option value="${escapeHtml(s.id)}" ${s.id === state.sectionId ? 'selected' : ''}>${escapeHtml(s.name)} — ${escapeHtml(s.department || '')} / ${escapeHtml(s.workshop || '')}</option>`).join('')}
        </select>
      </div>

      <div style="display:grid;grid-template-columns:140px 1fr;gap:10px;align-items:center;">
        <label style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);text-align:right;">Смена</label>
        <select id="migShift" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--bg);color:var(--text);">
          <option value="A" ${state.shift === 'A' ? 'selected' : ''}>A</option>
          <option value="B" ${state.shift === 'B' ? 'selected' : ''}>B</option>
          <option value="C" ${state.shift === 'C' ? 'selected' : ''}>C</option>
          <option value="" ${state.shift === '' ? 'selected' : ''}>Все смены</option>
        </select>
      </div>

      <div style="border-top:1px solid var(--border);margin:4px 0;"></div>

      <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--text-muted);">Диапазон дат</div>

      <div style="display:grid;grid-template-columns:140px 1fr;gap:10px;align-items:center;">
        <label style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);text-align:right;">От</label>
        <input type="date" id="migDateFrom"
               value="${_isoFromRu(state.dateFrom)}"
               style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--bg);color:var(--text);">
      </div>

      <div style="display:grid;grid-template-columns:140px 1fr;gap:10px;align-items:center;">
        <label style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);text-align:right;">До</label>
        <input type="date" id="migDateTo"
               value="${_isoFromRu(state.dateTo)}"
               style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--bg);color:var(--text);">
      </div>

      <div style="display:flex;gap:6px;margin-left:150px;">
        <button class="btn-small" onclick="migSetRange('today')">Сегодня</button>
        <button class="btn-small" onclick="migSetRange('week')">Неделя</button>
        <button class="btn-small" onclick="migSetRange('month')">Месяц</button>
        <button class="btn-small" onclick="migSetRange('last10')">10 дней</button>
      </div>

      <div style="border-top:1px solid var(--border);margin:4px 0;"></div>

      <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--text-muted);">Источник данных</div>

      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
        <input type="radio" name="migTemplateMode" value="previous" ${state.templateMode === 'previous' ? 'checked' : ''}
               onchange="migOnTemplateModeChange(this.value)">
        <span>Из предыдущего непустого дня (каскадно — цепочка пустых дней)</span>
      </label>

      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
        <input type="radio" name="migTemplateMode" value="specific" ${state.templateMode === 'specific' ? 'checked' : ''}
               onchange="migOnTemplateModeChange(this.value)">
        <span>Из конкретного дня</span>
      </label>

      <div id="migSpecificWrap" style="display:${state.templateMode === 'specific' ? 'grid' : 'none'};grid-template-columns:140px 1fr;gap:10px;align-items:center;">
        <label style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);text-align:right;">Шаблон</label>
        <input type="date" id="migTemplateDate"
               value="${_isoFromRu(state.specificTemplateDate || state.dateFrom)}"
               style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--bg);color:var(--text);">
      </div>

      <div style="border-top:1px solid var(--border);margin:4px 0;"></div>

      <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--text-muted);">Что копировать</div>

      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
        <input type="checkbox" id="migCopyLevels" ${state.copyLevels ? 'checked' : ''}>
        <span>Уровни ILU (I / Iкр / L / Lкр / U)</span>
      </label>

      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
        <input type="checkbox" id="migCopyAssignments" ${state.copyAssignments ? 'checked' : ''}>
        <span>Назначения (кто стоит на посту)</span>
      </label>

      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
        <input type="checkbox" id="migCopyAttendance" ${state.copyAttendance ? 'checked' : ''}>
        <span>Явка операторов</span>
      </label>

    </div>

    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px;padding-top:12px;border-top:1px solid var(--border);">
      <button class="btn-small" onclick="migPreview()">👁 Предпросмотр</button>
      <button class="btn-small" onclick="closeMigrateDialog()">Отмена</button>
      <button class="btn-small" style="background:#16a34a;color:#fff;border-color:#16a34a;" onclick="migRun()">▶ Выполнить</button>
    </div>
  `;

  modal.innerHTML = html;
  overlay.appendChild(modal);
  overlay.onclick = (e) => { if (e.target === overlay) closeMigrateDialog(); };
  document.body.appendChild(overlay);
}

function _isoFromRu(ruDate) {
  // '24.10.2026' → '2026-10-24'
  if (!ruDate) return '';
  const parts = String(ruDate).split('.');
  if (parts.length !== 3) return '';
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function _ruFromIso(isoDate) {
  // '2026-10-24' → '24.10.2026'
  if (!isoDate) return '';
  const parts = String(isoDate).split('-');
  if (parts.length !== 3) return '';
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function closeMigrateDialog() {
  const el = document.getElementById('migrateModal');
  if (el) el.remove();
}

function migSetRange(range) {
  const today = new Date();
  let from = new Date(today);
  let to = new Date(today);

  if (range === 'today') {
    // from = to = today
  } else if (range === 'week') {
    from.setDate(today.getDate() - 6);
  } else if (range === 'month') {
    from.setDate(today.getDate() - 29);
  } else if (range === 'last10') {
    from.setDate(today.getDate() - 9);
  }

  const fromEl = document.getElementById('migDateFrom');
  const toEl = document.getElementById('migDateTo');
  if (fromEl) fromEl.value = formatDate(from).split('.').reverse().join('-');
  if (toEl) toEl.value = formatDate(to).split('.').reverse().join('-');
}

function migOnTemplateModeChange(mode) {
  _migrateModalState.templateMode = mode;
  const wrap = document.getElementById('migSpecificWrap');
  if (wrap) wrap.style.display = mode === 'specific' ? 'grid' : 'none';
}

function _readMigrateForm() {
  const state = _migrateModalState;
  state.sectionId = document.getElementById('migSection')?.value || state.sectionId;
  state.shift = document.getElementById('migShift')?.value ?? state.shift;
  state.dateFrom = _ruFromIso(document.getElementById('migDateFrom')?.value || '');
  state.dateTo = _ruFromIso(document.getElementById('migDateTo')?.value || '');
  state.templateMode = document.querySelector('input[name="migTemplateMode"]:checked')?.value || 'previous';
  state.specificTemplateDate = _ruFromIso(document.getElementById('migTemplateDate')?.value || '');
  state.copyLevels = !!document.getElementById('migCopyLevels')?.checked;
  state.copyAssignments = !!document.getElementById('migCopyAssignments')?.checked;
  state.copyAttendance = !!document.getElementById('migCopyAttendance')?.checked;
  return state;
}

// ======================== ПРЕДПРОСМОТР ========================

function migPreview() {
  const state = _readMigrateForm();
  const validation = _validateMigrateState(state);
  if (!validation.ok) { alert(validation.error); return; }

  const report = _runMigrationOnRange(state, { dryRun: true });

  if (report.cells === 0) {
    alert('✅ Нечего переносить — все дни в диапазоне уже заполнены.');
    return;
  }

  alert(
    `Предпросмотр:\n\n` +
    `• Участок: ${state.sectionId.slice(0,8)}…\n` +
    `• Смена: ${state.shift || 'все'}\n` +
    `• Диапазон: ${state.dateFrom} — ${state.dateTo}\n` +
    `• Дней к обработке: ${report.days}\n` +
    `• Ячеек к заполнению: ${report.cells}`
  );
}

function migRun() {
  const state = _readMigrateForm();
  const validation = _validateMigrateState(state);
  if (!validation.ok) { alert(validation.error); return; }

  if (!state.copyLevels && !state.copyAssignments && !state.copyAttendance) {
    alert('Выберите хотя бы один тип данных для переноса');
    return;
  }

  const preview = _runMigrationOnRange(state, { dryRun: true });
  if (preview.cells === 0) {
    alert('✅ Нечего переносить — все дни в диапазоне уже заполнены.');
    return;
  }

  if (!confirm(
    `Перенести данные?\n\n` +
    `• Дней к обработке: ${preview.days}\n` +
    `• Ячеек к заполнению: ${preview.cells}\n\n` +
    `Заполненные ячейки НЕ перезаписываются.`
  )) return;

  const result = _runMigrationOnRange(state, { dryRun: false });

  closeMigrateDialog();

  alert(
    `✅ Готово!\n\n` +
    `Обработано дней: ${result.days}\n` +
    `Заполнено ячеек: ${result.cells}`
  );

  if (typeof showToast === 'function') {
    showToast(`✅ Перенос: ${result.cells} ячеек в ${result.days} днях`);
  }

  if (typeof refreshAll === 'function') refreshAll();
  if (typeof renderMatrix === 'function') renderMatrix();
  if (typeof renderSE8Blank === 'function') renderSE8Blank();
}

function _validateMigrateState(state) {
  if (!state.dateFrom || !state.dateTo) {
    return { ok: false, error: 'Укажите диапазон дат' };
  }
  const from = parseDate(state.dateFrom);
  const to = parseDate(state.dateTo);
  if (!from || !to) return { ok: false, error: 'Неверный формат даты' };
  if (from > to) return { ok: false, error: 'Дата «От» больше даты «До»' };

  if (state.templateMode === 'specific') {
    if (!state.specificTemplateDate) {
      return { ok: false, error: 'Укажите дату шаблона' };
    }
    const tpl = parseDate(state.specificTemplateDate);
    if (!tpl) return { ok: false, error: 'Неверная дата шаблона' };
  }

  return { ok: true };
}

// ======================== ОСНОВНАЯ ЛОГИКА С ФИЛЬТРОМ ========================

/**
 * Запускает миграцию на конкретном диапазоне с выбранными опциями.
 * @param {Object} state — состояние формы
 * @param {Object} opts — { dryRun: bool }
 */
function _runMigrationOnRange(state, opts) {
  opts = opts || {};
  const dryRun = !!opts.dryRun;

  const sys = getSystem();
  const report = { days: 0, cells: 0, shifts: 0 };

  const section = sys.sections.find(s => s.id === state.sectionId);
  if (!section) return report;

  const fromMs = parseDate(state.dateFrom)?.getTime() || 0;
  const toMs = parseDate(state.dateTo)?.getTime() || 0;

  const shiftsToProcess = state.shift ? [state.shift] : SHIFTS;

  const transferOpts = {
    levels: state.copyLevels,
    assignments: state.copyAssignments,
    attendance: state.copyAttendance
  };

  shiftsToProcess.forEach(shift => {
    const shiftData = section.shifts?.[shift];
    if (!shiftData || !shiftData.days) return;

    // Все даты смены, отсортированные
    const allDates = Object.keys(shiftData.days)
      .map(d => ({ date: d, ms: parseDate(d)?.getTime() || 0 }))
      .sort((a, b) => a.ms - b.ms);

    // Фильтр: только внутри диапазона + все даты ДО диапазона (нужны для шаблона)
    const datesInRange = allDates.filter(x => x.ms >= fromMs && x.ms <= toMs);
    const datesBefore = allDates.filter(x => x.ms < fromMs);
    const sortedDates = [...datesBefore, ...datesInRange];

    // -------- Специфический шаблон: берём конкретный день --------
    let specificTemplateDay = null;
    if (state.templateMode === 'specific' && state.specificTemplateDate) {
      specificTemplateDay = shiftData.days[state.specificTemplateDate] || null;
      if (!specificTemplateDay) {
        // Если в смене нет такого дня — пропускаем смену
        return;
      }
    }

    let lastNonEmptyDay = null;

    sortedDates.forEach(({ date, ms }) => {
      const day = shiftData.days[date];
      if (!day) return;

      const isInRange = ms >= fromMs && ms <= toMs;

      // Если день вне диапазона — просто обновляем шаблон, если он непустой
      if (!isInRange) {
        if (dayHasAnyLevel(day)) lastNonEmptyDay = day;
        return;
      }

      // Внутри диапазона
      // Определяем, какой шаблон использовать
      let template = null;
      if (state.templateMode === 'specific') {
        template = specificTemplateDay;
      } else {
        template = lastNonEmptyDay;
      }

      if (!template) return;

      // Проверяем, что день пустой (нет уровней)
      const isDayEmpty = !dayHasAnyLevel(day);

      if (isDayEmpty) {
        if (dryRun) {
          const wouldFill = countTransferableCells(day, template, transferOpts);
          if (wouldFill > 0) {
            report.days++;
            report.cells += wouldFill;
            // для каскадной логики в dry-run тоже обновляем шаблон
            if (state.templateMode === 'previous') lastNonEmptyDay = day;
          }
        } else {
          const filled = transferDayFromTemplate(day, template, transferOpts);
          if (filled > 0) {
            report.days++;
            report.cells += filled;
          }
          // каскад: заполненный день становится шаблоном
          if (state.templateMode === 'previous') lastNonEmptyDay = day;
        }
      } else {
        // день непустой — обновляем шаблон
        if (state.templateMode === 'previous') lastNonEmptyDay = day;
      }
    });

    report.shifts++;
  });

  if (!dryRun && report.cells > 0) {
    saveSystem();
    if (typeof logAudit === 'function') {
      logAudit('migrate_ilu_days', 'Перенос на даты',
        `${state.dateFrom} — ${state.dateTo} · дней: ${report.days} · ячеек: ${report.cells}`);
    }
  }

  return report;
}