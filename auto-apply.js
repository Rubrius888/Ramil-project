// ======================== АВТО-ПРИМЕНЕНИЕ ПЛАНА (04:00) ========================

const AUTO_APPLY_CHECK_INTERVAL_MS = 30000;
let autoApplyTimer = null;

function getAutoApplySettings() {
  const sys = getSystem();
  if (!sys.autoApply) {
    sys.autoApply = {
      enabled: false,
      time: '04:00',
      mode: 'fill_empty',
      shifts: ['A', 'B', 'C'],
      lastRunDate: ''
    };
  }
  return sys.autoApply;
}

function saveAutoApplySettings() {
  saveSystem();
}

function getCurrentHHMM() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function shouldAutoApplyNow() {
  const cfg = getAutoApplySettings();
  if (!cfg.enabled) return false;

  const today = formatDate();
  if (cfg.lastRunDate === today) return false;

  const now = getCurrentHHMM();
  if (now < cfg.time) return false;

  const [cfgH, cfgM] = cfg.time.split(':').map(Number);
  const cfgMinutes = cfgH * 60 + cfgM;
  const nowDate = new Date();
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const diff = nowMinutes - cfgMinutes;
  if (diff > 180) return false;

  return true;
}

// ======================== ВРЕМЕННАЯ ПОДМЕНА ПЛАНА РОТАЦИИ ========================
// ← ПРАВКА (задача №15): удалён мёртвый fallback через window.rotationPlan,
// т.к. applyRotationToDay читает локальную let rotationPlan в rotation.js,
// а не window.rotationPlan. Если setTemporaryRotationPlan недоступна —
// значит rotation.js не загружен, и работать с планом всё равно нельзя.
function withTemporaryRotationPlan(plan, fn) {
  if (typeof window.setTemporaryRotationPlan !== 'function') {
    console.error('[auto-apply] setTemporaryRotationPlan недоступна — rotation.js не загружен');
    return fn();
  }
  const restore = window.setTemporaryRotationPlan(plan);
  try { return fn(); }
  finally { if (typeof restore === 'function') restore(); }
}

function runAutoApply(reason) {
  // ======================== ЗАЩИТА ОТ ОТСУТСТВИЯ ЗАВИСИМОСТЕЙ ========================
  if (typeof applyRotationToDay !== 'function') {
    console.error('[auto-apply] applyRotationToDay недоступна — модуль rotation.js не загружен');
    if (typeof showToast === 'function') showToast('⚠️ Модуль ротации не загружен');
    return;
  }

  const cfg = getAutoApplySettings();
  const today = formatDate();
  const now = getCurrentHHMM();

  const logEntry = {
    date: today,
    time: now,
    timestamp: Date.now(),
    reason: reason || 'timer',
    results: [],
    totalApplied: 0,
    totalSkipped: 0
  };

  // ======================== ПОЛУЧАЕМ ПЛАН НАПРЯМУЮ ИЗ СИСТЕМЫ ========================
  const planKey = (typeof getRotationPlanKey === 'function')
    ? getRotationPlanKey()
    : `${getCurrentSection().id}_${new Date().getFullYear()}_${new Date().getMonth()}`;

  const sys = getSystem();
  const plan = (sys.rotationPlans && sys.rotationPlans[planKey])
    ? JSON.parse(JSON.stringify(sys.rotationPlans[planKey]))
    : {};

  if (!plan || Object.keys(plan).length === 0) {
    logEntry.results.push({ shift: '—', status: 'no_plan', message: 'План ротации отсутствует' });
    finishAutoApply(logEntry, cfg);
    return;
  }

  const nowDate = new Date();
  const todayIdx = nowDate.getDate() - 1;

  // ← ПРАВКА (задача №7): защита от повреждённых данных плана на день
  const todayPlan = plan[todayIdx];
  if (todayPlan === undefined || todayPlan === null) {
    logEntry.results.push({ shift: '—', status: 'no_day', message: 'На сегодня в плане нет данных (возможно, выходной)' });
    finishAutoApply(logEntry, cfg);
    return;
  }
  if (typeof todayPlan !== 'object' || Array.isArray(todayPlan)) {
    logEntry.results.push({ shift: '—', status: 'invalid', message: 'Повреждённые данные плана на день' });
    finishAutoApply(logEntry, cfg);
    return;
  }

  const shiftsToApply = Array.isArray(cfg.shifts) && cfg.shifts.length > 0
    ? cfg.shifts
    : ['A', 'B', 'C'];

  // ======================== ПРИМЕНЯЕМ ПЛАН ВНУТРИ ВРЕМЕННОЙ ПОДМЕНЫ ========================
  withTemporaryRotationPlan(plan, () => {
    shiftsToApply.forEach(shift => {
      let res;
      try {
        res = applyRotationToDay(todayIdx, shift, cfg.mode || 'fill_empty');
      } catch (e) {
        console.error('[auto-apply] applyRotationToDay error:', e);
        res = { applied: 0, skipped: 0 };
      }
      logEntry.results.push({
        shift,
        applied: res.applied,
        skipped: res.skipped,
        status: res.applied > 0 ? 'ok' : 'empty'
      });
      logEntry.totalApplied += res.applied;
      logEntry.totalSkipped += res.skipped;
    });
  });

  finishAutoApply(logEntry, cfg);
}

function finishAutoApply(logEntry, cfg) {
  const sys = getSystem();
  if (!sys.autoApplyLog) sys.autoApplyLog = [];
  sys.autoApplyLog.push(logEntry);
  if (sys.autoApplyLog.length > 200) {
    sys.autoApplyLog = sys.autoApplyLog.slice(-200);
  }
  cfg.lastRunDate = logEntry.date;
  saveSystem();

  if (typeof logAudit === 'function') {
    logAudit('auto_apply', 'Авто-применение',
      `Смен: ${logEntry.results.length}, применено: ${logEntry.totalApplied}`);
  }

  if (typeof renderMatrix === 'function') renderMatrix();
  if (typeof renderSE8Blank === 'function') renderSE8Blank();
  if (typeof refreshAll === 'function') refreshAll();

  if (typeof renderAutoApplyPanel === 'function') renderAutoApplyPanel();

  if ('Notification' in window && Notification.permission === 'granted' && logEntry.totalApplied > 0) {
    try {
      new Notification('ILU SE — Авто-расстановка', {
        body: `Применено: ${logEntry.totalApplied} операторов`,
        icon: ''
      });
    } catch (e) {}
  }

  if (typeof showToast === 'function') {
    showToast(`✅ Авто-расстановка: ${logEntry.totalApplied} назначено`);
  }
}

function startAutoApplyTimer() {
  if (autoApplyTimer) clearInterval(autoApplyTimer);

  setTimeout(() => {
    if (shouldAutoApplyNow()) {
      runAutoApply('startup');
    }
  }, 2000);

  autoApplyTimer = setInterval(() => {
    if (shouldAutoApplyNow()) {
      runAutoApply('timer');
    }
  }, AUTO_APPLY_CHECK_INTERVAL_MS);
}

function getNextAutoApplyText() {
  const cfg = getAutoApplySettings();
  if (!cfg.enabled) return 'Выключено';

  const today = formatDate();
  if (cfg.lastRunDate === today) {
    return `Завтра в ${cfg.time}`;
  }

  const now = getCurrentHHMM();
  if (now < cfg.time) {
    return `Сегодня в ${cfg.time}`;
  }

  return `Сегодня в ${cfg.time} (ожидание)`;
}

// ======================== РЕНДЕР ПАНЕЛИ ========================
function renderAutoApplyPanel() {
  const cfg = getAutoApplySettings();
  const sys = getSystem();

  const panel = document.getElementById('autoApplyPanel');
  if (!panel) return;

  const enabledEl = document.getElementById('autoApplyEnabled');
  const timeEl = document.getElementById('autoApplyTime');
  const modeEl = document.getElementById('autoApplyMode');
  const shiftA = document.getElementById('autoApplyShiftA');
  const shiftB = document.getElementById('autoApplyShiftB');
  const shiftC = document.getElementById('autoApplyShiftC');
  const nextEl = document.getElementById('autoApplyNext');
  const lastEl = document.getElementById('autoApplyLast');
  const logList = document.getElementById('autoApplyLogList');

  if (enabledEl) enabledEl.checked = !!cfg.enabled;
  if (timeEl) timeEl.value = cfg.time;
  if (modeEl) modeEl.value = cfg.mode;
  if (shiftA) shiftA.checked = cfg.shifts.includes('A');
  if (shiftB) shiftB.checked = cfg.shifts.includes('B');
  if (shiftC) shiftC.checked = cfg.shifts.includes('C');
  if (nextEl) nextEl.textContent = getNextAutoApplyText();
  if (lastEl) lastEl.textContent = cfg.lastRunDate || '—';

  if (logList) {
    const logs = (sys.autoApplyLog || []).slice(-10).reverse();
    if (logs.length === 0) {
      logList.innerHTML = '<div class="auto-apply-log-empty">Записей нет</div>';
    } else {
      logList.innerHTML = logs.map(l => `
        <div class="auto-apply-log-row">
          <div class="auto-apply-log-date">${escapeHtml(l.date)} ${escapeHtml(l.time)}</div>
          <div class="auto-apply-log-info">
            Применено: <b>${l.totalApplied}</b> · Пропущено: ${l.totalSkipped}
            ${l.results && l.results.length > 0
              ? ' · ' + l.results.map(r => `${escapeHtml(r.shift)}:${r.applied || 0}`).join(', ')
              : ''}
          </div>
          <div class="auto-apply-log-reason">${escapeHtml(l.reason || '')}</div>
        </div>
      `).join('');
    }
  }
}

function onAutoApplyToggle(checked) {
  const cfg = getAutoApplySettings();
  cfg.enabled = !!checked;
  saveSystem();
  logAudit('auto_apply_setting', 'Авто-применение', checked ? 'Включено' : 'Выключено');
  renderAutoApplyPanel();
  if (typeof showToast === 'function') {
    showToast(checked ? '✅ Авто-применение включено' : '⏸ Авто-применение выключено');
  }
}

function onAutoApplyTimeChange(value) {
  if (!/^\d{2}:\d{2}$/.test(value)) return;
  const cfg = getAutoApplySettings();
  cfg.time = value;
  saveSystem();
  logAudit('auto_apply_setting', 'Время', value);
  renderAutoApplyPanel();
}

function onAutoApplyModeChange(value) {
  const cfg = getAutoApplySettings();
  if (!['fill_empty', 'replace_all', 'merge'].includes(value)) return;
  cfg.mode = value;
  saveSystem();
  logAudit('auto_apply_setting', 'Режим', value);
  renderAutoApplyPanel();
}

function onAutoApplyShiftToggle(shift, checked) {
  const cfg = getAutoApplySettings();
  if (!Array.isArray(cfg.shifts)) cfg.shifts = [];
  if (checked && !cfg.shifts.includes(shift)) cfg.shifts.push(shift);
  if (!checked) cfg.shifts = cfg.shifts.filter(s => s !== shift);
  if (cfg.shifts.length === 0) cfg.shifts = ['A'];
  cfg.shifts.sort();
  saveSystem();
  logAudit('auto_apply_setting', 'Смены', cfg.shifts.join(','));
  renderAutoApplyPanel();
}

function clearAutoApplyLog() {
  if (!confirm('Очистить лог авто-применения?')) return;
  const sys = getSystem();
  sys.autoApplyLog = [];
  saveSystem();
  renderAutoApplyPanel();
}

function requestNotificationPermission() {
  if (!('Notification' in window)) {
    alert('Ваш браузер не поддерживает уведомления');
    return;
  }
  Notification.requestPermission().then(perm => {
    if (typeof showToast === 'function') {
      showToast(perm === 'granted' ? '🔔 Уведомления разрешены' : '⚠️ Уведомления запрещены');
    }
  });
}

// ======================== ИНИЦИАЛИЗАЦИЯ ========================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    startAutoApplyTimer();
    renderAutoApplyPanel();
  });
} else {
  startAutoApplyTimer();
  renderAutoApplyPanel();
}