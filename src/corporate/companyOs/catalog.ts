/** Public offer scopes; existing product/Stripe IDs are deliberately unchanged. */
import { FILM_PLANS, CAMPAIGN, isCampaignLive } from '../../studio/film';
export const COMPANY_OS_VERSION = '2026-09-11.v2';
export const OFFER_PRICES = { growth: 300000, scan: 200000, build: 1200000, update: 100000 } as const;
export function studioEntry(now = new Date()) {
  const p = FILM_PLANS.find(p => p.id === 'standard')!;
  const live = isCampaignLive(now);
  return { gross: p.priceYen,
    note: live ? `${CAMPAIGN.untilLabel}のご発注分まで。${CAMPAIGN.nextLabel}以降は税込${(p.listPriceYen ?? p.priceYen).toLocaleString('ja-JP')}円へ改定予定。` : '30秒1本。最終金額はヒアリング後に確定します。' };
}
export const COMPANY_OS_PACKAGES = [
  { id: 'studio', name: 'CORE Studio', outcome: '価値が伝わる、映像とWebを。', for: '新商品・採用・開業など、伝える目的が決まっている企業へ。',
    scope: ['映像は企画・台本・絵コンテから制作', '標準30秒1本・複数の尺と形式で納品', '修正1回・広告への二次利用込み'],
    term: '映像は初稿約1週間。最終納期は確認工程を含めて合意。',
    exclude: 'Web制作・撮影・追加修正は別見積。初回15秒プランは税込49,800円、広告二次利用は別相談。',
    persona: '広報・採用を兼任する担当者と、品質・納期を確認する経営者。まず商談やSNSで使える制作物が必要な方に。',
    href: '/studio', cta: '制作内容と実例を見る' },
  { id: 'growth', name: 'CORE Growth', outcome: '発信を、問い合わせと商談へ。', for: '発信が続かない、反応と売上がつながらない企業へ。',
    scope: ['1ブランド・1SNS・1商材に集中', '短尺動画2本/月・投稿文4案', '問い合わせ導線・計測・月次改善会'],
    term: '初回3か月。その後は1か月単位で更新。',
    exclude: '広告費・広告運用代行・新規LP制作・撮影・コメント監視は含みません。投稿と送信はお客様の最終確認・実行。',
    persona: '広報が少人数のBtoB・高単価サービス企業。営業責任者と一緒に、問い合わせの質や商談化まで確認できる方に。',
    href: '/corp#contact', cta: '集客の課題を相談する' },
  { id: 'company', name: 'CORE Company OS', outcome: '転記と確認待ちを、仕事の流れから減らす。', for: '商談後の処理や資料探しに時間を取られている企業へ。',
    scope: ['まず1部門・1業務フローから構築', '既存システム2つまでの接続', '会社記憶・承認・テスト・教育・成果測定'],
    term: '構築6〜8週間＋安定化30日。利用者10名目安。',
    exclude: 'AI・SaaS・クラウド実費は別。基幹移行・独自アプリ・専用環境・厳格なSLAは個別見積。',
    persona: '営業や事務の反復業務がある20〜150名程度の企業。経営者・現場・情報管理の責任者が、一緒に導入を進められる方に。',
    href: '/corp#contact', cta: '業務の改善を相談する' },
] as const;
export const COMPANY_OS_OUTCOMES = [
  ['経営を速くする', 'CEO / Strategy / Finance', '数字と判断の根拠を集め、比較して決める。'],
  ['顧客を増やす', 'Growth / Marketing / Sales / CS', '制作、商談、提案、フォロー、顧客管理をつなぐ。'],
  ['人の力を広げる', 'Identity / HR', '役割・育成・引継ぎを支援。採用と評価は人が判断。'],
  ['会社の記憶をつくる', 'Knowledge', '商談・資料・経営判断を、出所をたどれる記憶へ。'],
  ['価値を伝える', 'Creative / CORE Studio', '企業の核を映像・Web・提案書へ。'],
  ['安心して任せる', 'Legal / Governance', '重要な操作には、人の承認と記録を。'],
] as const;
export const COMPANY_OS_COPY = {
  a: 'AIを導入するのではない。AI前提で、会社そのものを再設計する。',
  b: '人が価値を生む仕事に集中できる会社へ。御社専用のAI Company OSを。',
};
