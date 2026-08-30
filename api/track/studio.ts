// ============================================================
// /api/track/studio — CORE Studio (/studio) の導線ビーコン受信
//
// これまで /studio と /studio/film の計測は logEvent() 経由で
// **訪問者自身の localStorage** にしか書かれておらず、CORE 側には
// 1件も届いていなかった (getEventStats() を読む画面も /studio には無い)。
// 「LINEが何回押されたか」「概算の何問目で帰ったか」が全部見えない状態。
//
// POST { event: string, label?: string }
// GET  ?days=14 — 直近 N 日の生カウントを返す (オーナー用)
//
// Upstash 永続化 (未設定なら console.log のみ)
//   key:   studio:funnel:<YYYY-MM-DD>
//   field: <event>  と  <event>:<label>  の2本を立てる
//          (合計と内訳を別々に足す。内訳だけだと label 無しの回が消える)
// ============================================================

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const UPSTASH_OK = !!(UP_URL && UP_TOK);

// 受け付けるイベント名。ここに無い名前は捨てる。
// (任意の文字列を通すと、書き間違えた1回きりの名前でキーが際限なく増える)
// 追加するときは src/studio/track.ts の STUDIO_EVENTS と必ず揃える。
export const STUDIO_EVENTS = [
  // 共通
  'studio_tab_view',
  'studio_line_cta',
  // 概算ウィザード (どの質問で帰ったかを見るため step ごとに立てる)
  'studio_estimate_start',
  'studio_estimate_step',
  'studio_estimate_done',
  'studio_estimate_resume',
  // 映像制作タブ
  'studio_film_scroll_depth',
  'studio_film_sticky_cta',
  'studio_film_hero_cta',
  'studio_film_hero_reel_play',
  'studio_film_hero_reel_sound',
  'studio_film_nav',
  'studio_film_menu_row',
  'studio_film_terms_open',
  'studio_film_pricing_mode',
  'studio_film_pricing_cta',
  'studio_film_plan_detail',
  'studio_film_checkout_start',
  'studio_film_checkout_fallback',
  'studio_film_inquiry_start',
  'studio_film_inquiry_submit',
] as const;

const EVENT_SET = new Set<string>(STUDIO_EVENTS);

/** Redis のフィールド名に使える形へ落とす。空文字なら内訳を立てない。 */
export function sanitizeLabel(raw: unknown): string {
  return String(raw ?? '').slice(0, 40).replace(/[^a-zA-Z0-9._:-]/g, '_').replace(/^_+|_+$/g, '');
}

async function up(cmd: (string | number)[]): Promise<unknown> {
  if (!UPSTASH_OK) throw new Error('UPSTASH_NOT_CONFIGURED');
  const res = await fetch(UP_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${UP_TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return res.json();
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function dateOffsetDays(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const days = Math.max(1, Math.min(60, Number(url.searchParams.get('days') || '14')));
    if (!UPSTASH_OK) {
      return json({
        ok: true, configured: false,
        hint: 'UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN を Vercel env に追加すると記録が残ります。',
        days: [],
      });
    }
    const list: Array<{ date: string; counts: Record<string, number> }> = [];
    for (let i = 0; i < days; i++) {
      const d = dateOffsetDays(i);
      try {
        const r = await up(['HGETALL', `studio:funnel:${d}`]);
        const arr: string[] = (r as { result?: string[] }).result || [];
        const counts: Record<string, number> = {};
        for (let j = 0; j < arr.length; j += 2) counts[arr[j]] = Number(arr[j + 1]) || 0;
        list.push({ date: d, counts });
      } catch {
        list.push({ date: d, counts: {} });
      }
    }
    return json({ ok: true, configured: true, days: list.reverse() });
  }

  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  let body: { event?: string; label?: string };
  try { body = await req.json(); } catch { body = {}; }
  const event = String(body.event || '');
  if (!EVENT_SET.has(event)) return json({ ok: false, error: 'invalid_event' }, 400);
  const label = sanitizeLabel(body.label);

  if (UPSTASH_OK) {
    try {
      const key = `studio:funnel:${new Date().toISOString().slice(0, 10)}`;
      await up(['HINCRBY', key, event, 1]);
      if (label) await up(['HINCRBY', key, `${event}:${label}`, 1]);
      await up(['EXPIRE', key, 100 * 86400]);
    } catch (e) {
      console.error('[studio-funnel] upstash error', (e as Error).message);
    }
  } else {
    console.log(`[studio-funnel] ${event}${label ? `:${label}` : ''}`);
  }

  return json({ ok: true });
}
