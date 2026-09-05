// ============================================================
// CORE Studio の計測 — 手元 (localStorage) と CORE 側 (Upstash) の両方に残す
//
// これまで /studio と /studio/film は logEvent() だけを呼んでおり、
// 記録は **訪問者自身のブラウザ** にしか残らなかった。
// つまり「LINEが何回押されたか」「概算の何問目で帰ったか」は、
// 押した本人の端末にしか無く、CORE 側からは常に 0 件だった。
//
// knowledgeUsageTracker.ts と同じベストエフォートのビーコン方式。
// 送信は失敗しても画面の動作を一切止めない (計測のために体験を壊さない)。
// ============================================================
import { logEvent } from '../lib/onboardingAnalytics';

const BEACON_PATH = '/api/track/studio';

/**
 * サーバーへ送ってよいイベント名。
 * api/track/studio.ts の STUDIO_EVENTS と同じ並びを保つこと
 * (向こうの allowlist に無い名前は 400 で捨てられる)。
 */
export const STUDIO_EVENTS = new Set<string>([
  'studio_tab_view',
  'studio_line_cta',
  'studio_estimate_start',
  'studio_estimate_step',
  'studio_estimate_done',
  'studio_estimate_resume',
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
]);

/**
 * props の「値」だけを拾って 1 本のラベルにする。
 * 例: { plan: 'f1', to: 'line' } -> 'f1_line' / { where: 'home-hero' } -> 'home-hero'
 * 個人情報は元々 props に入れていないが、念のため長さを切り、
 * 文字種もサーバー側と同じ範囲へ寄せておく (キーが増えすぎるのを防ぐ)。
 */
export function labelOfProps(props?: Record<string, unknown>): string {
  if (!props) return '';
  const parts: string[] = [];
  for (const v of Object.values(props)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'object') continue;
    parts.push(String(v));
  }
  return parts.join('_').slice(0, 40).replace(/[^a-zA-Z0-9._:-]/g, '_').replace(/^_+|_+$/g, '');
}

function beacon(event: string, label: string) {
  try {
    const body = JSON.stringify({ site: 'studio', event, label });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(BEACON_PATH, new Blob([body], { type: 'application/json' }));
    } else if (typeof fetch !== 'undefined') {
      fetch(BEACON_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => { /* 計測の失敗で画面を止めない */ });
    }
  } catch { /* 計測の失敗で画面を止めない */ }
}

/** /studio 配下の計測はすべてこれを通す (logEvent を直接呼ばない)。 */
export function track(event: string, props?: Record<string, unknown>): void {
  logEvent(event, props);
  if (STUDIO_EVENTS.has(event)) beacon(event, labelOfProps(props));
}
