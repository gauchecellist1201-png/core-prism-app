// ============================================================
// POST /api/threads/post   body: { uid: string, posts: string[] }
//
// トークン読込 → 期限が近ければ th_refresh_token で更新し保存 →
// 1 本ずつ「作成(creation_id) → 公開(thread id)」の 2 ステップで投稿。
// 2 本目以降は reply_to_id=直前の公開済み id で連結＝返信チェーン。
//
// エラーは必ず日本語の意味あるメッセージ（silent fail 禁止）:
//   失効  → { error:'reauth' }
//   その他 → { error:'post-failed', message:'…' }
// ============================================================

export const config = { runtime: 'edge' };

import {
  TH_REFRESH,
  TH_THREADS,
  TH_PUBLISH,
  TOKEN_TTL,
  isThreadsConfigured,
  tokKey,
  jsonRes,
  type StoredThreadsToken,
} from './_shared';
import { isUpstashConfigured, kvGetJSON, kvSetJSON, kvDel } from '../_lib/upstash';

interface PostBody {
  uid?: string;
  posts?: unknown;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 有効なアクセストークンを返す。期限が近ければ refresh して保存。失効時は null。 */
async function ensureToken(uid: string, tok: StoredThreadsToken): Promise<StoredThreadsToken | null> {
  // 期限まで 1 日以上あればそのまま使う。
  if (tok.access_token && Date.now() < tok.expires_at - 24 * 60 * 60 * 1000) return tok;
  if (!tok.access_token) return null;

  // Threads の長期トークンは th_refresh_token で延命（要 24 時間以上経過のトークン）。
  const refreshUrl = `${TH_REFRESH}?grant_type=th_refresh_token&access_token=${encodeURIComponent(tok.access_token)}`;
  let res: Response;
  try {
    res = await fetch(refreshUrl, { method: 'GET' });
  } catch {
    // ネットワーク障害。期限が残っていれば現トークンで続行、切れていれば失効扱い。
    return Date.now() < tok.expires_at ? tok : null;
  }
  if (!res.ok) {
    // 既に切れていれば破棄して再認証へ。まだ期限内なら現トークンで続行。
    if (Date.now() >= tok.expires_at) {
      try { await kvDel(tokKey(uid)); } catch { /* */ }
      return null;
    }
    return tok;
  }
  const data = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
  if (!data?.access_token) {
    return Date.now() < tok.expires_at ? tok : null;
  }
  const next: StoredThreadsToken = {
    ...tok,
    access_token: data.access_token,
    expires_at: Date.now() + (Number(data.expires_in) || 60 * 60 * 24 * 60) * 1000,
  };
  await kvSetJSON(tokKey(uid), next, TOKEN_TTL);
  return next;
}

/** 1 本の Threads を作成→公開し、公開済み thread id を返す。失敗時は throw。 */
async function publishOne(
  token: string,
  text: string,
  replyToId: string | undefined,
  idx: number,
): Promise<string> {
  // 1) 作成（creation_id 取得）
  const createParams = new URLSearchParams({
    media_type: 'TEXT',
    text,
    access_token: token,
  });
  if (replyToId) createParams.set('reply_to_id', replyToId);

  let createRes: Response;
  try {
    createRes = await fetch(`${TH_THREADS}?${createParams.toString()}`, { method: 'POST' });
  } catch {
    throw new ThreadsError('network', `Threadsへの接続に失敗しました（${idx + 1}本目）。電波状況を確認して再度お試しください。`, 502);
  }
  if (createRes.status === 401 || createRes.status === 403) {
    throw new ThreadsError('reauth', '', createRes.status);
  }
  if (!createRes.ok) {
    const t = await createRes.text().catch(() => '');
    console.error('[threads post] create failed:', createRes.status, t.slice(0, 300));
    throw new ThreadsError('post-failed', `Threadsの投稿作成に失敗しました（${idx + 1}本目 / コード${createRes.status}）。少し時間をおいて再度お試しください。`, 502);
  }
  const created = (await createRes.json().catch(() => null)) as { id?: string } | null;
  const creationId = created?.id;
  if (!creationId) {
    throw new ThreadsError('post-failed', `Threadsから作成IDが返りませんでした（${idx + 1}本目）。`, 502);
  }

  // 作成と公開の間は少し待つ（Threads 側の処理待ち）。
  await sleep(250);

  // 2) 公開（thread id 取得）
  const pubParams = new URLSearchParams({ creation_id: creationId, access_token: token });
  let pubRes: Response;
  try {
    pubRes = await fetch(`${TH_PUBLISH}?${pubParams.toString()}`, { method: 'POST' });
  } catch {
    throw new ThreadsError('network', `Threadsへの接続に失敗しました（${idx + 1}本目の公開）。電波状況を確認して再度お試しください。`, 502);
  }
  if (pubRes.status === 401 || pubRes.status === 403) {
    throw new ThreadsError('reauth', '', pubRes.status);
  }
  if (!pubRes.ok) {
    const t = await pubRes.text().catch(() => '');
    console.error('[threads post] publish failed:', pubRes.status, t.slice(0, 300));
    throw new ThreadsError('post-failed', `Threadsの公開に失敗しました（${idx + 1}本目 / コード${pubRes.status}）。少し時間をおいて再度お試しください。`, 502);
  }
  const published = (await pubRes.json().catch(() => null)) as { id?: string } | null;
  const threadId = published?.id;
  if (!threadId) {
    throw new ThreadsError('post-failed', `Threadsから公開IDが返りませんでした（${idx + 1}本目）。投稿済みか確認してください。`, 502);
  }
  return threadId;
}

class ThreadsError extends Error {
  constructor(public code: string, public jpMessage: string, public httpStatus: number) {
    super(code);
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonRes({ error: 'method-not-allowed', message: 'POST で呼び出してください。' }, 405);
  if (!isThreadsConfigured() || !isUpstashConfigured()) {
    return jsonRes({ error: 'not-configured', message: 'Threadsの自動投稿はまだ設定されていません。' }, 503);
  }

  let parsed: PostBody;
  try {
    parsed = (await req.json()) as PostBody;
  } catch {
    return jsonRes({ error: 'bad-request', message: '送信データの形式が不正です。' }, 400);
  }

  const uid = (parsed.uid || '').trim();
  const posts = Array.isArray(parsed.posts)
    ? parsed.posts.map((t) => String(t ?? '').trim()).filter((t) => t.length > 0)
    : [];

  if (!uid) return jsonRes({ error: 'bad-request', message: 'uid がありません。' }, 400);
  if (posts.length === 0) return jsonRes({ error: 'empty', message: '投稿する本文がありません。' }, 400);
  if (posts.length > 25) return jsonRes({ error: 'too-many', message: 'スレッドは一度に25本までです。' }, 400);
  const tooLong = posts.findIndex((p) => p.length > 500);
  if (tooLong >= 0) {
    return jsonRes({ error: 'too-long', message: `${tooLong + 1}本目が500字を超えています。Threadsは1投稿500字までです。` }, 400);
  }

  let tok: StoredThreadsToken | null;
  try {
    tok = await kvGetJSON<StoredThreadsToken>(tokKey(uid));
  } catch {
    return jsonRes({ error: 'storage-error', message: '連携情報の読み込みに失敗しました。時間をおいて再度お試しください。' }, 502);
  }
  if (!tok || !tok.access_token) {
    return jsonRes({ error: 'reauth', message: 'Threadsとの連携が見つかりません。もう一度「Threadsと連携」してください。' }, 401);
  }

  let valid: StoredThreadsToken | null;
  try {
    valid = await ensureToken(uid, tok);
  } catch {
    return jsonRes({ error: 'reauth', message: 'Threadsの認証更新に失敗しました。もう一度連携してください。' }, 401);
  }
  if (!valid) {
    return jsonRes({ error: 'reauth', message: 'Threadsの連携が期限切れです。もう一度「Threadsと連携」してください。' }, 401);
  }

  const ids: string[] = [];
  let prevId: string | undefined;

  for (let i = 0; i < posts.length; i++) {
    try {
      const id = await publishOne(valid.access_token, posts[i], prevId, i);
      ids.push(id);
      prevId = id;
    } catch (e) {
      if (e instanceof ThreadsError) {
        if (e.code === 'reauth') {
          try { await kvDel(tokKey(uid)); } catch { /* */ }
          return jsonRes({
            error: 'reauth',
            message: 'Threadsの連携が無効になりました。お手数ですが、もう一度「Threadsと連携」してください。',
            posted: ids,
          }, e.httpStatus);
        }
        return jsonRes({ error: e.code, message: e.jpMessage, posted: ids }, e.httpStatus);
      }
      console.error('[threads post] unexpected error:', e);
      return jsonRes({
        error: 'post-failed',
        message: `Threadsへの投稿で予期しないエラーが発生しました（${i + 1}本目）。少し時間をおいて再度お試しください。`,
        posted: ids,
      }, 502);
    }
  }

  const username = valid.username;
  // permalink を取得できれば理想だが、追加 API を避け確実な URL を返す。
  const urls = ids.map(() =>
    username ? `https://www.threads.net/@${username}` : 'https://www.threads.net',
  );

  return jsonRes({ ok: true, ids, urls, username });
}
