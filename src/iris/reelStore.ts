// ============================================================
// IRIS ▸ Reel Studio 永続化 (IndexedDB 薄ラッパー・外部ライブラリなし)
//
// 目的: リールスタジオの素材 (Blob) + クリップ設定 + 字幕を端末内に保存し、
//       リロード / 再訪しても「前回の続き」から再開できるようにする。
// 方針:
//   - 失敗しても本体機能を壊さない (全 API は throw しない)
//   - ただし「保存できなかった」は絶対に黙らない。書き込み系は成否だけの boolean を
//     やめ、理由つきの SaveResult を返す (2026-08-01)。boolean だと画面に理由を出す道が
//     型の時点で閉じてしまい、素材が消えた本当の原因をユーザーに伝えられなかった。
//   - open は 5 秒タイムアウト (壊れた DB で永久ハングさせない)
// ============================================================

const DB_NAME = 'iris-reel-studio';
const DB_VERSION = 1;
const STORE_ASSETS = 'assets';    // key: assetId, value: { id, blob, name, type }
const STORE_PROJECT = 'project';  // key: 'current', value: StoredProject

export interface StoredClipMeta {
  assetId: string;
  kind: 'image' | 'video';
  duration: number;
  kenBurns: string;
  transition: string;
  speed?: number;
  grade?: string;
  name?: string;
  // ── リールスタジオ (既定の画面) 用。上級版には無い項目なので全て任意 ──
  /** カット毎の字幕 */
  captionText?: string;
  /** 字幕の縦位置 (0=上 〜 1=下) */
  captionY?: number;
}

export interface StoredCaption { start: number; end: number; text: string }

export interface StoredProject {
  clips: StoredClipMeta[];
  captions: StoredCaption[];
  capStyle?: Record<string, unknown>;
  savedAt: number;
  /** リール全体のカラーの雰囲気 (既定のリールスタジオ) */
  colorMood?: string;
  /** 字幕のフォントプリセット id (既定のリールスタジオ) */
  captionPresetId?: string;
}

/** 保存できなかった理由。画面には message をそのまま出せる日本語で入れる */
export type SaveFailReason = 'quota' | 'unavailable' | 'timeout' | 'unknown';

export type SaveResult =
  | { ok: true }
  | { ok: false; reason: SaveFailReason; message: string };

/** 例外から「なぜ保存できなかったか」を、そのまま画面に出せる日本語にする */
function toSaveFail(e: unknown): { ok: false; reason: SaveFailReason; message: string } {
  const name = (e as { name?: string } | null)?.name || '';
  const text = e instanceof Error ? e.message : String(e ?? '');
  if (name === 'QuotaExceededError' || /quota|容量/i.test(text)) {
    return {
      ok: false, reason: 'quota',
      message: 'この端末の空き容量が足りず、素材を保存できませんでした。',
    };
  }
  if (/非対応|ブロック/.test(text)) {
    return {
      ok: false, reason: 'unavailable',
      message: 'この端末では保存領域が使えませんでした（プライベートモードなど）。',
    };
  }
  if (/タイムアウト/.test(text)) {
    return {
      ok: false, reason: 'timeout',
      message: '保存に時間がかかりすぎたため、中断しました。',
    };
  }
  return {
    ok: false, reason: 'unknown',
    message: `保存できませんでした（${text || '原因不明'}）。`,
  };
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} がタイムアウトしました`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

function openDb(): Promise<IDBDatabase> {
  return withTimeout(new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB 非対応')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ASSETS)) db.createObjectStore(STORE_ASSETS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_PROJECT)) db.createObjectStore(STORE_PROJECT);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open 失敗'));
    req.onblocked = () => reject(new Error('IndexedDB がブロックされました'));
  }), 5000, 'ストレージを開く処理');
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('トランザクション失敗'));
    tx.onabort = () => reject(tx.error || new Error('トランザクション中断'));
  });
}

/** 素材 Blob を保存 (同じ assetId は上書き)。失敗しても throw せず理由を返す */
export async function putReelAsset(id: string, blob: Blob, name?: string): Promise<SaveResult> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_ASSETS, 'readwrite');
      tx.objectStore(STORE_ASSETS).put({ id, blob, name: name || '', type: blob.type || '' });
      await withTimeout(txDone(tx), 30000, '素材の保存');
      return { ok: true };
    } finally { db.close(); }
  } catch (e) { return toSaveFail(e); }
}

/** 素材 Blob を取得。無ければ null */
export async function getReelAsset(id: string): Promise<{ blob: Blob; name: string } | null> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_ASSETS, 'readonly');
      const req = tx.objectStore(STORE_ASSETS).get(id);
      const row = await withTimeout(new Promise<any>((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }), 15000, '素材の読み込み');
      if (!row || !(row.blob instanceof Blob)) return null;
      return { blob: row.blob, name: String(row.name || '') };
    } finally { db.close(); }
  } catch { return null; }
}

/** プロジェクト設定 (メタのみ・Blob 以外) を保存。失敗しても throw せず理由を返す */
export async function saveReelProject(p: StoredProject): Promise<SaveResult> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_PROJECT, 'readwrite');
      tx.objectStore(STORE_PROJECT).put(p, 'current');
      await withTimeout(txDone(tx), 10000, 'プロジェクトの保存');
      return { ok: true };
    } finally { db.close(); }
  } catch (e) { return toSaveFail(e); }
}

/** 保存済みプロジェクトのメタを取得 (無ければ null) */
export async function loadReelProject(): Promise<StoredProject | null> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_PROJECT, 'readonly');
      const req = tx.objectStore(STORE_PROJECT).get('current');
      const row = await withTimeout(new Promise<any>((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }), 10000, 'プロジェクトの読み込み');
      if (!row || !Array.isArray(row.clips)) return null;
      return row as StoredProject;
    } finally { db.close(); }
  } catch { return null; }
}

/** 使っていない素材を掃除 (プロジェクトに残っている assetId 以外を削除)
 *
 *  ⚠ 必ず saveReelProject が ok:true を返した後にだけ呼ぶこと。
 *  保存に失敗したまま掃除すると、保存済みプロジェクトはまだ古い assetId を指しているのに
 *  その実体を消してしまい、次回の復元で素材が欠ける (2026-08-01 に発見・修正)。 */
export async function pruneReelAssets(keepIds: string[]): Promise<void> {
  try {
    const keep = new Set(keepIds);
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_ASSETS, 'readwrite');
      const store = tx.objectStore(STORE_ASSETS);
      const req = store.getAllKeys();
      const keys = await withTimeout(new Promise<IDBValidKey[]>((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }), 10000, '素材一覧の取得');
      for (const k of keys) {
        if (!keep.has(String(k))) store.delete(k);
      }
      await withTimeout(txDone(tx), 15000, '素材の掃除');
    } finally { db.close(); }
  } catch { /* 掃除失敗は無害 */ }
}

/** 保存済みプロジェクト + 素材を全消去 */
export async function clearReelStore(): Promise<void> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction([STORE_ASSETS, STORE_PROJECT], 'readwrite');
      tx.objectStore(STORE_ASSETS).clear();
      tx.objectStore(STORE_PROJECT).clear();
      await withTimeout(txDone(tx), 10000, 'ストレージの消去');
    } finally { db.close(); }
  } catch { /* */ }
}
