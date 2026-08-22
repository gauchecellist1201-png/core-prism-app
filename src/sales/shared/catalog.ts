// ============================================================
// CORE Studio Sales OS — 商品カタログ / 価格 / ターゲット定義
//
// ここが「営業OSが客先に出してよい金額」の唯一の正本。
// AI プロンプトも画面も必ずここを読む (プロンプトに数字を直書きしない)。
// ============================================================
import type { Stage, StageMeta, TargetTier } from './types';

// ---- 商品 ----------------------------------------------------------------
export interface Product {
  id: string;
  name: string;
  tagline: string;
  /** 表示用。'〜' は下限を意味する */
  price: string;
  /** 計算用。'〜' 付きは下限値 */
  priceYen: number;
  /** 月額課金か */
  recurring: boolean;
  /** 月あたりの本数 (単発は 1) */
  count: number;
  purpose: string;
  uses: string[];
  /** どのターゲット区分に薦めるか */
  forTiers: TargetTier[];
}

export const PRODUCTS: Product[] = [
  {
    id: 'entry',
    name: 'ENTRY',
    tagline: 'AI動画制作 1本',
    price: '¥49,800〜',
    priceYen: 49800,
    recurring: false,
    count: 1,
    purpose: '初回取引のハードルを下げる',
    uses: ['はじめてのAI動画', '社内稟議を通すための実物', '1本だけ試したい'],
    forTiers: ['B', 'C'],
  },
  {
    id: 'm4',
    name: 'MONTHLY LIGHT',
    tagline: '月4本',
    price: '¥148,000〜',
    priceYen: 148000,
    recurring: true,
    count: 4,
    purpose: '発信を止めずに続ける最小構成',
    uses: ['SNS投稿', 'Instagram Reels', 'TikTok', '広告クリエイティブ', '商品PR'],
    forTiers: ['B', 'C'],
  },
  {
    id: 'm8',
    name: 'MONTHLY STANDARD',
    tagline: '月8本',
    price: '¥248,000〜',
    priceYen: 248000,
    recurring: true,
    count: 8,
    purpose: '当たり外れを見ながら方向を寄せる',
    uses: ['SNS運用', '広告ABテスト', '採用', '商品PR', '複数シリーズ運用'],
    forTiers: ['A', 'B', 'C'],
  },
  {
    id: 'm12',
    name: 'MONTHLY PRO',
    tagline: '月12本以上',
    price: '¥348,000〜',
    priceYen: 348000,
    recurring: true,
    count: 12,
    purpose: '複数チャネル・複数テーマを並行で回す',
    uses: ['本格SNS運用', '広告運用', '複数商品', '採用', 'ブランドコンテンツ', '継続ショートドラマ'],
    forTiers: ['A', 'B'],
  },
  {
    id: 'oem',
    name: 'AGENCY / OEM',
    tagline: '代理店・OEM (ホワイトラベル)',
    price: '卸 ¥49,800／本',
    priceYen: 49800,
    recurring: false,
    count: 1,
    purpose: 'CORE が裏側のAI映像制作チームになる。代理店は自社ブランドで再販できる',
    uses: ['既存クライアントへのメニュー追加', 'AI人材の採用なしで制作力を持つ', '顧客単価UP'],
    forTiers: ['A'],
  },
];

export const productById = (id: string): Product | null =>
  PRODUCTS.find(p => p.id === id) ?? null;

/** 代理店の想定再販レンジ (卸 ¥49,800 に対して) */
export const OEM_RESALE = { low: 98000, high: 150000 };

export function oemMargin(resale: number): { margin: number; marginPct: number } {
  const cost = productById('oem')?.priceYen ?? 49800;
  const margin = Math.max(0, resale - cost);
  return { margin, marginPct: resale > 0 ? Math.round((margin / resale) * 100) : 0 };
}

// ---- 公開LP (/studio/film) の価格スナップショット -------------------------
// 正本は src/studio/film.ts の FILM_PLANS / MONTHLY_PLANS。
// ここは「営業OSの金額が公開ページと食い違っていないか」を検知するためだけの控え。
// src/sales/__tests__/priceParity.test.ts が film.ts と突き合わせるので、
// 公開価格が変わればテストが落ちる (黙って古くならない)。
export const PUBLISHED_SNAPSHOT_DATE = '2026-08-22';

export const PUBLISHED_PRICES: Array<{ label: string; yen: number; note: string }> = [
  { label: '単発1本 TRIAL (20秒)', yen: 49800, note: '初めてのお取引にかぎった1本' },
  { label: '単発1本 STANDARD (40秒)', yen: 128000, note: '' },
  { label: '単発1本 PREMIUM (60秒)', yen: 298000, note: '〜' },
  { label: '月4本', yen: 228000, note: '' },
  { label: '月8本', yen: 398000, note: '' },
  { label: '月12本', yen: 548000, note: '' },
];

export interface PriceConflict {
  product: string;
  salesOsYen: number;
  publishedYen: number;
  diffYen: number;
  message: string;
}

/**
 * 営業OSのカタログ価格と、公開中の /studio/film の価格の食い違いを返す。
 * 食い違ったまま金額を客先に出すと「サイトと違う」で信用を落とすので、
 * 画面はこれが 1 件でもあるかぎり赤い警告を出し続ける。
 */
export function priceConflicts(): PriceConflict[] {
  const pairs: Array<{ productId: string; publishedLabel: string }> = [
    { productId: 'm4', publishedLabel: '月4本' },
    { productId: 'm8', publishedLabel: '月8本' },
    { productId: 'm12', publishedLabel: '月12本' },
  ];
  const out: PriceConflict[] = [];
  for (const { productId, publishedLabel } of pairs) {
    const p = productById(productId);
    const pub = PUBLISHED_PRICES.find(x => x.label === publishedLabel);
    if (!p || !pub) continue;
    if (p.priceYen === pub.yen) continue;
    out.push({
      product: `${p.name} (${p.tagline})`,
      salesOsYen: p.priceYen,
      publishedYen: pub.yen,
      diffYen: pub.yen - p.priceYen,
      message: `営業OSは ${yen(p.priceYen)}、公開中の /studio/film は ${yen(pub.yen)}。どちらかに揃えるまで、この金額をお客様に出さないでください。`,
    });
  }
  return out;
}

export const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`;

// ---- ターゲット ----------------------------------------------------------
export interface TargetDef {
  tier: TargetTier;
  label: string;
  headline: string;
  /** 業種キーワード (分析結果の industry / business 文字列と照合) */
  keywords: string[];
  /** その区分に対する営業の一言 */
  pitch: string;
  color: string;
}

export const TARGETS: TargetDef[] = [
  {
    tier: 'A',
    label: 'TARGET A — 代理店/制作会社 (OEM)',
    headline: 'CORE を御社のAI映像制作部門として使ってもらう',
    keywords: [
      '広告代理店', '代理店', 'SNS運用', 'SNSマーケティング', 'Web制作', 'ホームページ制作',
      '映像制作', '動画制作', 'マーケティング', 'PR', '広報支援', '採用支援', 'ブランディング',
      'デジタルマーケティング', '制作会社', 'クリエイティブ',
    ],
    pitch: '営業は御社、制作はCORE。AI人材を採用せずに映像メニューを増やせます。',
    color: '#D8A83B',
  },
  {
    tier: 'B',
    label: 'TARGET B — 動画関連の求人を出している企業',
    headline: '採用が決まるまでの間、外部AI制作チームとして使ってもらう',
    keywords: [
      '動画編集', 'SNS運用', 'TikTok運用', 'Instagram運用', 'YouTube運用', 'Webマーケター',
      '広告クリエイター', '動画クリエイター', 'コンテンツ制作', '採用広報',
    ],
    pitch: '求人が出ている＝いま動画の需要がある。採用・教育・人件費・退職リスクを抱える前に、制作量だけ先に確保できます。',
    color: '#16C77A',
  },
  {
    tier: 'C',
    label: 'TARGET C — 動画と相性の高い業種',
    headline: '映像で魅力が伝わる商材を持っている企業',
    keywords: [
      '美容クリニック', '美容', 'クリニック', 'サロン', '不動産', '建築', 'ホテル', '観光',
      '人材', '採用', 'SaaS', 'IT', 'EC', 'D2C', '飲食', 'スクール', '教育', '医療',
      '士業', 'イベント', '自動車', '高級', 'ファッション', 'コスメ',
    ],
    pitch: '撮影・キャスティング・スタジオ・ロケを使わずに、これまで予算的に無理だった画が撮れます。',
    color: '#4DC3FF',
  },
  {
    tier: 'X',
    label: '区分なし',
    headline: '相性を判断できるだけの材料がまだ無い',
    keywords: [],
    pitch: '',
    color: '#7A8494',
  },
];

export const targetByTier = (t: TargetTier): TargetDef =>
  TARGETS.find(x => x.tier === t) ?? TARGETS[TARGETS.length - 1];

/** 業種文字列からターゲット区分を推定 (AI が外した時の保険。AI 指定を上書きはしない) */
export function guessTier(text: string): TargetTier {
  const s = (text || '').toLowerCase();
  for (const t of TARGETS) {
    if (t.tier === 'X') continue;
    if (t.keywords.some(k => s.includes(k.toLowerCase()))) return t.tier;
  }
  return 'X';
}

// ---- ステージ ------------------------------------------------------------
export const STAGES: StageMeta[] = [
  { id: 'NEW', label: '未分析', step: 0, color: '#7A8494', nextHint: '企業分析をかける' },
  { id: 'ANALYZED', label: '分析ずみ', step: 1, color: '#4DC3FF', nextHint: '電話またはメールで接触する' },
  { id: 'CONTACTED', label: '接触ずみ', step: 2, color: '#5B8DEF', nextHint: '返事が無ければ追客する' },
  { id: 'REPLIED', label: '返信あり', step: 3, color: '#A78BFA', nextHint: '5分の打合せに繋げる' },
  { id: 'MEETING', label: '商談', step: 4, color: '#F59E0B', nextHint: '企画3案を出して提案へ' },
  { id: 'PROPOSAL', label: '提案ずみ', step: 5, color: '#FB923C', nextHint: '初回1本 (ENTRY) で着地させる' },
  { id: 'TRIAL', label: '初回受注', step: 6, color: '#34D399', nextHint: '納品後に月額へ引き上げる' },
  { id: 'WON', label: '受注 (単発)', step: 7, color: '#16C77A', nextHint: '月額プランを提案する' },
  { id: 'MONTHLY', label: '月額継続', step: 8, color: '#10B981', nextHint: '本数の引き上げ・別部署への横展開' },
  { id: 'OEM', label: 'OEMパートナー', step: 9, color: '#D8A83B', nextHint: '案件数を増やす。共同提案に同席する' },
  { id: 'LOST', label: '失注', step: -1, color: '#6B7280', nextHint: '90日後に新しい企画で再アプローチ' },
];

export const stageMeta = (s: Stage): StageMeta =>
  STAGES.find(x => x.id === s) ?? STAGES[0];

/** ファネル表示に使う段 (LOST を除く) */
export const FUNNEL_STAGES: Stage[] = [
  'NEW', 'ANALYZED', 'CONTACTED', 'REPLIED', 'MEETING', 'PROPOSAL', 'TRIAL', 'WON', 'MONTHLY', 'OEM',
];

/** 受注として数える段 */
export const WON_STAGES: Stage[] = ['TRIAL', 'WON', 'MONTHLY', 'OEM'];


// ---- 追客 (フォローアップ) ------------------------------------------------
export interface FollowUpStep {
  /** 前回接触からの日数 */
  afterDays: number;
  /** 何回目の接触か (1 = 初回なので追客は 2 から) */
  touch: number;
  angle: string;
  /** AI に渡す「今回は何を送るか」 */
  instruction: string;
}

// 毎回同じ営業文を送らない。回ごとに送る中身を変える。
export const FOLLOWUPS: FollowUpStep[] = [
  { afterDays: 3, touch: 2, angle: '企画提案', instruction: '前回の企画のうち1案だけを、より具体的な15秒の構成に落として送る。売り込みの語を足さない。' },
  { afterDays: 7, touch: 3, angle: '制作事例', instruction: '同じ業種・近い商材での制作事例を1つだけ挙げ、その動画が何を狙っていたかを1段落で書く。' },
  { afterDays: 14, touch: 4, angle: '新しい動画企画', instruction: '前回までとは別の切り口 (採用 / 商品 / ブランドのうち未提案のもの) で新しい企画を1本出す。' },
  { afterDays: 30, touch: 5, angle: '新プラン・体制の提案', instruction: '単発ではなく継続で回した場合の作り方の違いを説明する。金額は書かない。' },
  { afterDays: 90, touch: 6, angle: '季節・イベント企画', instruction: '時期に合わせた企画 (年末年始/新生活/決算期/採用シーズン等) を1本提案する。' },
];

export function nextFollowUp(touch: number): FollowUpStep {
  return FOLLOWUPS.find(f => f.touch === touch + 1) ?? FOLLOWUPS[FOLLOWUPS.length - 1];
}

// ---- ポジショニング (AI プロンプトの土台) --------------------------------
export const POSITIONING = {
  // 「AI動画制作会社」として売らない
  weAre: '企業の外部AI映像制作部 / 広告代理店のAI映像制作チーム',
  weAreNot: 'AI動画を1本いくらで売る制作会社',
  goal: '単発ではなく、継続契約・月額契約・OEM を最終ゴールにする',
  strengths: [
    '映画・CMレベルの映像品質',
    '企画力・ストーリー設計',
    '縦型ショートドラマ / 企業紹介 / 採用 / 商品PR / ブランドムービー',
    'AIキャラクター・AI人物出演',
    '撮影不要',
  ],
  customerSaves: ['撮影費', 'キャスティング費', 'スタジオ費', 'ロケ費', '編集費', '撮影スケジュール調整'],
};

/** コールドメール・電話トークで金額を書いてよいか。
 *  公開LPと食い違っている間は false → 生成物から金額を外す。 */
export function mayQuotePrice(): boolean {
  return priceConflicts().length === 0;
}
