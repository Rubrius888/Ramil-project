// ======================== КРОСС-УЧАСТКОВЫЙ АНАЛИЗ ========================

let crossSectionSortBy = 'name';
let crossSectionSortDir = 'asc';

function initCrossSelectors() {
  const deptSel = document.getElementById('crossDept');
  const wsSel = document.getElementById('crossWorkshop');
  const shiftSel = document.getElementById('crossShift');
  if (!deptSel || !wsSel || !shiftSel) return;

  const depts = getDepartments();
  deptSel.innerHTML = depts.map(d =>
    `<option value="${escapeHtml(d)}" ${d === getCurrentDepartment() ? 'selected' : ''}>${escapeHtml(d)}</option>`
  ).join('');

  const curDept = deptSel.value || getCurrentDepartment();
  const workshops = getWorkshops(curDept);
  wsSel.innerHTML = workshops.length
    ? workshops.map(w => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join('')
    : '<option value="">— нет —</option>';

  shiftSel.value = getCurrentShift();
}

function renderCrossSection() {
  const deptSel = document.getElementById('crossDept');
  const wsSel = document.getElementById('crossWorkshop');
  const shiftSel = document.getElementById('crossShift');
  const cont = document.getElementById('crossSectionContent');
  if (!cont) return;

  if (!deptSel || !deptSel.options.length) {
    initCrossSelectors();
  }

  const curDept = deptSel.value;
  const curWs = wsSel.value;
  const workshops = getWorkshops(curDept);
  const needRebuild = wsSel.options.length !== workshops.length ||
    (workshops.length && wsSel.options[0]?.value !== workshops[0]);
  if (needRebuild) {
    wsSel.innerHTML = workshops.length
      ? workshops.map(w => `<option value="${escapeHtml(w)}" ${w === curWs ? 'selected' : ''}>${escapeHtml(w)}</option>`).join('')
      : '<option value="">— нет —</option>';
  }

  const dept = deptSel.value;
  const workshop = wsSel.value;
  const shift = shiftSel.value;
  const norms = getNorms();
  const sections = getSectionsByFilter(dept, workshop);
  const today = formatDate();

  if (sections.length === 0) {
    cont.innerHTML = '<div class="matrix-container" style="padding:40px;text-align:center;color:#94a3b8;">Нет участков</div>';
    return;
  }

  const rows = sections.map(section => {
    const m = computeSectionMetrics(section, shift, today);
    const problems = [];
    if (m.pctU < norms.coverageU) problems.push('U');
    if (m.pct2L < norms.poly2L) problems.push('2L');
    if (m.pct3L < norms.poly3L) problems.push('3L');
    if (m.pctAtt < norms.attendance) problems.push('явка');
    if (m.postsFree > 0) problems.push('свободно ' + m.postsFree);
    if (m.operators < m.posts * norms.minOpsPerPost && m.posts > 0) problems.push('мало');

    return {
      id: section.id,
      name: section.name,
      department: section.department,
      workshop: section.workshop,
      operators: m.operators,
      posts: m.posts,
      present: m.present,
      pctAtt: m.pctAtt,
      postsWithU: m.postsWithU,
      pctU: m.pctU,
      pct2L: m.pct2L,
      pct3L: m.pct3L,
      pctFill: m.pctFill,
      problems
    };
  });

  rows.sort((a, b) => {
    let va = a[crossSectionSortBy];
    let vb = b[crossSectionSortBy];
    if (typeof va === 'string') {
      const cmp = va.localeCompare(vb);
      return crossSectionSortDir === 'asc' ? cmp : -cmp;
    }
    return crossSectionSortDir === 'asc' ? va - vb : vb - va;
  });

  const sortArrow = (key) => crossSectionSortBy === key ? (crossSectionSortDir === 'asc' ? ' ▲' : ' ▼') : '';

  const totalOps = rows.reduce((s, r) => s + r.operators, 0);
  const totalPosts = rows.reduce((s, r) => s + r.posts, 0);

  let html = `
    <div class="cross-summary">
      <div class="cross-summary-item">
        <div class="cross-summary-label">Участков</div>
        <div class="cross-summary-value">${rows.length}</div>
      </div>
      <div class="cross-summary-item">
        <div class="cross-summary-label">Операторов всего</div>
        <div class="cross-summary-value">${totalOps}</div>
      </div>
      <div class="cross-summary-item">
        <div class="cross-summary-label">Постов всего</div>
        <div class="cross-summary-value">${totalPosts}</div>
      </div>
      <div class="cross-summary-item">
        <div class="cross-summary-label">Проблемных</div>
        <div class="cross-summary-value" style="color:#ef4444;">${rows.filter(r => r.problems.length > 0).length}</div>
      </div>
    </div>

    <div class="matrix-container" style="overflow-x:auto;">
      <table class="cross-table">
        <thead>
          <tr>
            <th style="cursor:pointer;" onclick="crossSectionSort('name')">Участок${sortArrow('name')}</th>
            <th style="cursor:pointer;" onclick="crossSectionSort('operators')">👥 Операторов${sortArrow('operators')}</th>
            <th style="cursor:pointer;" onclick="crossSectionSort('posts')">📍 Постов${sortArrow('posts')}</th>
            <th style="cursor:pointer;" onclick="crossSectionSort('pctAtt')">✅ Явка %${sortArrow('pctAtt')}</th>
            <th style="cursor:pointer;" onclick="crossSectionSort('pctFill')">🚦 Загрузка %${sortArrow('pctFill')}</th>
            <th style="cursor:pointer;" onclick="crossSectionSort('pctU')">🎯 U %${sortArrow('pctU')}</th>
            <th style="cursor:pointer;" onclick="crossSectionSort('pct2L')">📊 2L %${sortArrow('pct2L')}</th>
            <th style="cursor:pointer;" onclick="crossSectionSort('pct3L')">📊 3L %${sortArrow('pct3L')}</th>
            <th>Проблемы</th>
          </tr>
        </thead>
        <tbody>
  `;

  rows.forEach(r => {
    const colorAtt = r.pctAtt >= norms.attendance ? 'green' : r.pctAtt >= 50 ? 'yellow' : 'red';
    const colorU = r.pctU >= norms.coverageU ? 'green' : r.pctU >= 50 ? 'yellow' : 'red';
    const color2L = r.pct2L >= norms.poly2L ? 'green' : r.pct2L >= 40 ? 'yellow' : 'red';
    const color3L = r.pct3L >= norms.poly3L ? 'green' : r.pct3L >= 30 ? 'yellow' : 'red';
    const colorFill = r.pctFill >= 90 ? 'green' : r.pctFill >= 70 ? 'yellow' : 'red';

    html += `<tr onclick="openSectionFromDashboard('${escapeAttr(r.id)}')" style="cursor:pointer;">`;
    html += `<td style="text-align:left;font-weight:600;">${escapeHtml(r.name)}</td>`;
    html += `<td>${r.operators}</td>`;
    html += `<td>${r.posts}</td>`;
    html += `<td class="dash-color-${colorAtt}">${r.pctAtt}%</td>`;
    html += `<td class="dash-color-${colorFill}">${r.pctFill}%</td>`;
    html += `<td class="dash-color-${colorU}">${r.pctU}%</td>`;
    html += `<td class="dash-color-${color2L}">${r.pct2L}%</td>`;
    html += `<td class="dash-color-${color3L}">${r.pct3L}%</td>`;
    html += '<td style="text-align:left;font-size:11px;">';
    if (r.problems.length === 0) html += '<span style="color:#16a34a;">✅</span>';
    else html += r.problems.map(p => `<span class="cross-problem">${escapeHtml(p)}</span>`).join(' ');
    html += '</td>';
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  cont.innerHTML = html;
}

function crossSectionSort(key) {
  if (crossSectionSortBy === key) {
    crossSectionSortDir = crossSectionSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    crossSectionSortBy = key;
    crossSectionSortDir = 'asc';
  }
  renderCrossSection();
}

function exportCrossSection() {
  if (typeof XLSX === 'undefined') { alert('Библиотека XLSX не загружена'); return; }
  const deptSel = document.getElementById('crossDept');
  const wsSel = document.getElementById('crossWorkshop');
  const shiftSel = document.getElementById('crossShift');
  if (!deptSel || !wsSel || !shiftSel) return;

  const dept = deptSel.value;
  const workshop = wsSel.value;
  const shift = shiftSel.value;
  const sections = getSectionsByFilter(dept, workshop);
  const today = formatDate();
  const norms = getNorms();

  const rows = [['Участок', 'Департамент', 'Цех', 'Операторов', 'Постов', 'Явка %', 'Загрузка %', 'U %', '2L %', '3L %', 'Проблемы']];

  sections.forEach(section => {
    const m = computeSectionMetrics(section, shift, today);
    const problems = [];
    if (m.pctU < norms.coverageU) problems.push('U');
    if (m.pct2L < norms.poly2L) problems.push('2L');
    if (m.pct3L < norms.poly3L) problems.push('3L');
    if (m.pctAtt < norms.attendance) problems.push('явка');
    if (m.postsFree > 0) problems.push('свободно ' + m.postsFree);

    rows.push([
      section.name, section.department, section.workshop,
      m.operators, m.posts,
      m.pctAtt, m.pctFill, m.pctU, m.pct2L, m.pct3L,
      problems.join(', ')
    ]);
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Участки');
  XLSX.writeFile(wb, `Участки_${dept}_${workshop}_${today.replace(/\./g, '-')}.xlsx`);
  logAudit('export_excel', 'Кросс-участковый анализ', `${dept} / ${workshop}`);
}