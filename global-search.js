// ======================== ГЛОБАЛЬНЫЙ ПОИСК ========================

let globalSearchOpen = false;

function toggleGlobalSearch() {
  globalSearchOpen = !globalSearchOpen;
  const modal = document.getElementById('globalSearchModal');
  if (!modal) return;
  modal.classList.toggle('open', globalSearchOpen);
  if (globalSearchOpen) {
    const input = document.getElementById('globalSearchInput');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 50);
    }
    renderGlobalSearchResults('');
  }
}

function closeGlobalSearch() {
  globalSearchOpen = false;
  const modal = document.getElementById('globalSearchModal');
  if (modal) modal.classList.remove('open');
}

function renderGlobalSearchResults(query) {
  const cont = document.getElementById('globalSearchResults');
  if (!cont) return;
  const q = (query || '').trim().toLowerCase();
  if (q.length < 2) {
    cont.innerHTML = '<div class="global-search-hint">Введите минимум 2 символа</div>';
    return;
  }

  const results = [];
  const sys = getSystem();

  sys.sections.forEach(section => {
    SHIFTS.forEach(shift => {
      const shiftData = section.shifts[shift];
      if (!shiftData) return;
      (shiftData.operators || []).forEach((op, opIdx) => {
        if (op.name.toLowerCase().includes(q) || op.role.toLowerCase().includes(q)) {
          results.push({
            type: 'operator',
            icon: '👤',
            title: op.name,
            sub: `${section.name} · смена ${shift} · роль ${op.role}`,
            action: { sectionId: section.id, shift, opIdx, tab: 'se8' }
          });
        }
      });
    });
  });

  sys.sections.forEach(section => {
    (section.posts || []).forEach((p, idx) => {
      if (p.name.toLowerCase().includes(q) ||
          p.difficulty.toLowerCase().includes(q) ||
          p.ergonomics.toLowerCase().includes(q)) {
        results.push({
          type: 'post',
          icon: '📍',
          title: p.name,
          sub: `${section.name} · сложность ${p.difficulty} · эргономика ${p.ergonomics}`,
          action: { sectionId: section.id, tab: 'matrix', postIdx: idx }
        });
      }
    });
  });

  sys.sections.forEach(section => {
    if (section.name.toLowerCase().includes(q) ||
        (section.department || '').toLowerCase().includes(q) ||
        (section.workshop || '').toLowerCase().includes(q)) {
      results.push({
        type: 'section',
        icon: '🏭',
        title: section.name,
        sub: `${section.department || ''} · ${section.workshop || ''}`,
        action: { sectionId: section.id, tab: 'se8' }
      });
    }
  });

  (sys.trainingRecords || []).forEach((r, idx) => {
    if ((r.op || '').toLowerCase().includes(q) ||
        (r.post || '').toLowerCase().includes(q) ||
        (r.formator || '').toLowerCase().includes(q)) {
      results.push({
        type: 'training',
        icon: '🎓',
        title: `${r.op} → ${r.post}`,
        sub: `${r.status} · уровень ${r.level} · форматор ${r.formator}`,
        action: { tab: 'training' }
      });
    }
  });

  if (results.length === 0) {
    cont.innerHTML = '<div class="global-search-hint">Ничего не найдено</div>';
    return;
  }

  const order = { operator: 0, post: 1, section: 2, training: 3 };
  results.sort((a, b) => order[a.type] - order[b.type]);

  cont.innerHTML = results.slice(0, 30).map((r, i) => `
    <div class="global-search-item" onclick='openGlobalSearchResult(${JSON.stringify(r.action)})'>
      <span class="global-search-icon">${r.icon}</span>
      <div class="global-search-content-block">
        <div class="global-search-title">${escapeHtml(r.title)}</div>
        <div class="global-search-sub">${escapeHtml(r.sub)}</div>
      </div>
    </div>
  `).join('');
}

function openGlobalSearchResult(action) {
  closeGlobalSearch();
  if (!action) return;

  if (action.sectionId) {
    setCurrentSection(action.sectionId);
  }
  if (action.shift) {
    setCurrentShift(action.shift);
  }

  let targetGroup = null;
  let targetSubtab = null;

  if (action.tab === 'se8') { targetGroup = 'work'; targetSubtab = 'se8'; }
  else if (action.tab === 'matrix') { targetGroup = 'work'; targetSubtab = 'matrix'; }
  else if (action.tab === 'training') { targetGroup = 'study'; targetSubtab = 'training'; }
  else if (action.tab === 'stats') { targetGroup = 'analytics'; targetSubtab = 'stats'; }

  if (targetGroup && targetSubtab) {
    const groupBtn = document.querySelector(`.group-btn[data-group="${targetGroup}"]`);
    if (groupBtn) groupBtn.click();

    setTimeout(() => {
      const subtabBtn = document.querySelector(`.subtab[data-tab="${targetSubtab}"]`);
      if (subtabBtn) subtabBtn.click();
      if (typeof refreshAll === 'function') refreshAll();
    }, 50);
  } else {
    if (typeof refreshAll === 'function') refreshAll();
  }

  setTimeout(() => {
    if (action.opIdx !== undefined && action.tab === 'se8' && typeof highlightMatrixOperator === 'function') {
      highlightMatrixOperator(action.opIdx);
    }
    if (action.postIdx !== undefined && action.tab === 'matrix' && typeof highlightMatrixPost === 'function') {
      highlightMatrixPost(action.postIdx);
    }
  }, 300);
}

document.addEventListener('click', (e) => {
  if (!globalSearchOpen) return;
  const modal = document.getElementById('globalSearchModal');
  if (modal && e.target === modal) closeGlobalSearch();
});