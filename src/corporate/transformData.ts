// ============================================================
// transformData — CORE を「AI Transformation Company」として語るための本文データ
//
// 2026-08-21 オーナー指示:
//   「AIを使って開発する会社」ではなく
//   「企業の本質的な課題を見つけ、AI・ソフトウェア・業務設計によって
//     事業そのものを変革する会社」として全面的に再定義する。
//
// 数字はここに書かない（確定値のないものを作らない）。
// 実数を出すのは coreNumbers だけで、値が無い項目は null にして非表示にする。
// ============================================================

// ── 01〜04 の事業階層 ────────────────────────────────
export interface ServiceLayer {
  no: string;
  titleEn: string;
  titleJa: string;
  copy: string;
  body: string;
  items: string[];
  accent: string;
  /** 04 のようにまだ提供前のものは soon: true（COMING SOON 表記にする） */
  soon?: boolean;
}

export const SERVICE_LAYERS: ServiceLayer[] = [
  {
    no: '01',
    titleEn: 'AI Transformation Consulting',
    titleJa: 'AI変革コンサルティング',
    copy: '何を作るかではなく、何を変えるべきかから考える。',
    body: '経営課題からAI活用方法を設計します。AIを導入すること自体は目的にしません。どの業務に時間とお金が消えているのかを分解し、変えれば効くところだけを選びます。',
    items: ['業務分析', 'AI活用戦略', 'DXロードマップ', 'ROI試算', '新規事業設計'],
    accent: '#E7C987',
  },
  {
    no: '02',
    titleEn: 'AI & System Development',
    titleJa: 'AI・システム開発',
    copy: '構想から実装まで、一気通貫。',
    body: '設計した変革を、動くものにします。要件定義から本番運用まで同じチームが持つので、「決めた人」と「作る人」の間で意図が薄まりません。',
    items: [
      'AIエージェント', 'CRM', '営業支援システム', '顧客管理', 'AIチャット',
      '社内検索', '業務自動化', 'データ分析', 'SaaS開発', 'API連携', 'Webアプリケーション',
    ],
    accent: '#C9A96E',
  },
  {
    no: '03',
    titleEn: 'AI Transformation Partner',
    titleJa: 'AI変革パートナー',
    copy: 'AIは、導入してからが始まり。',
    body: '納品して終わる会社ではありません。使われ方を見て、モデルと業務の両方を直し続けます。組織の側が変わらなければ、AIは効きません。',
    items: ['AI改善', 'モデル更新', '新機能開発', 'データ分析', '業務改善', 'AI研修', '経営会議', 'KPI分析'],
    accent: '#B9975B',
  },
  {
    no: '04',
    titleEn: 'AI Products / Industry OS',
    titleJa: '業界特化AIプロダクト',
    copy: '一社の課題解決を、業界全体の仕組みに変える。',
    body: '一社のために作った仕組みのうち、その業界の誰もが抱えている部分をプロダクトにして展開します。二社目からは、はじめから完成に近い状態で始められます。',
    items: ['医療', '美容', '不動産', '教育', '人材', '建設', '士業'],
    accent: '#A98B57',
    soon: true,
  },
];

// ── 開発会社との違い ──────────────────────────────
export const DIFF_GENERIC: string[] = ['依頼されたものを作る', '納品', '終了'];
export const DIFF_CORE: string[] = ['経営課題を分析', 'AI・業務設計', '開発', '運用', '改善', '新規事業'];

// ── AI COMPANY OS ──────────────────────────────────
/** 会社の中に点在する業務。COREを中心につながる順に並べる。 */
export const COMPANY_OS_NODES: { label: string; sub: string }[] = [
  { label: '営業', sub: '商談・提案・受注' },
  { label: '顧客管理', sub: '取引先・履歴' },
  { label: '問い合わせ', sub: 'メール・LINE・電話' },
  { label: '会議', sub: '議事録・決定事項' },
  { label: 'タスク', sub: '担当・期限' },
  { label: '契約', sub: '見積・締結' },
  { label: '請求', sub: '入金・回収' },
  { label: 'マーケティング', sub: '広告・SNS・LP' },
  { label: '経営分析', sub: '売上・利益・KPI' },
];

// ── AI Transformation 診断 ─────────────────────────
export const ASSESSMENT_TARGETS: string[] = [
  '営業', 'マーケティング', '顧客対応', 'バックオフィス', '採用', '経営管理', 'データ分析',
];

export const ASSESSMENT_STEPS: { no: string; title: string; body: string }[] = [
  { no: '01', title: 'ヒアリング', body: '何に時間が消えているか、どこで数字が落ちているかを、経営と現場の両方から聞きます。' },
  { no: '02', title: '業務分析', body: '業務を工程に分解し、人がやるべき所とAIに渡せる所の境界を引きます。' },
  { no: '03', title: 'AI活用設計', body: 'どの工程を、どの技術で、どの順番で変えるか。作るものの形をここで決めます。' },
  { no: '04', title: 'ROI試算', body: '削減できる時間と増える売上を数字にします。合わない案は、この段階で捨てます。' },
  { no: '05', title: 'ロードマップ', body: '90日・1年・3年で何がどう変わるか。実行の順番と体制まで含めて1枚にします。' },
];

// ── Use Cases ──────────────────────────────────────
export interface UseCaseFlow {
  domainEn: string;
  domainJa: string;
  headline: string;
  steps: string[];
  body: string;
  accent: string;
}

export const USE_CASES: UseCaseFlow[] = [
  {
    domainEn: 'Sales',
    domainJa: '営業',
    headline: '商談のあとの2時間を、なくす。',
    steps: ['商談記録', 'AI要約', '提案書作成', 'CRM入力', 'フォローアップ'],
    body: '話した内容がそのまま要約になり、提案書の下書きと顧客台帳の更新まで進みます。営業が手で書き写す作業が消え、追いかけるべき相手だけが残ります。',
    accent: '#E7C987',
  },
  {
    domainEn: 'Customer Support',
    domainJa: '顧客対応',
    headline: '一次対応を、待たせない。',
    steps: ['問い合わせ', 'AI一次対応', '担当者振り分け', '顧客DB更新', '分析'],
    body: 'メール・LINE・フォームのどこから来ても、まずAIが受けます。人が要る用件だけが担当者に届き、やり取りは顧客台帳に残り、何が多いのかが数字で見えます。',
    accent: '#C9A96E',
  },
  {
    domainEn: 'Management',
    domainJa: '経営',
    headline: '「今月なぜ利益が落ちた？」に、答えが返る。',
    steps: ['売上', '広告', 'CRM', '会計'],
    body: 'バラバラの数字を一つにつなぎます。経営者が言葉で聞けば、AIが原因の候補を挙げ、根拠になった明細まで示します。報告を待つ時間がなくなります。',
    accent: '#D8B979',
  },
  {
    domainEn: 'Marketing',
    domainJa: 'マーケティング',
    headline: '広告費の行き先を、売上まで追う。',
    steps: ['広告', 'GA4', 'CRM', '売上'],
    body: 'どの広告が、どの問い合わせになり、いくらの売上になったか。分断されがちな4つをつなぎ、AIが次に何を止めて何を増やすかを提案します。',
    accent: '#B9975B',
  },
];

// ── AI Native Development ──────────────────────────
export const AI_NATIVE_STEPS: { en: string; ja: string; body: string }[] = [
  { en: 'Strategy', ja: '戦略', body: '何を変えるかを決める。作らない判断もここでする。' },
  { en: 'Requirements', ja: '要件', body: '業務の言葉のまま要件に落とす。翻訳の段階で失われないように。' },
  { en: 'Architecture', ja: '設計', body: '3年後の事業の形から逆算して構造を決める。' },
  { en: 'AI Development', ja: '実装', body: 'AIを開発工程そのものに組み込み、実装の速度と厚みを上げる。' },
  { en: 'Review', ja: 'レビュー', body: '書いたAIとは別のAIと人が、批判的に読む。' },
  { en: 'QA', ja: '検証', body: '実機・実データで、使う人の手順どおりに確かめる。' },
  { en: 'Deploy', ja: '公開', body: '小さく出して、壊れないことを確かめながら広げる。' },
  { en: 'Continuous Improvement', ja: '継続改善', body: '使われ方を見て直し続ける。ここが最も長い工程。' },
];

// ── Technology ─────────────────────────────────────
export const TECH_GROUPS: { purpose: string; body: string; tech: string[] }[] = [
  {
    purpose: '考える・書く・答える',
    body: '文章を読み、判断し、書く仕事を任せるための頭脳。用途ごとに最適なモデルを選び、必要なら複数を使い分けます。',
    tech: ['Claude', 'OpenAI', 'Gemini'],
  },
  {
    purpose: '自社の知識を、AIに持たせる',
    body: '社内の資料・履歴・過去の判断を検索できる形で保持し、AIが「この会社のこと」を踏まえて答えられるようにします。',
    tech: ['Vector Database', 'MCP', 'API Integration'],
  },
  {
    purpose: 'データを、事業の資産にする',
    body: '散らばった数字を一箇所に集め、権限を分け、後から何度でも問い直せる形にします。',
    tech: ['Supabase', 'PostgreSQL', 'Python'],
  },
  {
    purpose: '毎日使えるものとして届ける',
    body: '速く開き、落ちず、そのまま業務に載る画面を作ります。スマートフォンでの使い勝手を先に決めます。',
    tech: ['Next.js', 'React', 'Vercel', 'Cloud Infrastructure'],
  },
];

// ── Business Development ───────────────────────────
export const BIZDEV_ITEMS: { t: string; d: string }[] = [
  { t: '新規事業企画', d: '既存の資産（顧客・データ・人）から、次の柱になりうる事業を組み立てます。' },
  { t: 'AI事業設計', d: 'AIを前提にした収益構造・原価・提供体制を設計します。' },
  { t: 'プロダクト企画', d: '誰の何を解くのか、どこで課金するのかまで決めます。' },
  { t: 'PoC', d: '小さく試し、続けるか止めるかを短期間で判断できる形にします。' },
  { t: 'SaaS立ち上げ', d: '一社向けの仕組みを、複数社が使える製品へ育てます。' },
  { t: '事業パートナー開拓', d: '売る力・顧客基盤を持つ相手と組み、立ち上がりを早めます。' },
];

// ── Partner with CORE ──────────────────────────────
export const PARTNER_TARGETS: string[] = [
  '広告代理店', 'コンサル会社', '税理士', '会計士', '補助金支援会社', '金融機関', 'SaaS会社', 'システム会社',
];

export const PARTNER_FORMS: { t: string; d: string }[] = [
  { t: '共同提案', d: '御社の商談に同席し、AI側の設計と見積を担当します。' },
  { t: '紹介', d: 'ご紹介いただき、CORE が直接請け負います。' },
  { t: 'OEM', d: '御社の名前で提供いただける形で開発します。' },
  { t: '共同開発', d: '御社の知見と CORE の実装力で、一緒に製品を作ります。' },
  { t: 'JV', d: '新しい事業体として、リスクと成果を分け合います。' },
];

// ── 投資規模 ───────────────────────────────────────
export const INVESTMENT_TIERS: { name: string; nameJa: string; price: string; note: string; body: string }[] = [
  {
    name: 'AI Transformation',
    nameJa: 'AI変革コンサルティング',
    price: 'CUSTOM',
    note: '規模と範囲により個別お見積り',
    body: '業務分析からロードマップまで。診断のみのご依頼も承ります。',
  },
  {
    name: 'AI COMPANY OS',
    nameJa: '全社AI基盤の構築',
    price: '¥3,000,000〜',
    note: '設計・構築・初期運用を含む',
    body: '営業から経営分析までを1本の流れにつなぐ、会社全体の再設計。',
  },
  {
    name: 'Enterprise AI Development',
    nameJa: '大規模AIシステム開発',
    price: '¥5,000,000〜',
    note: '継続改善契約は別途',
    body: '基幹業務に載るAIシステム。既存システムとの接続を含みます。',
  },
];

// ── 数字で見る CORE ────────────────────────────────
/**
 * value が null の項目は表示しない。
 * 確定値のない数字は、絶対に埋めないこと（オーナー指示 2026-08-21）。
 * いま出しているのは、このサイト自身から数えられる実数だけ。
 */
export const CORE_NUMBERS: { label: string; labelJa: string; value: string | null; note?: string }[] = [
  { label: 'AI PRODUCTS', labelJa: '自社開発AIプロダクト', value: '8', note: '本番稼働中' },
  { label: 'INDUSTRIES', labelJa: '業界特化AI', value: '5', note: '建設・アニメ制作・広告・林業・バックオフィス' },
  { label: 'AI AGENTS', labelJa: 'AIエージェント', value: '13', note: 'CORE Prism 上で稼働' },
  { label: 'PROJECTS', labelJa: '支援プロジェクト', value: null },
  { label: 'CLIENTS', labelJa: '導入企業', value: null },
  { label: 'CONTINUOUS RATE', labelJa: '継続契約率', value: null },
];

// ── 問い合わせフォームの選択肢 ─────────────────────
export const CONTACT_INTERESTS: string[] = [
  'AI導入', '業務効率化', 'システム開発', '新規事業', 'AI顧問', 'パートナー提携', 'その他',
];

export const CONTACT_BUDGETS: string[] = [
  '〜300万円', '300〜500万円', '500〜1,000万円', '1,000〜3,000万円', '3,000万円以上', '未定',
];

export const CONTACT_SIZES: string[] = [
  '1名（個人事業）', '2〜10名', '11〜50名', '51〜300名', '301名以上',
];
