// ============================================================
// CORE ROAI SCORE — 質問スキーマの正本。
//
// 2026-09-08 改訂: 23問+業界別 → 13問+業界別 へ圧縮。
//   ・削減の目的は「回答者の負担を減らすこと」ではなく「1問あたりの情報量を増やして精度を守ること」。
//     承認スピード・意思決定・新規事業開発の3つを別々に聞くより、1つの物語（シナリオ）として
//     聞いた方が経営者は正確に答えられる（3つの数字を別々に思い出すより実感に近い）。
//   ・実際の計算に使っていなかった質問（biz_type・inquiries）は「聞くこと自体」が精度を上げないため削除した。
//   ・独立した数値が必要な項目（年商・従業員数・外注費・投資予算など）は単独のまま残した。
//   ・1問で2つの数値を出す設問は Option.num / Option.num2 に組で持たせる（例: 営業比率と事務比率）。
//
// 原則:
//   ・UI に質問文や重みを直書きしない。追加・削除・重み変更はこのファイルだけで済むこと。
//   ・各選択肢は「スコア（改善余地 0〜1）」と「値（時間・割合・金額など計算に使う数）」を持つ。
//   ・業界別の追加質問は INDUSTRY_QUESTIONS に足す（該当業界のときだけ出る＝Adaptive）。
//   ・入力は選択式のみ（スマホで 2〜3 分）。自由記述は取らない。
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
  /** 1問で2つ目の数値が要るとき（例: 営業比率と事務比率、影響額と発生確率）。意味は質問ごとに固定。 */
  num2?: number;
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

// ── 質問本体（13問） ─────────────────────────────────────────
export const QUESTIONS: Question[] = [
  // ── A. COMPANY PROFILE（4問） ──
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
    id: 'org_mix', category: 'profile', text: '社員の内訳に、いちばん近いものはどれですか。',
    hint: '営業比率・事務比率をまとめて聞くことで、別々に答えて数字がずれるのを防いでいます。',
    unit: 'ratio',
    options: [
      { value: 'om1', label: '多くが営業・接客など、お客様と直接やり取りする人', num: 0.5, num2: 0.15 },
      { value: 'om2', label: '営業・事務・現場がバランスよくいる', num: 0.25, num2: 0.25 },
      { value: 'om3', label: '多くが事務・管理・バックオフィス', num: 0.15, num2: 0.5 },
      { value: 'om4', label: 'ほとんどが現場・製造・施工・専門職（営業も事務も少人数）', num: 0.1, num2: 0.1 },
    ],
  },

  // ── B. GROW（2問） ──
  {
    id: 'sales_admin', category: 'grow', text: '営業担当は、商談以外の作業（提案書・見積作成、入力、調べ物）に時間の何割を使っていますか。',
    unit: 'ratio', weight: 1.2,
    options: [
      { value: 'sa1', label: '1割以下', num: 0.1, score: 0.1 },
      { value: 'sa2', label: '2〜3割', num: 0.25, score: 0.4 },
      { value: 'sa3', label: '4〜5割', num: 0.45, score: 0.75 },
      { value: 'sa4', label: '半分以上', num: 0.6, score: 1.0 },
    ],
  },
  {
    id: 'followup', category: 'grow',
    text: '新しい問い合わせへの返答、過去のお客様への再提案、商談記録の管理は、どのくらい仕組みになっていますか。',
    hint: '3つをまとめて聞いています。いちばん近い状態を選んでください。', weight: 1.3,
    options: [
      { value: 'fu1', label: 'CRMで一元管理し、初回返信も休眠顧客への再提案も仕組みで回っている', score: 0.05, ready: 1.0 },
      { value: 'fu2', label: '記録はあるがフォローは人の判断次第。返信はその日のうちには返せている', score: 0.4, ready: 0.6 },
      { value: 'fu3', label: '担当者ごとの管理で、休眠顧客への再提案はほぼ無い。返信が翌日以降になることもある', score: 0.75, ready: 0.3 },
      { value: 'fu4', label: '決まった仕組みがなく、返信も顧客対応もばらつく', score: 1.0, ready: 0.1 },
    ],
  },

  // ── C. SAVE（2問） ──
  {
    id: 'manual_hours', category: 'save',
    text: '手入力・転記・チェック、報告書や議事録の作成、メール・チャット対応など、事務作業に1人あたり週どのくらい使っていますか。',
    hint: '3つの作業をまとめた合計時間の感覚で選んでください。', unit: 'hours_per_week', weight: 1.3,
    options: [
      { value: 'mh1', label: '3時間未満', num: 2, score: 0.05 },
      { value: 'mh2', label: '3〜8時間', num: 5.5, score: 0.35 },
      { value: 'mh3', label: '8〜15時間', num: 11, score: 0.7 },
      { value: 'mh4', label: '15時間以上', num: 18, score: 1.0 },
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

  // ── D. ACCELERATE（1問） ──
  {
    id: 'decision_speed', category: 'accelerate',
    text: '経営判断に必要な数字が手に入る速さ、社内の承認、新しい取り組みが形になるまでの速さは、どのくらいですか。',
    hint: '3つをまとめて聞いています。', weight: 1.2,
    options: [
      { value: 'ds1', label: '数字はいつでも即日、承認もその日のうち、新しい取り組みも早く形になる', score: 0.05, ready: 1.0 },
      { value: 'ds2', label: '数字は1週間以内、承認は2〜3日、新しい取り組みは数ヶ月で形になる', score: 0.4, ready: 0.6 },
      { value: 'ds3', label: '数字は月次の締め後、承認に1週間、新しい取り組みは半年がかり', score: 0.75, ready: 0.3 },
      { value: 'ds4', label: '数字もすぐには分からず、承認にも新しい取り組みにも1年以上・止まりがち', score: 1.0, ready: 0.1 },
    ],
  },

  // ── E. PROTECT（1問） ──
  {
    id: 'risk_exposure', category: 'protect',
    text: '情報漏洩・大きなミス・システム停止が起きたときの備えと影響は、どれに近いですか。',
    hint: '対策の段階・属人化の度合い・想定される影響額をまとめて聞いています。', unit: 'yen', weight: 1.2,
    options: [
      { value: 're1', label: '定期的な点検・監査をしていて、抜けても回る体制。影響が出ても〜500万円規模', num: 5_000_000, num2: 0.03, score: 0.15, ready: 1.0 },
      { value: 're2', label: '基本的な対策（バックアップ・権限）はあるが、一部「この人がいないと止まる」業務がある。影響は〜2,000万円規模', num: 20_000_000, num2: 0.08, score: 0.5, ready: 0.6 },
      { value: 're3', label: '対策はほぼ担当者まかせで、属人化した業務も多い。起きれば1億円規模の影響もありうる', num: 100_000_000, num2: 0.15, score: 1.0, ready: 0.15 },
    ],
  },

  // ── F. CREATE（1問） ──
  {
    id: 'new_value', category: 'create',
    text: '自社のデータを活かして、新しい商品や24時間のお客様対応など「新しい価値」を作れそうですか。',
    hint: 'データの蓄積度合いと、新しい価値のアイデアをまとめて聞いています。', weight: 1.1,
    options: [
      { value: 'nv1', label: 'データも蓄積されていて、新しい商品や24時間対応の具体的なアイデアがある', score: 1.0, ready: 1.0 },
      { value: 'nv2', label: 'データはバラバラにあり、漠然と新しい可能性は感じている', score: 0.6, ready: 0.5 },
      { value: 'nv3', label: 'データはほとんどなく、新しい価値づくりはまだ考えていない', score: 0.2, ready: 0.1 },
    ],
  },

  // ── G. AI READINESS（2問） ──
  {
    id: 'ai_readiness', category: 'readiness',
    text: 'データの置き場、経営としての投資姿勢、社員のAI利用、業務手順の標準化は、どのくらい整っていますか。',
    hint: '4つをまとめて聞いています。いちばん近い状態を選んでください。', weight: 1.3,
    options: [
      { value: 'air1', label: 'データはクラウドに一元化。予算を決めて投資したい。社員も日常的にAIを使い、手順も標準化されている', ready: 1.0 },
      { value: 'air2', label: 'データは複数のSaaSに分散。効果が見えれば投資したい。AI利用は一部の人だけ、手順も一部だけ標準化', ready: 0.55 },
      { value: 'air3', label: 'データはExcel・紙・個人PC中心。投資はまだ様子見。社員もほとんど使っておらず、手順も担当者頼み', ready: 0.15 },
    ],
  },
  {
    id: 'budget', category: 'readiness', text: '来期までにAIへ投資できる目安は。', hint: '診断の中で「Returnから逆算した投資余力」と比較します。', unit: 'yen', weight: 1.0,
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
