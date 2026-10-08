// ======================== АУДИТ ========================

const AUDIT_ACTION_LABELS = {
  assign: '✅ Назначение',
  unassign: '❌ Снятие',
  attendance: '⚠️ Снят (явка)',
  replace: '🔄 Замена',
  add_post: '➕ Пост добавлен',
  update_post: '✏️ Пост изменён',
  delete_post: '🗑 Пост удалён',
  add_operator: '➕ Оператор добавлен',
  update_operator: '✏️ Оператор изменён',
  delete_operator: '🗑 Оператор удалён',
  add_section: '➕ Участок добавлен',
  rename_section: '✏️ Участок переименован',
  delete_section: '🗑 Участок удалён',
  add_training: '🎓 Обучение добавлено',
  delete_training: '🗑 Обучение удалено',
  update_training: '✏️ Обучение изменено',
  apply_training: '✔ Обучение применено',
  save_rotation: '💾 План ротации сохранён',
  clear_rotation: '🗑 План ротации очищен',
  generate_rotation: '🎲 План ротации сгенерирован',
  apply_rotation: '🎯 План ротации применён',
  save_development: '💾 План развития сохранён',
  clear_development: '🗑 План развития очищен',
  save_theme: '🎨 Тема изменена',
  save_manual: '💾 Ручное сохранение',
  import_system: '📥 Импорт системы',
  export_excel: '📤 Экспорт в Excel',
  export_json: '💾 Экспорт в JSON',
  reset_system: '⚠️ Полный сброс',
  add_department: '➕ Департамент добавлен',
  rename_department: '✏️ Департамент переименован',
  delete_department: '🗑 Департамент удалён',
  add_workshop: '➕ Цех добавлен',
  rename_workshop: '✏️ Цех переименован',
  delete_workshop: '🗑 Цех удалён',
  edit_chief: '👔 Изменён руководитель',
  change_filter: '🔍 Изменён фильтр',
  update_norm: '⚙️ Изменена норма',
  change_user: '👤 Смена пользователя',
  auto_fill: '🤖 Авто-расстановка',
  auto_apply: '🤖 Авто-применение',
  auto_apply_setting: '⚙️ Настройки авто-применения',
  add_custom_table: '📊 Таблица добавлена',
  update_custom_table: '✏️ Таблица изменена',
  delete_custom_table: '🗑 Таблица удалена',
  export_custom_table: '📤 Экспорт таблицы',
  import_excel_data: '📥 Импорт данных из таблицы'
};

function renderAudit() {
  const tbody = document.querySelector('#auditTable tbody');
  const countLabel = document.getElementById('auditCountLabel');
  if (!tbody) return;

  const periodEl = document.getElementById('auditPeriod');
  const actionEl = document.getElementById('auditActionFilter');
  const searchEl = document.getElementById('auditSearch');

  const period = periodEl ? periodEl.value : '30';
  const actionFilter = actionEl ? actionEl.value : '';
  const search = (searchEl ? searchEl.value : '').trim().toLowerCase();

  let list = (getSystem().auditLog || []).slice();
  list.reverse();

  if (period !== 'all') {
    const now = new Date();
    let fromTime = 0;
    if (period === 'today') {
      fromTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    } else {
      const days = parseInt(period) || 30;
      fromTime = now.getTime() - days * 86400000;
    }
    list = list.filter(e => (e.timestamp || 0) >= fromTime);
  }

  if (actionFilter) {
    list = list.filter(e => e.action === actionFilter);
  }

  if (search) {
    list = list.filter(e =>
      (e.user || '').toLowerCase().includes(search) ||
      (e.target || '').toLowerCase().includes(search) ||
      (e.details || '').toLowerCase().includes(search) ||
      (e.action || '').toLowerCase().includes(search)
    );
  }

  if (countLabel) countLabel.textContent = `Записей: ${list.length}`;

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:40px;">Записей нет</td></tr>';
    return;
  }

  const frag = document.createDocumentFragment();
  list.slice(0, 1000).forEach(e => {
    const tr = document.createElement('tr');

    const tdDate = document.createElement('td');
    tdDate.textContent = e.date || '—';

    const tdTime = document.createElement('td');
    tdTime.textContent = e.time || '—';

    const tdUser = document.createElement('td');
    tdUser.textContent = e.user || '—';

    const tdAction = document.createElement('td');
    const label = AUDIT_ACTION_LABELS[e.action] || e.action;
    const color = (e.action === 'assign' || (e.action || '').startsWith('add_')) ? '#16a34a'
                : (e.action === 'unassign' || (e.action || '').startsWith('delete_')) ? '#ef4444'
                : e.action === 'attendance' ? '#f59e0b'
                : e.action === 'reset_system' ? '#ef4444'
                : '#64748b';
    tdAction.textContent = label;
    tdAction.style.color = color;
    tdAction.style.fontWeight = '600';

    const tdTarget = document.createElement('td');
    tdTarget.textContent = e.target || '—';
    tdTarget.style.textAlign = 'left';

    const tdDetails = document.createElement('td');
    tdDetails.textContent = e.details || '';
    tdDetails.style.textAlign = 'left';
    tdDetails.style.fontSize = '11px';
    tdDetails.style.color = '#64748b';

    tr.appendChild(tdDate);
    tr.appendChild(tdTime);
    tr.appendChild(tdUser);
    tr.appendChild(tdAction);
    tr.appendChild(tdTarget);
    tr.appendChild(tdDetails);
    frag.appendChild(tr);
  });

  tbody.innerHTML = '';
  tbody.appendChild(frag);
}

function resetAuditFilters() {
  const p = document.getElementById('auditPeriod');
  const a = document.getElementById('auditActionFilter');
  const s = document.getElementById('auditSearch');
  if (p) p.value = '30';
  if (a) a.value = '';
  if (s) s.value = '';
  renderAudit();
}

function exportAuditToExcel() {
  if (typeof XLSX === 'undefined') { alert('Библиотека XLSX не загружена'); return; }
  const list = (getSystem().auditLog || []).slice().reverse();
  const wb = XLSX.utils.book_new();
  const rows = [['Дата', 'Время', 'Пользователь', 'Действие', 'Объект', 'Детали']];
  list.forEach(e => {
    rows.push([
      e.date || '', e.time || '', e.user || '',
      AUDIT_ACTION_LABELS[e.action] || e.action,
      e.target || '', e.details || ''
    ]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Аудит');
  XLSX.writeFile(wb, 'Аудит_' + formatDate().replace(/\./g, '-') + '.xlsx');
}

function setCurrentUser(name) {
  const sys = getSystem();
  sys.currentUser = (name || '').trim() || 'Оператор';
  saveSystem();
  logAudit('change_user', 'Пользователь', `Установлено ФИО: ${sys.currentUser}`);
}

function loadCurrentUser() {
  const input = document.getElementById('currentUserName');
  if (!input) return;
  const sys = getSystem();
  input.value = sys.currentUser || '';
}