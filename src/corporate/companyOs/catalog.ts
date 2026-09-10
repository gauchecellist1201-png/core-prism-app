/** Public service design. Estimates are not existing contracts or performance claims. */
export const COMPANY_OS_VERSION = '2026-09-10.v1';
export const COMPANY_OS_PACKAGES = [
  { id: 'scan', name: 'AI Company Scan', price: '30〜50万円', scope: '経営者面談・重点業務3つ・Baseline・設計図・90日計画', term: '2〜3週間' },
  { id: 'department', name: 'Department OS', price: '100〜300万円', scope: '1部門の業務再設計・接続・承認・教育・成果測定', term: '4〜8週間' },
  { id: 'starter', name: 'Company OS Starter', price: '300〜500万円', scope: '2部門をつなぐ業務フローと会社記憶', term: '8〜12週間' },
  { id: 'pro', name: 'Company OS Pro', price: '500〜1,500万円', scope: '経営・営業・成長・ナレッジなど3〜5部門の統合', term: '12〜20週間' },
  { id: 'enterprise', name: 'Enterprise Company OS', price: '1,500〜5,000万円以上', scope: '全社・複数拠点の段階展開、統制と運用移管', term: '6〜12か月以上' },
  { id: 'update', name: 'CORE OS Update', price: '月30〜150万円以上', scope: 'モデル・Agent・業務の改善、ROAIレビュー、保守', term: '継続運用' },
] as const;
export const COMPANY_OS_OUTCOMES = [
  ['経営を速くする', 'CEO / Strategy / Finance', '数字と判断の根拠を集め、経営者が比較し、決められる状態へ。'],
  ['顧客を増やす', 'Growth / Marketing / Sales / CS', '商談の記録から提案・フォロー・CRM入力までをつなぎ、顧客と向き合う時間を増やす。'],
  ['人の力を広げる', 'Identity / HR', '役割と知識を見える形にし、採用・育成・引継ぎを支える。最終判断は人が担う。'],
  ['会社の記憶をつくる', 'Knowledge', '過去の商談・資料・経営判断を、出所をたどれる会社専用の記憶へ。'],
  ['価値を伝える', 'Creative / CORE Studio', '企業の核を、映像・ブランド・SNS・提案書で一貫して伝える。'],
  ['安心して任せる', 'Legal / Security / Governance', '契約や支払いなどの重要な操作に、人の承認と記録を組み込む。'],
] as const;
export const COMPANY_OS_COPY = {
  a: 'AIを導入するのではない。AI前提で、会社そのものを再設計する。',
  b: '人が価値を生む仕事に集中できる会社へ。御社専用のAI Company OSを。',
};
