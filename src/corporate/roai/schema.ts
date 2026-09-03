// ============================================================
// CORE ROAI SCORE — 質問スキーマの正本。
//
// 原則:
//   ・UI に質問文や重みを直書きしない。追加・削除・重み変更はこのファイルだけで済むこと。
//   ・各選択肢は「スコア（改善余地 0〜1）」と「値（時間・割合・金額など計算に使う数）」を持つ。
//   ・業界別の追加質問は INDUSTRY_QUESTIONS に足す（該当業界のときだけ出る＝Adaptive）。
//   ・入力は選択式のみ（スマホで 3〜5 分）。自由記述は取らない。
// ============================================================
import type { ReturnKey } from './model';

export type Industry =
  | 'manufacturing' | 'construction' | 'realestate' | 'healthcare' | 'professional'
  | 'retail' | 'hospitality' | 'finance' | 'it' | 'education' | 'other';

export type Category = 'profile' | ReturnKey | 'readiness';

export interface Option {
  value: string;
  label: string;
  /** 改善余地（その Return の機会の大きさ）0〜1。profile では未使用。 */
  score?: number;
  /** 実装可能性への寄与 0〜1（readiness 系のみ。高いほど整っている）。 */
  ready?: number;
  /** 計算に使う数値（時間／割合／円など）。意味は質問の `unit` で決まる。 */
  num?: number;
  /** 幅で答える質問の下限・上限（金額・人数など） */
  low?: number;
  high?: number;
}

export interface Question {
  id: string;
  category: Category;
  /** 質問文（経営者向けの平易な言葉） */
  text: string;
  /** 補足（任意） */
  hint?: string;
  options: Option[];
  /** category 内での重み（既定 1） */
  weight?: number;
  /** num の意味 */
  unit?: 'hours_per_week' | 'hours' | 'ratio' | 'yen' | 'count' | 'days' | 'months' | 'people' | 'prob';
  /** この質問を出す条件（業界など）。未指定なら常に出す。 */
  when?: { industry?: Industry[] };
}

export const CATEGORY_LABEL: Record<Category, { en: string; ja: string }> = {
  profile: { en: 'COMPANY PROFILE', ja: '会社について' },
  grow: { en: 'GROW', ja: '売上を増やす' },
  save: { en: 'SAVE', ja: 'コスト・工数を減らす' },
  accelerate: { en: 'ACCELERATE', ja: '速度を上げる' },
  protect: { en: 'PROTECT', ja: 'リスクを減らす' },
  create: { en: 'CREATE', ja: '新しい価値を生む' },
  readiness: { en: 'AI READINESS', ja: '実装できる状態か' },
};

export const INDUSTRY_LABEL: Record<Industry, string> = {
  manufacturing: '製造', construction: '建設・不動産開発', realestate: '不動産・仲介・管理', healthcare: '医療・介護',
  professional: '士業・コンサル', retail: '小売・EC', hospitality: '飲食・宿泊・サービス', finance: '金融・保険',
  it: 'IT・ソフトウェア', education: '教育・スクール', other: 'その他',
};

// ── 質問本体 ─────────────────────────────────────────────
export const QUESTIONS: Question[] = [
  // ── A. COMPANY PROFILE ──
  {
    id: 'industry', category: 'profile', text: '主な業種はどれですか。',
    options: (Object.keys(INDUSTRY_LABEL) as Industry[]).map(k => ({ value: k, label: INDUSTRY_LABEL[k] })),
  },
  {
    id: 'employees', category: 'profile', text: '従業員は何人くらいですか。', hint: 'パート・契約社員を含めておおよそで。',
    unit: 'people',
    options: [
      { value: 'e1', label: '1〜5人', num: 3, low: 1, high: 5 },
      { value: 'e2', label: '6〜20人', num: 12, low: 6, high: 20 },
      { value: 'e3', label: '21〜50人', num: 35, low: 21, high: 50 },
      { value: 'e4', label: '51〜100人', num: 75, low: 51, high: 100 },
      { value: 'e5', label: '101〜300人', num: 180, low: 101, high: 300 },
      { value: 'e6', label: '301人以上', num: 450, low: 301, high: 1000 },
    ],
  },
  {
    id: 'revenue', category: 'profile', text: '年商はどのくらいですか。', unit: 'yen',
    options: [
      { value: 'r1', label: '5,000万円未満', num: 30_000_000, low: 10_000_000, high: 50_000_000 },
      { value: 'r2', label: '5,000万〜1億円', num: 75_000_000, low: 50_000_000, high: 100_000_000 },
      { value: 'r3', label: '1〜3億円', num: 200_000_000, low: 100_000_000, high: 300_000_000 },
      { value: 'r4', label: '3〜10億円', num: 600_000_000, low: 300_000_000, high: 1_000_000_000 },
      { value: 'r5', label: '10〜30億円', num: 2_000_000_000, low: 1_000_000_000, high: 3_000_000_000 },
      { value: 'r6', label: '30億円以上', num: 5_000_000_000, low: 3_000_000_000, high: 10_000_000_000 },
    ],
  },
  {
    id: 'biz_type', category: 'profile', text: '主なお客様は。',
    options: [
      { value: 'b2b', label: '法人（BtoB）' },
      { value: 'b2c', label: '個人（BtoC）' },
      { value: 'both', label: '両方' },
    ],
  },
  {
    id: 'sales_share', category: 'profile', text: '営業・顧客対応に関わる人は、全体の何割くらいですか。', unit: 'ratio',
    options: [
      { value: 's1', label: '1割以下', num: 0.1 },
      { value: 's2', label: '2〜3割', num: 0.25 },
      { value: 's3', label: '半分くらい', num: 0.5 },
      { value: 's4', label: 'ほとんど', num: 0.75 },
    ],
  },
  {
    id: 'backoffice_share', category: 'profile', text: '事務・管理・バックオフィスに関わる人は、全体の何割くらいですか。', unit: 'ratio',
    options: [
      { value: 'o1', label: '1割以下', num: 0.1 },
      { value: 'o2', label: '2〜3割', num: 0.25 },
      { value: 'o3', label: '半分くらい', num: 0.5 },
      { value: 'o4', label: 'ほとんど', num: 0.75 },
    ],
  },
  {
    id: 'inquiries', category: 'profile', text: '問い合わせ（電話・メール・LINE・フォーム）は月に何件くらいですか。', unit: 'count',
    options: [
      { value: 'q1', label: '50件未満', num: 25 },
      { value: 'q2', label: '50〜300件', num: 150 },
      { value: 'q3', label: '300〜1,000件', num: 600 },
      { value: 'q4', label: '1,000件以上', num: 2000 },
    ],
  },

  // ── B. GROW ──
  {
    id: 'sales_nonselling', category: 'grow', text: '営業担当は、商談以外の作業（資料作成・入力・調べ物）に時間の何割を使っていますか。',
    unit: 'ratio', weight: 1.2,
    options: [
      { value: 'n1', label: '1割以下', num: 0.1, score: 0.1 },
      { value: 'n2', label: '2〜3割', num: 0.25, score: 0.4 },
      { value: 'n3', label: '4〜5割', num: 0.45, score: 0.75 },
      { value: 'n4', label: '半分以上', num: 0.6, score: 1.0 },
    ],
  },
  {
    id: 'proposal_hours', category: 'grow', text: '提案書や見積を 1 本つくるのに、どのくらいかかりますか。', unit: 'hours',
    options: [
      { value: 'p1', label: '1時間以内', num: 1, score: 0.1 },
      { value: 'p2', label: '半日（3時間）', num: 3, score: 0.45 },
      { value: 'p3', label: '1日（8時間）', num: 8, score: 0.8 },
      { value: 'p4', label: '2日以上', num: 16, score: 1.0 },
    ],
  },
  {
    id: 'response_time', category: 'grow', text: '新しい問い合わせへの最初の返答は、どのくらいで返せていますか。', weight: 1.1,
    options: [
      { value: 't1', label: '1時間以内', score: 0.05, num: 1 },
      { value: 't2', label: 'その日のうち', score: 0.35, num: 8 },
      { value: 't3', label: '翌日以降', score: 0.8, num: 24 },
      { value: 't4', label: '決まっていない・ばらつく', score: 1.0, num: 48 },
    ],
  },
  {
    id: 'dormant', category: 'grow', text: '過去のお客様・休眠顧客への再提案は、仕組みとしてありますか。',
    options: [
      { value: 'd1', label: '定期的に仕組みで回している', score: 0.1 },
      { value: 'd2', label: 'ときどき、人の判断で', score: 0.55 },
      { value: 'd3', label: 'ほぼやっていない', score: 1.0 },
    ],
  },
  {
    id: 'crm', category: 'grow', text: '商談や顧客の記録は、どう管理していますか。',
    options: [
      { value: 'c1', label: 'CRMで管理し、分析もしている', score: 0.1, ready: 1.0 },
      { value: 'c2', label: '記録はあるが、分析はしていない', score: 0.55, ready: 0.6 },
      { value: 'c3', label: '担当者それぞれの頭の中・個人ファイル', score: 1.0, ready: 0.15 },
    ],
  },

  // ── C. SAVE ──
  {
    id: 'data_entry', category: 'save', text: '手入力・転記・チェック作業に、1人あたり週どのくらい使っていますか。',
    hint: '見積の転記、受発注の入力、帳票の突き合わせなど。', unit: 'hours_per_week', weight: 1.2,
    options: [
      { value: 'h1', label: '1時間未満', num: 0.5, score: 0.05 },
      { value: 'h2', label: '1〜3時間', num: 2, score: 0.35 },
      { value: 'h3', label: '3〜6時間', num: 4.5, score: 0.7 },
      { value: 'h4', label: '6時間以上', num: 8, score: 1.0 },
    ],
  },
  {
    id: 'documents', category: 'save', text: '報告書・議事録・定型文書の作成に、1人あたり週どのくらい使っていますか。', unit: 'hours_per_week',
    options: [
      { value: 'w1', label: '1時間未満', num: 0.5, score: 0.05 },
      { value: 'w2', label: '1〜3時間', num: 2, score: 0.35 },
      { value: 'w3', label: '3〜6時間', num: 4.5, score: 0.7 },
      { value: 'w4', label: '6時間以上', num: 8, score: 1.0 },
    ],
  },
  {
    id: 'email', category: 'save', text: 'メール・チャットの対応に、1人あたり週どのくらい使っていますか。', unit: 'hours_per_week',
    options: [
      { value: 'm1', label: '3時間未満', num: 2, score: 0.1 },
      { value: 'm2', label: '3〜6時間', num: 4.5, score: 0.4 },
      { value: 'm3', label: '6〜10時間', num: 8, score: 0.75 },
      { value: 'm4', label: '10時間以上', num: 12, score: 1.0 },
    ],
  },
  {
    id: 'outsourcing', category: 'save', text: '定型業務の外注費（事務代行・データ入力・制作など）は年間どのくらいですか。', unit: 'yen',
    options: [
      { value: 'x1', label: 'ほぼない', num: 0, score: 0.05 },
      { value: 'x2', label: '〜300万円', num: 1_500_000, score: 0.4 },
      { value: 'x3', label: '300万〜1,000万円', num: 6_000_000, score: 0.75 },
      { value: 'x4', label: '1,000万円以上', num: 15_000_000, score: 1.0 },
    ],
  },
  {
    id: 'standardized', category: 'save', text: '定型業務の手順は、文書化・標準化されていますか。',
    options: [
      { value: 'z1', label: '手順書があり、誰でも回せる', score: 0.2, ready: 1.0 },
      { value: 'z2', label: '一部だけ', score: 0.6, ready: 0.5 },
      { value: 'z3', label: '担当者の経験頼み', score: 1.0, ready: 0.1 },
    ],
  },

  // ── D. ACCELERATE ──
  {
    id: 'decision_data', category: 'accelerate', text: '経営判断に必要な数字（売上・粗利・資金繰り）は、どのくらいで手に入りますか。', weight: 1.2,
    options: [
      { value: 'k1', label: 'いつでも即日', score: 0.05, ready: 1.0, num: 0 },
      { value: 'k2', label: '1週間以内', score: 0.4, ready: 0.7, num: 7 },
      { value: 'k3', label: '月次の締め後', score: 0.75, ready: 0.4, num: 30 },
      { value: 'k4', label: 'すぐには分からない', score: 1.0, ready: 0.1, num: 45 },
    ],
  },
  {
    id: 'approval', category: 'accelerate', text: '社内の承認・稟議は、平均どのくらいかかりますか。', unit: 'days',
    options: [
      { value: 'a1', label: 'その日のうち', num: 1, score: 0.05 },
      { value: 'a2', label: '2〜3日', num: 3, score: 0.35 },
      { value: 'a3', label: '1週間', num: 7, score: 0.7 },
      { value: 'a4', label: '2週間以上', num: 14, score: 1.0 },
    ],
  },
  {
    id: 'time_to_market', category: 'accelerate', text: '新しい取り組み（新サービス・新業務）が形になるまで、どのくらいかかりますか。', unit: 'months',
    options: [
      { value: 'l1', label: '1ヶ月以内', num: 1, score: 0.1 },
      { value: 'l2', label: '3ヶ月', num: 3, score: 0.4 },
      { value: 'l3', label: '半年', num: 6, score: 0.7 },
      { value: 'l4', label: '1年以上・止まりがち', num: 12, score: 1.0 },
    ],
  },

  // ── E. PROTECT ──
  {
    id: 'loss_impact', category: 'protect', text: '情報漏洩・大きなミス・システム停止が起きたときの損失は、どのくらいと見込みますか。',
    hint: '賠償・信用低下・復旧・機会損失を合わせたおおよその額。', unit: 'yen', weight: 1.2,
    options: [
      { value: 'i1', label: '〜100万円', num: 1_000_000, score: 0.2 },
      { value: 'i2', label: '〜500万円', num: 5_000_000, score: 0.5 },
      { value: 'i3', label: '〜2,000万円', num: 20_000_000, score: 0.8 },
      { value: 'i4', label: '1億円以上', num: 100_000_000, score: 1.0 },
    ],
  },
  {
    id: 'security_posture', category: 'protect', text: 'セキュリティやミス防止の対策は、どの段階ですか。', unit: 'prob',
    options: [
      { value: 'g1', label: '定期的な点検・監査をしている', num: 0.03, score: 0.1, ready: 1.0 },
      { value: 'g2', label: '基本的な対策（バックアップ・権限）はある', num: 0.08, score: 0.5, ready: 0.6 },
      { value: 'g3', label: 'ほぼ担当者まかせ', num: 0.15, score: 1.0, ready: 0.2 },
    ],
  },
  {
    id: 'key_person', category: 'protect', text: '「この人がいないと止まる」業務は、どのくらいありますか。',
    options: [
      { value: 'y1', label: 'ほぼない', score: 0.1 },
      { value: 'y2', label: 'いくつかある', score: 0.55 },
      { value: 'y3', label: '多い', score: 1.0 },
    ],
  },

  // ── F. CREATE ──
  {
    id: 'data_assets', category: 'create', text: '顧客・業務のデータは、どのくらい蓄積されていますか。', weight: 1.1,
    options: [
      { value: 'v1', label: '構造化されて蓄積している', score: 0.9, ready: 1.0 },
      { value: 'v2', label: 'バラバラだが、ある', score: 0.6, ready: 0.5 },
      { value: 'v3', label: 'ほとんどない', score: 0.2, ready: 0.1 },
    ],
  },
  {
    id: 'service_ai', category: 'create', text: '既存のサービス・商品に AI を組み込んで、新しい提供のかたちを作れそうですか。',
    options: [
      { value: 'u1', label: '具体的なアイデアがある', score: 1.0 },
      { value: 'u2', label: '漠然と、ありそう', score: 0.6 },
      { value: 'u3', label: '考えていない', score: 0.25 },
    ],
  },
  {
    id: 'customer_agent', category: 'create', text: 'お客様向けの 24 時間 AI 対応（予約・質問・提案）は、喜ばれそうですか。',
    options: [
      { value: 'f1', label: '確実に喜ばれる', score: 1.0 },
      { value: 'f2', label: '分からない', score: 0.5 },
      { value: 'f3', label: '不要', score: 0.1 },
    ],
  },

  // ── G. AI READINESS ──
  {
    id: 'data_location', category: 'readiness', text: '業務データは主にどこにありますか。', weight: 1.2,
    options: [
      { value: 'dl1', label: 'クラウドの基幹・SaaS に一元化', ready: 1.0 },
      { value: 'dl2', label: '複数の SaaS・システムに分散', ready: 0.6 },
      { value: 'dl3', label: 'Excel・紙・個人PC', ready: 0.15 },
    ],
  },
  {
    id: 'commitment', category: 'readiness', text: '経営としての AI 投資への姿勢は。', weight: 1.2,
    options: [
      { value: 'cm1', label: '今期の予算を決めて進めたい', ready: 1.0 },
      { value: 'cm2', label: '効果が見えれば投資する', ready: 0.6 },
      { value: 'cm3', label: 'まだ様子見', ready: 0.2 },
    ],
  },
  {
    id: 'literacy', category: 'readiness', text: '社員の AI 利用は。',
    options: [
      { value: 'li1', label: '日常的に使っている', ready: 1.0 },
      { value: 'li2', label: '一部の人だけ', ready: 0.5 },
      { value: 'li3', label: 'ほとんど使っていない', ready: 0.1 },
    ],
  },
  {
    id: 'budget', category: 'readiness', text: '来期までに AI へ投資できる目安は。', hint: '診断の中で「Return から逆算した投資余力」と比較します。', unit: 'yen',
    options: [
      { value: 'bg1', label: '〜100万円', num: 1_000_000, ready: 0.3 },
      { value: 'bg2', label: '100万〜500万円', num: 3_000_000, ready: 0.6 },
      { value: 'bg3', label: '500万〜2,000万円', num: 10_000_000, ready: 0.9 },
      { value: 'bg4', label: '2,000万円以上', num: 30_000_000, ready: 1.0 },
    ],
  },
];

/**
 * 業界別の追加質問（Adaptive）。該当業界のときだけ出す。
 * 今は 2 業種の例を置く。増やすときはここへ足すだけで、UI と engine は変えない。
 */
export const INDUSTRY_QUESTIONS: Question[] = [
  {
    id: 'ind_re_response', category: 'grow', when: { industry: ['realestate'] },
    text: '物件への反響（ポータル・自社サイト）への返答は、どのくらいで返せていますか。', weight: 1.0,
    options: [
      { value: 'rr1', label: '5分以内（自動返信含む）', score: 0.05 },
      { value: 'rr2', label: '1時間以内', score: 0.3 },
      { value: 'rr3', label: 'その日のうち', score: 0.7 },
      { value: 'rr4', label: '翌日以降になることがある', score: 1.0 },
    ],
  },
  {
    id: 'ind_mf_inspection', category: 'save', when: { industry: ['manufacturing'] },
    text: '検査・記録・日報などの現場入力は、どう行っていますか。', weight: 1.0,
    options: [
      { value: 'mi1', label: 'システムに直接入力・自動記録', score: 0.1 },
      { value: 'mi2', label: '紙に書いて後から転記', score: 0.8 },
      { value: 'mi3', label: '記録が残っていないことがある', score: 1.0 },
    ],
  },
];

export const ALL_QUESTIONS: Question[] = [...QUESTIONS, ...INDUSTRY_QUESTIONS];

/** 回答の型: 質問 id → 選んだ option.value */
export type Answers = Record<string, string>;

/** 回答に応じて「今出すべき質問」を順に返す（業界別の分岐を含む）。 */
export function activeQuestions(answers: Answers): Question[] {
  const industry = answers.industry as Industry | undefined;
  const list: Question[] = [];
  for (const q of QUESTIONS) {
    list.push(q);
    // 業界質問は同じ category の末尾に差し込む
    const extra = INDUSTRY_QUESTIONS.filter(x => x.category === q.category && x.when?.industry?.includes(industry as Industry));
    for (const x of extra) {
      const lastOfCat = QUESTIONS.filter(b => b.category === q.category).at(-1);
      if (lastOfCat && lastOfCat.id === q.id && !list.includes(x)) list.push(x);
    }
  }
  return list;
}

export function findOption(q: Question, value: string | undefined): Option | undefined {
  if (!value) return undefined;
  return q.options.find(o => o.value === value);
}

export const QUESTION_BY_ID: Record<string, Question> = Object.fromEntries(ALL_QUESTIONS.map(q => [q.id, q]));
