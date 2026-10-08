// ======================== ЖУРНАЛ РАССТАНОВКИ ========================

let placementFilterDate = '';
let placementFilterOp = '';
let placementFilterPost = '';

function logPlacement(opName, postName, action = 'assign') {
  const now = new Date();
  const date = now.toLocaleDateString('ru-RU');
  const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const log = getSystem().placementLog || [];
  log.push({ date, time, opName, postName, action });
  getSystem().placementLog = log;
  saveSystem();
  renderPlacementLog();
}

function renderPlacementLog() {
  const tbody = document.querySelector('#placementLogTable tbody');
  if (!tbody) return; // ← защита от отсутствия DOM

  const log = getSystem().placementLog || [];
  let list = log;

  if (placementFilterDate) list = list.filter(e => e.date === placementFilterDate);
  if (placementFilterOp)   list = list.filter(e => e.opName === placementFilterOp);
  if (placementFilterPost) list = list.filter(e => e.postName === placementFilterPost);

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:40px;">Журнал пуст</td></tr>';
    return;
  }

  const sorted = [...list].sort((a, b) => {
    const [d1, m1, y1] = a.date.split('.');
    const [d2, m2, y2] = b.date.split('.');
    const t1 = a.time ? a.time.split(':') : [0, 0];
    const t2 = b.time ? b.time.split(':') : [0, 0];
    return new Date(Number(y2), Number(m2) - 1, Number(d2), Number(t2[0]), Number(t2[1])) -
           new Date(Number(y1), Number(m1) - 1, Number(d1), Number(t1[0]), Number(t1[1]));
  });

  tbody.innerHTML = sorted.map(e => {
    const lbl = e.action === 'assign' ? '✅ Назначен' :
                e.action === 'unassign' ? '❌ Снят' :
                e.action === 'attendance' ? '⚠️ Снят (явка)' :
                e.action === 'replace' ? '🔄 Замена' : e.action;
    const col = e.action === 'assign' ? '#16a34a' :
                e.action === 'unassign' ? '#ef4444' :
                e.action === 'attendance' ? '#f59e0b' : '#64748b';
    return `<tr>
      <td>${escapeHtml(e.date)}${e.time ? ' ' + escapeHtml(e.time) : ''}</td>
      <td>${escapeHtml(e.opName)}</td>
      <td>${escapeHtml(e.postName)}</td>
      <td style="color:${col};font-weight:600;">${escapeHtml(lbl)}</td>
    </tr>`;
  }).join('');
}

function setPlacementFilter(date) { placementFilterDate = date; renderPlacementLog(); }
function setPlacementFilterOperator(name) { placementFilterOp = name; renderPlacementLog(); }
function setPlacementFilterPost(name) { placementFilterPost = name; renderPlacementLog(); }
function resetPlacementFilters() {
  placementFilterDate = '';
  placementFilterOp = '';
  placementFilterPost = '';
  const d = document.getElementById('placementFilter');
  if (d) d.value = '';
  const o = document.getElementById('placementFilterOp');
  if (o) o.value = '';
  const p = document.getElementById('placementFilterPost');
  if (p) p.value = '';
  renderPlacementLog();
}

function fillPlacementFilters() {
  const selOp = document.getElementById('placementFilterOp');
  const selPost = document.getElementById('placementFilterPost');
  if (selOp) {
    const ops = getCurrentOperators().map(o => o.name);
    selOp.innerHTML = '<option value="">— все —</option>' +
      ops.map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
    selOp.value = placementFilterOp;
  }
  if (selPost) {
    const psts = getCurrentSection().posts.map(p => p.name);
    selPost.innerHTML = '<option value="">— все —</option>' +
      psts.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
    selPost.value = placementFilterPost;
  }
}

function exportPlacementLogToExcel() {
  if (typeof XLSX === 'undefined') { alert('Библиотека XLSX не загружена'); return; }
  const log = getSystem().placementLog || [];
  const wb = XLSX.utils.book_new();
  const rows = [['Дата', 'Время', 'Оператор', 'Пост', 'Действие']];
  log.forEach(e => rows.push([e.date, e.time || '', e.opName, e.postName, e.action]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Журнал расстановки');
  XLSX.writeFile(wb, 'Журнал_расстановки_' + formatDate().replace(/\./g, '-') + '.xlsx');
}