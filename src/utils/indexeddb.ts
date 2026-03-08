const DB_NAME = 'lectorbook-storage';
const DB_VERSION = 1;
const STORE_NAME = 'settings';
const GEMINI_API_KEYS_KEY = 'gemini-api-keys';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB indisponível neste ambiente.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha ao abrir IndexedDB.'));
  });
}

export async function saveGeminiApiKeys(keys: string[]): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) return;

  const db = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    store.put(keys, GEMINI_API_KEYS_KEY);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao salvar chaves no IndexedDB.'));
    tx.onabort = () => reject(tx.error ?? new Error('Transação abortada ao salvar chaves.'));
  });

  db.close();
}

export async function loadGeminiApiKeys(): Promise<string[]> {
  if (typeof window === 'undefined' || !window.indexedDB) return [];

  const db = await openDatabase();

  const result = await new Promise<string[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(GEMINI_API_KEYS_KEY);

    request.onsuccess = () => {
      const value = request.result;
      resolve(Array.isArray(value) ? value.filter((k): k is string => typeof k === 'string') : []);
    };
    request.onerror = () => reject(request.error ?? new Error('Falha ao carregar chaves do IndexedDB.'));
  });

  db.close();
  return result;
}
