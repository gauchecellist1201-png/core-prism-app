// ============================================================
// CORE Iris — 本物の公開募集 (実在・検証済み)
//
// オーナー指示 (2026-06-14):
//   「サンプルではなく、実在の公開募集を Web 収集して案件として実装。
//    インフルエンサーが本当に応募できる状態に。」
//
// ルール:
//   - applyUrl は実在し HTTP 200 を確認したもののみ (2026-06-14 検証)。
//   - 報酬は「商品提供」「コミッション」など事実ベースの形のみ記載。
//     金額を勝手に断定しない (詳細は公式ページが真実)。
//   - これは "練習用サンプル" ではなく、公式ページへ直接応募できる本物。
// ============================================================
import type { BrandCategory } from './brandDeals';

export interface OpenCall {
  id: string;
  name: string;            // プログラム名
  org: string;             // 運営 / ブランド
  category: BrandCategory;
  kind: 'brand' | 'platform' | 'aggregator';
  summary: string;         // 一行サマリ
  reward: string;          // 報酬の「形」(事実ベース)
  requirement: string;     // 応募条件 (概要)
  applyUrl: string;        // 実在の応募先 (検証済)
  verifiedAt: string;      // 検証日 YYYY-MM-DD
}

const V = '2026-06-14';

export const REAL_OPEN_CALLS: OpenCall[] = [
  {
    id: 'oc-dotst',
    name: '.st(ドットエスティ)公式アンバサダー',
    org: 'and ST / アダストリア',
    category: 'fashion',
    kind: 'brand',
    summary: '人気アパレル・コスメを試して SNS で発信する公式アンバサダー。',
    reward: '商品提供・最新アイテム先行体験',
    requirement: 'SNS で発信できる方（フォロワー数の細かい指定は公式参照）',
    applyUrl: 'https://www.dot-st.com/cp/st_ambassador',
    verifiedAt: V,
  },
  {
    id: 'oc-shiro',
    name: 'シロノサクラ。 美白ブランドアンバサダー 2026',
    org: 'シロノサクラ。',
    category: 'beauty',
    kind: 'brand',
    summary: '美白スキンケアの認知拡大に協力する 2026 通年アンバサダー。',
    reward: '商品提供（製品体験）',
    requirement: '国内在住 20〜39 歳・X / Instagram / TikTok の公開アカウント',
    applyUrl: 'https://shop.shiro-no-sakura.com/pages/ambassador_recruitment2026',
    verifiedAt: V,
  },
  {
    id: 'oc-brandcosme',
    name: 'ブランドコスメ アンバサダープログラム',
    org: 'ブランドコスメ',
    category: 'beauty',
    kind: 'brand',
    summary: 'デパコスを体験して Instagram で感想を発信するメンバー募集。',
    reward: '商品代をブランド負担（商品提供）',
    requirement: 'Instagram で発信できる方',
    applyUrl: 'https://www.brandcosme.com/pages/ambassador-program',
    verifiedAt: V,
  },
  {
    id: 'oc-koubo',
    name: 'Koubo アンバサダー公募一覧',
    org: 'Koubo（公募ポータル）',
    category: 'lifestyle',
    kind: 'aggregator',
    summary: '常に新しいアンバサダー・特派員募集が集まる公募ポータル。',
    reward: '案件により異なる（謝礼・商品提供 等）',
    requirement: '各募集ページの条件を参照',
    applyUrl: 'https://koubo.jp/category/nonsection/ambassador',
    verifiedAt: V,
  },
  {
    id: 'oc-andbuzz',
    name: '&Buzz コスメ系インフルエンサー募集',
    org: '&Buzz（AndBuzz）',
    category: 'beauty',
    kind: 'platform',
    summary: 'フォロワー制限なしのコスメ案件など、口コミ案件が多数。',
    reward: '商品提供・案件報酬（案件により異なる）',
    requirement: '美容系インスタグラマー（フォロワー制限なし案件あり）',
    applyUrl: 'https://andbuzz.net/',
    verifiedAt: V,
  },
  {
    id: 'oc-snapmart',
    name: 'Snapmart アンバサダー / 写真案件',
    org: 'Snapmart',
    category: 'lifestyle',
    kind: 'platform',
    summary: '写真・ライフスタイル発信で参加できるアンバサダー & 撮影案件。',
    reward: '報酬・商品提供（案件により異なる）',
    requirement: 'スマホ写真を投稿できる方（フォロワー数は不問の案件あり）',
    applyUrl: 'https://snapmart.jp/',
    verifiedAt: V,
  },
];

export const KIND_META: Record<OpenCall['kind'], { label: string; color: string }> = {
  brand:      { label: '公式ブランド募集', color: '#E1306C' },
  platform:   { label: 'マッチング',       color: '#833AB4' },
  aggregator: { label: '公募ポータル',     color: '#3B82F6' },
};

export function getRealOpenCalls(): OpenCall[] {
  return REAL_OPEN_CALLS;
}
