// ============================================================
// CORE ROAI MODEL — 「AIが何を返したか」を 5 つの Return で分類する正本。
//
// Return on AI という言葉自体は一般的な経営概念として扱う（CORE の造語ではない）。
// CORE の独自性は、この 5 分類（CORE ROAI MODEL）と、それを測る CORE ROAI SCORE、
// 実装まで回す CORE TRANSFORMATION LOOP にある。
//
// ここは「言葉と分類」だけ。数値の重みは engine.ts の WEIGHTS、質問は schema.ts。
// ============================================================

export type ReturnKey = 'grow' | 'save' | 'accelerate' | 'protect' | 'create';

export interface ReturnDef {
  key: ReturnKey;
  no: string;
  en: string;
  ja: string;
  /** 1 行の定義 */
  lead: string;
  /** 何を測るか（経営言語） */
  metrics: string[];
  /** この Return を生む代表的な AI 領域（技術名ではなく、経営成果に対応する名前） */
  useCases: string[];
}

export const RETURNS: ReturnDef[] = [
  {
    key: 'grow', no: '01', en: 'GROW', ja: '売上・利益・顧客価値を増やす',
    lead: '営業の時間を商談へ戻し、見込み客への返答を速め、既存顧客からの売上を増やす。',
    metrics: ['売上成長', '商談→受注率', '顧客LTV', '営業1人あたりの生産性', '休眠顧客の再活性', 'アップセル／クロスセル'],
    useCases: ['Sales AI（提案・見積の自動作成）', 'Lead Scoring（優先すべき見込み客の判定）', 'CRM Intelligence（顧客データからの次の一手）', 'AI Sales Agent（一次対応・日程調整）'],
  },
  {
    key: 'save', no: '02', en: 'SAVE', ja: 'コスト・工数を減らす',
    lead: '転記・チェック・定型文書・メール対応など、人がやる必要のない仕事を AI と自動化へ移す。',
    metrics: ['人件費（時間換算）', '外注費', '管理部門コスト', '手作業の時間', '開発コスト', 'AI／API 利用料（差し引き）'],
    useCases: ['Business Process Automation（入力・転記・照合）', 'Document AI（報告書・議事録・契約書の下書き）', 'Support AI（問い合わせ一次対応）', 'Back Office AI（請求・経費・勤怠）'],
  },
  {
    key: 'accelerate', no: '03', en: 'ACCELERATE', ja: '企業の速度を上げる',
    lead: '意思決定・承認・調査・提案・開発のリードタイムを縮め、機会を逃さない会社にする。',
    metrics: ['意思決定までの時間', '承認・稟議の日数', '顧客への初回返答時間', '提案作成の時間', '開発リードタイム', 'Time to Market'],
    useCases: ['Decision Intelligence（経営数字の即日可視化）', 'Knowledge AI（社内情報の即答）', 'Research AI（調査・分析の自動化）', 'Workflow AI（承認・稟議の短縮）'],
  },
  {
    key: 'protect', no: '04', en: 'PROTECT', ja: '損失・リスクを減らす',
    lead: '情報漏洩・人的ミス・不正・属人化・品質事故を、起きる前に検知して減らす。',
    metrics: ['期待損失（発生確率 × 影響額）', '人的ミス件数', 'コンプライアンス違反', '品質不良', '属人化した業務の数', '事業継続性'],
    useCases: ['AI Security Review（コード・設定の脆弱性検出）', 'Error Prevention（入力・計算・転記の自動照合）', 'Compliance AI（契約・規程のチェック）', 'Knowledge Retention（属人ノウハウの形式知化）'],
  },
  {
    key: 'create', no: '05', en: 'CREATE', ja: '新しい価値を生む',
    lead: '自社のデータと業務を、新しいサービス・顧客体験・事業へ変える。',
    metrics: ['新規売上', '新サービスの数', '顧客体験の変化', '新しい事業モデル', 'AI Native な事業の立ち上げ'],
    useCases: ['Customer AI Agent（顧客向け 24 時間対応）', 'Vertical AI SaaS（業界特化の自社サービス）', '既存サービスの AI 化', 'AI Native New Business'],
  },
];

export const RETURN_BY_KEY: Record<ReturnKey, ReturnDef> = Object.fromEntries(RETURNS.map(r => [r.key, r])) as Record<ReturnKey, ReturnDef>;

/** CORE TRANSFORMATION LOOP — 納品で終わらず、測って進化させる 8 段。 */
export const TRANSFORMATION_LOOP: { en: string; ja: string; body: string }[] = [
  { en: 'UNDERSTAND', ja: '理解する', body: '事業・業務・数字・データ・リスクを読む。どこで価値が失われているかを特定する。' },
  { en: 'DEFINE', ja: '定義する', body: '経営目標・ベースライン・KPI・目標 ROAI を決める。ここで「作るもの」はまだ決めない。' },
  { en: 'REDESIGN', ja: '再設計する', body: '人・AI・エージェント・ソフトウェア・データの役割分担で、業務と組織を組み直す。' },
  { en: 'BUILD', ja: '作る', body: '最適な技術を選んで作る。AI が不要なら使わない。自動化で足りるなら自動化にする。' },
  { en: 'DEPLOY', ja: '導入する', body: '現場に入れて、使われる状態にする。教育・運用ルール・セキュリティを含めて配備する。' },
  { en: 'MEASURE', ja: '測る', body: 'Before と After を同じ KPI で測る。時間・コスト・売上・リスク・速度の変化を数字にする。' },
  { en: 'OPTIMIZE', ja: '改善する', body: '測った結果から、プロンプト・業務・モデル・コストを改善する。' },
  { en: 'SCALE', ja: '広げる', body: '効いたものを他部門・他拠点・他事業へ広げる。次の投資判断へつなぐ。' },
];

/** 一般的な AI 導入と CORE の進め方の対比（Differentiation セクションで使う） */
export const PROCESS_GENERIC: string[] = ['AI', '開発', '納品'];
export const PROCESS_CORE: string[] = ['経営目標', 'ベースライン', 'KPI', 'ROAI シミュレーション', '業務再設計', '開発', '導入', '計測', '改善', '拡大'];
