// ============================================================
// CORE Prism — Google ドライブ「まるごと」取り込み
//
// ★なぜこれを作ったか（2026-08-02 オーナー要望の根治）
//   これまでのドライブ連携は `src/lib/gdocs.ts` の listDocs だけで、
//     ・Google ドキュメント **だけ**（スプレッドシート/スライド/PDF/Word/Excel は対象外）
//     ・最大 30 件・ページ送りなし
//     ・フォルダの中の中（入れ子）は辿らない
//     ・1件ずつ手で「取り込む」を押す
//   という三重の天井があった。「全部読み込んだ上で判断する秘書」には届かない。
//
//   このファイルは、ドライブの中身を **種類を問わず・入れ子も辿って・全件**
//   テキスト化し、既存のナレッジ取り込み経路（parseFile → chunk → 保存）に
//   そのまま流し込む。Google 形式は export、それ以外は実体をダウンロードして
//   既存の fileParser（PDF/Word/Excel/PowerPoint/CSV/テキスト）に渡す。
//
// ★読めなかったものを黙って捨てない
//   スキップは必ず理由つきで数え、呼び出し側に返す（silent fail 禁止）。
// ============================================================
import { requestGoogleToken, getValidGoogleToken, loadGoogleToken, clearGoogleToken } from './googleAuth';

/** ドライブを読むのに必要な許可。閲覧のみ（書き込み権限は要求しない）。 */
export const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const STORE = 'docs'; // 既存のドキュメント連携とトークン保管を共有する

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const SHORTCUT_MIME = 'application/vnd.google-apps.shortcut';

/** 1ファイルの上限。これを超えるものは理由つきでスキップする。 */
const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** 一度の取り込みで扱う上限。ドライブが巨大でも端末が固まらないようにする。 */
export const DRIVE_SCAN_HARD_CAP = 3000;

export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: number;
  webViewLink?: string;
  /** ルートからのフォルダ経路（「00-CORE/Prism/資料.pdf」のように出典を示すため） */
  path?: string;
}

export type SkipReason =
  | 'フォルダ'
  | 'サイズ超過'
  | '画像・動画・音声'
  | '取り込み済み'
  | '中身が空'
  | '未対応の形式'
  | '読み取り失敗';

export interface DriveSkipped {
  name: string;
  reason: SkipReason;
  detail?: string;
}

// ── 認証 ────────────────────────────────────────────────
// ★ドライブ閲覧は Google の「制限付きスコープ」。カレンダー連携（サーバー保管の
//   refresh_token）に混ぜると、審査が通るまでカレンダーごと弾かれる恐れがあるため、
//   ドライブだけは押した人に個別に許可を求める（api/google/_shared.ts のコメント参照）。
let cachedToken: string | null = null;

async function acquireToken(): Promise<string> {
  const token = loadGoogleToken(STORE) || (await getValidGoogleToken(DRIVE_SCOPES, STORE));
  cachedToken = token;
  return token;
}

/** ドライブに触れる状態か（すでに許可済みか）を、許可画面を出さずに判定する。 */
export async function isDriveReady(): Promise<boolean> {
  return Boolean(loadGoogleToken(STORE));
}

/** 明示的に許可を取りに行く（ボタンから呼ぶ）。 */
export async function connectDrive(): Promise<void> {
  await requestGoogleToken(DRIVE_SCOPES, STORE);
  cachedToken = null;
}

async function driveFetch(url: string, asBlob = false, retried = false): Promise<any> {
  const token = cachedToken || (await acquireToken());
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if ((res.status === 401 || res.status === 403) && !retried) {
    // 期限切れ、またはドライブの許可が付いていないトークン。取り直して 1 回だけ再試行。
    clearGoogleToken(STORE);
    cachedToken = null;
    await acquireToken();
    return driveFetch(url, asBlob, true);
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error('Google ドライブを読む許可がありません。もう一度「連携」を押し、同意画面で最後まで「許可」してください。');
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Google ドライブ API ${res.status}: ${t.slice(0, 160)}`);
  }
  return asBlob ? res.blob() : res.json();
}

// ── 一覧（ページ送りで全件・入れ子フォルダも辿る） ──────────
const LIST_FIELDS = 'nextPageToken,files(id,name,mimeType,modifiedTime,size,webViewLink)';

async function listPage(q: string, pageToken?: string): Promise<{ files: DriveFileMeta[]; nextPageToken?: string }> {
  const params = new URLSearchParams({
    q,
    fields: LIST_FIELDS,
    pageSize: '1000',
    orderBy: 'modifiedTime desc',
    spaces: 'drive',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  if (pageToken) params.set('pageToken', pageToken);
  const data = await driveFetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`);
  const files = (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedTime: f.modifiedTime,
    size: f.size ? Number(f.size) : undefined,
    webViewLink: f.webViewLink,
  })) as DriveFileMeta[];
  return { files, nextPageToken: data.nextPageToken };
}

/**
 * ドライブの中身を全件返す。
 * folderId を渡すとそのフォルダの**中の中まで**（入れ子を辿って）返す。
 * 渡さないとマイドライブ全体（共有されたものを含む）。
 */
export async function listAllDriveFiles(opts: {
  folderId?: string;
  max?: number;
  onProgress?: (found: number, scanning: string) => void;
  signal?: AbortSignal;
} = {}): Promise<DriveFileMeta[]> {
  const max = Math.min(opts.max ?? DRIVE_SCAN_HARD_CAP, DRIVE_SCAN_HARD_CAP);
  const out: DriveFileMeta[] = [];

  const push = (f: DriveFileMeta) => { if (out.length < max) out.push(f); };

  if (!opts.folderId) {
    let token: string | undefined;
    do {
      if (opts.signal?.aborted) break;
      const page = await listPage(`trashed=false and mimeType!='${FOLDER_MIME}'`, token);
      for (const f of page.files) push(f);
      opts.onProgress?.(out.length, 'マイドライブ');
      token = page.nextPageToken;
    } while (token && out.length < max);
    return out;
  }

  // フォルダ指定 — 幅優先で入れ子を辿る
  const queue: { id: string; path: string }[] = [{ id: opts.folderId, path: '' }];
  const visited = new Set<string>();
  while (queue.length > 0 && out.length < max) {
    if (opts.signal?.aborted) break;
    const cur = queue.shift()!;
    if (visited.has(cur.id)) continue;
    visited.add(cur.id);

    let token: string | undefined;
    do {
      const page = await listPage(`'${cur.id}' in parents and trashed=false`, token);
      for (const f of page.files) {
        if (f.mimeType === FOLDER_MIME) {
          queue.push({ id: f.id, path: cur.path ? `${cur.path}/${f.name}` : f.name });
        } else {
          push({ ...f, path: cur.path });
        }
      }
      opts.onProgress?.(out.length, cur.path || 'フォルダ');
      token = page.nextPageToken;
    } while (token && out.length < max);
  }
  return out;
}

// ── 1ファイルをテキスト化できる形（File）に変換 ───────────
// Google 形式は export、実体ファイルはダウンロード。
// どちらも既存の fileParser がそのまま扱える File にして返す。

interface Conversion { exportMime?: string; ext: string }

/** 取り込み方を決める。null は「テキストにできない」= 理由つきスキップ。 */
function planConversion(f: DriveFileMeta): Conversion | { skip: SkipReason } {
  const m = f.mimeType || '';
  if (m === FOLDER_MIME) return { skip: 'フォルダ' };
  if (m === SHORTCUT_MIME) return { skip: '未対応の形式' };

  // Google 形式 → 既存パーサが読める形式へ書き出す
  if (m === 'application/vnd.google-apps.document') return { exportMime: 'text/plain', ext: 'txt' };
  if (m === 'application/vnd.google-apps.presentation') return { exportMime: 'text/plain', ext: 'txt' };
  if (m === 'application/vnd.google-apps.spreadsheet') {
    // CSV で書き出すと**先頭シートしか出ない**。xlsx で書き出して全シート読む。
    return { exportMime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' };
  }
  if (m === 'application/vnd.google-apps.script') return { exportMime: 'application/vnd.google-apps.script+json', ext: 'json' };
  if (m.startsWith('application/vnd.google-apps.')) return { skip: '未対応の形式' }; // 図形描画・フォーム・サイト等

  if (m.startsWith('image/') || m.startsWith('video/') || m.startsWith('audio/')) return { skip: '画像・動画・音声' };

  const ext = (f.name.split('.').pop() || '').toLowerCase();
  const READABLE = new Set([
    'pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'csv', 'tsv',
    'txt', 'md', 'markdown', 'json', 'html', 'htm', 'xml', 'yaml', 'yml',
    'log', 'rtf', 'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'kt',
    'swift', 'c', 'cpp', 'h', 'css', 'scss', 'sql', 'sh',
  ]);
  if (READABLE.has(ext)) return { ext };
  if (m.startsWith('text/') || m === 'application/json') return { ext: ext || 'txt' };
  return { skip: '未対応の形式' };
}

function fileNameFor(f: DriveFileMeta, ext: string): string {
  const has = f.name.toLowerCase().endsWith(`.${ext}`);
  return has ? f.name : `${f.name}.${ext}`;
}

/** ドライブの1件を File にして返す。読めないものは理由を返す。 */
export async function fetchDriveFile(f: DriveFileMeta): Promise<{ file: File } | { skip: SkipReason; detail?: string }> {
  const plan = planConversion(f);
  if ('skip' in plan) return { skip: plan.skip };
  if (f.size && f.size > MAX_FILE_BYTES) {
    return { skip: 'サイズ超過', detail: `${Math.round(f.size / 1024 / 1024)}MB` };
  }

  try {
    const url = plan.exportMime
      ? `https://www.googleapis.com/drive/v3/files/${f.id}/export?mimeType=${encodeURIComponent(plan.exportMime)}`
      : `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&supportsAllDrives=true`;
    const blob: Blob = await driveFetch(url, true);
    if (blob.size > MAX_FILE_BYTES) return { skip: 'サイズ超過', detail: `${Math.round(blob.size / 1024 / 1024)}MB` };
    const name = fileNameFor(f, plan.ext);
    return { file: new File([blob], name, { type: blob.type || 'application/octet-stream' }) };
  } catch (e) {
    return { skip: '読み取り失敗', detail: e instanceof Error ? e.message : String(e) };
  }
}

// ── まるごと取り込み ────────────────────────────────────
export interface DriveIngestProgress {
  phase: 'listing' | 'downloading' | 'reading' | 'done';
  found: number;
  done: number;
  total: number;
  currentName: string;
}

export interface DriveIngestResult {
  found: number;
  added: number;
  skipped: DriveSkipped[];
  /** ドライブが上限より大きく、途中で打ち切ったか */
  capped: boolean;
}

/**
 * ドライブの中身を全件テキスト化し、batch ごとに sink（＝既存の一括取り込み）へ渡す。
 *
 * 逐次ダウンロード → 8件たまったら渡す、を繰り返す。
 * 全部をメモリに載せてから渡すと、数百件で端末が落ちるため。
 */
export async function ingestDriveAll(opts: {
  folderId?: string;
  /** すでに取り込み済みのキー（`名前::サイズ`）。二重取り込みを避ける。 */
  existingKeys?: Set<string>;
  sink: (files: File[]) => Promise<{ added: number; skipped: number; failed: number }>;
  onProgress?: (p: DriveIngestProgress) => void;
  signal?: AbortSignal;
  max?: number;
}): Promise<DriveIngestResult> {
  const skipped: DriveSkipped[] = [];
  const report = (p: Partial<DriveIngestProgress> & { phase: DriveIngestProgress['phase'] }) =>
    opts.onProgress?.({ found: 0, done: 0, total: 0, currentName: '', ...p });

  report({ phase: 'listing' });
  const list = await listAllDriveFiles({
    folderId: opts.folderId,
    max: opts.max,
    signal: opts.signal,
    onProgress: (found, scanning) => report({ phase: 'listing', found, currentName: scanning }),
  });

  const total = list.length;
  const capped = total >= Math.min(opts.max ?? DRIVE_SCAN_HARD_CAP, DRIVE_SCAN_HARD_CAP);
  let added = 0;
  let done = 0;
  let batch: File[] = [];
  const seen = new Set(opts.existingKeys ?? []);

  const flush = async () => {
    if (batch.length === 0) return;
    const res = await opts.sink(batch);
    added += res.added;
    batch = [];
  };

  for (const f of list) {
    if (opts.signal?.aborted) break;
    done++;
    report({ phase: 'downloading', found: total, done, total, currentName: f.name });

    const got = await fetchDriveFile(f);
    if ('skip' in got) { skipped.push({ name: f.name, reason: got.skip, detail: got.detail }); continue; }

    const key = `${got.file.name}::${got.file.size}`;
    if (seen.has(key)) { skipped.push({ name: f.name, reason: '取り込み済み' }); continue; }
    seen.add(key);

    batch.push(got.file);
    if (batch.length >= 8) {
      report({ phase: 'reading', found: total, done, total, currentName: f.name });
      await flush();
    }
  }
  await flush();

  report({ phase: 'done', found: total, done, total, currentName: '' });
  return { found: total, added, skipped, capped };
}

/** スキップ理由を「何件が、なぜ入らなかったか」の一文にまとめる（黙って捨てない）。 */
export function summarizeSkips(skipped: DriveSkipped[]): string {
  if (skipped.length === 0) return '';
  const byReason = new Map<SkipReason, number>();
  for (const s of skipped) byReason.set(s.reason, (byReason.get(s.reason) ?? 0) + 1);
  const parts = Array.from(byReason.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([reason, n]) => `${reason} ${n}件`);
  return `読み込めなかったもの: ${parts.join(' / ')}`;
}

/** フォルダ URL からフォルダ ID を取り出す（共有 URL / マイドライブ URL 両対応）。 */
export function parseDriveFolderId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  const d = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (d) return d[1];
  // ID をそのまま貼られた場合
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url.trim())) return url.trim();
  return null;
}
