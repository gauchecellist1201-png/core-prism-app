// ============================================================
// CORE Continuum — 統合パッケージの共有データ
// /corp のセクションと /continuum LP の両方がこれを参照する（価格の二重管理を防ぐ）。
// stripeUrl: Stripe決済リンクを貼るだけでボタンが「このプランで始める」に変わる。
// 空の間は mailto の個別相談に自動フォールバック（動かないボタンを出さない）。
// ============================================================

export const CONTINUUM_CONTACT_EMAIL = 'core.inc.guild@gmail.com';

export interface ContinuumPlan {
  name: string;
  tag: string;
  price: string;
  setup?: string;
  compare?: string;
  features: string[];
  stripeUrl: string;
  featured?: boolean;
}

export const CONTINUUM_PLANS: ContinuumPlan[] = [
  {
    name: 'Continuum Light',
    tag: 'まず3つの仕事を、AIに手放す',
    price: '¥39,800',
    compare: '例）Crystal＋Resonance＋Prism を単品でそろえると 約¥74,400 → ほぼ半額',
    features: [
      '6サービスから選べる3つ（いつでも入替可）',
      'ぜんぶ上位プランでご利用OK',
      'ひとつのCOREアカウントで横断',
      'メールサポート',
    ],
    stripeUrl: '', // ← Stripeリンクをここに
  },
  {
    name: 'Continuum Complete',
    tag: '事業のぜんぶを、AIの仕事に',
    price: '¥79,800',
    compare: '単品合計 約¥109,000 → 27%お得。正社員ひとり（月30万円〜）の約1/4で、6人分のAIチーム',
    features: [
      '6サービスすべて使い放題（各上位プラン）',
      '返信・集客・接客・予約・分析まで全自動',
      '月次「時間レポート」— AIが代行した仕事量と、あなたに戻った時間を見える化',
      '優先サポート',
    ],
    stripeUrl: '', // ← Stripeリンクをここに
    featured: true,
  },
  {
    name: 'Continuum Zero',
    tag: '仕事時間“ほぼゼロ”を、一緒に設計する',
    price: '¥198,000',
    setup: '¥298,000',
    features: [
      'Complete の全部',
      '導入・初期構築・運用チューニングまで完全代行（あなたの作業ゼロで立ち上がる）',
      '専属コンシェルジュによる月次レビュー',
      '四半期ライフプラン面談 — 戻った時間を「人間関係・趣味・家族」へどう使うかまで一緒に描く',
    ],
    stripeUrl: '', // ← Stripeリンクをここに
  },
];
