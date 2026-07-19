// ============================================================
// CORE Studio — サイト制作・受託開発スタジオ
// プラン・価格・実績・文言の一元データ (ハードコード禁止方針)
// 価格や文言の変更はこのファイルだけを編集すれば全画面に反映される
// ============================================================

export const STUDIO = {
  name: 'CORE Studio',
  nameJa: 'CORE サイト制作・受託開発スタジオ',
  tagline: '1人で、チームの品質を。',
  taglineSub: 'AI-native な制作スタジオ',
  email: 'core.guild.inc@gmail.com',
  url: 'https://core-prism-app.vercel.app/studio',
} as const;

// ------------------------------------------------------------
// 3つの縦 (得意領域)
// ------------------------------------------------------------
export type Vertical = {
  id: string;
  title: string;
  copy: string;
  detail: string;
};

export const VERTICALS: Vertical[] = [
  {
    id: 'medical',
    title: '医療・歯科',
    copy: '専門性が伝わる、信頼のデザイン。',
    detail: '歯学部出身の制作者が、医療広告ガイドラインをふまえた品のあるサイトを設計します。予約導線・症例の見せ方まで一気通貫。',
  },
  {
    id: 'culture',
    title: '音楽・文化',
    copy: '世界観を、そのまま画面に。',
    detail: '現役チェリストとして舞台に立つ制作者が、教室・アーティスト・文化事業の空気感を壊さずウェブに翻訳します。',
  },
  {
    id: 'local',
    title: '地方創生',
    copy: '土地の物語を、外へひらく。',
    detail: '老舗旅館・伝統産業・地域事業のデジタル化を支援。100カ国を旅した視点で、外から見た魅力を設計に落とし込みます。',
  },
];

// ------------------------------------------------------------
// 制作4プラン (サイト制作)
// ------------------------------------------------------------
export type ProductionPlan = {
  id: 'spark' | 'core' | 'pro' | 'signature';
  name: string;
  price: string;        // 表示用
  minPrice: number;     // 万円
  maxPrice: number | null; // 万円 (null = 上限なし)
  lead: string;         // 一言
  scope: string;        // スコープ
  duration: string;     // 納期
  includes: string[];   // 含むもの
  bestFor: string;      // 向いている人
  faq: Array<{ q: string; a: string }>;
  featured?: boolean;
};

export const PRODUCTION_PLANS: ProductionPlan[] = [
  {
    id: 'spark',
    name: 'Spark',
    price: '¥5万',
    minPrice: 5,
    maxPrice: 5,
    lead: 'まず1枚、勝てるページを。',
    scope: '1ページ完結のLP。構成・文章・デザイン・公開まで込み。',
    duration: '最短3日〜1週間',
    includes: ['オリジナルデザイン1ページ', 'スマホ最適化', '問い合わせ導線 (メール/LINE)', '公開作業 (Vercel等・サーバー費0円構成)', '公開後1週間の微修正'],
    bestFor: '新サービスの告知、イベント集客、名刺代わりの1枚がほしい方',
    faq: [
      { q: '写真や文章がまだ無いのですが', a: 'ヒアリングをもとにこちらで原稿を書き起こします。写真は素材選定も代行します。' },
      { q: '独自ドメインは使えますか', a: '使えます。ドメイン取得費 (年1,500円前後) のみ実費でご負担ください。' },
    ],
  },
  {
    id: 'core',
    name: 'Core',
    price: '¥10〜30万',
    minPrice: 10,
    maxPrice: 30,
    lead: '事業の顔になる、コーポレートサイト。',
    scope: '5〜10ページ規模の企業・店舗・教室サイト。設計から運用開始まで。',
    duration: '2〜4週間',
    includes: ['トップ+下層5〜10ページ', 'ブランド設計 (配色・タイポグラフィ)', 'お知らせ更新の仕組み (CMS)', '問い合わせフォーム', '基本SEO・OGP設定', '公開後1ヶ月の伴走サポート'],
    bestFor: '会社・医院・教室・旅館など、信頼が売上に直結する事業',
    featured: true,
    faq: [
      { q: '自分で更新できますか', a: 'お知らせやブログは管理画面から更新できる構成にします。操作説明もお渡しします。' },
      { q: '既存サイトのリニューアルも可能ですか', a: '可能です。現行サイトの課題分析から入り、移行まで対応します。' },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '¥50〜100万',
    minPrice: 50,
    maxPrice: 100,
    lead: '予約も決済も、サイトの中で完結。',
    scope: '予約・決済・会員機能などを備えた本格ウェブサイト。',
    duration: '1〜2ヶ月',
    includes: ['Coreの全内容', '予約システム (カレンダー連携)', 'オンライン決済 (Stripe)', '会員・ログイン機能', 'AI接客・自動応対の組み込み', '多言語対応 (希望時)', '公開後3ヶ月の伴走サポート'],
    bestFor: '直販・直接予約で手数料を無くしたい旅館・サロン・スクール',
    faq: [
      { q: '決済手数料はかかりますか', a: 'Stripeの決済手数料 (3.6%) のみ。当スタジオへの中間手数料はありません。' },
      { q: '予約は既存の台帳と併用できますか', a: 'Googleカレンダー連携で既存の運用と共存できます。' },
    ],
  },
  {
    id: 'signature',
    name: 'Signature',
    price: '¥100万〜',
    minPrice: 100,
    maxPrice: null,
    lead: 'ブランドそのものを、共に作る。',
    scope: 'ブランド戦略からサイト・ツール群まで。デジタル領域の全てを設計。',
    duration: '2ヶ月〜',
    includes: ['ブランド戦略・言語化の伴走', 'サイト+LP群+SNS設計の統合', '独自機能の開発 (AI活用含む)', '撮影・コピーのディレクション', '公開後6ヶ月の専属サポート'],
    bestFor: 'デジタルを事業の柱に据えたい経営者。世界観に妥協したくないブランド',
    faq: [
      { q: '何から始まりますか', a: '2時間のブランドヒアリングから。事業の核を言葉にするところが起点です。' },
      { q: '支払いは分割できますか', a: '着手金・中間・納品の3分割が基本です。ご相談に応じます。' },
    ],
  },
];

// ------------------------------------------------------------
// 受託開発4Tier (アプリ・システム開発)
// ------------------------------------------------------------
export type DevTier = {
  id: 'mvp' | 'product' | 'scale' | 'enterprise';
  name: string;
  price: string;
  minPrice: number;     // 万円
  maxPrice: number;     // 万円
  lead: string;
  scope: string;
  duration: string;
  examples: string[];   // 機能例
  pricing: string;      // 価格の考え方
};

export const DEV_TIERS: DevTier[] = [
  {
    id: 'mvp',
    name: 'MVP',
    price: '¥50〜150万',
    minPrice: 50,
    maxPrice: 150,
    lead: 'アイデアを、最速で形に。',
    scope: '仮説検証のための最小プロダクト。コア機能に絞って最短で世に出す。',
    duration: '2週間〜1.5ヶ月',
    examples: ['ログイン+コア機能1つのWebアプリ', 'AIチャットボット・自動応対', '社内業務の自動化ツール', '予約・マッチングの原型'],
    pricing: 'AI-native開発により、従来の開発会社の1/3〜1/5の価格帯。画面数と連携する外部サービスの数で決まります。',
  },
  {
    id: 'product',
    name: 'Product',
    price: '¥150〜500万',
    minPrice: 150,
    maxPrice: 500,
    lead: '売り物になる、完成品を。',
    scope: '課金・複数ユーザー・管理画面を備えた、事業として運営できるプロダクト。',
    duration: '1.5〜3ヶ月',
    examples: ['サブスク課金つきSaaS', '多店舗対応の予約・顧客管理', 'AIを組み込んだ業務システム', 'モバイル対応PWAアプリ'],
    pricing: 'ユーザー種別 (一般/管理者/オーナー) の数と、決済・通知・外部連携の本数で見積もります。',
  },
  {
    id: 'scale',
    name: 'Scale',
    price: '¥500〜1,500万',
    minPrice: 500,
    maxPrice: 1500,
    lead: '成長に耐える、事業基盤を。',
    scope: '既に回っている事業のシステム化・大規模化。データ設計から運用体制まで。',
    duration: '3〜6ヶ月',
    examples: ['複数事業を束ねる業務OS', '大量データの分析・ダッシュボード', '既存システムからの移行・刷新', 'API公開・パートナー連携基盤'],
    pricing: '要件定義フェーズ (別途50万〜) で全体像を固めてから、マイルストーン単位で契約します。',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '¥1,500〜3,000万',
    minPrice: 1500,
    maxPrice: 3000,
    lead: '組織の中枢を、任せられる形で。',
    scope: '基幹システム級の開発。セキュリティ・監査・長期保守を前提とした設計。',
    duration: '6ヶ月〜',
    examples: ['基幹業務システムの刷新', '医療・金融など規制領域の開発', '複数拠点・多言語の統合基盤', '専任体制での継続開発'],
    pricing: '月額の専任契約 (ラボ型) か、フェーズ分割の請負か、事業に合わせて設計します。まずは要件整理からご相談ください。',
  },
];

// ------------------------------------------------------------
// 運用サブスク
// ------------------------------------------------------------
export type CarePlan = {
  id: string;
  name: string;
  price: string;
  lead: string;
  includes: string[];
};

export const CARE_PLANS: CarePlan[] = [
  {
    id: 'maintain',
    name: '保守・運用',
    price: '月 ¥1〜10万',
    lead: '公開後も、止まらない・古びない。',
    includes: ['稼働監視・障害時の即時対応', 'テキスト・写真の更新代行', 'セキュリティ・依存関係の更新', '月次レポート (アクセス・改善提案)', '軽微な機能追加 (プラン内)'],
  },
  {
    id: 'ai-subsc',
    name: 'サイト × AI サブスク',
    price: '月 ¥2〜5万〜',
    lead: '初期費用を抑えて、AIつきサイトを持つ。',
    includes: ['サイト制作費を月額に分散 (初期0円プランあり)', 'AI接客・自動応対を標準搭載', '毎月の改善サイクル (数値を見て磨き続ける)', '文章・バナーのAI生成サポート', 'いつでも買い取り移行可能'],
  },
];

// ------------------------------------------------------------
// Works 実績
// ------------------------------------------------------------
export type Work = {
  id: string;
  name: string;
  category: '企業サイト' | 'アプリ' | '個人';
  copy: string;
  url: string;
};

export const WORKS: Work[] = [
  { id: 'crossover', name: '株式会社クロスオーバー', category: '企業サイト', copy: 'エンタメ総合商社のシネマティックなコーポレートサイト。', url: 'https://crossover-psi.vercel.app/' },
  { id: 'gauche', name: 'GAUCHE チェロ音楽教室', category: '企業サイト', copy: '音楽教室の世界観をそのまま宿したブランドサイト。', url: 'https://gauche-cello-school.vercel.app/' },
  { id: 'asahikan', name: '朝日館', category: '企業サイト', copy: '老舗旅館の体験プランを直販するプレミアムサイト。', url: 'https://asahikan-premium.vercel.app/' },
  { id: 'anima', name: 'ANIMA', category: 'アプリ', copy: 'アニメ制作進行を一元管理する業務OS。進捗・経理・CRMまで。', url: 'https://core-anime-os.vercel.app/demo' },
  { id: 'morikawa', name: 'モデル個人サイト', category: '個人', copy: 'ポートフォリオと人柄が伝わる、静かな個人サイト。', url: 'https://morikawa-model.vercel.app/' },
];

// ------------------------------------------------------------
// About — GAUCHE の物語
// ------------------------------------------------------------
export const ABOUT = {
  title: '制作者について',
  name: '井出 直毅',
  alias: 'GAUCHE',
  story: [
    '歯学部で人体と向き合い、チューリッヒで音楽を学び、チェリストとして舞台に立ってきました。',
    '世界100カ国を旅して確かめたのは、どの土地でも、本物だけが残るということ。医療の厳密さ、音楽の呼吸、旅で磨いた審美眼——その全てを、ウェブという画面の上に注いでいます。',
    'AIを使いこなすことで、1人でもチームの品質と速度を出せる時代になりました。打ち合わせから設計・デザイン・実装・運用まで、間に誰も挟まず、最初に話した人間が最後まで作る。それがこのスタジオの品質の理由です。',
  ],
  facts: [
    { label: '経歴', value: '歯学部 / チューリッヒ音楽留学' },
    { label: '演奏', value: '現役チェリスト・アーティスト' },
    { label: '旅', value: '世界100カ国' },
    { label: '制作', value: 'AI-native フルスタック開発' },
  ],
} as const;
