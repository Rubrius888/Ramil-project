// ======================== МАТРИЦА ILU ========================
function renderMatrix() {
  const thead = document.querySelector('#iluTable thead');
  const tbody = document.querySelector('#iluTable tbody');
  if (!thead || !tbody) return;

  const section = getCurrentSection();
  const opList = getCurrentOperators();
  const ops = opList.map(o => o.name);
  const roles = opList.map(o => o.role);
  const psts = section.posts.map(p => p.name);
  const postCount = section.posts.length;
  const opCount = opList.length;
  const levels = data;
  const attendance = attendanceData;

  // ==================== ПОЛИВАЛЕНТНОСТЬ: СЧИТАЕМ ОДИН РАЗ ====================
  const polyCache = new Array(opCount).fill(0);
  for (let c = 0; c < opCount; c++) {
    if (roles[c] === 'НУ' || roles[c] === 'СО') continue;
    let n = 0;
    for (let r = 0; r < postCount; r++) {
      const lvl = levels[r][c];
      if (lvl === 'L' || lvl === 'U' || lvl === 'Lкр') n++;
    }
    polyCache[c] = n;
  }

  // ==================== КАРТА ВОЗРАСТОВ НАЗНАЧЕНИЙ ====================
  const lastPlacementMap = (typeof buildLastPlacementMap === 'function')
    ? buildLastPlacementMap()
    : new Map();
  const todayMs = Date.now();

  function getAgeColorFast(opName, postName) {
    const d = lastPlacementMap.get(`${opName}|${postName}`);
    if (!d) return null;
    const diff = Math.floor((todayMs - d.getTime()) / 86400000);
    if (diff > 60) return 'red';
    if (diff > 30) return 'yellow';
    return null;
  }

  // ==================== АКТИВНОСТЬ ОПЕРАТОРОВ ====================
  const operatorActive = new Array(opCount).fill(false);
  for (let c = 0; c < opCount; c++) {
    for (let r = 0; r < postCount; r++) {
      const s = attendance[r][c];
      if (s === '○' || s === '△') { operatorActive[c] = true; break; }
    }
  }

  thead.innerHTML = '';

  // ---------- Строка ролей ----------
  const trRoles = document.createElement('tr');
  const thEmpty1 = document.createElement('th');
  thEmpty1.colSpan = 4;
  trRoles.appendChild(thEmpty1);

  ops.forEach((o, i) => {
    const th = document.createElement('th');
    th.colSpan = 2;
    th.style.cssText = 'cursor:pointer;font-size:11px;color:#64748b;white-space:nowrap;overflow:visible;text-overflow:clip;min-width:100px;';
    th.textContent = roles[i];
    th.onclick = () => cycleOperatorRole(i);
    trRoles.appendChild(th);
  });
  thead.appendChild(trRoles);

  // ---------- Строка имен ----------
  const trNames = document.createElement('tr');
  ['Пост', 'Сл.', 'Эрг.', 'Срок обучения до I'].forEach(txt => {
    const th = document.createElement('th');
    th.textContent = txt;
    if (txt === 'Пост') {
      th.style.cssText = 'white-space:nowrap;overflow:visible;text-overflow:clip;min-width:150px;';
    }
    trNames.appendChild(th);
  });

  ops.forEach((o, i) => {
    const th = document.createElement('th');
    th.colSpan = 2;
    th.style.cssText = 'cursor:pointer;white-space:nowrap;overflow:visible;text-overflow:clip;min-width:120px;vertical-align:top;';
    th.dataset.opIdx = String(i);
    th.classList.add('matrix-op-header');

    const opObj = opList[i];

    if (opObj && opObj.photo) {
      const avatar = document.createElement('img');
      avatar.src = opObj.photo;
      avatar.className = 'matrix-operator-avatar';
      avatar.alt = o;
      th.appendChild(avatar);
    } else if (opObj) {
      const initials = opObj.name
        .split(' ')
        .map(w => w[0] || '')
        .slice(0, 2)
        .join('')
        .toUpperCase();
      const av = document.createElement('div');
      av.className = 'matrix-operator-avatar matrix-operator-avatar-empty';
      av.textContent = initials;
      th.appendChild(av);
    }

    const tags = (opObj && Array.isArray(opObj.tags)) ? opObj.tags : [];
    if (tags.length > 0) {
      const tagWrap = document.createElement('div');
      tagWrap.style.cssText = 'display:flex;gap:2px;justify-content:center;margin-bottom:2px;';
      tags.forEach(tagKey => {
        const tag = AVAILABLE_TAGS.find(t => t.key === tagKey);
        if (!tag) return;
        const dot = document.createElement('span');
        dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:50%;background:${tag.color};`;
        dot.title = tag.label;
        tagWrap.appendChild(dot);
      });
      th.appendChild(tagWrap);
    }

    const nameSpan = document.createElement('span');
    nameSpan.textContent = o;
    th.appendChild(nameSpan);
    th.onclick = (e) => showOperatorMenu(e, o);
    trNames.appendChild(th);
  });

  ['Покрытие U', 'Поливал. 3L', 'Поливал. 2L'].forEach(txt => {
    const th = document.createElement('th');
    th.rowSpan = 2;
    const span = document.createElement('span');
    span.style.writingMode = 'sideways-lr';
    span.textContent = txt;
    th.appendChild(span);
    trNames.appendChild(th);
  });
  thead.appendChild(trNames);

  const trSub = document.createElement('tr');
  for (let i = 0; i < 4; i++) trSub.appendChild(document.createElement('th'));

  ops.forEach((o, i) => {
    const bg = operatorActive[i] ? 'background:#cbd5e1;' : '';
    const th1 = document.createElement('th');
    th1.style.cssText = bg;
    th1.dataset.opIdx = String(i);
    th1.classList.add('matrix-op-subheader');
    const s1 = document.createElement('span');
    s1.style.writingMode = 'sideways-lr';
    s1.textContent = 'Статус';
    th1.appendChild(s1);

    const th2 = document.createElement('th');
    th2.style.cssText = bg;
    th2.dataset.opIdx = String(i);
    th2.classList.add('matrix-op-subheader');
    const s2 = document.createElement('span');
    s2.style.writingMode = 'sideways-lr';
    s2.textContent = 'Уровень';
    th2.appendChild(s2);

    trSub.appendChild(th1);
    trSub.appendChild(th2);
  });
  thead.appendChild(trSub);

  // ---------- Тело таблицы ----------
  tbody.innerHTML = '';

  for (let r = 0; r < postCount; r++) {
    const tr = document.createElement('tr');
    tr.dataset.postIdx = String(r);
    tr.classList.add('matrix-post-row');

    const postName = psts[r];
    const postObj = section.posts[r];

    let rowActive = false;
    for (let c = 0; c < opCount; c++) {
      const s = attendance[r][c];
      if (s === '○' || s === '△') { rowActive = true; break; }
    }

    const postBg = rowActive ? 'background:#e2e8f0;' : '';

    const tdPost = document.createElement('td');
    tdPost.style.cssText = `cursor:pointer;${postBg}white-space:nowrap;overflow:visible;text-overflow:clip;min-width:150px;padding:8px 12px;`;
    tdPost.textContent = postName;
    tdPost.onclick = (e) => showPostMenu(e, postName);
    tr.appendChild(tdPost);

    const tdDiff = document.createElement('td');
    const diff = postObj.difficulty;
    tdDiff.className = 'cell';
    tdDiff.style.fontWeight = '700';
    if (diff === 'A') { tdDiff.textContent = 'A'; tdDiff.style.backgroundColor = '#fecaca'; }
    else if (diff === 'B') { tdDiff.textContent = 'B'; tdDiff.style.backgroundColor = '#fef08a'; }
    else { tdDiff.textContent = 'C'; tdDiff.style.backgroundColor = '#bbf7d0'; }
    tdDiff.onclick = () => cycleDifficulty(r);
    tr.appendChild(tdDiff);

    const tdErgo = document.createElement('td');
    const ergo = postObj.ergonomics;
    tdErgo.className = 'cell';
    tdErgo.style.fontWeight = '700';
    if (ergo === 'red') { tdErgo.textContent = 'К'; tdErgo.style.backgroundColor = '#fecaca'; }
    else if (ergo === 'yellow') { tdErgo.textContent = 'Ж'; tdErgo.style.backgroundColor = '#fef08a'; }
    else { tdErgo.textContent = 'З'; tdErgo.style.backgroundColor = '#bbf7d0'; }
    tdErgo.onclick = () => cycleErgonomics(r);
    tr.appendChild(tdErgo);

    const tdDays = document.createElement('td');
    tdDays.textContent = postObj.trainingDays;
    tdDays.className = 'cell';
    tdDays.onclick = () => cycleTrainingDays(r);
    tr.appendChild(tdDays);

    for (let c = 0; c < opCount; c++) {
      const tdCell = document.createElement('td');
      const st = attendance[r][c];
      tdCell.textContent = st;
      tdCell.className = 'cell';
      tdCell.dataset.postIdx = String(r);
      tdCell.dataset.opIdx = String(c);
      if (st === '○') tdCell.classList.add('status-ya');
      if (st === '△') tdCell.classList.add('status-ob');

      const ageColor = getAgeColorFast(ops[c], postName);
      if (ageColor === 'red') tdCell.style.animation = 'blink-red 1s infinite';
      else if (ageColor === 'yellow') tdCell.style.animation = 'blink-yellow 1s infinite';

      tdCell.onclick = (e) => cyclePostStatusAt(e.currentTarget, r, c);

      tdCell.onmouseenter = (e) => {
        showMatrixTooltip(e, r, c);
        highlightCross(r, c);
      };
      tdCell.onmouseleave = () => {
        hideMatrixTooltip();
        clearHighlightCross();
      };
      tdCell.onmousemove = moveMatrixTooltip;

      tr.appendChild(tdCell);

      const tdLvl = document.createElement('td');
      const lvl = levels[r][c];
      tdLvl.textContent = lvl || '';
      tdLvl.className = 'cell';
      tdLvl.dataset.postIdx = String(r);
      tdLvl.dataset.opIdx = String(c);
      if (lvl === 'Iкр') { tdLvl.classList.add('level-I'); tdLvl.style.color = '#ef4444'; tdLvl.style.fontWeight = '900'; }
      if (lvl === 'I') tdLvl.classList.add('level-I');
      if (lvl === 'Lкр') { tdLvl.classList.add('level-L'); tdLvl.style.color = '#ef4444'; tdLvl.style.fontWeight = '900'; }
      if (lvl === 'L') tdLvl.classList.add('level-L');
      if (lvl === 'U') tdLvl.classList.add('level-U');
      tdLvl.onclick = (e) => cycleLevelAt(e.currentTarget, r, c);

      tdLvl.onmouseenter = (e) => {
        showMatrixTooltip(e, r, c);
        highlightCross(r, c);
      };
      tdLvl.onmouseleave = () => {
        hideMatrixTooltip();
        clearHighlightCross();
      };
      tdLvl.onmousemove = moveMatrixTooltip;

      tr.appendChild(tdLvl);
    }

    const tdCover = document.createElement('td');
    let uCount = 0;
    for (let c = 0; c < opCount; c++) {
      if (roles[c] !== 'НУ' && levels[r][c] === 'U') uCount++;
    }
    tdCover.textContent = uCount > 0 ? uCount : '';
    tdCover.style.fontWeight = '700';
    if (uCount > 0) { tdCover.style.backgroundColor = '#bbf7d0'; tdCover.style.color = '#166534'; }
    tr.appendChild(tdCover);

    const tdPoly3 = document.createElement('td');
    let countL3 = 0;
    for (let c = 0; c < opCount; c++) {
      if (roles[c] === 'НУ' || roles[c] === 'СО') continue;
      if (levels[r][c] === 'L' || levels[r][c] === 'U') countL3++;
    }
    tdPoly3.textContent = countL3 >= 3 ? `(${countL3})` : '';
    tdPoly3.style.fontWeight = '700';
    if (countL3 >= 3) { tdPoly3.style.backgroundColor = '#bbf7d0'; tdPoly3.style.color = '#166534'; }
    tr.appendChild(tdPoly3);

    const tdPoly2 = document.createElement('td');
    tdPoly2.textContent = countL3 >= 2 ? `(${countL3})` : '';
    tdPoly2.style.fontWeight = '700';
    if (countL3 >= 2) { tdPoly2.style.backgroundColor = '#bbf7d0'; tdPoly2.style.color = '#166534'; }
    tr.appendChild(tdPoly2);

    tbody.appendChild(tr);
  }

  // ==================== ИТОГИ ====================
  let coveredPosts = 0;
  for (let r = 0; r < postCount; r++) {
    for (let c = 0; c < opCount; c++) {
      if (roles[c] !== 'НУ' && levels[r][c] === 'U') { coveredPosts++; break; }
    }
  }
  const percentU = postCount > 0 ? Math.round((coveredPosts / postCount) * 100) : 0;

  let posts3L = 0, posts2L = 0;
  for (let r = 0; r < postCount; r++) {
    let countL = 0;
    for (let c = 0; c < opCount; c++) {
      if (roles[c] === 'НУ' || roles[c] === 'СО') continue;
      if (levels[r][c] === 'L' || levels[r][c] === 'U') countL++;
    }
    if (countL >= 3) posts3L++;
    if (countL >= 2) posts2L++;
  }

  const percent3L = postCount > 0 ? Math.round((posts3L / postCount) * 100) : 0;
  const percent2L = postCount > 0 ? Math.round((posts2L / postCount) * 100) : 0;

  let ops3L = 0, ops2L = 0;
  let totalOpsForPoly = 0;
  for (let c = 0; c < opCount; c++) {
    if (roles[c] === 'НУ' || roles[c] === 'СО') continue;
    totalOpsForPoly++;
    const n = polyCache[c];
    if (n >= 3) ops3L++;
    if (n >= 2) ops2L++;
  }

  const percentOps3L = totalOpsForPoly > 0 ? Math.round((ops3L / totalOpsForPoly) * 100) : 0;
  const percentOps2L = totalOpsForPoly > 0 ? Math.round((ops2L / totalOpsForPoly) * 100) : 0;
  const total3L = Math.round((percent3L + percentOps3L) / 2);
  const total2L = Math.round((percent2L + percentOps2L) / 2);

  const att = operatorAttendance;

  // ---------- Футер: явка ----------
  const trFooter = document.createElement('tr');
  const td0 = document.createElement('td');
  td0.textContent = 'Статус явки';
  td0.style.fontWeight = '700';
  trFooter.appendChild(td0);

  for (let i = 0; i < 3; i++) trFooter.appendChild(document.createElement('td'));

  ops.forEach((o, i) => {
    const td = document.createElement('td');
    td.colSpan = 2;
    const a = att[i];
    let color = '#16a34a';
    if (a === 'Н' || a === 'Б') color = '#ef4444';
    if (a === 'О') color = '#9333ea';
    if (a === 'С') color = '#ea580c';
    if (a === 'У') color = '#64748b';

    const label = a === 'Я' ? 'Явка' : a === 'Н' ? 'Неявка' : a === 'Б' ? 'Больничный' :
                  a === 'О' ? 'Отпуск' : a === 'С' ? 'В др. секторе' : 'Уволен';

    td.style.cssText = `color:${color};cursor:pointer;font-weight:700;font-size:12px;`;
    td.textContent = label;
    td.onclick = () => cycleOperatorAttendance(i);
    trFooter.appendChild(td);
  });

  const tdFooterU = document.createElement('td');
  tdFooterU.textContent = percentU + '%';
  tdFooterU.style.cssText = 'font-weight:700;color:#166534;';
  trFooter.appendChild(tdFooterU);

  const tdFooter3L = document.createElement('td');
  tdFooter3L.textContent = percent3L + '%';
  tdFooter3L.style.cssText = 'font-weight:700;color:#166534;';
  trFooter.appendChild(tdFooter3L);

  const tdFooter2L = document.createElement('td');
  tdFooter2L.textContent = percent2L + '%';
  tdFooter2L.style.cssText = 'font-weight:700;color:#166534;';
  trFooter.appendChild(tdFooter2L);

  tbody.appendChild(trFooter);

  // ---------- Поливалентность 3L ----------
  const trPoly3 = document.createElement('tr');
  const p3td0 = document.createElement('td');
  p3td0.textContent = 'Поливалентность 3L';
  p3td0.style.fontWeight = '700';
  trPoly3.appendChild(p3td0);

  for (let i = 0; i < 3; i++) trPoly3.appendChild(document.createElement('td'));

  ops.forEach((o, i) => {
    const td = document.createElement('td');
    td.colSpan = 2;
    const count = polyCache[i];
    td.style.background = count >= 3 ? '#bbf7d0' : 'transparent';
    td.style.fontWeight = '700';
    td.style.fontSize = '12px';
    td.textContent = `(${count})`;
    trPoly3.appendChild(td);
  });

  trPoly3.appendChild(document.createElement('td'));

  const tdP3 = document.createElement('td');
  tdP3.textContent = total3L + '%';
  tdP3.style.cssText = 'font-weight:700;color:#166534;';
  trPoly3.appendChild(tdP3);

  trPoly3.appendChild(document.createElement('td'));
  tbody.appendChild(trPoly3);

  // ---------- Поливалентность 2L ----------
  const trPoly2 = document.createElement('tr');
  const p2td0 = document.createElement('td');
  p2td0.textContent = 'Поливалентность 2L';
  p2td0.style.fontWeight = '700';
  trPoly2.appendChild(p2td0);

  for (let i = 0; i < 3; i++) trPoly2.appendChild(document.createElement('td'));

  ops.forEach((o, i) => {
    const td = document.createElement('td');
    td.colSpan = 2;
    const count = polyCache[i];
    td.style.background = count >= 2 ? '#bbf7d0' : 'transparent';
    td.style.fontWeight = '700';
    td.style.fontSize = '12px';
    td.textContent = `(${count})`;
    trPoly2.appendChild(td);
  });

  trPoly2.appendChild(document.createElement('td'));
  trPoly2.appendChild(document.createElement('td'));

  const tdP2 = document.createElement('td');
  tdP2.textContent = total2L + '%';
  tdP2.style.cssText = 'font-weight:700;color:#166534;';
  trPoly2.appendChild(tdP2);
  tbody.appendChild(trPoly2);

  window._polyData = { percent2L, percent3L, percentOps2L, percentOps3L, total2L, total3L };
  updateStatsCard();
}

// ======================== ПОДСВЕТКА ПЕРЕКРЕСТИЯ ========================
function highlightCross(postIdx, opIdx) {
  clearHighlightCross();
  const table = document.getElementById('iluTable');
  if (!table) return;

  const row = table.querySelector(`tbody tr[data-post-idx="${postIdx}"]`);
  if (row) {
    row.classList.add('matrix-cross-row');
    row.querySelectorAll('td').forEach(td => td.classList.add('matrix-cross-row-cell'));
  }

  table.querySelectorAll(`tbody td[data-op-idx="${opIdx}"]`).forEach(td => {
    td.classList.add('matrix-cross-col-cell');
  });

  table.querySelectorAll(`thead th[data-op-idx="${opIdx}"]`).forEach(th => {
    th.classList.add('matrix-cross-col-header');
  });

  const cell = table.querySelector(`tbody td[data-post-idx="${postIdx}"][data-op-idx="${opIdx}"]`);
  if (cell) cell.classList.add('matrix-cross-cell');
}

function clearHighlightCross() {
  const table = document.getElementById('iluTable');
  if (!table) return;
  table.querySelectorAll('.matrix-cross-row, .matrix-cross-row-cell, .matrix-cross-col-cell, .matrix-cross-col-header, .matrix-cross-cell')
    .forEach(el => {
      el.classList.remove(
        'matrix-cross-row',
        'matrix-cross-row-cell',
        'matrix-cross-col-cell',
        'matrix-cross-col-header',
        'matrix-cross-cell'
      );
    });
}

// ======================== ХЕЛПЕР: ПОЛИВАЛЕНТНОСТЬ ОПЕРАТОРА ========================
function getOperatorPolyvalence(idx) {
  const opList = getCurrentOperators();
  const roles = opList.map(o => o.role);
  if (roles[idx] === 'НУ' || roles[idx] === 'СО') return 0;

  const section = getCurrentSection();
  const postCount = section.posts.length;
  const levels = data;
  let count = 0;
  for (let r = 0; r < postCount; r++) {
    const lvl = levels[r][idx];
    if (lvl === 'L' || lvl === 'U' || lvl === 'Lкр') count++;
  }
  return count;
}

// ======================== ВЗАИМОДЕЙСТВИЕ ========================
function cyclePostStatusAt(td, row, col) {
  if (!td) return;

  const cur = attendanceData[row][col];
  const lvl = data[row][col];

  const all = [
    { value: '',   label: '— Пусто' },
    { value: '○',  label: '○ Стоит' },
    { value: '△',  label: '△ Обучается' }
  ];

  const options = all.filter(o => {
    if (o.value === '') return true;
    if (o.value === '○') return lvl !== null && lvl !== '';
    if (o.value === '△') return lvl === 'Iкр';
    return true;
  });

  showInlineSelect(td, cur, options, (v) => {
    const section = getCurrentSection();
    const day = getCurrentDay();
    const opList = getCurrentOperators();
    const pid = section.posts[row].id;
    const oid = opList[col].id;
    const curList = normalizeAssignment(day.assignments[pid]);

    if (v === '') {
      setAssignmentList(day.assignments, pid, curList.filter(x => x !== oid));
      logPlacement(opList[col].name, section.posts[row].name, 'unassign');
    } else if (v === '○') {
      section.posts.forEach(p => {
        if (p.id === pid) return;
        const list = normalizeAssignment(day.assignments[p.id]);
        if (list.includes(oid)) {
          setAssignmentList(day.assignments, p.id, list.filter(x => x !== oid));
          logPlacement(opList[col].name, p.name, 'unassign');
        }
      });

      const learning = curList.filter(x => {
        const l = day.levels[pid] && day.levels[pid][x];
        return l === 'Iкр';
      });

      const newList = [oid, ...learning.filter(x => x !== oid)];
      setAssignmentList(day.assignments, pid, newList);
      logPlacement(opList[col].name, section.posts[row].name, 'assign');

      if (data[row][col] === 'I') data[row][col] = 'Lкр';
    } else if (v === '△') {
      if (!curList.includes(oid)) curList.push(oid);
      setAssignmentList(day.assignments, pid, curList);
      logPlacement(opList[col].name, section.posts[row].name, 'assign');
    }

    saveSystem();
    renderMatrix();
    if (typeof renderSE8Blank === 'function') renderSE8Blank();
  });
}

function cycleLevelAt(td, row, col) {
  if (!td) return;

  const cur = data[row][col];
  const opList = getCurrentOperators();
  const role = opList[col] ? opList[col].role : 'О';

  const all = [
    { value: '',   label: '— Пусто' },
    { value: 'Iкр', label: 'Iкр' },
    { value: 'I',  label: 'I' },
    { value: 'Lкр', label: 'Lкр' },
    { value: 'L',  label: 'L' },
    { value: 'U',  label: 'U' }
  ];

  // U доступен для НУ, СО и Ф
  const options = all.filter(o => {
    if (o.value === 'U' && role !== 'НУ' && role !== 'СО' && role !== 'Ф') return false;
    return true;
  });

  showInlineSelect(td, cur, options, (v) => {
    data[row][col] = v;
    renderMatrix();
    if (typeof renderSE8Blank === 'function') renderSE8Blank();
  });
}

function cycleOperatorAttendance(idx) {
  const opList = getCurrentOperators();
  const op = opList[idx];
  if (!op) return;
  if (op.role === 'НУ') return;

  const cur = operatorAttendance[idx];
  const options = [
    { value: 'Я', label: 'Явка' },
    { value: 'Н', label: 'Неявка' },
    { value: 'Б', label: 'Больничный' },
    { value: 'О', label: 'Отпуск' },
    { value: 'С', label: 'В другом секторе' },
    { value: 'У', label: 'Увольнение' }
  ];

  showCenteredSelect('Статус явки', cur, options, (v) => {
    const section = getCurrentSection();
    const day = getCurrentDay();

    day.attendance[op.id] = v;

    if (v !== 'Я') {
      section.posts.forEach(p => {
        const list = normalizeAssignment(day.assignments[p.id]);
        if (list.includes(op.id)) {
          setAssignmentList(day.assignments, p.id, list.filter(x => x !== op.id));
          logPlacement(op.name, p.name, 'attendance');
        }
      });
    }

    saveSystem();
    renderMatrix();
    if (typeof renderSE8Blank === 'function') renderSE8Blank();

    // ⬇️⬇️⬇️ Пересчёт плана ротации при изменении явки
    if (typeof window.onRotationAttendanceChanged === 'function') {
      window.onRotationAttendanceChanged(op.id);
    }
  });
}

function cycleOperatorRole(idx) {
  const opList = getCurrentOperators();
  const op = opList[idx];
  if (!op) return;

  showCenteredSelect('Должность', op.role, OPERATOR_ROLES, (v) => {
    if (v === 'НУ' || v === 'СО' || v === 'Ф' || v === 'ДС' || v === 'ИС') {
      if (op.role !== v) {
        const section = getCurrentSection();
        const shiftData = getCurrentShiftData();
        Object.values(shiftData.days || {}).forEach(day => {
          section.posts.forEach(p => {
            if ((v === 'НУ' || v === 'СО') && day.levels[p.id] && day.levels[p.id][op.id] === 'U') {
              day.levels[p.id][op.id] = 'L';
            }
          });
        });
      }
    }

    updateOperator(op.id, { role: v });
    renderMatrix();
    if (typeof renderSE8Blank === 'function') renderSE8Blank();
  });
}

function cycleErgonomics(row) {
  const table = document.getElementById('iluTable');
  if (!table) return;
  const tr = table.querySelector(`tbody tr:nth-child(${row + 1})`);
  if (!tr) return;
  const td = tr.querySelectorAll('td')[2];
  if (!td) return;

  const post = getCurrentSection().posts[row];
  if (!post) return;

  const options = [
    { value: 'red',    label: 'К — Красная' },
    { value: 'yellow', label: 'Ж — Жёлтая' },
    { value: 'green',  label: 'З — Зелёная' }
  ];

  showInlineSelect(td, post.ergonomics, options, (v) => {
    updatePost(post.id, { ergonomics: v });
    renderMatrix();
  });
}

function cycleTrainingDays(row) {
  const post = getCurrentSection().posts[row];
  if (!post) return;

  const v = prompt('Срок обучения (дни):', post.trainingDays);
  if (v !== null && v.trim() !== '' && !isNaN(v) && parseInt(v) > 0) {
    updatePost(post.id, { trainingDays: parseInt(v) });
    renderMatrix();
  }
}

function cycleDifficulty(row) {
  const table = document.getElementById('iluTable');
  if (!table) return;
  const tr = table.querySelector(`tbody tr:nth-child(${row + 1})`);
  if (!tr) return;
  const td = tr.querySelectorAll('td')[1];
  if (!td) return;

  const post = getCurrentSection().posts[row];
  if (!post) return;

  const options = [
    { value: 'A', label: 'A' },
    { value: 'B', label: 'B' },
    { value: 'C', label: 'C' }
  ];

  showInlineSelect(td, post.difficulty, options, (v) => {
    updatePost(post.id, { difficulty: v });
    renderMatrix();
  });
}

// ======================== МЕНЮ ========================
function showOperatorMenu(event, name) {
  event.stopPropagation();
  hideMenu();

  const opList = getCurrentOperators();
  const idx = opList.findIndex(o => o.name === name);
  if (idx < 0) return;

  const op = opList[idx];
  const menu = document.createElement('div');
  menu.className = 'context-menu';

  const itemProfile = document.createElement('div');
  itemProfile.textContent = '👤 Профиль';
  itemProfile.onclick = () => { openOperatorProfile(idx); hideMenu(); };
  menu.appendChild(itemProfile);

  const itemRename = document.createElement('div');
  itemRename.textContent = '✏️ Переименовать';
  itemRename.onclick = () => { editOperatorByIndex(idx); hideMenu(); };
  menu.appendChild(itemRename);

  const itemRole = document.createElement('div');
  itemRole.textContent = '🎭 Роль';
  itemRole.onclick = () => { editOperatorRoleByIndex(idx); hideMenu(); };
  menu.appendChild(itemRole);

  if (op) {
    const sep = document.createElement('div');
    sep.style.cssText = 'border-top:1px solid #e2e8f0;margin:4px 0;';
    menu.appendChild(sep);

    const tagsTitle = document.createElement('div');
    tagsTitle.style.cssText = 'padding:4px 12px;font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:700;';
    tagsTitle.textContent = 'Теги';
    menu.appendChild(tagsTitle);

    const currentTags = Array.isArray(op.tags) ? op.tags : [];
    AVAILABLE_TAGS.forEach(tag => {
      const hasTag = currentTags.includes(tag.key);
      const tagItem = document.createElement('div');
      tagItem.style.cssText = 'display:flex;align-items:center;gap:6px;';

      const dot = document.createElement('span');
      dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${tag.color};display:inline-block;`;

      const label = document.createElement('span');
      label.textContent = tag.label;

      const check = document.createElement('span');
      check.style.marginLeft = 'auto';
      check.style.color = hasTag ? '#16a34a' : 'transparent';
      check.textContent = hasTag ? '✓' : '';

      tagItem.appendChild(dot);
      tagItem.appendChild(label);
      tagItem.appendChild(check);

      tagItem.onclick = (e) => {
        e.stopPropagation();
        toggleOperatorTag(op.id, tag.key);
        hideMenu();
        renderMatrix();
      };

      menu.appendChild(tagItem);
    });
  }

  const sep2 = document.createElement('div');
  sep2.style.cssText = 'border-top:1px solid #e2e8f0;margin:4px 0;';
  menu.appendChild(sep2);

  const itemDelete = document.createElement('div');
  itemDelete.className = 'danger';
  itemDelete.textContent = '🗑️ Удалить';
  itemDelete.onclick = () => { deleteOperatorByIndex(idx); hideMenu(); };
  menu.appendChild(itemDelete);

  menu.style.left = Math.min(event.clientX, window.innerWidth - 220) + 'px';
  menu.style.top = Math.min(event.clientY, window.innerHeight - 400) + 'px';
  menu.style.maxHeight = '400px';
  menu.style.overflowY = 'auto';

  document.body.appendChild(menu);
  currentMenu = menu;

  setTimeout(() => document.addEventListener('click', hideMenu, { once: true }), 0);
}

function showPostMenu(event, name) {
  event.stopPropagation();
  hideMenu();

  const section = getCurrentSection();
  const idx = section.posts.findIndex(p => p.name === name);
  if (idx === -1) return;

  const menu = document.createElement('div');
  menu.className = 'context-menu';

  const itemProfile = document.createElement('div');
  itemProfile.textContent = '👁 Профиль поста';
  itemProfile.onclick = () => { openPostProfile(idx); hideMenu(); };
  menu.appendChild(itemProfile);

  const itemEdit = document.createElement('div');
  itemEdit.textContent = '✏️ Редактировать';
  itemEdit.onclick = () => { editPostByIndex(idx); hideMenu(); };
  menu.appendChild(itemEdit);

  const itemAddToSe8 = document.createElement('div');
  itemAddToSe8.className = 'se8-add-action';
  itemAddToSe8.textContent = '➕ Добавить в расстановку';
  itemAddToSe8.onclick = () => { addPostToSe8Layout(idx); hideMenu(); };
  menu.appendChild(itemAddToSe8);

  const itemDelete = document.createElement('div');
  itemDelete.className = 'danger';
  itemDelete.textContent = '🗑️ Удалить';
  itemDelete.onclick = () => { deletePostByIndex(idx); hideMenu(); };
  menu.appendChild(itemDelete);

  menu.style.left = Math.min(event.clientX, window.innerWidth - 220) + 'px';
  menu.style.top = Math.min(event.clientY, window.innerHeight - 250) + 'px';

  document.body.appendChild(menu);
  currentMenu = menu;

  setTimeout(() => document.addEventListener('click', hideMenu, { once: true }), 0);
}

// ======================== CRUD ========================
function editOperatorByIndex(idx) {
  const op = getCurrentOperators()[idx];
  if (!op) return;

  showModal('Оператор', [
    { name: 'name', label: 'ФИО', value: op.name },
    { name: 'role', label: 'Роль', type: 'select', value: op.role, options: OPERATOR_ROLES }
  ], (v, overlay) => {
    updateOperator(op.id, { name: v.name, role: v.role });
    overlay.remove();
    renderMatrix();
  });
}

function editOperatorRoleByIndex(idx) {
  const op = getCurrentOperators()[idx];
  if (!op) return;

  showCenteredSelect('Роль', op.role, OPERATOR_ROLES, (v) => {
    updateOperator(op.id, { role: v });
    renderMatrix();
  });
}

function deleteOperatorByIndex(idx) {
  const op = getCurrentOperators()[idx];
  if (!op) return;

  if (!confirm(`Удалить «${op.name}»?`)) return;
  deleteOperatorFromShift(op.id);
  renderMatrix();
  if (typeof renderSE8Blank === 'function') renderSE8Blank();
}

function editPostByIndex(idx) {
  const post = getCurrentSection().posts[idx];
  if (!post) return;

  showModal('Пост', [
    { name: 'name', label: 'Название', value: post.name },
    { name: 'difficulty', label: 'Сложность', type: 'select', value: post.difficulty, options: [
      { value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' }
    ]},
    { name: 'ergonomics', label: 'Эргономика', type: 'select', value: post.ergonomics, options: [
      { value: 'red', label: 'Красная' }, { value: 'yellow', label: 'Жёлтая' }, { value: 'green', label: 'Зелёная' }
    ]},
    { name: 'trainingDays', label: 'Срок обучения', type: 'number', value: post.trainingDays }
  ], (v, overlay) => {
    updatePost(post.id, {
      name: v.name,
      difficulty: v.difficulty,
      ergonomics: v.ergonomics,
      trainingDays: parseInt(v.trainingDays) || 5
    });
    overlay.remove();
    renderMatrix();
    if (typeof renderSE8Blank === 'function') renderSE8Blank();
  });
}

function deletePostByIndex(idx) {
  const post = getCurrentSection().posts[idx];
  if (!post) return;

  if (!confirm(`Удалить пост «${post.name}»?`)) return;
  deletePostFromSection(post.id);
  renderMatrix();
  if (typeof renderSE8Blank === 'function') renderSE8Blank();
}

// ======================== СТАТИСТИКА В КАРТОЧКАХ ========================
function updateStatsCard() {
  const section = getCurrentSection();
  const postCount = section.posts.length;
  const opList = getCurrentOperators();
  const opCount = opList.length;
  const roles = opList.map(o => o.role);
  const attendance = attendanceData;
  const att = operatorAttendance;

  let filled = 0, training = 0;
  for (let r = 0; r < postCount; r++) {
    let hasOp = false, hasTr = false;
    for (let c = 0; c < opCount; c++) {
      const s = attendance[r][c];
      if (s === '○') hasOp = true;
      if (s === '△') { hasOp = true; hasTr = true; }
    }
    if (hasOp) filled++;
    if (hasTr) training++;
  }

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setTxt('statsTotalPosts', postCount);
  setTxt('statsFilledPosts', filled);
  setTxt('statsTrainingPosts', training);

  let totalOps = 0;
  let present = 0, vac = 0, sick = 0, abs = 0, fired = 0, other = 0;
  for (let c = 0; c < opCount; c++) {
    if (roles[c] === 'НУ') continue;
    totalOps++;
    const a = att[c];
    if (a === 'Я') present++;
    else if (a === 'О') vac++;
    else if (a === 'Б') sick++;
    else if (a === 'Н') abs++;
    else if (a === 'У') fired++;
    else if (a === 'С') other++;
  }

  setTxt('statsTotalOps', totalOps);
  setTxt('statsPresent', present);
  setTxt('statsVacation', vac);
  setTxt('statsSick', sick);
  setTxt('statsAbsent', abs);
  setTxt('statsFired', fired);
  setTxt('statsOtherSector', other);

  const pd = window._polyData || {};
  setTxt('statsTotal2L', (pd.total2L || 0) + '%');
  setTxt('statsTotal3L', (pd.total3L || 0) + '%');
  setTxt('statsPosts2L', (pd.percent2L || 0) + '%');
  setTxt('statsPosts3L', (pd.percent3L || 0) + '%');
  setTxt('statsOps2L', (pd.percentOps2L || 0) + '%');
  setTxt('statsOps3L', (pd.percentOps3L || 0) + '%');
}

// ======================== TOOLTIP ========================
function showMatrixTooltip(event, rowIdx, colIdx) {
  const tooltip = document.getElementById('ilu-tooltip');
  if (!tooltip) return;

  const section = getCurrentSection();
  const opList = getCurrentOperators();
  const postName = section.posts[rowIdx] ? section.posts[rowIdx].name : '';
  const opName = opList[colIdx] ? opList[colIdx].name : '';

  const postObj = section.posts[rowIdx];
  const opObj = opList[colIdx];

  const level = data[rowIdx][colIdx];
  const status = attendanceData[rowIdx][colIdx];

  let html = '';
  html += `<strong>👤 ${escapeHtml(opName)}</strong>`;
  if (opObj) {
    html += `<div class="tt-row"><span class="tt-label">Роль:</span><span class="tt-val">${opObj.role}</span></div>`;
    if (opObj.tags && opObj.tags.length > 0) {
      const tags = opObj.tags.map(t => {
        const tagDef = AVAILABLE_TAGS.find(at => at.key === t);
        return tagDef ? tagDef.label : t;
      }).join(', ');
      html += `<div class="tt-row"><span class="tt-label">Теги:</span><span class="tt-val">${escapeHtml(tags)}</span></div>`;
    }
  }

  html += `<div style="border-top:1px solid #475569;margin:6px 0;"></div>`;
  html += `<strong>📍 ${escapeHtml(postName)}</strong>`;
  if (postObj) {
    const diffLabel = postObj.difficulty === 'A' ? 'A (Высокая)' : postObj.difficulty === 'B' ? 'B (Средняя)' : 'C (Низкая)';
    const ergoLabel = postObj.ergonomics === 'red' ? 'Красная' : postObj.ergonomics === 'yellow' ? 'Желтая' : 'Зеленая';
    html += `<div class="tt-row"><span class="tt-label">Сложность:</span><span class="tt-val">${diffLabel}</span></div>`;
    html += `<div class="tt-row"><span class="tt-label">Эргономика:</span><span class="tt-val">${ergoLabel}</span></div>`;
    html += `<div class="tt-row"><span class="tt-label">Обучение:</span><span class="tt-val">${postObj.trainingDays} дн.</span></div>`;
  }

  html += `<div style="border-top:1px solid #475569;margin:6px 0;"></div>`;
  const statusLabel = status === '○' ? 'Стоит' : status === '△' ? 'Обучается' : 'Не назначен';
  const levelLabel = level || '—';
  html += `<div class="tt-row"><span class="tt-label">Статус:</span><span class="tt-val">${statusLabel}</span></div>`;
  html += `<div class="tt-row"><span class="tt-label">Уровень:</span><span class="tt-val">${levelLabel}</span></div>`;

  tooltip.innerHTML = html;
  tooltip.style.display = 'block';
  moveMatrixTooltip(event);
}

function moveMatrixTooltip(event) {
  const tooltip = document.getElementById('ilu-tooltip');
  if (!tooltip) return;

  const xOffset = 15;
  const yOffset = 15;

  let left = event.clientX + xOffset;
  let top = event.clientY + yOffset;

  const rect = tooltip.getBoundingClientRect();
  if (left + rect.width > window.innerWidth) left = event.clientX - rect.width - xOffset;
  if (top + rect.height > window.innerHeight) top = event.clientY - rect.height - yOffset;

  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
}

function hideMatrixTooltip() {
  const tooltip = document.getElementById('ilu-tooltip');
  if (tooltip) tooltip.style.display = 'none';
}