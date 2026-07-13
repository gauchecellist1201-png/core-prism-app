// ============================================================
// POST /api/threads/post   body: { uid: string, posts: string[], images?: (string|null)[] }
//
// いますぐ投稿。実処理は _postCore.postThreadsForUid（画像対応・予約cronと共通）。
// images[i] は posts[i] に添付する公開画像URL（AI生成画像のURL等）。
// エラーは必ず日本語の意味あるメッセージ（silent fail 禁止）:
//   失効  → { error:'reauth' }
//   その他 → { error:'post-failed', message:'…' }
// ============================================================

export const config = { runtime: 'edge' };

import { isThreadsConfigured, jsonRes } from './_shared';
import { isUpstashConfigured } from '../_lib/upstash';
import { postThreadsForUid } from './_postCore';

interface PostBody {
  uid?: string;
  posts?: unknown;
  images?: unknown;
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
  // images は posts と同じ並び。https の公開URLのみ許可（それ以外は無視）。
  const imagesRaw = Array.isArray(parsed.images) ? parsed.images : [];
  const images: (string | undefined)[] = posts.map((_, i) => {
    const v = String(imagesRaw[i] ?? '').trim();
    return /^https:\/\/.+/i.test(v) && v.length <= 2000 ? v : undefined;
  });

  if (!uid) return jsonRes({ error: 'bad-request', message: 'uid がありません。' }, 400);
  if (posts.length === 0) return jsonRes({ error: 'empty', message: '投稿する本文がありません。' }, 400);
  if (posts.length > 25) return jsonRes({ error: 'too-many', message: 'スレッドは一度に25本までです。' }, 400);
  const tooLong = posts.findIndex((p) => p.length > 500);
  if (tooLong >= 0) {
    return jsonRes({ error: 'too-long', message: `${tooLong + 1}本目が500字を超えています。Threadsは1投稿500字までです。` }, 400);
  }

  const r = await postThreadsForUid(uid, posts, images);
  if (!r.ok) {
    return jsonRes({ error: r.error, message: r.message, posted: r.posted ?? [] }, r.httpStatus || 502);
  }
  return jsonRes({ ok: true, ids: r.ids, urls: r.urls, username: r.username });
}
