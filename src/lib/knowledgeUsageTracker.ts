// ============================================================
// knowledgeUsageTracker.ts — 出典チップ活用度 + 資料不一致率の計測
//
// 「出典チップが押された回数」「関連資料0件のまま答えた回答の割合」を
// 計測する基盤が無かった (BACKLOG に残ったまま) ため追加。
// ctaAbTest.ts と同じベストエフォート ビーコン方式 (sendBeacon / fetch)。
// ============================================================

const BEACON_PATH = '/api/track/knowledge-usage';

function beacon(payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(BEACON_PATH, blob);
    } else {
      fetch(BEACON_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => { /* */ });
    }
  } catch { /* */ }
}

/** 出典チップがクリックされた時に呼ぶ。location はチップの設置場所 (例: 'sidebar' / 'mobile' / 'dock')。 */
export function trackCitationClick(location: string) {
  beacon({ event: 'citation_click', location });
}

/** AI の回答が1件レンダリングされた時に呼ぶ。noMatch は関連資料0件のまま答えたかどうか。 */
export function trackAnswerRendered(noMatch: boolean) {
  beacon({ event: 'answer_rendered', noMatch });
}
