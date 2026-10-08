// ======================== РАССТАНОВКА ОПЕРАТОРОВ (АЛЬБОМНАЯ) ========================

const SE8_VIEWBOX_W = 1000;
const SE8_VIEWBOX_H = 600;

const SE8_LAYOUT_DEFAULT = {
  rightColumn: [
    { x: 850, y: 40,  w: 60, h: 30, postIndex: 0 },
    { x: 850, y: 90,  w: 60, h: 30, postIndex: 1 },
    { x: 850, y: 140, w: 60, h: 30, postIndex: 2 },
    { x: 850, y: 190, w: 60, h: 30, postIndex: 3 },
    { x: 850, y: 240, w: 60, h: 30, postIndex: 4 },
    { x: 850, y: 290, w: 60, h: 30, postIndex: 5 },
    { x: 850, y: 340, w: 60, h: 30, postIndex: 6 },
    { x: 850, y: 390, w: 60, h: 30, postIndex: 7 },
    { x: 850, y: 440, w: 60, h: 30, postIndex: 8 }
  ],
  bottomRow: [
    { x: 200, y: 500, w: 60, h: 30, postIndex: 9  },
    { x: 320, y: 500, w: 60, h: 30, postIndex: 10 },
    { x: 440, y: 500, w: 60, h: 30, postIndex: 11 },
    { x: 560, y: 500, w: 60, h: 30, postIndex: 12 },
    { x: 680, y: 500, w: 60, h: 30, postIndex: 13 }
  ],
  standalone: [
    { x: 60, y: 200, w: 60, h: 30, postIndex: 14 },
    { x: 60, y: 320, w: 60, h: 30, postIndex: 15 },
    { x: 60, y: 440, w: 60, h: 30, postIndex: 16 }
  ]
};

const SE8_CARS_DEFAULT = [
  { x: 470, y: 40 },  { x: 470, y: 90 },  { x: 470, y: 140 }, { x: 470, y: 190 },
  { x: 470, y: 240 }, { x: 470, y: 290 }, { x: 470, y: 340 }, { x: 470, y: 390 },
  { x: 470, y: 440 },
  { x: 220, y: 420 }, { x: 320, y: 420 }, { x: 420, y: 420 }, { x: 520, y: 420 },
  { x: 620, y: 420 }, { x: 720, y: 420 }, { x: 820, y: 420 }
];

const SE8_ZONES_DEFAULT = [
  {
    id: 'z1', name: 'Зона сборки', color: '#dbeafe',
    points: [
      { x: 420, y: 20 },  { x: 560, y: 20 },
      { x: 560, y: 470 }, { x: 420, y: 470 }
    ]
  },
  {
    id: 'z2', name: 'Зона сборки (низ)', color: '#dbeafe',
    points: [
      { x: 180, y: 460 }, { x: 860, y: 460 },
      { x: 860, y: 560 }, { x: 180, y: 560 }
    ]
  }
];

const SE8_MAN_DEFAULT = { x: 40, y: 40, scale: 0.5 };
const SE8_BG_DEFAULT = '#ffffff';

let se8Filter = null;
let se8Settings = { showNames: true, showPanel: true, showBlocks: true, zoom: 1 };
let se8EditLayout = false;

let se8Layout = JSON.parse(JSON.stringify(SE8_LAYOUT_DEFAULT));
let se8Cars = JSON.parse(JSON.stringify(SE8_CARS_DEFAULT));
let se8Zones = JSON.parse(JSON.stringify(SE8_ZONES_DEFAULT));
let se8Man = JSON.parse(JSON.stringify(SE8_MAN_DEFAULT));
let se8BgColor = SE8_BG_DEFAULT;
let se8MaketCount = 0;

let se8DragState = null;
let se8ZoneDragState = null;
let se8CarDragState = null;
let se8ManDragState = null;
let se8DraggedOpIndex = null;
let se8AddMode = null;

function loadSE8Settings() {
  try {
    const raw = localStorage.getItem('ilu_se8_settings');
    if (raw) Object.assign(se8Settings, JSON.parse(raw));
  } catch (e) {}
}
function saveSE8Settings() {
  try { localStorage.setItem('ilu_se8_settings', JSON.stringify(se8Settings)); } catch (e) {}
}
loadSE8Settings();

function toggleSE8Setting(key) {
  se8Settings[key] = !se8Settings[key];
  saveSE8Settings();
  renderSE8Blank();
}

function se8Zoom(delta) {
  se8Settings.zoom = Math.max(0.4, Math.min(3, se8Settings.zoom + delta));
  saveSE8Settings();
  applySE8Zoom();
}
function se8ZoomReset() {
  se8Settings.zoom = 1;
  saveSE8Settings();
  applySE8Zoom();
}
function applySE8Zoom() {
  const svg = document.getElementById('se8Svg');
  const wrapper = document.getElementById('se8ZoomWrapper');
  if (!svg || !wrapper) return;
  svg.style.transform = `scale(${se8Settings.zoom})`;
  svg.style.transformOrigin = 'top left';
  wrapper.style.width  = (SE8_VIEWBOX_W * se8Settings.zoom) + 'px';
  wrapper.style.height = (SE8_VIEWBOX_H * se8Settings.zoom) + 'px';
  const label = document.getElementById('se8ZoomLabel');
  if (label) label.textContent = Math.round(se8Settings.zoom * 100) + '%';
}

function getLayoutKey()    { return 'ilu_se8_layout_' + getCurrentSection().id; }
function getZoneKey()      { return 'ilu_se8_zone_'   + getCurrentSection().id; }
function getCarsKey()      { return 'ilu_se8_cars_'   + getCurrentSection().id; }
function getManKey()       { return 'ilu_se8_man_'    + getCurrentSection().id; }
function getBgKey()        { return 'ilu_se8_bg_'     + getCurrentSection().id; }
function getMaketCountKey(){ return 'ilu_se8_maket_count_' + getCurrentSection().id; }

function loadSE8Layout() {
  try {
    const raw = localStorage.getItem(getLayoutKey());
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.rightColumn) se8Layout.rightColumn = saved.rightColumn;
      if (saved.bottomRow) se8Layout.bottomRow = saved.bottomRow;
      if (saved.standalone) se8Layout.standalone = saved.standalone;
    } else {
      se8Layout = JSON.parse(JSON.stringify(SE8_LAYOUT_DEFAULT));
    }
    const rawZone = localStorage.getItem(getZoneKey());
    if (rawZone) {
      const z = JSON.parse(rawZone);
      if (Array.isArray(z) && z.length) se8Zones = z;
    } else {
      se8Zones = JSON.parse(JSON.stringify(SE8_ZONES_DEFAULT));
    }
    const rawCars = localStorage.getItem(getCarsKey());
    if (rawCars) {
      const c = JSON.parse(rawCars);
      if (Array.isArray(c)) se8Cars = c;
    } else {
      se8Cars = JSON.parse(JSON.stringify(SE8_CARS_DEFAULT));
    }
    const rawMan = localStorage.getItem(getManKey());
    if (rawMan) {
      const m = JSON.parse(rawMan);
      if (m) se8Man = m;
    } else {
      se8Man = JSON.parse(JSON.stringify(SE8_MAN_DEFAULT));
    }
    const rawBg = localStorage.getItem(getBgKey());
    se8BgColor = rawBg || SE8_BG_DEFAULT;
    se8MaketCount = parseInt(localStorage.getItem(getMaketCountKey()) || '0') || 0;
  } catch (e) {
    se8Layout = JSON.parse(JSON.stringify(SE8_LAYOUT_DEFAULT));
    se8Cars = JSON.parse(JSON.stringify(SE8_CARS_DEFAULT));
    se8Zones = JSON.parse(JSON.stringify(SE8_ZONES_DEFAULT));
    se8Man = JSON.parse(JSON.stringify(SE8_MAN_DEFAULT));
    se8BgColor = SE8_BG_DEFAULT;
    se8MaketCount = 0;
  }
}

function saveSE8Layout() {
  try {
    localStorage.setItem(getLayoutKey(), JSON.stringify({
      rightColumn: se8Layout.rightColumn,
      bottomRow: se8Layout.bottomRow,
      standalone: se8Layout.standalone
    }));
  } catch (e) {}
}
function saveSE8Zones() { try { localStorage.setItem(getZoneKey(), JSON.stringify(se8Zones)); } catch (e) {} }
function saveSE8Cars()  { try { localStorage.setItem(getCarsKey(), JSON.stringify(se8Cars)); } catch (e) {} }
function saveSE8Man()   { try { localStorage.setItem(getManKey(), JSON.stringify(se8Man)); } catch (e) {} }
function saveSE8Bg()    { try { localStorage.setItem(getBgKey(), se8BgColor); } catch (e) {} }
function saveSE8MaketCount() {
  try { localStorage.setItem(getMaketCountKey(), String(se8MaketCount)); } catch (e) {}
}

function saveAll() {
  saveSE8Layout(); saveSE8Zones(); saveSE8Cars();
  saveSE8Man(); saveSE8Bg(); saveSE8MaketCount();
}

function resetSE8Layout() {
  if (!confirm('Сбросить расположение постов?')) return;
  se8Layout = JSON.parse(JSON.stringify(SE8_LAYOUT_DEFAULT));
  try { localStorage.removeItem(getLayoutKey()); } catch (e) {}
  renderSE8Blank();
}
function resetSE8Zone() {
  if (!confirm('Сбросить зоны?')) return;
  se8Zones = JSON.parse(JSON.stringify(SE8_ZONES_DEFAULT));
  try { localStorage.removeItem(getZoneKey()); } catch (e) {}
  renderSE8Blank();
}
function resetSE8Cars() {
  if (!confirm('Сбросить машинки?')) return;
  se8Cars = JSON.parse(JSON.stringify(SE8_CARS_DEFAULT));
  try { localStorage.removeItem(getCarsKey()); } catch (e) {}
  renderSE8Blank();
}
function resetSE8Man() {
  if (!confirm('Сбросить силуэт?')) return;
  se8Man = JSON.parse(JSON.stringify(SE8_MAN_DEFAULT));
  try { localStorage.removeItem(getManKey()); } catch (e) {}
  renderSE8Blank();
}
function resetSE8Bg() {
  if (!confirm('Сбросить фон?')) return;
  se8BgColor = SE8_BG_DEFAULT;
  try { localStorage.removeItem(getBgKey()); } catch (e) {}
  renderSE8Blank();
}

function toggleSE8EditLayout() {
  se8EditLayout = !se8EditLayout;
  se8AddMode = null;
  if (!se8EditLayout) saveAll();
  renderSE8Blank();
}
function setSE8AddMode(mode) {
  se8AddMode = (se8AddMode === mode) ? null : mode;
  renderSE8Blank();
}

function onSE8MaketCountInput(value) {
  se8MaketCount = parseInt(value) || 0;
  saveSE8MaketCount();
}

// ======================== ДОБАВЛЕНИЕ / УДАЛЕНИЕ ПОСТА (SE-8) ========================

function findFreePostSlot(existingPostIndexes) {
  const rightYs = [40, 90, 140, 190, 240, 290, 340, 390, 440, 490];
  for (const y of rightYs) {
    const idx = se8Layout.rightColumn.findIndex(p => p.x === 850 && p.y === y);
    if (idx < 0 && y + 30 <= SE8_VIEWBOX_H - 10) {
      return { col: 'rightColumn', x: 850, y, w: 60, h: 30 };
    }
  }

  const bottomXs = [200, 320, 440, 560, 680, 800, 920];
  for (const x of bottomXs) {
    const idx = se8Layout.bottomRow.findIndex(p => p.y === 500 && p.x === x);
    if (idx < 0 && x + 60 <= SE8_VIEWBOX_W - 10) {
      return { col: 'bottomRow', x, y: 500, w: 60, h: 30 };
    }
  }

  const leftYs = [200, 320, 440, 560];
  for (const y of leftYs) {
    const idx = se8Layout.standalone.findIndex(p => p.x === 60 && p.y === y);
    if (idx < 0 && y + 30 <= SE8_VIEWBOX_H - 10) {
      return { col: 'standalone', x: 60, y, w: 60, h: 30 };
    }
  }

  for (let y = 20; y < SE8_VIEWBOX_H - 40; y += 40) {
    for (let x = 20; x < SE8_VIEWBOX_W - 80; x += 80) {
      const collides =
        se8Layout.rightColumn.some(p => Math.abs(p.x - x) < 40 && Math.abs(p.y - y) < 25) ||
        se8Layout.bottomRow.some(p => Math.abs(p.x - x) < 40 && Math.abs(p.y - y) < 25) ||
        se8Layout.standalone.some(p => Math.abs(p.x - x) < 40 && Math.abs(p.y - y) < 25);
      if (!collides) {
        return { col: 'standalone', x, y, w: 60, h: 30 };
      }
    }
  }

  return null;
}

function addSE8NewPost() {
  if (!se8EditLayout) return;

  const section = getCurrentSection();

  const defaultName = 'Пост ' + (section.posts.length + 1);
  const name = prompt('Название нового поста:', defaultName);
  if (name === null) return;
  const trimmed = (name || '').trim();
  if (!trimmed) { alert('Название не может быть пустым'); return; }

  if (section.posts.some(p => p.name === trimmed)) {
    alert('Пост с таким названием уже существует');
    return;
  }

  const diffInput = prompt('Сложность (A / B / C):', 'C');
  if (diffInput === null) return;
  const difficulty = ['A', 'B', 'C'].includes((diffInput || '').trim().toUpperCase())
    ? diffInput.trim().toUpperCase()
    : 'C';

  const ergoInput = prompt('Эргономика (red / yellow / green):', 'green');
  if (ergoInput === null) return;
  const ergoRaw = (ergoInput || '').trim().toLowerCase();
  const ergonomics = ['red', 'yellow', 'green'].includes(ergoRaw) ? ergoRaw : 'green';

  const newPost = addPostToSection({
    name: trimmed,
    difficulty,
    ergonomics,
    trainingDays: 5
  });
  if (!newPost) { alert('Не удалось добавить пост'); return; }

  const existingIndexes = [];
  ['rightColumn', 'bottomRow', 'standalone'].forEach(col => {
    se8Layout[col].forEach(p => existingIndexes.push(p.postIndex));
  });
  const newPostIndex = section.posts.indexOf(newPost);
  const slot = findFreePostSlot(existingIndexes);

  if (!slot) {
    alert('Свободного места на схеме нет — пост добавлен в данные, но не размещён на схеме.');
    saveSE8Layout();
    renderSE8Blank();
    return;
  }

  se8Layout[slot.col].push({
    x: slot.x,
    y: slot.y,
    w: slot.w,
    h: slot.h,
    postIndex: newPostIndex
  });

  saveSE8Layout();
  logAudit('add_post', trimmed, `SE-8 схема · ${section.name}`);

  renderSE8Blank();
  if (typeof renderMatrix === 'function') renderMatrix();
  if (typeof showToast === 'function') showToast('✅ Пост добавлен');
}

function deleteSE8Post(postIndex) {
  const section = getCurrentSection();
  const post = section.posts[postIndex];
  if (!post) { alert('Пост не найден'); return; }

  if (!confirm(`Удалить пост «${post.name}»?\n\nОн будет удалён также из данных участка, матрицы и всех смен.`)) return;

  const postName = post.name;

  deletePostFromSection(post.id);

  ['rightColumn', 'bottomRow', 'standalone'].forEach(col => {
    se8Layout[col] = se8Layout[col].filter(p => p.postIndex !== postIndex);
  });

  ['rightColumn', 'bottomRow', 'standalone'].forEach(col => {
    se8Layout[col].forEach(p => {
      if (p.postIndex > postIndex) p.postIndex--;
    });
  });

  saveSE8Layout();
  logAudit('delete_post', postName, `SE-8 схема · ${section.name}`);

  renderSE8Blank();
  if (typeof renderMatrix === 'function') renderMatrix();
  if (typeof showToast === 'function') showToast('🗑 Пост удалён');
}

// ======================== ДОБАВЛЕНИЕ В РАССТАНОВКУ ИЗ МАТРИЦЫ ========================

function addPostToSe8Layout(postIndex) {
  const section = getCurrentSection();
  const post = section.posts[postIndex];
  if (!post) { alert('Пост не найден'); return; }

  loadSE8Layout();

  let alreadyPlaced = false;
  ['rightColumn', 'bottomRow', 'standalone'].forEach(col => {
    if (se8Layout[col].some(p => p.postIndex === postIndex)) alreadyPlaced = true;
  });

  if (!alreadyPlaced) {
    const existingIndexes = [];
    ['rightColumn', 'bottomRow', 'standalone'].forEach(col => {
      se8Layout[col].forEach(p => existingIndexes.push(p.postIndex));
    });

    const slot = findFreePostSlot(existingIndexes);

    if (!slot) {
      alert('Свободного места на схеме нет.\n\nОсвободите место (перетащите/удалите посты в редакторе) и попробуйте снова.');
      return;
    }

    se8Layout[slot.col].push({
      x: slot.x,
      y: slot.y,
      w: slot.w,
      h: slot.h,
      postIndex: postIndex
    });

    saveSE8Layout();
    logAudit('add_post', post.name, `SE-8 схема · ${section.name}`);

    if (typeof showToast === 'function') {
      showToast('✅ Пост добавлен в расстановку');
    }
  } else {
    if (typeof showToast === 'function') {
      showToast('ℹ️ Пост уже есть на схеме — открываю расстановку');
    }
  }

  const se8Tab = Array.from(document.querySelectorAll('.tab')).find(t =>
    t.textContent.includes('Расстановка')
  );
  if (se8Tab) se8Tab.click();

  setTimeout(() => {
    if (typeof renderSE8Blank === 'function') renderSE8Blank();
    setTimeout(() => highlightSE8Post(postIndex), 150);
  }, 120);
}

function highlightSE8Post(postIndex) {
  const g = document.querySelector(`.se8-post[data-post="${postIndex}"] rect`);
  if (!g) return;
  const original = g.getAttribute('stroke');
  const originalWidth = g.getAttribute('stroke-width');

  g.setAttribute('stroke', '#f59e0b');
  g.setAttribute('stroke-width', '4');

  setTimeout(() => {
    g.setAttribute('stroke', original || '#000');
    g.setAttribute('stroke-width', originalWidth || '1.5');
  }, 2500);
}

// ======================== ОТРИСОВКА ОСНОВНОГО ЭКРАНА ========================
function renderSE8Blank() {
  const container = document.getElementById('se8Container');
  if (!container) return;
  const dateStr = getCurrentDate();
  loadSE8Layout();

  const att = operatorAttendance;
  const roles = operatorRoles;
  let cntPresent = 0, cntVacation = 0, cntSick = 0, cntAbsent = 0, cntFired = 0, cntOther = 0;
  for (let i = 0; i < att.length; i++) {
    if (roles[i] === 'НУ') continue;
    const a = att[i];
    if (a === 'Я') cntPresent++;
    else if (a === 'О') cntVacation++;
    else if (a === 'Б') cntSick++;
    else if (a === 'Н') cntAbsent++;
    else if (a === 'У') cntFired++;
    else if (a === 'С') cntOther++;
  }

  container.innerHTML = `
    <div class="se8-wrapper">
      <div class="se8-header">
        <div class="se8-title">Расстановка операторов — участок ${escapeHtml(getCurrentSection().name)}</div>

        <div class="se8-toolbar">
          <button class="se8-tool-btn" onclick="se8Zoom(-0.1)" title="Уменьшить">−</button>
          <span id="se8ZoomLabel" class="se8-zoom-label">${Math.round(se8Settings.zoom * 100)}%</span>
          <button class="se8-tool-btn" onclick="se8Zoom(0.1)" title="Увеличить">+</button>
          <button class="se8-tool-btn" onclick="se8ZoomReset()" title="Сбросить">⟲</button>
          <button class="se8-tool-btn" onclick="toggleSE8Setting('showNames')" title="Фамилии">
            ${se8Settings.showNames ? '👤' : '▪'}
          </button>
          <button class="se8-tool-btn" onclick="toggleSE8Setting('showPanel')" title="Панель">
            ${se8Settings.showPanel ? '📋' : '📄'}
          </button>
          <button class="se8-tool-btn" onclick="toggleSE8Setting('showBlocks')" title="Блоки">
            ${se8Settings.showBlocks ? '🧱' : '⬜'}
          </button>
          <button class="se8-tool-btn" onclick="exportSE8ToPNG()" title="PNG">🖼</button>
          <button class="se8-tool-btn" onclick="exportSE8ToSVG()" title="SVG">📐</button>
          <button class="se8-tool-btn" onclick="printSE8()" title="Печать">🖨</button>
          <button class="se8-tool-btn ${se8EditLayout ? 'active' : ''}"
                  onclick="toggleSE8EditLayout()" title="Редактирование">✏️</button>
          ${se8EditLayout ? `
            <span style="border-left:1px solid var(--border);height:20px;margin:0 4px;"></span>
            <button class="se8-tool-btn" onclick="addSE8NewPost()" title="Добавить пост">➕ Пост</button>
            <button class="se8-tool-btn ${se8AddMode === 'car' ? 'active' : ''}"
                    onclick="setSE8AddMode('car')" title="Добавить машинку">🚗+</button>
            <button class="se8-tool-btn ${se8AddMode === 'man' ? 'active' : ''}"
                    onclick="setSE8AddMode('man')" title="Добавить человечка">🧍+</button>
            <button class="se8-tool-btn" onclick="addSE8Zone()" title="Добавить зону">▭+</button>
            <button class="se8-tool-btn" onclick="resetSE8Layout()" title="Сброс постов">↺</button>
            <button class="se8-tool-btn" onclick="resetSE8Zone()" title="Сброс зон">▭↺</button>
            <button class="se8-tool-btn" onclick="resetSE8Cars()" title="Сброс машинок">🚗↺</button>
            <button class="se8-tool-btn" onclick="resetSE8Man()" title="Сброс человечка">🧍↺</button>
            <button class="se8-tool-btn" onclick="resetSE8Bg()" title="Сброс фона">🎨↺</button>
            <span class="se8-edit-hint">Перетащите · ПКМ — действие / удалить</span>
          ` : ''}
        </div>

        <div class="se8-header-info">
          <span>Смена: <b>${escapeHtml(getCurrentShift())}</b></span>
          <span>Дата: <b>${escapeHtml(dateStr)}</b></span>
        </div>
      </div>

      <div class="se8-main">
        <div class="se8-left">
          <div class="se8-date-block">
            <div class="se8-date-row">
              <div class="se8-date-label">Дата</div>
              <div class="se8-date-value">${escapeHtml(dateStr)}</div>
            </div>
            <div class="se8-maket-row">
              <div class="se8-maket-cell-label">МАКЕТ</div>
              <div class="se8-maket-cell-input">
                <input type="number"
                       id="se8MaketInput"
                       min="0"
                       value="${se8MaketCount}"
                       oninput="onSE8MaketCountInput(this.value)"
                       title="Кол-во операторов (вручную)">
              </div>
              <div class="se8-maket-cell-label">ЯВКА</div>
              <div class="se8-maket-cell-value"
                   title="Кол-во операторов из матрицы">${cntPresent}</div>
            </div>
          </div>

          <div class="se8-avka-table">
            <div class="se8-avka-title">ЯВКА</div>
            <table class="se8-avka-tbl">
              <tbody>
                <tr><td>Отпуск</td><td style="color:#9333ea;">${cntVacation}</td></tr>
                <tr><td>Болезнь</td><td style="color:#ef4444;">${cntSick}</td></tr>
                <tr><td>Неявка</td><td style="color:#ef4444;">${cntAbsent}</td></tr>
                <tr><td>Увольнение</td><td style="color:#64748b;">${cntFired}</td></tr>
                <tr><td>В др. секторе</td><td style="color:#ea580c;">${cntOther}</td></tr>
              </tbody>
            </table>
          </div>

          <div class="se8-legend">
            <div class="se8-legend-row" onclick="toggleSE8Filter('learning')" data-filter="learning">
              <span class="se8-legend-icon">
                <svg viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="7" fill="#facc15"/><polygon points="8,3 11,10 5,10" fill="#000"/></svg>
              </span>
              <span>ОБУЧЕНИЕ НА ПОСТУ</span>
            </div>
            <div class="se8-legend-row" onclick="toggleSE8Filter('issues')" data-filter="issues">
              <span class="se8-legend-icon">
                <svg viewBox="0 0 16 16" width="16" height="16"><polygon points="8,2 15,14 1,14" fill="#ef4444" stroke="#000" stroke-width="1"/></svg>
              </span>
              <span>НЕИСПРАВНОЕ ОБОРУДОВАНИЕ</span>
            </div>
            <div class="se8-legend-row" onclick="toggleSE8Filter('risk')" data-filter="risk">
              <span class="se8-legend-icon">
                <svg viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="7" fill="#ef4444"/></svg>
              </span>
              <span>РИСК ВЫХОДА ДЕФЕКТА</span>
            </div>
            <div class="se8-legend-row" onclick="toggleSE8Filter('body')" data-filter="body">
              <span class="se8-legend-icon">
                <svg viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="7" fill="#000"/><text x="8" y="12" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">C</text></svg>
              </span>
              <span>ЗОНА РАБОТЫ С КУЗОВОМ</span>
            </div>
            <div class="se8-legend-reset" onclick="toggleSE8Filter(null)">✕ Сбросить фильтр</div>
          </div>

          ${se8EditLayout ? `
            <div class="se8-edit-panel">
              <div style="font-weight:700;font-size:11px;margin-bottom:6px;color:var(--text-muted);text-transform:uppercase;">Фон схемы</div>
              <input type="color" id="se8BgPicker" value="${escapeAttr(se8BgColor)}"
                     oninput="updateSE8Bg(this.value)"
                     style="width:100%;height:32px;border:1px solid var(--border);border-radius:6px;cursor:pointer;">

              <div style="font-weight:700;font-size:11px;margin:10px 0 6px;color:var(--text-muted);text-transform:uppercase;">Зоны</div>
              <button class="btn-small" style="width:100%;margin-bottom:6px;" onclick="addSE8Zone()">+ Добавить зону</button>
              <div id="se8ZoneList"></div>
            </div>
          ` : ''}
        </div>

        <div class="se8-line">
          <div class="se8-svg-zoom-wrapper"
               id="se8ZoomWrapper"
               style="width:${SE8_VIEWBOX_W * se8Settings.zoom}px;height:${SE8_VIEWBOX_H * se8Settings.zoom}px;">
            <svg viewBox="0 0 ${SE8_VIEWBOX_W} ${SE8_VIEWBOX_H}" class="se8-svg" id="se8Svg"
                 width="${SE8_VIEWBOX_W}" height="${SE8_VIEWBOX_H}"
                 preserveAspectRatio="xMinYMin meet"
                 onclick="onSE8SvgClick(event)">
              <rect id="se8BgRect" x="0" y="0" width="${SE8_VIEWBOX_W}" height="${SE8_VIEWBOX_H}" fill="${escapeAttr(se8BgColor)}"/>
              <g id="se8Conveyor"></g>
              <g id="se8ZoneHandles"></g>
              <g id="se8Cars"></g>
              <g id="se8ManLayer"></g>
              <g id="se8Posts"></g>
            </svg>
          </div>
        </div>

        <div class="se8-right" style="${se8Settings.showPanel || se8Settings.showBlocks ? '' : 'display:none;'}">
          <div class="se8-block" id="se8BlockLearning" style="${se8Settings.showBlocks ? '' : 'display:none;'}">
            <div class="se8-block-title">🎓 Обучение на посту</div>
            <div class="se8-block-body" id="se8LearningList"></div>
          </div>

          <div class="se8-block" id="se8BlockIssues" style="${se8Settings.showBlocks ? '' : 'display:none;'}">
            <div class="se8-block-title">⚡ Неисправное оборудование</div>
            <div class="se8-block-body" id="se8IssuesList"></div>
          </div>

          <div class="se8-block se8-block-ops" style="${se8Settings.showPanel ? '' : 'display:none;'}">
            <div class="se8-block-title">
              👥 Операторы
              <label class="se8-toggle">
                <input type="checkbox" id="se8OnlyFree" onchange="drawSE8Panel()">
                <span>свободные</span>
              </label>
            </div>
            <div class="se8-block-body" id="se8PanelOps"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  drawSE8Conveyor();
  drawSE8Cars();
  drawSE8Man();
  redrawSE8PostsOnly();
  drawSE8Panel();
  drawSE8Blocks();
  applySE8FilterVisual();
  applySE8Zoom();
  if (se8EditLayout) drawSE8ZoneList();
}

function updateSE8Bg(color) {
  se8BgColor = color;
  const rect = document.getElementById('se8BgRect');
  if (rect) rect.setAttribute('fill', color);
  saveSE8Bg();
}

function drawSE8ZoneList() {
  const cont = document.getElementById('se8ZoneList');
  if (!cont) return;
  let html = '';
  se8Zones.forEach((z, i) => {
    html += `
      <div style="display:flex;gap:4px;align-items:center;margin-bottom:4px;font-size:11px;">
        <input type="color" value="${escapeAttr(z.color || '#dbeafe')}"
               oninput="updateSE8ZoneColor(${i}, this.value)"
               style="width:28px;height:24px;border:1px solid var(--border);border-radius:4px;cursor:pointer;">
        <input type="text" value="${escapeAttr(z.name || '')}"
               oninput="updateSE8ZoneName(${i}, this.value)"
               placeholder="Название"
               style="flex:1;padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:11px;">
        <button class="btn-small danger" style="padding:2px 6px;font-size:10px;"
                onclick="deleteSE8Zone(${i})">✕</button>
      </div>
    `;
  });
  cont.innerHTML = html;
}
function updateSE8ZoneColor(i, color) {
  if (!se8Zones[i]) return;
  se8Zones[i].color = color;
  drawSE8Conveyor();
  saveSE8Zones();
}
function updateSE8ZoneName(i, name) {
  if (!se8Zones[i]) return;
  se8Zones[i].name = name;
  drawSE8Conveyor();
  saveSE8Zones();
}
function addSE8Zone() {
  const id = 'z' + Date.now();
  const offset = se8Zones.length * 20;
  se8Zones.push({
    id,
    name: 'Зона ' + (se8Zones.length + 1),
    color: '#fef08a',
    points: [
      { x: 100 + offset, y: 100 + offset },
      { x: 220 + offset, y: 100 + offset },
      { x: 220 + offset, y: 220 + offset },
      { x: 100 + offset, y: 220 + offset }
    ]
  });
  saveSE8Zones();
  renderSE8Blank();
}
function deleteSE8Zone(i) {
  if (!confirm('Удалить зону?')) return;
  se8Zones.splice(i, 1);
  saveSE8Zones();
  renderSE8Blank();
}

function drawSE8Conveyor() {
  const g = document.getElementById('se8Conveyor');
  if (!g) return;
  let html = '';
  se8Zones.forEach((z) => {
    if (!z.points || z.points.length < 3) return;
    const points = z.points.map(p => `${p.x},${p.y}`).join(' ');
    html += `<polygon points="${points}" fill="${escapeAttr(z.color || '#dbeafe')}" fill-opacity="0.6" stroke="#3b82f6" stroke-width="2" stroke-linejoin="round"/>`;
    const cx = z.points.reduce((s, p) => s + p.x, 0) / z.points.length;
    const cy = z.points.reduce((s, p) => s + p.y, 0) / z.points.length;
    html += `<text x="${cx}" y="${cy}" text-anchor="middle" font-size="11" font-weight="700" fill="#1e40af" opacity="0.8" style="pointer-events:none;">${escapeHtml(z.name || '')}</text>`;
  });
  g.innerHTML = html;
  drawSE8ZoneHandles();
}

function drawSE8ZoneHandles() {
  const g = document.getElementById('se8ZoneHandles');
  if (!g) return;
  if (!se8EditLayout) { g.innerHTML = ''; return; }
  let html = '';
  se8Zones.forEach((z, zi) => {
    z.points.forEach((p, pi) => {
      html += `<circle class="se8-zone-handle" data-zone="${zi}" data-point="${pi}" cx="${p.x}" cy="${p.y}" r="6" fill="#fff" stroke="#3b82f6" stroke-width="2" style="cursor: move;"/>`;
    });
  });
  g.innerHTML = html;
  g.querySelectorAll('.se8-zone-handle').forEach(circle => {
    circle.addEventListener('mousedown', onSE8ZoneHandleMouseDown);
    circle.addEventListener('touchstart', onSE8ZoneHandleTouchStart, { passive: false });
    circle.addEventListener('contextmenu', onSE8ZoneHandleContext);
  });
}

function onSE8ZoneHandleContext(e) {
  if (!se8EditLayout) return;
  e.preventDefault(); e.stopPropagation();
  const zi = parseInt(e.currentTarget.getAttribute('data-zone'));
  const pi = parseInt(e.currentTarget.getAttribute('data-point'));
  if (!confirm('Удалить вершину зоны?')) return;
  se8Zones[zi].points.splice(pi, 1);
  saveSE8Zones();
  renderSE8Blank();
}

function onSE8ZoneHandleMouseDown(e) {
  if (!se8EditLayout) return;
  e.preventDefault(); e.stopPropagation();
  const zi = parseInt(e.currentTarget.getAttribute('data-zone'));
  const pi = parseInt(e.currentTarget.getAttribute('data-point'));
  const svg = document.getElementById('se8Svg');
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  se8ZoneDragState = {
    zoneIndex: zi, pointIndex: pi,
    startX: svgP.x, startY: svgP.y,
    origX: se8Zones[zi].points[pi].x,
    origY: se8Zones[zi].points[pi].y
  };
  document.addEventListener('mousemove', onSE8ZoneHandleMouseMove);
  document.addEventListener('mouseup', onSE8ZoneHandleMouseUp);
}
function onSE8ZoneHandleMouseMove(e) {
  if (!se8ZoneDragState) return;
  const svg = document.getElementById('se8Svg');
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  const dx = svgP.x - se8ZoneDragState.startX;
  const dy = svgP.y - se8ZoneDragState.startY;
  const z = se8Zones[se8ZoneDragState.zoneIndex].points[se8ZoneDragState.pointIndex];
  z.x = Math.round(se8ZoneDragState.origX + dx);
  z.y = Math.round(se8ZoneDragState.origY + dy);
  drawSE8Conveyor();
}
function onSE8ZoneHandleMouseUp() {
  if (se8ZoneDragState) { saveSE8Zones(); se8ZoneDragState = null; }
  document.removeEventListener('mousemove', onSE8ZoneHandleMouseMove);
  document.removeEventListener('mouseup', onSE8ZoneHandleMouseUp);
}

function onSE8ZoneHandleTouchStart(e) {
  if (!se8EditLayout) return;
  e.preventDefault(); e.stopPropagation();
  const zi = parseInt(e.currentTarget.getAttribute('data-zone'));
  const pi = parseInt(e.currentTarget.getAttribute('data-point'));
  const svg = document.getElementById('se8Svg');
  const touch = e.touches[0];
  const pt = svg.createSVGPoint();
  pt.x = touch.clientX; pt.y = touch.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  se8ZoneDragState = {
    zoneIndex: zi, pointIndex: pi,
    startX: svgP.x, startY: svgP.y,
    origX: se8Zones[zi].points[pi].x,
    origY: se8Zones[zi].points[pi].y
  };
  document.addEventListener('touchmove', onSE8ZoneHandleTouchMove, { passive: false });
  document.addEventListener('touchend', onSE8ZoneHandleTouchEnd);
}
function onSE8ZoneHandleTouchMove(e) {
  if (!se8ZoneDragState) return;
  e.preventDefault();
  const svg = document.getElementById('se8Svg');
  const touch = e.touches[0];
  const pt = svg.createSVGPoint();
  pt.x = touch.clientX; pt.y = touch.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  const dx = svgP.x - se8ZoneDragState.startX;
  const dy = svgP.y - se8ZoneDragState.startY;
  const z = se8Zones[se8ZoneDragState.zoneIndex].points[se8ZoneDragState.pointIndex];
  z.x = Math.round(se8ZoneDragState.origX + dx);
  z.y = Math.round(se8ZoneDragState.origY + dy);
  drawSE8Conveyor();
}
function onSE8ZoneHandleTouchEnd() {
  if (se8ZoneDragState) { saveSE8Zones(); se8ZoneDragState = null; }
  document.removeEventListener('touchmove', onSE8ZoneHandleTouchMove);
  document.removeEventListener('touchend', onSE8ZoneHandleTouchEnd);
}

function onSE8SvgClick(event) {
  if (!se8EditLayout || !se8AddMode) return;
  const svg = document.getElementById('se8Svg');
  const pt = svg.createSVGPoint();
  pt.x = event.clientX; pt.y = event.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  if (se8AddMode === 'car') {
    se8Cars.push({ x: Math.round(svgP.x - 7), y: Math.round(svgP.y - 12) });
    saveSE8Cars();
  } else if (se8AddMode === 'man') {
    se8Man = { x: Math.round(svgP.x), y: Math.round(svgP.y + 20), scale: se8Man.scale || 0.5 };
    saveSE8Man();
  }
  se8AddMode = null;
  renderSE8Blank();
}

function drawSE8Cars() {
  const g = document.getElementById('se8Cars');
  if (!g) return;
  let html = '';
  se8Cars.forEach((c, i) => {
    const events = se8EditLayout ? `data-car="${i}" style="cursor: move;"` : '';
    html += `<g ${events}><rect x="${c.x}" y="${c.y}" width="14" height="24" rx="3" fill="#93c5fd" stroke="#1e40af" stroke-width="0.5"/></g>`;
  });
  g.innerHTML = html;
  if (se8EditLayout) {
    g.querySelectorAll('g[data-car]').forEach(el => {
      el.addEventListener('mousedown', onSE8CarMouseDown);
      el.addEventListener('touchstart', onSE8CarTouchStart, { passive: false });
      el.addEventListener('contextmenu', onSE8CarContext);
    });
  }
}
function onSE8CarContext(e) {
  if (!se8EditLayout) return;
  e.preventDefault(); e.stopPropagation();
  const idx = parseInt(e.currentTarget.getAttribute('data-car'));
  if (!confirm('Удалить машинку?')) return;
  se8Cars.splice(idx, 1);
  saveSE8Cars();
  renderSE8Blank();
}
function onSE8CarMouseDown(e) {
  if (!se8EditLayout) return;
  e.preventDefault(); e.stopPropagation();
  const carIdx = parseInt(e.currentTarget.getAttribute('data-car'));
  const svg = document.getElementById('se8Svg');
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  se8CarDragState = { carIdx, startX: svgP.x, startY: svgP.y, origX: se8Cars[carIdx].x, origY: se8Cars[carIdx].y };
  document.addEventListener('mousemove', onSE8CarMouseMove);
  document.addEventListener('mouseup', onSE8CarMouseUp);
}
function onSE8CarMouseMove(e) {
  if (!se8CarDragState) return;
  const svg = document.getElementById('se8Svg');
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  const dx = svgP.x - se8CarDragState.startX;
  const dy = svgP.y - se8CarDragState.startY;
  se8Cars[se8CarDragState.carIdx].x = Math.round(se8CarDragState.origX + dx);
  se8Cars[se8CarDragState.carIdx].y = Math.round(se8CarDragState.origY + dy);
  drawSE8Cars();
}
function onSE8CarMouseUp() {
  if (se8CarDragState) { saveSE8Cars(); se8CarDragState = null; }
  document.removeEventListener('mousemove', onSE8CarMouseMove);
  document.removeEventListener('mouseup', onSE8CarMouseUp);
}
function onSE8CarTouchStart(e) {
  if (!se8EditLayout) return;
  e.preventDefault(); e.stopPropagation();
  const carIdx = parseInt(e.currentTarget.getAttribute('data-car'));
  const svg = document.getElementById('se8Svg');
  const touch = e.touches[0];
  const pt = svg.createSVGPoint();
  pt.x = touch.clientX; pt.y = touch.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  se8CarDragState = { carIdx, startX: svgP.x, startY: svgP.y, origX: se8Cars[carIdx].x, origY: se8Cars[carIdx].y };
  document.addEventListener('touchmove', onSE8CarTouchMove, { passive: false });
  document.addEventListener('touchend', onSE8CarTouchEnd);
}
function onSE8CarTouchMove(e) {
  if (!se8CarDragState) return;
  e.preventDefault();
  const svg = document.getElementById('se8Svg');
  const touch = e.touches[0];
  const pt = svg.createSVGPoint();
  pt.x = touch.clientX; pt.y = touch.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  const dx = svgP.x - se8CarDragState.startX;
  const dy = svgP.y - se8CarDragState.startY;
  se8Cars[se8CarDragState.carIdx].x = Math.round(se8CarDragState.origX + dx);
  se8Cars[se8CarDragState.carIdx].y = Math.round(se8CarDragState.origY + dy);
  drawSE8Cars();
}
function onSE8CarTouchEnd() {
  if (se8CarDragState) { saveSE8Cars(); se8CarDragState = null; }
  document.removeEventListener('touchmove', onSE8CarTouchMove);
  document.removeEventListener('touchend', onSE8CarTouchEnd);
}

function drawSE8Man() {
  const g = document.getElementById('se8ManLayer');
  if (!g) return;
  const { x, y, scale } = se8Man;
  const events = se8EditLayout ? `data-man="1" style="cursor: move;"` : '';
  g.innerHTML = `
    <g ${events} transform="translate(${x}, ${y}) scale(${scale})">
      <circle cx="0" cy="-18" r="5" fill="#1e293b"/>
      <rect x="-4" y="-12" width="8" height="14" rx="2" fill="#1e293b"/>
      <rect x="-10" y="-10" width="4" height="12" rx="2" fill="#1e293b"/>
      <rect x="6" y="-10" width="4" height="12" rx="2" fill="#1e293b"/>
      <rect x="-4" y="2" width="3" height="10" rx="1" fill="#1e293b"/>
      <rect x="1" y="2" width="3" height="10" rx="1" fill="#1e293b"/>
    </g>
  `;
  if (se8EditLayout) {
    const el = g.querySelector('g[data-man]');
    if (el) {
      el.addEventListener('mousedown', onSE8ManMouseDown);
      el.addEventListener('touchstart', onSE8ManTouchStart, { passive: false });
      el.addEventListener('contextmenu', onSE8ManContext);
    }
  }
}
function onSE8ManContext(e) {
  if (!se8EditLayout) return;
  e.preventDefault(); e.stopPropagation();
  if (!confirm('Сбросить силуэт человечка?')) return;
  se8Man = JSON.parse(JSON.stringify(SE8_MAN_DEFAULT));
  saveSE8Man();
  renderSE8Blank();
}
function onSE8ManMouseDown(e) {
  if (!se8EditLayout) return;
  e.preventDefault(); e.stopPropagation();
  const svg = document.getElementById('se8Svg');
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  se8ManDragState = { startX: svgP.x, startY: svgP.y, origX: se8Man.x, origY: se8Man.y };
  document.addEventListener('mousemove', onSE8ManMouseMove);
  document.addEventListener('mouseup', onSE8ManMouseUp);
}
function onSE8ManMouseMove(e) {
  if (!se8ManDragState) return;
  const svg = document.getElementById('se8Svg');
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  const dx = svgP.x - se8ManDragState.startX;
  const dy = svgP.y - se8ManDragState.startY;
  se8Man.x = Math.round(se8ManDragState.origX + dx);
  se8Man.y = Math.round(se8ManDragState.origY + dy);
  drawSE8Man();
}
function onSE8ManMouseUp() {
  if (se8ManDragState) { saveSE8Man(); se8ManDragState = null; }
  document.removeEventListener('mousemove', onSE8ManMouseMove);
  document.removeEventListener('mouseup', onSE8ManMouseUp);
}
function onSE8ManTouchStart(e) {
  if (!se8EditLayout) return;
  e.preventDefault(); e.stopPropagation();
  const svg = document.getElementById('se8Svg');
  const touch = e.touches[0];
  const pt = svg.createSVGPoint();
  pt.x = touch.clientX; pt.y = touch.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  se8ManDragState = { startX: svgP.x, startY: svgP.y, origX: se8Man.x, origY: se8Man.y };
  document.addEventListener('touchmove', onSE8ManTouchMove, { passive: false });
  document.addEventListener('touchend', onSE8ManTouchEnd);
}
function onSE8ManTouchMove(e) {
  if (!se8ManDragState) return;
  e.preventDefault();
  const svg = document.getElementById('se8Svg');
  const touch = e.touches[0];
  const pt = svg.createSVGPoint();
  pt.x = touch.clientX; pt.y = touch.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  const dx = svgP.x - se8ManDragState.startX;
  const dy = svgP.y - se8ManDragState.startY;
  se8Man.x = Math.round(se8ManDragState.origX + dx);
  se8Man.y = Math.round(se8ManDragState.origY + dy);
  drawSE8Man();
}
function onSE8ManTouchEnd() {
  if (se8ManDragState) { saveSE8Man(); se8ManDragState = null; }
  document.removeEventListener('touchmove', onSE8ManTouchMove);
  document.removeEventListener('touchend', onSE8ManTouchEnd);
}

// ======================== ОТРИСОВКА ПОСТОВ + ИМЯ + АВАТАРЫ ========================
function redrawSE8PostsOnly() {
  const g = document.getElementById('se8Posts');
  if (!g) return;
  const section = getCurrentSection();
  const psts = section.posts.map(p => p.name);
  const levels = data;
  const day = getCurrentDay();
  const opList = getCurrentOperators();

  const shortenName = (fullName) => {
    if (!fullName) return '';
    const parts = String(fullName).trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    const surname = parts[0];
    const initials = parts.slice(1).map(w => (w[0] || '').toUpperCase() + '.').join('');
    return surname + ' ' + initials;
  };

  const render = (l) => {
    if (!psts[l.postIndex]) return '';
    const r = l.postIndex;
    const postId = section.posts[r].id;
    const assignedIds = normalizeAssignment(day.assignments[postId]);
    const label = (psts[r].match(/Пост\s*(\S+)/) || [null, r + 1])[1];

    let hasWorking = false;
    let hasLearning = false;
    assignedIds.forEach(oid => {
      const idx = opList.findIndex(o => o.id === oid);
      if (idx < 0) return;
      const lvl = levels[r][idx];
      if (lvl === 'Iкр') hasLearning = true;
      else hasWorking = true;
    });

    let fill = '#ef4444';
    if (hasLearning) fill = '#facc15';
    else if (hasWorking) fill = '#16a34a';

    let namesSvg = '';
    if (se8Settings.showNames && assignedIds.length > 0) {
      const slots = assignedIds.slice(0, 2);
      const names = [];
      slots.forEach(oid => {
        const idx = opList.findIndex(o => o.id === oid);
        if (idx < 0) return;
        const opObj = opList[idx];
        if (!opObj) return;
        const shortName = shortenName(opObj.name);
        const lvl = levels[r][idx];
        names.push((lvl === 'Iкр' ? '△ ' : '') + shortName);
      });

      const cx = l.x + l.w / 2;
      if (names.length === 1) {
        namesSvg += `<text x="${cx}" y="${l.y + l.h / 2 + 3.5}" text-anchor="middle" font-size="7.5" font-weight="700" fill="#fff" style="pointer-events:none;font-family:'Segoe UI',sans-serif;">${escapeHtml(names[0])}</text>`;
      } else if (names.length === 2) {
        namesSvg += `<text x="${cx}" y="${l.y + l.h / 2 - 1}" text-anchor="middle" font-size="7" font-weight="700" fill="#fff" style="pointer-events:none;font-family:'Segoe UI',sans-serif;">${escapeHtml(names[0])}</text>`;
        namesSvg += `<text x="${cx}" y="${l.y + l.h / 2 + 8}" text-anchor="middle" font-size="7" font-weight="700" fill="#fff" style="pointer-events:none;font-family:'Segoe UI',sans-serif;">${escapeHtml(names[1])}</text>`;
      }
    }

    let avatarsSvg = '';
    if (se8Settings.showNames && assignedIds.length > 0) {
      const avatarSize = l.h;
      const gap        = 0;
      const startX     = l.x + l.w;
      const startY     = l.y;

      const slots = assignedIds.slice(0, 3);
      slots.forEach((oid, k) => {
        const idx = opList.findIndex(o => o.id === oid);
        if (idx < 0) return;
        const opObj = opList[idx];
        if (!opObj) return;

        const ax = startX + k * (avatarSize + gap);
        const ay = startY;

        if (opObj.photo) {
          // ← детерминированный clipId (без Math.random()) — позволяет браузеру кэшировать SVG
          const clipId = `se8clip_${r}_${k}`;
          avatarsSvg += `<defs><clipPath id="${clipId}"><rect x="${ax}" y="${ay}" width="${avatarSize}" height="${avatarSize}" rx="3"/></clipPath></defs>`;
          avatarsSvg += `<image href="${opObj.photo}" x="${ax}" y="${ay}" width="${avatarSize}" height="${avatarSize}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice" style="pointer-events:none;"/>`;
          avatarsSvg += `<rect x="${ax}" y="${ay}" width="${avatarSize}" height="${avatarSize}" rx="3" fill="none" stroke="#fff" stroke-width="1.2" style="pointer-events:none;"/>`;
          avatarsSvg += `<rect x="${ax}" y="${ay}" width="${avatarSize}" height="${avatarSize}" rx="3" fill="none" stroke="#000" stroke-width="0.5" opacity="0.4" style="pointer-events:none;"/>`;
        } else {
          const initials = opObj.name.split(' ').map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
          avatarsSvg += `<rect x="${ax}" y="${ay}" width="${avatarSize}" height="${avatarSize}" rx="3" fill="#334155" stroke="#fff" stroke-width="1.2" style="pointer-events:none;"/>`;
          avatarsSvg += `<text x="${ax + avatarSize / 2}" y="${ay + avatarSize / 2 + 4}" text-anchor="middle" font-size="${Math.round(avatarSize * 0.45)}" font-weight="700" fill="#fff" style="pointer-events:none;">${escapeHtml(initials)}</text>`;
        }
      });
    }

    let icons = '';
    let ix = l.x + l.w - 11;
    const iy = l.y + 1;
    if (section.posts[r].issues) { icons += `<polygon points="${ix+5},${iy+1} ${ix+10},${iy+10} ${ix},${iy+10}" fill="#ef4444" stroke="#000" stroke-width="0.5"/>`; ix -= 11; }
    if (section.posts[r].defectRisk) { icons += `<circle cx="${ix+5}" cy="${iy+5}" r="5" fill="#ef4444" stroke="#fff" stroke-width="0.5"/>`; ix -= 11; }
    if (section.posts[r].bodyZone) { icons += `<circle cx="${ix+5}" cy="${iy+5}" r="5" fill="#000"/><text x="${ix+5}" y="${iy+8}" text-anchor="middle" font-size="7" font-weight="700" fill="#fff" style="pointer-events:none;">C</text>`; ix -= 11; }

    const events = se8EditLayout ? '' : `draggable="false"
         ondragstart="onSE8DragStart(event, ${r})"
         ondragover="onSE8DragOver(event, ${r})"
         ondragleave="onSE8DragLeave(event, ${r})"
         ondrop="onSE8Drop(event, ${r})"
         ondragend="onSE8DragEnd(event)"
         onclick="onSE8PostClick(event, ${r})"
         ondblclick="onSE8PostDoubleClick(event, ${r})"
         oncontextmenu="onSE8PostRightClick(event, ${r})"
         onmouseenter="showSE8PostHover(event, ${r})"
         onmouseleave="hideSE8PostHover()"`;

    return `
      <g class="se8-post" data-post="${r}" ${events}>
        <rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" fill="${fill}" stroke="#000" stroke-width="1.5" rx="2"/>
        <text x="${l.x + l.w/2}" y="${l.y + 11}" text-anchor="middle" font-size="9" font-weight="700" fill="#fff" style="pointer-events:none;">${escapeHtml(String(label))}</text>
        ${namesSvg}
        ${icons}
        ${avatarsSvg}
      </g>
    `;
  };

  g.innerHTML = se8Layout.rightColumn.map(render).join('') + se8Layout.bottomRow.map(render).join('') + se8Layout.standalone.map(render).join('');
  if (se8EditLayout) attachSE8LayoutDrag();
}

// ======================== ПАНЕЛЬ ОПЕРАТОРОВ ========================
function drawSE8Panel() {
  const cont = document.getElementById('se8PanelOps');
  if (!cont) return;
  const section = getCurrentSection();
  const day = getCurrentDay();
  const opList = getCurrentOperators();
  const onlyFree = document.getElementById('se8OnlyFree')?.checked;

  const busyIds = new Set();
  section.posts.forEach(p => {
    normalizeAssignment(day.assignments[p.id]).forEach(oid => busyIds.add(oid));
  });

  let html = '';
  opList.forEach((op, idx) => {
    if (op.role === 'НУ') return;
    const isBusy = busyIds.has(op.id);
    if (onlyFree && isBusy) return;
    const att = day.attendance[op.id] || 'Я';
    if (att !== 'Я') return;

    let poly = 0;
    section.posts.forEach(p => {
      const lvl = day.levels[p.id]?.[op.id];
      if (lvl === 'L' || lvl === 'U') poly++;
    });

    let postIdx = -1;
    section.posts.forEach((p, i) => {
      if (normalizeAssignment(day.assignments[p.id]).includes(op.id)) postIdx = i;
    });

    const postLabel = postIdx >= 0 ? (section.posts[postIdx].name.match(/Пост\s*(\S+)/) || [null, ''])[1] : '';
    const roleColor = op.role === 'СО' ? '#f59e0b' : op.role === 'Ф' ? '#8b5cf6' : '#3b82f6';

    let avatarHtml = '';
    if (op.photo) {
      avatarHtml = `<img src="${op.photo}" class="se8-op-avatar" alt="${escapeHtml(op.name)}">`;
    } else {
      const initials = op.name.split(' ').map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
      avatarHtml = `<div class="se8-op-avatar se8-op-avatar-empty">${escapeHtml(initials)}</div>`;
    }

    html += `
      <div class="se8-op-card ${isBusy ? 'busy' : ''}"
           draggable="${se8EditLayout ? 'false' : 'true'}"
           ondragstart="onSE8PanelDragStart(event, ${idx})"
           ondragend="onSE8DragEnd(event)"
           onclick="onSE8PanelOpClick(event, ${idx})"
           oncontextmenu="onSE8PanelOpContext(event, ${idx})"
           title="Поливалентность: ${poly} постов">
        ${avatarHtml}
        <div class="se8-op-role" style="background:${roleColor}">${escapeHtml(op.role)}</div>
        <div class="se8-op-info">
          <div class="se8-op-name">${escapeHtml(op.name)}</div>
          <div class="se8-op-meta">${isBusy ? 'на посту ' + escapeHtml(String(postLabel)) : 'свободен'} · полив. ${poly}</div>
        </div>
      </div>
    `;
  });

  if (!html) html = '<div style="padding:10px;color:#94a3b8;font-size:12px;text-align:center;">Нет операторов</div>';
  cont.innerHTML = html;
}

function drawSE8Blocks() {
  const section = getCurrentSection();
  const opList = getCurrentOperators();

  const learnList = document.getElementById('se8LearningList');
  let learnHtml = '';
  section.posts.forEach((p, r) => {
    if (attendanceData[r] && Object.values(attendanceData[r]).includes('△')) {
      for (let c = 0; c < opList.length; c++) {
        if (attendanceData[r][c] === '△') {
          const postLabel = (p.name.match(/Пост\s*(\S+)/) || [null, p.name])[1];
          learnHtml += `<div class="se8-block-item clickable" onclick="openMatrixWithOperator(${c})">${escapeHtml(opList[c].name)} → <b>${escapeHtml(String(postLabel))}</b></div>`;
        }
      }
    }
  });
  if (learnList) learnList.innerHTML = learnHtml || '<div class="se8-block-empty">Нет обучающихся</div>';

  const issList = document.getElementById('se8IssuesList');
  let issHtml = '';
  section.posts.forEach((p, r) => {
    if (p.issues) {
      const postLabel = (p.name.match(/Пост\s*(\S+)/) || [null, p.name])[1];
      issHtml += `<div class="se8-block-item clickable" onclick="openMatrixWithPost(${r})">⚡ <b>${escapeHtml(String(postLabel))}</b> — ${escapeHtml(p.name)}</div>`;
    }
  });
  if (issList) issList.innerHTML = issHtml || '<div class="se8-block-empty">Всё исправно</div>';
}

function toggleSE8Filter(filter) {
  se8Filter = (se8Filter === filter) ? null : filter;
  applySE8FilterVisual();
}
function applySE8FilterVisual() {
  const section = getCurrentSection();
  // ← кэшируем массивы — не дёргаем глобальные прокси в цикле
  const issues = section.posts.map(p => p.issues);
  const risks = section.posts.map(p => p.defectRisk);
  const bodies = section.posts.map(p => p.bodyZone);

  document.querySelectorAll('.se8-legend-row').forEach(el => {
    const f = el.getAttribute('data-filter');
    el.classList.toggle('active', f === se8Filter);
  });
  document.querySelectorAll('.se8-post').forEach(g => {
    const r = parseInt(g.getAttribute('data-post'));
    let show = true;
    if (se8Filter === 'learning') show = attendanceData[r] && Object.values(attendanceData[r]).includes('△');
    else if (se8Filter === 'issues') show = issues[r];
    else if (se8Filter === 'risk') show = risks[r];
    else if (se8Filter === 'body') show = bodies[r];
    g.style.opacity = show ? '1' : '0.2';
  });
}

function onSE8PanelDragStart(event, opIdx) {
  if (se8EditLayout) { event.preventDefault(); return; }
  se8DraggedOpIndex = opIdx;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', 'panel:' + opIdx);
}
function onSE8DragStart(event) { if (se8EditLayout) { event.preventDefault(); return; } event.preventDefault(); }
function onSE8DragOver(event) { if (se8EditLayout) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; event.currentTarget.classList.add('drag-over'); }
function onSE8DragLeave(event) { if (se8EditLayout) return; event.currentTarget.classList.remove('drag-over'); }
function onSE8Drop(event, postIndex) {
  if (se8EditLayout) return;
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  const section = getCurrentSection();
  const day = getCurrentDay();
  const opList = getCurrentOperators();
  const pid = section.posts[postIndex].id;
  if (se8DraggedOpIndex === null) return;
  const opId = opList[se8DraggedOpIndex].id;
  const opName = opList[se8DraggedOpIndex].name;
  section.posts.forEach(p => {
    if (p.id === pid) return;
    const list = normalizeAssignment(day.assignments[p.id]);
    if (list.includes(opId)) {
      setAssignmentList(day.assignments, p.id, list.filter(x => x !== opId));
      logPlacement(opName, p.name, 'unassign');
    }
  });
  const curList = normalizeAssignment(day.assignments[pid]);
  if (!curList.includes(opId)) curList.push(opId);
  setAssignmentList(day.assignments, pid, curList);
  logPlacement(opName, section.posts[postIndex].name, 'assign');
  saveSystem();
  se8DraggedOpIndex = null;
  renderSE8Blank();
  if (typeof renderMatrix === 'function') renderMatrix();
}
function onSE8DragEnd() {
  se8DraggedOpIndex = null;
  document.querySelectorAll('.se8-post').forEach(el => el.classList.remove('drag-over'));
}

function showSE8PostHover(event, postIndex) {
  if (se8EditLayout) return;
  const section = getCurrentSection();
  const day = getCurrentDay();
  const opList = getCurrentOperators();
  const pid = section.posts[postIndex].id;
  const assignedIds = normalizeAssignment(day.assignments[pid]);

  let html = `<div style="font-weight:700;margin-bottom:4px;">${escapeHtml(section.posts[postIndex].name)}</div>`;
  html += `<div style="font-size:11px;color:#64748b;">Сложность: <b>${escapeHtml(section.posts[postIndex].difficulty)}</b> · Эргономика: <b>${escapeHtml(section.posts[postIndex].ergonomics)}</b> · Срок: <b>${section.posts[postIndex].trainingDays}д</b></div>`;

  if (assignedIds.length > 0) {
    html += `<div style="margin-top:6px;border-top:1px solid #e2e8f0;padding-top:4px;">`;
    assignedIds.forEach(oid => {
      const opIdx = opList.findIndex(o => o.id === oid);
      if (opIdx < 0) return;
      const op = opList[opIdx];
      const lvl = day.levels[pid]?.[oid] || '—';
      const att = day.attendance[oid] || 'Я';
      const lastDate = getLastPlacementDate(op.name, section.posts[postIndex].name);
      const lastStr = lastDate ? lastDate.toLocaleDateString('ru-RU') : 'никогда';
      html += `<div style="margin-bottom:4px;">
        <div><b>${escapeHtml(op.name)}</b> (${escapeHtml(op.role)})</div>
        <div>Уровень: <b>${escapeHtml(lvl)}</b> · Явка: <b>${escapeHtml(att)}</b></div>
        <div style="color:#64748b;">Последнее: ${escapeHtml(lastStr)}</div>
      </div>`;
    });
    html += `</div>`;
  } else {
    html += `<div style="margin-top:6px;color:#94a3b8;">— Свободен —</div>`;
  }

  const tip = document.createElement('div');
  tip.className = 'se8-hover-tip';
  tip.innerHTML = html;
  document.body.appendChild(tip);
  const rect = event.currentTarget.getBoundingClientRect();
  let left = rect.right + 10, top = rect.top;
  if (left + 240 > window.innerWidth) left = rect.left - 250;
  if (top + 150 > window.innerHeight) top = window.innerHeight - 160;
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
}
function hideSE8PostHover() {
  document.querySelectorAll('.se8-hover-tip').forEach(el => el.remove());
}

function onSE8PostClick(event, postIndex) {
  if (se8EditLayout) return;
  event.stopPropagation();
  hideMenu();
  const section = getCurrentSection();
  const day = getCurrentDay();
  const opList = getCurrentOperators();
  const pid = section.posts[postIndex].id;
  const curList = normalizeAssignment(day.assignments[pid]);

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.position = 'fixed';
  menu.style.zIndex = '10000';
  menu.style.maxHeight = '380px';
  menu.style.overflowY = 'auto';
  menu.style.minWidth = '240px';

  let html = `<div style="font-weight:700;padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;">${escapeHtml(section.posts[postIndex].name)}</div>`;
  curList.forEach(oid => {
    const idx = opList.findIndex(o => o.id === oid);
    if (idx < 0) return;
    const lvl = day.levels[pid]?.[oid] || '—';
    html += `<div onclick="removeSE8FromPost(${postIndex}, ${idx}); hideMenu();" style="color:#ef4444;">— Снять ${escapeHtml(opList[idx].name)} (${escapeHtml(lvl)})</div>`;
  });

  let count = 0;
  opList.forEach((op, idx) => {
    if (op.role === 'НУ') return;
    if (day.attendance[op.id] !== 'Я') return;
    const lvl = day.levels[pid]?.[op.id];
    if (!lvl) return;
    if (curList.includes(op.id)) return;
    count++;
    html += `<div onclick="addSE8ToPost(${postIndex}, ${idx}); hideMenu();">${escapeHtml(op.name)} <span style="color:#64748b;font-size:11px;">(${escapeHtml(lvl)})</span></div>`;
  });
  if (count === 0 && curList.length === 0) {
    html += `<div style="padding:8px 12px;color:#94a3b8;font-size:12px;">Нет свободных операторов</div>`;
  }

  html += `<div style="border-top:1px solid #e2e8f0;margin:4px 0;"></div>`;
  html += `<div onclick="openPostProfile(${postIndex}); hideMenu();">👁 Профиль поста</div>`;
  html += `<div onclick="openDevelopmentWithPost(${postIndex}); hideMenu();">📈 Открыть в развитии</div>`;

  menu.innerHTML = html;
  menu.style.left = Math.min(event.clientX, window.innerWidth - 260) + 'px';
  menu.style.top = Math.min(event.clientY, window.innerHeight - 400) + 'px';
  document.body.appendChild(menu);
  currentMenu = menu;
  setTimeout(() => {
    const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); } };
    document.addEventListener('click', close);
  }, 10);
}
function addSE8ToPost(postIndex, opIdx) {
  const section = getCurrentSection();
  const day = getCurrentDay();
  const opList = getCurrentOperators();
  const pid = section.posts[postIndex].id;
  const opId = opList[opIdx].id;
  const opName = opList[opIdx].name;

  section.posts.forEach(p => {
    if (p.id === pid) return;
    const list = normalizeAssignment(day.assignments[p.id]);
    if (list.includes(opId)) {
      setAssignmentList(day.assignments, p.id, list.filter(x => x !== opId));
      logPlacement(opName, p.name, 'unassign');
    }
  });
  const curList = normalizeAssignment(day.assignments[pid]);
  if (!curList.includes(opId)) curList.push(opId);
  setAssignmentList(day.assignments, pid, curList);
  logPlacement(opName, section.posts[postIndex].name, 'assign');
  saveSystem();
  renderSE8Blank();
  if (typeof renderMatrix === 'function') renderMatrix();
}
function removeSE8FromPost(postIndex, opIdx) {
  const section = getCurrentSection();
  const day = getCurrentDay();
  const opList = getCurrentOperators();
  const pid = section.posts[postIndex].id;
  const opId = opList[opIdx].id;
  const opName = opList[opIdx].name;
  const list = normalizeAssignment(day.assignments[pid]);
  setAssignmentList(day.assignments, pid, list.filter(x => x !== opId));
  logPlacement(opName, section.posts[postIndex].name, 'unassign');
  saveSystem();
  renderSE8Blank();
  if (typeof renderMatrix === 'function') renderMatrix();
}
function onSE8PostDoubleClick(event, postIndex) {
  if (se8EditLayout) return;
  event.stopPropagation();
  hideMenu();
  const tabBtn = document.querySelector('.tab:nth-child(1)');
  if (tabBtn) tabBtn.click();
  setTimeout(() => {
    const row = document.querySelector(`#iluTable tbody tr:nth-child(${postIndex + 1})`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.style.transition = 'background 0.3s';
      row.style.background = '#fef9c3';
      setTimeout(() => { row.style.background = ''; }, 2000);
    }
  }, 100);
}
function onSE8PostRightClick(event, postIndex) {
  if (se8EditLayout) {
    event.preventDefault(); event.stopPropagation(); hideMenu();
    const section = getCurrentSection();
    const post = section.posts[postIndex];
    if (!post) return;
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.position = 'fixed';
    menu.style.zIndex = '10000';
    menu.style.minWidth = '220px';
    menu.innerHTML = `
      <div style="font-weight:700;padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;">${escapeHtml(post.name)}</div>
      <div onclick="addSE8NewPost(); hideMenu();">➕ Добавить ещё пост</div>
      <div class="danger" onclick="deleteSE8Post(${postIndex}); hideMenu();">🗑 Удалить пост</div>
      <div style="border-top:1px solid #e2e8f0;margin:4px 0;"></div>
      <div onclick="resetSE8Layout(); hideMenu();">↺ Сбросить положение</div>
    `;
    menu.style.left = Math.min(event.clientX, window.innerWidth - 250) + 'px';
    menu.style.top  = Math.min(event.clientY, window.innerHeight - 260) + 'px';
    document.body.appendChild(menu);
    currentMenu = menu;
    setTimeout(() => {
      const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); } };
      document.addEventListener('click', close);
    }, 10);
    return;
  }

  event.preventDefault(); event.stopPropagation(); hideMenu();
  const section = getCurrentSection();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.position = 'fixed';
  menu.style.zIndex = '10000';
  menu.style.minWidth = '220px';
  let html = `<div style="font-weight:700;padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;">${escapeHtml(section.posts[postIndex].name)}</div>`;
  const history = (getSystem().placementLog || []).filter(e => e.postName === section.posts[postIndex].name).slice(-5).reverse();
  html += `<div style="padding:6px 12px;font-size:11px;color:#64748b;font-weight:700;">Последние 5 записей:</div>`;
  if (history.length === 0) html += `<div style="padding:4px 12px;color:#94a3b8;font-size:11px;">— пусто —</div>`;
  else history.forEach(e => {
    const dt = e.date + (e.time ? ' ' + e.time : '');
    const act = e.action === 'assign' ? '✅' : e.action === 'unassign' ? '❌' : '⚠️';
    html += `<div style="padding:3px 12px;font-size:11px;color:#475569;">${act} ${escapeHtml(dt)} — ${escapeHtml(e.opName)}</div>`;
  });
  html += `<div style="border-top:1px solid #e2e8f0;margin:4px 0;"></div>`;
  html += `<div onclick="openPostProfile(${postIndex}); hideMenu();">👁 Профиль поста</div>`;
  html += `<div onclick="onSE8PostDoubleClick(event, ${postIndex}); hideMenu();">📊 Открыть в матрице</div>`;
  html += `<div onclick="openDevelopmentWithPost(${postIndex}); hideMenu();">📈 Открыть в развитии</div>`;
  html += `<div style="border-top:1px solid #e2e8f0;margin:4px 0;"></div>`;
  const mk = (flag, label, color) => `<div onclick="toggleSE8PostFlag(${postIndex}, '${flag}'); hideMenu();" style="color:${color};">${label}</div>`;
  html += mk('issues', postIssues[postIndex] ? '⚡ Убрать «Неисправное»' : '⚡ Отметить «Неисправное»', '#ef4444');
  html += mk('risk', postDefectRisk[postIndex] ? '🔴 Убрать «Риск»' : '🔴 Отметить «Риск дефекта»', '#ef4444');
  html += mk('body', postBodyZone[postIndex] ? 'C Убрать «Зона кузова»' : 'C Отметить «Зона кузова»', '#0f172a');
  menu.innerHTML = html;
  menu.style.left = Math.min(event.clientX, window.innerWidth - 250) + 'px';
  menu.style.top = Math.min(event.clientY, window.innerHeight - 400) + 'px';
  document.body.appendChild(menu);
  currentMenu = menu;
  setTimeout(() => {
    const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); } };
    document.addEventListener('click', close);
  }, 10);
}
function toggleSE8PostFlag(postIndex, flag) {
  const section = getCurrentSection();
  const post = section.posts[postIndex];
  if (!post) return;
  if (flag === 'issues') updatePost(post.id, { issues: !post.issues });
  if (flag === 'risk') updatePost(post.id, { defectRisk: !post.defectRisk });
  if (flag === 'body') updatePost(post.id, { bodyZone: !post.bodyZone });
  renderSE8Blank();
}

function findPostLayout(postIndex) {
  for (const col of ['rightColumn', 'bottomRow', 'standalone']) {
    const item = se8Layout[col].find(p => p.postIndex === postIndex);
    if (item) return { item, col };
  }
  return null;
}
function attachSE8LayoutDrag() {
  const svg = document.getElementById('se8Svg');
  if (!svg) return;
  svg.querySelectorAll('.se8-post').forEach(g => {
    g.onclick = null; g.ondblclick = null; g.oncontextmenu = null;
    g.onmouseenter = null; g.onmouseleave = null;
    g.setAttribute('draggable', 'false');
    g.style.cursor = 'move';
    g.addEventListener('mousedown', onSE8LayoutMouseDown);
    g.addEventListener('touchstart', onSE8LayoutTouchStart, { passive: false });
    g.addEventListener('contextmenu', (e) => {
      const pi = parseInt(g.getAttribute('data-post'));
      onSE8PostRightClick(e, pi);
    });
  });
}
function onSE8LayoutMouseDown(e) {
  if (!se8EditLayout) return;
  if (e.button === 2) return;
  e.preventDefault(); e.stopPropagation();
  const postIndex = parseInt(e.currentTarget.getAttribute('data-post'));
  const svg = document.getElementById('se8Svg');
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  const postData = findPostLayout(postIndex);
  if (!postData) return;
  se8DragState = { postIndex, startX: svgP.x, startY: svgP.y, origX: postData.item.x, origY: postData.item.y };
  document.addEventListener('mousemove', onSE8LayoutMouseMove);
  document.addEventListener('mouseup', onSE8LayoutMouseUp);
}
function onSE8LayoutMouseMove(e) {
  if (!se8DragState) return;
  const svg = document.getElementById('se8Svg');
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  const dx = svgP.x - se8DragState.startX;
  const dy = svgP.y - se8DragState.startY;
  const layoutInfo = findPostLayout(se8DragState.postIndex);
  if (!layoutInfo) return;
  layoutInfo.item.x = Math.round(se8DragState.origX + dx);
  layoutInfo.item.y = Math.round(se8DragState.origY + dy);
  redrawSE8PostsOnly();
}
function onSE8LayoutMouseUp() {
  if (se8DragState) { saveSE8Layout(); se8DragState = null; }
  document.removeEventListener('mousemove', onSE8LayoutMouseMove);
  document.removeEventListener('mouseup', onSE8LayoutMouseUp);
}
function onSE8LayoutTouchStart(e) {
  if (!se8EditLayout) return;
  e.preventDefault(); e.stopPropagation();
  const postIndex = parseInt(e.currentTarget.getAttribute('data-post'));
  const svg = document.getElementById('se8Svg');
  const touch = e.touches[0];
  const pt = svg.createSVGPoint();
  pt.x = touch.clientX; pt.y = touch.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  const postData = findPostLayout(postIndex);
  if (!postData) return;
  se8DragState = { postIndex, startX: svgP.x, startY: svgP.y, origX: postData.item.x, origY: postData.item.y };
  document.addEventListener('touchmove', onSE8LayoutTouchMove, { passive: false });
  document.addEventListener('touchend', onSE8LayoutTouchEnd);
}
function onSE8LayoutTouchMove(e) {
  if (!se8DragState) return;
  e.preventDefault();
  const svg = document.getElementById('se8Svg');
  const touch = e.touches[0];
  const pt = svg.createSVGPoint();
  pt.x = touch.clientX; pt.y = touch.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  const dx = svgP.x - se8DragState.startX;
  const dy = svgP.y - se8DragState.startY;
  const layoutInfo = findPostLayout(se8DragState.postIndex);
  if (!layoutInfo) return;
  layoutInfo.item.x = Math.round(se8DragState.origX + dx);
  layoutInfo.item.y = Math.round(se8DragState.origY + dy);
  redrawSE8PostsOnly();
}
function onSE8LayoutTouchEnd() {
  if (se8DragState) { saveSE8Layout(); se8DragState = null; }
  document.removeEventListener('touchmove', onSE8LayoutTouchMove);
  document.removeEventListener('touchend', onSE8LayoutTouchEnd);
}

function onSE8PanelOpClick(event, opIdx) {
  if (se8EditLayout) return;
  event.stopPropagation();
  const tabBtn = document.querySelector('.tab:nth-child(1)');
  if (tabBtn) tabBtn.click();
  setTimeout(() => { highlightMatrixOperator(opIdx); }, 100);
}
function highlightMatrixOperator(opIdx) {
  const table = document.getElementById('iluTable');
  if (!table) return;
  table.querySelectorAll('.matrix-highlight').forEach(el => el.classList.remove('matrix-highlight'));
  const colStatus = 5 + opIdx * 2;
  const colLevel = colStatus + 1;
  const headerRows = table.querySelectorAll('thead tr');
  headerRows.forEach((tr, i) => {
    const cells = tr.querySelectorAll('th, td');
    if (i === 0) {
      let c = 4;
      cells.forEach(th => {
        const span = parseInt(th.getAttribute('colspan')) || 1;
        if (opIdx === (c - 4) / 2 || (c <= 4 + opIdx * 2 && 4 + opIdx * 2 < c + span)) th.classList.add('matrix-highlight');
        c += span;
      });
    } else {
      const cell = cells[colStatus - 1]; if (cell) cell.classList.add('matrix-highlight');
      const cell2 = cells[colLevel - 1]; if (cell2) cell2.classList.add('matrix-highlight');
    }
  });
  table.querySelectorAll('tbody tr').forEach(tr => {
    const cells = tr.querySelectorAll('td');
    const idxStatus = 4 + opIdx * 2;
    const idxLevel = idxStatus + 1;
    if (cells[idxStatus]) cells[idxStatus].classList.add('matrix-highlight');
    if (cells[idxLevel]) cells[idxLevel].classList.add('matrix-highlight');
  });
  table.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => { table.querySelectorAll('.matrix-highlight').forEach(el => el.classList.remove('matrix-highlight')); }, 4000);
}
function onSE8PanelOpContext(event, opIdx) {
  if (se8EditLayout) return;
  event.preventDefault(); event.stopPropagation(); hideMenu();
  const opList = getCurrentOperators();
  const op = opList[opIdx];
  if (!op) return;
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.position = 'fixed';
  menu.style.zIndex = '10000';
  menu.style.minWidth = '200px';
  menu.innerHTML = `
    <div style="font-weight:700;padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;">${escapeHtml(op.name)}</div>
    <div onclick="openOperatorProfile(${opIdx}); hideMenu();">👤 Профиль</div>
    <div onclick="highlightMatrixOperator(${opIdx}); hideMenu();">📊 Открыть в матрице</div>
    <div onclick="editOperatorByIndex(${opIdx}); hideMenu(); setTimeout(renderSE8Blank, 200);">✏️ Переименовать</div>
    <div onclick="editOperatorRoleByIndex(${opIdx}); hideMenu(); setTimeout(renderSE8Blank, 200);">🎭 Изменить роль</div>
    <div class="danger" onclick="deleteOperatorByIndex(${opIdx}); hideMenu(); setTimeout(renderSE8Blank, 200);">🗑️ Удалить</div>
  `;
  menu.style.left = Math.min(event.clientX, window.innerWidth - 220) + 'px';
  menu.style.top = Math.min(event.clientY, window.innerHeight - 250) + 'px';
  document.body.appendChild(menu);
  currentMenu = menu;
  setTimeout(() => {
    const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); } };
    document.addEventListener('click', close);
  }, 10);
}
function openMatrixWithOperator(opIdx) {
  const tabBtn = document.querySelector('.tab:nth-child(1)');
  if (tabBtn) tabBtn.click();
  setTimeout(() => highlightMatrixOperator(opIdx), 100);
}
function openMatrixWithPost(postIdx) {
  const tabBtn = document.querySelector('.tab:nth-child(1)');
  if (tabBtn) tabBtn.click();
  setTimeout(() => highlightMatrixPost(postIdx), 100);
}
function highlightMatrixPost(postIdx) {
  const table = document.getElementById('iluTable');
  if (!table) return;
  table.querySelectorAll('.matrix-highlight').forEach(el => el.classList.remove('matrix-highlight'));
  const row = table.querySelector(`tbody tr:nth-child(${postIdx + 1})`);
  if (!row) return;
  row.querySelectorAll('td').forEach(td => td.classList.add('matrix-highlight'));
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => { row.querySelectorAll('.matrix-highlight').forEach(el => el.classList.remove('matrix-highlight')); }, 4000);
}
function openDevelopmentWithPost(postIdx) {
  const tabs = document.querySelectorAll('.tab');
  const tabBtn = tabs[5];
  if (!tabBtn) return;
  tabBtn.click();
  setTimeout(() => {
    const tbody = document.querySelector('#devCalendarTable tbody');
    const hasRows = tbody && tbody.querySelectorAll('tr').length > 1;
    if (!hasRows) { if (typeof generateDevelopmentPlan === 'function') generateDevelopmentPlan(); }
    setTimeout(() => highlightDevPost(postIdx), 150);
  }, 100);
}
function highlightDevPost(postIdx) {
  const table = document.getElementById('devCalendarTable');
  if (!table) return;
  table.querySelectorAll('.dev-highlight').forEach(el => el.classList.remove('dev-highlight'));
  const row = table.querySelector(`tbody tr:nth-child(${postIdx + 1})`);
  if (!row) return;
  row.querySelectorAll('td').forEach(td => td.classList.add('dev-highlight'));
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => { row.querySelectorAll('.dev-highlight').forEach(el => el.classList.remove('dev-highlight')); }, 4000);
}

function exportSE8ToSVG() {
  const svg = document.getElementById('se8Svg');
  if (!svg) return;
  const clone = svg.cloneNode(true);
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `text { font-family: 'Segoe UI', sans-serif; }`;
  clone.insertBefore(style, clone.firstChild);
  const serializer = new XMLSerializer();
  const source = '<?xml version="1.0" standalone="no"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' + serializer.serializeToString(clone);
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rasstanovka_' + getCurrentSection().name + '_' + getCurrentShift() + '_' + getCurrentDate().replace(/\./g, '-') + '.svg';
  a.click();
  URL.revokeObjectURL(url);
}
function exportSE8ToPNG() {
  const svg = document.getElementById('se8Svg');
  if (!svg) return;
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `text { font-family: 'Segoe UI', sans-serif; }`;
  clone.insertBefore(style, clone.firstChild);
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = function () {
    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = SE8_VIEWBOX_W * scale;
    canvas.height = SE8_VIEWBOX_H * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(function (blob) {
      const pngUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = 'rasstanovka_' + getCurrentSection().name + '_' + getCurrentShift() + '_' + getCurrentDate().replace(/\./g, '-') + '.png';
      a.click();
      URL.revokeObjectURL(pngUrl);
    });
    URL.revokeObjectURL(url);
  };
  img.src = url;
}
function printSE8() {
  const container = document.getElementById('se8Container');
  if (!container) return;
  const printWindow = window.open('', '_blank', 'width=1400,height=900');
  if (!printWindow) { alert('Разрешите всплывающие окна для печати'); return; }
  const svg = document.getElementById('se8Svg');
  const svgHTML = svg ? svg.outerHTML : '';
  const learnHTML = document.getElementById('se8LearningList')?.innerHTML || '';
  const issHTML = document.getElementById('se8IssuesList')?.innerHTML || '';
  const html = `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <title>Расстановка — ${escapeHtml(getCurrentSection().name)}</title>
      <style>
        @page { size: A4 landscape; margin: 8mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', sans-serif; color: #1e293b; }
        h1 { font-size: 16px; margin-bottom: 4px; font-style: italic; }
        .sub { font-size: 11px; color: #64748b; margin-bottom: 8px; }
        .grid { display: grid; grid-template-columns: 1fr 220px; gap: 8px; align-items: start; }
        .svg-wrap { border: 1px solid #000; }
        .svg-wrap svg { width: 100%; height: auto; display: block; }
        .side-blocks { display: flex; flex-direction: column; gap: 6px; }
        .blk { border: 1px solid #000; padding: 4px 6px; font-size: 9px; }
        .blk-title { font-weight: 700; text-transform: uppercase; font-size: 9px; margin-bottom: 3px; border-bottom: 1px solid #000; padding-bottom: 2px; }
        .blk-item { padding: 2px 0; border-bottom: 1px dotted #cbd5e1; font-size: 9px; }
        .blk-item:last-child { border-bottom: none; }
        .blk-empty { color: #94a3b8; font-style: italic; font-size: 9px; }
      </style>
    </head>
    <body>
      <h1>Расстановка операторов — участок ${escapeHtml(getCurrentSection().name)}</h1>
      <div class="sub">Смена: <b>${escapeHtml(getCurrentShift())}</b> · Дата: <b>${escapeHtml(getCurrentDate())}</b></div>
      <div class="grid">
        <div class="svg-wrap">${svgHTML}</div>
        <div class="side-blocks">
          <div class="blk">
            <div class="blk-title">🎓 Обучение на посту</div>
            ${learnHTML || '<div class="blk-empty">Нет обучающихся</div>'}
          </div>
          <div class="blk">
            <div class="blk-title">⚡ Неисправное оборудование</div>
            ${issHTML || '<div class="blk-empty">Всё исправно</div>'}
          </div>
        </div>
      </div>
      <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); }<\/script>
    </body>
    </html>
  `;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}