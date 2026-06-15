// ============================================================
// POST /api/x/post   body: { uid: string, tweets: string[] }
//
// トークン読込 → 期限切れなら refresh_token で更新し保存 →
// POST https://api.twitter.com/2/tweets を順に投稿（2本目以降は
// reply.in_reply_to_tweet_id で前の id に連結＝スレッド）→
// 投稿 id 配列と URL を返す。
//
// エラーは必ず日本語の意味あるメッセージ（silent fail 禁止）:
//   401/403 (失効) → { error:'reauth' }
//   429        → { error:'rate', message:'…無料枠は月500件…' }
// ============================================================

export const config = { runtime: 'edge' };

import {
  X_TOKEN,
  X_TWEETS,
  TOKEN_TTL,
  getClientId,
  isXConfigured,
  basicAuthHeader,
  tokKey,
  jsonRes,
  type StoredXToken,
} from './_shared';
import { isUpstashConfigured, kvGetJSON, kvSetJSON, kvDel } from '../_lib/upstash';

interface PostBody {
  uid?: string;
  tweets?: unknown;
}

/** 有効なアクセストークンを返す。期限切れなら refresh して保存。失効時は null。 */
async function ensureToken(uid: string, tok: StoredXToken): Promise<StoredXToken | null> {
  if (tok.access_token && Date.now() < tok.expires_at - 30_000) return tok;
  if (!tok.refresh_token) return null;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tok.refresh_token,
    client_id: getClientId(),
  });
  const res = await fetch(X_TOKEN, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  if (!res.ok) {
    // refresh 失効 → 保存トークンを破棄して再認証へ
    try { await kvDel(tokKey(uid)); } catch { /* */ }
    return null;
  }
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) return null;
  const next: StoredXToken = {
    ...tok,
    access_token: data.access_token,
    // 新しい refresh_token が来たら差し替え（X は回転する）
    refresh_token: data.refresh_token || tok.refresh_token,
    expires_at: Date.now() + (Number(data.expires_in) || 7200) * 1000,
  };
  await kvSetJSON(tokKey(uid), next, TOKEN_TTL);
  return next;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonRes({ error: 'method-not-allowed', message: 'POST で呼び出してください。' }, 405);
  if (!isXConfigured() || !isUpstashConfigured()) {
    return jsonRes({ error: 'not-configured', message: 'Xの自動投稿はまだ設定されていません。' }, 503);
  }

  let parsed: PostBody;
  try {
    parsed = (await req.json()) as PostBody;
  } catch {
    return jsonRes({ error: 'bad-request', message: '送信データの形式が不正です。' }, 400);
  }

  const uid = (parsed.uid || '').trim();
  const tweets = Array.isArray(parsed.tweets)
    ? parsed.tweets.map((t) => String(t ?? '').trim()).filter((t) => t.length > 0)
    : [];

  if (!uid) return jsonRes({ error: 'bad-request', message: 'uid がありません。' }, 400);
  if (tweets.length === 0) return jsonRes({ error: 'empty', message: '投稿する本文がありません。' }, 400);
  if (tweets.length > 25) return jsonRes({ error: 'too-many', message: 'スレッドは一度に25本までです。' }, 400);

  let tok: StoredXToken | null;
  try {
    tok = await kvGetJSON<StoredXToken>(tokKey(uid));
  } catch {
    return jsonRes({ error: 'storage-error', message: '連携情報の読み込みに失敗しました。時間をおいて再度お試しください。' }, 502);
  }
  if (!tok || !tok.access_token) {
    return jsonRes({ error: 'reauth', message: 'Xとの連携が見つかりません。もう一度「Xアカウントと連携」してください。' }, 401);
  }

  let valid: StoredXToken | null;
  try {
    valid = await ensureToken(uid, tok);
  } catch {
    return jsonRes({ error: 'reauth', message: 'Xの認証更新に失敗しました。もう一度連携してください。' }, 401);
  }
  if (!valid) {
    return jsonRes({ error: 'reauth', message: 'Xの連携が期限切れです。もう一度「Xアカウントと連携」してください。' }, 401);
  }

  const ids: string[] = [];
  let prevId: string | undefined;

  for (let i = 0; i < tweets.length; i++) {
    const payload: { text: string; reply?: { in_reply_to_tweet_id: string } } = { text: tweets[i] };
    if (prevId) payload.reply = { in_reply_to_tweet_id: prevId };

    let res: Response;
    try {
      res = await fetch(X_TWEETS, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${valid.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch {
      return jsonRes({
        error: 'network',
        message: `Xへの接続に失敗しました（${i + 1}本目）。電波状況を確認して再度お試しください。`,
        posted: ids,
      }, 502);
    }

    if (res.status === 401 || res.status === 403) {
      try { await kvDel(tokKey(uid)); } catch { /* */ }
      return jsonRes({
        error: 'reauth',
        message: 'Xの連携が無効になりました。お手数ですが、もう一度「Xアカウントと連携」してください。',
        posted: ids,
      }, res.status);
    }
    if (res.status === 429) {
      return jsonRes({
        error: 'rate',
        message: 'Xの投稿上限に達しました（無料枠は月500件）。時間をおいて再度お試しください。',
        posted: ids,
      }, 429);
    }
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.error('[x post] tweet failed:', res.status, t.slice(0, 300));
      return jsonRes({
        error: 'post-failed',
        message: `Xへの投稿に失敗しました（${i + 1}本目 / コード${res.status}）。少し時間をおいて再度お試しください。`,
        posted: ids,
      }, 502);
    }

    const data = (await res.json().catch(() => null)) as { data?: { id?: string } } | null;
    const id = data?.data?.id;
    if (!id) {
      return jsonRes({
        error: 'post-failed',
        message: `Xから投稿IDが返りませんでした（${i + 1}本目）。投稿済みか確認してください。`,
        posted: ids,
      }, 502);
    }
    ids.push(id);
    prevId = id;
  }

  const username = valid.username;
  const urls = ids.map((id) =>
    username ? `https://x.com/${username}/status/${id}` : `https://x.com/i/status/${id}`,
  );

  return jsonRes({ ok: true, ids, urls, username });
}
