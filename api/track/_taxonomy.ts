// ============================================================
// _taxonomy — 全社共通のイベント辞書（corp / CORE Studio / NERI LP / 各アプリ）
//
// これまで計測は3つの別々の語彙で動いていた:
//   corp     … corp_page_view / corp_cta_click / roai_*      → Upstash roai:funnel:<date>
//   studio   … studio_tab_view / studio_film_*               → Upstash studio:funnel:<date>
//   NERI LP  … cta_click / pricing_view / checkout_start …   → Vercel Analytics（CORE側の永続記録なし）
// 名前が違うので「今月、全社で何人が料金を見て、何人が決済に出たか」を1回も出せなかった。
//
// ここで語彙を1つに決め、どのサイトから来ても同じ1本のハッシュへ積む:
//   key   : core:funnel:<YYYY-MM-DD>
//   field : <site>:<event>            … サイト別の合計
//           <site>:<event>:<label>    … 内訳（label があるときだけ）
//           all:<event>               … 全社合計（サイトを跨いだ母数）
// 既存の roai:funnel / studio:funnel は今までどおり書き続ける（既存の画面を壊さない）。
//
// 個人情報は入れない。label は「どこを押したか」「何問目か」だけ。
// ============================================================

/** 計測してよいプロパティ（発信元）。ここに無い site は 400 で捨てる。 */
export const CORE_SITES = ['corp', 'studio', 'neri_lp', 'neri_app', 'prism', 'universe'] as const;
export type CoreSite = (typeof CORE_SITES)[number];
const SITE_SET = new Set<string>(CORE_SITES);

/**
 * 全社共通イベント。増やすときは 08_GROWTH_ENGINE のイベント辞書と両方直す。
 * 「値」は名前に埋めない（plan や location は label へ）。
 */
export const CORE_EVENTS = [
  'page_view',              // ページ/タブを見た（label = path / tab）
  'cta_click',              // 主導線を押した（label = 場所）
  'secondary_cta_click',    // 副導線（料金へ・実績へ 等）
  'pricing_view',           // 料金が実際に画面に入った
  'case_study_view',        // 実績を開いた
  'contact_intent',         // LINE / メールを押した（★連絡が来た、ではない）
  'contact_start',          // フォームを書き始めた
  'contact_complete',       // フォームを送った
  'checkout_start',         // Stripe の決済ページへ出て行った
  'demo_start',             // 無料で触り始めた
  'demo_complete',          // 初回の応答まで到達した
  'estimate_start',         // 概算ウィザード開始
  'estimate_step',          // 概算の1問に答えた（label = 何問目か）
  'estimate_done',          // 概算が出た
  'ai_diagnosis_start',     // ROAI SCORE を始めた
  'ai_diagnosis_complete',  // BRIEF まで到達した
  'proposal_request',       // 詳細レポート／提案を申し込んだ
  'purchase',               // 受注・課金（サーバー側から）
  'upgrade',
  'renewal',
] as const;
export type CoreEvent = (typeof CORE_EVENTS)[number];
const EVENT_SET = new Set<string>(CORE_EVENTS);

/**
 * 既存の（サイト固有の）イベント名 → 共通語彙。
 * 対応が無いものは共通側へ積まない（無理に寄せると母数が嘘になる）。
 */
export const LEGACY_TO_CORE: Readonly<Record<string, CoreEvent>> = {
  // corp / ROAI SCORE
  corp_page_view: 'page_view',
  corp_cta_click: 'cta_click',
  roai_start: 'ai_diagnosis_start',
  roai_result_view: 'ai_diagnosis_complete',
  roai_report_request: 'proposal_request',
  roai_consult_click: 'contact_start',
  roai_consult_submit: 'contact_complete',
  // CORE Studio
  studio_tab_view: 'page_view',
  studio_line_cta: 'contact_intent',
  studio_estimate_start: 'estimate_start',
  studio_estimate_step: 'estimate_step',
  studio_estimate_done: 'estimate_done',
  studio_film_hero_cta: 'cta_click',
  studio_film_sticky_cta: 'cta_click',
  studio_film_pricing_cta: 'secondary_cta_click',
  studio_film_plan_detail: 'pricing_view',
  studio_film_checkout_start: 'checkout_start',
  studio_film_inquiry_start: 'contact_start',
  studio_film_inquiry_submit: 'contact_complete',
};

export function isCoreSite(v: unknown): v is CoreSite {
  return typeof v === 'string' && SITE_SET.has(v);
}
export function isCoreEvent(v: unknown): v is CoreEvent {
  return typeof v === 'string' && EVENT_SET.has(v);
}

/** Redis のフィールド名に使える形へ落とす。空文字なら内訳を立てない。 */
export function sanitizeLabel(raw: unknown): string {
  return String(raw ?? '').slice(0, 40).replace(/[^a-zA-Z0-9._:-]/g, '_').replace(/^_+|_+$/g, '');
}

export function coreFunnelKey(date = new Date()): string {
  return `core:funnel:${date.toISOString().slice(0, 10)}`;
}

/**
 * 共通ハッシュへ積むコマンド列を作る。
 * event が共通語彙でなければ LEGACY_TO_CORE で変換し、それも無ければ空配列（＝積まない）。
 */
export function coreFunnelCommands(
  site: string,
  event: string,
  label = '',
  ttlDays = 400,
): (string | number)[][] {
  if (!isCoreSite(site)) return [];
  const core: string | undefined = isCoreEvent(event) ? event : LEGACY_TO_CORE[event];
  if (!core) return [];
  const key = coreFunnelKey();
  const cmds: (string | number)[][] = [
    ['HINCRBY', key, `${site}:${core}`, 1],
    ['HINCRBY', key, `all:${core}`, 1],
  ];
  if (label) cmds.push(['HINCRBY', key, `${site}:${core}:${label}`, 1]);
  cmds.push(['EXPIRE', key, ttlDays * 86400]);
  return cmds;
}
