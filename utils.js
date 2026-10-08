// ======================== УТИЛИТЫ ========================

function showInlineSelect(cell, currentValue, options, callback) {
  const old = document.querySelector('.inline-select');
  if (old) old.remove();

  const wrapper = document.createElement('div');
  wrapper.className = 'inline-select';
  wrapper.style.cssText = `position:fixed;z-index:9999;width:200px;font-size:13px;border:2px solid #3b82f6;border-radius:6px;background:white;box-shadow:0 4px 12px rgba(0,0,0,0.15);`;

  const select = document.createElement('select');
  select.style.cssText = 'width:100%;padding:8px;border:none;font-size:13px;background:white;outline:none;';
  select.size = Math.min(options.length, 6);
  options.forEach(opt => {
    const el = document.createElement('option');
    el.value = opt.value; el.textContent = opt.label;
    if (opt.value === currentValue) el.selected = true;
    select.appendChild(el);
  });

  let closed = false;
  const doClose = (runCallback) => {
    if (closed) return;
    closed = true;
    document.removeEventListener('click', closeHandler);
    document.removeEventListener('keydown', escHandler);
    wrapper.remove();
    if (runCallback) setTimeout(() => callback(select.value), 0);
  };

  const closeHandler = (e) => {
    if (!wrapper.contains(e.target)) doClose(false);
  };
  const escHandler = (e) => { if (e.key === 'Escape') doClose(false); };

  select.onchange = () => doClose(true);
  select.onkeydown = (e) => { if (e.key === 'Escape') doClose(false); };

  setTimeout(() => {
    document.addEventListener('click', closeHandler);
    document.addEventListener('keydown', escHandler);
  }, 0);

  wrapper.appendChild(select);
  document.body.appendChild(wrapper);

  const rect = cell.getBoundingClientRect();
  let left = rect.left, top = rect.bottom + 2;
  const h = select.size * 24 + 20;
  if (left + 200 > window.innerWidth) left = window.innerWidth - 205;
  if (left < 5) left = 5;
  if (top + h > window.innerHeight) top = rect.top - h - 2;
  if (top < 5) top = 5;
  wrapper.style.left = left + 'px';
  wrapper.style.top = top + 'px';
  setTimeout(() => select.focus(), 50);
}

function showCenteredSelect(titleText, currentValue, options, callback) {
  const old = document.querySelector('.inline-select');
  if (old) old.remove();

  const wrapper = document.createElement('div');
  wrapper.className = 'inline-select';
  wrapper.style.cssText = `position:fixed;z-index:9999;top:50%;left:50%;transform:translate(-50%,-50%);width:260px;background:white;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.2);padding:12px;`;

  const title = document.createElement('div');
  title.textContent = titleText;
  title.style.cssText = 'font-weight:700;font-size:14px;margin-bottom:8px;color:#0f172a;';
  wrapper.appendChild(title);

  const escHandler = (e) => {
    if (e.key === 'Escape') { wrapper.remove(); document.removeEventListener('keydown', escHandler); }
  };

  options.forEach(opt => {
    const btn = document.createElement('div');
    btn.textContent = opt.label;
    const isActive = opt.value === currentValue;
    btn.style.cssText = `padding:10px 14px;margin:4px 0;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500;background:${isActive?'#e0f2fe':'#f8fafc'};color:${isActive?'#0369a1':'#1e293b'};`;
    btn.onmouseenter = () => { if (!isActive) btn.style.background = '#f1f5f9'; };
    btn.onmouseleave = () => { if (!isActive) btn.style.background = '#f8fafc'; };
    btn.onclick = () => { callback(opt.value); wrapper.remove(); document.removeEventListener('keydown', escHandler); };
    wrapper.appendChild(btn);
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Отмена';
  cancelBtn.style.cssText = 'width:100%;margin-top:8px;padding:8px;border:1px solid #cbd5e1;border-radius:8px;background:white;cursor:pointer;font-size:13px;';
  cancelBtn.onclick = () => { wrapper.remove(); document.removeEventListener('keydown', escHandler); };
  wrapper.appendChild(cancelBtn);

  document.addEventListener('keydown', escHandler);
  document.body.appendChild(wrapper);
}

function showModal(titleText, fields, onSubmit) {
  const old = document.querySelector('.modal-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9999;display:flex;align-items:center;justify-content:center;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:white;border-radius:12px;padding:20px;min-width:340px;max-width:90vw;max-height:90vh;overflow-y:auto;';
  modal.innerHTML = `<h3 style="margin-bottom:14px;font-size:16px;color:#0f172a;">${escapeHtml(titleText)}</h3>`;

  const inputs = {};
  fields.forEach(f => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom:10px;';

    const lbl = document.createElement('label');
    lbl.textContent = f.label;
    lbl.style.cssText = 'display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px;';
    wrap.appendChild(lbl);

    let input;
    if (f.type === 'select') {
      input = document.createElement('select');
      f.options.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value; opt.textContent = o.label;
        if (o.value === f.value) opt.selected = true;
        input.appendChild(opt);
      });
    } else {
      input = document.createElement('input');
      input.type = f.type || 'text';
      input.value = f.value || '';
    }
    input.style.cssText = 'width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;';
    wrap.appendChild(input);
    modal.appendChild(wrap);
    inputs[f.name] = input;
  });

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:14px;';

  const closeOverlay = () => {
    overlay.onclick = null;
    overlay.remove();
  };

  const cancel = document.createElement('button');
  cancel.textContent = 'Отмена';
  cancel.style.cssText = 'padding:8px 16px;border:1px solid #cbd5e1;border-radius:6px;background:white;cursor:pointer;font-size:13px;';
  cancel.onclick = closeOverlay;

  const ok = document.createElement('button');
  ok.textContent = 'Сохранить';
  ok.style.cssText = 'padding:8px 16px;border:none;border-radius:6px;background:#3b82f6;color:white;cursor:pointer;font-size:13px;font-weight:600;';
  ok.onclick = () => {
    const values = {};
    fields.forEach(f => { values[f.name] = inputs[f.name].value; });
    onSubmit(values, overlay);
  };

  btnRow.appendChild(cancel);
  btnRow.appendChild(ok);
  modal.appendChild(btnRow);

  overlay.appendChild(modal);
  overlay.onclick = (e) => { if (e.target === overlay) closeOverlay(); };
  document.body.appendChild(overlay);
  setTimeout(() => { const first = Object.values(inputs)[0]; if (first) first.focus(); }, 50);
}

let currentMenu = null;
function hideMenu() { if (currentMenu) { currentMenu.remove(); currentMenu = null; } }

function safeSheetName(name) {
  return String(name).replace(/[\\\/\?\*\[\]:]/g, '_').slice(0, 31);
}

// ======================== КАРТА ПОСЛЕДНИХ НАЗНАЧЕНИЙ ========================
// Общая функция для dashboard.js и notifications.js.
// Ключ: `${opName}|${postName}` → Date последнего назначения.
// Строится ОДИН раз, чтобы избежать O(N_op × N_post × N_log).
function buildLastPlacementMap() {
  const map = new Map();
  const log = getSystem().placementLog || [];
  for (const e of log) {
    if (!e.opName || !e.postName || !e.date) continue;
    const p = e.date.split('.');
    if (p.length !== 3) continue;
    const d = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
    if (isNaN(d.getTime())) continue;
    const key = `${e.opName}|${e.postName}`;
    const cur = map.get(key);
    if (!cur || d > cur) map.set(key, d);
  }
  return map;
}

// ======================== ПОДСЧЁТ МЕТРИК ПОСТА ========================
// Единая логика: считаем U/2L/3L по посту с учётом НАЗНАЧЕНИЯ операторов.
// Раньше эта логика дублировалась в dashboard.js, notifications.js,
// compare.js, cross-section.js — и везде была ошибка: считались уровни
// у ВСЕХ операторов смены, даже если оператор не назначен на пост.

/**
 * Считает метрики одного поста для одного дня.
 * @param {Object} post - объект поста (id, name, ...)
 * @param {Object} day - день из shiftData.days[date]
 * @param {Array} shiftOperators - массив операторов смены
 * @returns {{assigned: Array<string>, hasU: boolean, cntLU: number, cntL: number, cntU: number, isFree: boolean}}
 */
function getPostMetrics(post, day, shiftOperators) {
  const assigned = normalizeAssignment(day?.assignments?.[post.id]);
  const assignedSet = new Set(assigned);

  let hasU = false;
  let cntLU = 0;
  let cntL = 0;
  let cntU = 0;

  shiftOperators.forEach(op => {
    if (op.role === 'НУ' || op.role === 'СО') return;
    if (!assignedSet.has(op.id)) return; // ← ключевое: только назначенные
    const lvl = day?.levels?.[post.id]?.[op.id];
    if (lvl === 'U') { hasU = true; cntU++; cntLU++; }
    else if (lvl === 'L' || lvl === 'Lкр') { cntL++; cntLU++; }
  });

  return {
    assigned,
    hasU,
    cntLU,
    cntL,
    cntU,
    isFree: assigned.length === 0
  };
}

/**
 * Считает агрегированные метрики для всего участка (смены A/B/C по дню).
 * Используется в dashboard.js, compare.js, cross-section.js.
 */
function computeSectionMetrics(section, shift, dateStr) {
  const shiftData = section.shifts?.[shift] || { operators: [], days: {} };
  const realOps = (shiftData.operators || []).filter(o => o.role !== 'НУ' && o.role !== 'СО');
  const posts = section.posts || [];
  const day = shiftData.days?.[dateStr] || { assignments: {}, attendance: {}, levels: {} };

  let present = 0, vacation = 0, sick = 0, absent = 0, fired = 0, other = 0;
  realOps.forEach(op => {
    const a = day.attendance?.[op.id] || 'Я';
    if (a === 'Я') present++;
    else if (a === 'О') vacation++;
    else if (a === 'Б') sick++;
    else if (a === 'Н') absent++;
    else if (a === 'У') fired++;
    else if (a === 'С') other++;
  });

  let postsWithU = 0, posts2L = 0, posts3L = 0, postsFree = 0;
  posts.forEach(p => {
    const m = getPostMetrics(p, day, realOps);
    if (m.isFree) postsFree++;
    if (m.hasU) postsWithU++;
    if (m.cntLU >= 2) posts2L++;
    if (m.cntLU >= 3) posts3L++;
  });

  const pctU     = posts.length ? Math.round((postsWithU / posts.length) * 100) : 0;
  const pct2L    = posts.length ? Math.round((posts2L / posts.length) * 100) : 0;
  const pct3L    = posts.length ? Math.round((posts3L / posts.length) * 100) : 0;
  const pctAtt   = realOps.length ? Math.round((present / realOps.length) * 100) : 0;
  const pctFill  = posts.length ? Math.round(((posts.length - postsFree) / posts.length) * 100) : 0;

  let totalPoly = 0;
  realOps.forEach(op => {
    let cnt = 0;
    posts.forEach(p => {
      const assigned = normalizeAssignment(day.assignments?.[p.id]);
      if (!assigned.includes(op.id)) return;
      const lvl = day.levels?.[p.id]?.[op.id];
      if (lvl === 'L' || lvl === 'U' || lvl === 'Lкр') cnt++;
    });
    totalPoly += cnt;
  });
  const avgPoly = realOps.length ? (totalPoly / realOps.length).toFixed(1) : '0.0';

  return {
    operators: realOps.length,
    posts: posts.length,
    present, vacation, sick, absent, fired, other,
    pctAtt, pctFill, pctU, pct2L, pct3L,
    postsFree, postsWithU, posts2L, posts3L,
    avgPoly
  };
}

// ======================== ГЛОБАЛЬНЫЙ TOAST ========================
function showToast(text) {
  let el = document.getElementById('iluToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'iluToast';
    el.className = 'ilu-toast';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(el._toastTimer);
  el._toastTimer = setTimeout(() => {
    el.classList.remove('show');
  }, 1800);
}