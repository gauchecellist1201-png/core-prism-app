// ============================================================
// api/threads/schedule.ts — Threads 投稿の「自動投稿」予約 CRUD
//
// x/schedule.ts の作法に完全に合わせる。ユーザーが日時を指定して予約すると、
// api/cron/threads-scheduled-posts.ts が定期的にこの一覧を確認し、時刻が
// 来たものを自動で投稿する（ブラウザを閉じていても実行される）。画像URL対応。
//
// 保存先: Upstash
//   th:sched:<uid>  → その uid の予約一覧 (JSON配列)
//   th:sched:idx    → 予約が1件以上ある uid の一覧 (cron が全件走査するため)
//
// POST   { uid, scheduledAt(ISO), posts: string[], images?: (string|null)[] } → 予約作成
// GET    ?uid=...                                                             → 予約一覧
// DELETE { uid, id }                                                          → 予約削除
// ============================================================

export const config = { runtime: 'edge' };

import { isThreadsConfigured, jsonRes, tokKey } from './_shared';
import { isUpstashConfigured, kvGetJSON, kvSetJSON } from '../_lib/upstash';

export interface ScheduledThreadsPost {
  id: string;
  scheduledAt: string; // ISO
  posts: string[];
  /** posts[i] に添付する公開画像URL（無い位置は null）。 */
  images?: (string | null)[];
  status: 'pending' | 'sent' | 'failed';
  createdAt: number;
  sentAt?: number;
  error?: string;
  urls?: string[];
}

const SCHED_TTL = 60 * 60 * 24 * 60; // 60日
const MAX_PENDING = 50;

function schedKey(uid: string): string {
  return `th:sched:${uid}`;
}
const IDX_KEY = 'th:sched:idx';

async function addToIndex(uid: string): Promise<void> {
  const idx = (await kvGetJSON<string[]>(IDX_KEY)) || [];
  if (!idx.includes(uid)) {
    idx.push(uid);
    await kvSetJSON(IDX_KEY, idx);
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (!isThreadsConfigured() || !isUpstashConfigured()) {
    return jsonRes({ error: 'not-configured', message: 'Threadsの自動投稿はまだ設定されていません。' }, 503);
  }

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const uid = (url.searchParams.get('uid') || '').trim();
    if (!uid) return jsonRes({ error: 'bad-request', message: 'uid がありません。' }, 400);
    const list = (await kvGetJSON<ScheduledThreadsPost[]>(schedKey(uid))) || [];
    return jsonRes({ ok: true, items: list.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)) });
  }

  if (req.method === 'POST') {
    let body: { uid?: string; scheduledAt?: string; posts?: unknown; images?: unknown };
    try {
      body = await req.json();
    } catch {
      return jsonRes({ error: 'bad-request', message: '送信データの形式が不正です。' }, 400);
    }
    const uid = (body.uid || '').trim();
    const scheduledAt = (body.scheduledAt || '').trim();
    const posts = Array.isArray(body.posts)
      ? body.posts.map((t) => String(t ?? '').trim()).filter((t) => t.length > 0)
      : [];
    const imagesRaw = Array.isArray(body.images) ? body.images : [];
    const images: (string | null)[] = posts.map((_, i) => {
      const v = String(imagesRaw[i] ?? '').trim();
      return /^https:\/\/.+/i.test(v) && v.length <= 2000 ? v : null;
    });

    if (!uid) return jsonRes({ error: 'bad-request', message: 'uid がありません。' }, 400);
    const dt = new Date(scheduledAt);
    if (!scheduledAt || Number.isNaN(dt.getTime())) {
      return jsonRes({ error: 'bad-request', message: '予約日時が不正です。' }, 400);
    }
    if (dt.getTime() < Date.now() - 60_000) {
      return jsonRes({ error: 'bad-request', message: '予約日時は未来にしてください。' }, 400);
    }
    if (posts.length === 0) return jsonRes({ error: 'empty', message: '投稿する本文がありません。' }, 400);
    if (posts.length > 25) return jsonRes({ error: 'too-many', message: 'スレッドは一度に25本までです。' }, 400);
    const tooLong = posts.findIndex((p) => p.length > 500);
    if (tooLong >= 0) {
      return jsonRes({ error: 'too-long', message: `${tooLong + 1}本目が500字を超えています。Threadsは1投稿500字までです。` }, 400);
    }

    // Threadsと連携済みかを確認（連携なしで予約しても投稿できないため先に弾く）
    const tok = await kvGetJSON(tokKey(uid));
    if (!tok) {
      return jsonRes({ error: 'reauth', message: '先にThreadsと連携してください。' }, 401);
    }

    const list = (await kvGetJSON<ScheduledThreadsPost[]>(schedKey(uid))) || [];
    const pendingCount = list.filter((s) => s.status === 'pending').length;
    if (pendingCount >= MAX_PENDING) {
      return jsonRes({ error: 'too-many-pending', message: `予約は同時に${MAX_PENDING}件までです。` }, 400);
    }

    const item: ScheduledThreadsPost = {
      id: `ths_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      scheduledAt: dt.toISOString(),
      posts,
      images,
      status: 'pending',
      createdAt: Date.now(),
    };
    list.push(item);
    await kvSetJSON(schedKey(uid), list, SCHED_TTL);
    await addToIndex(uid);

    return jsonRes({ ok: true, item });
  }

  if (req.method === 'DELETE') {
    let body: { uid?: string; id?: string };
    try {
      body = await req.json();
    } catch {
      return jsonRes({ error: 'bad-request', message: '送信データの形式が不正です。' }, 400);
    }
    const uid = (body.uid || '').trim();
    const id = (body.id || '').trim();
    if (!uid || !id) return jsonRes({ error: 'bad-request', message: 'uid / id がありません。' }, 400);

    const list = (await kvGetJSON<ScheduledThreadsPost[]>(schedKey(uid))) || [];
    const next = list.filter((s) => s.id !== id);
    await kvSetJSON(schedKey(uid), next, SCHED_TTL);
    return jsonRes({ ok: true });
  }

  return jsonRes({ error: 'method-not-allowed', message: 'GET / POST / DELETE のいずれかで呼び出してください。' }, 405);
}
