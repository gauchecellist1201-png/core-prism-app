// ============================================================
// CORE Iris — LP の料金表（データ）
//
// なぜ画面(IrisLanding.tsx)から切り出したか — 2026-08-19:
//   LP の Standard(¥6,980) のカードに「AI企画・台本スタジオ」と書いてあったが、
//   アプリ側の企画・台本スタジオは PLAN_LIMITS で Pro(¥12,800) 限定になっており、
//   Standard を契約した人がそのタブを開くと「最上位プラン Pro 限定」の錠前が出ていた。
//   しかも LP には Pro が1枚も載っていないため、錠前の「Pro にアップグレード」は
//   値段も存在も知らされていないプランへの行き止まりだった。
//
// ルール:
//   ここに書ける約束は「ゲート表(PLAN_LIMITS)が実際に開けるもの」だけ。
//   使える前提で書いた機能は requires に FeatureKey を並べる。
//   __tests__/lpPlans.test.ts が checkFeature() で1つずつ実測して落とす。
//   （文言だけ足して requires を書き忘れる事故も、キーワード照合で捕まえる）
// ============================================================
import type { FeatureKey, PlanId } from '../lib/billing';

export interface LpPlan {
  id: PlanId;
  name: string;
  tag: string;
  price: string;
  suffix: string;
  features: string[];
  /** このカードが「使える」と約束している機能。テストが実測で守る */
  requires?: FeatureKey[];
  /**
   * ボタンの下に出す但し書き。
   * 有料プランを選ぶ経路は CheckoutModal が Stripe へ渡すので**カード登録が要る**
   * （CheckoutModal.tsx: `if (!isFree)` のときだけ /api/stripe/checkout を叩く）。
   * ここに「クレカ不要」と書くと嘘になるので、テストが keyword で禁止している。
   */
  note: string;
  /** 有料プラン = 申し込みにカードが要る */
  cardRequired: boolean;
  highlight?: boolean;
}

export const IRIS_LP_PLANS: LpPlan[] = [
  {
    id: 'lite',
    name: 'Lite',
    tag: 'まずはリールを作りたい',
    price: '¥2,980',
    suffix: '/ 月',
    features: [
      'おまかせ3タップのリール作成',
      '字幕3スタイル・16テーマ',
      'AI投稿文・ハッシュタグ 月30回',
      'AI相談 月30回',
      '予約投稿',
    ],
    requires: ['caption-ai', 'ai-chat'],
    note: '最初の3日 ¥0 → 4日目から ¥2,980/月 · カード登録あり · いつでも解約',
    cardRequired: true,
  },
  {
    id: 'standard',
    name: 'Standard',
    tag: '毎週ちゃんと伸ばしたい',
    price: '¥6,980',
    suffix: '/ 月',
    features: [
      'Lite の全機能',
      'チャット・音声での編集指示 無制限',
      'AI投稿文・交渉文・案件精査 無制限',
      'アカウント分析と改善提案 月10回',
      '30日ストーリー設計 月5回',
      '優先サポート',
    ],
    requires: ['ai-chat', 'caption-ai', 'negotiation-ai', 'triage-ai', 'instagram-analyze', 'story-arc'],
    note: '最初の3日 ¥0 → 4日目から ¥6,980/月 · カード登録あり · いつでも解約',
    cardRequired: true,
    highlight: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    tag: '運用代行・チームで回したい',
    price: '¥12,800',
    suffix: '/ 月',
    features: [
      'Standard の全機能',
      'AI企画・台本スタジオ（運用代行モード）',
      'ブランドマッチ（案件の自動マッチ）',
      'アカウント分析 無制限',
      '連携アカウント 5',
    ],
    requires: ['script-studio', 'brand-match', 'instagram-analyze', 'team-members'],
    note: '最初の3日 ¥0 → 4日目から ¥12,800/月 · カード登録あり · いつでも解約',
    cardRequired: true,
  },
];

/** 有料プランの但し書きに書いてはいけない言葉（カードが要るのに「不要」と書く事故） */
export const CARD_FREE_CLAIMS = ['クレカ不要', 'クレジットカード不要', 'カード登録なし', 'カード不要'];

/**
 * 「この言葉を書いたら、この機能が開いていないと嘘になる」対応表。
 * requires の書き忘れを文言側から捕まえるための保険（テスト専用ではなく実体）。
 */
export const LP_CLAIM_KEYWORDS: { keyword: string; feature: FeatureKey }[] = [
  { keyword: '台本スタジオ', feature: 'script-studio' },
  { keyword: 'ブランドマッチ', feature: 'brand-match' },
  { keyword: 'AI動画生成', feature: 'video-gen' },
  { keyword: '統合ナレッジ脳', feature: 'knowledge-brain' },
];
