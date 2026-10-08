// ======================== ХРАНИЛИЩЕ: File System Access API ========================
// Позволяет хранить данные в РЕАЛЬНОЙ ПАПКЕ на диске (500 ГБ+).
// Работает в Chrome / Edge / Яндекс.Браузер (Chromium).
// При отсутствии поддержки — откат на localStorage.
//
// Архитектура:
//   <корневая_папка>\
//   ├── system.json        — все данные системы
//   ├── photos\<opId>.jpg  — фото операторов
//   └── files\<fileId>.ext — документы

console.log('[storage.js] Загружен');

const STORAGE_MODE_KEY = 'ilu_storage_mode'; // 'localStorage' | 'fsa'
const FSA_HANDLE_DB = 'ilu_fsa_db';
const FSA_HANDLE_STORE = 'handles';
const FSA_ROOT_HANDLE_KEY = 'rootDir';

// ==================== СОСТОЯНИЕ ====================
let _fsaRootHandle = null;      // FileSystemDirectoryHandle
let _fsaAvailable = false;      // API доступен в браузере
let _fsaConnected = false;      // папка подключена и разрешение активно
let _photoCache = new Map();    // opId → blob URL (для быстрого доступа)
let _fileCache = new Map();     // fileId → blob URL

// ==================== ПРОВЕРКА ПОДДЕРЖКИ ====================
function isFSASupported() {
  return typeof window !== 'undefined'
    && 'showDirectoryPicker' in window
    && window.isSecureContext; // https или localhost
}

// ==================== IndexedDB для хранения handle ====================
// (FileSystemDirectoryHandle нельзя сохранить в localStorage — только в IndexedDB)

function openHandleDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FSA_HANDLE_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FSA_HANDLE_STORE)) {
        db.createObjectStore(FSA_HANDLE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveRootHandle(handle) {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FSA_HANDLE_STORE, 'readwrite');
    tx.objectStore(FSA_HANDLE_STORE).put(handle, FSA_ROOT_HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadRootHandle() {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FSA_HANDLE_STORE, 'readonly');
    const req = tx.objectStore(FSA_HANDLE_STORE).get(FSA_ROOT_HANDLE_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function clearRootHandle() {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FSA_HANDLE_STORE, 'readwrite');
    tx.objectStore(FSA_HANDLE_STORE).delete(FSA_ROOT_HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ==================== ПРОВЕРКА РАЗРЕШЕНИЯ ====================
async function verifyPermission(handle, mode) {
  mode = mode || 'readwrite';
  const opts = { mode };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if ((await handle.requestPermission(opts)) === 'granted') return true;
  return false;
}

// ==================== ПОДКЛЮЧЕНИЕ ПАПКИ ====================

/**
 * Открывает диалог выбора папки и подключает её.
 * @returns {Promise<boolean>} — успех
 */
async function connectDataFolder() {
  if (!isFSASupported()) {
    alert('Ваш браузер не поддерживает File System Access API.\n\n' +
          'Используйте Chrome, Edge или Яндекс.Браузер.\n' +
          'Также нужно открывать приложение через http://localhost (не file://).');
    return false;
  }

  try {
    const handle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents',
      id: 'ilu-data-folder'
    });

    const ok = await verifyPermission(handle, 'readwrite');
    if (!ok) {
      alert('Доступ к папке не разрешён');
      return false;
    }

    _fsaRootHandle = handle;
    _fsaConnected = true;

    await saveRootHandle(handle);
    localStorage.setItem(STORAGE_MODE_KEY, 'fsa');

    // Проверяем, есть ли уже system.json в папке
    const hasExisting = await fileExists(handle, 'system.json');
    if (hasExisting) {
      const use = confirm(
        'В папке найден файл system.json.\n\n' +
        'Загрузить данные из него?\n\n' +
        '(Отмена — использовать текущие данные, они будут записаны в эту папку)'
      );
      if (use) {
        await loadSystemFromDisk();
        if (typeof refreshAll === 'function') refreshAll();
      } else {
        await saveSystemToDisk();
      }
    } else {
      // Новая папка — сохраняем текущие данные
      await ensureSubdir(handle, 'photos');
      await ensureSubdir(handle, 'files');
      await saveSystemToDisk();
    }

    if (typeof showToast === 'function') {
      showToast('📁 Папка подключена: ' + handle.name);
    }
    return true;

  } catch (err) {
    if (err.name === 'AbortError') return false; // пользователь отменил
    console.error('[storage.js] connectDataFolder error:', err);
    alert('Ошибка подключения папки: ' + err.message);
    return false;
  }
}

/**
 * Восстанавливает доступ к папке при старте (если уже была подключена).
 * @returns {Promise<boolean>}
 */
async function restoreDataFolder() {
  if (!isFSASupported()) return false;
  if (localStorage.getItem(STORAGE_MODE_KEY) !== 'fsa') return false;

  try {
    const handle = await loadRootHandle();
    if (!handle) return false;

    // Проверяем разрешение БЕЗ запроса (нельзя вызывать requestPermission без user gesture)
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      _fsaRootHandle = handle;
      _fsaConnected = true;
      return true;
    }

    // Разрешение не выдано — попросим пользователя подтвердить
    // (это можно сделать только по клику — поэтому вернём false и
    //  покажем кнопку «Подтвердить доступ»)
    _fsaRootHandle = handle;
    _fsaConnected = false;
    return false;

  } catch (err) {
    console.error('[storage.js] restoreDataFolder error:', err);
    return false;
  }
}

/**
 * Пользователь нажал «Подтвердить доступ» (по кнопке в UI).
 * @returns {Promise<boolean>}
 */
async function confirmFolderAccess() {
  if (!_fsaRootHandle) return false;
  try {
    const ok = await verifyPermission(_fsaRootHandle, 'readwrite');
    if (ok) {
      _fsaConnected = true;
      if (typeof showToast === 'function') showToast('✅ Доступ к папке подтверждён');
      return true;
    }
    return false;
  } catch (err) {
    console.error('[storage.js] confirmFolderAccess error:', err);
    return false;
  }
}

/**
 * Отключает папку — возвращаемся на localStorage.
 */
async function disconnectDataFolder() {
  _fsaRootHandle = null;
  _fsaConnected = false;
  await clearRootHandle();
  localStorage.setItem(STORAGE_MODE_KEY, 'localStorage');
  if (typeof showToast === 'function') showToast('📁 Папка отключена');
}

// ==================== ФАЙЛОВЫЕ ОПЕРАЦИИ ====================

async function fileExists(dirHandle, fileName) {
  try {
    await dirHandle.getFileHandle(fileName);
    return true;
  } catch (e) {
    return false;
  }
}

async function ensureSubdir(parentHandle, name) {
  try {
    return await parentHandle.getDirectoryHandle(name, { create: true });
  } catch (e) {
    console.error('[storage.js] ensureSubdir error:', name, e);
    return null;
  }
}

async function writeTextFile(dirHandle, fileName, content) {
  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function readTextFile(dirHandle, fileName) {
  const fileHandle = await dirHandle.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  return await file.text();
}

async function writeBlobFile(dirHandle, fileName, blob) {
  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

async function readBlobFile(dirHandle, fileName) {
  const fileHandle = await dirHandle.getFileHandle(fileName);
  return await fileHandle.getFile();
}

// ==================== СИСТЕМА: СОХРАНЕНИЕ / ЗАГРУЗКА ====================

async function saveSystemToDisk() {
  if (!_fsaConnected || !_fsaRootHandle) return false;
  try {
    const sys = getSystem();
    // Создаём очищенную копию без data URL фото/файлов
    // (они лежат отдельно в photos/ и files/)
    const clean = prepareSystemForDisk(sys);
    await writeTextFile(_fsaRootHandle, 'system.json', JSON.stringify(clean, null, 2));
    return true;
  } catch (err) {
    console.error('[storage.js] saveSystemToDisk error:', err);
    return false;
  }
}

async function loadSystemFromDisk() {
  if (!_fsaConnected || !_fsaRootHandle) return false;
  try {
    const hasFile = await fileExists(_fsaRootHandle, 'system.json');
    if (!hasFile) return false;

    const text = await readTextFile(_fsaRootHandle, 'system.json');
    const parsed = JSON.parse(text);

    // Восстанавливаем ссылки на фото/файлы (вместо data URL ставим marker)
    // Операторы хранят photo: '<opId>' → загружаем как blob URL при отображении
    // Пока оставим так — данные photo в JSON будут пустые (или ссылка на файл)
    if (typeof importSystem === 'function') {
      importSystem(parsed);
    }

    return true;
  } catch (err) {
    console.error('[storage.js] loadSystemFromDisk error:', err);
    return false;
  }
}

/**
 * Подготавливает систему к записи в JSON:
 * — вычищает data URL фото и файлов (они лежат отдельно)
 * — оставляет метаданные (имя, размер, id)
 */
function prepareSystemForDisk(sys) {
  const clean = JSON.parse(JSON.stringify(sys));

  clean.sections.forEach(section => {
    // Посты — files
    (section.posts || []).forEach(post => {
      if (Array.isArray(post.files)) {
        post.files.forEach(f => {
          // data URL не пишем в JSON
          if (f.data && f.data.startsWith && f.data.startsWith('data:')) {
            f.dataRef = f.id; // ссылка на файл files/<id>.<ext>
            delete f.data;
          }
        });
      }
    });

    SHIFTS.forEach(shift => {
      const sd = section.shifts?.[shift];
      if (!sd) return;

      (sd.operators || []).forEach(op => {
        // Фото — тоже вынести
        if (op.photo && op.photo.startsWith && op.photo.startsWith('data:')) {
          op.photoRef = op.id; // ссылка на photos/<id>.jpg
          delete op.photo;
        }
        // Файлы оператора
        if (Array.isArray(op.files)) {
          op.files.forEach(f => {
            if (f.data && f.data.startsWith && f.data.startsWith('data:')) {
              f.dataRef = f.id;
              delete f.data;
            }
          });
        }
      });
    });
  });

  return clean;
}

// ==================== ФОТО ОПЕРАТОРОВ ====================

/**
 * Сохраняет фото оператора в photos/<opId>.jpg
 * @returns {Promise<string|null>} — blob URL для отображения в UI
 */
async function saveOperatorPhoto(opId, dataUrl) {
  if (!_fsaConnected || !_fsaRootHandle) {
    // fallback: оставляем в JSON как data URL
    return dataUrl;
  }

  try {
    const photosDir = await ensureSubdir(_fsaRootHandle, 'photos');
    // dataUrl: 'data:image/jpeg;base64,...'
    const [meta, base64] = dataUrl.split(',');
    const mime = meta.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    const ext = mime.includes('png') ? 'png' : 'jpg';

    const byteChars = atob(base64);
    const byteArr = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArr], { type: mime });

    await writeBlobFile(photosDir, `${opId}.${ext}`, blob);

    // Возвращаем blob URL для отображения
    const blobUrl = URL.createObjectURL(blob);
    _photoCache.set(opId, blobUrl);
    return blobUrl;
  } catch (err) {
    console.error('[storage.js] saveOperatorPhoto error:', err);
    return dataUrl; // fallback
  }
}

/**
 * Загружает фото оператора из photos/<opId>.jpg
 * @returns {Promise<string|null>} — blob URL
 */
async function loadOperatorPhoto(opId) {
  if (_photoCache.has(opId)) return _photoCache.get(opId);
  if (!_fsaConnected || !_fsaRootHandle) return null;

  try {
    const photosDir = await _fsaRootHandle.getDirectoryHandle('photos');
    // Пробуем jpg, потом png
    for (const ext of ['jpg', 'png']) {
      try {
        const blob = await readBlobFile(photosDir, `${opId}.${ext}`);
        const blobUrl = URL.createObjectURL(blob);
        _photoCache.set(opId, blobUrl);
        return blobUrl;
      } catch (e) {
        // пробуем следующий
      }
    }
    return null;
  } catch (err) {
    return null;
  }
}

async function deleteOperatorPhoto(opId) {
  if (!_fsaConnected || !_fsaRootHandle) return;
  try {
    const photosDir = await _fsaRootHandle.getDirectoryHandle('photos');
    for (const ext of ['jpg', 'png']) {
      try {
        await photosDir.removeEntry(`${opId}.${ext}`);
      } catch (e) { /* нет — пропускаем */ }
    }
    if (_photoCache.has(opId)) {
      URL.revokeObjectURL(_photoCache.get(opId));
      _photoCache.delete(opId);
    }
  } catch (err) {
    console.error('[storage.js] deleteOperatorPhoto error:', err);
  }
}

// ==================== ФАЙЛЫ (документы) ====================

async function saveOperatorFile(opId, fileId, fileName, dataUrl) {
  if (!_fsaConnected || !_fsaRootHandle) return dataUrl;
  try {
    const filesDir = await ensureSubdir(_fsaRootHandle, 'files');
    const ext = (fileName.split('.').pop() || 'bin').toLowerCase();
    const [meta, base64] = dataUrl.split(',');
    const mime = meta.match(/data:([^;]+)/)?.[1] || 'application/octet-stream';

    const byteChars = atob(base64);
    const byteArr = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArr], { type: mime });

    await writeBlobFile(filesDir, `${fileId}.${ext}`, blob);
    return dataUrl; // сохраняем как есть для UI
  } catch (err) {
    console.error('[storage.js] saveOperatorFile error:', err);
    return dataUrl;
  }
}

async function loadOperatorFile(fileId, ext) {
  if (_fileCache.has(fileId)) return _fileCache.get(fileId);
  if (!_fsaConnected || !_fsaRootHandle) return null;
  try {
    const filesDir = await _fsaRootHandle.getDirectoryHandle('files');
    const blob = await readBlobFile(filesDir, `${fileId}.${ext}`);
    const blobUrl = URL.createObjectURL(blob);
    _fileCache.set(fileId, blobUrl);
    return blobUrl;
  } catch (err) {
    return null;
  }
}

async function deleteOperatorFile(fileId, ext) {
  if (!_fsaConnected || !_fsaRootHandle) return;
  try {
    const filesDir = await _fsaRootHandle.getDirectoryHandle('files');
    await filesDir.removeEntry(`${fileId}.${ext}`);
    if (_fileCache.has(fileId)) {
      URL.revokeObjectURL(_fileCache.get(fileId));
      _fileCache.delete(fileId);
    }
  } catch (err) {
    console.error('[storage.js] deleteOperatorFile error:', err);
  }
}

// ==================== ГЛАВНОЕ: СЕЙВ / ЛОАД СИСТЕМЫ ====================

/**
 * Универсальное сохранение. Вызывается из data.js → saveSystem().
 * Автоматически: FSA (если подключена) ИЛИ localStorage.
 */
async function saveSystemUniversal() {
  if (_fsaConnected && _fsaRootHandle) {
    return await saveSystemToDisk();
  }
  // fallback: localStorage (как раньше)
  try {
    localStorage.setItem('ilu_system_v4', JSON.stringify(getSystem()));
    return true;
  } catch (e) {
    console.error('[storage.js] localStorage save error:', e);
    return false;
  }
}

// ==================== UI ИНТЕГРАЦИЯ ====================

/**
 * Возвращает текущее состояние хранилища для отображения в UI.
 */
function getStorageStatus() {
  if (!isFSASupported()) {
    return {
      supported: false,
      mode: 'localStorage',
      message: 'Браузер не поддерживает File System Access API (используйте Chrome/Edge/Яндекс через http://localhost)'
    };
  }
  if (_fsaConnected) {
    return {
      supported: true,
      mode: 'fsa',
      connected: true,
      folderName: _fsaRootHandle?.name || '?',
      message: 'Файлы на диске'
    };
  }
  if (_fsaRootHandle) {
    return {
      supported: true,
      mode: 'fsa',
      connected: false,
      folderName: _fsaRootHandle?.name || '?',
      message: 'Нужно подтвердить доступ к папке'
    };
  }
  return {
    supported: true,
    mode: 'localStorage',
    connected: false,
    message: 'Данные в браузере (localStorage)'
  };
}

function isStorageConnected() {
  return _fsaConnected;
}

// ==================== ЭКСПОРТ ====================
window.storage = {
  isFSASupported,
  connectDataFolder,
  restoreDataFolder,
  confirmFolderAccess,
  disconnectDataFolder,
  saveSystemUniversal,
  saveSystemToDisk,
  loadSystemFromDisk,
  getStorageStatus,
  isStorageConnected,
  saveOperatorPhoto,
  loadOperatorPhoto,
  deleteOperatorPhoto,
  saveOperatorFile,
  loadOperatorFile,
  deleteOperatorFile,
};

// ==================== АВТО-ВОССТАНОВЛЕНИЕ ПРИ СТАРТЕ ====================
(async function initStorage() {
  if (!isFSASupported()) {
    console.log('[storage.js] FSA не поддерживается — режим localStorage');
    return;
  }
  const ok = await restoreDataFolder();
  console.log('[storage.js] Восстановление папки:', ok ? 'успех' : 'нужно подтверждение');
  // UI обновится при инициализации app.js
})();