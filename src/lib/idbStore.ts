// ============================================================
// idbStore — IndexedDB の超薄いキー/バリュー層
//
// localStorage は約5MB上限で、大量のナレッジ（数百〜数千ファイル）を保存できない
// （オーナー報告 2026-06-18: 1846 件が反映されない）。IndexedDB は数百MB以上を扱えるため、
// 大容量データの永続化はこちらに寄せる。失敗してもアプリは止めない（null / false を返す）。
// ============================================================
const DB_NAME = 'core_idb';
const STORE = 'kv';
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB 非対応')); return; }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const rq = tx.objectStore(STORE).get(key);
      rq.onsuccess = () => resolve((rq.result ?? null) as T | null);
      rq.onerror = () => reject(rq.error);
    });
  } catch {
    return null;
  }
}

export async function idbSet(key: string, value: unknown): Promise<boolean> {
  try {
    const db = await openDB();
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  }
}
