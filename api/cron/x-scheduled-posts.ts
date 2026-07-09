// ============================================================
// /api/cron/x-scheduled-posts — 予約されたX投稿を時刻が来たら自動投稿
//
// 2026-07-09: Prism から「連携させて自動的に投稿する仕組み」への対応。
// ユーザーが AutoPostStudio で「予約」した投稿を、ブラウザを閉じていても
// 自動でXに投稿する。api/x/schedule.ts で作られた予約一覧を
// x:sched:idx (uid一覧) → x:sched:<uid> (予約配列) の順に辿り、
// scheduledAt <= 現在時刻 かつ status==='pending' のものだけ投稿する。
//
// Vercel Cron (vercel.json):
//   "crons": [{ "path": "/api/cron/x-scheduled-posts", "schedule": "*/15 * * * *" }]
//   ※ 15分おき。予約時刻からのズレは最大15分。
// ============================================================
export const config = { runtime: 'edge' };

import { isXConfigured } from '../x/_shared';
import { isUpstashConfigured, kvGetJSON, kvSetJSON } from '../_lib/upstash';
import { postTweetsForUid } from '../x/_postCore';
import type { ScheduledXPost } from '../x/schedule';

const IDX_KEY = 'x:sched:idx';
function schedKey(uid: string): string {
  return `x:sched:${uid}`;
}

export default async function handler(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  if (!isXConfigured() || !isUpstashConfigured()) {
    return jsonRes(200, { ok: true, skipped: 'not-configured' });
  }

  const uids = (await kvGetJSON<string[]>(IDX_KEY)) || [];
  const now = Date.now();
  let checked = 0;
  let posted = 0;
  let failed = 0;
  const remainingUids: string[] = [];

  for (const uid of uids) {
    const list = (await kvGetJSON<ScheduledXPost[]>(schedKey(uid))) || [];
    if (list.length === 0) continue;

    let changed = false;
    for (const item of list) {
      if (item.status !== 'pending') continue;
      checked++;
      if (new Date(item.scheduledAt).getTime() > now) continue;

      const result = await postTweetsForUid(uid, item.tweets);
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
    // 直近30日以内に作られた「未完了(pending)」があるuidだけ次回もチェック対象に残す
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
