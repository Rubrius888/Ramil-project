// ======================== СТАТИСТИКА v2 ========================
// Логика:
//   • KPI-плашки (общая сводка + обучения)
//   • График поливалентности по неделям (2L/3L факт + потенциал)
//   • График обучений по неделям (всего / завершено / просрочено)
//   • Разбивка по форматорам
//   • Таблицы: поливалентность по постам/операторам, явка, загрузка
//   • Тепловая карта постов

console.log('[stats.js] Загружен (v2)');

function renderStats() {
  renderStatsSummary();
  renderPolyvalenceChart();
  renderTrainingsStats();
  renderStatsTablePosts();
  renderStatsTableOps();
  renderStatsHeatmap();
  renderStatsTableAttendance();
  renderStatsLoadPosts();
}

// ==================== ОБЩАЯ СВОДКА ====================

function renderStatsSummary() {
  const cont = document.getElementById('statsSummary');
  if (!cont) return;
  const section = getCurrentSection();
  const psts = section.posts;
  const postCount = psts.length;

  const allOps = getCurrentOperators();
  const opCount = allOps.length;
  const levels = data;

  const realOps = [];
  for (let c = 0; c < opCount; c++) {
    if (allOps[c].role !== 'НУ') realOps.push(c);
  }
  const totalOps = realOps.length;

  let postsWithU = 0;
  for (let r = 0; r < postCount; r++) {
    let hasU = false;
    for (let c = 0; c < opCount; c++) {
      if (allOps[c].role === 'НУ') continue;
      if (levels[r][c] === 'U') { hasU = true; break; }
    }
    if (hasU) postsWithU++;
  }

  let posts2L = 0, posts3L = 0;
  for (let r = 0; r < postCount; r++) {
    let cnt = 0;
    for (let c = 0; c < opCount; c++) {
      const role = allOps[c].role;
      if (role === 'НУ' || role === 'СО') continue;
      const lvl = levels[r][c];
      if (lvl === 'L' || lvl === 'U') cnt++;
    }
    if (cnt >= 2) posts2L++;
    if (cnt >= 3) posts3L++;
  }

  let ops2L = 0, ops3L = 0;
  for (let ci = 0; ci < realOps.length; ci++) {
    const c = realOps[ci];
    if (allOps[c].role === 'СО') continue;
    let cnt = 0;
    for (let r = 0; r < postCount; r++) {
      const lvl = levels[r][c];
      if (lvl === 'L' || lvl === 'U') cnt++;
    }
    if (cnt >= 2) ops2L++;
    if (cnt >= 3) ops3L++;
  }

  const pctPostsU  = postCount ? Math.round((postsWithU / postCount) * 100) : 0;
  const pctPosts2L = postCount ? Math.round((posts2L / postCount) * 100) : 0;
  const pctPosts3L = postCount ? Math.round((posts3L / postCount) * 100) : 0;
  const pctOps2L   = totalOps   ? Math.round((ops2L / totalOps) * 100) : 0;
  const pctOps3L   = totalOps   ? Math.round((ops3L / totalOps) * 100) : 0;

  cont.innerHTML = `
    <div class="stats-kpi-row">
      <div class="stats-kpi"><div class="stats-kpi-value">${postCount}</div><div class="stats-kpi-label">Постов</div></div>
      <div class="stats-kpi"><div class="stats-kpi-value">${totalOps}</div><div class="stats-kpi-label">Операторов</div></div>
      <div class="stats-kpi" style="color:#16a34a;"><div class="stats-kpi-value">${pctPostsU}%</div><div class="stats-kpi-label">Покрытие U</div></div>
      <div class="stats-kpi" style="color:#2563eb;"><div class="stats-kpi-value">${pctPosts2L}%</div><div class="stats-kpi-label">Посты 2L</div></div>
      <div class="stats-kpi" style="color:#7c3aed;"><div class="stats-kpi-value">${pctPosts3L}%</div><div class="stats-kpi-label">Посты 3L</div></div>
      <div class="stats-kpi" style="color:#0891b2;"><div class="stats-kpi-value">${pctOps2L}%</div><div class="stats-kpi-label">Операторы 2L</div></div>
      <div class="stats-kpi" style="color:#dc2626;"><div class="stats-kpi-value">${pctOps3L}%</div><div class="stats-kpi-label">Операторы 3L</div></div>
    </div>
  `;
}

// ==================== 📈 ГРАФИК ПОЛИВАЛЕНТНОСТИ + ОБУЧЕНИЙ ====================

function renderPolyvalenceChart() {
  const cont = document.getElementById('statsPolyChart');
  if (!cont) return;

  const section = getCurrentSection();
  const posts = section.posts || [];
  const postCount = posts.length;
  if (postCount === 0) {
    cont.innerHTML = '<div style="color:#94a3b8;font-size:12px;padding:20px;text-align:center;">Нет постов</div>';
    return;
  }

  const shift = getCurrentShift();
  const shiftData = section.shifts?.[shift];
  const opList = shiftData?.operators || [];
  const levels = data;
  const weeks = getLastNWeeks(12);

  // ==================== ПОТЕНЦИАЛ (по уровням) ====================
  let potential2L = 0, potential3L = 0;
  posts.forEach((p, r) => {
    let cnt = 0;
    opList.forEach((op, c) => {
      if (op.role === 'НУ' || op.role === 'СО' || op.role === 'ДС') return;
      const lvl = levels[r]?.[c];
      if (lvl === 'L' || lvl === 'U' || lvl === 'Lкр') cnt++;
    });
    if (cnt >= 2) potential2L++;
    if (cnt >= 3) potential3L++;
  });
  const potential2LPct = postCount ? Math.round((potential2L / postCount) * 100) : 0;
  const potential3LPct = postCount ? Math.round((potential3L / postCount) * 100) : 0;

  // ==================== ФАКТ (поливалентность по назначениям) ====================
  const dataPoints = weeks.map(week => {
    let sum2L = 0, sum3L = 0, dayCount = 0;

    week.days.forEach(dateStr => {
      const day = shiftData?.days?.[dateStr];
      if (!day) return;
      dayCount++;

      let posts2L = 0, posts3L = 0;
      posts.forEach(p => {
        const assigned = normalizeAssignment(day.assignments?.[p.id]);
        const assignedSet = new Set(assigned);
        let cnt = 0;
        opList.forEach(op => {
          if (op.role === 'НУ' || op.role === 'СО' || op.role === 'ДС') return;
          if (!assignedSet.has(op.id)) return;
          const lvl = day.levels?.[p.id]?.[op.id];
          if (lvl === 'L' || lvl === 'U' || lvl === 'Lкр') cnt++;
        });
        if (cnt >= 2) posts2L++;
        if (cnt >= 3) posts3L++;
      });

      sum2L += (posts2L / postCount) * 100;
      sum3L += (posts3L / postCount) * 100;
    });

    return {
      label: week.label,
      range: week.range,
      p2L: dayCount > 0 ? Math.round(sum2L / dayCount) : null,
      p3L: dayCount > 0 ? Math.round(sum3L / dayCount) : null,
      hasData: dayCount > 0,
    };
  });

  // ==================== ОБУЧЕНИЯ по неделям ====================
  const trainingPoints = computeTrainingsByWeek(weeks);

  // ==================== ОБЩИЕ KPI (за 3 мес.) ====================
  const records = getSystem().trainingRecords || [];
  const now = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(now.getMonth() - 3);

  const recent = records.filter(r => {
    const start = parseRuDate(r.startDate);
    return start && start >= threeMonthsAgo;
  });

  let totalTrainings = recent.length;
  let inProgressCount = 0, completedCount = 0, overdueCount = 0;
  let totalDuration = 0, durationCount = 0;

  recent.forEach(r => {
    if (r.status === 'В процессе') inProgressCount++;
    else if (r.status === 'Завершено') completedCount++;

    if (r.status !== 'Завершено') {
      const start = parseRuDate(r.startDate);
      let end = parseRuDate(r.validDate);
      if (!end && start && r.duration) {
        end = new Date(start);
        end.setDate(end.getDate() + parseInt(r.duration));
      }
      if (end && end < now) overdueCount++;
    }

    if (r.duration) {
      totalDuration += parseInt(r.duration) || 0;
      durationCount++;
    }
  });

  const avgDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;
  const validationsCount = recent.filter(r => r.status === 'Завершено' && r.validDate && r.validDate !== '—').length;

  // ==================== KPI-ПЛАШКИ ====================
  const kpiHtml = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-bottom:16px;">
      <div style="background:#f1f5f9;border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:20px;font-weight:800;">${totalTrainings}</div>
        <div style="font-size:10px;text-transform:uppercase;color:#64748b;">Всего за 3 мес.</div>
      </div>
      <div style="background:#fef3c7;border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#f59e0b;">${inProgressCount}</div>
        <div style="font-size:10px;text-transform:uppercase;color:#64748b;">В процессе</div>
      </div>
      <div style="background:#dcfce7;border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#16a34a;">${completedCount}</div>
        <div style="font-size:10px;text-transform:uppercase;color:#64748b;">Завершено</div>
      </div>
      <div style="background:#dbeafe;border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#3b82f6;">${validationsCount}</div>
        <div style="font-size:10px;text-transform:uppercase;color:#64748b;">Валидаций</div>
      </div>
      <div style="background:#fee2e2;border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#ef4444;">${overdueCount}</div>
        <div style="font-size:10px;text-transform:uppercase;color:#64748b;">Просрочено</div>
      </div>
      <div style="background:#f3f4f6;border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:20px;font-weight:800;">${avgDuration}</div>
        <div style="font-size:10px;text-transform:uppercase;color:#64748b;">Ср. срок (дн.)</div>
      </div>
    </div>
  `;

  // ==================== ГРАФИКИ ====================
  const chart1 = renderPolySvg(dataPoints, potential2LPct, potential3LPct);
  const chart2 = renderTrainingsSvg(trainingPoints);

  // ==================== ЛЕГЕНДЫ ====================
  const legend1 = `
    <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:8px;font-size:11px;color:#64748b;">
      <span><span style="display:inline-block;width:18px;height:3px;background:#3b82f6;vertical-align:middle;border-radius:2px;"></span> 2L факт</span>
      <span><span style="display:inline-block;width:18px;height:3px;background:#8b5cf6;vertical-align:middle;border-radius:2px;"></span> 3L факт</span>
      <span><span style="display:inline-block;width:18px;height:3px;background:repeating-linear-gradient(90deg,#3b82f6 0 5px,transparent 5px 9px);vertical-align:middle;border-radius:2px;"></span> 2L потенциал (${potential2LPct}%)</span>
      <span><span style="display:inline-block;width:18px;height:3px;background:repeating-linear-gradient(90deg,#8b5cf6 0 5px,transparent 5px 9px);vertical-align:middle;border-radius:2px;"></span> 3L потенциал (${potential3LPct}%)</span>
    </div>
  `;

  const legend2 = `
    <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:8px;font-size:11px;color:#64748b;">
      <span><span style="display:inline-block;width:18px;height:3px;background:#0ea5e9;vertical-align:middle;border-radius:2px;"></span> Обучений за неделю</span>
      <span><span style="display:inline-block;width:18px;height:3px;background:#16a34a;vertical-align:middle;border-radius:2px;"></span> Завершено</span>
      <span><span style="display:inline-block;width:18px;height:3px;background:#ef4444;vertical-align:middle;border-radius:2px;"></span> Просрочено</span>
    </div>
  `;

  cont.innerHTML = `
    ${kpiHtml}
    <div style="margin-bottom:20px;">
      <div style="font-size:12px;font-weight:700;color:#475569;margin-bottom:6px;">📊 Поливалентность по неделям</div>
      ${chart1}
      ${legend1}
    </div>
    <div>
      <div style="font-size:12px;font-weight:700;color:#475569;margin-bottom:6px;">🎓 Обучения и валидации по неделям</div>
      ${chart2}
      ${legend2}
    </div>
  `;
}

// ==================== РЕНДЕР SVG: ПОЛИВАЛЕНТНОСТЬ ====================

function renderPolySvg(dataPoints, potential2LPct, potential3LPct) {
  const maxY = 100;
  const W = 1000, H = 280;
  const PAD_LEFT = 50, PAD_RIGHT = 20, PAD_TOP = 30, PAD_BOTTOM = 50;
  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;max-height:300px;display:block;">`;

  // Сетка
  [0, 25, 50, 75, 100].forEach(val => {
    const y = PAD_TOP + innerH - (val / maxY) * innerH;
    svg += `<line x1="${PAD_LEFT}" y1="${y}" x2="${PAD_LEFT + innerW}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>`;
    svg += `<text x="${PAD_LEFT - 6}" y="${y + 3}" text-anchor="end" font-size="10" fill="#94a3b8">${val}%</text>`;
  });

  // Потенциал — пунктирные горизонтальные
  {
    const y = PAD_TOP + innerH - (potential2LPct / maxY) * innerH;
    svg += `<line x1="${PAD_LEFT}" y1="${y}" x2="${PAD_LEFT + innerW}" y2="${y}" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="6,4" opacity="0.55"/>`;
    svg += `<text x="${PAD_LEFT + innerW - 4}" y="${y - 4}" text-anchor="end" font-size="10" fill="#3b82f6" opacity="0.85">Потенциал 2L: ${potential2LPct}%</text>`;
  }
  {
    const y = PAD_TOP + innerH - (potential3LPct / maxY) * innerH;
    svg += `<line x1="${PAD_LEFT}" y1="${y}" x2="${PAD_LEFT + innerW}" y2="${y}" stroke="#8b5cf6" stroke-width="1.5" stroke-dasharray="6,4" opacity="0.55"/>`;
    svg += `<text x="${PAD_LEFT + innerW - 4}" y="${y - 4}" text-anchor="end" font-size="10" fill="#8b5cf6" opacity="0.85">Потенциал 3L: ${potential3LPct}%</text>`;
  }

  const step = innerW / Math.max(dataPoints.length - 1, 1);

  // 2L факт
  {
    let path = '', started = false;
    dataPoints.forEach((p, i) => {
      if (!p.hasData || p.p2L === null) { started = false; return; }
      const x = PAD_LEFT + i * step;
      const y = PAD_TOP + innerH - (p.p2L / maxY) * innerH;
      path += (started ? 'L' : 'M') + `${x},${y} `;
      started = true;
    });
    if (path) svg += `<path d="${path}" fill="none" stroke="#3b82f6" stroke-width="2.5"/>`;
  }

  // 3L факт
  {
    let path = '', started = false;
    dataPoints.forEach((p, i) => {
      if (!p.hasData || p.p3L === null) { started = false; return; }
      const x = PAD_LEFT + i * step;
      const y = PAD_TOP + innerH - (p.p3L / maxY) * innerH;
      path += (started ? 'L' : 'M') + `${x},${y} `;
      started = true;
    });
    if (path) svg += `<path d="${path}" fill="none" stroke="#8b5cf6" stroke-width="2.5"/>`;
  }

  // Точки + подписи
  dataPoints.forEach((p, i) => {
    const x = PAD_LEFT + i * step;

    if (p.hasData) {
      if (p.p2L !== null) {
        const y2 = PAD_TOP + innerH - (p.p2L / maxY) * innerH;
        svg += `<circle cx="${x}" cy="${y2}" r="4" fill="#3b82f6" stroke="#fff" stroke-width="1.5"/>`;
        svg += `<text x="${x}" y="${y2 - 8}" text-anchor="middle" font-size="10" font-weight="700" fill="#3b82f6">${p.p2L}%</text>`;
      }
      if (p.p3L !== null) {
        const y3 = PAD_TOP + innerH - (p.p3L / maxY) * innerH;
        svg += `<circle cx="${x}" cy="${y3}" r="4" fill="#8b5cf6" stroke="#fff" stroke-width="1.5"/>`;
        svg += `<text x="${x}" y="${y3 + 14}" text-anchor="middle" font-size="10" font-weight="700" fill="#8b5cf6">${p.p3L}%</text>`;
      }
    } else {
      svg += `<text x="${x}" y="${PAD_TOP + innerH + 14}" text-anchor="middle" font-size="11" fill="#cbd5e1">—</text>`;
    }

    svg += `<text x="${x}" y="${H - 22}" text-anchor="middle" font-size="10" fill="#64748b" font-weight="700">${escapeHtml(p.label)}</text>`;
    svg += `<text x="${x}" y="${H - 8}" text-anchor="middle" font-size="8.5" fill="#94a3b8">${escapeHtml(p.range)}</text>`;
  });

  svg += '</svg>';
  return svg;
}

// ==================== РЕНДЕР SVG: ОБУЧЕНИЯ ====================

function renderTrainingsSvg(trainingPoints) {
  const W = 1000, H = 220;
  const PAD_LEFT = 50, PAD_RIGHT = 20, PAD_TOP = 20, PAD_BOTTOM = 50;
  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  // Максимум по Y
  let maxVal = 1;
  trainingPoints.forEach(p => {
    maxVal = Math.max(maxVal, p.total, p.completed, p.overdue);
  });
  maxVal = Math.ceil(maxVal * 1.2);

  let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;max-height:240px;display:block;">`;

  // Сетка
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const val = Math.round((maxVal / gridSteps) * i);
    const y = PAD_TOP + innerH - (val / maxVal) * innerH;
    svg += `<line x1="${PAD_LEFT}" y1="${y}" x2="${PAD_LEFT + innerW}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>`;
    svg += `<text x="${PAD_LEFT - 6}" y="${y + 3}" text-anchor="end" font-size="10" fill="#94a3b8">${val}</text>`;
  }

  const step = innerW / Math.max(trainingPoints.length - 1, 1);

  // Линия 1: всего
  {
    let path = '';
    trainingPoints.forEach((p, i) => {
      const x = PAD_LEFT + i * step;
      const y = PAD_TOP + innerH - (p.total / maxVal) * innerH;
      path += (i === 0 ? 'M' : 'L') + `${x},${y} `;
    });
    if (path) svg += `<path d="${path}" fill="none" stroke="#0ea5e9" stroke-width="2.5"/>`;
  }

  // Линия 2: завершено
  {
    let path = '';
    trainingPoints.forEach((p, i) => {
      const x = PAD_LEFT + i * step;
      const y = PAD_TOP + innerH - (p.completed / maxVal) * innerH;
      path += (i === 0 ? 'M' : 'L') + `${x},${y} `;
    });
    if (path) svg += `<path d="${path}" fill="none" stroke="#16a34a" stroke-width="2.5"/>`;
  }

  // Линия 3: просрочено
  {
    let path = '';
    trainingPoints.forEach((p, i) => {
      const x = PAD_LEFT + i * step;
      const y = PAD_TOP + innerH - (p.overdue / maxVal) * innerH;
      path += (i === 0 ? 'M' : 'L') + `${x},${y} `;
    });
    if (path) svg += `<path d="${path}" fill="none" stroke="#ef4444" stroke-width="2.5"/>`;
  }

  // Точки + подписи
  trainingPoints.forEach((p, i) => {
    const x = PAD_LEFT + i * step;

    // Всего
    if (p.total > 0) {
      const yT = PAD_TOP + innerH - (p.total / maxVal) * innerH;
      svg += `<circle cx="${x}" cy="${yT}" r="4" fill="#0ea5e9" stroke="#fff" stroke-width="1.5"/>`;
      svg += `<text x="${x}" y="${yT - 8}" text-anchor="middle" font-size="10" font-weight="700" fill="#0ea5e9">${p.total}</text>`;
    }

    // Завершено
    if (p.completed > 0) {
      const yC = PAD_TOP + innerH - (p.completed / maxVal) * innerH;
      svg += `<circle cx="${x}" cy="${yC}" r="3.5" fill="#16a34a" stroke="#fff" stroke-width="1.5"/>`;
    }

    // Просрочено
    if (p.overdue > 0) {
      const yO = PAD_TOP + innerH - (p.overdue / maxVal) * innerH;
      svg += `<circle cx="${x}" cy="${yO}" r="3.5" fill="#ef4444" stroke="#fff" stroke-width="1.5"/>`;
    }

    svg += `<text x="${x}" y="${H - 22}" text-anchor="middle" font-size="10" fill="#64748b" font-weight="700">${escapeHtml(p.label)}</text>`;
    svg += `<text x="${x}" y="${H - 8}" text-anchor="middle" font-size="8.5" fill="#94a3b8">${escapeHtml(p.range)}</text>`;
  });

  svg += '</svg>';
  return svg;
}

// ==================== РАСЧЁТ ОБУЧЕНИЙ ПО НЕДЕЛЯМ ====================

function computeTrainingsByWeek(weeks) {
  const records = getSystem().trainingRecords || [];
  const now = new Date();

  return weeks.map(week => {
    const firstDay = parseDate(week.days[0]);
    const lastDay = parseDate(week.days[week.days.length - 1]);
    if (!firstDay || !lastDay) {
      return { label: week.label, range: week.range, total: 0, completed: 0, overdue: 0 };
    }
    const lastDayEnd = new Date(lastDay);
    lastDayEnd.setHours(23, 59, 59, 999);

    let total = 0, completed = 0, overdue = 0;

    records.forEach(r => {
      const start = parseRuDate(r.startDate);
      if (!start) return;
      if (start < firstDay || start > lastDayEnd) return;

      total++;
      if (r.status === 'Завершено') completed++;

      if (r.status !== 'Завершено') {
        let end = parseRuDate(r.validDate);
        if (!end && start && r.duration) {
          end = new Date(start);
          end.setDate(end.getDate() + parseInt(r.duration));
        }
        if (end && end < now) overdue++;
      }
    });

    return { label: week.label, range: week.range, total, completed, overdue };
  });
}

/**
 * Возвращает последние N недель (пн-пт).
 */
function getLastNWeeks(n) {
  const weeks = [];
  const today = new Date();
  const dow = today.getDay();
  const daysToMonday = (dow === 0 ? -6 : 1 - dow);
  const mondayThisWeek = new Date(today);
  mondayThisWeek.setDate(today.getDate() + daysToMonday);
  mondayThisWeek.setHours(0, 0, 0, 0);

  for (let i = n - 1; i >= 0; i--) {
    const monday = new Date(mondayThisWeek);
    monday.setDate(mondayThisWeek.getDate() - i * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const days = [];
    for (let d = 0; d < 5; d++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + d);
      days.push(formatDate(day));
    }

    const weekNum = getISOWeekNumber(monday);

    weeks.push({
      label: `Н${weekNum}`,
      range: `${String(monday.getDate()).padStart(2, '0')}.${String(monday.getMonth() + 1).padStart(2, '0')}–${String(sunday.getDate()).padStart(2, '0')}.${String(sunday.getMonth() + 1).padStart(2, '0')}`,
      days,
    });
  }
  return weeks;
}

function getISOWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// ==================== 🎓 ОБУЧЕНИЯ И ВАЛИДАЦИИ (разбивка по форматорам) ====================

function renderTrainingsStats() {
  const cont = document.getElementById('statsTrainings');
  if (!cont) return;

  const records = getSystem().trainingRecords || [];
  const now = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(now.getMonth() - 3);

  const recent = records.filter(r => {
    const start = parseRuDate(r.startDate);
    return start && start >= threeMonthsAgo;
  });

  const byFormator = {};
  recent.forEach(r => {
    const f = r.formator || '—';
    if (!byFormator[f]) byFormator[f] = { total: 0, completed: 0, inProgress: 0, planned: 0 };
    byFormator[f].total++;
    if (r.status === 'Завершено') byFormator[f].completed++;
    else if (r.status === 'В процессе') byFormator[f].inProgress++;
    else if (r.status === 'План') byFormator[f].planned++;
  });

  const formatorsSorted = Object.keys(byFormator)
    .map(name => ({ name, ...byFormator[name] }))
    .sort((a, b) => b.completed - a.completed);

  if (formatorsSorted.length === 0) {
    cont.innerHTML = '<div style="color:#94a3b8;font-size:12px;text-align:center;padding:20px;">Нет данных об обучении за последние 3 месяца</div>';
    return;
  }

  let html = `
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:6px;">По форматорам</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:6px 8px;text-align:left;border:1px solid #cbd5e1;">Форматор</th>
          <th style="padding:6px 8px;border:1px solid #cbd5e1;width:70px;">Всего</th>
          <th style="padding:6px 8px;border:1px solid #cbd5e1;width:80px;">В проц.</th>
          <th style="padding:6px 8px;border:1px solid #cbd5e1;width:90px;">Завершено</th>
        </tr>
      </thead>
      <tbody>
        ${formatorsSorted.map(f => `
          <tr>
            <td style="padding:5px 8px;border:1px solid #cbd5e1;">${escapeHtml(f.name)}</td>
            <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:center;">${f.total}</td>
            <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:center;color:#f59e0b;">${f.inProgress}</td>
            <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:center;color:#16a34a;font-weight:700;">${f.completed}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  cont.innerHTML = html;
}

// ==================== 🔥 ТЕПЛОВАЯ КАРТА ====================

function renderStatsHeatmap() {
  const cont = document.getElementById('statsHeatmap');
  if (!cont) return;

  const section = getCurrentSection();
  const shift = getCurrentShift();
  const shiftData = section.shifts?.[shift];
  if (!shiftData) {
    cont.innerHTML = '<div style="color:#94a3b8;font-size:12px;text-align:center;padding:20px;">Нет данных смены</div>';
    return;
  }

  const posts = section.posts || [];
  const dates = getAvailableDates().slice(0, 10).reverse();

  if (posts.length === 0) {
    cont.innerHTML = '<div style="color:#94a3b8;font-size:12px;text-align:center;padding:20px;">Нет постов</div>';
    return;
  }

  const realOps = (shiftData.operators || []).filter(o => o.role !== 'НУ' && o.role !== 'СО');

  let html = '<table class="heatmap-table"><thead><tr><th>Пост</th>';
  dates.forEach(d => {
    html += `<th>${escapeHtml(d.slice(0, 5))}</th>`;
  });
  html += '</tr></thead><tbody>';

  posts.forEach(p => {
    html += `<tr><td style="text-align:left;font-size:11px;">${escapeHtml(p.name)}</td>`;
    dates.forEach(date => {
      const day = shiftData.days?.[date];
      let bestLevel = null;
      if (day) {
        const m = getPostMetrics(p, day, realOps);
        m.assigned.forEach(oid => {
          const lvl = day.levels?.[p.id]?.[oid];
          if (lvl === 'U') bestLevel = 'U';
          else if ((lvl === 'L' || lvl === 'Lкр') && bestLevel !== 'U') bestLevel = 'L';
          else if ((lvl === 'I' || lvl === 'Iкр') && !bestLevel) bestLevel = 'I';
        });
      }
      let cls = 'hm-empty';
      let txt = '—';
      if (bestLevel === 'U') { cls = 'hm-U'; txt = 'U'; }
      else if (bestLevel === 'L') { cls = 'hm-L'; txt = 'L'; }
      else if (bestLevel === 'I') { cls = 'hm-I'; txt = 'I'; }
      html += `<td class="${cls}">${txt}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';

  cont.innerHTML = html;
}

// ==================== ТАБЛИЦЫ ====================

function renderStatsTablePosts() {
  const table = document.getElementById('statsTablePosts');
  if (!table) return;
  const section = getCurrentSection();
  const psts = section.posts;
  const opList = getCurrentOperators();
  const opCount = opList.length;
  const levels = data;

  let html = `<thead><tr><th style="text-align:left;">Пост</th><th>2L</th><th>3L</th><th>U</th><th>Всего L/U</th></tr></thead><tbody>`;
  for (let r = 0; r < psts.length; r++) {
    const p = psts[r];
    let cntU = 0, cntLU = 0;
    for (let c = 0; c < opCount; c++) {
      const role = opList[c].role;
      if (role === 'НУ' || role === 'СО') continue;
      const lvl = levels[r][c];
      if (lvl === 'U') cntU++;
      if (lvl === 'L' || lvl === 'U') cntLU++;
    }
    const is2L = cntLU >= 2;
    const is3L = cntLU >= 3;
    html += `<tr>
      <td style="text-align:left;">${escapeHtml(p.name)}</td>
      <td style="${is2L ? 'background:#bbf7d0;color:#166534;font-weight:700;' : 'color:#cbd5e1;'}">${is2L ? '✓' : '—'}</td>
      <td style="${is3L ? 'background:#bbf7d0;color:#166534;font-weight:700;' : 'color:#cbd5e1;'}">${is3L ? '✓' : '—'}</td>
      <td style="${cntU > 0 ? 'background:#dbeafe;color:#1d4ed8;font-weight:700;' : 'color:#cbd5e1;'}">${cntU > 0 ? cntU : '—'}</td>
      <td style="font-weight:700;">${cntLU}</td>
    </tr>`;
  }
  html += `</tbody>`;
  table.innerHTML = html;
}

function renderStatsTableOps() {
  const table = document.getElementById('statsTableOps');
  if (!table) return;
  const section = getCurrentSection();
  const psts = section.posts;
  const postCount = psts.length;
  const opList = getCurrentOperators();
  const opCount = opList.length;
  const levels = data;

  let html = `<thead><tr><th style="text-align:left;">Оператор</th><th>Роль</th><th>2L</th><th>3L</th><th>Всего L/U</th></tr></thead><tbody>`;
  for (let c = 0; c < opCount; c++) {
    const op = opList[c];
    if (op.role === 'НУ' || op.role === 'СО') continue;
    let cntLU = 0;
    for (let r = 0; r < postCount; r++) {
      const lvl = levels[r][c];
      if (lvl === 'L' || lvl === 'U') cntLU++;
    }
    const is2L = cntLU >= 2;
    const is3L = cntLU >= 3;
    html += `<tr>
      <td style="text-align:left;">${escapeHtml(op.name)}</td>
      <td>${escapeHtml(op.role)}</td>
      <td style="${is2L ? 'background:#bbf7d0;color:#166534;font-weight:700;' : 'color:#cbd5e1;'}">${is2L ? '✓' : '—'}</td>
      <td style="${is3L ? 'background:#bbf7d0;color:#166534;font-weight:700;' : 'color:#cbd5e1;'}">${is3L ? '✓' : '—'}</td>
      <td style="font-weight:700;">${cntLU}</td>
    </tr>`;
  }
  html += `</tbody>`;
  table.innerHTML = html;
}

function renderStatsTableAttendance() {
  const table = document.getElementById('statsTableAttendance');
  if (!table) return;
  const section = getCurrentSection();
  const dates = getAvailableDates().slice(0, 10);
  const shift = getCurrentShift();
  const shiftData = section.shifts[shift];
  const shiftOps = shiftData?.operators || [];
  const days = shiftData?.days || {};

  let html = `<thead><tr>
    <th style="text-align:left;">Дата</th>
    <th style="color:#16a34a;">Явка</th>
    <th style="color:#9333ea;">Отпуск</th>
    <th style="color:#ef4444;">Болезнь</th>
    <th style="color:#ef4444;">Неявка</th>
    <th style="color:#64748b;">Уволен</th>
    <th style="color:#ea580c;">В др. секторе</th>
  </tr></thead><tbody>`;

  dates.forEach(date => {
    const day = days[date];
    let present = 0, vacation = 0, sick = 0, absent = 0, fired = 0, other = 0;
    if (day) {
      for (let i = 0; i < shiftOps.length; i++) {
        const op = shiftOps[i];
        if (op.role === 'НУ') continue;
        const a = day.attendance[op.id] || 'Я';
        if (a === 'Я') present++;
        else if (a === 'О') vacation++;
        else if (a === 'Б') sick++;
        else if (a === 'Н') absent++;
        else if (a === 'У') fired++;
        else if (a === 'С') other++;
      }
    }
    html += `<tr>
      <td style="text-align:left;">${escapeHtml(date)}</td>
      <td style="color:#16a34a;font-weight:700;">${present}</td>
      <td style="color:#9333ea;">${vacation}</td>
      <td style="color:#ef4444;">${sick}</td>
      <td style="color:#ef4444;">${absent}</td>
      <td style="color:#64748b;">${fired}</td>
      <td style="color:#ea580c;">${other}</td>
    </tr>`;
  });
  html += `</tbody>`;
  table.innerHTML = html;
}

function renderStatsLoadPosts() {
  const cont = document.getElementById('statsLoadPosts');
  if (!cont) return;
  const section = getCurrentSection();
  const day = getCurrentDay();
  const posts = section.posts;
  const total = posts.length;
  let filled = 0;
  const freePosts = [];
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    const assigned = normalizeAssignment(day.assignments[p.id]);
    if (assigned.length > 0) filled++;
    else freePosts.push(p.name);
  }
  const pct = total ? Math.round((filled / total) * 100) : 0;

  let html = `<div class="stats-load-bar">
      <div class="stats-load-fill" style="width:${pct}%;"></div>
      <div class="stats-load-text">${filled} / ${total} (${pct}%)</div>
    </div>`;
  if (freePosts.length > 0) {
    html += `<div class="stats-free-posts-title">Свободные посты:</div><div class="stats-free-posts">`;
    freePosts.forEach(p => { html += `<span class="stats-free-post">${escapeHtml(p)}</span>`; });
    html += `</div>`;
  } else {
    html += `<div style="margin-top:10px;color:#16a34a;font-weight:600;">✅ Все посты заполнены</div>`;
  }
  cont.innerHTML = html;
}