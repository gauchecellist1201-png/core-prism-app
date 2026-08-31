// ============================================================
// CORE Continuum — 統合パッケージの共有データ
// /corp のセクションと /continuum LP の両方がこれを参照する（価格の二重管理を防ぐ）。
// stripeUrl: Stripe決済リンクを貼るだけでボタンが「このプランで始める」に変わる。
// 空の間は mailto の個別相談に自動フォールバック（動かないボタンを出さない）。
//
// 2026-08-21 Codexレビュー指摘の反映:
//   金額は必ず「数値ひとつ」を正にする。表示文字列と割引率の式に同じ額を
//   別々に打っていると、値上げした日に表示だけ変わって割引率が嘘になる
//   （型もテストも落ちないので誰も気づけない）。
// ============================================================

import { SUITE_COUNT, SUITE_BEST_TOTAL, sumBest, formatYen } from './suiteData';

export const CONTINUUM_CONTACT_EMAIL = 'info@core-ai.jp';

// ── 比較に使う実額 ────────────────────────────────────────
// 2026-08-21: 文面に「約¥109,000」「6サービス」「7つ」がベタ書きされていて、
// どれも実データから再現できなかった（実測: いちばん選ばれているプランの合計は ¥88,820）。
// 買う前にいちばん見られる数字なので、必ず suiteData から足す。
/** Light の例示に使う3つ（いちばん高い Crystal を含む現実的な組み合わせ）。 */
const LIGHT_EXAMPLE = sumBest(['crystal', 'resonance', 'prism']);

/** 単品合計に対する値引き率（%）。表示価格と同じ数値から計算する。 */
const off = (monthly: number, baseline: number) => Math.round((1 - monthly / baseline) * 100);

export interface ContinuumPlan {
  name: string;
  tag: string;
  /** 月額（円・税込）。表示も割引率もここから作る。文字列を別に持たない。 */
  priceYen: number;
  /** 表示用。priceYen から生成するので、手で書き換えない。 */
  price: string;
  setup?: string;
  compare?: string;
  features: string[];
  stripeUrl: string;
  featured?: boolean;
}

/** priceYen だけを書き、表示文字列はここで作る。 */
const plan = (p: Omit<ContinuumPlan, 'price'>): ContinuumPlan => ({ ...p, price: formatYen(p.priceYen) });

const LIGHT = 39800;
const COMPLETE = 79800;

export const CONTINUUM_PLANS: ContinuumPlan[] = [
  plan({
    name: 'Continuum Light',
    tag: 'まず3つの仕事を、AIに手放す',
    priceYen: LIGHT,
    compare: `例）Crystal＋Resonance＋Prism を、いちばん選ばれているプランでそろえると ${formatYen(LIGHT_EXAMPLE)} → ${off(LIGHT, LIGHT_EXAMPLE)}%お得`,
    features: [
      `${SUITE_COUNT}サービスから選べる3つ（いつでも入替可）`,
      'ぜんぶ上位プランでご利用OK',
      'ひとつのCOREアカウントで横断',
      'メールサポート',
    ],
    stripeUrl: '', // ← Stripeリンクをここに
  }),
  plan({
    name: 'Continuum Complete',
    tag: '事業のぜんぶを、AIの仕事に',
    priceYen: COMPLETE,
    // 比べている相手を必ず言う。「上位プラン」と書くと Prism Exclusive(¥29,800)や
    // Crystal Concierge(¥68,000)と比べたように読めるが、合計はそれより低い
    // 「いちばん選ばれているプラン」で出している（＝お得さを盛らない側に倒す）。
    compare: `いちばん選ばれているプランで${SUITE_COUNT}つそろえると ${formatYen(SUITE_BEST_TOTAL)} → ${off(COMPLETE, SUITE_BEST_TOTAL)}%お得。正社員ひとり（月30万円〜）の約1/4で、${SUITE_COUNT}人分のAIチーム`,
    features: [
      `${SUITE_COUNT}サービスすべて使い放題（各上位プラン）`,
      '返信・集客・接客・予約・分析まで全自動',
      '月次「時間レポート」— AIが代行した仕事量と、あなたに戻った時間を見える化',
      '優先サポート',
    ],
    stripeUrl: '', // ← Stripeリンクをここに
    featured: true,
  }),
  plan({
    name: 'Continuum Zero',
    tag: '仕事時間“ほぼゼロ”を、一緒に設計する',
    priceYen: 198000,
    setup: '¥298,000',
    features: [
      'Complete の全部',
      '導入・初期構築・運用チューニングまで完全代行（あなたの作業ゼロで立ち上がる）',
      '専属コンシェルジュによる月次レビュー',
      '四半期ライフプラン面談 — 戻った時間を「人間関係・趣味・家族」へどう使うかまで一緒に描く',
    ],
    stripeUrl: '', // ← Stripeリンクをここに
  }),
];
