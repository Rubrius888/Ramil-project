// ======================== ДИНАМИКА КАЧЕСТВА ========================
console.log('[quality-dynamics.js] Загружен (v2 — топ-10 постов из операторов)');

// ==================== РЕНДЕР ВКЛАДКИ ====================

function renderQualityDynamics() {
  const cont = document.getElementById('qualityDynamics');
  if (!cont) return;

  const struct = getBoardStructure();
  const boardDays = struct.boardDays;
  const weekKeys = struct.weekKeys;
  const board = getQualityBoard();

  const grandYear = getGrandYearTotal();
  const grandMonth = getGrandMonthTotal();

  let weekDefects = 0;
  boardDays.filter(d => !d.isPrev).forEach(d => {
    weekDefects += getDayTotal(d.key);
  });

  let weekCars = 0;
  boardDays.forEach(d => { weekCars += getCars(d.key); });
  const weekDNA = weekCars > 0 ? weekDefects / weekCars : 0;

  let html = '';

  // KPI
  html += `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:16px;">
      <div style="background:#dbeafe;border-radius:10px;padding:12px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:#3b82f6;">${grandYear}</div>
        <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;">Дефектов за год</div>
      </div>
      <div style="background:#dcfce7;border-radius:10px;padding:12px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:#16a34a;">${grandMonth}</div>
        <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;">За месяц</div>
      </div>
      <div style="background:#fef3c7;border-radius:10px;padding:12px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:#f59e0b;">${weekDefects}</div>
        <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;">За неделю</div>
      </div>
      <div style="background:#e0e7ff;border-radius:10px;padding:12px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:#4338ca;">${weekDNA.toFixed(3)}</div>
        <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;">ДНА недели</div>
      </div>
      <div style="background:#f1f5f9;border-radius:10px;padding:12px;text-align:center;">
        <div style="font-size:24px;font-weight:800;">${weekCars}</div>
        <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;">Авто за неделю</div>
      </div>
    </div>
  `;

  // График 1: по неделям
  html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:16px;">';
  html += '<div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:8px;">📈 ДИНАМИКА ПО НЕДЕЛЯМ (ДНА)</div>';
  html += qdRenderWeeklyChart(weekKeys, boardDays);
  html += '</div>';

  // График 2: по дням
  html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:16px;">';
  html += '<div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:8px;">📈 ДИНАМИКА ПО ДНЯМ (ДНА)</div>';
  html += qdRenderDailyChart(boardDays);
  html += '</div>';

  // График 3 + 4: топ постов/операторов
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">';

  html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;">';
  html += '<div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:8px;">🔝 ТОП-10 ПОСТОВ (за год)</div>';
  html += qdRenderTopPosts();
  html += '</div>';

  html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;">';
  html += '<div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:8px;">🔝 ТОП-10 ОПЕРАТОРОВ (за год)</div>';
  html += qdRenderTopOperators();
  html += '</div>';

  html += '</div>';

  // График 5: разбивка по типам
  html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:16px;">';
  html += '<div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:8px;">📊 РАЗБИВКА ПО ТИПАМ ДЕФЕКТОВ (за год)</div>';
  html += qdRenderTypesChart();
  html += '</div>';

  // Таблица трендов
  html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;">';
  html += '<div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:8px;">📉 ТРЕНДЫ (текущая неделя к прошлой)</div>';
  html += qdRenderTrends();
  html += '</div>';

  cont.innerHTML = html;
}

// ==================== ГРАФИКИ ====================

function qdRenderWeeklyChart(weekKeys, boardDays) {
  const currentWeekKeys = boardDays.filter(d => !d.isPrev).map(d => d.key);

  const xLabels = weekKeys.map(w => ({
    label: w.label,
    sub: `${w.mondayDate.slice(0, 5)}–${w.fridayDate.slice(0, 5)}`,
  }));
  xLabels.push({
    label: 'Текущая',
    sub: boardDays.find(d => !d.isPrev)?.subLabel || '',
  });

  const values = [];
  weekKeys.forEach(w => {
    let def = 0, cars = 0;
    w.dates.forEach(date => {
      def += getDayTotal(date);
      cars += getCars(date);
    });
    values.push(cars > 0 ? def / cars : 0);
  });
  {
    let def = 0, cars = 0;
    currentWeekKeys.forEach(date => {
      def += getDayTotal(date);
      cars += getCars(date);
    });
    values.push(cars > 0 ? def / cars : 0);
  }

  return qdBuildBarsChart(xLabels, values, '#3b82f6');
}

function qdRenderDailyChart(boardDays) {
  const xLabels = boardDays.map(d => ({
    label: d.label,
    sub: d.subLabel,
  }));

  const values = boardDays.map(d => {
    const def = getDayTotal(d.key);
    const cars = getCars(d.key);
    return cars > 0 ? def / cars : 0;
  });

  return qdBuildBarsChart(xLabels, values, '#f59e0b');
}

function qdBuildBarsChart(xLabels, values, color) {
  const W = 1000, H = 300;
  const PAD_L = 60, PAD_R = 20, PAD_T = 30, PAD_B = 55;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  let maxVal = 0.001;
  values.forEach(v => { if (v > maxVal) maxVal = v; });
  maxVal *= 1.2;

  let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;max-height:320px;display:block;">`;

  for (let i = 0; i <= 4; i++) {
    const val = (maxVal / 4) * i;
    const y = PAD_T + innerH - (val / maxVal) * innerH;
    svg += `<line x1="${PAD_L}" y1="${y}" x2="${PAD_L + innerW}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>`;
    svg += `<text x="${PAD_L - 6}" y="${y + 3}" text-anchor="end" font-size="10" fill="#94a3b8">${val.toFixed(2)}</text>`;
  }

  const n = values.length;
  const groupWidth = innerW / n;
  const barWidth = Math.max(14, groupWidth * 0.55);

  values.forEach((v, i) => {
    const groupCenter = PAD_L + i * groupWidth + groupWidth / 2;
    const barX = groupCenter - barWidth / 2;
    const barH = (v / maxVal) * innerH;
    const barY = PAD_T + innerH - barH;
    const c = i === n - 1 ? color : '#cbd5e1';

    svg += `<rect x="${barX}" y="${barY}" width="${barWidth}" height="${barH}" fill="${c}" rx="2"/>`;
    if (v > 0) {
      svg += `<text x="${groupCenter}" y="${barY - 4}" text-anchor="middle" font-size="10" font-weight="700" fill="#334155">${v.toFixed(2)}</text>`;
    }

    const xl = xLabels[i];
    svg += `<text x="${groupCenter}" y="${H - 30}" text-anchor="middle" font-size="11" font-weight="700" fill="#334155">${escapeHtml(xl.label)}</text>`;
    if (xl.sub) {
      svg += `<text x="${groupCenter}" y="${H - 15}" text-anchor="middle" font-size="9" fill="#94a3b8">${escapeHtml(xl.sub)}</text>`;
    }
  });

  svg += '</svg>';
  return svg;
}

// ==================== ТОП-10 ПОСТОВ (из операторов) ====================

function qdRenderTopPosts() {
  const board = getQualityBoard();
  const today = new Date();
  const year = today.getFullYear();

  // Группируем операторов по postId
  const postsMap = new Map();
  board.operators.forEach(op => {
    if (!op.postId) return;
    if (!postsMap.has(op.postId)) postsMap.set(op.postId, []);
    postsMap.get(op.postId).push(op);
  });

  const rows = [];
  postsMap.forEach((operators, postId) => {
    const postInfo = getQualityAvailablePosts().find(p => p.id === postId);
    const postName = postInfo ? postInfo.name : '—';

    let total = 0;
    operators.forEach(op => {
      Object.keys(op.defects).forEach(key => {
        if (key === PREV_WEEK_KEY) return;
        const d = parseDate(key);
        if (!d || d.getFullYear() !== year) return;
        const arr = op.defects[key];
        if (!Array.isArray(arr)) return;
        arr.forEach(v => { total += (parseInt(v) || 0); });
      });
    });

    if (total > 0) rows.push({ name: postName, total });
  });

  rows.sort((a, b) => b.total - a.total);
  const top = rows.slice(0, 10);

  if (top.length === 0) {
    return '<div style="padding:20px;text-align:center;color:#94a3b8;">Нет данных за год.</div>';
  }

  return qdRenderHorizontalBars(top, '#3b82f6', 'total');
}

// ==================== ТОП-10 ОПЕРАТОРОВ ====================

function qdRenderTopOperators() {
  const board = getQualityBoard();
  const today = new Date();
  const year = today.getFullYear();

  const rows = board.operators.map(op => {
    let total = 0;
    Object.keys(op.defects).forEach(key => {
      if (key === PREV_WEEK_KEY) return;
      const d = parseDate(key);
      if (!d || d.getFullYear() !== year) return;
      const arr = op.defects[key];
      if (!Array.isArray(arr)) return;
      arr.forEach(v => { total += (parseInt(v) || 0); });
    });
    return { name: op.name, total };
  }).filter(r => r.total > 0);

  rows.sort((a, b) => b.total - a.total);
  const top = rows.slice(0, 10);

  if (top.length === 0) {
    return '<div style="padding:20px;text-align:center;color:#94a3b8;">Нет данных за год.</div>';
  }

  return qdRenderHorizontalBars(top, '#8b5cf6', 'total');
}

function qdRenderHorizontalBars(items, color, valueKey) {
  const maxVal = Math.max(...items.map(i => i[valueKey])) || 1;

  let html = '<div style="display:flex;flex-direction:column;gap:6px;">';

  items.forEach(item => {
    const v = item[valueKey];
    const pct = (v / maxVal) * 100;

    html += `<div style="display:grid;grid-template-columns:140px 1fr 50px;gap:8px;align-items:center;font-size:11px;">`;
    html += `<div style="font-weight:600;color:#334155;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>`;
    html += `<div style="position:relative;background:#f1f5f9;border-radius:4px;height:22px;overflow:hidden;">`;
    html += `<div style="position:absolute;left:0;top:0;height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width 0.3s;"></div>`;
    html += `</div>`;
    html += `<div style="font-weight:800;text-align:right;color:${color};">${v}</div>`;
    html += `</div>`;
  });

  html += '</div>';
  return html;
}

// ==================== РАЗБИВКА ПО ТИПАМ ====================

function qdRenderTypesChart() {
  const board = getQualityBoard();
  const today = new Date();
  const year = today.getFullYear();

  const totals = new Array(QUALITY_DAY_COLUMNS).fill(0);

  board.operators.forEach(op => {
    Object.keys(op.defects).forEach(key => {
      if (key === PREV_WEEK_KEY) return;
      const d = parseDate(key);
      if (!d || d.getFullYear() !== year) return;
      const arr = op.defects[key];
      if (!Array.isArray(arr)) return;
      for (let i = 0; i < QUALITY_DAY_COLUMNS; i++) {
        totals[i] += (parseInt(arr[i]) || 0);
      }
    });
  });

  const grand = totals.reduce((s, v) => s + v, 0);

  if (grand === 0) {
    return '<div style="padding:20px;text-align:center;color:#94a3b8;">Нет данных за год.</div>';
  }

  const W = 800, H = 300;
  const PAD_L = 60, PAD_R = 20, PAD_T = 30, PAD_B = 60;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const maxVal = Math.max(...totals) * 1.2 || 1;

  let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;max-height:300px;display:block;">`;

  for (let i = 0; i <= 4; i++) {
    const val = (maxVal / 4) * i;
    const y = PAD_T + innerH - (val / maxVal) * innerH;
    svg += `<line x1="${PAD_L}" y1="${y}" x2="${PAD_L + innerW}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>`;
    svg += `<text x="${PAD_L - 6}" y="${y + 3}" text-anchor="end" font-size="10" fill="#94a3b8">${Math.round(val)}</text>`;
  }

  const n = QUALITY_DAY_COLUMNS;
  const groupWidth = innerW / n;
  const barWidth = Math.max(30, groupWidth * 0.5);

  totals.forEach((v, i) => {
    const groupCenter = PAD_L + i * groupWidth + groupWidth / 2;
    const barX = groupCenter - barWidth / 2;
    const barH = (v / maxVal) * innerH;
    const barY = PAD_T + innerH - barH;
    const color = QUALITY_COLORS[QUALITY_DAY_COLUMNS_LABELS[i]] || '#64748b';

    svg += `<rect x="${barX}" y="${barY}" width="${barWidth}" height="${barH}" fill="${color}" rx="3"/>`;
    if (v > 0) {
      const pct = Math.round((v / grand) * 100);
      svg += `<text x="${groupCenter}" y="${barY - 4}" text-anchor="middle" font-size="12" font-weight="700" fill="#334155">${v}</text>`;
      svg += `<text x="${groupCenter}" y="${barY - 18}" text-anchor="middle" font-size="9" fill="#94a3b8">${pct}%</text>`;
    }

    svg += `<text x="${groupCenter}" y="${H - 30}" text-anchor="middle" font-size="11" font-weight="700" fill="#334155">${escapeHtml(QUALITY_DAY_COLUMNS_LABELS[i])}</text>`;
  });

  svg += '</svg>';
  return svg;
}

// ==================== ТАБЛИЦА ТРЕНДОВ ====================

function qdRenderTrends() {
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

  // Тренды по постам (через операторов)
  const postsMap = new Map();
  board.operators.forEach(op => {
    if (!op.postId) return;
    if (!postsMap.has(op.postId)) postsMap.set(op.postId, []);
    postsMap.get(op.postId).push(op);
  });

  const postTrends = [];
  postsMap.forEach((operators, postId) => {
    const postInfo = getQualityAvailablePosts().find(p => p.id === postId);
    const postName = postInfo ? postInfo.name : '—';

    let defCur = 0, defPrev = 0;
    operators.forEach(op => {
      currentWeekKeys.forEach(k => {
        const arr = op.defects[k];
        if (Array.isArray(arr)) defCur += arr.reduce((s, v) => s + (parseInt(v) || 0), 0);
      });
      if (prevWeekKey) {
        const arr = op.defects[prevWeekKey];
        if (Array.isArray(arr)) defPrev += arr.reduce((s, v) => s + (parseInt(v) || 0), 0);
      }
    });

    const dnaCur = weekCars > 0 ? defCur / weekCars : 0;
    const dnaPrev = prevWeekCars > 0 ? defPrev / prevWeekCars : 0;
    const trend = dnaCur - dnaPrev;

    if (defCur > 0 || defPrev > 0) {
      postTrends.push({ name: postName, dnaCur, dnaPrev, trend });
    }
  });

  // Тренды по операторам
  const opTrends = [];
  board.operators.forEach(op => {
    let defCur = 0, defPrev = 0;

    currentWeekKeys.forEach(k => {
      const arr = op.defects[k];
      if (Array.isArray(arr)) defCur += arr.reduce((s, v) => s + (parseInt(v) || 0), 0);
    });
    if (prevWeekKey) {
      const arr = op.defects[prevWeekKey];
      if (Array.isArray(arr)) defPrev = arr.reduce((s, v) => s + (parseInt(v) || 0), 0);
    }

    const dnaCur = weekCars > 0 ? defCur / weekCars : 0;
    const dnaPrev = prevWeekCars > 0 ? defPrev / prevWeekCars : 0;
    const trend = dnaCur - dnaPrev;

    if (defCur > 0 || defPrev > 0) {
      opTrends.push({ name: op.name, dnaCur, dnaPrev, trend });
    }
  });

  postTrends.sort((a, b) => b.trend - a.trend);
  opTrends.sort((a, b) => b.trend - a.trend);

  let html = '';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">';

  // Посты
  html += '<div>';
  html += '<div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:6px;">По постам:</div>';
  if (postTrends.length === 0) {
    html += '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:11px;">Нет данных.</div>';
  } else {
    html += '<table class="quality-board-table" style="width:100%;border-collapse:collapse;font-size:11px;">';
    html += '<thead><tr style="background:#f1f5f9;">';
    html += '<th style="padding:4px 6px;border:1px solid #cbd5e1;text-align:left;">Пост</th>';
    html += '<th style="padding:4px 6px;border:1px solid #cbd5e1;text-align:center;width:70px;">ДНА тек.</th>';
    html += '<th style="padding:4px 6px;border:1px solid #cbd5e1;text-align:center;width:70px;">ДНА прош.</th>';
    html += '<th style="padding:4px 6px;border:1px solid #cbd5e1;text-align:center;width:60px;">Тренд</th>';
    html += '</tr></thead><tbody>';
    postTrends.slice(0, 15).forEach(t => {
      const color = t.trend > 0 ? '#ef4444' : t.trend < 0 ? '#16a34a' : '#94a3b8';
      const icon = t.trend > 0 ? '▲' : t.trend < 0 ? '▼' : '—';
      html += `<tr>`;
      html += `<td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:600;">${escapeHtml(t.name)}</td>`;
      html += `<td style="padding:4px 6px;border:1px solid #cbd5e1;text-align:center;">${t.dnaCur.toFixed(3)}</td>`;
      html += `<td style="padding:4px 6px;border:1px solid #cbd5e1;text-align:center;color:#94a3b8;">${t.dnaPrev.toFixed(3)}</td>`;
      html += `<td style="padding:4px 6px;border:1px solid #cbd5e1;text-align:center;font-weight:700;color:${color};">${icon} ${Math.abs(t.trend).toFixed(3)}</td>`;
      html += '</tr>';
    });
    html += '</tbody></table>';
  }
  html += '</div>';

  // Операторы
  html += '<div>';
  html += '<div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:6px;">По операторам:</div>';
  if (opTrends.length === 0) {
    html += '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:11px;">Нет данных.</div>';
  } else {
    html += '<table class="quality-board-table" style="width:100%;border-collapse:collapse;font-size:11px;">';
    html += '<thead><tr style="background:#f1f5f9;">';
    html += '<th style="padding:4px 6px;border:1px solid #cbd5e1;text-align:left;">Оператор</th>';
    html += '<th style="padding:4px 6px;border:1px solid #cbd5e1;text-align:center;width:70px;">ДНА тек.</th>';
    html += '<th style="padding:4px 6px;border:1px solid #cbd5e1;text-align:center;width:70px;">ДНА прош.</th>';
    html += '<th style="padding:4px 6px;border:1px solid #cbd5e1;text-align:center;width:60px;">Тренд</th>';
    html += '</tr></thead><tbody>';
    opTrends.slice(0, 15).forEach(t => {
      const color = t.trend > 0 ? '#ef4444' : t.trend < 0 ? '#16a34a' : '#94a3b8';
      const icon = t.trend > 0 ? '▲' : t.trend < 0 ? '▼' : '—';
      html += `<tr>`;
      html += `<td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:600;">${escapeHtml(t.name)}</td>`;
      html += `<td style="padding:4px 6px;border:1px solid #cbd5e1;text-align:center;">${t.dnaCur.toFixed(3)}</td>`;
      html += `<td style="padding:4px 6px;border:1px solid #cbd5e1;text-align:center;color:#94a3b8;">${t.dnaPrev.toFixed(3)}</td>`;
      html += `<td style="padding:4px 6px;border:1px solid #cbd5e1;text-align:center;font-weight:700;color:${color};">${icon} ${Math.abs(t.trend).toFixed(3)}</td>`;
      html += '</tr>';
    });
    html += '</tbody></table>';
  }
  html += '</div>';

  html += '</div>';
  return html;
}

// ==================== ЭКСПОРТ В WINDOW ====================

window.qualityDynamics = {
  render: renderQualityDynamics,
};