// ============================================================
// onboardingFunnel.ts — オンボーディング 各 step 通過記録
//
// 動作:
//   1) クライアント側: localStorage `core_onboarding_funnel_v1` に
//      step 到達数を日次で蓄積 (オフラインでも動く)
//   2) Best-effort で /api/track/onboarding-step に beacon を飛ばす
//      → Vercel ログに残る + Upstash があれば集計用カウンタを更新
//
// データ構造 (localStorage):
//   {
//     days: {
//       "2026-06-03": {
//         welcome: 12,
//         name: 11,
//         industry: 10,
//         model: 9,
//         completed: 9
//       }
//     }
//   }
// ============================================================

const STORAGE_KEY = 'core_onboarding_funnel_v1';
const BEACON_PATH = '/api/track/onboarding-step';

export type OnboardStep = 'welcome' | 'name' | 'industry' | 'apikey' | 'model' | 'completed';

type FunnelDay = Partial<Record<OnboardStep, number>>;
type FunnelData = { days: Record<string, FunnelDay> };

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function load(): FunnelData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p.days === 'object') return p;
    }
  } catch { /* */ }
  return { days: {} };
}

function save(d: FunnelData) {
  try {
    // 90 日分だけ保持 (古いキーを削る)
    const keys = Object.keys(d.days).sort();
    if (keys.length > 90) {
      const drop = keys.slice(0, keys.length - 90);
      for (const k of drop) delete d.days[k];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  } catch { /* */ }
}

/**
 * step に到達した瞬間に呼ぶ。同一セッション内で同じ step を再記録しないよう
 * sessionStorage で重複を弾く (ユーザーが戻って進むを繰り返してもカウントは
 * 1 セッション 1 件)。
 */
export function recordStep(step: OnboardStep) {
  // セッション内重複防止
  try {
    const sessKey = `__onboard_recorded:${step}`;
    if (sessionStorage.getItem(sessKey) === '1') return;
    sessionStorage.setItem(sessKey, '1');
  } catch { /* */ }

  // localStorage 蓄積
  const data = load();
  const t = todayKey();
  if (!data.days[t]) data.days[t] = {};
  data.days[t][step] = (data.days[t][step] || 0) + 1;
  save(data);

  // ベストエフォート beacon (Vercel ログ + Upstash カウンタ)
  try {
    const payload = JSON.stringify({ step, date: t });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(BEACON_PATH, blob);
    } else {
      fetch(BEACON_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => { /* */ });
    }
  } catch { /* */ }
}

/** UI / スクリプト用: 直近 N 日の集計を返す */
export function summarize(days = 7): { date: string; data: FunnelDay; dropRate: number }[] {
  const all = load();
  const dates = Object.keys(all.days).sort().slice(-days);
  return dates.map(d => {
    const data = all.days[d];
    const welcome = data.welcome || 0;
    const completed = data.completed || 0;
    const dropRate = welcome > 0 ? Math.round((1 - completed / welcome) * 1000) / 10 : 0;
    return { date: d, data, dropRate };
  });
}

/** デバッグ用: 全消去 */
export function _resetForTest() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
}
