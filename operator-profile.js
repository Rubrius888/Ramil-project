// ======================== ПРОФИЛЬ ОПЕРАТОРА И ПОСТА ========================

console.log('[operator-profile.js] Загружен');

let profileCurrentOpIdx = -1;
let postProfileCurrentIdx = -1;

// ======================== ОПЕРАТОР ========================
function openOperatorProfile(opIdx) {
  const opList = getCurrentOperators();
  const op = opList[opIdx];
  if (!op) return;

  profileCurrentOpIdx = opIdx;
  const modal = document.getElementById('operatorProfileModal');
  const title = document.getElementById('operatorProfileTitle');
  const body = document.getElementById('operatorProfileBody');
  if (!modal || !title || !body) return;

  title.textContent = '👤 ' + op.name;
  body.innerHTML = '';
  body.appendChild(buildOperatorProfile(op));
  modal.classList.add('open');
}

function closeOperatorProfile() {
  const modal = document.getElementById('operatorProfileModal');
  if (modal) modal.classList.remove('open');
  profileCurrentOpIdx = -1;
}

// ======================== ПОСТ ========================
function openPostProfile(postIdx) {
  const section = getCurrentSection();
  const post = section.posts[postIdx];
  if (!post) { alert('Пост не найден'); return; }

  postProfileCurrentIdx = postIdx;
  const modal = document.getElementById('postProfileModal');
  const title = document.getElementById('postProfileTitle');
  const body = document.getElementById('postProfileBody');

  if (!modal || !title || !body) {
    console.warn('Модалка #postProfileModal не найдена в HTML');
    return;
  }

  title.textContent = '📍 ' + post.name;
  body.innerHTML = '';
  body.appendChild(buildPostProfile(post, postIdx));
  modal.classList.add('open');
}

function closePostProfile() {
  const modal = document.getElementById('postProfileModal');
  if (modal) modal.classList.remove('open');
  postProfileCurrentIdx = -1;
}

function findPostById(postId) {
  const section = getCurrentSection();
  return section.posts.find(p => p.id === postId) || null;
}

// ======================== ХЕЛПЕРЫ ========================
function safeRenderMatrix() {
  if (typeof renderMatrix === 'function') {
    try { renderMatrix(); } catch (e) {}
  }
}
function safeRenderSE8() {
  if (typeof renderSE8Blank === 'function') {
    try { renderSE8Blank(); } catch (e) {}
  }
}

function findOperatorById(opId) {
  const section = getCurrentSection();
  for (const shift of SHIFTS) {
    const sd = section.shifts?.[shift];
    if (!sd) continue;
    const op = (sd.operators || []).find(o => o.id === opId);
    if (op) return op;
  }
  return null;
}

// ======================== ФАЙЛЫ ========================
function getFileIcon(fileName, mime) {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  if (['xlsx', 'xls', 'csv'].includes(ext)) return '📊';
  if (['docx', 'doc', 'rtf'].includes(ext)) return '📝';
  if (['pdf'].includes(ext)) return '📕';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return '🖼';
  if ((mime || '').startsWith('image/')) return '🖼';
  return '📄';
}

function formatFileSize(bytes) {
  if (!bytes) return '0 Б';
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
  return (bytes / 1024 / 1024).toFixed(2) + ' МБ';
}

function formatFileDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU') + ' ' +
           d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch (e) { return ''; }
}

function findFileById(fileId) {
  const section = getCurrentSection();
  for (const shift of SHIFTS) {
    const sd = section.shifts?.[shift];
    if (!sd) continue;
    for (const op of sd.operators || []) {
      if (Array.isArray(op.files)) {
        const f = op.files.find(x => x.id === fileId);
        if (f) return f;
      }
    }
  }
  for (const post of section.posts || []) {
    if (Array.isArray(post.files)) {
      const f = post.files.find(x => x.id === fileId);
      if (f) return f;
    }
  }
  return null;
}

function previewOperatorFile(fileId) {
  const file = findFileById(fileId);
  if (!file) { alert('Файл не найден'); return; }
  if (!file.data) { alert('Файл повреждён или не содержит данных'); return; }

  const ext = (file.ext || file.name.split('.').pop() || '').toLowerCase();
  const dataUrl = file.data;

  if (['xlsx', 'xls', 'csv'].includes(ext)
      && typeof openExcelFilePreview === 'function') {
    openExcelFilePreview(file.name, dataUrl);
    return;
  }

  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
  const directExts = ['pdf', 'txt'];
  const officeExts = ['docx', 'doc', 'rtf'];

  try {
    const [meta, base64] = dataUrl.split(',');
    const mimeMatch = meta.match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

    const byteChars = atob(base64);
    const byteArr = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArr], { type: mime });
    const blobUrl = URL.createObjectURL(blob);

    if (imageExts.includes(ext) || directExts.includes(ext)) {
      const w = window.open(blobUrl, '_blank');
      if (!w) {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = file.name;
        a.target = '_blank';
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
      return;
    }

    if (officeExts.includes(ext)) {
      const w = window.open(blobUrl, '_blank');
      if (!w) {
        const doDownload = confirm(
          `Файл «${file.name}» нельзя открыть прямо в браузере.\n\n` +
          `Скачать его, чтобы открыть в приложении?`
        );
        if (doDownload) {
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = file.name;
          a.click();
        }
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    }

    const w = window.open(blobUrl, '_blank');
    if (!w) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = file.name;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);

  } catch (err) {
    console.error('Ошибка предпросмотра:', err);
    alert('Не удалось открыть предпросмотр. Разрешите всплывающие окна.');
  }
}

function downloadOperatorFile(fileId) {
  const file = findFileById(fileId);
  if (!file) { alert('Файл не найден'); return; }
  const a = document.createElement('a');
  a.href = file.data;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ======================== ЗАГРУЗКА / УДАЛЕНИЕ ФАЙЛОВ ========================
function uploadOperatorFile(opId, file, onDone) {
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) {
    alert('Файл слишком большой. Максимум 3 МБ.');
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    const op = findOperatorById(opId);
    if (!op) { alert('Оператор не найден'); return; }
    if (!Array.isArray(op.files)) op.files = [];
    op.files.push({
      id: genId(),
      name: file.name,
      size: file.size,
      type: file.type || '',
      ext: (file.name.split('.').pop() || '').toLowerCase(),
      uploadedAt: new Date().toISOString(),
      data: ev.target.result
    });
    saveSystem();
    if (typeof logAudit === 'function') logAudit('update_operator', op.name, `Загружен файл: ${file.name}`);
    if (typeof showToast === 'function') showToast('📎 Файл добавлен');
    if (typeof onDone === 'function') onDone();
  };
  reader.readAsDataURL(file);
}

function deleteOperatorFile(opId, fileId, onDone) {
  const op = findOperatorById(opId);
  if (!op || !Array.isArray(op.files)) return;
  const file = op.files.find(f => f.id === fileId);
  if (!file) return;
  if (!confirm(`Удалить файл «${file.name}»?`)) return;
  op.files = op.files.filter(f => f.id !== fileId);
  saveSystem();
  if (typeof logAudit === 'function') logAudit('update_operator', op.name, `Удалён файл: ${file.name}`);
  if (typeof showToast === 'function') showToast('🗑 Файл удалён');
  if (typeof onDone === 'function') onDone();
}

function uploadPostFile(postId, file, onDone) {
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) {
    alert('Файл слишком большой. Максимум 3 МБ.');
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    const post = findPostById(postId);
    if (!post) { alert('Пост не найден'); return; }
    if (!Array.isArray(post.files)) post.files = [];
    post.files.push({
      id: genId(),
      name: file.name,
      size: file.size,
      type: file.type || '',
      ext: (file.name.split('.').pop() || '').toLowerCase(),
      uploadedAt: new Date().toISOString(),
      data: ev.target.result
    });
    saveSystem();
    if (typeof logAudit === 'function') logAudit('update_post', post.name, `Загружен файл: ${file.name}`);
    if (typeof showToast === 'function') showToast('📎 Файл добавлен к посту');
    if (typeof onDone === 'function') onDone();
  };
  reader.readAsDataURL(file);
}

function deletePostFile(postId, fileId, onDone) {
  const post = findPostById(postId);
  if (!post || !Array.isArray(post.files)) return;
  const file = post.files.find(f => f.id === fileId);
  if (!file) return;
  if (!confirm(`Удалить файл «${file.name}»?`)) return;
  post.files = post.files.filter(f => f.id !== fileId);
  saveSystem();
  if (typeof logAudit === 'function') logAudit('update_post', post.name, `Удалён файл: ${file.name}`);
  if (typeof showToast === 'function') showToast('🗑 Файл удалён');
  if (typeof onDone === 'function') onDone();
}

// ======================== ДОКУМЕНТЫ ========================
function buildDocsSection(owner, ownerType, onRefresh) {
  const docsSection = document.createElement('div');
  docsSection.className = 'profile-section';

  const docsTitle = document.createElement('div');
  docsTitle.className = 'profile-section-title';
  docsTitle.textContent = '📎 Документы';
  docsSection.appendChild(docsTitle);

  const docsControls = document.createElement('div');
  docsControls.className = 'profile-docs-controls';

  const fileInputDocs = document.createElement('input');
  fileInputDocs.type = 'file';
  fileInputDocs.accept = '.xlsx,.xls,.csv,.docx,.doc,.rtf,.pdf,.txt,.png,.jpg,.jpeg';
  fileInputDocs.style.display = 'none';

  const addFileBtn = document.createElement('button');
  addFileBtn.className = 'btn-small profile-add-file-btn';
  addFileBtn.textContent = '➕ Добавить файл';
  addFileBtn.onclick = () => fileInputDocs.click();

  fileInputDocs.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (ownerType === 'operator') {
      uploadOperatorFile(owner.id, file, onRefresh);
    } else {
      uploadPostFile(owner.id, file, onRefresh);
    }
    e.target.value = '';
  };

  docsControls.appendChild(addFileBtn);
  docsControls.appendChild(fileInputDocs);

  const docsHint = document.createElement('span');
  docsHint.className = 'profile-docs-hint';
  docsHint.textContent = 'Excel, Word, PDF, изображения · до 3 МБ';
  docsControls.appendChild(docsHint);

  docsSection.appendChild(docsControls);

  const docsList = document.createElement('div');
  docsList.className = 'profile-docs-list';

  const files = Array.isArray(owner.files) ? owner.files : [];
  if (files.length === 0) {
    docsList.innerHTML = '<div class="profile-empty">Файлов нет</div>';
  } else {
    files.slice().sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || '')).forEach(f => {
      const row = document.createElement('div');
      row.className = 'profile-doc-row';

      const icon = document.createElement('span');
      icon.className = 'profile-doc-icon';
      icon.textContent = getFileIcon(f.name, f.type);

      const meta = document.createElement('div');
      meta.className = 'profile-doc-meta';
      meta.innerHTML = `<div class="profile-doc-name">${escapeHtml(f.name)}</div>
                        <div class="profile-doc-sub">${formatFileSize(f.size)} · ${formatFileDate(f.uploadedAt)}</div>`;

      const actions = document.createElement('div');
      actions.className = 'profile-doc-actions';

      const viewBtn = document.createElement('button');
      viewBtn.className = 'btn-small';
      viewBtn.textContent = '👁';
      viewBtn.title = 'Просмотр';
      viewBtn.onclick = () => previewOperatorFile(f.id);

      const dlBtn = document.createElement('button');
      dlBtn.className = 'btn-small';
      dlBtn.textContent = '⬇';
      dlBtn.title = 'Скачать';
      dlBtn.onclick = () => downloadOperatorFile(f.id);

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-small danger';
      delBtn.textContent = '🗑';
      delBtn.title = 'Удалить';
      delBtn.onclick = () => {
        if (ownerType === 'operator') {
          deleteOperatorFile(owner.id, f.id, onRefresh);
        } else {
          deletePostFile(owner.id, f.id, onRefresh);
        }
      };

      actions.appendChild(viewBtn);
      actions.appendChild(dlBtn);
      actions.appendChild(delBtn);
      row.appendChild(icon);
      row.appendChild(meta);
      row.appendChild(actions);
      docsList.appendChild(row);
    });
  }

  docsSection.appendChild(docsList);
  return docsSection;
}

// ======================== ПРОФИЛЬ ОПЕРАТОРА ========================
function buildOperatorProfile(op) {
  const section = getCurrentSection();
  const day = getCurrentDay();
  const posts = section.posts;

  const wrapper = document.createElement('div');

  // -------- ФОТО --------
  const photoSection = document.createElement('div');
  photoSection.className = 'profile-photo-section';

  const photoWrap = document.createElement('div');
  photoWrap.className = 'profile-photo-wrap';

  const img = document.createElement('img');
  img.className = 'profile-photo';
  img.alt = op.name;
  if (op.photo) img.src = op.photo;
  else img.classList.add('profile-photo-empty');
  photoWrap.appendChild(img);

  if (!op.photo) {
    const initials = document.createElement('div');
    initials.className = 'profile-photo-initials';
    initials.textContent = op.name.split(' ').map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
    photoWrap.appendChild(initials);
  }

  const photoBtns = document.createElement('div');
  photoBtns.className = 'profile-photo-btns';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';

  const uploadBtn = document.createElement('button');
  uploadBtn.className = 'btn-small';
  uploadBtn.textContent = '📷 Загрузить фото';
  uploadBtn.onclick = () => fileInput.click();

  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const srcImg = new Image();
      srcImg.onload = () => {
        const MAX = 220;
        const ratio = Math.min(MAX / srcImg.width, MAX / srcImg.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(srcImg.width * ratio));
        canvas.height = Math.max(1, Math.round(srcImg.height * ratio));
        canvas.getContext('2d').drawImage(srcImg, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        updateOperator(op.id, { photo: dataUrl });
        openOperatorProfile(profileCurrentOpIdx);
        safeRenderMatrix();
        safeRenderSE8();
      };
      srcImg.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn-small danger';
  removeBtn.textContent = '🗑 Удалить фото';
  removeBtn.onclick = () => {
    if (!confirm('Удалить фото?')) return;
    updateOperator(op.id, { photo: '' });
    openOperatorProfile(profileCurrentOpIdx);
    safeRenderMatrix();
    safeRenderSE8();
  };

  photoBtns.appendChild(uploadBtn);
  if (op.photo) photoBtns.appendChild(removeBtn);
  photoBtns.appendChild(fileInput);
  photoSection.appendChild(photoWrap);
  photoSection.appendChild(photoBtns);
  wrapper.appendChild(photoSection);

  // -------- ТЕГИ --------
  const tagsWrap = document.createElement('div');
  tagsWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;';
  const opTags = Array.isArray(op.tags) ? op.tags : [];
  if (opTags.length === 0) {
    const noTags = document.createElement('div');
    noTags.style.cssText = 'font-size:12px;color:#94a3b8;font-style:italic;';
    noTags.textContent = 'Тегов нет';
    tagsWrap.appendChild(noTags);
  } else {
    opTags.forEach(key => {
      const tag = AVAILABLE_TAGS.find(t => t.key === key);
      if (!tag) return;
      const el = document.createElement('span');
      el.style.cssText = `display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:12px;background:${tag.color}22;color:${tag.color};font-size:11px;font-weight:700;border:1px solid ${tag.color}55;`;
      el.textContent = tag.label;
      tagsWrap.appendChild(el);
    });
  }
  wrapper.appendChild(tagsWrap);

  // -------- ИНФО --------
  const infoGrid = document.createElement('div');
  infoGrid.className = 'profile-info-grid';
  const att = day.attendance?.[op.id] || 'Я';
  const attLabel = { 'Я': '✅ Явка', 'О': '🌴 Отпуск', 'Б': '🏥 Больничный', 'Н': '❌ Неявка', 'С': '🚗 В др. секторе', 'У': '🚫 Уволен' }[att] || att;
  let currentPost = '—';
  let totalLU = 0, totalU = 0;
  posts.forEach(p => {
    const assigned = normalizeAssignment(day.assignments[p.id]);
    if (assigned.includes(op.id)) currentPost = p.name;
    const lvl = day.levels?.[p.id]?.[op.id];
    if (lvl === 'L' || lvl === 'U') totalLU++;
    if (lvl === 'U') totalU++;
  });
  [['Роль', op.role], ['Участок', section.name], ['Смена', getCurrentShift()],
   ['Явка', attLabel], ['Текущий пост', currentPost],
   ['Поливалентность', `${totalLU} пост(ов) с L/U · ${totalU} с U`]
  ].forEach(([label, val]) => {
    const item = document.createElement('div');
    item.className = 'profile-info-item';
    item.innerHTML = `<div class="profile-info-label">${escapeHtml(label)}</div><div class="profile-info-value">${escapeHtml(String(val))}</div>`;
    infoGrid.appendChild(item);
  });
  wrapper.appendChild(infoGrid);

  // -------- УРОВНИ --------
  const lvlSection = document.createElement('div');
  lvlSection.className = 'profile-section';
  lvlSection.innerHTML = '<div class="profile-section-title">🎯 Уровни по постам</div>';
  const levelsWrap = document.createElement('div');
  levelsWrap.className = 'profile-levels';
  posts.forEach(p => {
    const lvl = day.levels?.[p.id]?.[op.id] || null;
    const row = document.createElement('div');
    row.className = 'profile-level-row';
    let cls = 'profile-lvl-none';
    if (lvl === 'U') cls = 'profile-lvl-U';
    else if (lvl === 'L' || lvl === 'Lкр') cls = 'profile-lvl-L';
    else if (lvl === 'I' || lvl === 'Iкр') cls = 'profile-lvl-I';
    row.innerHTML = `<span class="profile-level-post">${escapeHtml(p.name)}</span><span class="profile-level-badge ${cls}">${escapeHtml(lvl || '—')}</span>`;
    levelsWrap.appendChild(row);
  });
  lvlSection.appendChild(levelsWrap);
  wrapper.appendChild(lvlSection);

  // -------- ДОКУМЕНТЫ --------
  wrapper.appendChild(buildDocsSection(op, 'operator', () => {
    openOperatorProfile(profileCurrentOpIdx);
  }));

  // -------- ИСТОРИЯ --------
  const histSection = document.createElement('div');
  histSection.className = 'profile-section';
  histSection.innerHTML = '<div class="profile-section-title">📜 История (последние 20)</div>';
  const history = (getSystem().placementLog || []).filter(e => e.opName === op.name).slice(-20).reverse();
  const histWrap = document.createElement('div');
  histWrap.className = 'profile-history';
  if (history.length === 0) {
    histWrap.innerHTML = '<div class="profile-empty">Записей нет</div>';
  } else {
    history.forEach(e => {
      const row = document.createElement('div');
      row.className = 'profile-history-row';
      const icon = e.action === 'assign' ? '✅' : e.action === 'unassign' ? '❌' : e.action === 'attendance' ? '⚠️' : '•';
      row.innerHTML = `<span class="profile-history-icon">${icon}</span>
                       <span class="profile-history-date">${escapeHtml(e.date)} ${escapeHtml(e.time || '')}</span>
                       <span class="profile-history-post">${escapeHtml(e.postName || '')}</span>`;
      histWrap.appendChild(row);
    });
  }
  histSection.appendChild(histWrap);
  wrapper.appendChild(histSection);

  // -------- ОБУЧЕНИЯ --------
  const trSection = document.createElement('div');
  trSection.className = 'profile-section';
  trSection.innerHTML = '<div class="profile-section-title">🎓 Обучения (последние 10)</div>';
  const trainings = (getSystem().trainingRecords || []).filter(r => r.op === op.name).slice(-10).reverse();
  const trWrap = document.createElement('div');
  trWrap.className = 'profile-trainings';
  if (trainings.length === 0) {
    trWrap.innerHTML = '<div class="profile-empty">Обучений нет</div>';
  } else {
    trainings.forEach(r => {
      const row = document.createElement('div');
      row.className = 'profile-training-row';
      row.innerHTML = `<span class="profile-training-post">${escapeHtml(r.post)}</span>
                       <span class="profile-training-level">${escapeHtml(r.level)}</span>
                       <span class="profile-training-status" style="color:${r.status === 'Завершено' ? '#16a34a' : r.status === 'В процессе' ? '#f59e0b' : '#64748b'}">${escapeHtml(r.status)}</span>`;
      trWrap.appendChild(row);
    });
  }
  trSection.appendChild(trWrap);
  wrapper.appendChild(trSection);

  // -------- УПРАВЛЕНИЕ ТЕГАМИ --------
  const tagSection = document.createElement('div');
  tagSection.className = 'profile-section';
  tagSection.innerHTML = '<div class="profile-section-title">🏷️ Управление тегами</div>';
  const tagList = document.createElement('div');
  tagList.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
  AVAILABLE_TAGS.forEach(tag => {
    const hasTag = opTags.includes(tag.key);
    const btn = document.createElement('button');
    btn.className = 'btn-small';
    btn.style.cssText = `background:${hasTag ? tag.color : 'transparent'};color:${hasTag ? '#fff' : tag.color};border-color:${tag.color};`;
    btn.textContent = (hasTag ? '✓ ' : '+ ') + tag.label;
    btn.onclick = () => {
      toggleOperatorTag(op.id, tag.key);
      openOperatorProfile(profileCurrentOpIdx);
      safeRenderMatrix();
    };
    tagList.appendChild(btn);
  });
  tagSection.appendChild(tagList);
  wrapper.appendChild(tagSection);

  // -------- ДЕЙСТВИЯ --------
  const actions = document.createElement('div');
  actions.className = 'profile-actions';
  const mkBtn = (label, cls, fn) => {
    const b = document.createElement('button');
    b.className = 'btn-small' + (cls ? ' ' + cls : '');
    b.textContent = label;
    b.onclick = fn;
    return b;
  };
  actions.appendChild(mkBtn('✏️ Переименовать', '', () => {
    const v = prompt('Новое ФИО:', op.name);
    if (v && v.trim()) { updateOperator(op.id, { name: v.trim() }); closeOperatorProfile(); refreshAll(); }
  }));
  actions.appendChild(mkBtn('🎭 Изменить роль', '', () => {
    const v = prompt('Роль (НУ/СО/Ф/О):', op.role);
    if (v && ['НУ','СО','Ф','О'].includes(v.trim())) { updateOperator(op.id, { role: v.trim() }); closeOperatorProfile(); refreshAll(); }
  }));
  actions.appendChild(mkBtn('📊 В матрице', '', () => {
    const idx = profileCurrentOpIdx;
    closeOperatorProfile();
    const tabBtn = document.querySelector('.tab:nth-child(2)');
    if (tabBtn) tabBtn.click();
    setTimeout(() => { if (typeof highlightMatrixOperator === 'function') highlightMatrixOperator(idx); }, 100);
  }));
  actions.appendChild(mkBtn('🗑 Удалить', 'danger', () => {
    if (!confirm(`Удалить «${op.name}»?`)) return;
    deleteOperatorFromShift(op.id);
    closeOperatorProfile();
    refreshAll();
  }));
  wrapper.appendChild(actions);

  return wrapper;
}

// ======================== ПРОФИЛЬ ПОСТА ========================
function buildPostProfile(post, postIdx) {
  const section = getCurrentSection();
  const day = getCurrentDay();
  const opList = getCurrentOperators();

  const wrapper = document.createElement('div');

  const headerSection = document.createElement('div');
  headerSection.className = 'post-profile-header';

  const diffLabel = post.difficulty === 'A' ? 'A — Высокая'
                   : post.difficulty === 'B' ? 'B — Средняя'
                   : 'C — Низкая';
  const ergoLabel = post.ergonomics === 'red' ? 'Красная'
                   : post.ergonomics === 'yellow' ? 'Жёлтая'
                   : 'Зелёная';

  const nameBlock = document.createElement('div');
  nameBlock.className = 'post-profile-name-block';
  nameBlock.innerHTML = `
    <div class="post-profile-name">${escapeHtml(post.name)}</div>
    <div class="post-profile-sub">${escapeHtml(section.name)} · смена ${escapeHtml(getCurrentShift())}</div>
  `;
  headerSection.appendChild(nameBlock);

  const flagsRow = document.createElement('div');
  flagsRow.className = 'post-profile-flags';
  const mkFlag = (icon, label, active, color, onClick) => {
    const el = document.createElement('span');
    el.className = 'profile-flag' + (active ? ' active' : '');
    el.style.cssText = `border-color:${color};background:${active ? color : 'transparent'};color:${active ? '#fff' : color};`;
    el.textContent = icon + ' ' + label;
    el.title = 'Клик — переключить';
    el.style.cursor = 'pointer';
    el.onclick = onClick;
    return el;
  };

  flagsRow.appendChild(mkFlag('⚡', 'Неисправно', post.issues, '#ef4444', () => {
    updatePost(post.id, { issues: !post.issues });
    openPostProfile(postProfileCurrentIdx);
    safeRenderMatrix();
    safeRenderSE8();
  }));
  flagsRow.appendChild(mkFlag('🔴', 'Риск', post.defectRisk, '#ef4444', () => {
    updatePost(post.id, { defectRisk: !post.defectRisk });
    openPostProfile(postProfileCurrentIdx);
    safeRenderMatrix();
    safeRenderSE8();
  }));
  flagsRow.appendChild(mkFlag('C', 'Зона кузова', post.bodyZone, '#0f172a', () => {
    updatePost(post.id, { bodyZone: !post.bodyZone });
    openPostProfile(postProfileCurrentIdx);
    safeRenderMatrix();
    safeRenderSE8();
  }));
  headerSection.appendChild(flagsRow);
  wrapper.appendChild(headerSection);

  const infoGrid = document.createElement('div');
  infoGrid.className = 'profile-info-grid';

  let uCount = 0, lCount = 0, iCount = 0, learningCount = 0;
  const assignedIds = normalizeAssignment(day.assignments[post.id]);

  opList.forEach(op => {
    if (op.role === 'НУ' || op.role === 'СО') return;
    const lvl = day.levels?.[post.id]?.[op.id];
    if (lvl === 'U') uCount++;
    else if (lvl === 'L' || lvl === 'Lкр') lCount++;
    else if (lvl === 'I' || lvl === 'Iкр') iCount++;
    if (assignedIds.includes(op.id) && lvl === 'Iкр') learningCount++;
  });

  const items = [
    ['ID поста', post.id.slice(0, 8) + '…'],
    ['Сложность', diffLabel],
    ['Эргономика', ergoLabel],
    ['Срок обучения', post.trainingDays + ' дн.'],
    ['Департамент', section.department || '—'],
    ['Цех', section.workshop || '—'],
    ['Операторов с U', String(uCount)],
    ['Операторов с L', String(lCount)],
    ['Операторов с I', String(iCount)],
    ['Обучается сейчас', learningCount > 0 ? '△ ' + learningCount : 'нет'],
    ['Назначено сегодня', assignedIds.length > 0 ? assignedIds.length : 'свободен']
  ];

  items.forEach(([label, val]) => {
    const item = document.createElement('div');
    item.className = 'profile-info-item';
    item.innerHTML = `<div class="profile-info-label">${escapeHtml(label)}</div><div class="profile-info-value">${escapeHtml(String(val))}</div>`;
    infoGrid.appendChild(item);
  });
  wrapper.appendChild(infoGrid);

  const opsSection = document.createElement('div');
  opsSection.className = 'profile-section';
  opsSection.innerHTML = '<div class="profile-section-title">👥 Операторы по уровням</div>';

  const opsWrap = document.createElement('div');
  opsWrap.className = 'post-profile-ops-list';

  const levelsU = [];
  const levelsL = [];
  const levelsI = [];
  const levelsNone = [];

  opList.forEach((op, idx) => {
    if (op.role === 'НУ' || op.role === 'СО') return;
    const lvl = day.levels?.[post.id]?.[op.id] || null;
    const isAssigned = assignedIds.includes(op.id);
    const entry = { op, lvl, isAssigned, idx };
    if (lvl === 'U') levelsU.push(entry);
    else if (lvl === 'L' || lvl === 'Lкр') levelsL.push(entry);
    else if (lvl === 'I' || lvl === 'Iкр') levelsI.push(entry);
    else levelsNone.push(entry);
  });

  const renderGroup = (title, list, color) => {
    const group = document.createElement('div');
    group.className = 'post-profile-ops-group';
    const titleEl = document.createElement('div');
    titleEl.className = 'post-profile-ops-group-title';
    titleEl.style.color = color;
    titleEl.textContent = title + ' (' + list.length + ')';
    group.appendChild(titleEl);

    if (list.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'profile-empty';
      empty.textContent = '— пусто —';
      group.appendChild(empty);
    } else {
      list.forEach(entry => {
        const row = document.createElement('div');
        row.className = 'post-profile-op-row';
        if (entry.isAssigned) row.classList.add('assigned');

        const nameSpan = document.createElement('span');
        nameSpan.className = 'post-profile-op-name';
        nameSpan.textContent = (entry.isAssigned ? '● ' : '') + entry.op.name;

        const lvlBadge = document.createElement('span');
        lvlBadge.className = 'profile-level-badge';
        if (entry.lvl === 'U') lvlBadge.className += ' profile-lvl-U';
        else if (entry.lvl === 'L' || entry.lvl === 'Lкр') lvlBadge.className += ' profile-lvl-L';
        else if (entry.lvl === 'I' || entry.lvl === 'Iкр') lvlBadge.className += ' profile-lvl-I';
        else lvlBadge.className += ' profile-lvl-none';
        lvlBadge.textContent = entry.lvl || '—';

        row.appendChild(nameSpan);
        row.appendChild(lvlBadge);

        row.onclick = () => {
          closePostProfile();
          setTimeout(() => {
            if (typeof highlightMatrixOperator === 'function') {
              highlightMatrixOperator(entry.idx);
            }
          }, 100);
        };

        group.appendChild(row);
      });
    }

    return group;
  };

  if (levelsU.length > 0) opsWrap.appendChild(renderGroup('U — универсал', levelsU, '#991b1b'));
  if (levelsL.length > 0) opsWrap.appendChild(renderGroup('L — обучен', levelsL, '#9a3412'));
  if (levelsI.length > 0) opsWrap.appendChild(renderGroup('I — вводный', levelsI, '#854d0e'));
  if (levelsNone.length > 0) opsWrap.appendChild(renderGroup('Без уровня', levelsNone, '#94a3b8'));

  if (opsWrap.children.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'profile-empty';
    empty.textContent = 'Нет операторов';
    opsWrap.appendChild(empty);
  }

  opsSection.appendChild(opsWrap);
  wrapper.appendChild(opsSection);

  wrapper.appendChild(buildDocsSection(post, 'post', () => {
    openPostProfile(postProfileCurrentIdx);
  }));

  const histSection = document.createElement('div');
  histSection.className = 'profile-section';
  histSection.innerHTML = '<div class="profile-section-title">📜 История по посту (последние 20)</div>';

  const history = (getSystem().placementLog || [])
    .filter(e => e.postName === post.name)
    .slice(-20)
    .reverse();

  const histWrap = document.createElement('div');
  histWrap.className = 'profile-history';
  if (history.length === 0) {
    histWrap.innerHTML = '<div class="profile-empty">Записей нет</div>';
  } else {
    history.forEach(e => {
      const row = document.createElement('div');
      row.className = 'profile-history-row';
      const icon = e.action === 'assign' ? '✅' : e.action === 'unassign' ? '❌' : e.action === 'attendance' ? '⚠️' : '•';
      row.innerHTML = `<span class="profile-history-icon">${icon}</span>
                       <span class="profile-history-date">${escapeHtml(e.date)} ${escapeHtml(e.time || '')}</span>
                       <span class="profile-history-post">${escapeHtml(e.opName || '')}</span>`;
      histWrap.appendChild(row);
    });
  }
  histSection.appendChild(histWrap);
  wrapper.appendChild(histSection);

  const trSection = document.createElement('div');
  trSection.className = 'profile-section';
  trSection.innerHTML = '<div class="profile-section-title">🎓 Обучения по посту (последние 10)</div>';

  const trainings = (getSystem().trainingRecords || [])
    .filter(r => r.post === post.name)
    .slice(-10)
    .reverse();

  const trWrap = document.createElement('div');
  trWrap.className = 'profile-trainings';
  if (trainings.length === 0) {
    trWrap.innerHTML = '<div class="profile-empty">Обучений нет</div>';
  } else {
    trainings.forEach(r => {
      const row = document.createElement('div');
      row.className = 'profile-training-row';
      row.innerHTML = `<span class="profile-training-post">${escapeHtml(r.op)}</span>
                       <span class="profile-training-level">${escapeHtml(r.level)}</span>
                       <span class="profile-training-status" style="color:${r.status === 'Завершено' ? '#16a34a' : r.status === 'В процессе' ? '#f59e0b' : '#64748b'}">${escapeHtml(r.status)}</span>`;
      trWrap.appendChild(row);
    });
  }
  trSection.appendChild(trWrap);
  wrapper.appendChild(trSection);

  const actions = document.createElement('div');
  actions.className = 'profile-actions';

  const mkBtn = (label, cls, fn) => {
    const b = document.createElement('button');
    b.className = 'btn-small' + (cls ? ' ' + cls : '');
    b.textContent = label;
    b.onclick = fn;
    return b;
  };

  actions.appendChild(mkBtn('✏️ Редактировать', '', () => {
    closePostProfile();
    setTimeout(() => {
      if (typeof editPostByIndex === 'function') editPostByIndex(postIdx);
    }, 100);
  }));

  actions.appendChild(mkBtn('📊 В матрице', '', () => {
    closePostProfile();
    const tabBtn = document.querySelector('.tab:nth-child(2)');
    if (tabBtn) tabBtn.click();
    setTimeout(() => {
      if (typeof highlightMatrixPost === 'function') highlightMatrixPost(postIdx);
    }, 100);
  }));

  actions.appendChild(mkBtn('🏭 В расстановке', '', () => {
    closePostProfile();
    const tabs = Array.from(document.querySelectorAll('.tab'));
    const se8Tab = tabs.find(t => t.textContent.includes('Расстановка'));
    if (se8Tab) se8Tab.click();
    setTimeout(() => {
      if (typeof highlightSE8Post === 'function') highlightSE8Post(postIdx);
    }, 200);
  }));

  actions.appendChild(mkBtn('🗑 Удалить', 'danger', () => {
    if (!confirm(`Удалить пост «${post.name}»?\nОн будет удалён из матрицы, расстановки и всех смен.`)) return;
    closePostProfile();
    if (typeof deletePostByIndex === 'function') {
      deletePostByIndex(postIdx);
    }
  }));

  wrapper.appendChild(actions);

  return wrapper;
}

// ======================== ЗАКРЫТИЕ МОДАЛОК ПО КЛИКУ ВНЕ ========================
document.addEventListener('click', (e) => {
  const opModal = document.getElementById('operatorProfileModal');
  if (opModal && opModal.classList.contains('open')) {
    if (e.target === opModal) closeOperatorProfile();
  }
  const postModal = document.getElementById('postProfileModal');
  if (postModal && postModal.classList.contains('open')) {
    if (e.target === postModal) closePostProfile();
  }
  const excelModal = document.getElementById('excelPreviewModal');
  if (excelModal && excelModal.classList.contains('open')) {
    if (e.target === excelModal && typeof closeExcelPreview === 'function') {
      closeExcelPreview();
    }
  }
});