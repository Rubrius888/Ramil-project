// ======================== EXCEL-ТАБЛИЦЫ ========================
// Модуль для работы с пользовательскими таблицами:
//   • загрузка .xlsx / .xls / .csv
//   • встроенный просмотр и редактор (x-spreadsheet)
//   • хранение в system.customTables
//   • экспорт в .xlsx
//   • импорт данных в систему (посты/операторы)

console.log('[excel-tables.js] Загружен');

// ======================== РЕНДЕР ВКЛАДКИ ========================

function renderExcelTables() {
  const cont = document.getElementById('excelTablesContent');
  if (!cont) return;

  const sys = getSystem();
  const tables = sys.customTables || [];

  if (tables.length === 0) {
    cont.innerHTML = `
      <div class="matrix-container" style="padding:60px 20px;text-align:center;">
        <div style="font-size:48px;margin-bottom:12px;">📊</div>
        <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px;">
          Нет загруженных таблиц
        </div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:20px;">
          Загрузите Excel-файл или создайте пустую таблицу
        </div>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
          <button class="btn-small" onclick="openExcelImportDialog()">📥 Загрузить Excel</button>
          <button class="btn-small" onclick="createEmptyExcelTable()">➕ Новая таблица</button>
        </div>
      </div>
    `;
    return;
  }

  let html = '<div class="excel-tables-grid">';

  tables.forEach((t, i) => {
    const sheetCount = (t.sheets || []).length;
    const totalRows = (t.sheets || []).reduce((sum, s) => sum + (s.data?.length || 0), 0);

    html += `
      <div class="excel-table-card" onclick="openExcelTableEditor(${i})">
        <div class="excel-table-card-icon">📊</div>
        <div class="excel-table-card-body">
          <div class="excel-table-card-name">${escapeHtml(t.name)}</div>
          <div class="excel-table-card-meta">
            ${sheetCount} лист${sheetCount === 1 ? '' : 'ов'} ·
            ${totalRows} строк · создано ${formatDate(new Date(t.createdAt))}
          </div>
          <div class="excel-table-card-actions" onclick="event.stopPropagation();">
            <button class="btn-small" onclick="openExcelTableEditor(${i})">👁 Открыть</button>
            <button class="btn-small" onclick="downloadExcelTable(${i})">⬇</button>
            <button class="btn-small" onclick="renameExcelTable(${i})">✏️</button>
            <button class="btn-small danger" onclick="deleteExcelTable(${i})">🗑</button>
          </div>
        </div>
      </div>
    `;
  });

  html += '</div>';
  cont.innerHTML = html;
}

// ======================== ИМПОРТ EXCEL ========================

function openExcelImportDialog() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls,.csv';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    importExcelFile(file);
  };
  input.click();
}

function importExcelFile(file) {
  if (!window.XLSX) {
    alert('Библиотека SheetJS не загружена. Проверьте подключение CDN.');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert('Файл слишком большой. Максимум 5 МБ.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = new Uint8Array(ev.target.result);
      const wb = XLSX.read(data, { type: 'array' });

      const sheets = wb.SheetNames.map(sheetName => {
        const ws = wb.Sheets[sheetName];
        const arr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
        const trimmed = arr.slice(0, 500).map(row => row.slice(0, 50));
        return { name: sheetName, data: trimmed };
      });

      const sys = getSystem();
      if (!Array.isArray(sys.customTables)) sys.customTables = [];

      const tableId = genId();
      sys.customTables.push({
        id: tableId,
        name: file.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sheets: sheets
      });

      saveSystem();
      logAudit('add_custom_table', file.name, `Excel-таблица · ${sheets.length} листов`);

      if (typeof showToast === 'function') showToast('📊 Excel-таблица загружена');
      renderExcelTables();
    } catch (err) {
      console.error(err);
      alert('Ошибка чтения файла: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ======================== СОЗДАНИЕ ПУСТОЙ ТАБЛИЦЫ ========================

function createEmptyExcelTable() {
  const name = prompt('Название таблицы:', 'Новая таблица');
  if (name === null) return;
  const trimmed = (name || '').trim();
  if (!trimmed) { alert('Название не может быть пустым'); return; }

  const sys = getSystem();
  if (!Array.isArray(sys.customTables)) sys.customTables = [];

  const emptyData = Array.from({ length: 10 }, () => Array(5).fill(''));

  sys.customTables.push({
    id: genId(),
    name: trimmed,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sheets: [{ name: 'Лист 1', data: emptyData }]
  });

  saveSystem();
  logAudit('add_custom_table', trimmed, 'Пустая таблица');
  if (typeof showToast === 'function') showToast('📊 Таблица создана');
  renderExcelTables();
}

// ======================== ПРОСМОТР / РЕДАКТОР ========================

let excelEditorInstance = null;
let excelEditorTableIdx = -1;
let excelEditorSheetIdx = 0;
let excelEditorDirty = false;

function openExcelTableEditor(tableIdx) {
  const sys = getSystem();
  const table = sys.customTables?.[tableIdx];
  if (!table) { alert('Таблица не найдена'); return; }

  excelEditorTableIdx = tableIdx;
  excelEditorSheetIdx = 0;
  excelEditorDirty = false;

  const modal = document.getElementById('excelPreviewModal');
  const title = document.getElementById('excelPreviewTitle');
  const sheetsBar = document.getElementById('excelPreviewSheets');
  const dlBtn = document.getElementById('excelPreviewDownloadBtn');

  if (!modal || !title) return;

  title.textContent = '📊 ' + table.name;
  dlBtn.onclick = () => downloadExcelTable(tableIdx);

  // Кнопка Сохранить
  let saveBtn = document.getElementById('excelPreviewSaveBtn');
  if (!saveBtn) {
    saveBtn = document.createElement('button');
    saveBtn.id = 'excelPreviewSaveBtn';
    saveBtn.className = 'btn-small';
    saveBtn.textContent = '💾 Сохранить';
    saveBtn.style.cssText = 'background:#16a34a;color:#fff;border-color:#16a34a;';
    saveBtn.onclick = () => {
      saveCurrentExcelSheet();
      saveSystem();
      logAudit('update_custom_table', table.name, 'Сохранение изменений');
      if (typeof showToast === 'function') showToast('💾 Таблица сохранена');
      excelEditorDirty = false;
    };
    dlBtn.parentNode.insertBefore(saveBtn, dlBtn);
  }
  saveBtn.style.display = '';

  // Панель листов
  sheetsBar.innerHTML = '';
  if (table.sheets.length > 1) {
    sheetsBar.style.display = 'flex';
    table.sheets.forEach((sheet, i) => {
      const btn = document.createElement('button');
      btn.className = 'btn-small';
      btn.textContent = sheet.name;
      btn.style.cssText = i === 0
        ? 'background:#3b82f6;color:#fff;border-color:#3b82f6;'
        : 'background:#fff;';
      btn.onclick = () => {
        saveCurrentExcelSheet();
        excelEditorSheetIdx = i;
        renderExcelEditorSheet();
        sheetsBar.querySelectorAll('button').forEach((b, j) => {
          b.style.cssText = j === i
            ? 'background:#3b82f6;color:#fff;border-color:#3b82f6;'
            : 'background:#fff;';
        });
      };
      sheetsBar.appendChild(btn);
    });
  } else {
    sheetsBar.style.display = 'none';
  }

  modal.classList.add('open');
  renderExcelEditorSheet();
}

function renderExcelEditorSheet() {
  const sys = getSystem();
  const table = sys.customTables?.[excelEditorTableIdx];
  if (!table) return;
  const sheet = table.sheets?.[excelEditorSheetIdx];
  if (!sheet) return;

  const tableCont = document.getElementById('excelPreviewTable');
  if (!tableCont) return;

  // Если x-spreadsheet загружен — используем редактор
  if (window.x_spreadsheet) {
    tableCont.innerHTML = '<div id="xspreadsheet-host" style="width:100%;"></div>';

    const rows = {};
    sheet.data.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val !== '' && val !== null && val !== undefined) {
          const addr = XLSX.utils.encode_cell({ r, c });
          rows[addr] = { text: String(val) };
        }
      });
    });

    const options = {
      mode: 'edit',
      showToolbar: true,
      showGrid: true,
      showContextmenu: false,
      row: { len: Math.max(20, sheet.data.length) },
      col: { len: Math.max(10, sheet.data[0]?.length || 0) },
      data: rows
    };

    setTimeout(() => {
      try {
        if (excelEditorInstance && excelEditorInstance.destroy) {
          excelEditorInstance.destroy();
        }
        excelEditorInstance = x_spreadsheet('#xspreadsheet-host', options);
        excelEditorInstance.change(() => { excelEditorDirty = true; });
      } catch (err) {
        console.error('x-spreadsheet error:', err);
        renderExcelReadonly(sheet, tableCont);
      }
    }, 50);
  } else {
    renderExcelReadonly(sheet, tableCont);
  }
}

function renderExcelReadonly(sheet, cont) {
  const rows = sheet.data || [];
  if (rows.length === 0) {
    cont.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;">Пустой лист</div>';
    return;
  }
  let html = '<table style="border-collapse:collapse;font-size:12px;min-width:100%;">';
  rows.forEach((row, r) => {
    html += '<tr>';
    row.forEach(cell => {
      const isHeader = r === 0;
      html += `<td style="border:1px solid #cbd5e1;padding:5px 8px;${isHeader ? 'background:#f1f5f9;font-weight:700;' : ''}">${escapeHtml(cell)}</td>`;
    });
    html += '</tr>';
  });
  html += '</table>';
  cont.innerHTML = html;
}

function saveCurrentExcelSheet() {
  if (!excelEditorInstance) return;
  try {
    const sys = getSystem();
    const table = sys.customTables?.[excelEditorTableIdx];
    if (!table) return;
    const sheet = table.sheets?.[excelEditorSheetIdx];
    if (!sheet) return;

    const data = excelEditorInstance.getData();
    if (!data || !data.rows) return;

    let maxR = 0, maxC = 0;
    Object.keys(data.rows).forEach(r => {
      const ri = parseInt(r);
      if (ri > maxR) maxR = ri;
      Object.keys(data.rows[r] || {}).forEach(c => {
        const ci = parseInt(c);
        if (ci > maxC) maxC = ci;
      });
    });

    const arr = [];
    for (let r = 0; r <= maxR; r++) {
      arr[r] = [];
      for (let c = 0; c <= maxC; c++) {
        const cell = data.rows?.[r]?.[c];
        arr[r][c] = cell && cell.text !== undefined ? String(cell.text) : '';
      }
    }
    sheet.data = arr;
    table.updatedAt = new Date().toISOString();
  } catch (err) {
    console.error('saveCurrentExcelSheet error:', err);
  }
}

function closeExcelPreview() {
  if (excelEditorDirty) {
    const save = confirm('Сохранить изменения перед закрытием?');
    if (save) {
      saveCurrentExcelSheet();
      saveSystem();
      if (typeof showToast === 'function') showToast('💾 Сохранено');
    }
  }
  if (excelEditorInstance && excelEditorInstance.destroy) {
    try { excelEditorInstance.destroy(); } catch (e) {}
    excelEditorInstance = null;
  }
  excelEditorTableIdx = -1;
  excelEditorSheetIdx = 0;
  excelEditorDirty = false;
  const modal = document.getElementById('excelPreviewModal');
  if (modal) modal.classList.remove('open');
  const saveBtn = document.getElementById('excelPreviewSaveBtn');
  if (saveBtn) saveBtn.style.display = '';
}

// ======================== ЭКСПОРТ ========================

function downloadExcelTable(tableIdx) {
  const sys = getSystem();
  const table = sys.customTables?.[tableIdx];
  if (!table) { alert('Таблица не найдена'); return; }
  if (!window.XLSX) { alert('Библиотека SheetJS не загружена'); return; }

  const wb = XLSX.utils.book_new();
  table.sheets.forEach(sheet => {
    const ws = XLSX.utils.aoa_to_sheet(sheet.data || []);
    const safeName = String(sheet.name).replace(/[\\\/\?\*\[\]:]/g, '_').slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  });

  const fileName = String(table.name).replace(/\.(xlsx|xls|csv)$/i, '') + '_'
                   + formatDate().replace(/\./g, '-') + '.xlsx';
  XLSX.writeFile(wb, fileName);
  logAudit('export_custom_table', table.name, '');
}

function exportAllCustomTables() {
  const sys = getSystem();
  const tables = sys.customTables || [];
  if (tables.length === 0) { alert('Нет таблиц для экспорта'); return; }
  if (!window.XLSX) { alert('Библиотека SheetJS не загружена'); return; }

  const wb = XLSX.utils.book_new();
  tables.forEach(table => {
    table.sheets.forEach((sheet, i) => {
      const ws = XLSX.utils.aoa_to_sheet(sheet.data || []);
      let sheetName = String(table.name).replace(/\.(xlsx|xls|csv)$/i, '')
                    + (table.sheets.length > 1 ? '_' + (i + 1) : '');
      sheetName = sheetName.replace(/[\\\/\?\*\[\]:]/g, '_').slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
  });

  XLSX.writeFile(wb, 'Все_таблицы_' + formatDate().replace(/\./g, '-') + '.xlsx');
  logAudit('export_custom_table', 'Все таблицы', `${tables.length} шт.`);
}

// ======================== УПРАВЛЕНИЕ ========================

function renameExcelTable(idx) {
  const sys = getSystem();
  const table = sys.customTables?.[idx];
  if (!table) return;
  const v = prompt('Новое название:', table.name);
  if (v === null) return;
  const trimmed = (v || '').trim();
  if (!trimmed) { alert('Название не может быть пустым'); return; }
  const oldName = table.name;
  table.name = trimmed;
  table.updatedAt = new Date().toISOString();
  saveSystem();
  logAudit('update_custom_table', trimmed, `Переименовано из «${oldName}»`);
  if (typeof showToast === 'function') showToast('✏️ Переименовано');
  renderExcelTables();
}

function deleteExcelTable(idx) {
  const sys = getSystem();
  const table = sys.customTables?.[idx];
  if (!table) return;
  if (!confirm(`Удалить таблицу «${table.name}»?`)) return;
  sys.customTables.splice(idx, 1);
  saveSystem();
  logAudit('delete_custom_table', table.name, '');
  if (typeof showToast === 'function') showToast('🗑 Таблица удалена');
  renderExcelTables();
}

// ======================== ВСТРОЕННЫЙ ПРОСМОТР EXCEL-ФАЙЛОВ ИЗ ПРОФИЛЯ ====================

function openExcelFilePreview(fileName, dataUrl) {
  if (!window.XLSX) { alert('Библиотека SheetJS не загружена'); return; }

  const modal = document.getElementById('excelPreviewModal');
  const title = document.getElementById('excelPreviewTitle');
  const sheetsBar = document.getElementById('excelPreviewSheets');
  const tableCont = document.getElementById('excelPreviewTable');
  const dlBtn = document.getElementById('excelPreviewDownloadBtn');
  const saveBtn = document.getElementById('excelPreviewSaveBtn');

  if (!modal || !title || !tableCont) {
    const w = window.open('', '_blank');
    if (w) w.document.write(`<h1>${fileName}</h1><p><a href="${dataUrl}" download="${fileName}">⬇ Скачать</a></p>`);
    return;
  }

  // Скрываем Сохранить — просмотр без редактирования
  if (saveBtn) saveBtn.style.display = 'none';
  // Уничтожаем возможный старый экземпляр x-spreadsheet
  if (excelEditorInstance && excelEditorInstance.destroy) {
    try { excelEditorInstance.destroy(); } catch (e) {}
    excelEditorInstance = null;
  }

  title.textContent = '📊 ' + fileName;
  dlBtn.onclick = () => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    a.click();
  };

  try {
    const [meta, base64] = dataUrl.split(',');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const wb = XLSX.read(bytes, { type: 'array' });

    sheetsBar.innerHTML = '';
    sheetsBar.style.display = wb.SheetNames.length > 1 ? 'flex' : 'none';

    const renderSheet = (sheetName) => {
      const ws = wb.Sheets[sheetName];
      const arr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
      const trimmed = arr.slice(0, 500).map(row => row.slice(0, 50));

      let html = '<table style="border-collapse:collapse;font-size:12px;min-width:100%;">';
      trimmed.forEach((row, r) => {
        html += '<tr>';
        row.forEach(cell => {
          const isHeader = r === 0;
          html += `<td style="border:1px solid #cbd5e1;padding:5px 8px;${isHeader ? 'background:#f1f5f9;font-weight:700;' : ''}">${escapeHtml(cell)}</td>`;
        });
        html += '</tr>';
      });
      html += '</table>';
      tableCont.innerHTML = html;

      sheetsBar.querySelectorAll('button').forEach(b => {
        b.style.cssText = b.textContent === sheetName
          ? 'background:#3b82f6;color:#fff;border-color:#3b82f6;'
          : 'background:#fff;';
      });
    };

    wb.SheetNames.forEach((sheetName, i) => {
      const btn = document.createElement('button');
      btn.className = 'btn-small';
      btn.textContent = sheetName;
      btn.style.cssText = i === 0
        ? 'background:#3b82f6;color:#fff;border-color:#3b82f6;'
        : 'background:#fff;';
      btn.onclick = () => renderSheet(sheetName);
      sheetsBar.appendChild(btn);
    });

    renderSheet(wb.SheetNames[0]);
    modal.classList.add('open');
  } catch (err) {
    console.error('Excel preview error:', err);
    alert('Не удалось прочитать Excel-файл: ' + err.message);
  }
}

// ======================== ИМПОРТ ДАННЫХ ИЗ ТАБЛИЦЫ В СИСТЕМУ ====================

function importFromExcelTable(tableIdx) {
  const sys = getSystem();
  const table = sys.customTables?.[tableIdx];
  if (!table || table.sheets.length === 0) { alert('Нет данных'); return; }

  const sheet = table.sheets[0];
  const rows = sheet.data || [];
  if (rows.length < 2) { alert('Таблица пуста или не содержит данных'); return; }

  const headers = rows[0].map(h => String(h).trim().toLowerCase());
  const dataRows = rows.slice(1);

  const colPost = headers.findIndex(h => h.includes('пост'));
  const colOp = headers.findIndex(h => h.includes('оператор') || h.includes('фио'));
  const colDiff = headers.findIndex(h => h.includes('сложность'));

  if (colPost < 0 && colOp < 0) {
    alert('Не найдены колонки «Пост» или «Оператор».\n\nОжидаемые заголовки: Пост, Оператор, Уровень.');
    return;
  }

  const ok = confirm(
    `Импортировать данные из «${table.name}»?\n\n` +
    `Найдено колонок: Пост=${colPost >= 0}, Оператор=${colOp >= 0}, Сложность=${colDiff >= 0}\n\n` +
    `Новые посты и операторы будут ДОБАВЛЕНЫ (существующие не изменятся).`
  );
  if (!ok) return;

  let addedPosts = 0, addedOps = 0;
  const section = getCurrentSection();
  const shiftData = getCurrentShiftData();

  dataRows.forEach(row => {
    if (colPost >= 0 && row[colPost]) {
      const postName = String(row[colPost]).trim();
      if (postName && !section.posts.some(p => p.name === postName)) {
        addPostToSection({
          name: postName,
          difficulty: colDiff >= 0 ? String(row[colDiff]).trim().toUpperCase() : 'C',
          ergonomics: 'green',
          trainingDays: 5
        });
        addedPosts++;
      }
    }
    if (colOp >= 0 && row[colOp]) {
      const opName = String(row[colOp]).trim();
      if (opName && !shiftData.operators.some(o => o.name === opName)) {
        addOperatorToShift({ name: opName, role: 'О' });
        addedOps++;
      }
    }
  });

  saveSystem();
  logAudit('import_excel_data', table.name, `+${addedPosts} постов, +${addedOps} операторов`);
  if (typeof showToast === 'function') {
    showToast(`✅ Импорт: ${addedPosts} постов, ${addedOps} операторов`);
  }
  renderExcelTables();
  if (typeof renderMatrix === 'function') {
    try { renderMatrix(); } catch (e) {}
  }
}

// ======================== ИНИЦИАЛИЗАЦИЯ ========================

function initExcelTablesTab() {
  renderExcelTables();
}