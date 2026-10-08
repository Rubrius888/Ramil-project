// ======================== ПЛАНИРОВАНИЕ РАЗВИТИЯ v2 ========================
// Логика:
//   1. Настройки хранятся в system.developmentSettings:
//        targetLPerPost      — сколько L/U должно быть на посте (по умолчанию 3)
//        targetLPerOperator  — сколько L/U должно быть у оператора (по умолчанию 3)
//        maxPerDay           — максимум обучений в день (по умолчанию 2)
//        maxPerOpPerMonth    — максимум обучений в месяц на оператора (по умолчанию 3)
//        useAttendance       — учитывать явку (исключать отпуск/больничный)
//        useExisting         — учитывать trainingRecords (не дублировать)
//   2. Идём по постам по приоритету:
//        • 0 покрытия L/U → высокий приоритет
//        • 1 → средний
//        • 2 → низкий
//        • ≥ targetLPerPost → пропускаем
//      Внутри — по эргономике (красный → жёлтый → зелёный),
//      потом по сложности (A → B → C).
//   3. Для каждого поста ищем кандидатов:
//        • роль: О, Ф, ИС (не НУ/СО/ДС)
//        • явка: Я (если useAttendance)
//        • уровень: Iкр / I / null (в порядке приоритета)
//        • у оператора L/U < targetLPerOperator
//        • не пересекается с уже запланированными обучениями
//   4. Распределяем обучение по дням месяца:
//        • trainingDays рабочих дней
//        • если не влезает в месяц — с перерывами (5 → перерыв → 5)
//        • maxPerDay обучений в день
//        • maxPerOpPerMonth обучений на оператора в месяц

console.log('[development.js] Загружен (v2)');

let developmentPlan = {};          // { postIdx: { dayIdx: opName } }
let developmentPlanKey = '';
let developmentFormaters = {};     // { postIdx: formatorName }
let draggedDevOp = null;

// ==================== НАСТРОЙКИ РАЗВИТИЯ ====================

const DEVELOPMENT_DEFAULTS = {
  targetLPerPost: 3,
  targetLPerOperator: 3,
  maxPerDay: 2,
  maxPerOpPerMonth: 3,
  useAttendance: true,
  useExisting: true,
  usePriority0: true,     // приоритет постам с 0 покрытия
  usePriority1: true,     // приоритет постам с 1
  useErgonomics: true,    // учитывать эргономику
  useDifficulty: true,    // учитывать сложность
};

function getDevelopmentSettings() {
  const sys = getSystem();
  if (!sys.developmentSettings) {
    sys.developmentSettings = { ...DEVELOPMENT_DEFAULTS };
  }
  // заполняем отсутствующие ключи
  Object.keys(DEVELOPMENT_DEFAULTS).forEach(k => {
    if (typeof sys.developmentSettings[k] === 'undefined') {
      sys.developmentSettings[k] = DEVELOPMENT_DEFAULTS[k];
    }
  });
  return sys.developmentSettings;
}

function saveDevelopmentSettings(updates) {
  const sys = getSystem();
  const s = getDevelopmentSettings();
  Object.assign(s, updates);
  sys.developmentSettings = s;
  saveSystem();
}

// ==================== КЛЮЧ ПЛАНА ====================

function getDevelopmentPlanKey() {
  const section = getCurrentSection();
  const now = new Date();
  return `${section.id}_${now.getFullYear()}_${now.getMonth()}`;
}

// ==================== СОХРАНЕНИЕ / ОЧИСТКА / ВОССТАНОВЛЕНИЕ ====================

function saveDevelopmentPlan() {
  const hasAny = Object.keys(developmentPlan).some(k =>
    developmentPlan[k] && Object.keys(developmentPlan[k]).length > 0
  );
  if (!hasAny) {
    alert('Сначала сгенерируйте план');
    return;
  }
  const sys = getSystem();
  if (!sys.developmentPlans) sys.developmentPlans = {};
  sys.developmentPlans[developmentPlanKey] = {
    schedule: JSON.parse(JSON.stringify(developmentPlan)),
    formaters: JSON.parse(JSON.stringify(developmentFormaters))
  };
  saveSystem();
  logAudit('save_development', 'План развития', `Постов в плане: ${Object.keys(developmentPlan).length}`);
  if (typeof showToast === 'function') showToast('💾 План развития сохранён');
}

function clearDevelopmentPlan() {
  if (!confirm('Очистить сгенерированный план развития?')) return;
  developmentPlan = {};
  developmentFormaters = {};
  const sys = getSystem();
  if (sys.developmentPlans && sys.developmentPlans[developmentPlanKey]) {
    delete sys.developmentPlans[developmentPlanKey];
  }
  saveSystem();
  logAudit('clear_development', 'План развития', '');
  const thead = document.querySelector('#devCalendarTable thead');
  const tbody = document.querySelector('#devCalendarTable tbody');
  if (thead) thead.innerHTML = '';
  if (tbody) tbody.innerHTML = '<tr><td style="text-align:center;color:#94a3b8;padding:40px;">Нажмите «Сгенерировать»</td></tr>';
  renderDevOperatorList();
}

function restoreDevelopmentPlan() {
  const sys = getSystem();
  developmentPlanKey = getDevelopmentPlanKey();
  if (sys.developmentPlans && sys.developmentPlans[developmentPlanKey]) {
    const saved = sys.developmentPlans[developmentPlanKey];
    developmentPlan = JSON.parse(JSON.stringify(saved.schedule || {}));
    developmentFormaters = JSON.parse(JSON.stringify(saved.formaters || {}));
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    renderDevelopmentTable(developmentPlan, developmentFormaters, now.getFullYear(), now.getMonth(), daysInMonth);
    renderDevOperatorList();
    return true;
  }
  renderDevOperatorList();
  return false;
}

// ==================== ФОРМАТОР ====================

function getDevFormatorForPost(postIdx, excludeOpName) {
  const opList = getCurrentOperators();
  // 1) НУ
  const nu = opList.find(o => o.role === 'НУ' && o.name !== excludeOpName);
  if (nu) return nu.name;
  // 2) СО
  const so = opList.find(o => o.role === 'СО' && o.name !== excludeOpName);
  if (so) return so.name;
  // 3) Ф
  const f = opList.find(o => o.role === 'Ф' && o.name !== excludeOpName);
  if (f) return f.name;
  // 4) любой с уровнем U на этом посте
  const section = getCurrentSection();
  const day = getCurrentDay();
  const post = section.posts[postIdx];
  if (!post) return '—';
  for (let i = 0; i < opList.length; i++) {
    const op = opList[i];
    if (op.name === excludeOpName) continue;
    if (op.role === 'НУ' || op.role === 'СО' || op.role === 'ДС') continue;
    const lvl = day.levels?.[post.id]?.[op.id];
    if (lvl === 'U') return op.name;
  }
  return '—';
}

// ==================== ПОЛИВАЛЕНТНОСТЬ ОПЕРАТОРА ====================

function countOperatorL(opIdx) {
  const section = getCurrentSection();
  const day = getCurrentDay();
  const op = getCurrentOperators()[opIdx];
  if (!op) return 0;
  let cnt = 0;
  section.posts.forEach(p => {
    const lvl = day.levels?.[p.id]?.[op.id];
    if (lvl === 'L' || lvl === 'Lкр' || lvl === 'U') cnt++;
  });
  return cnt;
}

function countPostL(postIdx) {
  const section = getCurrentSection();
  const day = getCurrentDay();
  const post = section.posts[postIdx];
  if (!post) return 0;
  const ops = getCurrentOperators();
  let cnt = 0;
  ops.forEach(op => {
    if (op.role === 'НУ' || op.role === 'СО' || op.role === 'ДС') return;
    const lvl = day.levels?.[post.id]?.[op.id];
    if (lvl === 'L' || lvl === 'Lкр' || lvl === 'U') cnt++;
  });
  return cnt;
}

// ==================== ПРИОРИТЕТ ПОСТА ====================

function getPostDevelopmentPriority(postIdx, settings) {
  const post = getCurrentSection().posts[postIdx];
  if (!post) return -1;

  const cntL = countPostL(postIdx);
  let priority = 0;

  // Приоритет по покрытию
  if (settings.usePriority0 && cntL === 0) priority += 100;
  else if (settings.usePriority1 && cntL === 1) priority += 50;
  else if (cntL === 2) priority += 20;

  // Приоритет по эргономике
  if (settings.useErgonomics) {
    if (post.ergonomics === 'red') priority += 30;
    else if (post.ergonomics === 'yellow') priority += 15;
  }

  // Приоритет по сложности
  if (settings.useDifficulty) {
    if (post.difficulty === 'A') priority += 25;
    else if (post.difficulty === 'B') priority += 10;
  }

  return priority;
}

// ==================== ПРОВЕРКА СУЩЕСТВУЮЩИХ ОБУЧЕНИЙ ====================

function hasActiveTraining(opName, postName) {
  const records = getSystem().trainingRecords || [];
  return records.some(r =>
    r.op === opName &&
    r.post === postName &&
    (r.status === 'План' || r.status === 'В процессе')
  );
}

// ==================== ГЕНЕРАЦИЯ ====================

function generateDevelopmentPlan() {
  const thead = document.querySelector('#devCalendarTable thead');
  const tbody = document.querySelector('#devCalendarTable tbody');
  if (!thead || !tbody) return;

  developmentPlanKey = getDevelopmentPlanKey();
  const settings = getDevelopmentSettings();

  const section = getCurrentSection();
  const opList = getCurrentOperators();
  const levels = data;
  const day = getCurrentDay();

  const postCount = section.posts.length;
  if (postCount === 0) {
    tbody.innerHTML = '<tr><td style="text-align:center;color:#94a3b8;padding:40px;">Нет постов</td></tr>';
    return;
  }

  // ---- Сортируем посты по приоритету ----
  const postsWithPriority = [];
  for (let r = 0; r < postCount; r++) {
    const cnt = countPostL(r);
    const pr = getPostDevelopmentPriority(r, settings);
    postsWithPriority.push({ r, cnt, pr });
  }
  postsWithPriority.sort((a, b) => b.pr - a.pr);

  // ---- Календарь ----
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // ---- Рабочие дни месяца ----
  const workingDays = [];
  for (let d = 0; d < daysInMonth; d++) {
    const dow = new Date(year, month, d + 1).getDay();
    if (dow === 0 || dow === 6) continue;
    workingDays.push(d);
  }

  // ---- Состояние планирования ----
  const schedule = {};       // { postIdx: { dayIdx: opName } }
  const formators = {};      // { postIdx: formatorName }
  const dailyCount = {};     // { dayIdx: N } — сколько обучений в день
  const opMonthCount = {};   // { opName: N } — обучений в месяц на оператора
  const opBusyDays = {};     // { opName: Set<dayIdx> } — занятые дни оператора
  // Виртуальное покрытие постов (L/U) — обновляется в процессе
  const virtualPostL = postsWithPriority.map(p => p.cnt);

  // Помечаем заранее известные L
  const virtualOpL = {};
  opList.forEach((op, i) => { virtualOpL[op.name] = countOperatorL(i); });

  // ---- Явка (исключение отпускников) ----
  function isOpAvailableOnDay(opId, dayIdx) {
    if (!settings.useAttendance) return true;
    const dateObj = new Date(year, month, dayIdx + 1);
    const dateStr = formatDate(dateObj);
    const shiftData = getCurrentShiftData();
    const d = shiftData.days?.[dateStr];
    if (!d) return true;
    const att = d.attendance?.[opId] || 'Я';
    return att === 'Я';
  }

  // ---- Строим план ----
  postsWithPriority.forEach(({ r, cnt }) => {
    const post = section.posts[r];
    if (!post) return;

    // Если покрытие уже ≥ целевого — пропускаем
    if (virtualPostL[r] >= settings.targetLPerPost) return;

    // Сколько нужно ещё
    let needMore = settings.targetLPerPost - virtualPostL[r];
    if (needMore <= 0) return;

    // Ищем кандидатов
    const candidates = [];
    for (let i = 0; i < opList.length; i++) {
      const op = opList[i];
      if (op.role === 'НУ' || op.role === 'СО' || op.role === 'ДС') continue;

      // Уровень на посте
      const lvl = levels[r][i];

      // Приоритет: Iкр > I > null
      let levelRank = 0;
      if (lvl === 'Iкр') levelRank = 3;
      else if (lvl === 'I') levelRank = 2;
      else if (lvl === null || lvl === '' || lvl === undefined) levelRank = 1;
      else continue; // L/U/Lкр — уже обучен, не нужен

      // Уже учится на этом посте — пропускаем
      if (settings.useExisting && hasActiveTraining(op.name, post.name)) continue;

      // Уровень оператора — не перегружен?
      const opLcnt = virtualOpL[op.name] || 0;
      if (opLcnt >= settings.targetLPerOperator) continue;

      // Месячная загрузка оператора
      const monthCnt = opMonthCount[op.name] || 0;
      if (monthCnt >= settings.maxPerOpPerMonth) continue;

      // Не сам форматор
      const formatorName = getDevFormatorForPost(r, op.name);
      if (formatorName === op.name) continue;

      candidates.push({ op, i, levelRank, opLcnt });
    }

    // Сортируем кандидатов: Iкр > I > null; при равенстве — ниже L-нагрузка
    candidates.sort((a, b) => {
      if (b.levelRank !== a.levelRank) return b.levelRank - a.levelRank;
      return a.opLcnt - b.opLcnt;
    });

    // Планируем обучение для нужного числа кандидатов
    let placedCount = 0;
    for (const cand of candidates) {
      if (placedCount >= needMore) break;

      // Нужно trainingDays рабочих дней
      const trainingDays = post.trainingDays || 5;

      // Ищем окно в календаре
      const slots = findTrainingSlots(
        cand.op,
        workingDays,
        trainingDays,
        settings,
        dailyCount,
        opBusyDays,
        year, month,
        isOpAvailableOnDay
      );

      if (slots.length === 0) continue;

      // Записываем в план
      if (!schedule[r]) schedule[r] = {};
      slots.forEach(dIdx => {
        schedule[r][dIdx] = cand.op.name;

        // Учёт занятости
        dailyCount[dIdx] = (dailyCount[dIdx] || 0) + 1;
        if (!opBusyDays[cand.op.name]) opBusyDays[cand.op.name] = new Set();
        opBusyDays[cand.op.name].add(dIdx);
      });

      opMonthCount[cand.op.name] = (opMonthCount[cand.op.name] || 0) + 1;
      virtualPostL[r]++;
      virtualOpL[cand.op.name] = (virtualOpL[cand.op.name] || 0) + 1;
      placedCount++;

      // Форматор для поста
      if (!formators[r]) {
        formators[r] = getDevFormatorForPost(r, cand.op.name);
      }
    }
  });

  // Если ничего не спланировано
  if (Object.keys(schedule).length === 0) {
    tbody.innerHTML = '<tr><td style="text-align:center;color:#16a34a;padding:40px;">✅ Участок укомплектован — обучение не требуется</td></tr>';
    thead.innerHTML = '';
    developmentPlan = {};
    developmentFormaters = {};
    renderDevOperatorList();
    if (typeof showToast === 'function') showToast('✅ Участок укомплектован');
    return;
  }

  developmentPlan = schedule;
  developmentFormaters = formators;

  renderDevelopmentTable(schedule, formators, year, month, daysInMonth);
  renderDevOperatorList();
  logAudit('generate_development', 'План развития', `Постов в плане: ${Object.keys(schedule).length}`);
  if (typeof showToast === 'function') {
    showToast(`📈 План: ${Object.keys(schedule).length} постов`);
  }
}

/**
 * Ищет слоты для обучения (trainingDays рабочих дней).
 * Если не влезает в месяц — с перерывами: 5 → пропуск 5 → 5.
 */
function findTrainingSlots(op, workingDays, trainingDays, settings, dailyCount, opBusyDays, year, month, isOpAvailableOnDay) {
  const slots = [];
  let placed = 0;
  let blockSize = 5; // максимум подряд
  let gapSize = 5;    // перерыв

  for (let bi = 0; bi < workingDays.length && placed < trainingDays; bi++) {
    const dIdx = workingDays[bi];

    // День уже занят этим оператором?
    if (opBusyDays[op.name]?.has(dIdx)) continue;

    // Лимит обучений в день
    if ((dailyCount[dIdx] || 0) >= settings.maxPerDay) continue;

    // Явка
    if (!isOpAvailableOnDay(op.id, dIdx)) continue;

    slots.push(dIdx);
    placed++;

    // Если набрали блок — делаем перерыв
    if (slots.length % blockSize === 0 && placed < trainingDays) {
      // пропускаем gapSize рабочих дней
      bi += gapSize;
    }
  }

  if (placed < trainingDays) return []; // не влезло — пропускаем кандидата
  return slots;
}

// ==================== РЕНДЕР ТАБЛИЦЫ ====================

function renderDevelopmentTable(schedule, formators, year, month, daysInMonth) {
  const thead = document.querySelector('#devCalendarTable thead');
  const tbody = document.querySelector('#devCalendarTable tbody');
  if (!thead || !tbody) return;

  const psts = getCurrentSection().posts;

  let header = '<tr><th>Пост</th><th>Форматор</th>';
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dn = date.toLocaleString('ru-RU', { weekday: 'short' });
    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 6;
    header += `<th style="${isWeekend ? 'background:#cbd5e1;color:#475569;' : ''}">${d}<br>${dn}</th>`;
  }
  header += '<th>Срок</th></tr>';
  thead.innerHTML = header;

  let body = '';
  for (let r = 0; r < psts.length; r++) {
    const post = psts[r];
    const postName = post.name;
    const cntL = countPostL(r);
    const settings = getDevelopmentSettings();

    const isFull = cntL >= settings.targetLPerPost;
    const bg = isFull ? 'background:#dcfce7;' : '';

    body += `<tr style="${bg}">`;
    body += `<td style="text-align:left;font-weight:500;">${escapeHtml(postName)}</td>`;
    body += `<td style="font-size:11px;color:#64748b;">${escapeHtml(formators[r] || '—')}</td>`;

    for (let d = 0; d < daysInMonth; d++) {
      const dow = new Date(year, month, d + 1).getDay();
      const isWeekend = dow === 0 || dow === 6;
      const val = (schedule[r] && schedule[r][d]) || '';
      body += `<td class="dev-cell" style="font-size:11px;${isWeekend ? 'background:#cbd5e1;color:#475569;' : ''}"
        ondragover="onDevDragOver(event)"
        ondragleave="onDevDragLeave(event)"
        ondrop="onDevDrop(event, ${r}, ${d})"
        onclick="editDevCell(${r}, ${d})"
        title="${val ? escapeHtml(val) : 'Клик — назначить'}">${escapeHtml(val)}</td>`;
    }

    let postDays = '';
    if (schedule[r]) postDays = Object.keys(schedule[r]).length || '';
    body += `<td style="font-weight:600;">${postDays}</td></tr>`;
  }
  tbody.innerHTML = body;
}

// ==================== СПИСОК ОПЕРАТОРОВ (сайдбар) ====================

function renderDevOperatorList() {
  const cont = document.getElementById('devOperatorList');
  if (!cont) return;
  const opList = getCurrentOperators();
  const settings = getDevelopmentSettings();

  const list = opList.filter(o =>
    o.role !== 'НУ' && o.role !== 'СО' && o.role !== 'ДС'
  );

  if (list.length === 0) {
    cont.innerHTML = '<div style="color:#94a3b8;font-size:12px;">Нет операторов</div>';
    return;
  }

  cont.innerHTML = list.map(o => {
    const idx = opList.indexOf(o);
    const l = countOperatorL(idx);
    const isFull = l >= settings.targetLPerOperator;
    const bg = isFull ? 'background:#dcfce7;' : '';
    return `<div class="dev-operator-item" draggable="true" style="${bg}"
      ondragstart="onDevOpDragStart(event, '${escapeAttr(o.name)}')"
      ondragend="onDevOpDragEnd(event)"
      title="${escapeHtml(o.name)} · L/U: ${l} / ${settings.targetLPerOperator}">
      ${escapeHtml(o.name)} <span style="color:#64748b;">(${l}/${settings.targetLPerOperator})</span>
    </div>`;
  }).join('');
}

// ==================== DRAG-N-DROP ====================

function onDevOpDragStart(e, opName) {
  draggedDevOp = opName;
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('text/plain', opName);
  e.target.classList.add('dragging');
}
function onDevOpDragEnd(e) {
  e.target.classList.remove('dragging');
  document.querySelectorAll('td.drop-target').forEach(td => td.classList.remove('drop-target'));
}
function onDevDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  e.currentTarget.classList.add('drop-target');
}
function onDevDragLeave(e) {
  e.currentTarget.classList.remove('drop-target');
}
function onDevDrop(e, postIdx, dayIdx) {
  e.preventDefault();
  e.currentTarget.classList.remove('drop-target');
  if (!draggedDevOp) return;
  if (!developmentPlan[postIdx]) developmentPlan[postIdx] = {};
  developmentPlan[postIdx][dayIdx] = draggedDevOp;
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  renderDevelopmentTable(developmentPlan, developmentFormaters, now.getFullYear(), now.getMonth(), daysInMonth);
  draggedDevOp = null;
}
function editDevCell(postIdx, dayIdx) {
  const opList = getCurrentOperators();
  const ops = opList.map(o => o.name);
  const roles = opList.map(o => o.role);
  const levels = data;
  const options = [{ value: '', label: '— пусто —' }];
  for (let c = 0; c < ops.length; c++) {
    if (roles[c] === 'НУ' || roles[c] === 'СО' || roles[c] === 'ДС') continue;
    const lvl = levels[postIdx][c];
    options.push({ value: ops[c], label: `${ops[c]} (${lvl || '—'})` });
  }
  const psts = getCurrentSection().posts.map(p => p.name);
  const current = (developmentPlan[postIdx] && developmentPlan[postIdx][dayIdx]) || '';
  showCenteredSelect(`Развитие: ${psts[postIdx]}`, current, options, (v) => {
    if (!developmentPlan[postIdx]) developmentPlan[postIdx] = {};
    if (v) developmentPlan[postIdx][dayIdx] = v;
    else delete developmentPlan[postIdx][dayIdx];
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    renderDevelopmentTable(developmentPlan, developmentFormaters, now.getFullYear(), now.getMonth(), daysInMonth);
  });
}

// ==================== НАСТРОЙКИ (диалог) ====================

function openDevelopmentSettings() {
  const s = getDevelopmentSettings();
  showModal('Настройки развития', [
    { name: 'targetLPerPost', label: 'Целевое кол-во L/U на пост', type: 'number', value: s.targetLPerPost },
    { name: 'targetLPerOperator', label: 'Целевое кол-во L/U на оператора', type: 'number', value: s.targetLPerOperator },
    { name: 'maxPerDay', label: 'Макс. обучений в день', type: 'number', value: s.maxPerDay },
    { name: 'maxPerOpPerMonth', label: 'Макс. обучений на оператора в месяц', type: 'number', value: s.maxPerOpPerMonth },
  ], (v, overlay) => {
    saveDevelopmentSettings({
      targetLPerPost: Math.max(1, parseInt(v.targetLPerPost) || 3),
      targetLPerOperator: Math.max(1, parseInt(v.targetLPerOperator) || 3),
      maxPerDay: Math.max(1, parseInt(v.maxPerDay) || 2),
      maxPerOpPerMonth: Math.max(1, parseInt(v.maxPerOpPerMonth) || 3),
    });
    overlay.remove();
    if (typeof showToast === 'function') showToast('⚙️ Настройки сохранены');
    // Пересчитываем таблицу
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    renderDevelopmentTable(developmentPlan, developmentFormaters, now.getFullYear(), now.getMonth(), daysInMonth);
    renderDevOperatorList();
  });
}

// ==================== ДЕФИЦИТ ПОСТОВ (отчёт) ====================

function openDevelopmentDeficit() {
  const section = getCurrentSection();
  const settings = getDevelopmentSettings();
  const opList = getCurrentOperators();
  const day = getCurrentDay();
  const levels = data;

  let html = `
    <div style="font-size:12px;color:#64748b;margin-bottom:10px;">
      Целевое L/U на пост: <b>${settings.targetLPerPost}</b> ·
      Целевое L/U на оператора: <b>${settings.targetLPerOperator}</b>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:6px 8px;text-align:left;border:1px solid #cbd5e1;">Пост</th>
          <th style="padding:6px 8px;border:1px solid #cbd5e1;">Сложность</th>
          <th style="padding:6px 8px;border:1px solid #cbd5e1;">Эргономика</th>
          <th style="padding:6px 8px;border:1px solid #cbd5e1;">L/U</th>
          <th style="padding:6px 8px;border:1px solid #cbd5e1;">Дефицит</th>
          <th style="padding:6px 8px;border:1px solid #cbd5e1;">Приоритет</th>
        </tr>
      </thead>
      <tbody>
  `;

  section.posts.forEach((p, r) => {
    const cnt = countPostL(r);
    const deficit = Math.max(0, settings.targetLPerPost - cnt);
    const pr = getPostDevelopmentPriority(r, settings);

    let color = '#16a34a';
    if (deficit > 0 && cnt === 0) color = '#ef4444';
    else if (deficit > 0) color = '#f59e0b';

    html += `
      <tr>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:left;">${escapeHtml(p.name)}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:center;">${escapeHtml(p.difficulty)}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:center;">${escapeHtml(p.ergonomics)}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:center;color:${color};font-weight:700;">${cnt}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:center;color:${color};font-weight:700;">${deficit || '✓'}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:center;">${pr}</td>
      </tr>
    `;
  });

  html += '</tbody></table>';

  // Показываем в модальном окне через showModal-подобный механизм
  const old = document.querySelector('.modal-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9999;display:flex;align-items:center;justify-content:center;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:white;border-radius:12px;padding:20px;min-width:640px;max-width:90vw;max-height:90vh;overflow-y:auto;';

  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <h3 style="font-size:16px;margin:0;">📊 Дефицит постов (что развивать)</h3>
      <button class="btn-small" onclick="this.closest('.modal-overlay').remove()">✕</button>
    </div>
    ${html}
  `;

  overlay.appendChild(modal);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

// ==================== ЭКСПОРТ ПЛАНА В TRAINING RECORDS ====================

function exportDevelopmentToTrainings() {
  if (!developmentPlan || Object.keys(developmentPlan).length === 0) {
    alert('Сначала сгенерируйте план');
    return;
  }

  const section = getCurrentSection();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Собираем плоский список обучений (по оператор+пост)
  const trainings = [];
  Object.keys(developmentPlan).forEach(postIdxStr => {
    const postIdx = parseInt(postIdxStr);
    const post = section.posts[postIdx];
    if (!post) return;

    const days = developmentPlan[postIdxStr];
    const daysArray = Object.keys(days).map(d => parseInt(d)).sort((a, b) => a - b);
    if (daysArray.length === 0) return;

    // Группируем дни по оператору
    const byOp = {};
    daysArray.forEach(dIdx => {
      const opName = days[dIdx];
      if (!byOp[opName]) byOp[opName] = [];
      byOp[opName].push(dIdx);
    });

    Object.keys(byOp).forEach(opName => {
      const opDays = byOp[opName].sort((a, b) => a - b);
      if (opDays.length === 0) return;

      const firstDay = opDays[0];
      const lastDay = opDays[opDays.length - 1];
      const startDate = formatDate(new Date(year, month, firstDay + 1));
      const endDate = formatDate(new Date(year, month, lastDay + 1));

      // Пропускаем, если уже есть активное обучение
      if (hasActiveTraining(opName, post.name)) return;

      // Определяем уровень (какой ставим)
      const opIdx = getCurrentOperators().findIndex(o => o.name === opName);
      const opLvl = opIdx >= 0 ? data[postIdx][opIdx] : null;
      let targetLevel = 'I'; // по умолчанию — начальный
      if (opLvl === 'I') targetLevel = 'L';
      else if (opLvl === 'Iкр') targetLevel = 'Lкр';
      else if (opLvl === null || opLvl === '') targetLevel = 'I';

      trainings.push({
        post: post,
        opName,
        level: targetLevel,
        startDate,
        endDate,
        duration: opDays.length,
        formator: developmentFormaters[postIdx] || '—'
      });
    });
  });

  if (trainings.length === 0) {
    alert('Нет обучений для экспорта');
    return;
  }

  // Показываем предпросмотр
  let html = `
    <div style="font-size:12px;color:#64748b;margin-bottom:10px;">
      Найдено обучений: <b>${trainings.length}</b>. Проверьте и подтвердите запись в журнал обучения.
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:6px 8px;border:1px solid #cbd5e1;">Оператор</th>
          <th style="padding:6px 8px;border:1px solid #cbd5e1;">Пост</th>
          <th style="padding:6px 8px;border:1px solid #cbd5e1;">Уровень</th>
          <th style="padding:6px 8px;border:1px solid #cbd5e1;">Начало</th>
          <th style="padding:6px 8px;border:1px solid #cbd5e1;">Конец</th>
          <th style="padding:6px 8px;border:1px solid #cbd5e1;">Дней</th>
          <th style="padding:6px 8px;border:1px solid #cbd5e1;">Форматор</th>
        </tr>
      </thead>
      <tbody>
  `;

  trainings.forEach(t => {
    html += `
      <tr>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;">${escapeHtml(t.opName)}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;">${escapeHtml(t.post.name)}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:center;">${escapeHtml(t.level)}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:center;">${escapeHtml(t.startDate)}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:center;">${escapeHtml(t.endDate)}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:center;">${t.duration}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;">${escapeHtml(t.formator)}</td>
      </tr>
    `;
  });

  html += '</tbody></table>';

  const old = document.querySelector('.modal-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9999;display:flex;align-items:center;justify-content:center;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:white;border-radius:12px;padding:20px;min-width:800px;max-width:92vw;max-height:90vh;overflow-y:auto;';

  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <h3 style="font-size:16px;margin:0;">📥 Экспорт в план обучения (предпросмотр)</h3>
      <button class="btn-small" onclick="this.closest('.modal-overlay').remove()">✕</button>
    </div>
    ${html}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;padding-top:12px;border-top:1px solid #e2e8f0;">
      <button class="btn-small" onclick="this.closest('.modal-overlay').remove()">Отмена</button>
      <button class="btn-small" id="devExportConfirmBtn" style="background:#16a34a;color:#fff;border-color:#16a34a;">
        ✅ Записать в журнал обучения
      </button>
    </div>
  `;

  overlay.appendChild(modal);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);

  // Обработчик кнопки
  document.getElementById('devExportConfirmBtn').onclick = () => {
    const records = getSystem().trainingRecords || [];
    let added = 0;

    trainings.forEach(t => {
      // Проверяем ещё раз, что нет активного дубля
      if (hasActiveTraining(t.opName, t.post.name)) return;

      records.push({
        year: now.getFullYear(),
        month: now.toLocaleString('ru-RU', { month: 'long' }),
        post: t.post.name,
        op: t.opName,
        level: t.level,
        status: 'План',
        formator: t.formator,
        startDate: t.startDate,
        validDate: '—',
        duration: t.duration,
        comment: 'Из плана развития'
      });
      added++;
    });

    getSystem().trainingRecords = records;
    saveSystem();
    logAudit('add_training', 'План развития', `Добавлено обучений: ${added}`);
    overlay.remove();

    alert(`✅ Добавлено в журнал обучения: ${added} записей`);
    if (typeof showToast === 'function') showToast(`✅ Записано: ${added}`);

    if (typeof renderTrainingTable === 'function') renderTrainingTable();
    if (typeof renderTrainingCalendar === 'function') renderTrainingCalendar();
  };
}

// ==================== ЭКСПОРТ В EXCEL ====================

function exportDevelopmentToExcel() {
  if (typeof XLSX === 'undefined') { alert('Библиотека XLSX не загружена'); return; }
  if (!developmentPlan || Object.keys(developmentPlan).length === 0) {
    alert('Сначала сгенерируйте план');
    return;
  }

  const section = getCurrentSection();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const wb = XLSX.utils.book_new();
  const rows = [['Пост', 'Форматор', ...Array.from({length: daysInMonth}, (_, i) => i + 1), 'Дней']];

  section.posts.forEach((p, r) => {
    const row = [p.name, developmentFormaters[r] || '—'];
    for (let d = 0; d < daysInMonth; d++) {
      row.push((developmentPlan[r] && developmentPlan[r][d]) || '');
    }
    row.push(Object.keys(developmentPlan[r] || {}).length);
    rows.push(row);
  });

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'План развития');
  XLSX.writeFile(wb, `Развитие_${section.name}_${formatDate().replace(/\./g, '-')}.xlsx`);
  logAudit('export_excel', 'План развития', section.name);
}