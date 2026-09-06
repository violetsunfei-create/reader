// IndexedDB 封装:books / highlights / conversations / messages 四张表
const DB_NAME = 'shenshen-book-reader';
const DB_VERSION = 1;

let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('books')) d.createObjectStore('books', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('highlights')) {
        const s = d.createObjectStore('highlights', { keyPath: 'id' });
        s.createIndex('bookId', 'bookId', { unique: false });
      }
      if (!d.objectStoreNames.contains('conversations')) {
        const s = d.createObjectStore('conversations', { keyPath: 'id' });
        s.createIndex('bookId', 'bookId', { unique: false });
      }
      if (!d.objectStoreNames.contains('messages')) {
        const s = d.createObjectStore('messages', { keyPath: 'id' });
        s.createIndex('bookId', 'bookId', { unique: false });
        s.createIndex('convId', 'convId', { unique: false });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function reqAsPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(t) {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('事务中止'));
  });
}

export const db = {
  async put(store, value) {
    const d = await openDB();
    const t = d.transaction(store, 'readwrite');
    t.objectStore(store).put(value);
    await txDone(t);
    return value;
  },
  async get(store, key) {
    const d = await openDB();
    return reqAsPromise(d.transaction(store).objectStore(store).get(key));
  },
  async del(store, key) {
    const d = await openDB();
    const t = d.transaction(store, 'readwrite');
    t.objectStore(store).delete(key);
    return txDone(t);
  },
  async all(store) {
    const d = await openDB();
    return reqAsPromise(d.transaction(store).objectStore(store).getAll());
  },
  async byIndex(store, index, value) {
    const d = await openDB();
    return reqAsPromise(d.transaction(store).objectStore(store).index(index).getAll(value));
  },
  async delByIndex(store, index, value) {
    const d = await openDB();
    const t = d.transaction(store, 'readwrite');
    const os = t.objectStore(store);
    const cur = os.index(index).openCursor(IDBKeyRange.only(value));
    cur.onsuccess = (e) => {
      const c = e.target.result;
      if (c) { c.delete(); c.continue(); }
    };
    return txDone(t);
  },
  async clear(store) {
    const d = await openDB();
    const t = d.transaction(store, 'readwrite');
    t.objectStore(store).clear();
    return txDone(t);
  },
};

export function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() :
    'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));
}
