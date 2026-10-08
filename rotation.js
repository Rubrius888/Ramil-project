// ======================== ПЛАНИРОВАНИЕ РОТАЦИИ v2 ========================
// Два режима:
//   • simple — быстрая ротация (как раньше)
//   • full   — полная ротация всех операторов по всем постам с учётом явки
//
// Структура плана (обратно совместимая):
//   { __meta: {...}, 0: {postIdx: opName}, 1: {...} }

console.log('[rotation.js] Загружен (v2)');

let rotationPlan = {};
let rotationPlanKey = '';

// ======================== ВРЕМЕННАЯ ПОДМЕНА ПЛАНА ========================
window.setTemporaryRotationPlan = function(newPlan) {
  const saved = rotationPlan;
  rotationPlan = newPlan || {};
  return function restore() {
    rotationPlan = saved || {};
  };
};

function getRotationPlanKey() {
  const section = getCurrentSection();
  const now = new Date();
  return `${section.id}_${now.getFullYear()}_${now.getMonth()}`;
}

// ======================== НАСТРОЙКИ UI ========================

function getRotationOptions() {
  return {
    mode: document.getElementById('rotMode')?.value || 'simple',
    rotationsPerDay: Math.max(1, Math.min(5, parseInt(document.getElementById('rotationsPerDay')?.value) || 1)),
    useErgo: document.getElementById('rotUseErgo')?.checked ?? true,
    useDiff: document.getElementById('rotUseDifficulty')?.checked ?? true,
    useAttendance: document.getElementById('rotUseAttendance')?.checked ?? true,
    useCycle: document.getElementById('rotUseCycle')?.checked ?? true,
    useFairness: document.getElementById('rotUseFairness')?.checked ?? true,
  };
}

// ======================== ВЕС ПОСТА ========================
function getPostWeight(post) {
  let ergoScore = 0;
  if (post.ergonomics === 'red') ergoScore = 3;
  else if (post.ergonomics === 'yellow') ergoScore = 2;
  else ergoScore = 1;

  let diffScore = 0;
  if (post.difficulty === 'A') diffScore = 3;
  else if (post.difficulty === 'B') diffScore = 2;
  else diffScore = 1;

  return ergoScore * 10 + diffScore;
}

// ======================== СОВМЕСТИМОСТЬ ========================
function canOperateOnPost(operator, opIdx, post, postIdx, levels, opts) {
  if (!operator) return false;
  if (operator.role === 'НУ' || operator.role === 'СО') return false;
  if (operator.role === 'ДС') return false;

  const lvl = levels[postIdx]?.[opIdx];
  if (!lvl) return false;

  if (opts.useErgo && post.ergonomics === 'red') {
    return lvl === 'L' || lvl === 'Lкр' || lvl === 'U';
  }
  if (opts.useDiff && post.difficulty === 'A') {
    return lvl === 'L' || lvl === 'Lкр' || lvl === 'U';
  }
  return true;
}

function getLevelRank(lvl) {
  const order = { 'U': 5, 'Lкр': 4, 'L': 4, 'I': 2, 'Iкр': 1, '': 0 };
  return order[lvl] || 0;
}

// ======================== КАРТА ПОСЛЕДНИХ НАЗНАЧЕНИЙ ========================
function buildLastPlacementMapForRotation() {
  const map = new Map();
  const log = getSystem().placementLog || [];
  for (const e of log) {
    if (!e.opName || !e.postName || !e.date) continue;
    const p = e.date.split('.');
    if (p.length !== 3) continue;
    const d = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
    if (isNaN(d.getTime())) continue;
    const key = `${e.opName}|${e.postName}`;
    const cur = map.get(key);
    if (!cur || d > cur) map.set(key, d);
  }
  return map;
}

// ======================== ГЕНЕРАЦИЯ ========================

function generateRotationPlan() {
  const thead = document.querySelector('#rotCalendarTable thead');
  const tbody = document.querySelector('#rotCalendarTable tbody');
  if (!thead || !tbody) return;

  rotationPlanKey = getRotationPlanKey();
  const opts = getRotationOptions();

  if (opts.mode === 'full') {
    generateFullRotationPlan(opts);
  } else {
    generateSimpleRotationPlan(opts);
  }
}

// ======================== ПРОСТОЙ РЕЖИМ ========================

function generateSimpleRotationPlan(opts) {
  const section = getCurrentSection();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rpd = opts.rotationsPerDay;

  const psts = section.posts.map(p => p.name);
  const opList = getCurrentOperators();
  const ops = opList.map(o => o.name);
  const roles = opList.map(o => o.role);
  const levels = data;
  const diffArr = section.posts.map(p => p.difficulty);
  const ergoArr = section.posts.map(p => p.ergonomics);

  const availableOps = [];
  for (let c = 0; c < opList.length; c++) {
    if (roles[c] === 'НУ' || roles[c] === 'СО' || roles[c] === 'ДС') continue;
    availableOps.push(c);
  }

  const postPriority = [];
  for (let r = 0; r < section.posts.length; r++) {
    const score = getPostWeight(section.posts[r]);
    postPriority.push({ r, score });
  }
  postPriority.sort((a, b) => b.score - a.score);

  const schedule = {};
  const lastDay = {};
  availableOps.forEach(op => { lastDay[op] = -1; });

  for (let d = 0; d < daysInMonth; d++) {
    const dow = new Date(year, month, d + 1).getDay();
    if (dow === 0 || dow === 6) continue;

    const used = new Set();
    let placed = 0;

    for (const pp of postPriority) {
      if (placed >= rpd) break;
      const r = pp.r;

      let candidates = availableOps.filter(op => {
        if (used.has(op)) return false;
        if (!canOperateOnPost(opList[op], op, section.posts[r], r, levels, opts)) return false;
        // ← НОВОЕ: проверка обучения
        if (window.sync && typeof window.sync.isOpTrainingDayIdx === 'function') {
          if (window.sync.isOpTrainingDayIdx(opList[op].name, d, year, month)) return false;
        }
        return true;
      });
      if (candidates.length === 0) continue;

      candidates.sort((a, b) => {
        const ageA = d - (lastDay[a] || -1);
        const ageB = d - (lastDay[b] || -1);
        if (ageA !== ageB) return ageB - ageA;
        const lvlA = levels[r][a] || '';
        const lvlB = levels[r][b] || '';
        return getLevelRank(lvlB) - getLevelRank(lvlA);
      });

      const chosen = candidates[0];
      if (!schedule[d]) schedule[d] = {};
      schedule[d][r] = ops[chosen];
      used.add(chosen);
      lastDay[chosen] = d;
      placed++;
    }
  }

  schedule.__meta = {
    mode: 'simple',
    rotationsPerDay: rpd,
    useErgonomics: opts.useErgo,
    useDifficulty: opts.useDiff,
    useAttendance: false,
    useCycle: false,
    createdAt: new Date().toISOString(),
  };

  rotationPlan = schedule;
  renderRotationTable(schedule, year, month, daysInMonth);
  logAudit('generate_rotation', 'План ротации', `Режим: простой · дней: ${Object.keys(schedule).length - 1}`);
  if (typeof showToast === 'function') showToast('🎲 Простой план сгенерирован');
}

// ======================== ПОЛНЫЙ РЕЖИМ ========================

function generateFullRotationPlan(opts) {
  const section = getCurrentSection();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const shift = getCurrentShift();
  const shiftData = section.shifts?.[shift];
  if (!shiftData) {
    alert('Нет данных смены');
    return;
  }

  const opList = shiftData.operators || [];
  const levels = data;
  const posts = section.posts || [];

  if (posts.length === 0) {
    alert('Нет постов');
    return;
  }

  const workingOps = [];
  const excludedOps = [];

  opList.forEach((op, idx) => {
    if (op.role === 'НУ' || op.role === 'СО') return;
    if (op.role === 'ДС') { excludedOps.push({ op, idx, reason: 'ДС' }); return; }
    workingOps.push({ op, idx });
  });

  if (workingOps.length === 0) {
    alert('Нет доступных операторов');
    return;
  }

  const lastPlacementMap = buildLastPlacementMapForRotation();
  const todayMs = Date.now();

  const monthlyLoad = {};
  workingOps.forEach(({ op }) => { monthlyLoad[op.name] = 0; });

  const schedule = {};

  const workingDays = [];
  for (let d = 0; d < daysInMonth; d++) {
    const dow = new Date(year, month, d + 1).getDay();
    if (dow === 0 || dow === 6) continue;
    workingDays.push(d);
  }

  workingDays.forEach((dayIdx, dayOrder) => {
    const dateObj = new Date(year, month, dayIdx + 1);
    const dateStr = formatDate(dateObj);

    const dayData = shiftData.days?.[dateStr] || {};
    const attendance = dayData.attendance || {};

    const availableOps = [];
    workingOps.forEach(({ op, idx }) => {
      const att = attendance[op.id] || 'Я';
      if (opts.useAttendance) {
        if (att !== 'Я' && op.role !== 'ИС') return;
      }
      // ← НОВОЕ: проверка обучения
      if (window.sync && typeof window.sync.isOpTrainingDayIdx === 'function') {
        if (window.sync.isOpTrainingDayIdx(op.name, dayIdx, year, month)) return;
      }
      availableOps.push({ op, idx });
    });

    if (availableOps.length === 0) return;

    const postOrder = posts
      .map((p, r) => ({ post: p, r, weight: getPostWeight(p) }))
      .sort((a, b) => b.weight - a.weight);

    const dayPlan = {};
    const assigned = new Set();
    const cycleShift = opts.useCycle ? (dayOrder % Math.max(posts.length, 1)) : 0;

    postOrder.forEach(({ post, r }) => {
      const candidates = availableOps.filter(({ op, idx }) => {
        if (assigned.has(op.name)) return false;
        return canOperateOnPost(op, idx, post, r, levels, opts);
      });

      if (candidates.length === 0) return;

      candidates.sort((a, b) => {
        const keyA = `${a.op.name}|${post.name}`;
        const keyB = `${b.op.name}|${post.name}`;
        const lastA = lastPlacementMap.get(keyA);
        const lastB = lastPlacementMap.get(keyB);
        const ageA = lastA ? (todayMs - lastA.getTime()) / 86400000 : 9999;
        const ageB = lastB ? (todayMs - lastB.getTime()) / 86400000 : 9999;
        if (Math.abs(ageA - ageB) > 1) return ageB - ageA;

        if (opts.useFairness) {
          const loadA = monthlyLoad[a.op.name] || 0;
          const loadB = monthlyLoad[b.op.name] || 0;
          if (loadA !== loadB) return loadA - loadB;
        }

        const lvlA = levels[r]?.[a.idx] || '';
        const lvlB = levels[r]?.[b.idx] || '';
        const rankA = getLevelRank(lvlA);
        const rankB = getLevelRank(lvlB);
        if (rankA !== rankB) return rankB - rankA;

        if (opts.useCycle) {
          const aDist = Math.abs((a.idx - r + posts.length) % posts.length - cycleShift);
          const bDist = Math.abs((b.idx - r + posts.length) % posts.length - cycleShift);
          if (aDist !== bDist) return aDist - bDist;
        }

        return 0;
      });

      const chosen = candidates[0];
      dayPlan[r] = chosen.op.name;
      assigned.add(chosen.op.name);
      monthlyLoad[chosen.op.name] = (monthlyLoad[chosen.op.name] || 0) + getPostWeight(post);
    });

    if (Object.keys(dayPlan).length > 0) {
      schedule[dayIdx] = dayPlan;
    }
  });

  schedule.__meta = {
    mode: 'full',
    rotationsPerDay: 1,
    useErgonomics: opts.useErgo,
    useDifficulty: opts.useDiff,
    useAttendance: opts.useAttendance,
    useCycle: opts.useCycle,
    useFairness: opts.useFairness,
    createdAt: new Date().toISOString(),
    excludedCount: excludedOps.length,
  };

  rotationPlan = schedule;
  renderRotationTable(schedule, year, month, daysInMonth);
  logAudit('generate_rotation', 'План ротации', `Режим: полный · дней: ${Object.keys(schedule).length - 1}`);
  if (typeof showToast === 'function') {
    showToast(`🎲 Полный план: ${Object.keys(schedule).length - 1} дней`);
  }
}

// ======================== РЕНДЕР ========================

function renderRotationTable(schedule, year, month, daysInMonth) {
  const thead = document.querySelector('#rotCalendarTable thead');
  const tbody = document.querySelector('#rotCalendarTable tbody');
  if (!thead || !tbody) return;

  const psts = getCurrentSection().posts.map(p => p.name);

  let header = '<tr><th>Пост</th>';
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dn = date.toLocaleString('ru-RU', { weekday: 'short' });
    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 6;
    header += `<th style="${isWeekend ? 'background:#cbd5e1;color:#475569;' : ''}">${d}<br>${dn}</th>`;
  }
  header += '</tr>';
  thead.innerHTML = header;

  let body = '';
  for (let r = 0; r < psts.length; r++) {
    body += `<tr><td style="text-align:left;font-weight:500;">${escapeHtml(psts[r])}</td>`;
    for (let d = 0; d < daysInMonth; d++) {
      const dow = new Date(year, month, d + 1).getDay();
      const isWeekend = dow === 0 || dow === 6;
      const val = (schedule[d] && schedule[d][r]) || '';
      body += `<td class="rot-cell" style="font-size:11px;${isWeekend ? 'background:#cbd5e1;color:#475569;' : ''}"
        onclick="editRotationCell(${d}, ${r})"
        title="Клик — изменить">${escapeHtml(val)}</td>`;
    }
    body += '</tr>';
  }
  tbody.innerHTML = body;
}

function editRotationCell(dayIdx, postIdx) {
  const opList = getCurrentOperators();
  const ops = opList.map(o => o.name);
  const roles = opList.map(o => o.role);
  const options = [{ value: '', label: '— пусто —' }];
  for (let c = 0; c < ops.length; c++) {
    if (roles[c] === 'НУ' || roles[c] === 'СО') continue;
    const lvl = data[postIdx][c];
    options.push({ value: ops[c], label: `${ops[c]} (${lvl || '—'})` });
  }
  const psts = getCurrentSection().posts.map(p => p.name);
  const current = (rotationPlan[dayIdx] && rotationPlan[dayIdx][postIdx]) || '';
  showCenteredSelect(`Ротация: ${psts[postIdx]}`, current, options, (v) => {
    if (!rotationPlan[dayIdx]) rotationPlan[dayIdx] = {};
    if (v) rotationPlan[dayIdx][postIdx] = v;
    else delete rotationPlan[dayIdx][postIdx];
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    renderRotationTable(rotationPlan, now.getFullYear(), now.getMonth(), daysInMonth);
  });
}

// ======================== СОХРАНЕНИЕ / ОЧИСТКА ========================

function saveRotationPlan() {
  const realKeys = Object.keys(rotationPlan).filter(k => k !== '__meta');
  if (realKeys.length === 0) {
    alert('Сначала сгенерируйте план');
    return;
  }
  const sys = getSystem();
  if (!sys.rotationPlans) sys.rotationPlans = {};
  sys.rotationPlans[rotationPlanKey] = JSON.parse(JSON.stringify(rotationPlan));
  saveSystem();
  logAudit('save_rotation', 'План ротации', `Сохранено дней: ${realKeys.length}`);
  if (typeof showToast === 'function') showToast('💾 План ротации сохранён');
}

function clearRotationPlan() {
  if (!confirm('Очистить сгенерированный план ротации?')) return;
  rotationPlan = {};
  const sys = getSystem();
  if (sys.rotationPlans && sys.rotationPlans[rotationPlanKey]) {
    delete sys.rotationPlans[rotationPlanKey];
  }
  saveSystem();
  logAudit('clear_rotation', 'План ротации', '');
  const thead = document.querySelector('#rotCalendarTable thead');
  const tbody = document.querySelector('#rotCalendarTable tbody');
  if (thead) thead.innerHTML = '';
  if (tbody) tbody.innerHTML = '<tr><td style="text-align:center;color:#94a3b8;padding:40px;">Нажмите «Сгенерировать»</td></tr>';
}

function restoreRotationPlan() {
  const sys = getSystem();
  rotationPlanKey = getRotationPlanKey();
  if (sys.rotationPlans && sys.rotationPlans[rotationPlanKey]) {
    rotationPlan = JSON.parse(JSON.stringify(sys.rotationPlans[rotationPlanKey]));
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    renderRotationTable(rotationPlan, now.getFullYear(), now.getMonth(), daysInMonth);
    return true;
  }
  return false;
}

// ======================== ПЕРЕСЧЁТ ПРИ ИЗМЕНЕНИИ ЯВКИ ========================

function onAttendanceChanged(opId) {
  const sys = getSystem();
  const key = getRotationPlanKey();
  const plan = sys.rotationPlans?.[key];
  if (!plan) return;
  if (plan.__meta?.mode !== 'full') return;
  if (!plan.__meta?.useAttendance) return;

  const section = getCurrentSection();
  const shift = getCurrentShift();
  const shiftData = section.shifts?.[shift];
  if (!shiftData) return;

  const op = shiftData.operators.find(o => o.id === opId);
  if (!op) return;

  const todayStr = getCurrentDate();
  const todayDate = parseDate(todayStr);
  if (!todayDate) return;
  const dayIdx = todayDate.getDate() - 1;

  const dayData = shiftData.days?.[todayStr] || {};
  const att = dayData.attendance?.[opId] || 'Я';

  if (att !== 'Я' && op.role !== 'ИС') {
    if (plan[dayIdx]) {
      Object.keys(plan[dayIdx]).forEach(postIdx => {
        if (plan[dayIdx][postIdx] === op.name) {
          delete plan[dayIdx][postIdx];
        }
      });
      saveSystem();
      if (typeof showToast === 'function') {
        showToast(`⚠️ ${op.name} исключён из плана на ${todayStr}`);
      }
    }
  }
}

window.onRotationAttendanceChanged = onAttendanceChanged;

// ======================== ПРИМЕНЕНИЕ ПЛАНА ========================

function applyRotationToDay(dayIdx, shift, mode) {
  mode = mode || 'fill_empty';
  const section = getCurrentSection();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const dateObj = new Date(year, month, dayIdx + 1);
  const dateStr = formatDate(dateObj);

  const dayPlan = rotationPlan[dayIdx];
  // ← ПРАВКА (задача №12): защита от массива/строки/повреждённых данных
  if (!dayPlan || typeof dayPlan !== 'object' || Array.isArray(dayPlan)) {
    return { applied: 0, skipped: 0 };
  }

  if (!section.shifts[shift]) section.shifts[shift] = { sectionChief: '', operators: [], days: {} };
  if (!section.shifts[shift].days) section.shifts[shift].days = {};
  if (!section.shifts[shift].days[dateStr]) {
    const postIds = section.posts.map(p => p.id);
    const operatorIds = section.shifts[shift].operators.map(o => o.id);
    section.shifts[shift].days[dateStr] = createEmptyDay(postIds, operatorIds);
  }
  const day = section.shifts[shift].days[dateStr];
  const opList = section.shifts[shift].operators || [];

  if (mode === 'replace_all') {
    section.posts.forEach(p => { day.assignments[p.id] = null; });
  }

  let applied = 0;
  let skipped = 0;

  section.posts.forEach((post, postIdx) => {
    const opName = dayPlan[postIdx];
    if (!opName) return;

    const op = opList.find(o => o.name === opName);
    if (!op) { skipped++; return; }

    const att = day.attendance[op.id] || 'Я';
    if (att !== 'Я' && op.role !== 'ИС') { skipped++; return; }

    const curList = normalizeAssignment(day.assignments[post.id]);

    if (mode === 'fill_empty' && curList.length > 0) { skipped++; return; }
    if (mode === 'merge' && curList.includes(op.id)) { skipped++; return; }

    section.posts.forEach(p => {
      if (p.id === post.id) return;
      const list = normalizeAssignment(day.assignments[p.id]);
      if (list.includes(op.id)) {
        setAssignmentList(day.assignments, p.id, list.filter(x => x !== op.id));
        logPlacement(opName, p.name, 'unassign');
      }
    });

    if (!curList.includes(op.id)) curList.push(op.id);
    setAssignmentList(day.assignments, post.id, curList);
    logPlacement(opName, post.name, 'assign');
    applied++;
  });

  saveSystem();
  return { applied, skipped };
}

// ======================== ДИАЛОГИ ========================

function openApplyRotationDialog() {
  const realKeys = Object.keys(rotationPlan).filter(k => k !== '__meta');
  if (realKeys.length === 0) {
    alert('Сначала сгенерируйте план ротации');
    return;
  }

  const now = new Date();
  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const dayOptions = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(now.getFullYear(), now.getMonth(), d).getDay();
    if (dow === 0 || dow === 6) continue;
    const dateStr = formatDate(new Date(now.getFullYear(), now.getMonth(), d));
    dayOptions.push({ value: String(d - 1), label: `${d} (${dateStr})` });
  }

  showModal('🎯 Применить план ротации', [
    { name: 'month', label: 'Месяц', value: months[now.getMonth()] + ' ' + now.getFullYear(), type: 'text' },
    { name: 'day', label: 'День', type: 'select', value: dayOptions[0]?.value || '0', options: dayOptions },
    { name: 'shift', label: 'Смена', type: 'select', value: getCurrentShift(), options: [
      { value: 'A', label: 'Смена A' },
      { value: 'B', label: 'Смена B' },
      { value: 'C', label: 'Смена C' }
    ]},
    { name: 'mode', label: 'Режим', type: 'select', value: 'fill_empty', options: [
      { value: 'fill_empty', label: 'Заполнить только пустые' },
      { value: 'replace_all', label: 'Заменить всех' },
      { value: 'merge', label: 'Добавить к существующим' }
    ]}
  ], (v, overlay) => {
    const dayIdx = parseInt(v.day);
    const shift = v.shift;
    const mode = v.mode;

    if (!rotationPlan[dayIdx]) {
      alert('На этот день в плане нет данных');
      return;
    }

    const result = applyRotationToDay(dayIdx, shift, mode);
    overlay.remove();

    if (result.applied > 0) {
      logAudit('apply_rotation', `Смена ${shift}`, `Применено: ${result.applied}, пропущено: ${result.skipped}`);
      if (typeof showToast === 'function') showToast(`✅ Применено: ${result.applied} · Пропущено: ${result.skipped}`);
      if (typeof renderMatrix === 'function') renderMatrix();
      if (typeof renderSE8Blank === 'function') renderSE8Blank();
    } else {
      if (typeof showToast === 'function') showToast('⚠️ Нечего применять');
    }
  });
}

function openApplyRotationRange() {
  const realKeys = Object.keys(rotationPlan).filter(k => k !== '__meta');
  if (realKeys.length === 0) {
    alert('Сначала сгенерируйте план ротации');
    return;
  }

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOptions = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(now.getFullYear(), now.getMonth(), d).getDay();
    if (dow === 0 || dow === 6) continue;
    const dateStr = formatDate(new Date(now.getFullYear(), now.getMonth(), d));
    dayOptions.push({ value: String(d - 1), label: `${d} (${dateStr})` });
  }

  showModal('🎯 Применить план на диапазон', [
    { name: 'from', label: 'С дня', type: 'select', value: dayOptions[0]?.value || '0', options: dayOptions },
    { name: 'to', label: 'По день', type: 'select', value: dayOptions[dayOptions.length - 1]?.value || '0', options: dayOptions },
    { name: 'shift', label: 'Смена', type: 'select', value: getCurrentShift(), options: [
      { value: 'A', label: 'Смена A' },
      { value: 'B', label: 'Смена B' },
      { value: 'C', label: 'Смена C' }
    ]},
    { name: 'mode', label: 'Режим', type: 'select', value: 'fill_empty', options: [
      { value: 'fill_empty', label: 'Заполнить только пустые' },
      { value: 'replace_all', label: 'Заменить всё' },
      { value: 'merge', label: 'Добавить к существующим' }
    ]}
  ], (v, overlay) => {
    const fromIdx = parseInt(v.from);
    const toIdx = parseInt(v.to);
    const shift = v.shift;
    const mode = v.mode;

    if (fromIdx > toIdx) { alert('Начало диапазона больше конца'); return; }

    let totalApplied = 0, totalSkipped = 0, daysProcessed = 0;
    for (let d = fromIdx; d <= toIdx; d++) {
      if (!rotationPlan[d]) continue;
      const res = applyRotationToDay(d, shift, mode);
      totalApplied += res.applied;
      totalSkipped += res.skipped;
      daysProcessed++;
    }

    overlay.remove();
    logAudit('apply_rotation', `Смена ${shift}`, `Дней: ${daysProcessed}, применено: ${totalApplied}`);
    if (typeof showToast === 'function') showToast(`✅ Дней: ${daysProcessed} · Применено: ${totalApplied} · Пропущено: ${totalSkipped}`);

    if (typeof renderMatrix === 'function') renderMatrix();
    if (typeof renderSE8Blank === 'function') renderSE8Blank();
  });
}

// ======================== АВТО-РАССТАНОВКА ========================

function autoFillDay() {
  const section = getCurrentSection();
  const shift = getCurrentShift();
  const day = getCurrentDay();
  const opList = getCurrentOperators();

  const realOps = opList.filter(o => o.role !== 'НУ' && o.role !== 'СО' && o.role !== 'ДС');
  if (realOps.length === 0) { alert('Нет операторов в смене'); return; }
  const psts = section.posts;
  if (psts.length === 0) { alert('Нет постов на участке'); return; }

  if (!confirm(`Авто-расстановка на ${getCurrentDate()} (смена ${shift})?\n\nБудут заполнены только пустые посты.`)) return;

  const available = realOps.filter(op => {
    const att = day.attendance[op.id] || 'Я';
    return att === 'Я' || op.role === 'ИС';
  });
  const busyOpIds = new Set();
  psts.forEach(p => {
    normalizeAssignment(day.assignments[p.id]).forEach(oid => busyOpIds.add(oid));
  });
  const freeOps = available.filter(op => !busyOpIds.has(op.id));

  const postPriority = psts.map((p, idx) => ({
    idx,
    score: getPostWeight(p)
  })).sort((a, b) => b.score - a.score);

  let applied = 0;
  let skipped = 0;

  postPriority.forEach(({ idx }) => {
    const post = psts[idx];
    const curList = normalizeAssignment(day.assignments[post.id]);
    if (curList.length > 0) { skipped++; return; }

    const candidates = freeOps.filter(op => {
      const lvl = day.levels[post.id]?.[op.id];
      if (!lvl) return false;
      if (post.ergonomics === 'red' || post.difficulty === 'A') {
        return lvl === 'L' || lvl === 'U' || lvl === 'Lкр';
      }
      return true;
    });
    if (candidates.length === 0) { skipped++; return; }

    candidates.sort((a, b) => {
      const lvlA = day.levels[post.id]?.[a.id] || '';
      const lvlB = day.levels[post.id]?.[b.id] || '';
      return getLevelRank(lvlB) - getLevelRank(lvlA);
    });

    const chosen = candidates[0];
    setAssignmentList(day.assignments, post.id, [chosen.id]);
    logPlacement(chosen.name, post.name, 'assign');
    freeOps.splice(freeOps.indexOf(chosen), 1);
    applied++;
  });

  saveSystem();
  logAudit('auto_fill', `Смена ${shift}`, `Применено: ${applied}, пропущено: ${skipped}`);
  if (typeof showToast === 'function') showToast(`✅ Авто-расстановка: ${applied} назначено`);

  if (typeof renderMatrix === 'function') renderMatrix();
  if (typeof renderSE8Blank === 'function') renderSE8Blank();
}

function autoFillMonth() {
  const section = getCurrentSection();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  if (!confirm('Авто-расстановка на ВЕСЬ месяц?\n\nБудут заполнены все пустые посты во всех сменах (A/B/C).')) return;

  let totalApplied = 0;
  const shifts = ['A', 'B', 'C'];

  for (let d = 0; d < daysInMonth; d++) {
    const dow = new Date(year, month, d + 1).getDay();
    if (dow === 0 || dow === 6) continue;
    const dateStr = formatDate(new Date(year, month, d + 1));

    shifts.forEach(shift => {
      const shiftData = section.shifts[shift];
      if (!shiftData) return;
      const opList = shiftData.operators || [];
      const realOps = opList.filter(o => o.role !== 'НУ' && o.role !== 'СО' && o.role !== 'ДС');

      if (!shiftData.days) shiftData.days = {};
      if (!shiftData.days[dateStr]) {
        const postIds = section.posts.map(p => p.id);
        const operatorIds = opList.map(o => o.id);
        shiftData.days[dateStr] = createEmptyDay(postIds, operatorIds);
      }
      const day = shiftData.days[dateStr];

      const busy = new Set();
      section.posts.forEach(p => {
        normalizeAssignment(day.assignments[p.id]).forEach(oid => busy.add(oid));
      });
      const available = realOps.filter(op => {
        const att = day.attendance[op.id] || 'Я';
        return (att === 'Я' || op.role === 'ИС') && !busy.has(op.id);
      });

      section.posts.forEach(p => {
        const cur = normalizeAssignment(day.assignments[p.id]);
        if (cur.length > 0) return;

        const candidates = available.filter(op => {
          const lvl = day.levels?.[p.id]?.[op.id];
          if (!lvl) return false;
          if (p.ergonomics === 'red' || p.difficulty === 'A') {
            return lvl === 'L' || lvl === 'U' || lvl === 'Lкр';
          }
          return true;
        });
        if (candidates.length === 0) return;

        candidates.sort((a, b) => {
          const lvlA = day.levels[p.id]?.[a.id] || '';
          const lvlB = day.levels[p.id]?.[b.id] || '';
          return getLevelRank(lvlB) - getLevelRank(lvlA);
        });
        const chosen = candidates[0];
        setAssignmentList(day.assignments, p.id, [chosen.id]);
        available.splice(available.indexOf(chosen), 1);
        totalApplied++;
      });
    });
  }

  saveSystem();
  logAudit('auto_fill', 'Весь месяц', `Назначений: ${totalApplied}`);
  if (typeof showToast === 'function') showToast(`✅ Авто-расстановка на месяц: ${totalApplied} назначено`);

  if (typeof renderMatrix === 'function') renderMatrix();
  if (typeof renderSE8Blank === 'function') renderSE8Blank();
}