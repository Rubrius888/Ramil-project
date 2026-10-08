// ======================== УВЕДОМЛЕНИЯ ========================

const NOTIF_STORAGE_KEY = 'ilu_notif_read';

let notificationsCache = [];
let notificationsReadSet = new Set();
let notifPanelOpen = false;
let notifOutsideClickHandler = null;

function loadNotifRead() {
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) notificationsReadSet = new Set(arr);
    }
  } catch (e) {}
}

function saveNotifRead() {
  try {
    const arr = Array.from(notificationsReadSet).slice(-2000);
    localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(arr));
  } catch (e) {}
}

function getNotifId(type, sectionId, extra) {
  return `${type}|${sectionId}|${extra || ''}`;
}

function buildNotifications() {
  const list = [];
  const norms = getNorms();
  const today = new Date();
  const todayStr = formatDate();
  const sys = getSystem();
  const sections = sys.sections || [];
  const shift = getCurrentShift();

  const lastPlacementMap = (typeof buildLastPlacementMap === 'function')
    ? buildLastPlacementMap()
    : new Map();

  sections.forEach(section => {
    const shiftData = section.shifts?.[shift];
    if (!shiftData) return;
    const realOps = (shiftData.operators || []).filter(o => o.role !== 'НУ' && o.role !== 'СО');
    const posts = section.posts || [];
    const day = shiftData.days?.[todayStr];

    if (day) {
      posts.forEach(p => {
        const m = getPostMetrics(p, day, realOps);
        if (!m.hasU && m.assigned.length > 0) {
          list.push({
            id: getNotifId('noU', section.id, p.id),
            level: 'red',
            icon: '🔴',
            text: `Пост «${p.name}» не покрыт U-оператором`,
            sub: `${section.name} · ${section.department} / ${section.workshop} · смена ${shift}`,
            action: { sectionId: section.id, tab: 'se8' }
          });
        }
      });

      let free = 0;
      posts.forEach(p => {
        const m = getPostMetrics(p, day, realOps);
        if (m.isFree) free++;
      });
      if (free > 0) {
        list.push({
          id: getNotifId('freePosts', section.id, shift),
          level: 'red',
          icon: '🔴',
          text: `Свободных постов: ${free} из ${posts.length}`,
          sub: `${section.name} · смена ${shift}`,
          action: { sectionId: section.id, tab: 'se8' }
        });
      }

      let present = 0;
      realOps.forEach(op => {
        if ((day.attendance?.[op.id] || 'Я') === 'Я') present++;
      });
      const pctAtt = realOps.length ? Math.round((present / realOps.length) * 100) : 0;
      if (realOps.length > 0 && pctAtt < norms.attendance) {
        list.push({
          id: getNotifId('lowAtt', section.id, shift),
          level: 'yellow',
          icon: '📉',
          text: `Низкая явка: ${pctAtt}% (норма ≥ ${norms.attendance}%)`,
          sub: `${section.name} · смена ${shift}`,
          action: { sectionId: section.id, tab: 'se8' }
        });
      }

      let posts2L = 0;
      posts.forEach(p => {
        const m = getPostMetrics(p, day, realOps);
        if (m.cntLU >= 2) posts2L++;
      });
      const pct2L = posts.length ? Math.round((posts2L / posts.length) * 100) : 0;
      if (pct2L < norms.poly2L && posts.length > 0) {
        list.push({
          id: getNotifId('low2L', section.id, shift),
          level: 'yellow',
          icon: '📊',
          text: `Поливалентность 2L = ${pct2L}% (норма ≥ ${norms.poly2L}%)`,
          sub: `${section.name} · смена ${shift}`,
          action: { sectionId: section.id, tab: 'stats' }
        });
      }
    }

    if (posts.length > 0 && realOps.length < posts.length * norms.minOpsPerPost) {
      list.push({
        id: getNotifId('fewOps', section.id, shift),
        level: 'yellow',
        icon: '👥',
        text: `Операторов ${realOps.length}, постов ${posts.length} (норма ≥ ${Math.ceil(posts.length * norms.minOpsPerPost)})`,
        sub: `${section.name} · смена ${shift}`,
        action: { sectionId: section.id, tab: 'matrix' }
      });
    }
  });

  (sys.trainingRecords || []).forEach((rec, idx) => {
    if (rec.status === 'Завершено') return;
    const vd = parseRuDate(rec.validDate);
    if (vd && vd < today) {
      const days = Math.floor((today - vd) / 86400000);
      list.push({
        id: getNotifId('overdueTrain', rec.post, `${rec.op}_${idx}`),
        level: 'yellow',
        icon: '⏰',
        text: `Обучение ${rec.op} на пост «${rec.post}» просрочено на ${days} дн.`,
        sub: `Форматор: ${rec.formator}`,
        action: { tab: 'training' }
      });
    }
  });

  sections.forEach(section => {
    const shiftData = section.shifts?.[shift];
    if (!shiftData) return;
    (shiftData.operators || []).forEach(op => {
      if (op.role === 'НУ' || op.role === 'СО') return;
      (section.posts || []).forEach(post => {
        const lastDate = lastPlacementMap.get(`${op.name}|${post.name}`);
        if (lastDate) {
          const diff = Math.floor((today - lastDate) / 86400000);
          if (diff > norms.staleDays) {
            list.push({
              id: getNotifId('staleOp', section.id, `${shift}_${op.id}_${post.id}`),
              level: 'yellow',
              icon: '⚠️',
              text: `${op.name} не стоял на посте «${post.name}» ${diff} дн.`,
              sub: `${section.name} · смена ${shift}`,
              action: { sectionId: section.id, tab: 'se8' }
            });
          }
        }
      });
    });
  });

  return list;
}

function updateNotifications() {
  loadNotifRead();
  notificationsCache = buildNotifications();

  const unread = notificationsCache.filter(n => !notificationsReadSet.has(n.id));
  const countEl = document.getElementById('notifCount');
  const bellEl = document.getElementById('notifBell');

  if (countEl) {
    if (unread.length > 0) {
      countEl.textContent = unread.length > 99 ? '99+' : String(unread.length);
      countEl.style.display = '';
    } else {
      countEl.style.display = 'none';
    }
  }

  if (bellEl) {
    const hasRed = unread.some(n => n.level === 'red');
    const hasYellow = unread.some(n => n.level === 'yellow');
    bellEl.classList.toggle('has-red', hasRed);
    bellEl.classList.toggle('has-yellow', !hasRed && hasYellow);
  }

  if (notifPanelOpen) renderNotificationsPanel();
}

function toggleNotifications() {
  notifPanelOpen = !notifPanelOpen;
  const panel = document.getElementById('notifPanel');
  if (!panel) return;
  panel.classList.toggle('open', notifPanelOpen);
  if (notifPanelOpen) {
    renderNotificationsPanel();
    if (notifOutsideClickHandler) {
      document.removeEventListener('click', notifOutsideClickHandler);
    }
    notifOutsideClickHandler = (e) => {
      if (!notifPanelOpen) return;
      const p = document.getElementById('notifPanel');
      const b = document.getElementById('notifBell');
      if (p && !p.contains(e.target) && b && !b.contains(e.target)) {
        notifPanelOpen = false;
        p.classList.remove('open');
        document.removeEventListener('click', notifOutsideClickHandler);
        notifOutsideClickHandler = null;
      }
    };
    setTimeout(() => document.addEventListener('click', notifOutsideClickHandler), 0);
  } else {
    if (notifOutsideClickHandler) {
      document.removeEventListener('click', notifOutsideClickHandler);
      notifOutsideClickHandler = null;
    }
  }
}

function renderNotificationsPanel() {
  const body = document.getElementById('notifBody');
  if (!body) return;

  if (notificationsCache.length === 0) {
    body.innerHTML = '<div class="notif-empty">✅ Уведомлений нет</div>';
    return;
  }

  const sorted = [...notificationsCache].sort((a, b) => {
    const order = { red: 0, yellow: 1 };
    return order[a.level] - order[b.level];
  });

  const frag = document.createDocumentFragment();
  sorted.forEach(n => {
    const isRead = notificationsReadSet.has(n.id);
    const item = document.createElement('div');
    item.className = `notif-item notif-${n.level} ${isRead ? 'notif-read' : ''}`;
    item.onclick = () => openNotification(n.id);

    const icon = document.createElement('div');
    icon.className = 'notif-item-icon';
    icon.textContent = n.icon;

    const content = document.createElement('div');
    content.className = 'notif-item-content';

    const text = document.createElement('div');
    text.className = 'notif-item-text';
    text.textContent = n.text;

    const sub = document.createElement('div');
    sub.className = 'notif-item-sub';
    sub.textContent = n.sub || '';

    content.appendChild(text);
    content.appendChild(sub);
    item.appendChild(icon);
    item.appendChild(content);
    frag.appendChild(item);
  });

  body.innerHTML = '';
  body.appendChild(frag);
}

function openNotification(notifId) {
  const n = notificationsCache.find(x => x.id === notifId);
  if (!n) return;

  notificationsReadSet.add(notifId);
  saveNotifRead();

  if (n.action) {
    if (n.action.sectionId) {
      setCurrentSection(n.action.sectionId);
    }

    let targetGroup = null;
    let targetSubtab = null;

    if (n.action.tab === 'se8') { targetGroup = 'work'; targetSubtab = 'se8'; }
    else if (n.action.tab === 'matrix') { targetGroup = 'work'; targetSubtab = 'matrix'; }
    else if (n.action.tab === 'stats') { targetGroup = 'analytics'; targetSubtab = 'stats'; }
    else if (n.action.tab === 'training') { targetGroup = 'study'; targetSubtab = 'training'; }

    if (targetGroup && targetSubtab) {
      const groupBtn = document.querySelector(`.group-btn[data-group="${targetGroup}"]`);
      if (groupBtn) groupBtn.click();

      setTimeout(() => {
        const subtabBtn = document.querySelector(`.subtab[data-tab="${targetSubtab}"]`);
        if (subtabBtn) subtabBtn.click();
      }, 50);
    }
  }

  notifPanelOpen = false;
  document.getElementById('notifPanel')?.classList.remove('open');
  if (notifOutsideClickHandler) {
    document.removeEventListener('click', notifOutsideClickHandler);
    notifOutsideClickHandler = null;
  }

  updateNotifications();
}

function markAllNotificationsRead() {
  notificationsCache.forEach(n => notificationsReadSet.add(n.id));
  saveNotifRead();
  updateNotifications();
}

loadNotifRead();