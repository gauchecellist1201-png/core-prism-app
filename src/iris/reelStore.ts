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
const DB_VERSION = 2;
const STORE_ASSETS = 'assets';    // key: assetId, value: { id, blob, name, type }
const STORE_PROJECT = 'project';  // key: 'current' (いま開いている1本) / 'proj:<id>' (保存した1本ずつ)
// 「作ったリールが1本しか残らない」の解消 (2026-08-31)。
// 以前はこのストアがキー 'current' の1件しか持たず、2本目を作り始めた瞬間に
// 1本目の並び・尺・字幕が上書きで消えていた。素材の棚 (STORE_LIBRARY) は
// 残る作りなのに、組み上げた結果だけが残らなかった。
//   ・'current' は今までどおり「いま開いている1本」= 既存の保存データはそのまま読める
//     (DB のバージョンは上げない = 移行そのものを作らない = 作りかけを壊す道が無い)
//   ・保存した1本ずつは 'proj:<id>' に増えていく
const KEY_CURRENT = 'current';
const PROJ_PREFIX = 'proj:';
// 「棚」= 作っているリールとは無関係に残り続ける素材の一覧 (2026-08-03)。
// これが無かった頃は pruneReelAssets / clearReelStore が「いま編集中のリールに
// 使われていない素材」を全部消していたので、2 本目を作り始めるたびに
// カメラロールを開き直す＝毎回ゼロからやり直しになっていた。
const STORE_LIBRARY = 'library';  // key: assetId, value: LibraryItem

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
  /** このリールの id。'current' 1 件だけだった頃に保存したものには無い (任意) */
  id?: string;
  /** 一覧に出す見出し。無ければ保存時刻から作る */
  title?: string;
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
  // 原文は判定にだけ使う (人に見せるのは下の日本語だけ)
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
      if (!db.objectStoreNames.contains(STORE_LIBRARY)) db.createObjectStore(STORE_LIBRARY, { keyPath: 'id' });
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
      const store = tx.objectStore(STORE_PROJECT);
      // 「いま開いている1本」は今までどおり 'current'。ここを変えないので、
      // これまでの保存データも、古いコードも、そのまま読める。
      store.put(p, KEY_CURRENT);
      // id を持つものは「保存した1本」としても残す = 2本目を始めても消えない
      if (p.id) store.put(p, PROJ_PREFIX + p.id);
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
      const req = tx.objectStore(STORE_PROJECT).get(KEY_CURRENT);
      const row = await withTimeout(new Promise<any>((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }), 10000, 'プロジェクトの読み込み');
      if (!row || !Array.isArray(row.clips)) return null;
      return row as StoredProject;
    } finally { db.close(); }
  } catch { return null; }
}

// ============================================================
// 作ったリールの棚 (2026-08-31) — 「1本しか残らない」の解消
//
// Canva が仕事で使えるのは「過去に作ったものが全部そこにある」から。
// ここは名前・更新時刻・1枚目のサムネだけの薄い一覧で足りる。
// 保存は今までどおり自動 (「保存」ボタンは増やさない)。
// ============================================================

/** 一覧に出すぶんだけの見出し (clips は持たない) */
export interface ReelProjectSummary {
  id: string;
  title: string;
  savedAt: number;
  /** カットの枚数 (実測値。0 件のものは一覧に出さない) */
  clipCount: number;
  /** 1 枚目のカットのサムネ。棚に載っていない素材では付かない (無ければ出さない) */
  thumb?: string;
}

/** 新しいリールの id を作る (端末の中だけで使う) */
export function newReelProjectId(): string {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** 保存時刻から見出しを作る (名前を付けさせない = 手数を増やさない) */
export function defaultReelTitle(savedAt: number): string {
  const d = new Date(savedAt);
  return `${d.getMonth() + 1}/${d.getDate()} のリール`;
}

/** 保存時刻を「いつのものか」が一目で分かる短い日本語にする */
export function reelSavedLabel(savedAt: number, now: number = Date.now()): string {
  if (!savedAt) return '';
  const d = new Date(savedAt);
  const today = new Date(now);
  const isToday = d.getFullYear() === today.getFullYear()
    && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return isToday ? `今日 ${hm}` : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

/** 保存したリールの一覧 (新しい順)。読めなければ空配列 */
export async function listReelProjects(): Promise<ReelProjectSummary[]> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction([STORE_PROJECT, STORE_LIBRARY], 'readonly');
      const keyReq = tx.objectStore(STORE_PROJECT).getAllKeys();
      const valReq = tx.objectStore(STORE_PROJECT).getAll();
      const libReq = tx.objectStore(STORE_LIBRARY).getAll();
      const keys = await withTimeout(new Promise<IDBValidKey[]>((resolve, reject) => {
        keyReq.onsuccess = () => resolve(keyReq.result || []);
        keyReq.onerror = () => reject(keyReq.error);
      }), 10000, '保存したリールの一覧');
      const vals = await withTimeout(new Promise<any[]>((resolve, reject) => {
        valReq.onsuccess = () => resolve(valReq.result || []);
        valReq.onerror = () => reject(valReq.error);
      }), 10000, '保存したリールの読み込み');
      const libRows = await withTimeout(new Promise<any[]>((resolve, reject) => {
        libReq.onsuccess = () => resolve(libReq.result || []);
        libReq.onerror = () => reject(libReq.error);
      }), 10000, '棚の読み込み');
      const thumbs = new Map<string, string>();
      for (const r of libRows) {
        if (r && typeof r.id === 'string' && typeof r.thumb === 'string' && r.thumb) thumbs.set(r.id, r.thumb);
      }
      return summarizeProjects(keys, vals, thumbs);
    } finally { db.close(); }
  } catch { return []; }
}

/** キーと中身から一覧を組み立てる (画面を通さずに固定したいので切り出す) */
export function summarizeProjects(
  keys: IDBValidKey[], vals: any[], thumbs: Map<string, string>,
): ReelProjectSummary[] {
  const out: ReelProjectSummary[] = [];
  for (let i = 0; i < keys.length; i++) {
    const key = String(keys[i]);
    // 'current' (いま開いている1本) は一覧に出さない = 同じものが2つ並ばない
    if (!key.startsWith(PROJ_PREFIX)) continue;
    const row = vals[i];
    if (!row || !Array.isArray(row.clips) || !row.clips.length) continue;
    const savedAt = Number(row.savedAt) || 0;
    const firstId = typeof row.clips[0]?.assetId === 'string' ? row.clips[0].assetId : '';
    out.push({
      id: String(row.id || key.slice(PROJ_PREFIX.length)),
      title: String(row.title || defaultReelTitle(savedAt)),
      savedAt,
      clipCount: row.clips.length,
      thumb: (firstId && thumbs.get(firstId)) || undefined,
    });
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

/** 保存したリールを1本読む (無ければ null) */
export async function loadReelProjectById(id: string): Promise<StoredProject | null> {
  if (!id) return null;
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_PROJECT, 'readonly');
      const req = tx.objectStore(STORE_PROJECT).get(PROJ_PREFIX + id);
      const row = await withTimeout(new Promise<any>((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }), 10000, 'リールの読み込み');
      if (!row || !Array.isArray(row.clips)) return null;
      return row as StoredProject;
    } finally { db.close(); }
  } catch { return null; }
}

/** 消したリールを戻す (取り消し用)。'current' には触らない —
 *  ここで 'current' まで書くと、いま開いている別のリールを奪ってしまう。 */
export async function restoreReelProject(p: StoredProject): Promise<SaveResult> {
  if (!p?.id) return { ok: false, reason: 'unknown', message: '戻す先が分からず、元に戻せませんでした。' };
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_PROJECT, 'readwrite');
      tx.objectStore(STORE_PROJECT).put(p, PROJ_PREFIX + p.id);
      await withTimeout(txDone(tx), 10000, 'リールの復帰');
      return { ok: true };
    } finally { db.close(); }
  } catch (e) { return toSaveFail(e); }
}

/** 保存したリールを1本消す。いま開いているのが同じものなら 'current' も消す。
 *  素材 (Blob) は消さない — 消えたら取り消せなくなるので、掃除は呼び出し側の判断に任せる。 */
export async function deleteReelProject(id: string): Promise<SaveResult> {
  if (!id) return { ok: true };
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_PROJECT, 'readwrite');
      const store = tx.objectStore(STORE_PROJECT);
      const curReq = store.get(KEY_CURRENT);
      await new Promise<void>((resolve, reject) => {
        curReq.onsuccess = () => {
          const cur = curReq.result as StoredProject | undefined;
          if (cur && cur.id === id) store.delete(KEY_CURRENT);
          resolve();
        };
        curReq.onerror = () => reject(curReq.error);
      });
      store.delete(PROJ_PREFIX + id);
      await withTimeout(txDone(tx), 10000, 'リールの削除');
      return { ok: true };
    } finally { db.close(); }
  } catch (e) { return toSaveFail(e); }
}

/** 使っていない素材を掃除 (プロジェクトにも棚にも残っていない assetId を削除)
 *
 *  ⚠ 必ず saveReelProject が ok:true を返した後にだけ呼ぶこと。
 *  保存に失敗したまま掃除すると、保存済みプロジェクトはまだ古い assetId を指しているのに
 *  その実体を消してしまい、次回の復元で素材が欠ける (2026-08-01 に発見・修正)。
 *
 *  ⚠ 棚 (STORE_LIBRARY) にある素材は絶対に消さない (2026-08-03)。
 *  ここを「いま編集中のリールだけ残す」にしていたので、素材が貯まらなかった。
 *  棚から消すのはユーザーが自分で選んだ時だけ (deleteLibraryItems)。 */
export async function pruneReelAssets(keepIds: string[]): Promise<void> {
  try {
    const keep = new Set(keepIds);
    const db = await openDb();
    try {
      const tx = db.transaction([STORE_ASSETS, STORE_LIBRARY, STORE_PROJECT], 'readwrite');
      const store = tx.objectStore(STORE_ASSETS);
      const libReq = tx.objectStore(STORE_LIBRARY).getAllKeys();
      const projReq = tx.objectStore(STORE_PROJECT).getAll();
      const libKeys = await withTimeout(new Promise<IDBValidKey[]>((resolve, reject) => {
        libReq.onsuccess = () => resolve(libReq.result);
        libReq.onerror = () => reject(libReq.error);
      }), 10000, '棚の一覧の取得');
      for (const k of libKeys) keep.add(String(k));
      // 保存した「他のリール」が使っている素材も必ず残す (2026-08-31)。
      // ここを見ないと、2本目を保存した瞬間に 1本目の素材が掃除で消え、
      // 一覧には並ぶのに開くと中身が無い = いちばん質の悪い残り方になる。
      const projRows = await withTimeout(new Promise<any[]>((resolve, reject) => {
        projReq.onsuccess = () => resolve(projReq.result || []);
        projReq.onerror = () => reject(projReq.error);
      }), 10000, '保存したリール一覧の取得');
      for (const id of projectAssetIds(projRows)) keep.add(id);
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

/** 保存されているリール全部が使っている assetId を集める (掃除で消さないため) */
function projectAssetIds(rows: any[]): string[] {
  const out: string[] = [];
  for (const row of rows || []) {
    if (!row || !Array.isArray(row.clips)) continue;
    for (const c of row.clips) {
      if (c && typeof c.assetId === 'string' && c.assetId) out.push(c.assetId);
    }
  }
  return out;
}

/** 「いま作りかけのリール」を消す。棚の素材は残す (2026-08-03)。
 *
 *  以前はここで assets を丸ごと clear していたため、クリップを全部消した瞬間に
 *  過去の素材まで消えていた。棚の目的は「消えないこと」なので、消すのは
 *  プロジェクト設定と、棚に載っていない素材だけにする。 */
export async function clearReelStore(): Promise<void> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction([STORE_ASSETS, STORE_PROJECT, STORE_LIBRARY], 'readwrite');
      const assets = tx.objectStore(STORE_ASSETS);
      const proj = tx.objectStore(STORE_PROJECT);
      // 消すのは「いま開いている1本」だけ。保存した過去のリールは残す (2026-08-31)。
      // 以前はここで clear() = ストアごと空にしていたので、クリップを全部消した瞬間に
      // それまでに作ったリールが全部消えていた。
      proj.delete(KEY_CURRENT);
      const libReq = tx.objectStore(STORE_LIBRARY).getAllKeys();
      const projReq = proj.getAll();
      const libKeys = await withTimeout(new Promise<IDBValidKey[]>((resolve, reject) => {
        libReq.onsuccess = () => resolve(libReq.result);
        libReq.onerror = () => reject(libReq.error);
      }), 10000, '棚の一覧の取得');
      const keep = new Set(libKeys.map(String));
      const projRows = await withTimeout(new Promise<any[]>((resolve, reject) => {
        projReq.onsuccess = () => resolve(projReq.result || []);
        projReq.onerror = () => reject(projReq.error);
      }), 10000, '保存したリール一覧の取得');
      for (const id of projectAssetIds(projRows)) keep.add(id);
      const req = assets.getAllKeys();
      const keys = await withTimeout(new Promise<IDBValidKey[]>((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }), 10000, '素材一覧の取得');
      for (const k of keys) { if (!keep.has(String(k))) assets.delete(k); }
      await withTimeout(txDone(tx), 10000, 'ストレージの消去');
    } finally { db.close(); }
  } catch { /* */ }
}

// ============================================================
// 棚 (Media Library) — 作っているリールと無関係に残り続ける素材
// ============================================================

export interface LibraryItem {
  /** assets ストアの Blob を指す id (= clip.assetId) */
  id: string;
  name: string;
  kind: 'image' | 'video';
  /** MIME (空のことがある) */
  type: string;
  /** バイト数。棚の使用量を「実測値だけ」で出すために持つ */
  size: number;
  addedAt: number;
  /** 書き出したリールで実際に使った回数 (0 = まだ一度も使っていない) */
  usedCount: number;
  lastUsedAt?: number;
  /** 小さなサムネイル (dataURL)。棚を開いた瞬間に見えるようにするためのもの */
  thumb?: string;
}

/** 棚に素材を1件足す (Blob は assets、見出しは library に入れる)。
 *  すでに同じ id があれば usedCount を保ったまま上書きする。 */
export async function putLibraryItem(item: LibraryItem, blob: Blob): Promise<SaveResult> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction([STORE_ASSETS, STORE_LIBRARY], 'readwrite');
      tx.objectStore(STORE_ASSETS).put({ id: item.id, blob, name: item.name || '', type: blob.type || '' });
      const lib = tx.objectStore(STORE_LIBRARY);
      const getReq = lib.get(item.id);
      await new Promise<void>((resolve, reject) => {
        getReq.onsuccess = () => {
          const prev = getReq.result as LibraryItem | undefined;
          lib.put(prev ? { ...item, usedCount: prev.usedCount ?? 0, lastUsedAt: prev.lastUsedAt, addedAt: prev.addedAt ?? item.addedAt } : item);
          resolve();
        };
        getReq.onerror = () => reject(getReq.error);
      });
      await withTimeout(txDone(tx), 30000, '棚への保存');
      return { ok: true };
    } finally { db.close(); }
  } catch (e) { return toSaveFail(e); }
}

/** 棚の一覧 (新しい順)。読めなければ空配列 (画面は「空の棚」を出す) */
export async function listLibrary(): Promise<LibraryItem[]> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_LIBRARY, 'readonly');
      const req = tx.objectStore(STORE_LIBRARY).getAll();
      const rows = await withTimeout(new Promise<any[]>((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      }), 10000, '棚の読み込み');
      return (rows as LibraryItem[])
        .filter(r => r && typeof r.id === 'string')
        .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    } finally { db.close(); }
  } catch { return []; }
}

/** 書き出したリールで使った素材に「使った」印をつける (同じ絵を続けて使わないため) */
export async function markLibraryUsed(ids: string[]): Promise<void> {
  if (!ids.length) return;
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_LIBRARY, 'readwrite');
      const lib = tx.objectStore(STORE_LIBRARY);
      const now = Date.now();
      for (const id of Array.from(new Set(ids))) {
        const req = lib.get(id);
        // eslint-disable-next-line no-loop-func
        req.onsuccess = () => {
          const row = req.result as LibraryItem | undefined;
          if (row) lib.put({ ...row, usedCount: (row.usedCount || 0) + 1, lastUsedAt: now });
        };
      }
      await withTimeout(txDone(tx), 10000, '使用記録の保存');
    } finally { db.close(); }
  } catch { /* 印が付かないだけ。本体は壊さない */ }
}

/** 棚から素材を消す。いま編集中のリールが使っているものは Blob を残す
 *  (棚から外れても、編集中の画面から素材が消えたら事故になる)。 */
export async function deleteLibraryItems(ids: string[], keepBlobIds: string[] = []): Promise<void> {
  if (!ids.length) return;
  try {
    const keep = new Set(keepBlobIds);
    const db = await openDb();
    try {
      const tx = db.transaction([STORE_ASSETS, STORE_LIBRARY], 'readwrite');
      const assets = tx.objectStore(STORE_ASSETS);
      const lib = tx.objectStore(STORE_LIBRARY);
      for (const id of ids) {
        lib.delete(id);
        if (!keep.has(id)) assets.delete(id);
      }
      await withTimeout(txDone(tx), 15000, '棚の整理');
    } finally { db.close(); }
  } catch { /* */ }
}
