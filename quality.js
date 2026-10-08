// ======================== ДОСКА КАЧЕСТВА ========================
console.log('[quality.js] Загружен (v14 — с архивом)');

const PREV_WEEK_KEY = '__prev_week__';

const QUALITY_DAY_COLUMNS_LABELS = [
  'Вызов пост',
  'Чек',
  'САО',
  'П1П',
  'ИКС',
];
const QUALITY_DAY_COLUMNS = QUALITY_DAY_COLUMNS_LABELS.length;

const QUALITY_COLORS = {
  'Вызов пост': '#000000',
  'Чек':        '#facc15',
  'САО':        '#2563eb',
  'П1П':        '#f97316',
  'ИКС':        '#dc2626',
};

// ==================== ДОСТУП К ДОСКЕ ====================

function getQualityBoard() {
  const sys = getSystem();
  if (!sys.qualityBoard) {
    sys.qualityBoard = {
      operators: [],
      posts: [],
      actionPlans: [],
      cars: {},
      history: [],
      lastUpdate: ''
    };
    saveSystem();
  }
  if (!Array.isArray(sys.qualityBoard.operators)) sys.qualityBoard.operators = [];
  if (!Array.isArray(sys.qualityBoard.posts)) sys.qualityBoard.posts = [];
  if (!sys.qualityBoard.cars || typeof sys.qualityBoard.cars !== 'object') sys.qualityBoard.cars = {};
  return sys.qualityBoard;
}

function saveQualityBoard() {
  const board = getQualityBoard();
  board.lastUpdate = new Date().toISOString();
  saveSystem();
}

// ==================== КОЛ-ВО АВТО ====================

function getCars(key) {
  const board = getQualityBoard();

  if (key === PREV_WEEK_KEY) {
    const today = new Date();
    const dow = today.getDay();
    const daysToMonday = (dow === 0 ? -6 : 1 - dow);
    const mondayThis = new Date(today);
    mondayThis.setDate(today.getDate() + daysToMonday);
    const mondayPrev = new Date(mondayThis);
    mondayPrev.setDate(mondayThis.getDate() - 7);

    let total = 0;
    for (let i = 0; i < 5; i++) {
      const d = new Date(mondayPrev);
      d.setDate(mondayPrev.getDate() + i);
      const k = formatDate(d);
      total += Math.max(0, parseInt(board.cars[k]) || 0);
    }
    return total;
  }

  const v = board.cars[key];
  return Math.max(0, parseInt(v) || 0);
}

function setCars(key, value) {
  if (key === PREV_WEEK_KEY) return;
  const board = getQualityBoard();
  const num = Math.max(0, parseInt(value) || 0);
  if (num === 0) delete board.cars[key];
  else board.cars[key] = num;
  saveQualityBoard();
}

// ==================== СИНХРОНИЗАЦИЯ ОПЕРАТОРОВ ====================

function syncQualityOperatorsFromShift() {
  const board = getQualityBoard();
  const shiftData = getCurrentShiftData();
  const operators = (shiftData.operators || []).filter(o => o.role !== 'НУ');

  const existingIds = new Set(board.operators.map(o => o.opId).filter(Boolean));

  operators.forEach(op => {
    if (existingIds.has(op.id)) return;
    board.operators.push({
      id: genId(),
      opId: op.id,
      name: op.name,
      postId: '',
      comment: '',
      defects: {},
    });
  });

  const currentIds = new Set(operators.map(o => o.id));
  board.operators = board.operators.filter(o => !o.opId || currentIds.has(o.opId));

  saveQualityBoard();
}

// ==================== ОПЕРАТОРЫ / ПОСТЫ ====================

function getQualityAvailableOperators() {
  const shiftData = getCurrentShiftData();
  return (shiftData.operators || []).filter(o => o.role !== 'НУ');
}

function getQualityOperatorName(opId) {
  if (!opId) return '';
  const op = getQualityAvailableOperators().find(o => o.id === opId);
  return op ? op.name : '';
}

function getQualityAvailablePosts() {
  const section = getCurrentSection();
  return (section.posts || []).map((p, i) => ({
    id: p.id,
    name: p.name,
    number: i + 1,
  }));
}

// ==================== ДЕФЕКТЫ ОПЕРАТОРА ====================

function getDefectRow(operatorEntryId, key) {
  const board = getQualityBoard();
  const op = board.operators.find(o => o.id === operatorEntryId);
  if (!op) return [0, 0, 0, 0, 0];
  const arr = op.defects[key];
  if (!Array.isArray(arr)) return [0, 0, 0, 0, 0];
  const out = [];
  for (let i = 0; i < QUALITY_DAY_COLUMNS; i++) {
    out.push(Math.max(0, parseInt(arr[i]) || 0));
  }
  return out;
}

function getDefectCell(operatorEntryId, key, colIdx) {
  const row = getDefectRow(operatorEntryId, key);
  return row[colIdx] || 0;
}

function setDefectCell(operatorEntryId, key, colIdx, value) {
  const board = getQualityBoard();
  const op = board.operators.find(o => o.id === operatorEntryId);
  if (!op) return;

  const row = getDefectRow(operatorEntryId, key);
  row[colIdx] = Math.max(0, parseInt(value) || 0);

  const allZero = row.every(v => v === 0);
  if (allZero) delete op.defects[key];
  else op.defects[key] = row;

  saveQualityBoard();
}

function getOperatorDayTotal(operatorEntryId, key) {
  return getDefectRow(operatorEntryId, key).reduce((s, v) => s + v, 0);
}

function getOperatorRangeTotal(operatorEntryId, keys) {
  return keys.reduce((sum, k) => sum + getOperatorDayTotal(operatorEntryId, k), 0);
}

function getDayTotal(key) {
  const board = getQualityBoard();
  let total = 0;
  board.operators.forEach(op => {
    const arr = op.defects[key];
    if (!Array.isArray(arr)) return;
    arr.forEach(v => { total += (parseInt(v) || 0); });
  });
  return total;
}

function getDayColumnTotal(key, colIdx) {
  const board = getQualityBoard();
  let total = 0;
  board.operators.forEach(op => {
    const arr = op.defects[key];
    if (!Array.isArray(arr)) return;
    total += (parseInt(arr[colIdx]) || 0);
  });
  return total;
}

function getGrandTotal() {
  const board = getQualityBoard();
  let total = 0;
  board.operators.forEach(op => {
    Object.keys(op.defects).forEach(key => {
      const arr = op.defects[key];
      if (!Array.isArray(arr)) return;
      arr.forEach(v => { total += (parseInt(v) || 0); });
    });
  });
  return total;
}

// ==================== ГОД / МЕСЯЦ ====================

function getOperatorYearTotal(operatorEntryId) {
  const board = getQualityBoard();
  const op = board.operators.find(o => o.id === operatorEntryId);
  if (!op) return 0;
  const year = new Date().getFullYear();
  let total = 0;
  Object.keys(op.defects).forEach(key => {
    if (key === PREV_WEEK_KEY) return;
    const d = parseDate(key);
    if (!d || d.getFullYear() !== year) return;
    const arr = op.defects[key];
    if (!Array.isArray(arr)) return;
    arr.forEach(v => { total += (parseInt(v) || 0); });
  });
  return total;
}

function getOperatorMonthTotal(operatorEntryId) {
  const board = getQualityBoard();
  const op = board.operators.find(o => o.id === operatorEntryId);
  if (!op) return 0;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  let total = 0;
  Object.keys(op.defects).forEach(key => {
    if (key === PREV_WEEK_KEY) return;
    const d = parseDate(key);
    if (!d || d.getFullYear() !== year || d.getMonth() !== month) return;
    const arr = op.defects[key];
    if (!Array.isArray(arr)) return;
    arr.forEach(v => { total += (parseInt(v) || 0); });
  });
  return total;
}

function getGrandYearTotal() {
  const board = getQualityBoard();
  let total = 0;
  board.operators.forEach(op => { total += getOperatorYearTotal(op.id); });
  return total;
}

function getGrandMonthTotal() {
  const board = getQualityBoard();
  let total = 0;
  board.operators.forEach(op => { total += getOperatorMonthTotal(op.id); });
  return total;
}

// ==================== ПЛАН ДЕЙСТВИЙ ====================

function getActionPlans() {
  return getQualityBoard().actionPlans || [];
}

function addActionPlan(data) {
  const board = getQualityBoard();
  const plan = {
    id: genId(),
    postName: data.postName || '',
    operatorName: data.operatorName || '',
    defect: data.defect || '',
    action: data.action || '',
    pilot: data.pilot || '',
    deadline: data.deadline || '',
    percent: Math.max(0, Math.min(100, parseInt(data.percent) || 0)),
    priority: data.priority || 'medium',
    status: data.status || 'open',
    createdAt: new Date().toISOString(),
  };
  board.actionPlans.push(plan);
  saveQualityBoard();
  logAudit('add_quality_plan', `${plan.postName} / ${plan.operatorName}`, plan.defect);

  // Дублируем в архив (только для чтения)
  if (typeof qualityArchiveAdd === 'function') {
    qualityArchiveAdd(plan);
  }

  return plan;
}

function updateActionPlan(id, updates) {
  const board = getQualityBoard();
  const plan = board.actionPlans.find(p => p.id === id);
  if (!plan) return;
  Object.assign(plan, updates);
  if (typeof plan.percent !== 'undefined') {
    plan.percent = Math.max(0, Math.min(100, parseInt(plan.percent) || 0));
  }
  saveQualityBoard();

  // Обновляем архивную запись
  if (typeof qualityArchiveUpdate === 'function') {
    qualityArchiveUpdate(id, {
      postName: plan.postName,
      operatorName: plan.operatorName,
      defect: plan.defect,
      action: plan.action,
      pilot: plan.pilot,
      deadline: plan.deadline,
      percent: plan.percent,
      priority: plan.priority,
      status: plan.status,
    });
  }
}

function deleteActionPlan(id) {
  const board = getQualityBoard();
  const plan = board.actionPlans.find(p => p.id === id);
  if (!plan) return;
  board.actionPlans = board.actionPlans.filter(p => p.id !== id);
  saveQualityBoard();
  logAudit('delete_quality_plan', plan.postName, '');

  // Помечаем в архиве, что действие удалено из плана (сама запись остаётся)
  if (typeof qualityArchiveMarkDeleted === 'function') {
    qualityArchiveMarkDeleted(id);
  }
}

// ==================== ИСТОРИЯ ====================

function updateQualityHistory() {
  const board = getQualityBoard();
  const days = getLast4WorkingDays();
  const history = days.map(date => {
    let total = 0;
    board.operators.forEach(op => {
      const arr = op.defects[date];
      if (!Array.isArray(arr)) return;
      arr.forEach(v => { total += (parseInt(v) || 0); });
    });
    return { date, total };
  });
  board.history = history;
  saveQualityBoard();
  return history;
}

// ==================== СТРУКТУРА ====================

function getBoardStructure() {
  const today = new Date();
  const dow = today.getDay();
  const daysToMonday = (dow === 0 ? -6 : 1 - dow);

  const mondayThis = new Date(today);
  mondayThis.setDate(today.getDate() + daysToMonday);

  const weekKeys = [];
  for (let w = 4; w >= 1; w--) {
    const monday = new Date(mondayThis);
    monday.setDate(mondayThis.getDate() - w * 7);
    const dates = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(formatDate(d));
    }
    weekKeys.push({
      label: `Н-${w}`,
      dates,
      mondayDate: formatDate(monday),
      fridayDate: formatDate(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 4)),
    });
  }

  const boardDays = [];
  const mondayPrev = new Date(mondayThis);
  mondayPrev.setDate(mondayThis.getDate() - 7);
  const fridayPrev = new Date(mondayPrev);
  fridayPrev.setDate(mondayPrev.getDate() + 4);

  boardDays.push({
    key: PREV_WEEK_KEY,
    label: 'H-1',
    subLabel: `${formatDate(mondayPrev).slice(0, 5)}–${formatDate(fridayPrev).slice(0, 5)}`,
    isPrev: true,
    isYesterday: true,
  });

  const labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт'];
  for (let i = 0; i < 5; i++) {
    const d = new Date(mondayThis);
    d.setDate(mondayThis.getDate() + i);
    boardDays.push({
      key: formatDate(d),
      label: labels[i],
      subLabel: formatDate(d).slice(0, 5),
      isPrev: false,
      isYesterday: false,
    });
  }

  return { weekKeys, boardDays };
}

function computeTrend(days) {
  if (!days || days.length < 2) return 0;
  const first = getDayTotal(days[0]) || 0;
  const last = getDayTotal(days[days.length - 1]) || 0;
  return last - first;
}

// ==================== ЗАГРУЗКА ДАННЫХ ====================

function getQualityBoardData() {
  syncQualityOperatorsFromShift();
  const board = getQualityBoard();
  const struct = getBoardStructure();

  return {
    operators: board.operators,
    actionPlans: board.actionPlans,
    weekKeys: struct.weekKeys,
    boardDays: struct.boardDays,
    totals: {
      grandYear: getGrandYearTotal(),
      grandMonth: getGrandMonthTotal(),
    }
  };
}

// ==================== UI: РЕНДЕР ====================

function renderQualityBoard() {
  const cont = document.getElementById('qualityBoardRoot');
  if (!cont) return;

  const data = getQualityBoardData();
  const boardDays = data.boardDays;
  const weekKeys = data.weekKeys;
  const N = QUALITY_DAY_COLUMNS;
  const labels = QUALITY_DAY_COLUMNS_LABELS;

  const grandYear = data.totals.grandYear;
  const grandMonth = data.totals.grandMonth;
  const trend = computeTrend(boardDays.map(d => d.key).slice(-4));

  let html = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:16px;">
      <div style="background:#dbeafe;border-radius:10px;padding:12px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:#3b82f6;">${grandYear}</div>
        <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;">Сумма за год</div>
      </div>
      <div style="background:#dcfce7;border-radius:10px;padding:12px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:#16a34a;">${grandMonth}</div>
        <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;">Общая ∑ месяц</div>
      </div>
      <div style="background:#f1f5f9;border-radius:10px;padding:12px;text-align:center;">
        <div style="font-size:24px;font-weight:800;">${trend > 0 ? '▲' : trend < 0 ? '▼' : '—'} ${Math.abs(trend)}</div>
        <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;">Тенденция (4 дня)</div>
      </div>
      <div style="background:#f1f5f9;border-radius:10px;padding:12px;text-align:center;">
        <div style="font-size:24px;font-weight:800;">${data.operators.length}</div>
        <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;">Операторов</div>
      </div>
      <div style="background:#fef3c7;border-radius:10px;padding:12px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:#f59e0b;">${data.actionPlans.filter(p => p.status !== 'closed').length}</div>
        <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;">Открытых действий</div>
      </div>
    </div>
  `;

  // ========== 1. ТАБЛИЦА ==========
  html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;overflow-x:auto;margin-bottom:16px;">';
  html += '<div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:8px;">📋 АНИМАЦИЯ КАЧЕСТВА НА УЧАСТКЕ — ПО ОПЕРАТОРАМ</div>';

  if (data.operators.length === 0) {
    html += '<div style="padding:40px;text-align:center;color:#94a3b8;">Нет операторов в текущей смене.</div>';
  } else {
    const minWidth = 28 + 130 + 130 + 61 + 61 + 4 * 30 + boardDays.length * N * 43 + 106;

    html += `<table class="quality-board-table" style="width:100%;border-collapse:collapse;font-size:11px;min-width:${minWidth}px;">`;
    html += '<thead>';

    html += '<tr style="background:#f1f5f9;">';
    html += '<th rowspan="3" style="padding:6px 5px;border:1px solid #cbd5e1;text-align:center;min-width:28px;">#</th>';
    html += '<th rowspan="3" style="padding:6px 5px;border:1px solid #cbd5e1;text-align:left;min-width:130px;">Оператор</th>';
    html += '<th rowspan="3" style="padding:6px 5px;border:1px solid #cbd5e1;text-align:left;min-width:130px;">Пост</th>';
    html += '<th rowspan="3" style="padding:6px 3px;border:1px solid #cbd5e1;text-align:center;min-width:61px;">Сумма<br><small style="font-weight:400;font-size:8px;color:#64748b;">(год)</small></th>';
    html += '<th rowspan="3" style="padding:6px 3px;border:1px solid #cbd5e1;text-align:center;min-width:61px;">Общая ∑<br><small style="font-weight:400;font-size:8px;color:#64748b;">месяц</small></th>';
    ['Н-4', 'Н-3', 'Н-2', 'Н-1'].forEach(lbl => {
      html += `<th rowspan="3" style="padding:6px 2px;border:1px solid #cbd5e1;font-size:10px;color:#64748b;text-align:center;min-width:30px;">${lbl}</th>`;
    });
    boardDays.forEach(day => {
      const bg = day.isPrev ? '#fef3c7' : '';
      html += `<th colspan="${N}" style="padding:6px 3px;border:1px solid #cbd5e1;font-size:11px;font-weight:700;text-align:center;background:${bg};">${day.label}<br><small style="font-weight:400;font-size:9px;color:#64748b;">${escapeHtml(day.subLabel)}</small></th>`;
    });
    html += '<th rowspan="3" style="padding:6px 6px;border:1px solid #cbd5e1;min-width:106px;text-align:left;">Комментарии</th>';
    html += '</tr>';

    html += '<tr style="background:#f1f5f9;">';
    boardDays.forEach(day => {
      const bg = day.isPrev ? '#fef3c7' : '';
      labels.forEach(lbl => {
        html += `<th style="padding:4px 2px;border:1px solid #cbd5e1;font-size:9px;color:#475569;text-align:center;background:${bg};font-weight:600;min-width:43px;">${escapeHtml(lbl)}</th>`;
      });
    });
    html += '</tr>';

    html += '<tr style="background:#e0e7ff;">';
    boardDays.forEach(day => {
      const isPrev = day.isPrev;
      const bg = isPrev ? '#fde68a' : '#e0e7ff';
      const cars = getCars(day.key);

      html += `<th colspan="${N}" style="padding:3px 4px;border:1px solid #cbd5e1;background:${bg};text-align:center;">
        <div style="display:flex;align-items:center;justify-content:center;gap:4px;">
          <span style="font-size:9px;color:#4338ca;font-weight:700;">Авто:</span>
          ${isPrev
            ? `<span style="min-width:50px;padding:2px 6px;border:1px solid #fbbf24;border-radius:4px;font-size:11px;font-weight:800;text-align:center;background:#fef3c7;color:#92400e;" title="Сумма авто за 5 рабочих дней прошлой недели">${cars || 0}</span>`
            : `<input type="number" min="0" value="${cars || ''}"
                     onchange="qualitySetCars('${escapeAttr(day.key)}', this.value)"
                     style="width:60px;padding:2px 4px;border:1px solid #c7d2fe;border-radius:4px;font-size:11px;font-weight:700;text-align:center;background:#fff;outline:none;"
                     placeholder="0">`
          }
        </div>
      </th>`;
    });
    html += '</tr>';
    html += '</thead><tbody>';

    const posts = getQualityAvailablePosts();

    data.operators.forEach((opEntry, idx) => {
      html += '<tr>';
      html += `<td style="padding:5px 5px;border:1px solid #cbd5e1;font-weight:600;text-align:center;">${idx + 1}</td>`;
      html += `<td style="padding:5px 5px;border:1px solid #cbd5e1;font-weight:600;">${escapeHtml(opEntry.name)}</td>`;

      html += '<td style="padding:3px 3px;border:1px solid #cbd5e1;">';
      html += `<select onchange="qualitySetOperatorPost('${escapeAttr(opEntry.id)}', this.value)" style="width:100%;padding:2px 3px;border:1px solid #e2e8f0;border-radius:4px;font-size:10px;background:#fff;">`;
      html += '<option value="">—</option>';
      posts.forEach(p => {
        html += `<option value="${escapeAttr(p.id)}" ${p.id === opEntry.postId ? 'selected' : ''}>${p.number}. ${escapeHtml(p.name)}</option>`;
      });
      html += '</select>';
      html += '</td>';

      const yearTotal = getOperatorYearTotal(opEntry.id);
      html += `<td style="padding:5px 3px;border:1px solid #cbd5e1;text-align:center;font-weight:800;background:${yearTotal > 0 ? '#dbeafe' : ''};">${yearTotal || ''}</td>`;

      const monthTotal = getOperatorMonthTotal(opEntry.id);
      html += `<td style="padding:5px 3px;border:1px solid #cbd5e1;text-align:center;font-weight:800;background:${monthTotal > 0 ? '#dcfce7' : ''};">${monthTotal || ''}</td>`;

      weekKeys.forEach(wk => {
        const wTotal = getOperatorRangeTotal(opEntry.id, wk.dates);
        html += `<td style="padding:4px 2px;border:1px solid #cbd5e1;text-align:center;font-size:10px;">${wTotal || ''}</td>`;
      });

      boardDays.forEach(day => {
        const bg = day.isPrev ? '#fef9c3' : '';
        for (let i = 0; i < N; i++) {
          const val = getDefectCell(opEntry.id, day.key, i);
          const bg2 = val > 0 ? '#3b82f622' : bg;
          const textColor = val > 0 ? '#3b82f6' : '#cbd5e1';
          html += `<td style="padding:3px 1px;border:1px solid #cbd5e1;text-align:center;background:${bg2};">
            <input type="number" min="0" value="${val || ''}"
                   onchange="qualitySetDefectCell('${escapeAttr(opEntry.id)}', '${escapeAttr(day.key)}', ${i}, this.value)"
                   style="width:100%;max-width:34px;padding:3px 1px;border:1px solid transparent;border-radius:4px;text-align:center;font-size:11px;font-weight:700;color:${textColor};background:transparent;outline:none;"
                   placeholder="0">
          </td>`;
        }
      });

      html += `<td style="padding:3px 3px;border:1px solid #cbd5e1;">
        <input type="text" value="${escapeAttr(opEntry.comment || '')}"
               onchange="qualitySetComment('${escapeAttr(opEntry.id)}', this.value)"
               style="width:100%;padding:3px 3px;border:1px solid transparent;border-radius:4px;font-size:10px;background:transparent;outline:none;"
               placeholder="—">
      </td>`;

      html += '</tr>';
    });

    // ИТОГО
    html += '<tr style="background:#f1f5f9;font-weight:800;">';
    html += `<td colspan="3" style="padding:6px 6px;border:1px solid #cbd5e1;text-align:right;">ИТОГО:</td>`;
    html += `<td style="padding:5px 3px;border:1px solid #cbd5e1;text-align:center;">${grandYear || ''}</td>`;
    html += `<td style="padding:5px 3px;border:1px solid #cbd5e1;text-align:center;">${grandMonth || ''}</td>`;
    weekKeys.forEach(wk => {
      let wTotal = 0;
      wk.dates.forEach(date => { wTotal += getDayTotal(date); });
      html += `<td style="padding:4px 2px;border:1px solid #cbd5e1;text-align:center;">${wTotal || ''}</td>`;
    });
    boardDays.forEach(day => {
      const bg = day.isPrev ? '#fef9c3' : '';
      for (let i = 0; i < N; i++) {
        const total = getDayColumnTotal(day.key, i);
        html += `<td style="padding:4px 2px;border:1px solid #cbd5e1;text-align:center;background:${bg};">${total || ''}</td>`;
      }
    });
    html += '<td style="border:1px solid #cbd5e1;"></td></tr>';

    html += '<tr style="background:#e2e8f0;font-weight:800;">';
    html += `<td colspan="3" style="padding:6px 6px;border:1px solid #cbd5e1;text-align:right;">ВСЕГО:</td>`;
    html += `<td colspan="6" style="padding:5px 3px;border:1px solid #cbd5e1;"></td>`;
    boardDays.forEach(day => {
      for (let i = 0; i < N; i++) {
        const total = getDayColumnTotal(day.key, i);
        html += `<td style="padding:4px 2px;border:1px solid #cbd5e1;text-align:center;">${total || ''}</td>`;
      }
    });
    html += '<td style="border:1px solid #cbd5e1;"></td></tr>';

    html += '</tbody></table>';
  }
  html += '</div>';

  // ========== 2. ПЛАН ДЕЙСТВИЙ ==========
  html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:16px;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
  html += '<div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#64748b;">📝 ПЛАН ДЕЙСТВИЙ</div>';
  html += '<button class="btn-small" style="background:#3b82f6;color:#fff;border-color:#3b82f6;font-size:11px;" onclick="qualityAddAction()">➕ Добавить</button>';
  html += '</div>';

  if (data.actionPlans.length === 0) {
    html += '<div style="padding:30px;text-align:center;color:#94a3b8;font-size:12px;">Нет записей. Нажмите «➕ Добавить».</div>';
  } else {
    html += `<table class="quality-board-table" style="width:100%;border-collapse:collapse;font-size:12px;min-width:720px;">`;
    html += '<thead>';
    html += '<tr style="background:#f1f5f9;">';
    html += '<th style="padding:6px 6px;border:1px solid #cbd5e1;text-align:center;width:30px;">№</th>';
    html += '<th style="padding:6px 6px;border:1px solid #cbd5e1;text-align:left;min-width:100px;">Пост</th>';
    html += '<th style="padding:6px 6px;border:1px solid #cbd5e1;text-align:left;min-width:130px;">Оператор</th>';
    html += '<th style="padding:6px 6px;border:1px solid #cbd5e1;text-align:left;min-width:100px;">Дефект</th>';
    html += '<th style="padding:6px 6px;border:1px solid #cbd5e1;text-align:left;min-width:152px;">Защита клиента / Действие</th>';
    html += '<th style="padding:6px 6px;border:1px solid #cbd5e1;text-align:left;min-width:84px;">Пилот</th>';
    html += '<th style="padding:6px 6px;border:1px solid #cbd5e1;text-align:center;width:76px;">Срок</th>';
    html += '<th style="padding:6px 6px;border:1px solid #cbd5e1;text-align:center;width:46px;">%</th>';
    html += '<th style="padding:6px 6px;border:1px solid #cbd5e1;text-align:center;width:84px;">Статус</th>';
    html += '<th style="padding:6px 6px;border:1px solid #cbd5e1;text-align:center;width:68px;">Действия</th>';
    html += '</tr>';
    html += '</thead><tbody>';

    data.actionPlans.forEach((plan, idx) => {
      const priorityColors = { high: '#ef4444', medium: '#f59e0b', low: '#64748b' };
      const statusColors = { open: '#3b82f6', in_progress: '#f59e0b', closed: '#16a34a' };
      const statusLabels = { open: 'Открыт', in_progress: 'В работе', closed: 'Закрыт' };
      const pColor = priorityColors[plan.priority] || '#64748b';
      const sColor = statusColors[plan.status] || '#64748b';
      const sLabel = statusLabels[plan.status] || plan.status;

      html += '<tr>';
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:center;font-weight:700;border-left:4px solid ${pColor};">${idx + 1}</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;font-weight:600;">${escapeHtml(plan.postName || '—')}</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;">${escapeHtml(plan.operatorName || '—')}</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;color:#64748b;">${escapeHtml(plan.defect || '')}</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;">${escapeHtml(plan.action || '')}</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;">${escapeHtml(plan.pilot || '—')}</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:center;">${escapeHtml(plan.deadline || '—')}</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:center;font-weight:700;">${plan.percent || 0}%</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:center;">
        <span style="font-size:10px;font-weight:700;color:${sColor};text-transform:uppercase;">${escapeHtml(sLabel)}</span>
      </td>`;
      html += `<td style="padding:3px 4px;border:1px solid #cbd5e1;text-align:center;white-space:nowrap;">
        <button class="btn-small" style="font-size:10px;padding:2px 6px;" onclick="qualityEditAction('${escapeAttr(plan.id)}')">✏️</button>
        <button class="btn-small danger" style="font-size:10px;padding:2px 6px;" onclick="qualityDeleteAction('${escapeAttr(plan.id)}')">🗑</button>
      </td>`;
      html += '</tr>';
    });

    html += '</tbody></table>';
  }
  html += '</div>';

  // ========== 3. ГРАФИКИ ==========
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">';
  html += renderDnaInChart(data);
  html += renderDnaOffChart(data);
  html += '</div>';

  cont.innerHTML = html;
}

// ==================== ГРАФИК ====================

function buildBarChartSvg(title, xLabels, series) {
  const W = 700, H = 340;
  const PAD_L = 55, PAD_R = 10, PAD_T = 30, PAD_B = 60;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  let maxVal = 0.001;
  series.forEach(s => {
    s.values.forEach(v => { if (v > maxVal) maxVal = v; });
  });
  maxVal = maxVal * 1.15;

  const nDays = xLabels.length;
  const nSeries = series.length;

  const groupWidth = innerW / nDays;
  const barGap = 2;
  const groupPad = Math.max(6, groupWidth * 0.15);
  const barWidth = Math.max(6, (groupWidth - groupPad * 2 - barGap * (nSeries - 1)) / nSeries);

  let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;max-height:360px;display:block;">`;

  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const val = (maxVal / steps) * i;
    const y = PAD_T + innerH - (val / maxVal) * innerH;
    svg += `<line x1="${PAD_L}" y1="${y}" x2="${PAD_L + innerW}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>`;
    svg += `<text x="${PAD_L - 6}" y="${y + 3}" text-anchor="end" font-size="9" fill="#94a3b8">${val.toFixed(2)}</text>`;
  }

  xLabels.forEach((xl, dayIdx) => {
    const groupX = PAD_L + dayIdx * groupWidth;
    const groupCenter = groupX + groupWidth / 2;
    const barsTotalW = barWidth * nSeries + barGap * (nSeries - 1);
    const startX = groupCenter - barsTotalW / 2;

    series.forEach((s, sIdx) => {
      const v = s.values[dayIdx] || 0;
      const barH = (v / maxVal) * innerH;
      const barX = startX + sIdx * (barWidth + barGap);
      const barY = PAD_T + innerH - barH;

      svg += `<rect x="${barX}" y="${barY}" width="${barWidth}" height="${barH}" fill="${s.color}" rx="1"/>`;

      if (v > 0) {
        const txtColor = (s.color === '#000000') ? '#334155' : s.color;
        svg += `<text x="${barX + barWidth/2}" y="${barY - 3}" text-anchor="middle" font-size="8" font-weight="700" fill="${txtColor}">${v.toFixed(2)}</text>`;
      }
    });

    svg += `<text x="${groupCenter}" y="${H - 30}" text-anchor="middle" font-size="10" font-weight="700" fill="#334155">${escapeHtml(xl.label)}</text>`;
    if (xl.sub) {
      svg += `<text x="${groupCenter}" y="${H - 16}" text-anchor="middle" font-size="8" fill="#94a3b8">${escapeHtml(xl.sub)}</text>`;
    }
  });

  svg += `<text x="${W/2}" y="18" text-anchor="middle" font-size="12" font-weight="700" fill="#334155">${escapeHtml(title)}</text>`;
  svg += '</svg>';

  const legend = series.map(s =>
    `<span style="display:inline-flex;align-items:center;gap:4px;margin:0 8px;font-size:11px;color:#475569;">
      <span style="display:inline-block;width:12px;height:12px;background:${s.color};border-radius:2px;border:1px solid #cbd5e1;"></span>
      ${escapeHtml(s.name)}
    </span>`
  ).join('');

  return `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;">
      ${svg}
      <div style="display:flex;justify-content:center;margin-top:6px;flex-wrap:wrap;">${legend}</div>
    </div>
  `;
}

function renderDnaInChart(data) {
  const boardDays = data.boardDays;
  const xLabels = boardDays.map(d => ({ label: d.label, sub: d.subLabel }));

  const series = [
    { name: 'Вызов пост', color: QUALITY_COLORS['Вызов пост'], values: boardDays.map(d => {
      const cars = getCars(d.key);
      const def = getDayColumnTotal(d.key, 0);
      return cars > 0 ? def / cars : 0;
    })},
    { name: 'Чек', color: QUALITY_COLORS['Чек'], values: boardDays.map(d => {
      const cars = getCars(d.key);
      const def = getDayColumnTotal(d.key, 1);
      return cars > 0 ? def / cars : 0;
    })},
    { name: 'САО', color: QUALITY_COLORS['САО'], values: boardDays.map(d => {
      const cars = getCars(d.key);
      const def = getDayColumnTotal(d.key, 2);
      return cars > 0 ? def / cars : 0;
    })},
  ];

  return buildBarChartSvg('ДНА ИН', xLabels, series);
}

function renderDnaOffChart(data) {
  const boardDays = data.boardDays;
  const xLabels = boardDays.map(d => ({ label: d.label, sub: d.subLabel }));

  const series = [
    { name: 'П1П', color: QUALITY_COLORS['П1П'], values: boardDays.map(d => {
      const cars = getCars(d.key);
      const def = getDayColumnTotal(d.key, 3);
      return cars > 0 ? def / cars : 0;
    })},
    { name: 'ИКС', color: QUALITY_COLORS['ИКС'], values: boardDays.map(d => {
      const cars = getCars(d.key);
      const def = getDayColumnTotal(d.key, 4);
      return cars > 0 ? def / cars : 0;
    })},
  ];

  return buildBarChartSvg('ДНА ОФФ', xLabels, series);
}

// ==================== ОБРАБОТЧИКИ ====================

function qualitySetDefectCell(operatorEntryId, key, colIdx, value) {
  setDefectCell(operatorEntryId, key, colIdx, value);
  renderQualityBoard();
}

function qualitySetCars(key, value) {
  setCars(key, value);
  renderQualityBoard();
}

function qualitySetOperatorPost(operatorEntryId, postId) {
  const board = getQualityBoard();
  const op = board.operators.find(o => o.id === operatorEntryId);
  if (!op) return;
  op.postId = postId || '';
  saveQualityBoard();
}

function qualitySetComment(operatorEntryId, value) {
  const board = getQualityBoard();
  const op = board.operators.find(o => o.id === operatorEntryId);
  if (!op) return;
  op.comment = value || '';
  saveQualityBoard();
}

// ==================== ПЛАН ДЕЙСТВИЙ UI ====================

function qualityAddAction() {
  const data = getQualityBoardData();
  const opOptions = data.operators.map(o => ({ value: o.name, label: o.name }));
  if (opOptions.length === 0) opOptions.push({ value: '', label: '— нет операторов —' });

  const postOptions = getQualityAvailablePosts().map(p => ({ value: p.name, label: `${p.number}. ${p.name}` }));
  if (postOptions.length === 0) postOptions.push({ value: '', label: '— нет постов —' });

  showModal('Новое действие', [
    { name: 'postName',     label: 'Пост',                       type: 'select', value: postOptions[0].value, options: postOptions },
    { name: 'operatorName', label: 'Оператор',                   type: 'select', value: opOptions[0].value,   options: opOptions },
    { name: 'defect',       label: 'Дефект',                     value: '' },
    { name: 'action',       label: 'Действие / защита клиента',  value: '' },
    { name: 'pilot',        label: 'Пилот',                      value: '' },
    { name: 'deadline',     label: 'Срок (ДД.ММ.ГГГГ)',          value: '' },
    { name: 'percent',      label: '% выполнения',               type: 'number', value: '0' },
    { name: 'priority',     label: 'Приоритет',                  type: 'select', value: 'medium', options: [
      { value: 'low',    label: 'Низкий' },
      { value: 'medium', label: 'Средний' },
      { value: 'high',   label: 'Высокий' }
    ]},
    { name: 'status',       label: 'Статус',                     type: 'select', value: 'open', options: [
      { value: 'open',        label: 'Открыт' },
      { value: 'in_progress', label: 'В работе' },
      { value: 'closed',      label: 'Закрыт' }
    ]}
  ], (v, overlay) => {
    addActionPlan(v);
    overlay.remove();
    renderQualityBoard();
  });
}

function qualityEditAction(id) {
  const board = getQualityBoard();
  const plan = board.actionPlans.find(p => p.id === id);
  if (!plan) return;

  const opOptions = getQualityAvailableOperators().map(o => ({ value: o.name, label: o.name }));
  if (opOptions.length === 0) opOptions.push({ value: '', label: '— нет операторов —' });

  showModal('Редактировать действие', [
    { name: 'postName',     label: 'Пост',                       value: plan.postName },
    { name: 'operatorName', label: 'Оператор',                   type: 'select', value: plan.operatorName || '', options: opOptions },
    { name: 'defect',       label: 'Дефект',                     value: plan.defect },
    { name: 'action',       label: 'Действие / защита клиента',  value: plan.action },
    { name: 'pilot',        label: 'Пилот',                      value: plan.pilot },
    { name: 'deadline',     label: 'Срок',                       value: plan.deadline },
    { name: 'percent',      label: '% выполнения',               type: 'number', value: String(plan.percent || 0) },
    { name: 'priority',     label: 'Приоритет',                  type: 'select', value: plan.priority, options: [
      { value: 'low',    label: 'Низкий' },
      { value: 'medium', label: 'Средний' },
      { value: 'high',   label: 'Высокий' }
    ]},
    { name: 'status',       label: 'Статус',                     type: 'select', value: plan.status, options: [
      { value: 'open',        label: 'Открыт' },
      { value: 'in_progress', label: 'В работе' },
      { value: 'closed',      label: 'Закрыт' }
    ]}
  ], (v, overlay) => {
    updateActionPlan(id, v);
    overlay.remove();
    renderQualityBoard();
  });
}

function qualityDeleteAction(id) {
  if (!confirm('Удалить действие?')) return;
  deleteActionPlan(id);
  renderQualityBoard();
}

// ==================== ЭКСПОРТ ====================

function qualityExportExcel() {
  if (typeof XLSX === 'undefined') { alert('Библиотека XLSX не загружена'); return; }

  const data = getQualityBoardData();
  const wb = XLSX.utils.book_new();
  const N = QUALITY_DAY_COLUMNS;
  const labels = QUALITY_DAY_COLUMNS_LABELS;

  const rows = [];

  const header = ['#', 'Оператор', 'Пост', 'Сумма (год)', 'Общая ∑ месяц', 'Н-4', 'Н-3', 'Н-2', 'Н-1'];
  data.boardDays.forEach(day => {
    labels.forEach(lbl => {
      header.push(`${day.label} (${day.subLabel}) ${lbl}`);
    });
  });
  header.push('Комментарии');
  rows.push(header);

  data.operators.forEach((op, i) => {
    const postName = op.postId
      ? (getQualityAvailablePosts().find(p => p.id === op.postId)?.name || '')
      : '';
    const row = [
      i + 1,
      op.name,
      postName,
      getOperatorYearTotal(op.id),
      getOperatorMonthTotal(op.id),
    ];
    data.weekKeys.forEach(wk => {
      row.push(getOperatorRangeTotal(op.id, wk.dates) || '');
    });
    data.boardDays.forEach(day => {
      for (let k = 0; k < N; k++) {
        const v = getDefectCell(op.id, day.key, k);
        row.push(v || '');
      }
    });
    row.push(op.comment || '');
    rows.push(row);
  });

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Доска дефектов');

  const carsRows = [['Блок', 'Авто']];
  data.boardDays.forEach(day => {
    carsRows.push([`${day.label} (${day.subLabel})`, getCars(day.key)]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(carsRows), 'Авто');

  const planRows = [['№', 'Пост', 'Оператор', 'Дефект', 'Защита клиента / Действие', 'Пилот', 'Срок', '%', 'Приоритет', 'Статус']];
  data.actionPlans.forEach((p, i) => {
    planRows.push([
      i + 1, p.postName, p.operatorName || '', p.defect, p.action, p.pilot, p.deadline,
      p.percent, p.priority, p.status
    ]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(planRows), 'План действий');

  XLSX.writeFile(wb, `Доска_качества_${getCurrentSection().name}_${formatDate().replace(/\./g, '-')}.xlsx`);
  logAudit('export_excel', 'Доска качества', getCurrentSection().name);
}

function qualityExportJSON() {
  const data = getQualityBoardData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Доска_качества_${formatDate().replace(/\./g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function qualityPrint() {
  document.body.classList.add('print-matrix');
  window.print();
  setTimeout(() => document.body.classList.remove('print-matrix'), 500);
}

// ==================== ЭКСПОРТ В WINDOW ====================

window.qualityBoard = {
  get: getQualityBoard,
  save: saveQualityBoard,
  syncOperators: syncQualityOperatorsFromShift,
  getData: getQualityBoardData,
  getAvailableOperators: getQualityAvailableOperators,
  getAvailablePosts: getQualityAvailablePosts,
  getOperatorName: getQualityOperatorName,
  getDefectRow,
  getDefectCell,
  setDefectCell,
  getOperatorDayTotal,
  getOperatorRangeTotal,
  getDayTotal,
  getDayColumnTotal,
  getGrandTotal,
  getOperatorYearTotal,
  getOperatorMonthTotal,
  getGrandYearTotal,
  getGrandMonthTotal,
  getCars,
  setCars,
  getActionPlans,
  addActionPlan,
  updateActionPlan,
  deleteActionPlan,
  updateQualityHistory,
  getBoardStructure,
  render: renderQualityBoard,
  setComment: qualitySetComment,
  setOperatorPost: qualitySetOperatorPost,
  COLUMNS: QUALITY_DAY_COLUMNS_LABELS,
  COLORS: QUALITY_COLORS,
  PREV_WEEK_KEY,
};