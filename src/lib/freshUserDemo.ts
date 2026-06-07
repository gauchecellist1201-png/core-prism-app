// ============================================================
// freshUserDemo — 「初回 ユーザー が 触る 状態」 を 再現
//
// オーナー指示 (2026-06-05):
//   「マスター キー で ログイン した 場合 も 初回 ユーザー と 同じ 動き で
//    全機能 の チュートリアル を 受けられる 様 に したい。
//    何 が 足り ない か 自分 で 触って 把握 できる 様 に。」
//
// 動き:
//   1. localStorage の ユーザー データ を 全削除 (ナレッジ / 案件 / 会話 等)
//   2. オンボ 完了 フラグ も リセット (ようこそ 画面 から)
//   3. ガイド ツアー の 既読 フラグ を リセット
//   4. ブランド 別 (prism / iris) で 適切 な 初期 ペルソナ を シード
//   5. リロード で 「初回 ダウンロード 後」 の 画面 に 戻る
//
// 安全弁: master キー 必須 — 通常 ユーザー は 自分 の データ を 全消去 しない
// ============================================================

const TOUR_DONE_KEY = 'core_guided_tour_v2_done';
const TOUR_RUN_KEY = 'core_guided_tour_v2_run';

/** クリア する キー パターン (ユーザー データ — 連携キー は 残す) */
const KEYS_TO_CLEAR = [
  // ナレッジ / 会話 / 案件
  /^core_knowledge/,
  /^core_chat/,
  /^core_mobile_gemini/,
  /^core_personas/,
  /^core_crm_/,
  /^core_tasks/,
  /^core_cashflow/,
  /^core_agent_task/,
  /^core_ai_suggestion/,
  /^core_cxo_deliverables/,
  /^core_image_history/,
  /^core_document_history/,
  /^core_invoice/,
  /^core_clients/,
  /^core_expense/,
  /^core_pnl/,
  // Iris ユーザー データ
  /^iris_/,
  // オンボ / ツアー フラグ
  /^core_onboarding/,
  /^core_guided_tour/,
  /^core_welcome/,
  /^core_morning_coach/,
  /^core_evening_feed/,
  /^core_pwa_/,
  /^core_persona_preset/,
  /^core_sitemap_history/,
  /^core_cmd_k_/,
];

/** 残す キー (連携 / マスター / 設定 の 一部) */
const KEYS_TO_PRESERVE = [
  'core_master_key',
  'core_stripe_secret',
  'core_anthropic_key',
  'core_openai_key',
  'core_gemini_key',
  'core_settings_brand',  // brand 選好
  'core_settings_lang',   // 言語 選好
];

export interface FreshDemoOptions {
  brand: 'prism' | 'iris';
  /** ツアー も 同時 に 開始 する か (true: リロード 後 自動 で 走る) */
  startTour?: boolean;
}

/**
 * 全 ユーザー データ を 消して 初回 状態 を 作る。
 * リロード が 必要 (呼び出し 側 で window.location.href = ... する)。
 */
export function resetToFreshUser(opts: FreshDemoOptions): { cleared: number; preserved: number } {
  let cleared = 0;
  let preserved = 0;
  const preservedValues: Record<string, string> = {};

  // 残す キー を 一旦 退避
  for (const k of KEYS_TO_PRESERVE) {
    const v = localStorage.getItem(k);
    if (v !== null) preservedValues[k] = v;
  }

  // 全 localStorage を 走査して 対象 を 削除
  const allKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) allKeys.push(k);
  }
  for (const k of allKeys) {
    if (KEYS_TO_CLEAR.some((re) => re.test(k))) {
      localStorage.removeItem(k);
      cleared++;
    } else {
      preserved++;
    }
  }

  // 退避した キー を 戻す
  for (const [k, v] of Object.entries(preservedValues)) {
    localStorage.setItem(k, v);
  }

  // 初期 brand を セット
  localStorage.setItem('core_settings_brand', opts.brand);

  // ツアー を 開始 する フラグ
  if (opts.startTour) {
    localStorage.setItem(TOUR_RUN_KEY, opts.brand);
    localStorage.removeItem(TOUR_DONE_KEY);
  }

  return { cleared, preserved };
}

/** ツアー を 開始 すべき か (リロード 後 の チェック 用) */
export function shouldStartTour(): 'prism' | 'iris' | null {
  try {
    const v = localStorage.getItem(TOUR_RUN_KEY);
    if (v === 'prism' || v === 'iris') return v;
    return null;
  } catch { return null; }
}

/** ツアー 開始 フラグ を 消費 (一回 だけ 走る) */
export function consumeTourFlag() {
  try { localStorage.removeItem(TOUR_RUN_KEY); } catch { /* */ }
}

/** ツアー 完了 を 記録 */
export function markTourDone() {
  try { localStorage.setItem(TOUR_DONE_KEY, new Date().toISOString()); } catch { /* */ }
}

export function isTourDone(): boolean {
  try { return !!localStorage.getItem(TOUR_DONE_KEY); } catch { return false; }
}
