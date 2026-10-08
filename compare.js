// ======================== СРАВНЕНИЕ СМЕН A / B / C ========================
function initCompareSelectors() {
  const secSel = document.getElementById('compareSection');
  const dateSel = document.getElementById('compareDate');
  if (!secSel || !dateSel) return;

  const sections = getSectionsByFilter(getCurrentDepartment(), getCurrentWorkshop());
  secSel.innerHTML = sections.map(s =>
    `<option value="${escapeHtml(s.id)}" ${s.id === getSystem().currentSectionId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
  ).join('');

  const dates = getAvailableDates();
  dateSel.innerHTML = dates.map(d =>
    `<option value="${escapeHtml(d)}" ${d === getCurrentDate() ? 'selected' : ''}>${escapeHtml(d)}${d === formatDate() ? ' (сегодня)' : ''}</option>`
  ).join('');
}

function renderCompare() {
  const secSel = document.getElementById('compareSection');
  const dateSel = document.getElementById('compareDate');
  const cont = document.getElementById('compareContent');

  if (!cont) return;

  if (!secSel || !secSel.options.length) initCompareSelectors();
  if (!secSel || !secSel.options.length) {
    cont.innerHTML = '<div class="matrix-container" style="padding:40px;text-align:center;color:#94a3b8;">Нет участков</div>';
    return;
  }

  const sectionId = secSel.value;
  const date = dateSel.value;
  const section = getSectionById(sectionId);

  if (!section) {
    cont.innerHTML = '<div class="matrix-container" style="padding:40px;text-align:center;color:#94a3b8;">Участок не найден</div>';
    return;
  }

  const shifts = ['A', 'B', 'C'];
  // ← ПРАВКА (задача №2): добавляем m.shift, т.к. computeSectionMetrics его не возвращает
  const metrics = shifts.map(shift => {
    const m = computeShiftMetrics(section, shift, date);
    m.shift = shift;
    return m;
  });

  cont.innerHTML = `
    <div class="compare-grid">
      ${metrics.map(m => buildShiftCard(m)).join('')}
    </div>
    <div class="compare-chart-panel">
      <div class="dash-panel-title">📊 Сравнение ключевых метрик</div>
      <div class="dash-panel-body">
        ${buildCompareBars(metrics)}
      </div>
    </div>
    <div class="compare-table-panel">
      <div class="dash-panel-title">📋 Детальная таблица</div>
      <div class="dash-panel-body">
        ${buildCompareTable(metrics)}
      </div>
    </div>`;
}

// ==================== ИСПОЛЬЗУЕМ ОБЩИЙ ХЕЛПЕР ИЗ utils.js ====================
// Раньше здесь была дублированная логика с ошибкой: U-покрытие считалось
// по уровням всех операторов смены, а не только назначенных на пост.
// Теперь делегируем в computeSectionMetrics (utils.js).
function computeShiftMetrics(section, shift, date) {
  return computeSectionMetrics(section, shift, date);
}

function buildShiftCard(m) {
  const colorAtt = m.pctAtt >= 80 ? 'green' : m.pctAtt >= 60 ? 'yellow' : 'red';
  const colorU = m.pctU >= 80 ? 'green' : m.pctU >= 50 ? 'yellow' : 'red';
  const color2L = m.pct2L >= 70 ? 'green' : m.pct2L >= 40 ? 'yellow' : 'red';
  const color3L = m.pct3L >= 50 ? 'green' : m.pct3L >= 30 ? 'yellow' : 'red';
  const colorFill = m.pctFill >= 90 ? 'green' : m.pctFill >= 70 ? 'yellow' : 'red';

  return `
    <div class="compare-card compare-card-${m.shift || 'A'}">
      <div class="compare-card-title">Смена ${m.shift || ''}</div>
      <div class="compare-card-rows">
        <div class="compare-row">
          <span>👥 Операторов:</span> <b>${m.operators}</b>
        </div>
        <div class="compare-row">
          <span>✅ Явка:</span> <b class="dash-color-${colorAtt}">${m.present} (${m.pctAtt}%)</b>
        </div>
        <div class="compare-row">
          <span>🚦 Загрузка постов:</span> <b class="dash-color-${colorFill}">${m.posts - m.postsFree}/${m.posts} (${m.pctFill}%)</b>
        </div>
        <div class="compare-row">
          <span>🎯 Покрытие U:</span> <b class="dash-color-${colorU}">${m.pctU}%</b>
        </div>
        <div class="compare-row">
          <span>📊 2L:</span> <b class="dash-color-${color2L}">${m.pct2L}%</b>
        </div>
        <div class="compare-row">
          <span>📊 3L:</span> <b class="dash-color-${color3L}">${m.pct3L}%</b>
        </div>
        <div class="compare-row">
          <span>🎓 Ср. поливалентность:</span> <b>${m.avgPoly}</b>
        </div>
        <div class="compare-row compare-row-mini">
          <span>Отпуск: ${m.vacation}</span>
          <span>Болезнь: ${m.sick}</span>
          <span>Неявка: ${m.absent}</span>
        </div>
      </div>
    </div>`;
}

function buildCompareBars(metrics) {
  const groups = [
    { key: 'pctAtt',   label: 'Явка %' },
    { key: 'pctFill',  label: 'Загрузка постов %' },
    { key: 'pctU',     label: 'Покрытие U %' },
    { key: 'pct2L',    label: '2L %' },
    { key: 'pct3L',    label: '3L %' }
  ];

  let html = '<div class="compare-bars">';

  groups.forEach(g => {
    html += `<div class="compare-bars-group"><div class="compare-bars-group-title">${g.label}</div>`;

    metrics.forEach(m => {
      const val = m[g.key] || 0;
      const color = val >= 80 ? '#16a34a' : val >= 60 ? '#f59e0b' : '#ef4444';

      html += `
        <div class="compare-bars-row">
          <span class="compare-bars-label">${m.shift || ''}</span>
          <div class="compare-bars-track">
            <div class="compare-bars-fill" style="width:${val}%;background:${color};"></div>
            <span class="compare-bars-text">${val}%</span>
          </div>
        </div>`;
    });

    html += '</div>';
  });

  html += '</div>';
  return html;
}

function buildCompareTable(metrics) {
  const rows = [
    { label: '👥 Операторов',           key: 'operators',  unit: '',  lowerBetter: false },
    { label: '✅ Явка, чел.',           key: 'present',    unit: '',  lowerBetter: false },
    { label: '📈 Явка, %',              key: 'pctAtt',     unit: '%', lowerBetter: false },
    { label: '🚦 Заполнено постов',      key: '_filled',    unit: '',  lowerBetter: false },
    { label: '📊 Загрузка, %',          key: 'pctFill',    unit: '%', lowerBetter: false },
    { label: '🎯 Покрытие U, %',        key: 'pctU',       unit: '%', lowerBetter: false },
    { label: '📊 2L, %',                key: 'pct2L',      unit: '%', lowerBetter: false },
    { label: '📊 3L, %',                key: 'pct3L',      unit: '%', lowerBetter: false },
    { label: '🎓 Ср. поливалентность',   key: 'avgPoly',    unit: '',  lowerBetter: false },
    { label: '🆓 Свободных постов',      key: 'postsFree',  unit: '',  lowerBetter: true },
    { label: '🏥 Больничный',           key: 'sick',       unit: '',  lowerBetter: true },
    { label: '🌴 Отпуск',               key: 'vacation',   unit: '',  lowerBetter: true },
    { label: '❌ Неявка',               key: 'absent',     unit: '',  lowerBetter: true }
  ];

  let html = '<table class="compare-table"><thead><tr><th>Метрика</th>';
  metrics.forEach(m => { html += `<th>Смена ${m.shift || ''}</th>`; });
  html += '<th>Лучший</th></tr></thead><tbody>';

  rows.forEach(row => {
    html += `<tr><td>${row.label}</td>`;

    const values = metrics.map(m => {
      if (row.key === '_filled') return m.posts - m.postsFree;
      const v = m[row.key];
      return typeof v === 'number' ? v : (parseFloat(v) || 0);
    });

    let bestValue;
    if (row.lowerBetter) {
      bestValue = Math.min(...values);
    } else {
      bestValue = Math.max(...values);
    }

    const countBest = values.filter(v => v === bestValue).length;

    metrics.forEach((m, i) => {
      const v = values[i];
      let isBest = false;
      if (countBest === 1 && v === bestValue) {
        if (row.lowerBetter) {
          isBest = true;
        } else {
          isBest = bestValue > 0;
        }
      }
      const cls = isBest ? 'compare-best' : '';
      html += `<td class="${cls}">${v}${row.unit}</td>`;
    });

    let bestShiftLabel = '—';
    if (countBest === 1) {
      const bestIdx = values.indexOf(bestValue);
      if (bestIdx >= 0) {
        if (row.lowerBetter || bestValue > 0) {
          bestShiftLabel = metrics[bestIdx].shift || '';
        }
      }
    }

    html += `<td><b>${bestShiftLabel}</b></td></tr>`;
  });

  html += '</tbody></table>';
  return html;
}

function exportCompareToExcel() {
  if (typeof XLSX === 'undefined') { alert('Библиотека XLSX не загружена'); return; }
  const secSel = document.getElementById('compareSection');
  const dateSel = document.getElementById('compareDate');
  if (!secSel || !dateSel) return;

  const section = getSectionById(secSel.value);
  const date = dateSel.value;
  if (!section) return;

  const metrics = ['A', 'B', 'C'].map(s => {
    const m = computeShiftMetrics(section, s, date);
    m.shift = s;
    return m;
  });

  const wb = XLSX.utils.book_new();
  const rows = [['Метрика', 'Смена A', 'Смена B', 'Смена C']];

  const addRow = (label, key, unit) => {
    rows.push([label, metrics[0][key] + (unit || ''), metrics[1][key] + (unit || ''), metrics[2][key] + (unit || '')]);
  };

  addRow('Операторов', 'operators');
  addRow('Явка, чел.', 'present');
  addRow('Явка, %', 'pctAtt', '%');
  addRow('Заполнено постов', '_filled');
  addRow('Загрузка, %', 'pctFill', '%');
  addRow('Покрытие U, %', 'pctU', '%');
  addRow('2L, %', 'pct2L', '%');
  addRow('3L, %', 'pct3L', '%');
  addRow('Ср. поливалентность', 'avgPoly');
  addRow('Свободных постов', 'postsFree');
  addRow('Больничный', 'sick');
  addRow('Отпуск', 'vacation');
  addRow('Неявка', 'absent');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Сравнение смен');
  XLSX.writeFile(wb, `Сравнение_${section.name}_${date.replace(/\./g, '-')}.xlsx`);
  logAudit('export_excel', 'Сравнение смен', `${section.name} · ${date}`);
}