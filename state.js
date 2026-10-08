// ======================== ПРОКСИ-ГЛОБАЛЫ ========================
// ВАЖНО: используется только как read-only слой совместимости.
// Все новые модули должны использовать функции из data.js напрямую.
//
// КЭШИРОВАНИЕ: Proxy создаётся один раз на (sectionId|shift|date).
// Кэш сбрасывается при вызове invalidateProxyCache() (вызывается из saveSystem).
//
// ВАЖНО ПРО ПРЯМЫЕ МУТАЦИИ:
// Если данные меняются через day.levels[pid][oid] = X или day.assignments[pid] = Y
// НАПРЯМУЮ (без saveSystem), кэш может вернуть устаревшее значение.
// Чтобы этого избежать, после таких мутаций вызывайте:
//   window.invalidateProxyCacheIfNeeded?.();
// Или просто вызывайте saveSystem() — она сбросит кэш.
//
// ← ПРАВКА (задача №3): во все Object.defineProperty добавлен configurable: true
//   — защита от TypeError при повторной инициализации (hot-reload, повторный
//   importSystem, повторная вставка <script>).

Object.defineProperty(window, 'posts', {
  get() { return getCurrentSection().posts.map(p => p.name); },
  configurable: true
});
Object.defineProperty(window, 'operators', {
  get() { return getCurrentOperators().map(o => o.name); },
  configurable: true
});
Object.defineProperty(window, 'operatorRoles', {
  get() { return getCurrentOperators().map(o => o.role); },
  configurable: true
});
Object.defineProperty(window, 'difficulty', {
  get() { return getCurrentSection().posts.map(p => p.difficulty); },
  configurable: true
});
Object.defineProperty(window, 'ergonomics', {
  get() { return getCurrentSection().posts.map(p => p.ergonomics); },
  configurable: true
});
Object.defineProperty(window, 'trainingDays', {
  get() { return getCurrentSection().posts.map(p => p.trainingDays); },
  configurable: true
});
Object.defineProperty(window, 'postIssues', {
  get() { return getCurrentSection().posts.map(p => p.issues); },
  configurable: true
});
Object.defineProperty(window, 'postDefectRisk', {
  get() { return getCurrentSection().posts.map(p => p.defectRisk); },
  configurable: true
});
Object.defineProperty(window, 'postBodyZone', {
  get() { return getCurrentSection().posts.map(p => p.bodyZone); },
  configurable: true
});

// ======================== КЭШ PROXY ========================
let _levelsProxyCache = null;
let _levelsProxyCacheKey = '';
let _attendanceProxyCache = null;
let _attendanceProxyCacheKey = '';

function invalidateProxyCache() {
  _levelsProxyCache = null;
  _levelsProxyCacheKey = '';
  _attendanceProxyCache = null;
  _attendanceProxyCacheKey = '';
}

// Экспортируем, чтобы data.js мог вызвать из saveSystem
window.invalidateProxyCache = invalidateProxyCache;

// Удобный хелпер для явного сброса кэша после прямых мутаций
window.invalidateProxyCacheIfNeeded = function() {
  if (typeof invalidateProxyCache === 'function') {
    invalidateProxyCache();
  }
};

// ======================== data[r][c] — прокси-обёртка над уровнями ========================
function makeLevelsProxy() {
  const section = getCurrentSection();
  const shift = getCurrentShift();
  const date = getCurrentDate();
  const cacheKey = `${section.id}|${shift}|${date}`;

  // Возвращаем из кэша, если контекст не менялся
  if (_levelsProxyCache && _levelsProxyCacheKey === cacheKey) {
    return _levelsProxyCache;
  }

  const day = getCurrentDay();
  const postIds = section.posts.map(p => p.id);
  const opIds = getCurrentOperators().map(o => o.id);

  const rowCache = {};

  const proxy = new Proxy([], {
    get(target, prop) {
      if (prop === 'length') return postIds.length;
      const r = parseInt(prop);
      if (isNaN(r)) return target[prop];
      const pid = postIds[r];
      if (!pid) return undefined;

      // Кэшируем Proxy-строку: создаётся один раз на строку
      if (rowCache[r]) return rowCache[r];

      const rowProxy = new Proxy([], {
        get(t, p) {
          if (p === 'length') return opIds.length;
          const c = parseInt(p);
          if (isNaN(c)) return t[p];
          const oid = opIds[c];
          if (!oid) return undefined;
          return (day.levels[pid] && day.levels[pid][oid]) || null;
        },
        set(t, p, v) {
          const c = parseInt(p);
          if (isNaN(c)) { t[p] = v; return true; }
          const oid = opIds[c];
          if (!oid) return false;
          if (!day.levels[pid]) day.levels[pid] = {};
          day.levels[pid][oid] = v;
          saveSystem();
          return true;
        }
      });

      rowCache[r] = rowProxy;
      return rowProxy;
    },
    set(target, prop, value) {
      const r = parseInt(prop);
      if (isNaN(r)) { target[prop] = value; return true; }
      const pid = postIds[r];
      if (!pid || !Array.isArray(value)) return false;
      opIds.forEach((oid, c) => {
        if (!day.levels[pid]) day.levels[pid] = {};
        day.levels[pid][oid] = value[c] || null;
      });
      saveSystem();
      return true;
    }
  });

  _levelsProxyCache = proxy;
  _levelsProxyCacheKey = cacheKey;
  return proxy;
}

Object.defineProperty(window, 'data', {
  get() { return makeLevelsProxy(); },
  configurable: true
});

// ======================== attendanceData[r][c] — прокси над назначениями ========================
function makeAttendanceProxy() {
  const section = getCurrentSection();
  const shift = getCurrentShift();
  const date = getCurrentDate();
  const cacheKey = `${section.id}|${shift}|${date}`;

  if (_attendanceProxyCache && _attendanceProxyCacheKey === cacheKey) {
    return _attendanceProxyCache;
  }

  const day = getCurrentDay();
  const postIds = section.posts.map(p => p.id);
  const opIds = getCurrentOperators().map(o => o.id);

  function getStatusFor(pid, oid) {
    const cur = normalizeAssignment(day.assignments[pid]);
    if (!cur.includes(oid)) return '';
    const lvl = day.levels[pid] && day.levels[pid][oid];
    return lvl === 'Iкр' ? '△' : '○';
  }
  function setStatusFor(pid, oid, v) {
    const cur = normalizeAssignment(day.assignments[pid]);
    if (v === '○' || v === '△') {
      if (!cur.includes(oid)) cur.push(oid);
      setAssignmentList(day.assignments, pid, cur);
    } else {
      setAssignmentList(day.assignments, pid, cur.filter(x => x !== oid));
    }
  }

  const rowCache = {};

  const proxy = new Proxy([], {
    get(target, prop) {
      if (prop === 'length') return postIds.length;
      const r = parseInt(prop);
      if (isNaN(r)) return target[prop];
      const pid = postIds[r];
      if (!pid) return undefined;

      if (rowCache[r]) return rowCache[r];

      const rowProxy = new Proxy([], {
        get(t, p) {
          if (p === 'length') return opIds.length;
          const c = parseInt(p);
          if (isNaN(c)) return t[p];
          const oid = opIds[c];
          if (!oid) return undefined;
          return getStatusFor(pid, oid);
        },
        set(t, p, v) {
          const c = parseInt(p);
          if (isNaN(c)) { t[p] = v; return true; }
          const oid = opIds[c];
          if (!oid) return false;
          setStatusFor(pid, oid, v);
          saveSystem();
          return true;
        }
      });

      rowCache[r] = rowProxy;
      return rowProxy;
    },
    set(target, prop, value) {
      const r = parseInt(prop);
      if (isNaN(r)) { target[prop] = value; return true; }
      const pid = postIds[r];
      if (!pid || !Array.isArray(value)) return false;
      const list = [];
      value.forEach((v, i) => {
        if ((v === '○' || v === '△') && opIds[i]) list.push(opIds[i]);
      });
      setAssignmentList(day.assignments, pid, list);
      saveSystem();
      return true;
    }
  });

  _attendanceProxyCache = proxy;
  _attendanceProxyCacheKey = cacheKey;
  return proxy;
}

Object.defineProperty(window, 'attendanceData', {
  get() { return makeAttendanceProxy(); },
  configurable: true
});

// ======================== Хелперы для SE-8 ========================
function getPostStatus(postIdx, opIdx) {
  const section = getCurrentSection();
  const day = getCurrentDay();
  const post = section.posts[postIdx];
  const op = getCurrentOperators()[opIdx];
  if (!post || !op) return '';
  const cur = normalizeAssignment(day.assignments[post.id]);
  if (!cur.includes(op.id)) return '';
  const lvl = day.levels[post.id] && day.levels[post.id][op.id];
  return lvl === 'Iкр' ? '△' : '○';
}

function getPostLevel(postIdx, opIdx) {
  const section = getCurrentSection();
  const day = getCurrentDay();
  const post = section.posts[postIdx];
  const op = getCurrentOperators()[opIdx];
  if (!post || !op) return null;
  return (day.levels[post.id] && day.levels[post.id][op.id]) || null;
}

Object.defineProperty(window, 'operatorAttendance', {
  get() {
    const day = getCurrentDay();
    return getCurrentOperators().map(o => day.attendance[o.id] || 'Я');
  },
  configurable: true
});

Object.defineProperty(window, 'trainingRecords', {
  get() { return getSystem().trainingRecords || []; },
  set(v) { getSystem().trainingRecords = v; saveSystem(); },
  configurable: true
});
Object.defineProperty(window, 'placementLog', {
  get() { return getSystem().placementLog || []; },
  set(v) { getSystem().placementLog = v; saveSystem(); },
  configurable: true
});