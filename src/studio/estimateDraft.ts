// ============================================================
// 概算ウィザードの「途中まで答えた内容」の保存と読み戻し
//
// 6問は「ちょっと調べてから」で一度離れるには長い。以前は離れた瞬間に
// 全部消えて、戻ってきた人は1問目からやり直すしかなかった。
//
// 保存するのは選択肢の値だけ (氏名・連絡先はこの画面で一切受け取らない)。
// 手元の保存は書き換えられる前提なので、読み戻しは必ずここを通し、
// 選択肢に実在しない値・途中が抜けている保存は捨てる。
// ============================================================

export const ESTIMATE_KEY = 'core_studio_estimate_v1';

/** 0〜5 = 質問、6 = 結果 */
export type DraftStep = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type EstimateDraft = {
  step: DraftStep;
  purpose: string | null;
  scale: string | null;
  cms: boolean | null;
  features: string[];
  timeline: string | null;
  budget: string | null;
};

export const EMPTY_DRAFT: EstimateDraft = {
  step: 0, purpose: null, scale: null, cms: null, features: [], timeline: null, budget: null,
};

/** 各質問で選べる値。画面側 (StudioSite) の選択肢から渡す。 */
export type DraftOptions = {
  purposes: readonly string[];
  scales: readonly string[];
  features: readonly string[];
  timelines: readonly string[];
  budgets: readonly string[];
};

const pick = (allowed: readonly string[], v: unknown): string | null =>
  (typeof v === 'string' && allowed.includes(v)) ? v : null;

/**
 * localStorage の中身を読み戻す。復帰させる価値が無い / 壊れている場合は null。
 * - step 0 (1問目のまま) は「続きから」と名乗る意味が無いので復帰させない
 * - 「4問目まで進んだのに1問目が空」のような保存は、途中で詰まる画面を作るだけなので捨てる
 */
export function parseSavedEstimate(raw: string | null, opts: DraftOptions): EstimateDraft | null {
  if (!raw) return null;
  let s: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    s = parsed as Record<string, unknown>;
  } catch { return null; }

  const step = s.step;
  if (typeof step !== 'number' || !Number.isInteger(step) || step < 1 || step > 6) return null;

  const out: EstimateDraft = {
    step: step as DraftStep,
    purpose: pick(opts.purposes, s.purpose),
    scale: pick(opts.scales, s.scale),
    cms: typeof s.cms === 'boolean' ? s.cms : null,
    features: Array.isArray(s.features) ? opts.features.filter(v => (s.features as unknown[]).includes(v)) : [],
    timeline: pick(opts.timelines, s.timeline),
    budget: pick(opts.budgets, s.budget),
  };

  // 到達した step までの答えが揃っているか (機能は未選択でも進めるので問わない)
  const answered = [
    out.purpose !== null,   // step >= 1
    out.scale !== null,     // step >= 2
    out.cms !== null,       // step >= 3
    true,                   // step >= 4
    out.timeline !== null,  // step >= 5
    out.budget !== null,    // step >= 6
  ];
  for (let i = 0; i < out.step; i++) if (!answered[i]) return null;
  return out;
}
