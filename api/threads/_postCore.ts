// ============================================================
// api/threads/_postCore.ts — Threads 投稿の共通コア（画像対応）
//
// post.ts（いますぐ投稿）と cron/threads-scheduled-posts.ts（予約の自動投稿）が
// 同じロジックを使うための切り出し。x/_postCore.ts の作法に合わせる。
//
// 画像: posts[i] に対応する images[i] (公開URL) があれば media_type='IMAGE' で
// 作成する。画像コンテナは処理に時間がかかるため、公開は指数バックオフで再試行。
// ============================================================

import {
  TH_REFRESH,
  TH_THREADS,
  TH_PUBLISH,
  TOKEN_TTL,
  tokKey,
  type StoredThreadsToken,
} from './_shared';
import { kvGetJSON, kvSetJSON, kvDel } from '../_lib/upstash';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class ThreadsError extends Error {
  constructor(public code: string, public jpMessage: string, public httpStatus: number) {
    super(code);
  }
}

/** 有効なアクセストークンを返す。期限が近ければ refresh して保存。失効時は null。 */
export async function ensureThreadsToken(uid: string, tok: StoredThreadsToken): Promise<StoredThreadsToken | null> {
  if (tok.access_token && Date.now() < tok.expires_at - 24 * 60 * 60 * 1000) return tok;
  if (!tok.access_token) return null;

  const refreshUrl = `${TH_REFRESH}?grant_type=th_refresh_token&access_token=${encodeURIComponent(tok.access_token)}`;
  let res: Response;
  try {
    res = await fetch(refreshUrl, { method: 'GET' });
  } catch {
    return Date.now() < tok.expires_at ? tok : null;
  }
  if (!res.ok) {
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

/** 1 本の Threads を作成→公開し、公開済み thread id を返す。imageUrl があれば画像つき。失敗時は throw。 */
export async function publishOneThread(
  token: string,
  text: string,
  imageUrl: string | undefined,
  replyToId: string | undefined,
  idx: number,
): Promise<string> {
  // 1) 作成（creation_id 取得）。画像があれば IMAGE コンテナ。
  const createParams = new URLSearchParams({ access_token: token });
  if (imageUrl) {
    createParams.set('media_type', 'IMAGE');
    createParams.set('image_url', imageUrl);
    if (text) createParams.set('text', text);
  } else {
    createParams.set('media_type', 'TEXT');
    createParams.set('text', text);
  }
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
    const hint = imageUrl ? '画像URLが読み込めない可能性があります。画像を作り直すか、画像なしでお試しください。' : '少し時間をおいて再度お試しください。';
    throw new ThreadsError('post-failed', `Threadsの投稿作成に失敗しました（${idx + 1}本目 / コード${createRes.status}）。${hint}`, 502);
  }
  const created = (await createRes.json().catch(() => null)) as { id?: string } | null;
  const creationId = created?.id;
  if (!creationId) {
    throw new ThreadsError('post-failed', `Threadsから作成IDが返りませんでした（${idx + 1}本目）。`, 502);
  }

  // 2) 公開。画像コンテナは処理待ちが必要なことがあるため、指数バックオフで再試行する。
  //    (テキストは250ms、画像は2秒から。最大4回 ≒ 合計30秒まで待つ)
  const waits = imageUrl ? [2000, 4000, 8000, 16000] : [250, 2000, 4000];
  let lastErrText = '';
  for (let attempt = 0; attempt < waits.length; attempt++) {
    await sleep(waits[attempt]);
    const pubParams = new URLSearchParams({ creation_id: creationId, access_token: token });
    let pubRes: Response;
    try {
      pubRes = await fetch(`${TH_PUBLISH}?${pubParams.toString()}`, { method: 'POST' });
    } catch {
      lastErrText = 'network';
      continue;
    }
    if (pubRes.status === 401 || pubRes.status === 403) {
      throw new ThreadsError('reauth', '', pubRes.status);
    }
    if (pubRes.ok) {
      const published = (await pubRes.json().catch(() => null)) as { id?: string } | null;
      if (published?.id) return published.id;
      lastErrText = 'no-id';
      continue;
    }
    lastErrText = await pubRes.text().catch(() => '');
    // コンテナ未処理系はリトライ、その他即失敗にせず最後まで粘る（画像処理待ちが主因のため）
  }
  console.error('[threads post] publish failed after retries:', lastErrText.slice(0, 300));
  throw new ThreadsError('post-failed', `Threadsの公開に失敗しました（${idx + 1}本目）。${imageUrl ? '画像の処理に時間がかかっています。少し待ってから再度お試しください。' : '少し時間をおいて再度お試しください。'}`, 502);
}

export interface PostThreadsResult {
  ok: boolean;
  ids?: string[];
  urls?: string[];
  username?: string;
  error?: string;
  message?: string;
  httpStatus?: number;
  posted?: string[];
}

/**
 * uid のトークンで posts（＋任意の images）を連続スレッド投稿する。
 * images[i] は posts[i] に添付する公開画像URL（無ければテキストのみ）。
 */
export async function postThreadsForUid(uid: string, posts: string[], images?: (string | null | undefined)[]): Promise<PostThreadsResult> {
  let tok: StoredThreadsToken | null;
  try {
    tok = await kvGetJSON<StoredThreadsToken>(tokKey(uid));
  } catch {
    return { ok: false, error: 'storage-error', message: '連携情報の読み込みに失敗しました。時間をおいて再度お試しください。', httpStatus: 502 };
  }
  if (!tok || !tok.access_token) {
    return { ok: false, error: 'reauth', message: 'Threadsとの連携が見つかりません。もう一度「Threadsと連携」してください。', httpStatus: 401 };
  }

  let valid: StoredThreadsToken | null;
  try {
    valid = await ensureThreadsToken(uid, tok);
  } catch {
    return { ok: false, error: 'reauth', message: 'Threadsの認証更新に失敗しました。もう一度連携してください。', httpStatus: 401 };
  }
  if (!valid) {
    return { ok: false, error: 'reauth', message: 'Threadsの連携が期限切れです。もう一度「Threadsと連携」してください。', httpStatus: 401 };
  }

  const ids: string[] = [];
  let prevId: string | undefined;

  for (let i = 0; i < posts.length; i++) {
    const img = images?.[i] || undefined;
    try {
      const id = await publishOneThread(valid.access_token, posts[i], img, prevId, i);
      ids.push(id);
      prevId = id;
    } catch (e) {
      if (e instanceof ThreadsError) {
        if (e.code === 'reauth') {
          try { await kvDel(tokKey(uid)); } catch { /* */ }
          return { ok: false, error: 'reauth', message: 'Threadsの連携が無効になりました。お手数ですが、もう一度「Threadsと連携」してください。', httpStatus: e.httpStatus, posted: ids };
        }
        return { ok: false, error: e.code, message: e.jpMessage, httpStatus: e.httpStatus, posted: ids };
      }
      console.error('[threads post] unexpected error:', e);
      return { ok: false, error: 'post-failed', message: `Threadsへの投稿で予期しないエラーが発生しました（${i + 1}本目）。少し時間をおいて再度お試しください。`, httpStatus: 502, posted: ids };
    }
  }

  const username = valid.username;
  const urls = ids.map(() => (username ? `https://www.threads.net/@${username}` : 'https://www.threads.net'));
  return { ok: true, ids, urls, username };
}
