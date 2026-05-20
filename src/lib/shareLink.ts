// ============================================================
// shareLink — サーバー不要で「成果物の共有リンク」を作る軽量ヘルパー
// 成果物を JSON にして base64 で URL ハッシュに載せる
// ============================================================

export type SharedArtifactKind = 'text' | 'image' | 'reel' | 'post' | 'invoice' | 'slide';

export interface SharedArtifact {
  kind: SharedArtifactKind;
  title: string;
  body?: string;
  imageUrl?: string;
  createdBy?: string;
  source?: 'prism' | 'iris';
  createdAt?: string;
}

const HASH_PREFIX = '#share=';
const MAX_PAYLOAD_BYTES = 8 * 1024; // 8 KB を超えたら URL に載せない (本文は省略する)

function utf8ToBase64Url(s: string): string {
  if (typeof window === 'undefined') return '';
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUtf8(s: string): string {
  if (typeof window === 'undefined') return '';
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** 成果物を共有 URL にする。本文が長すぎる場合は冒頭だけ載せる */
export function buildShareUrl(artifact: SharedArtifact, opts: { origin?: string } = {}): string {
  const origin = opts.origin || (typeof window !== 'undefined' ? window.location.origin : 'https://core-prism-app.vercel.app');
  let body = artifact.body;
  let safe: SharedArtifact = { ...artifact, body };
  let encoded = utf8ToBase64Url(JSON.stringify(safe));
  if (encoded.length > MAX_PAYLOAD_BYTES && body) {
    const sliced = body.slice(0, 1200) + '\n\n…続きはアプリでご覧ください。';
    safe = { ...artifact, body: sliced };
    encoded = utf8ToBase64Url(JSON.stringify(safe));
  }
  return `${origin}/?${HASH_PREFIX.slice(1)}${encoded}`;
}

/** 現在の URL に共有リンクが含まれていれば成果物を取り出す */
export function readSharedFromUrl(): SharedArtifact | null {
  if (typeof window === 'undefined') return null;
  const search = window.location.search;
  // ?share=... (推奨 — フラグメントだとアナリティクスで失われる端末がある)
  const m = search.match(/[?&]share=([^&]+)/);
  if (m) {
    try { return JSON.parse(base64UrlToUtf8(decodeURIComponent(m[1]))) as SharedArtifact; }
    catch { return null; }
  }
  // 互換: ハッシュ
  const h = window.location.hash;
  if (h.startsWith(HASH_PREFIX)) {
    try { return JSON.parse(base64UrlToUtf8(h.slice(HASH_PREFIX.length))) as SharedArtifact; }
    catch { return null; }
  }
  return null;
}

/** Web Share API で「シェア」、対応していなければクリップボードへコピー */
export async function shareOrCopy(url: string, title: string, text?: string): Promise<'shared' | 'copied' | 'failed'> {
  if (typeof navigator === 'undefined') return 'failed';
  const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
  if (nav.share) {
    try {
      await nav.share({ title, text, url });
      return 'shared';
    } catch {
      /* user cancelled — フォールバックに進む */
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
