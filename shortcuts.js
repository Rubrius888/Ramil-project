// ======================== ГОРЯЧИЕ КЛАВИШИ ========================

let shortcutsHelpOpen = false;

function toggleShortcutsHelp() {
  shortcutsHelpOpen = !shortcutsHelpOpen;
  const el = document.getElementById('shortcutsHelp');
  if (el) el.classList.toggle('open', shortcutsHelpOpen);
}

function closeAllOverlays() {
  document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
  document.querySelectorAll('.inline-select').forEach(el => el.remove());
  if (typeof hideMenu === 'function') hideMenu();
  document.querySelectorAll('.se8-hover-tip').forEach(el => el.remove());

  const notifPanel = document.getElementById('notifPanel');
  if (notifPanel) notifPanel.classList.remove('open');
  if (typeof notifPanelOpen !== 'undefined') notifPanelOpen = false;

  if (shortcutsHelpOpen) toggleShortcutsHelp();

  if (typeof closeGlobalSearch === 'function' &&
      typeof globalSearchOpen !== 'undefined' && globalSearchOpen) {
    closeGlobalSearch();
  }

  if (typeof closeMobileMenu === 'function') closeMobileMenu();
}

function getGroupsList() {
  return ['work', 'study', 'quality', 'analytics', 'system'];
}

function switchToGroup(idx) {
  const groups = getGroupsList();
  if (idx < 0 || idx >= groups.length) return;
  const btn = document.querySelector(`.group-btn[data-group="${groups[idx]}"]`);
  if (btn) btn.click();
}

function switchToSubtab(idx) {
  const activeSubtabs = document.querySelector('.subtabs.active');
  if (!activeSubtabs) return;
  const subtabs = activeSubtabs.querySelectorAll('.subtab');
  if (idx < 0 || idx >= subtabs.length) return;
  subtabs[idx].click();
}

function isEditableElement(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

function isKey(e, code, letter) {
  if (e.code === code) return true;
  if (letter && e.key && e.key.toLowerCase() === letter) return true;
  return false;
}

function initShortcuts() {
  document.addEventListener('keydown', (e) => {
    const target = e.target;
    const inInput = isEditableElement(target);

    // Ctrl+S — сохранить
    if ((e.ctrlKey || e.metaKey) && !e.altKey && isKey(e, 'KeyS', 's')) {
      e.preventDefault();
      if (typeof saveSystem === 'function') {
        saveSystem();
        if (typeof logAudit === 'function') logAudit('save_manual', 'Система', 'Ctrl+S');
      }
      if (typeof showToast === 'function') showToast('💾 Сохранено');
      return;
    }

    // Ctrl+K — глобальный поиск
    if ((e.ctrlKey || e.metaKey) && !e.altKey && isKey(e, 'KeyK', 'k')) {
      e.preventDefault();
      if (typeof toggleGlobalSearch === 'function') toggleGlobalSearch();
      return;
    }

    // Ctrl+1..5 — переключение ГРУПП
    if ((e.ctrlKey || e.metaKey) && !e.altKey && /^[1-5]$/.test(e.key)) {
      e.preventDefault();
      switchToGroup(parseInt(e.key) - 1);
      return;
    }

    // Ctrl+Alt+1..4 — переключение ПОД-ВКЛАДОК
    if ((e.ctrlKey || e.metaKey) && e.altKey && /^[1-4]$/.test(e.key)) {
      e.preventDefault();
      switchToSubtab(parseInt(e.key) - 1);
      return;
    }

    // Esc — закрыть всё
    if (e.key === 'Escape' || e.code === 'Escape') {
      closeAllOverlays();
      return;
    }

    // Далее — только если НЕ в input
    if (inInput) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    // ? — помощь
    if (e.key === '?' || e.code === 'Slash' || (e.shiftKey && e.key === '/')) {
      e.preventDefault();
      toggleShortcutsHelp();
      return;
    }

    // T — тема
    if (isKey(e, 'KeyT', 't')) {
      e.preventDefault();
      if (typeof toggleTheme === 'function') toggleTheme();
      return;
    }

    // N — уведомления
    if (isKey(e, 'KeyN', 'n')) {
      e.preventDefault();
      if (typeof toggleNotifications === 'function') toggleNotifications();
      return;
    }

    // R — обновить
    if (isKey(e, 'KeyR', 'r')) {
      e.preventDefault();
      if (typeof refreshAll === 'function') refreshAll();
      if (typeof showToast === 'function') showToast('🔄 Обновлено');
      return;
    }
  });

  console.log('[shortcuts.js] Горячие клавиши активированы');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initShortcuts);
} else {
  initShortcuts();
}