// ============================================================
// api/x/_postCore.ts — X投稿の中核処理（post.ts と cron/x-scheduled-posts.ts で共有）
//
// トークン読込 → 期限切れなら refresh_token で更新し保存 →
// POST https://api.twitter.com/2/tweets を順に投稿（2本目以降は
// reply.in_reply_to_tweet_id で前の id に連結＝スレッド）。
// ============================================================
import {
  X_TOKEN,
  X_TWEETS,
  TOKEN_TTL,
  getClientId,
  basicAuthHeader,
  tokKey,
  type StoredXToken,
} from './_shared';
import { kvGetJSON, kvSetJSON, kvDel } from '../_lib/upstash';

export interface PostTweetsResult {
  ok: boolean;
  ids?: string[];
  urls?: string[];
  username?: string;
  error?: string;
  message?: string;
  posted?: string[];
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
    refresh_token: data.refresh_token || tok.refresh_token,
    expires_at: Date.now() + (Number(data.expires_in) || 7200) * 1000,
  };
  await kvSetJSON(tokKey(uid), next, TOKEN_TTL);
  return next;
}

/** uid の連携トークンを使って tweets を順に投稿する（スレッド対応）。 */
export async function postTweetsForUid(uid: string, tweets: string[]): Promise<PostTweetsResult> {
  if (!uid) return { ok: false, error: 'bad-request', message: 'uid がありません。' };
  const cleaned = tweets.map((t) => String(t ?? '').trim()).filter((t) => t.length > 0);
  if (cleaned.length === 0) return { ok: false, error: 'empty', message: '投稿する本文がありません。' };
  if (cleaned.length > 25) return { ok: false, error: 'too-many', message: 'スレッドは一度に25本までです。' };

  let tok: StoredXToken | null;
  try {
    tok = await kvGetJSON<StoredXToken>(tokKey(uid));
  } catch {
    return { ok: false, error: 'storage-error', message: '連携情報の読み込みに失敗しました。時間をおいて再度お試しください。' };
  }
  if (!tok || !tok.access_token) {
    return { ok: false, error: 'reauth', message: 'Xとの連携が見つかりません。もう一度「Xアカウントと連携」してください。' };
  }

  let valid: StoredXToken | null;
  try {
    valid = await ensureToken(uid, tok);
  } catch {
    return { ok: false, error: 'reauth', message: 'Xの認証更新に失敗しました。もう一度連携してください。' };
  }
  if (!valid) {
    return { ok: false, error: 'reauth', message: 'Xの連携が期限切れです。もう一度「Xアカウントと連携」してください。' };
  }

  const ids: string[] = [];
  let prevId: string | undefined;

  for (let i = 0; i < cleaned.length; i++) {
    const payload: { text: string; reply?: { in_reply_to_tweet_id: string } } = { text: cleaned[i] };
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
      return {
        ok: false, error: 'network',
        message: `Xへの接続に失敗しました（${i + 1}本目）。電波状況を確認して再度お試しください。`,
        posted: ids,
      };
    }

    if (res.status === 401 || res.status === 403) {
      try { await kvDel(tokKey(uid)); } catch { /* */ }
      return {
        ok: false, error: 'reauth',
        message: 'Xの連携が無効になりました。お手数ですが、もう一度「Xアカウントと連携」してください。',
        posted: ids,
      };
    }
    if (res.status === 429) {
      return {
        ok: false, error: 'rate',
        message: 'Xの投稿上限に達しました（無料枠は月500件）。時間をおいて再度お試しください。',
        posted: ids,
      };
    }
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.error('[x post] tweet failed:', res.status, t.slice(0, 300));
      return {
        ok: false, error: 'post-failed',
        message: `Xへの投稿に失敗しました（${i + 1}本目 / コード${res.status}）。少し時間をおいて再度お試しください。`,
        posted: ids,
      };
    }

    const data = (await res.json().catch(() => null)) as { data?: { id?: string } } | null;
    const id = data?.data?.id;
    if (!id) {
      return {
        ok: false, error: 'post-failed',
        message: `Xから投稿IDが返りませんでした（${i + 1}本目）。投稿済みか確認してください。`,
        posted: ids,
      };
    }
    ids.push(id);
    prevId = id;
  }

  const username = valid.username;
  const urls = ids.map((id) =>
    username ? `https://x.com/${username}/status/${id}` : `https://x.com/i/status/${id}`,
  );

  return { ok: true, ids, urls, username };
}
