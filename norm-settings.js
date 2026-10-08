// ======================== НАСТРОЙКА НОРМ ========================

const NORM_LABELS = {
  coverageU: 'Покрытие U, %',
  poly2L: 'Поливалентность 2L, %',
  poly3L: 'Поливалентность 3L, %',
  attendance: 'Явка, %',
  minOpsPerPost: 'Мин. операторов на пост',
  staleDays: 'Давно не стоял (дней)'
};

function renderNormSettings() {
  const cont = document.getElementById('normSettingsPanel');
  if (!cont) return;
  const norms = getNorms();
  let html = '';
  Object.keys(NORM_LABELS).forEach(key => {
    html += `
      <div class="filter-row">
        <label>${NORM_LABELS[key]}</label>
        <input type="number"
               id="norm_${key}"
               value="${norms[key]}"
               min="0"
               step="${key === 'minOpsPerPost' ? '0.1' : '1'}"
               onchange="onNormChange('${key}', this.value)"
               style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg);color:var(--text);">
      </div>
    `;
  });
  html += `
    <div class="filter-actions" style="margin-left:140px;margin-top:8px;">
      <button class="btn-small" onclick="resetNormSettings()">↺ Сбросить нормы</button>
    </div>
  `;
  cont.innerHTML = html;
}

function onNormChange(key, value) {
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) return;
  setNorm(key, num);
  logAudit('update_norm', NORM_LABELS[key] || key, `Новое значение: ${num}`);
  // Пересчитываем дашборд и уведомления
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof updateNotifications === 'function') updateNotifications();
}

function resetNormSettings() {
  if (!confirm('Сбросить нормы к значениям по умолчанию?')) return;
  const sys = getSystem();
  sys.norms = { ...DEFAULT_NORMS };
  saveSystem();
  logAudit('update_norm', 'Нормы', 'Сброс к значениям по умолчанию');
  renderNormSettings();
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof updateNotifications === 'function') updateNotifications();
}