// ======================== АРХИВ ДЕФЕКТОВ ========================
// Сюда попадают все действия из плана действий доски качества.
// Только для чтения: без удаления. Сортировка, фильтр, поиск, экспорт.

console.log('[quality-archive.js] Загружен');

let _qaSortBy = 'createdAt';
let _qaSortDir = 'desc';
let _qaFilters = {
  search: '',
  post: '',
  operator: '',
  status: '',
  priority: '',
  dateFrom: '',
  dateTo: '',
};

// ==================== ДОСТУП К АРХИВУ ====================

function getQualityArchive() {
  const sys = getSystem();
  if (!sys.qualityArchive) sys.qualityArchive = [];
  if (!Array.isArray(sys.qualityArchive)) sys.qualityArchive = [];
  return sys.qualityArchive;
}

function saveQualityArchive() {
  saveSystem();
}

// ==================== ДОБАВЛЕНИЕ В АРХИВ ====================

/**
 * Вызывается из addActionPlan. Копирует действие в архив.
 */
function qualityArchiveAdd(plan) {
  const archive = getQualityArchive();
  const now = new Date();
  archive.push({
    id: genId(),
    planId: plan.id,
    createdAt: now.toISOString(),
    createdDate: now.toLocaleDateString('ru-RU'),
    createdTime: now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    updatedAt: '',
    postName: plan.postName || '',
    operatorName: plan.operatorName || '',
    defect: plan.defect || '',
    action: plan.action || '',
    pilot: plan.pilot || '',
    deadline: plan.deadline || '',
    percent: plan.percent || 0,
    priority: plan.priority || 'medium',
    status: plan.status || 'open',
  });
  saveQualityArchive();
}

/**
 * Обновление архивной записи при изменении действия.
 */
function qualityArchiveUpdate(planId, updates) {
  const archive = getQualityArchive();
  const rec = archive.find(a => a.planId === planId);
  if (!rec) return;
  Object.assign(rec, updates);
  rec.updatedAt = new Date().toISOString();
  saveQualityArchive();
}

/**
 * Помечаем архивную запись как удалённую из плана (не удаляем из архива).
 */
function qualityArchiveMarkDeleted(planId) {
  const archive = getQualityArchive();
  const rec = archive.find(a => a.planId === planId);
  if (!rec) return;
  rec.deletedFromPlan = true;
  rec.updatedAt = new Date().toISOString();
  saveQualityArchive();
}

// ==================== ФИЛЬТРАЦИЯ ====================

function qaGetFiltered() {
  const archive = getQualityArchive();
  let list = archive.slice();

  const q = (_qaFilters.search || '').trim().toLowerCase();
  if (q) {
    list = list.filter(a =>
      (a.postName || '').toLowerCase().includes(q) ||
      (a.operatorName || '').toLowerCase().includes(q) ||
      (a.defect || '').toLowerCase().includes(q) ||
      (a.action || '').toLowerCase().includes(q) ||
      (a.pilot || '').toLowerCase().includes(q)
    );
  }

  if (_qaFilters.post) list = list.filter(a => a.postName === _qaFilters.post);
  if (_qaFilters.operator) list = list.filter(a => a.operatorName === _qaFilters.operator);
  if (_qaFilters.status) list = list.filter(a => a.status === _qaFilters.status);
  if (_qaFilters.priority) list = list.filter(a => a.priority === _qaFilters.priority);

  if (_qaFilters.dateFrom) {
    const from = parseRuDate(_qaFilters.dateFrom);
    if (from) {
      list = list.filter(a => {
        const d = new Date(a.createdAt);
        return d >= from;
      });
    }
  }
  if (_qaFilters.dateTo) {
    const to = parseRuDate(_qaFilters.dateTo);
    if (to) {
      to.setHours(23, 59, 59, 999);
      list = list.filter(a => {
        const d = new Date(a.createdAt);
        return d <= to;
      });
    }
  }

  // Сортировка
  list.sort((a, b) => {
    let va = a[_qaSortBy], vb = b[_qaSortBy];
    if (typeof va === 'string') {
      const cmp = va.localeCompare(vb);
      return _qaSortDir === 'asc' ? cmp : -cmp;
    }
    if (typeof va === 'number') {
      return _qaSortDir === 'asc' ? va - vb : vb - va;
    }
    // Дата по умолчанию — по строке
    return _qaSortDir === 'asc'
      ? String(va).localeCompare(String(vb))
      : String(vb).localeCompare(String(va));
  });

  return list;
}

// ==================== РЕНДЕР ====================

function renderQualityArchive() {
  const cont = document.getElementById('qualityArchiveRoot');
  if (!cont) return;

  const archive = getQualityArchive();
  const list = qaGetFiltered();

  // Уникальные значения для фильтров
  const allPosts = [...new Set(archive.map(a => a.postName).filter(Boolean))].sort();
  const allOps = [...new Set(archive.map(a => a.operatorName).filter(Boolean))].sort();

  let html = '';

  // ---------- Панель фильтров ----------
  html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:16px;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">';
  html += '<div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#64748b;">📦 АРХИВ ДЕФЕКТОВ</div>';
  html += '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">';
  html += `<span style="font-size:11px;color:#64748b;">Всего записей: <b style="color:#334155;">${list.length}</b>${list.length !== archive.length ? ` из ${archive.length}` : ''}</span>`;
  html += `<button class="btn-small" style="font-size:11px;padding:3px 8px;background:#16a34a;color:#fff;border-color:#16a34a;" onclick="qaExportExcel()">📤 Excel</button>`;
  html += `<button class="btn-small" style="font-size:11px;padding:3px 8px;" onclick="qaResetFilters()">↺ Сбросить</button>`;
  html += `<button class="btn-small" style="font-size:11px;padding:3px 8px;" onclick="renderQualityArchive()">🔄 Обновить</button>`;
  html += '</div></div>';

  // Фильтры
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin-bottom:10px;">';

  // Поиск
  html += '<div>';
  html += '<label style="display:block;font-size:10px;color:#64748b;font-weight:600;margin-bottom:2px;">🔍 Поиск</label>';
  html += `<input type="text" value="${escapeAttr(_qaFilters.search)}" placeholder="Пост, оператор, дефект…" oninput="qaSetFilter('search', this.value)" style="width:100%;padding:5px 8px;border:1px solid #cbd5e1;border-radius:4px;font-size:11px;">`;
  html += '</div>';

  // Пост
  html += '<div>';
  html += '<label style="display:block;font-size:10px;color:#64748b;font-weight:600;margin-bottom:2px;">Пост</label>';
  html += `<select onchange="qaSetFilter('post', this.value)" style="width:100%;padding:5px 8px;border:1px solid #cbd5e1;border-radius:4px;font-size:11px;">`;
  html += `<option value="">— все —</option>`;
  allPosts.forEach(p => {
    html += `<option value="${escapeAttr(p)}" ${_qaFilters.post === p ? 'selected' : ''}>${escapeHtml(p)}</option>`;
  });
  html += '</select></div>';

  // Оператор
  html += '<div>';
  html += '<label style="display:block;font-size:10px;color:#64748b;font-weight:600;margin-bottom:2px;">Оператор</label>';
  html += `<select onchange="qaSetFilter('operator', this.value)" style="width:100%;padding:5px 8px;border:1px solid #cbd5e1;border-radius:4px;font-size:11px;">`;
  html += `<option value="">— все —</option>`;
  allOps.forEach(o => {
    html += `<option value="${escapeAttr(o)}" ${_qaFilters.operator === o ? 'selected' : ''}>${escapeHtml(o)}</option>`;
  });
  html += '</select></div>';

  // Статус
  html += '<div>';
  html += '<label style="display:block;font-size:10px;color:#64748b;font-weight:600;margin-bottom:2px;">Статус</label>';
  html += `<select onchange="qaSetFilter('status', this.value)" style="width:100%;padding:5px 8px;border:1px solid #cbd5e1;border-radius:4px;font-size:11px;">`;
  html += `<option value="">— все —</option>`;
  html += `<option value="open" ${_qaFilters.status === 'open' ? 'selected' : ''}>Открыт</option>`;
  html += `<option value="in_progress" ${_qaFilters.status === 'in_progress' ? 'selected' : ''}>В работе</option>`;
  html += `<option value="closed" ${_qaFilters.status === 'closed' ? 'selected' : ''}>Закрыт</option>`;
  html += '</select></div>';

  // Приоритет
  html += '<div>';
  html += '<label style="display:block;font-size:10px;color:#64748b;font-weight:600;margin-bottom:2px;">Приоритет</label>';
  html += `<select onchange="qaSetFilter('priority', this.value)" style="width:100%;padding:5px 8px;border:1px solid #cbd5e1;border-radius:4px;font-size:11px;">`;
  html += `<option value="">— все —</option>`;
  html += `<option value="low" ${_qaFilters.priority === 'low' ? 'selected' : ''}>Низкий</option>`;
  html += `<option value="medium" ${_qaFilters.priority === 'medium' ? 'selected' : ''}>Средний</option>`;
  html += `<option value="high" ${_qaFilters.priority === 'high' ? 'selected' : ''}>Высокий</option>`;
  html += '</select></div>';

  // Дата от
  html += '<div>';
  html += '<label style="display:block;font-size:10px;color:#64748b;font-weight:600;margin-bottom:2px;">Дата от</label>';
  html += `<input type="text" value="${escapeAttr(_qaFilters.dateFrom)}" placeholder="ДД.ММ.ГГГГ" onchange="qaSetFilter('dateFrom', this.value)" style="width:100%;padding:5px 8px;border:1px solid #cbd5e1;border-radius:4px;font-size:11px;">`;
  html += '</div>';

  // Дата до
  html += '<div>';
  html += '<label style="display:block;font-size:10px;color:#64748b;font-weight:600;margin-bottom:2px;">Дата до</label>';
  html += `<input type="text" value="${escapeAttr(_qaFilters.dateTo)}" placeholder="ДД.ММ.ГГГГ" onchange="qaSetFilter('dateTo', this.value)" style="width:100%;padding:5px 8px;border:1px solid #cbd5e1;border-radius:4px;font-size:11px;">`;
  html += '</div>';

  html += '</div>'; // grid filters
  html += '</div>'; // card

  // ---------- Таблица ----------
  html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;overflow-x:auto;">';

  if (list.length === 0) {
    html += '<div style="padding:40px;text-align:center;color:#94a3b8;">Записей нет.</div>';
  } else {
    const mkSortTh = (key, label, extraStyle) => {
      const arrow = _qaSortBy === key ? (_qaSortDir === 'asc' ? ' ↑' : ' ↓') : '';
      const style = `padding:6px 6px;border:1px solid #cbd5e1;cursor:pointer;user-select:none;background:#f1f5f9;${extraStyle || ''}`;
      return `<th style="${style}" onclick="qaSetSort('${key}')" title="Сортировать">${escapeHtml(label)}${arrow}</th>`;
    };

    html += `<table class="quality-board-table" style="width:100%;border-collapse:collapse;font-size:11px;min-width:1200px;">`;
    html += '<thead>';
    html += '<tr style="background:#f1f5f9;">';
    html += mkSortTh('createdDate', 'Дата', 'width:90px;text-align:center;');
    html += mkSortTh('createdTime', 'Время', 'width:70px;text-align:center;');
    html += mkSortTh('postName', 'Пост', 'text-align:left;min-width:110px;');
    html += mkSortTh('operatorName', 'Оператор', 'text-align:left;min-width:120px;');
    html += mkSortTh('defect', 'Дефект', 'text-align:left;min-width:120px;');
    html += mkSortTh('action', 'Действие / Защита клиента', 'text-align:left;min-width:180px;');
    html += mkSortTh('pilot', 'Пилот', 'text-align:left;min-width:100px;');
    html += mkSortTh('deadline', 'Срок', 'width:90px;text-align:center;');
    html += mkSortTh('percent', '%', 'width:50px;text-align:center;');
    html += mkSortTh('priority', 'Приоритет', 'width:90px;text-align:center;');
    html += mkSortTh('status', 'Статус', 'width:90px;text-align:center;');
    html += '</tr>';
    html += '</thead><tbody>';

    const priorityLabels = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
    const priorityColors = { high: '#ef4444', medium: '#f59e0b', low: '#64748b' };
    const statusLabels = { open: 'Открыт', in_progress: 'В работе', closed: 'Закрыт' };
    const statusColors = { open: '#3b82f6', in_progress: '#f59e0b', closed: '#16a34a' };

    list.forEach(rec => {
      const pColor = priorityColors[rec.priority] || '#64748b';
      const sColor = statusColors[rec.status] || '#64748b';

      html += '<tr>';
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:center;">${escapeHtml(rec.createdDate || '')}</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:center;color:#94a3b8;">${escapeHtml(rec.createdTime || '')}</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;font-weight:600;">${escapeHtml(rec.postName || '—')}</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;">${escapeHtml(rec.operatorName || '—')}</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;color:#64748b;">${escapeHtml(rec.defect || '')}</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;">${escapeHtml(rec.action || '')}</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;">${escapeHtml(rec.pilot || '—')}</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:center;">${escapeHtml(rec.deadline || '—')}</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:center;font-weight:700;">${rec.percent || 0}%</td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:center;"><span style="font-size:10px;font-weight:700;color:${pColor};">${escapeHtml(priorityLabels[rec.priority] || rec.priority)}</span></td>`;
      html += `<td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:center;"><span style="font-size:10px;font-weight:700;color:${sColor};">${escapeHtml(statusLabels[rec.status] || rec.status)}</span></td>`;
      html += '</tr>';
    });

    html += '</tbody></table>';
    html += '<div style="font-size:10px;color:#94a3b8;margin-top:6px;">💡 Клик по заголовку столбца — сортировка. Архив только для чтения — удаление недоступно.</div>';
  }

  html += '</div>';

  cont.innerHTML = html;
}

// ==================== ОБРАБОТЧИКИ ФИЛЬТРОВ ====================

function qaSetFilter(field, value) {
  _qaFilters[field] = value || '';
  renderQualityArchive();
}

function qaSetSort(key) {
  if (_qaSortBy === key) {
    _qaSortDir = _qaSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    _qaSortBy = key;
    _qaSortDir = 'asc';
  }
  renderQualityArchive();
}

function qaResetFilters() {
  _qaFilters = {
    search: '', post: '', operator: '', status: '',
    priority: '', dateFrom: '', dateTo: '',
  };
  _qaSortBy = 'createdAt';
  _qaSortDir = 'desc';
  renderQualityArchive();
}

// ==================== ЭКСПОРТ ====================

function qaExportExcel() {
  if (typeof XLSX === 'undefined') { alert('Библиотека XLSX не загружена'); return; }

  const list = qaGetFiltered();
  if (list.length === 0) { alert('Нет записей для экспорта'); return; }

  const rows = [[
    'Дата', 'Время', 'Пост', 'Оператор', 'Дефект',
    'Действие / Защита клиента', 'Пилот', 'Срок', '%',
    'Приоритет', 'Статус', 'Обновлено'
  ]];

  const priorityLabels = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
  const statusLabels = { open: 'Открыт', in_progress: 'В работе', closed: 'Закрыт' };

  list.forEach(rec => {
    rows.push([
      rec.createdDate || '',
      rec.createdTime || '',
      rec.postName || '',
      rec.operatorName || '',
      rec.defect || '',
      rec.action || '',
      rec.pilot || '',
      rec.deadline || '',
      rec.percent || 0,
      priorityLabels[rec.priority] || rec.priority,
      statusLabels[rec.status] || rec.status,
      rec.updatedAt ? new Date(rec.updatedAt).toLocaleString('ru-RU') : '',
    ]);
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Архив дефектов');
  XLSX.writeFile(wb, `Архив_дефектов_${getCurrentSection().name}_${formatDate().replace(/\./g, '-')}.xlsx`);
  logAudit('export_excel', 'Архив дефектов', getCurrentSection().name);
}

// ==================== ЭКСПОРТ В WINDOW ====================

window.qualityArchive = {
  get: getQualityArchive,
  add: qualityArchiveAdd,
  update: qualityArchiveUpdate,
  markDeleted: qualityArchiveMarkDeleted,
  render: renderQualityArchive,
  setFilter: qaSetFilter,
  setSort: qaSetSort,
  resetFilters: qaResetFilters,
  exportExcel: qaExportExcel,
  getFiltered: qaGetFiltered,
};