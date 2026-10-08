// ======================== ГРУППЫ ========================

let currentGroup = 'work';
let currentSubtabByGroup = {
  work: 'matrix',
  study: 'training',
  quality: 'qualityBoardTab',
  analytics: 'stats',
  system: 'audit',
};

function openGroup(evt, groupId) {
  document.querySelectorAll('.group-btn').forEach(btn => btn.classList.remove('active'));
  if (evt && evt.currentTarget) {
    evt.currentTarget.classList.add('active');
  } else {
    const btn = document.querySelector(`.group-btn[data-group="${groupId}"]`);
    if (btn) btn.classList.add('active');
  }

  document.querySelectorAll('.subtabs').forEach(st => {
    st.classList.toggle('active', st.getAttribute('data-group') === groupId);
  });

  currentGroup = groupId;

  const subtabToOpen = currentSubtabByGroup[groupId];
  if (subtabToOpen) {
    const subtabBtn = document.querySelector(`.subtab[data-tab="${subtabToOpen}"]`);
    if (subtabBtn) subtabBtn.click();
  } else {
    const firstSubtab = document.querySelector(`.subtabs[data-group="${groupId}"] .subtab`);
    if (firstSubtab) firstSubtab.click();
  }

  closeMobileMenu();
}

// ======================== ТОЧКА ВХОДА ========================
function openTab(evt, id) {
    document.querySelectorAll('.subtab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    if (evt && evt.currentTarget) evt.currentTarget.classList.add('active');

    const target = document.getElementById(id);
    if (target) target.classList.add('active');

    if (currentGroup) {
        currentSubtabByGroup[currentGroup] = id;
    }

    if (id === 'se8' && typeof renderSE8Blank === 'function') renderSE8Blank();
    if (id === 'placementLog') {
        if (typeof fillPlacementFilters === 'function') fillPlacementFilters();
        if (typeof renderPlacementLog === 'function') renderPlacementLog();
    }
    if (id === 'training') {
        if (typeof renderTrainingCalendar === 'function') renderTrainingCalendar();
        if (typeof renderTrainingTable === 'function') renderTrainingTable();
        if (typeof renderTrainingStats === 'function') renderTrainingStats();
    }
    if (id === 'stats' && typeof renderStats === 'function') renderStats();
    if (id === 'rotation' && typeof restoreRotationPlan === 'function') restoreRotationPlan();
    if (id === 'planning' && typeof restoreDevelopmentPlan === 'function') restoreDevelopmentPlan();
    if (id === 'shiftCalendar' && typeof renderShiftCalendar === 'function') renderShiftCalendar();
    if (id === 'compare') {
        if (typeof initCompareSelectors === 'function') initCompareSelectors();
        if (typeof renderCompare === 'function') renderCompare();
    }
    if (id === 'crossSection' && typeof renderCrossSection === 'function') renderCrossSection();
    if (id === 'audit' && typeof renderAudit === 'function') renderAudit();
    if (id === 'excelTables' && typeof renderExcelTables === 'function') renderExcelTables();

    // Качество
    if (id === 'qualityBoardTab' && typeof renderQualityBoard === 'function') renderQualityBoard();
    if (id === 'qualityProblemPostsTab' && typeof renderQualityProblemPosts === 'function') renderQualityProblemPosts();
    if (id === 'qualityRisksTab' && typeof renderQualityRisks === 'function') renderQualityRisks();
    if (id === 'qualityDynamicsTab' && typeof renderQualityDynamics === 'function') renderQualityDynamics();
    if (id === 'qualityArchiveTab' && typeof renderQualityArchive === 'function') renderQualityArchive();

    if (id === 'settings') {
        if (typeof renderNormSettings === 'function') renderNormSettings();
        if (typeof renderAutoApplyPanel === 'function') renderAutoApplyPanel();
        if (typeof renderStoragePanel === 'function') renderStoragePanel();
        if (typeof renderSyncPanel === 'function') renderSyncPanel();
    }

    if (typeof updateNotifications === 'function') updateNotifications();
    closeMobileMenu();
}

// ======================== МОБИЛЬНОЕ МЕНЮ ========================
function toggleMobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    const overlay = document.getElementById('mobileMenuOverlay');
    const groups = document.getElementById('mainGroups');
    if (!btn || !overlay || !groups) return;

    const isOpen = groups.classList.toggle('mobile-open');
    overlay.classList.toggle('open', isOpen);
    btn.textContent = isOpen ? '✕' : '☰';
}

function closeMobileMenu() {
    const groups = document.getElementById('mainGroups');
    const overlay = document.getElementById('mobileMenuOverlay');
    const btn = document.getElementById('mobileMenuBtn');
    if (groups) groups.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('open');
    if (btn) btn.textContent = '☰';
}

// ======================== ТЕМА ========================
function toggleTheme() {
    const isDark = document.body.classList.toggle('dark');
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = isDark ? '☀️' : '🌙';

    const sys = getSystem();
    sys.theme = isDark ? 'dark' : 'light';
    saveSystem();
    logAudit('save_theme', isDark ? 'Тёмная' : 'Светлая', 'Переключение темы');
}

function applyTheme() {
    const sys = getSystem();
    if (sys.theme === 'dark') {
        document.body.classList.add('dark');
        const btn = document.getElementById('themeToggle');
        if (btn) btn.textContent = '☀️';
    }
}

// ======================== ПЕЧАТЬ ========================
function printMatrix() {
    document.body.classList.add('print-matrix');
    window.print();
    setTimeout(() => document.body.classList.remove('print-matrix'), 500);
}

// ======================== СЕЛЕКТОРЫ ========================
function renderDepartmentSelector() {
    const sel = document.getElementById('filterDepartment');
    if (!sel) return;

    const depts = getDepartments();
    sel.innerHTML = depts.map(d =>
        `<option value="${escapeHtml(d)}" ${d === getCurrentDepartment() ? 'selected' : ''}>${escapeHtml(d)}</option>`
    ).join('');
}

function renderWorkshopSelector() {
    const sel = document.getElementById('filterWorkshop');
    if (!sel) return;

    const dept = getCurrentDepartment();
    const workshops = getWorkshops(dept);

    if (workshops.length === 0) {
        sel.innerHTML = '<option>— Нет цехов —</option>';
        return;
    }

    sel.innerHTML = workshops.map(w =>
        `<option value="${escapeHtml(w)}" ${w === getCurrentWorkshop() ? 'selected' : ''}>${escapeHtml(w)}</option>`
    ).join('');
}

function renderSectionSelector() {
    const sel = document.getElementById('sectionSelect');
    if (!sel) return;

    const sections = getSectionsByFilter(getCurrentDepartment(), getCurrentWorkshop());

    if (sections.length === 0) {
        sel.innerHTML = '<option value="">— Нет участков —</option>';
        return;
    }

    sel.innerHTML = sections.map(s =>
        `<option value="${escapeHtml(s.id)}" ${s.id === getSystem().currentSectionId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
    ).join('');
}

function renderShiftSelector() {
    const sel = document.getElementById('shiftSelect');
    if (!sel) return;
    sel.value = getCurrentShift();
}

function renderDateSelector() {
    const sel = document.getElementById('dateSelect');
    if (!sel) return;

    const dates = getAvailableDates().slice(0, 10);
    sel.innerHTML = dates.map(d =>
        `<option value="${escapeHtml(d)}" ${d === getCurrentDate() ? 'selected' : ''}>${escapeHtml(d)}${d === formatDate() ? ' (сегодня)' : ''}</option>`
    ).join('');
}

function saveAllChanges() {
    saveSystem();
    updateInfoCard();
    logAudit('save_manual', 'Система', 'Кнопка «Сохранить»');
    if (typeof showToast === 'function') showToast('💾 Изменения сохранены');
}

function onDepartmentChange(d) { setCurrentDepartment(d); logAudit('change_filter', 'Департамент', d); refreshAll(); }
function onWorkshopChange(w)   { setCurrentWorkshop(w); logAudit('change_filter', 'Цех', w); refreshAll(); }
function onSectionChange(id)   { setCurrentSection(id); refreshAll(); }
function onShiftChange(s)      { setCurrentShift(s); refreshAll(); }
function onDateChange(d)       { setCurrentDate(d); refreshAll(); }

function resetFilters() {
    const depts = getDepartments();
    if (depts.length === 0) return;

    setCurrentDepartment(depts[0]);
    const firstWorkshops = getWorkshops(depts[0]);
    setCurrentWorkshop(firstWorkshops[0] || '');

    const sections = getSectionsByFilter(depts[0], firstWorkshops[0] || '');
    if (sections.length > 0) setCurrentSection(sections[0].id);

    setCurrentShift('A');
    setCurrentDate(formatDate());
    saveSystem();
    refreshAll();
}

function hardResetSystem() {
    if (!confirm('Сбросить ВСЮ систему? Все данные будут удалены.')) return;
    if (!confirm('Точно уверены? Это действие необратимо.')) return;

    logAudit('reset_system', 'Система', 'Полный сброс');
    resetSystem();
    location.reload();
}

function refreshAll() {
    renderDepartmentSelector();
    renderWorkshopSelector();
    renderSectionSelector();
    renderShiftSelector();
    renderDateSelector();

    if (typeof renderMatrix === 'function') renderMatrix();
    if (typeof renderPlacementLog === 'function') renderPlacementLog();
    if (typeof renderTrainingCalendar === 'function') renderTrainingCalendar();
    if (typeof renderTrainingTable === 'function') renderTrainingTable();
    if (typeof renderTrainingStats === 'function') renderTrainingStats();
    if (typeof renderStats === 'function') renderStats();

    if (document.getElementById('se8')?.classList.contains('active')) {
        if (typeof renderSE8Blank === 'function') renderSE8Blank();
    }
    if (document.getElementById('rotation')?.classList.contains('active')) {
        if (typeof restoreRotationPlan === 'function') restoreRotationPlan();
    }
    if (document.getElementById('planning')?.classList.contains('active')) {
        if (typeof restoreDevelopmentPlan === 'function') restoreDevelopmentPlan();
    }
    if (document.getElementById('shiftCalendar')?.classList.contains('active')) {
        if (typeof renderShiftCalendar === 'function') renderShiftCalendar();
    }
    if (document.getElementById('compare')?.classList.contains('active')) {
        if (typeof renderCompare === 'function') renderCompare();
    }
    if (document.getElementById('crossSection')?.classList.contains('active')) {
        if (typeof renderCrossSection === 'function') renderCrossSection();
    }
    if (document.getElementById('audit')?.classList.contains('active')) {
        if (typeof renderAudit === 'function') renderAudit();
    }

    // Качество
    if (document.getElementById('qualityBoardTab')?.classList.contains('active')) {
        if (typeof renderQualityBoard === 'function') renderQualityBoard();
    }
    if (document.getElementById('qualityProblemPostsTab')?.classList.contains('active')) {
        if (typeof renderQualityProblemPosts === 'function') renderQualityProblemPosts();
    }
    if (document.getElementById('qualityRisksTab')?.classList.contains('active')) {
        if (typeof renderQualityRisks === 'function') renderQualityRisks();
    }
    if (document.getElementById('qualityDynamicsTab')?.classList.contains('active')) {
        if (typeof renderQualityDynamics === 'function') renderQualityDynamics();
    }
    if (document.getElementById('qualityArchiveTab')?.classList.contains('active')) {
        if (typeof renderQualityArchive === 'function') renderQualityArchive();
    }

    if (document.getElementById('settings')?.classList.contains('active')) {
        if (typeof renderNormSettings === 'function') renderNormSettings();
        if (typeof renderAutoApplyPanel === 'function') renderAutoApplyPanel();
        if (typeof renderStoragePanel === 'function') renderStoragePanel();
        if (typeof renderSyncPanel === 'function') renderSyncPanel();
    }

    updateInfoCard();
    updateDateBar();
    if (typeof fillPlacementFilters === 'function') fillPlacementFilters();
    if (typeof updateNotifications === 'function') updateNotifications();
}

// ======================== CRUD УЧАСТКОВ ========================
function openAddSectionDialog() {
    showModal('Новый участок', [{ name: 'name', label: 'Название', value: 'SE-' }], (v, overlay) => {
        if (!v.name || !v.name.trim()) return;
        const s = addSection(v.name.trim(), getCurrentDepartment(), getCurrentWorkshop());
        if (s) { setCurrentSection(s.id); overlay.remove(); refreshAll(); }
    });
}

function openRenameSectionDialog() {
    const s = getCurrentSection();
    if (!s) return;
    showModal('Переименовать участок', [{ name: 'name', label: 'Название', value: s.name }], (v, overlay) => {
        if (!v.name || !v.name.trim()) return;
        renameSection(s.id, v.name.trim());
        overlay.remove(); refreshAll();
    });
}

function openDeleteSectionDialog() {
    const s = getCurrentSection();
    if (!s) return;
    if (!confirm(`Удалить участок «${s.name}»?`)) return;
    deleteSection(s.id);
    refreshAll();
}

// ======================== CRUD ДЕПАРТАМЕНТОВ ========================
function openAddDepartmentDialog() {
    showModal('Новый департамент', [{ name: 'name', label: 'Название', value: '' }], (v, overlay) => {
        if (!v.name || !v.name.trim()) return;
        const name = v.name.trim();
        const depts = getDepartments();
        if (depts.includes(name)) { alert('Такой департамент уже есть'); return; }

        depts.push(name);
        setDepartments(depts);

        const map = getWorkshopsMap();
        map[name] = [];
        getSystem().workshops = map;

        saveSystem();
        logAudit('add_department', name, '');
        overlay.remove();
        refreshAll();
    });
}

function openRenameDepartmentDialog() {
    const cur = getCurrentDepartment();
    showModal('Переименовать департамент', [{ name: 'name', label: 'Название', value: cur }], (v, overlay) => {
        if (!v.name || !v.name.trim()) return;
        const newName = v.name.trim();
        if (newName === cur) { overlay.remove(); return; }

        const depts = getDepartments();
        const idx = depts.indexOf(cur);
        if (idx < 0) return;

        depts[idx] = newName;
        setDepartments(depts);

        const map = getWorkshopsMap();
        map[newName] = map[cur] || [];
        delete map[cur];
        getSystem().workshops = map;

        getSystem().sections.forEach(s => { if (s.department === cur) s.department = newName; });
        if (getSystem().currentDepartment === cur) getSystem().currentDepartment = newName;

        saveSystem();
        logAudit('rename_department', newName, `Было: ${cur}`);
        overlay.remove();
        refreshAll();
    });
}

function openDeleteDepartmentDialog() {
    const cur = getCurrentDepartment();
    const sections = getSystem().sections.filter(s => s.department === cur);

    if (sections.length > 0) {
        if (!confirm(`В департаменте «${cur}» есть ${sections.length} участков. Удалить их?`)) return;
        getSystem().sections = getSystem().sections.filter(s => s.department !== cur);
    } else {
        if (!confirm(`Удалить департамент «${cur}»?`)) return;
    }

    const depts = getDepartments();
    const idx = depts.indexOf(cur);
    if (idx >= 0) depts.splice(idx, 1);
    setDepartments(depts);

    const map = getWorkshopsMap();
    delete map[cur];
    getSystem().workshops = map;

    if (depts.length > 0) setCurrentDepartment(depts[0]);

    saveSystem();
    logAudit('delete_department', cur, `Удалено участков: ${sections.length}`);
    refreshAll();
}

// ======================== CRUD ЦЕХОВ ========================
function openAddWorkshopDialog() {
    const dept = getCurrentDepartment();
    showModal('Новый цех', [{ name: 'name', label: 'Название', value: '' }], (v, overlay) => {
        if (!v.name || !v.name.trim()) return;
        const name = v.name.trim();
        const arr = getWorkshops(dept);
        if (arr.includes(name)) { alert('Такой цех уже есть'); return; }

        arr.push(name);
        setWorkshops(dept, arr);

        logAudit('add_workshop', name, `Департамент: ${dept}`);
        overlay.remove();
        refreshAll();
    });
}

function openRenameWorkshopDialog() {
    const dept = getCurrentDepartment();
    const cur = getCurrentWorkshop();
    showModal('Переименовать цех', [{ name: 'name', label: 'Название', value: cur }], (v, overlay) => {
        if (!v.name || !v.name.trim()) return;
        const newName = v.name.trim();
        if (newName === cur) { overlay.remove(); return; }

        const arr = getWorkshops(dept);
        const idx = arr.indexOf(cur);
        if (idx < 0) return;

        arr[idx] = newName;
        setWorkshops(dept, arr);

        getSystem().sections.forEach(s => {
            if (s.department === dept && s.workshop === cur) s.workshop = newName;
        });
        if (getSystem().currentWorkshop === cur) getSystem().currentWorkshop = newName;

        saveSystem();
        logAudit('rename_workshop', newName, `Было: ${cur} · департамент ${dept}`);
        overlay.remove();
        refreshAll();
    });
}

function openDeleteWorkshopDialog() {
    const dept = getCurrentDepartment();
    const cur = getCurrentWorkshop();
    const sections = getSystem().sections.filter(s => s.department === dept && s.workshop === cur);

    if (sections.length > 0) {
        if (!confirm(`В цехе «${cur}» есть ${sections.length} участков. Удалить их?`)) return;
        getSystem().sections = getSystem().sections.filter(s => !(s.department === dept && s.workshop === cur));
    } else {
        if (!confirm(`Удалить цех «${cur}»?`)) return;
    }

    const arr = getWorkshops(dept);
    const idx = arr.indexOf(cur);
    if (idx >= 0) arr.splice(idx, 1);
    setWorkshops(dept, arr);

    if (arr.length > 0) setCurrentWorkshop(arr[0]);

    saveSystem();
    logAudit('delete_workshop', cur, `Департамент: ${dept}`);
    refreshAll();
}

// ======================== CRUD ПОСТОВ / ОПЕРАТОРОВ ========================
function openAddPostDialog() {
    showModal('Новый пост', [
        { name: 'name', label: 'Название', value: '' },
        { name: 'difficulty', label: 'Сложность', type: 'select', value: 'C', options: [
            { value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' }]},
        { name: 'ergonomics', label: 'Эргономика', type: 'select', value: 'green', options: [
            { value: 'red', label: 'Красная' }, { value: 'yellow', label: 'Жёлтая' }, { value: 'green', label: 'Зелёная' }]},
        { name: 'trainingDays', label: 'Срок обучения', type: 'number', value: '5' }
    ], (v, overlay) => {
        if (!v.name || !v.name.trim()) return;
        addPostToSection({ name: v.name.trim(), difficulty: v.difficulty, ergonomics: v.ergonomics, trainingDays: parseInt(v.trainingDays) || 5 });
        overlay.remove(); refreshAll();
    });
}

function openAddOperatorDialog() {
    showModal('Новый оператор', [
        { name: 'name', label: 'ФИО', value: '' },
        { name: 'role', label: 'Роль', type: 'select', value: 'О', options: OPERATOR_ROLES }
    ], (v, overlay) => {
        if (!v.name || !v.name.trim()) return;
        addOperatorToShift({ name: v.name.trim(), role: v.role });
        overlay.remove(); refreshAll();
    });
}

// ======================== ДАТА / ИНФО ========================
function updateDateBar() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.toLocaleString('ru-RU', { month: 'long' });
    const startOfYear = new Date(year, 0, 1);
    const days = Math.floor((now - startOfYear) / 86400000);
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    const dateStr = now.toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

    const el = document.getElementById('dateBar');
    if (!el) return;

    el.innerHTML =
        `<div>📅 Год: <span>${year}</span></div>` +
        `<div>📅 Месяц: <span>${escapeHtml(month)}</span></div>` +
        `<div>📅 Неделя: <span>№${weekNumber}</span></div>` +
        `<div>📅 Дата: <span>${escapeHtml(dateStr)}</span></div>`;
}

function updateInfoCard() {
    const section = getCurrentSection();
    if (!section) return;

    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setTxt('infoSection', section.name);
    setTxt('infoShift', getCurrentShift());
    setTxt('infoDate', getCurrentDate());
    setTxt('infoDepartment', section.department || '—');
    setTxt('infoWorkshop', section.workshop || '—');
    setTxt('infoWorkshopChief', getWorkshopChief() || '—');
    setTxt('infoSectionChief', getSectionChief() || '—');
}

function editChief(type) {
    if (type === 'workshop') {
        const cur = getWorkshopChief();
        const v = prompt('Введите ФИО Начальника цеха (Н Ц):', cur || '');
        if (v !== null) {
            setWorkshopChief(v.trim());
            logAudit('edit_chief', 'НЦ', `ФИО: ${v.trim()}`);
            updateInfoCard();
        }
    } else {
        const cur = getSectionChief();
        const v = prompt('Введите ФИО Начальника участка (НУ):', cur || '');
        if (v !== null) {
            setSectionChief(v.trim());
            logAudit('edit_chief', 'НУ', `ФИО: ${v.trim()}`);
            updateInfoCard();
        }
    }
}

// ======================== ЭКСПОРТ / ИМПОРТ EXCEL ========================
function exportSystemToFile() {
    if (typeof XLSX === 'undefined') {
        alert('Библиотека XLSX не загружена. Проверьте подключение CDN.');
        return;
    }

    const sys = getSystem();
    const wb = XLSX.utils.book_new();

    const sectionsSheet = [['ID', 'Название', 'Департамент', 'Цех', 'НЦ', 'Постов']];
    sys.sections.forEach(s => sectionsSheet.push([s.id, s.name, s.department, s.workshop, s.workshopChief || '', s.posts.length]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sectionsSheet), 'Участки');

    const deptSheet = [['Департамент', 'Цех']];
    const depts = getDepartments();
    depts.forEach(d => {
        const wss = getWorkshops(d);
        if (wss.length === 0) deptSheet.push([d, '']);
        else wss.forEach(w => deptSheet.push([d, w]));
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(deptSheet), 'Департаменты и цеха');

    const trainSheet = [['Год', 'Месяц', 'Пост', 'Оператор', 'Уровень', 'Статус', 'Форматор', 'Дата начала', 'Дата валидации', 'Срок', 'Комментарий']];
    (sys.trainingRecords || []).forEach(r => trainSheet.push([
        r.year, r.month, r.post, r.op, r.level, r.status, r.formator,
        r.startDate, r.validDate, r.duration, r.comment
    ]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(trainSheet), 'Обучения');

    const logSheet = [['Дата', 'Время', 'Оператор', 'Пост', 'Действие']];
    (sys.placementLog || []).forEach(e => logSheet.push([e.date, e.time || '', e.opName, e.postName, e.action]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(logSheet), 'Журнал расстановки');

    const auditSheet = [['Дата', 'Время', 'Пользователь', 'Действие', 'Объект', 'Детали']];
    (sys.auditLog || []).forEach(e => auditSheet.push([
        e.date, e.time, e.user,
        (typeof AUDIT_ACTION_LABELS !== 'undefined' && AUDIT_ACTION_LABELS[e.action]) || e.action,
        e.target, e.details
    ]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(auditSheet), 'Аудит');

    // Архив дефектов
    const archSheet = [['Дата', 'Время', 'Пост', 'Оператор', 'Дефект', 'Действие', 'Пилот', 'Срок', '%', 'Приоритет', 'Статус']];
    (sys.qualityArchive || []).forEach(r => archSheet.push([
        r.createdDate, r.createdTime, r.postName, r.operatorName, r.defect,
        r.action, r.pilot, r.deadline, r.percent, r.priority, r.status
    ]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(archSheet), 'Архив дефектов');

    sys.sections.forEach(section => {
        const postsSheet = [['ID', 'Название', 'Сложность', 'Эргономика', 'Срок обучения', 'Неисправность', 'Риск дефекта', 'Зона кузова']];
        section.posts.forEach(p => postsSheet.push([
            p.id, p.name, p.difficulty, p.ergonomics, p.trainingDays,
            p.issues ? 'да' : 'нет', p.defectRisk ? 'да' : 'нет', p.bodyZone ? 'да' : 'нет'
        ]));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(postsSheet), safeSheetName(section.name + ' - Посты'));
    });

    XLSX.writeFile(wb, 'ILU_' + formatDate().replace(/\./g, '-') + '.xlsx');
    logAudit('export_excel', 'Система', 'Экспорт в Excel');
}

function importSystemFromFile(event) {
    const file = event.target.files[0];
    if (!file) {
        event.target.value = '';
        return;
    }

    if (typeof XLSX === 'undefined') {
        alert('Библиотека XLSX не загружена. Проверьте подключение CDN.');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const wb = XLSX.read(data, { type: 'array' });

            if (!wb.SheetNames.includes('Участки')) { alert('Файл не содержит лист «Участки»'); return; }

            const sys = createDefaultSystem();
            sys.sections = [];
            sys.trainingRecords = [];
            sys.placementLog = [];
            sys.auditLog = [];
            sys.qualityArchive = [];

            // Импорт архив
            if (wb.SheetNames.includes('Архив дефектов')) {
                const rows = XLSX.utils.sheet_to_json(wb.Sheets['Архив дефектов'], { header: 1 });
                for (let i = 1; i < rows.length; i++) {
                    const r = rows[i];
                    if (!r || !r[2]) continue;
                    sys.qualityArchive.push({
                        id: genId(),
                        planId: '',
                        createdAt: new Date().toISOString(),
                        createdDate: r[0] || '',
                        createdTime: r[1] || '',
                        updatedAt: '',
                        postName: r[2] || '',
                        operatorName: r[3] || '',
                        defect: r[4] || '',
                        action: r[5] || '',
                        pilot: r[6] || '',
                        deadline: r[7] || '',
                        percent: parseInt(r[8]) || 0,
                        priority: r[9] || 'medium',
                        status: r[10] || 'open',
                        deletedFromPlan: false,
                    });
                }
            }

            // Импорт участков
            const sectionsData = XLSX.utils.sheet_to_json(wb.Sheets['Участки'], { header: 1 });
            for (let i = 1; i < sectionsData.length; i++) {
                const row = sectionsData[i];
                if (!row || !row[1]) continue;

                const sectionName = row[1];
                const department = row[2] || 'Сборка';
                const workshop = row[3] || '';
                const workshopChief = row[4] || '';

                const section = createSectionRaw(sectionName, department, workshop);
                section.workshopChief = workshopChief;

                // Посты
                const postsSheetName = safeSheetName(sectionName + ' - Посты');
                if (wb.SheetNames.includes(postsSheetName)) {
                    const postsRows = XLSX.utils.sheet_to_json(wb.Sheets[postsSheetName], { header: 1 });
                    for (let j = 1; j < postsRows.length; j++) {
                        const r = postsRows[j];
                        if (!r || !r[1]) continue;
                        section.posts.push({
                            id: r[0] || genId(), name: r[1],
                            difficulty: r[2] || 'C', ergonomics: r[3] || 'green',
                            trainingDays: parseInt(r[4]) || 5,
                            issues: r[5] === 'да', defectRisk: r[6] === 'да', bodyZone: r[7] === 'да',
                            files: []
                        });
                    }
                }

                sys.sections.push(section);
            }

            if (sys.sections.length === 0) { alert('Не удалось прочитать участки'); return; }

            sys.currentSectionId = sys.sections[0].id;
            sys.currentDepartment = sys.sections[0].department || 'Сборка';
            sys.currentWorkshop = sys.sections[0].workshop || '';

            importSystem(sys);
            alert('Импорт успешно завершён');
            location.reload();

        } catch (err) {
            console.error(err);
            alert('Ошибка импорта: ' + err.message);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
}

// ======================== ЭКСПОРТ / ИМПОРТ JSON ========================
function exportSystemToJSON() {
    const sys = getSystem();
    const dataStr = JSON.stringify(sys, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ILU_backup_' + formatDate().replace(/\./g, '-') + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logAudit('export_json', 'Система', 'Скачан бэкап');
}

function importSystemFromJSON(event) {
    const file = event.target.files[0];
    if (!file) {
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = JSON.parse(e.target.result);
            if (!parsed.sections || !Array.isArray(parsed.sections)) {
                alert('Неверный формат файла: нет sections');
                return;
            }
            if (!confirm('Заменить текущую систему данными из бэкапа?')) return;

            importSystem(parsed);
            alert('Бэкап загружен. Перезагрузка...');
            location.reload();
        } catch (err) {
            console.error(err);
            alert('Ошибка загрузки бэкапа: ' + err.message);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

// ======================== ХРАНИЛИЩЕ ========================
function renderStoragePanel() {
    const statusEl = document.getElementById('storageStatus');
    const connectBtn = document.getElementById('storageConnectBtn');
    const confirmBtn = document.getElementById('storageConfirmBtn');
    const reloadBtn = document.getElementById('storageReloadBtn');
    const disconnectBtn = document.getElementById('storageDisconnectBtn');

    if (!statusEl || !window.storage) return;

    const s = window.storage.getStorageStatus();

    let icon = '💾';
    let color = 'var(--text)';
    if (!s.supported) { icon = '⚠️'; color = '#ef4444'; }
    else if (s.connected) { icon = '✅'; color = '#16a34a'; }
    else if (s.folderName) { icon = '🔒'; color = '#f59e0b'; }

    statusEl.innerHTML = `
        <div><b>${icon} Режим:</b> ${s.mode === 'fsa' ? 'Файлы на диске' : 'localStorage (браузер)'}</div>
        ${s.folderName ? `<div><b>Папка:</b> ${escapeHtml(s.folderName)}</div>` : ''}
        <div style="font-size:12px;color:${color};margin-top:4px;">${escapeHtml(s.message)}</div>
    `;

    if (connectBtn) connectBtn.style.display = s.connected ? 'none' : '';
    if (confirmBtn) confirmBtn.style.display = (s.supported && s.folderName && !s.connected) ? '' : 'none';
    if (reloadBtn) reloadBtn.style.display = s.connected ? '' : 'none';
    if (disconnectBtn) disconnectBtn.style.display = s.connected ? '' : 'none';
}

async function onConnectFolder() {
    if (!window.storage) return;
    const ok = await window.storage.connectDataFolder();
    renderStoragePanel();
    if (ok && typeof refreshAll === 'function') refreshAll();
}

async function onConfirmFolder() {
    if (!window.storage) return;
    const ok = await window.storage.confirmFolderAccess();
    renderStoragePanel();
    if (ok) {
        await window.storage.loadSystemFromDisk();
        if (typeof refreshAll === 'function') refreshAll();
    }
}

async function onReloadFromDisk() {
    if (!window.storage) return;
    if (!confirm('Загрузить данные из файла system.json?\n\nТекущие несохранённые изменения будут потеряны.')) return;
    const ok = await window.storage.loadSystemFromDisk();
    if (ok) {
        if (typeof refreshAll === 'function') refreshAll();
        if (typeof showToast === 'function') showToast('📂 Данные загружены из файла');
    } else {
        alert('Не удалось загрузить данные');
    }
}

async function onDisconnectFolder() {
    if (!window.storage) return;
    if (!confirm('Отключить папку и вернуться к localStorage?\n\nДанные останутся в текущем localStorage.')) return;
    await window.storage.disconnectDataFolder();
    renderStoragePanel();
}

// ======================== ИНИЦИАЛИЗАЦИЯ ========================
applyTheme();
if (typeof loadCurrentUser === 'function') loadCurrentUser();
if (typeof renderNormSettings === 'function') renderNormSettings();
if (typeof renderAutoApplyPanel === 'function') renderAutoApplyPanel();
refreshAll();
if (typeof updateNotifications === 'function') updateNotifications();

setTimeout(() => {
    if (typeof renderStoragePanel === 'function') renderStoragePanel();
    if (typeof renderSyncPanel === 'function') renderSyncPanel();
}, 500);