// ============================================================
// roai/track — CORE ROAI SCORE と /corp の導線計測。
//   手元（localStorage の logEvent）と CORE 側（/api/track/roai → Upstash）の両方に残す。
//   src/studio/track.ts と同じベストエフォート方式。計測の失敗で画面を止めない。
//
// イベント名は api/track/roai.ts の ROAI_EVENTS と必ず揃える（向こうの allowlist に無い名前は捨てられる）。
// 個人情報はラベルに入れない（質問 id・章名・ページ名だけ）。
// ============================================================
import { logEvent } from '../../lib/onboardingAnalytics';

const BEACON_PATH = '/api/track/roai';

export const ROAI_EVENTS = new Set<string>([
  'corp_page_view',        // label = tab / page
  'corp_cta_click',        // label = where (home-hero / roai-band / ...)
  'roai_view',             // 診断の開始画面を見た（label = source）
  'roai_start',            // 診断を始めた（label = source）
  'roai_step',             // 質問に答えた（label = question id）
  'roai_back',
  'roai_resume',           // 続きから再開
  'roai_complete',         // 最後の質問に答えた
  'roai_result_view',      // BRIEF を見た（label = tier ではなく mode）
  'roai_basis_open',       // 算定根拠を開いた
  'roai_report_request',   // 詳細レポートを申し込んだ（label = ok / fail）
  'roai_consult_click',    // 相談 CTA を押した（label = where）
  'roai_consult_submit',   // 相談フォームを送った（label = ok / fail）
  'roai_restart',
]);

export function labelOf(v: unknown): string {
  return String(v ?? '').slice(0, 40).replace(/[^a-zA-Z0-9._:-]/g, '_').replace(/^_+|_+$/g, '');
}

function beacon(event: string, label: string) {
  try {
    const body = JSON.stringify({ event, label });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(BEACON_PATH, new Blob([body], { type: 'application/json' }));
    } else if (typeof fetch !== 'undefined') {
      fetch(BEACON_PATH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true })
        .catch(() => { /* */ });
    }
  } catch { /* */ }
}

export function track(event: string, label?: unknown): void {
  const l = labelOf(label);
  logEvent(event, l ? { label: l } : undefined);
  if (ROAI_EVENTS.has(event)) beacon(event, l);
}

/** 診断の入口を押した場所を覚えておく（どのページから診断が始まったかの計測）。 */
const SRC_KEY = 'core_roai_src';
export function rememberSource(where: string): void {
  try { sessionStorage.setItem(SRC_KEY, labelOf(where)); } catch { /* */ }
}
export function takeSource(): string {
  try {
    const v = sessionStorage.getItem(SRC_KEY) || '';
    sessionStorage.removeItem(SRC_KEY);
    return v;
  } catch { return ''; }
}
