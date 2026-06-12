// ============================================================
// Google ドキュメント連携 — ドキュメント本文をナレッジとして取り込む
//   ・Drive から Google ドキュメント一覧を取得
//   ・Docs API で本文テキストを抽出 → CORE のナレッジに登録
//   scope: drive.readonly (一覧) + documents.readonly (本文)
// ============================================================
import { requestGoogleToken, getValidGoogleToken, loadGoogleToken, clearGoogleToken, isGoogleConnected } from './googleAuth';

const DOCS_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/documents.readonly',
];
const STORE = 'docs';

export function isDocsConnected(): boolean { return isGoogleConnected(STORE); }
export function disconnectDocs() { clearGoogleToken(STORE); }
export async function connectDocs(): Promise<void> { await requestGoogleToken(DOCS_SCOPES, STORE); }

async function gfetch(url: string): Promise<any> {
  const token = loadGoogleToken(STORE) || await getValidGoogleToken(DOCS_SCOPES, STORE);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) { clearGoogleToken(STORE); throw new Error('ドキュメント認証の期限切れ。もう一度「連携」してください。'); }
  if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`Google API ${res.status}: ${t.slice(0, 160)}`); }
  return res.json();
}

export interface DriveDoc { id: string; name: string; modifiedTime: string; }

/** Google ドキュメント一覧（更新が新しい順）。folderId 指定で特定フォルダ内に限定可。 */
export async function listDocs(opts: { folderId?: string; max?: number } = {}): Promise<DriveDoc[]> {
  let q = "mimeType='application/vnd.google-apps.document' and trashed=false";
  if (opts.folderId) q += ` and '${opts.folderId}' in parents`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}`
    + `&orderBy=modifiedTime desc&pageSize=${opts.max ?? 30}&fields=files(id,name,modifiedTime)`;
  const data = await gfetch(url);
  return (data.files || []) as DriveDoc[];
}

/** ドキュメント本文をプレーンテキストで取得 */
export async function readDocText(fileId: string): Promise<{ title: string; text: string }> {
  const data = await gfetch(`https://docs.googleapis.com/v1/documents/${fileId}`);
  const title: string = data.title || '(無題のドキュメント)';
  const out: string[] = [];
  const content = data.body?.content || [];
  for (const el of content) {
    const para = el.paragraph;
    if (!para?.elements) continue;
    let line = '';
    for (const pe of para.elements) {
      const t = pe.textRun?.content;
      if (t) line += t;
    }
    if (line.trim()) out.push(line.replace(/\n+$/, ''));
  }
  return { title, text: out.join('\n').trim() };
}

/** フォルダ URL / 共有 URL から folderId / fileId を抽出 */
export function parseDriveId(url: string): { type: 'folder' | 'doc' | null; id: string | null } {
  if (!url) return { type: null, id: null };
  const folder = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folder) return { type: 'folder', id: folder[1] };
  const doc = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (doc) return { type: 'doc', id: doc[1] };
  return { type: null, id: null };
}
