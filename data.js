// ======================== МОДЕЛЬ ДАННЫХ v4 ========================

const STORAGE_KEY = 'ilu_system_v4';
const SHIFTS = ['A', 'B', 'C'];
const HISTORY_DAYS = 90;
const AUDIT_MAX_ENTRIES = 5000;

const DEFAULT_DEPARTMENTS = ['Сборка', 'Окраска', 'Сварка'];
const DEFAULT_WORKSHOPS = {
  'Сборка': ['Цех сборки салона', 'Цех сборки механики'],
  'Окраска': ['Цех окраски 1', 'Цех окраски 2'],
  'Сварка': ['Цех сварки 1', 'Цех сварки 2']
};

const DEFAULT_NORMS = {
  coverageU: 80,
  poly2L: 70,
  poly3L: 50,
  attendance: 70,
  minOpsPerPost: 1.5,
  staleDays: 60
};

const AVAILABLE_TAGS = [
  { key: 'newbie',  label: 'Новичок',    color: '#3b82f6' },
  { key: 'mentor',  label: 'Наставник',  color: '#16a34a' },
  { key: 'replace', label: 'На замену',  color: '#f59e0b' },
  { key: 'danger',  label: 'Внимание',   color: '#ef4444' },
  { key: 'multi',   label: 'Универсал',  color: '#8b5cf6' }
];

const OPERATOR_ROLES = [
  { value: 'НУ', label: 'НУ' },
  { value: 'СО', label: 'СО' },
  { value: 'Ф',  label: 'Ф'  },
  { value: 'О',  label: 'О'  },
  { value: 'ДС', label: 'В др. секторе' },
  { value: 'ИС', label: 'Из др. сектора' }
];

const DEFAULT_DEFECT_TYPES = [
  { key: 'HC',   header: 'HC/СО',   label: 'HC — Вызовы операторов / Контролёр',      color: '#3b82f6' },
  { key: 'SAO',  header: 'SAO',     label: 'SAO — Гарантия качества',                 color: '#f59e0b' },
  { key: 'DOFF', header: 'Doff/V1', label: 'DOFF — Вне участка / следующий участок',  color: '#ef4444' }
];

const DEFECT_HEADER_FALLBACK = {
  HC:   'HC/СО',
  SAO:  'SAO',
  DOFF: 'Doff/V1',
};

function genId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ======================== БЕЗОПАСНОСТЬ ========================
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function escapeAttr(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// ======================== ДАТЫ ========================
function formatDate(date = new Date()) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}
function parseDate(str) {
  if (!str || typeof str !== 'string') return null;
  const [d, m, y] = str.split('.').map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}
function shiftDate(dateStr, days) {
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  d.setDate(d.getDate() + days);
  return formatDate(d);
}
function parseRuDate(str) {
  if (!str || str === '—') return null;
  const parts = String(str).split('.');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}
function formatRuDate(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

// ======================== НАЗНАЧЕНИЯ ========================
function normalizeAssignment(val) {
  if (val === null || val === undefined) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'string') return [val];
  return [];
}
function setAssignmentList(assignments, postId, list) {
  const cleaned = list.filter(Boolean);
  if (cleaned.length === 0) assignments[postId] = null;
  else if (cleaned.length === 1) assignments[postId] = cleaned[0];
  else assignments[postId] = cleaned;
}

// ==================== СОЗДАНИЕ ДНЯ ====================
function createEmptyDay(postIds, operatorIds, templateDay) {
  const assignments = {}, attendance = {}, levels = {};
  postIds.forEach(pid => {
    assignments[pid] = null;
    levels[pid] = {};
    operatorIds.forEach(oid => {
      const prevLvl = templateDay?.levels?.[pid]?.[oid];
      levels[pid][oid] = prevLvl !== undefined ? prevLvl : null;
    });
  });
  operatorIds.forEach(oid => { attendance[oid] = 'Я'; });
  return { assignments, attendance, levels };
}

function findTemplateDayForShift(shiftData, targetDateStr) {
  if (!shiftData || !shiftData.days) return null;
  const targetMs = parseDate(targetDateStr)?.getTime() || 0;
  let bestKey = null;
  let bestMs = -Infinity;
  Object.keys(shiftData.days).forEach(dateKey => {
    const d = parseDate(dateKey);
    if (!d) return;
    const ms = d.getTime();
    if (ms >= targetMs) return;
    if (ms > bestMs) { bestMs = ms; bestKey = dateKey; }
  });
  return bestKey ? shiftData.days[bestKey] : null;
}

// ==================== ДОСКА КАЧЕСТВА — СОЗДАНИЕ ====================
function createDefaultQualityBoard() {
  return {
    operators: [],
    posts: [],
    actionPlans: [],
    cars: {},
    history: [],
    lastUpdate: ''
  };
}

// ==================== МИГРАЦИЯ ДОСКИ КАЧЕСТВА ====================
function migrateQualityBoard(sys) {
  if (!sys.qualityBoard || typeof sys.qualityBoard !== 'object') {
    sys.qualityBoard = createDefaultQualityBoard();
  }

  if (!Array.isArray(sys.qualityBoard.operators)) sys.qualityBoard.operators = [];
  if (!Array.isArray(sys.qualityBoard.posts)) sys.qualityBoard.posts = [];
  if (!Array.isArray(sys.qualityBoard.actionPlans)) sys.qualityBoard.actionPlans = [];
  if (!sys.qualityBoard.cars || typeof sys.qualityBoard.cars !== 'object') sys.qualityBoard.cars = {};
  if (!Array.isArray(sys.qualityBoard.history)) sys.qualityBoard.history = [];
  if (typeof sys.qualityBoard.lastUpdate !== 'string') sys.qualityBoard.lastUpdate = '';

  // операторы
  sys.qualityBoard.operators.forEach(o => {
    if (typeof o.id !== 'string') o.id = genId();
    if (typeof o.opId === 'undefined') o.opId = null;
    if (typeof o.name !== 'string') o.name = '';
    if (typeof o.postId !== 'string') o.postId = '';
    if (typeof o.comment !== 'string') o.comment = '';
    if (!o.defects || typeof o.defects !== 'object') o.defects = {};
  });

  // посты (старая модель — оставляем)
  sys.qualityBoard.posts.forEach(p => {
    if (typeof p.id !== 'string') p.id = genId();
    if (typeof p.postId === 'undefined') p.postId = null;
    if (typeof p.number !== 'number') p.number = 0;
    if (typeof p.name !== 'string') p.name = '';
    if (typeof p.operatorId !== 'string') p.operatorId = '';
    if (typeof p.comment !== 'string') p.comment = '';
    if (!p.defects || typeof p.defects !== 'object') p.defects = {};
  });

  // план действий
  sys.qualityBoard.actionPlans.forEach(a => {
    if (typeof a.id !== 'string') a.id = genId();
    if (typeof a.postName !== 'string') a.postName = '';
    if (typeof a.operatorName !== 'string') a.operatorName = '';
    if (typeof a.defect !== 'string') a.defect = '';
    if (typeof a.action !== 'string') a.action = '';
    if (typeof a.pilot !== 'string') a.pilot = '';
    if (typeof a.deadline !== 'string') a.deadline = '';
    if (typeof a.percent !== 'number') a.percent = parseInt(a.percent) || 0;
    if (!['low', 'medium', 'high'].includes(a.priority)) a.priority = 'medium';
    if (!['open', 'in_progress', 'closed'].includes(a.status)) a.status = 'open';
    if (typeof a.createdAt !== 'string') a.createdAt = new Date().toISOString();
  });
}

// ==================== МИГРАЦИЯ АРХИВА ДЕФЕКТОВ ====================
function migrateQualityArchive(sys) {
  if (!Array.isArray(sys.qualityArchive)) sys.qualityArchive = [];
  sys.qualityArchive.forEach(rec => {
    if (typeof rec.id !== 'string') rec.id = genId();
    if (typeof rec.planId !== 'string') rec.planId = '';
    if (typeof rec.createdAt !== 'string') rec.createdAt = new Date().toISOString();
    if (typeof rec.createdDate !== 'string') rec.createdDate = '';
    if (typeof rec.createdTime !== 'string') rec.createdTime = '';
    if (typeof rec.updatedAt !== 'string') rec.updatedAt = '';
    if (typeof rec.postName !== 'string') rec.postName = '';
    if (typeof rec.operatorName !== 'string') rec.operatorName = '';
    if (typeof rec.defect !== 'string') rec.defect = '';
    if (typeof rec.action !== 'string') rec.action = '';
    if (typeof rec.pilot !== 'string') rec.pilot = '';
    if (typeof rec.deadline !== 'string') rec.deadline = '';
    if (typeof rec.percent !== 'number') rec.percent = parseInt(rec.percent) || 0;
    if (!['low', 'medium', 'high'].includes(rec.priority)) rec.priority = 'medium';
    if (!['open', 'in_progress', 'closed'].includes(rec.status)) rec.status = 'open';
    if (typeof rec.deletedFromPlan !== 'boolean') rec.deletedFromPlan = false;
  });
}

// ======================== СОЗДАНИЕ ========================
function createSectionRaw(name, department, workshop) {
  const section = {
    id: genId(),
    name,
    department: department || 'Сборка',
    workshop: workshop || '',
    workshopChief: '',
    posts: [],
    shifts: { A: {}, B: {}, C: {} }
  };
  SHIFTS.forEach(shift => {
    section.shifts[shift] = { sectionChief: '', operators: [], days: {} };
  });
  return section;
}

function createSection(name, department, workshop) {
  const depts = getDepartments();
  const wss = getWorkshopsMap();
  return createSectionRaw(
    name,
    department || depts[0] || 'Сборка',
    workshop || (wss[depts[0]] ? wss[depts[0]][0] : '')
  );
}

function createDefaultSystem() {
  const se8 = createSectionRaw('SE-8', 'Сборка', 'Цех сборки салона');
  return {
    version: 4,
    currentSectionId: se8.id,
    currentDepartment: 'Сборка',
    currentWorkshop: 'Цех сборки салона',
    currentShift: 'A',
    currentDate: formatDate(),
    sections: [se8],
    trainingRecords: [],
    placementLog: [],
    auditLog: [],
    theme: 'light',
    rotationPlans: {},
    developmentPlans: {},
    departments: [...DEFAULT_DEPARTMENTS],
    workshops: JSON.parse(JSON.stringify(DEFAULT_WORKSHOPS)),
    norms: { ...DEFAULT_NORMS },
    currentUser: '',
    autoApply: {
      enabled: false,
      time: '04:00',
      mode: 'fill_empty',
      shifts: ['A', 'B', 'C'],
      lastRunDate: ''
    },
    autoApplyLog: [],
    customTables: [],

    qualityBoard: createDefaultQualityBoard(),
    qualityArchive: []
  };
}

// ======================== ЗАГРУЗКА ========================
let system = null;

function loadSystem() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      system = JSON.parse(raw);
    } else {
      system = createDefaultSystem();
      saveSystem();
    }

    if (!system.sections || !Array.isArray(system.sections) || system.sections.length === 0) {
      system = createDefaultSystem(); saveSystem();
    }
    if (!system.trainingRecords) system.trainingRecords = [];
    if (!system.placementLog) system.placementLog = [];
    if (!system.auditLog) system.auditLog = [];
    if (!system.theme) system.theme = 'light';
    if (!system.rotationPlans) system.rotationPlans = {};
    if (!system.developmentPlans) system.developmentPlans = {};
    if (!system.departments || !Array.isArray(system.departments) || system.departments.length === 0) {
      system.departments = [...DEFAULT_DEPARTMENTS];
    }
    if (!system.workshops || typeof system.workshops !== 'object') {
      system.workshops = JSON.parse(JSON.stringify(DEFAULT_WORKSHOPS));
    }
    if (!system.norms || typeof system.norms !== 'object') {
      system.norms = { ...DEFAULT_NORMS };
    } else {
      Object.keys(DEFAULT_NORMS).forEach(k => {
        if (typeof system.norms[k] !== 'number') system.norms[k] = DEFAULT_NORMS[k];
      });
    }
    if (typeof system.currentUser !== 'string') system.currentUser = '';
    delete system.logoDataUrl;
    delete system.emblemDataUrl;

    if (!Array.isArray(system.customTables)) system.customTables = [];

    system.sections.forEach(section => {
      (section.posts || []).forEach(post => {
        if (!Array.isArray(post.files)) post.files = [];
      });
      SHIFTS.forEach(sh => {
        const sd = section.shifts?.[sh];
        if (sd && Array.isArray(sd.operators)) {
          sd.operators.forEach(op => {
            if (!Array.isArray(op.tags)) op.tags = [];
            if (typeof op.photo !== 'string') op.photo = '';
            if (!Array.isArray(op.files)) op.files = [];
            if (!op.role) op.role = 'О';
          });
        }
      });
    });

    if (!system.autoApply || typeof system.autoApply !== 'object') {
      system.autoApply = {
        enabled: false, time: '04:00', mode: 'fill_empty',
        shifts: ['A', 'B', 'C'], lastRunDate: ''
      };
    }
    if (typeof system.autoApply.enabled !== 'boolean') system.autoApply.enabled = false;
    if (typeof system.autoApply.time !== 'string' || !/^\d{2}:\d{2}$/.test(system.autoApply.time)) {
      system.autoApply.time = '04:00';
    }
    if (!['fill_empty', 'replace_all', 'merge'].includes(system.autoApply.mode)) {
      system.autoApply.mode = 'fill_empty';
    }
    if (!Array.isArray(system.autoApply.shifts) || system.autoApply.shifts.length === 0) {
      system.autoApply.shifts = ['A', 'B', 'C'];
    }
    if (typeof system.autoApply.lastRunDate !== 'string') system.autoApply.lastRunDate = '';
    if (!Array.isArray(system.autoApplyLog)) system.autoApplyLog = [];

    // Миграции
    migrateQualityBoard(system);
    migrateQualityArchive(system);

    if (!system.departments.includes(system.currentDepartment)) {
      system.currentDepartment = system.departments[0];
    }
    const wsList = system.workshops[system.currentDepartment] || [];
    if (!wsList.includes(system.currentWorkshop)) {
      system.currentWorkshop = wsList[0] || '';
    }
    if (!system.sections.find(s => s.id === system.currentSectionId)) {
      system.currentSectionId = system.sections[0].id;
    }
  } catch (e) {
    console.error('[data.js] loadSystem error:', e);
    system = createDefaultSystem();
  }
  return system;
}

function saveSystem() {
  try {
    if (typeof window.invalidateProxyCache === 'function') {
      window.invalidateProxyCache();
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(system));
    } catch (e) {
      console.warn('[data.js] localStorage write error:', e);
    }

    if (window.storage && window.storage.isStorageConnected()) {
      window.storage.saveSystemUniversal().catch(err => {
        console.error('[data.js] saveSystem (FSA) error:', err);
      });
    }
  } catch (e) {
    console.error('[data.js] saveSystem error:', e);
  }
}

function getSystem() { if (!system) loadSystem(); return system; }

// ======================== НОРМЫ ========================
function getNorms() {
  const sys = getSystem();
  if (!sys.norms) sys.norms = { ...DEFAULT_NORMS };
  return sys.norms;
}
function setNorm(key, value) {
  const sys = getSystem();
  if (!sys.norms) sys.norms = { ...DEFAULT_NORMS };
  sys.norms[key] = value;
  saveSystem();
}

// ======================== АУДИТ ========================
function logAudit(action, target, details) {
  try {
    const sys = getSystem();
    if (!sys.auditLog) sys.auditLog = [];
    const now = new Date();
    sys.auditLog.push({
      id: genId(),
      date: now.toLocaleDateString('ru-RU'),
      time: now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      timestamp: now.getTime(),
      user: sys.currentUser || 'Оператор',
      action: action || '',
      target: target || '',
      details: details || '',
      sectionId: sys.currentSectionId || ''
    });
    if (sys.auditLog.length > AUDIT_MAX_ENTRIES) {
      sys.auditLog = sys.auditLog.slice(-AUDIT_MAX_ENTRIES);
    }
    saveSystem();
  } catch (e) { console.error('[data.js] logAudit error:', e); }
}

// ← ПРАВКА (задача №3): configurable: true — защита от повторного defineProperty
Object.defineProperty(window, 'auditLog', {
  get() { return getSystem().auditLog || []; },
  configurable: true
});

// ======================== ДЕПАРТАМЕНТЫ / ЦЕХА ========================
function getDepartments() {
  const sys = getSystem();
  if (!sys.departments || !Array.isArray(sys.departments) || sys.departments.length === 0) {
    sys.departments = [...DEFAULT_DEPARTMENTS];
  }
  return sys.departments;
}
function getWorkshopsMap() {
  const sys = getSystem();
  if (!sys.workshops || typeof sys.workshops !== 'object') {
    sys.workshops = JSON.parse(JSON.stringify(DEFAULT_WORKSHOPS));
  }
  return sys.workshops;
}
function getWorkshops(dept) {
  const map = getWorkshopsMap();
  return map[dept] || [];
}
function setDepartments(arr) {
  getSystem().departments = arr;
  saveSystem();
}
function setWorkshops(dept, arr) {
  const map = getWorkshopsMap();
  map[dept] = arr;
  getSystem().workshops = map;
  saveSystem();
}

// ======================== ТЕКУЩИЕ ========================
function getCurrentSection() {
  const s = getSystem();
  return s.sections.find(x => x.id === s.currentSectionId) || s.sections[0];
}
function getSectionById(id) { return getSystem().sections.find(s => s.id === id); }

function getCurrentShift() { return getSystem().currentShift || 'A'; }
function getCurrentDate()  { return getSystem().currentDate || formatDate(); }

function getCurrentDepartment() {
  const depts = getDepartments();
  const cur = getSystem().currentDepartment;
  if (!depts.includes(cur)) return depts[0] || '';
  return cur;
}
function getCurrentWorkshop() {
  const dept = getCurrentDepartment();
  const cur = getSystem().currentWorkshop;
  const workshops = getWorkshops(dept);
  if (!workshops.includes(cur)) return workshops[0] || '';
  return cur;
}

function getCurrentShiftData() {
  const section = getCurrentSection();
  const shift = getCurrentShift();
  if (!section.shifts[shift]) {
    section.shifts[shift] = { sectionChief: '', operators: [], days: {} };
  }
  return section.shifts[shift];
}

function getCurrentDay() {
  const section = getCurrentSection();
  const shift = getCurrentShift();
  const date = getCurrentDate();
  if (!section.shifts[shift]) section.shifts[shift] = { sectionChief: '', operators: [], days: {} };
  if (!section.shifts[shift].days) section.shifts[shift].days = {};
  if (!section.shifts[shift].days[date]) {
    const shiftData = section.shifts[shift];
    const postIds = section.posts.map(p => p.id);
    const operatorIds = shiftData.operators.map(o => o.id);
    const templateDay = findTemplateDayForShift(shiftData, date);
    shiftData.days[date] = createEmptyDay(postIds, operatorIds, templateDay);
    saveSystem();
  }
  return section.shifts[shift].days[date];
}

function getCurrentOperators() {
  return getCurrentShiftData().operators || [];
}

function setCurrentSection(id) { getSystem().currentSectionId = id; saveSystem(); }
function setCurrentShift(s)    { getSystem().currentShift = s; saveSystem(); }
function setCurrentDate(d)     { getSystem().currentDate = d; saveSystem(); }

function setCurrentDepartment(d) {
  const sys = getSystem();
  sys.currentDepartment = d;
  const workshops = getWorkshops(d);
  if (!workshops.includes(sys.currentWorkshop)) {
    sys.currentWorkshop = workshops[0] || '';
  }
  const sections = sys.sections.filter(s =>
    s.department === d && s.workshop === sys.currentWorkshop
  );
  if (sections.length > 0) {
    if (!sections.find(s => s.id === sys.currentSectionId)) {
      sys.currentSectionId = sections[0].id;
    }
  }
  saveSystem();
}
function setCurrentWorkshop(w) {
  const sys = getSystem();
  sys.currentWorkshop = w;
  const sections = sys.sections.filter(s =>
    s.department === sys.currentDepartment && s.workshop === w
  );
  if (sections.length > 0) {
    if (!sections.find(s => s.id === sys.currentSectionId)) {
      sys.currentSectionId = sections[0].id;
    }
  }
  saveSystem();
}

function getAvailableDates() {
  const today = formatDate();
  const dates = [];
  for (let i = 0; i < HISTORY_DAYS; i++) dates.push(shiftDate(today, -i));
  return dates;
}

function getSectionsByFilter(department, workshop) {
  return getSystem().sections.filter(s =>
    (!department || s.department === department) &&
    (!workshop   || s.workshop   === workshop)
  );
}

function getWorkshopChief() { return getCurrentSection().workshopChief || ''; }
function setWorkshopChief(name) {
  getCurrentSection().workshopChief = name;
  saveSystem();
}
function getSectionChief() { return getCurrentShiftData().sectionChief || ''; }
function setSectionChief(name) {
  getCurrentShiftData().sectionChief = name;
  saveSystem();
}

// ======================== CRUD УЧАСТКОВ ========================
function addSection(name, department, workshop) {
  if (!name || !name.trim()) return null;
  const section = createSection(name.trim(), department, workshop);
  getSystem().sections.push(section);
  saveSystem();
  logAudit('add_section', name.trim(), `Департамент: ${department}, Цех: ${workshop}`);
  return section;
}
function deleteSection(id) {
  const sys = getSystem();
  if (sys.sections.length <= 1) { alert('Нельзя удалить последний участок'); return false; }
  const section = sys.sections.find(s => s.id === id);
  const sectionName = section ? section.name : id;
  sys.sections = sys.sections.filter(s => s.id !== id);
  if (sys.currentSectionId === id) {
    const remaining = getSectionsByFilter(sys.currentDepartment, sys.currentWorkshop);
    sys.currentSectionId = remaining[0] ? remaining[0].id : sys.sections[0].id;
  }
  saveSystem();
  logAudit('delete_section', sectionName, '');
  return true;
}
function renameSection(id, newName) {
  const s = getSectionById(id);
  if (s && newName && newName.trim()) {
    const oldName = s.name;
    s.name = newName.trim();
    saveSystem();
    logAudit('rename_section', s.name, `Было: ${oldName}`);
  }
}

// ======================== CRUD ПОСТОВ ========================
function addPostToSection(postData) {
  const section = getCurrentSection();
  const newPost = {
    id: genId(), name: postData.name,
    difficulty: postData.difficulty || 'C',
    ergonomics: postData.ergonomics || 'green',
    trainingDays: postData.trainingDays || 5,
    issues: false, defectRisk: false, bodyZone: false,
    files: []
  };
  section.posts.push(newPost);

  SHIFTS.forEach(shift => {
    const shiftData = section.shifts[shift];
    if (!shiftData) return;
    const operatorIds = shiftData.operators.map(o => o.id);
    Object.values(shiftData.days || {}).forEach(day => {
      day.assignments[newPost.id] = null;
      day.levels[newPost.id] = {};
      operatorIds.forEach(oid => { day.levels[newPost.id][oid] = null; });
    });
  });
  saveSystem();
  logAudit('add_post', newPost.name, `${section.name} · сложность ${newPost.difficulty}`);
  return newPost;
}
function updatePost(postId, updates) {
  const post = getCurrentSection().posts.find(p => p.id === postId);
  if (post) {
    Object.assign(post, updates);
    saveSystem();
    logAudit('update_post', post.name, 'Изменены параметры');
  }
}
function deletePostFromSection(postId) {
  const section = getCurrentSection();
  const post = section.posts.find(p => p.id === postId);
  const postName = post ? post.name : postId;
  section.posts = section.posts.filter(p => p.id !== postId);
  SHIFTS.forEach(shift => {
    const shiftData = section.shifts[shift];
    if (!shiftData || !shiftData.days) return;
    Object.values(shiftData.days).forEach(day => {
      delete day.assignments[postId];
      delete day.levels[postId];
    });
  });
  saveSystem();
  logAudit('delete_post', postName, section.name);
}

// ======================== CRUD ОПЕРАТОРОВ ========================
function addOperatorToShift(opData) {
  const section = getCurrentSection();
  const shiftData = getCurrentShiftData();
  const newOp = {
    id: genId(),
    name: opData.name,
    role: opData.role || 'О',
    tags: [],
    photo: '',
    files: []
  };
  shiftData.operators.push(newOp);

  const postIds = section.posts.map(p => p.id);
  Object.values(shiftData.days || {}).forEach(day => {
    day.attendance[newOp.id] = 'Я';
    postIds.forEach(pid => {
      if (!day.levels[pid]) day.levels[pid] = {};
      day.levels[pid][newOp.id] = null;
    });
  });
  saveSystem();
  logAudit('add_operator', newOp.name, `${section.name} · смена ${getCurrentShift()} · роль ${newOp.role}`);
  return newOp;
}
function updateOperator(opId, updates) {
  const shiftData = getCurrentShiftData();
  const op = shiftData.operators.find(o => o.id === opId);
  if (op) {
    Object.assign(op, updates);
    saveSystem();
    logAudit('update_operator', op.name, `Роль: ${op.role}`);
  }
}
function deleteOperatorFromShift(opId) {
  const shiftData = getCurrentShiftData();
  const op = shiftData.operators.find(o => o.id === opId);
  const opName = op ? op.name : opId;
  shiftData.operators = shiftData.operators.filter(o => o.id !== opId);
  Object.values(shiftData.days || {}).forEach(day => {
    delete day.attendance[opId];
    Object.values(day.levels).forEach(lm => { delete lm[opId]; });
    Object.keys(day.assignments).forEach(pid => {
      const cur = normalizeAssignment(day.assignments[pid]);
      if (cur.includes(opId)) setAssignmentList(day.assignments, pid, cur.filter(x => x !== opId));
    });
  });
  saveSystem();
  logAudit('delete_operator', opName, getCurrentSection().name);
}

// ======================== ТЕГИ ========================
function toggleOperatorTag(opId, tagKey) {
  const shiftData = getCurrentShiftData();
  const op = shiftData.operators.find(o => o.id === opId);
  if (!op) return;
  if (!Array.isArray(op.tags)) op.tags = [];
  const idx = op.tags.indexOf(tagKey);
  if (idx >= 0) op.tags.splice(idx, 1);
  else op.tags.push(tagKey);
  saveSystem();
  const tagLabel = AVAILABLE_TAGS.find(t => t.key === tagKey)?.label || tagKey;
  logAudit('update_operator', op.name, idx >= 0 ? `Снят тег: ${tagLabel}` : `Добавлен тег: ${tagLabel}`);
}
function getOperatorTags(opId) {
  const shiftData = getCurrentShiftData();
  const op = shiftData.operators.find(o => o.id === opId);
  if (!op) return [];
  return Array.isArray(op.tags) ? op.tags : [];
}

// ======================== ИМПОРТ / СБРОС ========================
function importSystem(data) {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    if (!parsed.sections) throw new Error('Неверный формат');
    system = parsed;
    if (!system.theme) system.theme = 'light';
    if (!system.rotationPlans) system.rotationPlans = {};
    if (!system.developmentPlans) system.developmentPlans = {};
    if (!system.auditLog) system.auditLog = [];
    if (!system.departments || !Array.isArray(system.departments)) {
      system.departments = [...DEFAULT_DEPARTMENTS];
    }
    if (!system.workshops || typeof system.workshops !== 'object') {
      system.workshops = JSON.parse(JSON.stringify(DEFAULT_WORKSHOPS));
    }
    if (!system.norms) system.norms = { ...DEFAULT_NORMS };
    if (typeof system.currentUser !== 'string') system.currentUser = '';

    if (!system.autoApply || typeof system.autoApply !== 'object') {
      system.autoApply = {
        enabled: false, time: '04:00', mode: 'fill_empty',
        shifts: ['A', 'B', 'C'], lastRunDate: ''
      };
    }
    if (!Array.isArray(system.autoApplyLog)) system.autoApplyLog = [];
    if (!Array.isArray(system.customTables)) system.customTables = [];

    // Миграции
    migrateQualityBoard(system);
    migrateQualityArchive(system);

    delete system.logoDataUrl;
    delete system.emblemDataUrl;

    system.sections.forEach(section => {
      (section.posts || []).forEach(post => {
        if (!Array.isArray(post.files)) post.files = [];
      });
      SHIFTS.forEach(sh => {
        const sd = section.shifts?.[sh];
        if (sd && Array.isArray(sd.operators)) {
          sd.operators.forEach(op => {
            if (!Array.isArray(op.tags)) op.tags = [];
            if (typeof op.photo !== 'string') op.photo = '';
            if (!Array.isArray(op.files)) op.files = [];
            if (!op.role) op.role = 'О';
          });
        }
      });
    });

    saveSystem();
    logAudit('import_system', 'Импорт', 'Загрузка системы');
    return true;
  } catch (e) {
    console.error('[data.js] importSystem error:', e);
    return false;
  }
}
function resetSystem() {
  if (!confirm('Сбросить всю систему?')) return;
  system = createDefaultSystem();
  saveSystem();
  logAudit('reset_system', 'Сброс', 'Полный сброс системы');
}

// ======================== УТИЛИТЫ ========================
function getLastPlacementDate(opName, postName) {
  let lastDate = null;
  const log = getSystem().placementLog || [];
  for (const e of log) {
    if (e.opName === opName && e.postName === postName) {
      const p = e.date.split('.');
      if (p.length !== 3) continue;
      const d = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
      if (isNaN(d.getTime())) continue;
      if (!lastDate || d > lastDate) lastDate = d;
    }
  }
  return lastDate;
}

function getPlacementAgeColor(opName, postName) {
  const lastDate = getLastPlacementDate(opName, postName);
  if (!lastDate) return null;
  const diff = Math.floor((new Date() - lastDate) / 86400000);
  if (diff > 60) return 'red';
  if (diff > 30) return 'yellow';
  return null;
}

function getPostIds()    { return getCurrentSection().posts.map(p => p.id); }
function getOperatorIds(){ return getCurrentOperators().map(o => o.id); }

loadSystem();