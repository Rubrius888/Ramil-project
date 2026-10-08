// ======================== ДЕФЕКТЫ ОПЕРАТОРОВ ========================
// Аналитика дефектов по операторам (на основе доски качества).
//   • Топ операторов (сводка: всего/год/месяц/ДНА/тренд)
//   • Разбивка по типам дефектов (при клике по оператору)
//   • Динамика по неделям (столбчатый график)
//   • Тепловая карта операторов × дни
//   • Экспорт в Excel
//
// Данные читаются из qualityBoard.operators (новая модель).

console.log('[quality-operators.js] Загружен');

let _qoSelectedOpKey = null;  // id оператора в qualityBoard.operators
let _qoSortBy = 'totalYear';
let _qoSortDir = 'desc';

// ==================== СБОР ДАННЫХ ====================

function qoCollectOperators() {
  const board = getQualityBoard();
  const struct = getBoardStructure();
  const boardDays = struct.boardDays;

  const currentWeekKeys = boardDays.filter(d => !d.isPrev).map(d => d.key);
  const prevWeekKey = boardDays.find(d => d.isPrev)?.key || null;

  let weekCars = 0;
  boardDays.forEach(d => { weekCars += getCars(d.key); });

  const today = new Date();
  const dow = today.getDay();
  const daysToMonday = (dow === 0 ? -6 : 1 - dow);
  const mondayThis = new Date(today);
  mondayThis.setDate(today.getDate() + daysToMonday);
  const mondayPrev = new Date(mondayThis);
  mondayPrev.setDate(mondayThis.getDate() - 7);

  let prevWeekCars = 0;
  for (let i = 0; i < 5; i++) {
    const d = new Date(mondayPrev);
    d.setDate(mondayPrev.getDate() + i);
    prevWeekCars += getCars(formatDate(d));
  }

  const rows = board.operators.map(op => {
    const types = [];
    for (let i = 0; i < QUALITY_DAY_COLUMNS; i++) {
      let yearSum = 0, monthSum = 0, weekSum = 0;

      Object.keys(op.defects).forEach(key => {
        if (key === PREV_WEEK_KEY) return;
        const d = parseDate(key);
        if (!d) return;
        const arr = op.defects[key];
        if (!Array.isArray(arr)) return;
        const v = parseInt(arr[i]) || 0;
        if (d.getFullYear() === today.getFullYear()) yearSum += v;
        if (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth()) monthSum += v;
      });

      currentWeekKeys.forEach(k => {
        const arr = op.defects[k];
        if (!Array.isArray(arr)) return;
        weekSum += (parseInt(arr[i]) || 0);
      });

      types.push({
        key: QUALITY_DAY_COLUMNS_LABELS[i],
        year: yearSum,
        month: monthSum,
        week: weekSum,
      });
    }

    const totalYear = types.reduce((s, t) => s + t.year, 0);
    const totalMonth = types.reduce((s, t) => s + t.month, 0);
    const totalWeek = types.reduce((s, t) => s + t.week, 0);

    const dnaWeek = weekCars > 0 ? (totalWeek / weekCars) : 0;

    let prevWeekDefects = 0;
    if (prevWeekKey) {
      const arr = op.defects[prevWeekKey];
      if (Array.isArray(arr)) {
        prevWeekDefects = arr.reduce((s, v) => s + (parseInt(v) || 0), 0);
      }
    }
    const dnaPrev = prevWeekCars > 0 ? (prevWeekDefects / prevWeekCars) : 0;
    const trend = dnaWeek - dnaPrev;

    // Название поста, если указан
    const postName = op.postId
      ? (getQualityAvailablePosts().find(p => p.id === op.postId)?.name || '')
      : '';

    return {
      opEntry: op,
      opKey: op.id,
      opName: op.name,
      postName,
      totalYear,
      totalMonth,
      totalWeek,
      dnaWeek,
      dnaPrev,
      trend,
      types,
    };
  });

  return rows;
}

// ==================== UI: РЕНДЕР ====================

function renderQualityRisks() {
  const cont = document.getElementById('qualityRisks');
  if (!cont) return;

  const rows = qoCollectOperators();

  rows.sort((a, b) => {
    let va = a[_qoSortBy], vb = b[_qoSortBy];
    if (_qoSortBy === 'name') {
      va = a.opName; vb = b.opName;
    }
    if (typeof va === 'string') {
      const cmp = va.localeCompare(vb);
      return _qoSortDir === 'asc' ? cmp : -cmp;
    }
    return _qoSortDir === 'asc' ? va - vb : vb - va;
  });

  const totals = {
    year: rows.reduce((s, r) => s + r.totalYear, 0),
    month: rows.reduce((s, r) => s + r.totalMonth, 0),
    week: rows.reduce((s, r) => s + r.totalWeek, 0),
  };

  let html = '';

  // ---------- Блок 1: Топ операторов ----------
  html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;overflow-x:auto;margin-bottom:16px;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;">';
  html += '<div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#64748b;">👥 ДЕФЕКТЫ ОПЕРАТОРОВ</div>';
  html += '<div style="display:flex;gap:6px;align-items:center;">';
  html += '<span style="font-size:10px;color:#64748b;">Сортировка:</span>';
  html += `<select onchange="qoSetSort(this.value)" style="padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:11px;">`;
  const sortOptions = [
    ['totalYear', 'Всего (год)'],
    ['totalMonth', 'За месяц'],
    ['totalWeek', 'За неделю'],
    ['dnaWeek', 'ДНА недели'],
    ['trend', 'Тренд'],
    ['name', 'Имя оператора'],
  ];
  sortOptions.forEach(([v, l]) => {
    html += `<option value="${v}" ${_qoSortBy === v ? 'selected' : ''}>${l}</option>`;
  });
  html += '</select>';
  html += `<button class="btn-small" style="font-size:11px;padding:3px 8px;" onclick="qoToggleSortDir()">${_qoSortDir === 'asc' ? '↑' : '↓'}</button>`;
  html += `<button class="btn-small" style="font-size:11px;padding:3px 8px;background:#16a34a;color:#fff;border-color:#16a34a;margin-left:8px;" onclick="qoExportExcel()" title="Экспорт в Excel">📤 Excel</button>`;
  html += '</div></div>';

  if (rows.length === 0) {
    html += '<div style="padding:40px;text-align:center;color:#94a3b8;">Нет операторов в текущей смене.</div>';
  } else {
    html += `<table class="quality-board-table" style="width:100%;border-collapse:collapse;font-size:11px;min-width:1000px;">`;
    html += '<thead>';
    html += '<tr style="background:#f1f5f9;">';
    html += '<th style="padding:6px 6px;border:1px solid #cbd5e1;width:36px;text-align:center;">#</th>';
    html += '<th style="padding:6px 6px;border:1px solid #cbd5e1;text-align:left;min-width:150px;">Оператор</th>';
    html += '<th style="padding:6px 6px;border:1px solid #cbd5e1;text-align:left;min-width:120px;">Пост</th>';
    html += '<th style="padding:6px 6px;border:1px solid #cbd5e1;text-align:center;width:80px;">Всего<br><small style="font-weight:400;font-size:9px;color:#64748b;">год</small></th>';
    html += '<th style="padding:6px 6px;border:1px solid #cbd5e1;text-align:center;width:80px;">За месяц</th>';
    html += '<th style="padding:6px 6px;border:1px solid #cbd5e1;text-align:center;width:80px;">За неделю</th>';
    html += '<th style="padding:6px 6px;border:1px solid #cbd5e1;text-align:center;width:80px;">ДНА<br><small style="font-weight:400;font-size:9px;color:#64748b;">недели</small></th>';
    html += '<th style="padding:6px 6px;border:1px solid #cbd5e1;text-align:center;width:70px;">Тренд</th>';
    html += '<th style="padding:6px 6px;border:1px solid #cbd5e1;text-align:center;width:70px;"></th>';
    html += '</tr>';
    html += '</thead><tbody>';

    rows.forEach((r, idx) => {
      const isSelected = _qoSelectedOpKey === r.opKey;
      const bgSel = isSelected ? 'background:#eff6ff;' : '';
      const trendColor = r.trend > 0 ? '#ef4444' : r.trend < 0 ? '#16a34a' : '#94a3b8';
      const trendIcon = r.trend > 0 ? '▲' : r.trend < 0 ? '▼' : '—';
      const trendVal = Math.abs(r.trend).toFixed(2);
      const dnaColor = r.dnaWeek >= 0.1 ? '#ef4444' : r.dnaWeek >= 0.05 ? '#f59e0b' : '#16a34a';

      html += `<tr style="${bgSel}cursor:pointer;" onclick="qoSelectOperator('${escapeAttr(r.opKey)}')">`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:center;font-weight:600;">${idx + 1}</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;font-weight:600;">${escapeHtml(r.opName)}</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;color:#64748b;">${escapeHtml(r.postName || '—')}</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:center;font-weight:700;">${r.totalYear || ''}</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:center;">${r.totalMonth || ''}</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:center;">${r.totalWeek || ''}</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:center;font-weight:700;color:${dnaColor};">${r.dnaWeek.toFixed(2)}</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:center;font-weight:700;color:${trendColor};">${trendIcon} ${trendVal}</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:center;">${isSelected ? '▼' : '▶'}</td>`;
      html += `</tr>`;

      if (isSelected) {
        html += `<tr style="background:#f8fafc;"><td colspan="9" style="padding:8px 10px;border:1px solid #cbd5e1;">`;

        if (r.postName) {
          html += `<div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:6px;">Пост оператора:</div>`;
          html += `<div style="margin-bottom:10px;"><span style="display:inline-block;padding:3px 8px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:4px;font-size:11px;font-weight:600;color:#1e40af;">${escapeHtml(r.postName)}</span></div>`;
        }

        html += `<div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:6px;">Разбивка по типам дефектов</div>`;
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;">';
        r.types.forEach(t => {
          const color = QUALITY_COLORS[t.key] || '#64748b';
          const pct = r.totalYear > 0 ? Math.round((t.year / r.totalYear) * 100) : 0;
          html += `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;border-left:4px solid ${color};">`;
          html += `<div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;">${escapeHtml(t.key)}</div>`;
          html += `<div style="font-size:18px;font-weight:800;color:${color};margin-top:2px;">${t.year}</div>`;
          html += `<div style="font-size:10px;color:#94a3b8;">${pct}% от общего</div>`;
          html += `</div>`;
        });
        html += '</div>';
        html += `</td></tr>`;
      }
    });

    // Итоговая строка
    html += '<tr style="background:#e2e8f0;font-weight:800;">';
    html += '<td colspan="3" style="padding:6px 6px;border:1px solid #cbd5e1;text-align:right;">ИТОГО:</td>';
    html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:center;">${totals.year || ''}</td>`;
    html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:center;">${totals.month || ''}</td>`;
    html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:center;">${totals.week || ''}</td>`;
    html += '<td style="padding:5px 6px;border:1px solid #cbd5e1;"></td>';
    html += '<td style="padding:5px 6px;border:1px solid #cbd5e1;"></td>';
    html += '<td style="padding:5px 6px;border:1px solid #cbd5e1;"></td>';
    html += '</tr>';

    html += '</tbody></table>';
  }
  html += '</div>';

  // ---------- Блок 2: Динамика выбранного оператора ----------
  if (_qoSelectedOpKey) {
    const selected = rows.find(r => r.opKey === _qoSelectedOpKey);
    if (selected) {
      html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:16px;">';
      html += `<div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:8px;">📈 ДИНАМИКА ПО НЕДЕЛЯМ — ${escapeHtml(selected.opName)}</div>`;
      html += qoRenderDynamicsChart(selected.opEntry);
      html += '</div>';
    }
  }

  // ---------- Блок 3: Тепловая карта ----------
  html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;overflow-x:auto;">';
  html += '<div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:8px;">🔥 ТЕПЛОВАЯ КАРТА — ОПЕРАТОРЫ × ДНИ (ДНА)</div>';
  html += qoRenderHeatmap();
  html += '</div>';

  cont.innerHTML = html;
}

// ==================== ГРАФИК ДИНАМИКИ ПО НЕДЕЛЯМ ====================

function qoRenderDynamicsChart(opEntry) {
  const struct = getBoardStructure();
  const weekKeys = struct.weekKeys;
  const boardDays = struct.boardDays;
  const currentWeekKeys = boardDays.filter(d => !d.isPrev).map(d => d.key);

  const xLabels = weekKeys.map(w => ({
    label: w.label,
    sub: `${w.mondayDate.slice(0, 5)}–${w.fridayDate.slice(0, 5)}`,
  }));
  const mondayThis = boardDays.find(d => !d.isPrev);
  xLabels.push({
    label: 'Текущая',
    sub: mondayThis ? mondayThis.subLabel : '',
  });

  const values = [];
  weekKeys.forEach(w => {
    let def = 0, cars = 0;
    w.dates.forEach(date => {
      const arr = opEntry.defects[date];
      if (Array.isArray(arr)) def += arr.reduce((s, v) => s + (parseInt(v) || 0), 0);
      cars += getCars(date);
    });
    values.push(cars > 0 ? def / cars : 0);
  });
  {
    let def = 0, cars = 0;
    currentWeekKeys.forEach(date => {
      const arr = opEntry.defects[date];
      if (Array.isArray(arr)) def += arr.reduce((s, v) => s + (parseInt(v) || 0), 0);
      cars += getCars(date);
    });
    values.push(cars > 0 ? def / cars : 0);
  }

  const W = 700, H = 280;
  const PAD_L = 55, PAD_R = 10, PAD_T = 30, PAD_B = 50;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  let maxVal = 0.001;
  values.forEach(v => { if (v > maxVal) maxVal = v; });
  maxVal *= 1.2;

  let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;max-height:300px;display:block;">`;

  for (let i = 0; i <= 4; i++) {
    const val = (maxVal / 4) * i;
    const y = PAD_T + innerH - (val / maxVal) * innerH;
    svg += `<line x1="${PAD_L}" y1="${y}" x2="${PAD_L + innerW}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>`;
    svg += `<text x="${PAD_L - 6}" y="${y + 3}" text-anchor="end" font-size="9" fill="#94a3b8">${val.toFixed(2)}</text>`;
  }

  const n = values.length;
  const groupWidth = innerW / n;
  const barWidth = Math.max(20, groupWidth * 0.55);

  values.forEach((v, i) => {
    const groupCenter = PAD_L + i * groupWidth + groupWidth / 2;
    const barX = groupCenter - barWidth / 2;
    const barH = (v / maxVal) * innerH;
    const barY = PAD_T + innerH - barH;
    const color = i === n - 1 ? '#8b5cf6' : '#a78bfa';

    svg += `<rect x="${barX}" y="${barY}" width="${barWidth}" height="${barH}" fill="${color}" rx="2"/>`;
    if (v > 0) {
      svg += `<text x="${groupCenter}" y="${barY - 4}" text-anchor="middle" font-size="10" font-weight="700" fill="#334155">${v.toFixed(2)}</text>`;
    }

    const xl = xLabels[i];
    svg += `<text x="${groupCenter}" y="${H - 30}" text-anchor="middle" font-size="10" font-weight="700" fill="#334155">${escapeHtml(xl.label)}</text>`;
    if (xl.sub) {
      svg += `<text x="${groupCenter}" y="${H - 16}" text-anchor="middle" font-size="8" fill="#94a3b8">${escapeHtml(xl.sub)}</text>`;
    }
  });

  svg += `<text x="${W/2}" y="18" text-anchor="middle" font-size="12" font-weight="700" fill="#334155">ДНА по неделям</text>`;
  svg += '</svg>';

  return svg;
}

// ==================== ТЕПЛОВАЯ КАРТА ====================

function qoRenderHeatmap() {
  const board = getQualityBoard();
  const struct = getBoardStructure();
  const boardDays = struct.boardDays;

  if (board.operators.length === 0) {
    return '<div style="padding:20px;text-align:center;color:#94a3b8;">Нет данных.</div>';
  }

  let maxVal = 0.001;
  board.operators.forEach(op => {
    boardDays.forEach(day => {
      const arr = op.defects[day.key];
      const def = Array.isArray(arr) ? arr.reduce((s, v) => s + (parseInt(v) || 0), 0) : 0;
      const cars = getCars(day.key);
      const dna = cars > 0 ? def / cars : 0;
      if (dna > maxVal) maxVal = dna;
    });
  });

  let html = '<table class="quality-board-table" style="width:100%;border-collapse:collapse;font-size:10px;min-width:700px;">';
  html += '<thead><tr style="background:#f1f5f9;">';
  html += '<th style="padding:4px 6px;border:1px solid #cbd5e1;text-align:left;min-width:150px;">Оператор</th>';
  boardDays.forEach(day => {
    const bg = day.isPrev ? '#fef3c7' : '';
    html += `<th style="padding:4px 4px;border:1px solid #cbd5e1;text-align:center;background:${bg};min-width:50px;">${day.label}<br><small style="font-weight:400;font-size:8px;color:#64748b;">${escapeHtml(day.subLabel)}</small></th>`;
  });
  html += '</tr></thead><tbody>';

  board.operators.forEach(op => {
    html += '<tr>';
    html += `<td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:600;">${escapeHtml(op.name)}</td>`;
    boardDays.forEach(day => {
      const arr = op.defects[day.key];
      const def = Array.isArray(arr) ? arr.reduce((s, v) => s + (parseInt(v) || 0), 0) : 0;
      const cars = getCars(day.key);
      const dna = cars > 0 ? def / cars : 0;
      const ratio = maxVal > 0 ? dna / maxVal : 0;
      const bg = qoHeatColor(ratio);
      const txtColor = ratio > 0.5 ? '#fff' : '#1e293b';
      html += `<td style="padding:4px 4px;border:1px solid #cbd5e1;text-align:center;background:${bg};color:${txtColor};font-weight:700;">${dna.toFixed(2)}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  return html;
}

function qoHeatColor(ratio) {
  if (ratio <= 0) return '#f1f5f9';
  const r = Math.round(187 + (254 - 187) * ratio);
  const g = Math.round(247 + (202 - 247) * ratio);
  const b = Math.round(208 + (202 - 208) * ratio);
  return `rgb(${r},${g},${b})`;
}

// ==================== ВЗАИМОДЕЙСТВИЕ ====================

function qoSelectOperator(opKey) {
  if (_qoSelectedOpKey === opKey) {
    _qoSelectedOpKey = null;
  } else {
    _qoSelectedOpKey = opKey;
  }
  renderQualityRisks();
}

function qoSetSort(field) {
  _qoSortBy = field;
  renderQualityRisks();
}

function qoToggleSortDir() {
  _qoSortDir = _qoSortDir === 'asc' ? 'desc' : 'asc';
  renderQualityRisks();
}

// ==================== ЭКСПОРТ В EXCEL ====================

function qoExportExcel() {
  if (typeof XLSX === 'undefined') {
    alert('Библиотека XLSX не загружена');
    return;
  }

  const wb = XLSX.utils.book_new();
  const rows = qoCollectOperators();
  const struct = getBoardStructure();
  const boardDays = struct.boardDays;
  const weekKeys = struct.weekKeys;

  // ---- Лист 1: Сводка по операторам ----
  const summaryRows = [[
    '#', 'Оператор', 'Пост',
    'Всего (год)', 'За месяц', 'За неделю',
    'ДНА (неделя)', 'ДНА (прошлая)', 'Тренд'
  ]];

  rows.forEach((r, i) => {
    summaryRows.push([
      i + 1,
      r.opName,
      r.postName || '',
      r.totalYear,
      r.totalMonth,
      r.totalWeek,
      parseFloat(r.dnaWeek.toFixed(3)),
      parseFloat(r.dnaPrev.toFixed(3)),
      parseFloat(r.trend.toFixed(3)),
    ]);
  });

  const totals = {
    year:  rows.reduce((s, r) => s + r.totalYear, 0),
    month: rows.reduce((s, r) => s + r.totalMonth, 0),
    week:  rows.reduce((s, r) => s + r.totalWeek, 0),
  };
  summaryRows.push([]);
  summaryRows.push(['ИТОГО', '', '', totals.year, totals.month, totals.week, '', '', '']);

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(summaryRows),
    'Сводка по операторам'
  );

  // ---- Лист 2: Разбивка по типам ----
  const typesHeader = ['#', 'Оператор'];
  QUALITY_DAY_COLUMNS_LABELS.forEach(lbl => {
    typesHeader.push(`${lbl} (год)`);
    typesHeader.push(`${lbl} (мес.)`);
    typesHeader.push(`${lbl} (нед.)`);
  });
  typesHeader.push('Всего (год)');

  const typesRows = [typesHeader];

  rows.forEach((r, i) => {
    const row = [i + 1, r.opName];
    r.types.forEach(t => {
      row.push(t.year);
      row.push(t.month);
      row.push(t.week);
    });
    row.push(r.totalYear);
    typesRows.push(row);
  });

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(typesRows),
    'Разбивка по типам'
  );

  // ---- Лист 3: Пост оператора ----
  const postsHeader = ['#', 'Оператор', 'Пост'];
  const postsRows = [postsHeader];

  rows.forEach((r, i) => {
    postsRows.push([
      i + 1,
      r.opName,
      r.postName || '',
    ]);
  });

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(postsRows),
    'Пост оператора'
  );

  // ---- Лист 4: Динамика по неделям (ДНА) ----
  const dynHeader = ['#', 'Оператор'];
  weekKeys.forEach(wk => {
    dynHeader.push(`${wk.label} (${wk.mondayDate.slice(0,5)}–${wk.fridayDate.slice(0,5)})`);
  });
  dynHeader.push('Текущая неделя');

  const dynRows = [dynHeader];

  rows.forEach((r, i) => {
    const row = [i + 1, r.opName];

    weekKeys.forEach(wk => {
      let def = 0, cars = 0;
      wk.dates.forEach(date => {
        const arr = r.opEntry.defects[date];
        if (Array.isArray(arr)) def += arr.reduce((s, v) => s + (parseInt(v) || 0), 0);
        cars += getCars(date);
      });
      row.push(cars > 0 ? parseFloat((def / cars).toFixed(3)) : 0);
    });

    {
      let def = 0, cars = 0;
      boardDays.filter(d => !d.isPrev).forEach(d => {
        const arr = r.opEntry.defects[d.key];
        if (Array.isArray(arr)) def += arr.reduce((s, v) => s + (parseInt(v) || 0), 0);
        cars += getCars(d.key);
      });
      row.push(cars > 0 ? parseFloat((def / cars).toFixed(3)) : 0);
    }

    dynRows.push(row);
  });

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(dynRows),
    'Динамика по неделям'
  );

  // ---- Лист 5: Тепловая карта ----
  const heatHeader = ['Оператор'];
  boardDays.forEach(day => {
    heatHeader.push(`${day.label} (${day.subLabel})`);
  });
  heatHeader.push('Всего');

  const heatRows = [heatHeader];

  rows.forEach(r => {
    const row = [r.opName];
    let totalDNA = 0;
    boardDays.forEach(day => {
      const arr = r.opEntry.defects[day.key];
      const def = Array.isArray(arr) ? arr.reduce((s, v) => s + (parseInt(v) || 0), 0) : 0;
      const cars = getCars(day.key);
      const dna = cars > 0 ? def / cars : 0;
      row.push(parseFloat(dna.toFixed(3)));
      totalDNA += dna;
    });
    row.push(parseFloat(totalDNA.toFixed(3)));
    heatRows.push(row);
  });

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(heatRows),
    'Тепловая карта'
  );

  // ---- Сохранение ----
  const sectionName = getCurrentSection().name;
  const dateStr = formatDate().replace(/\./g, '-');
  XLSX.writeFile(wb, `Дефекты_операторов_${sectionName}_${dateStr}.xlsx`);

  if (typeof logAudit === 'function') {
    logAudit('export_excel', 'Дефекты операторов', sectionName);
  }
}

// ==================== ЭКСПОРТ В WINDOW ====================

window.qualityOperators = {
  render: renderQualityRisks,
  selectOperator: qoSelectOperator,
  setSort: qoSetSort,
  toggleSortDir: qoToggleSortDir,
  collect: qoCollectOperators,
  heatmap: qoRenderHeatmap,
  exportExcel: qoExportExcel,
};