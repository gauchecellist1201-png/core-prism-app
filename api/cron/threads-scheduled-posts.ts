// ============================================================
// /api/cron/threads-scheduled-posts — 予約されたThreads投稿を時刻が来たら自動投稿
//
// ユーザーが投稿画面で「予約」したThreads投稿（画像つき対応）を、ブラウザを
// 閉じていても自動で投稿する。api/threads/schedule.ts で作られた予約一覧を
// th:sched:idx (uid一覧) → th:sched:<uid> (予約配列) の順に辿り、
// scheduledAt <= 現在時刻 かつ status==='pending' のものだけ投稿する。
// x-scheduled-posts.ts と同型。
//
// Vercel Cron (vercel.json):
//   { "path": "/api/cron/threads-scheduled-posts", "schedule": "10 23 * * *" }
// ============================================================
export const config = { runtime: 'edge' };

import { isThreadsConfigured } from '../threads/_shared';
import { isUpstashConfigured, kvGetJSON, kvSetJSON } from '../_lib/upstash';
import { postThreadsForUid } from '../threads/_postCore';
import type { ScheduledThreadsPost } from '../threads/schedule';

const IDX_KEY = 'th:sched:idx';
function schedKey(uid: string): string {
  return `th:sched:${uid}`;
}

export default async function handler(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  if (!isThreadsConfigured() || !isUpstashConfigured()) {
    return jsonRes(200, { ok: true, skipped: 'not-configured' });
  }

  const uids = (await kvGetJSON<string[]>(IDX_KEY)) || [];
  const now = Date.now();
  let checked = 0;
  let posted = 0;
  let failed = 0;
  const remainingUids: string[] = [];

  for (const uid of uids) {
    const list = (await kvGetJSON<ScheduledThreadsPost[]>(schedKey(uid))) || [];
    if (list.length === 0) continue;

    let changed = false;
    for (const item of list) {
      if (item.status !== 'pending') continue;
      checked++;
      if (new Date(item.scheduledAt).getTime() > now) continue;

      const result = await postThreadsForUid(uid, item.posts, item.images || undefined);
      changed = true;
      if (result.ok) {
        item.status = 'sent';
        item.sentAt = Date.now();
        item.urls = result.urls;
        posted++;
      } else {
        item.status = 'failed';
        item.error = result.message || result.error || '投稿に失敗しました';
        failed++;
      }
    }
    if (changed) {
      await kvSetJSON(schedKey(uid), list, 60 * 60 * 24 * 60);
    }
    const hasPending = list.some((s) => s.status === 'pending');
    if (hasPending) remainingUids.push(uid);
  }

  if (remainingUids.length !== uids.length) {
    await kvSetJSON(IDX_KEY, remainingUids);
  }

  return jsonRes(200, { ok: true, uidsChecked: uids.length, itemsChecked: checked, posted, failed });
}

function jsonRes(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
