const ONBOARDED_KEY = 'core_onboarded_v2';
const DEMO_KEY = 'core_demo_active_v1';

const PERSONA_STORE = 'core_personas';
const KNOWLEDGE_STORE = 'core_knowledge';
const CRM_STORE = 'core_crm_deals_v1';
const DOC_STORE = 'core_documents_v1';
const EXPENSE_STORE = 'core_expenses_v1';
const PEOPLE_STORE = 'core_people_v1';
const INTERACTION_STORE = 'core_people_interactions_v1';

export function isOnboarded(): boolean {
  return localStorage.getItem(ONBOARDED_KEY) === 'true';
}

export function markOnboarded(): void {
  localStorage.setItem(ONBOARDED_KEY, 'true');
}

export function resetOnboarding(): void {
  localStorage.removeItem(ONBOARDED_KEY);
}

export function isDemoActive(): boolean {
  return localStorage.getItem(DEMO_KEY) === 'true';
}

export function setDemoActive(active: boolean): void {
  localStorage.setItem(DEMO_KEY, active ? 'true' : 'false');
}

function loadArr<T>(key: string): T[] {
  try {
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : [];
  } catch { return []; }
}

function saveArr(key: string, items: unknown[]) {
  try { localStorage.setItem(key, JSON.stringify(items)); } catch { /* quota */ }
}

export function clearDemoData(): void {
  for (const key of [KNOWLEDGE_STORE, CRM_STORE, DOC_STORE, EXPENSE_STORE, PEOPLE_STORE, INTERACTION_STORE]) {
    const items = loadArr<{ id: string }>(key);
    saveArr(key, items.filter(i => !i.id.startsWith('demo:')));
  }
  const personas = loadArr<{ id: string }>(PERSONA_STORE);
  saveArr(PERSONA_STORE, personas.filter(p => !p.id.startsWith('demo:')));
  setDemoActive(false);
}

/** Writes demo data for カフェ経営者・田中健一 directly to localStorage.
 *  Returns total item count seeded (persona + tasks + knowledge + deals + documents). */
export function seedDemoData(): number {
  const pid = 'demo:persona-tanaka';
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // ── Tasks (5) ─────────────────────────────────────────────────
  const tasks = [
    { id: 'demo:task-1', title: '新店舗の物件見学スケジュール確認', priority: 'high', due: '今週', done: false, personaId: pid },
    { id: 'demo:task-2', title: 'バリスタスタッフ求人票の作成', priority: 'high', due: '今週', done: false, personaId: pid },
    { id: 'demo:task-3', title: 'コーヒー豆の卸業者との価格交渉準備', priority: 'mid', due: '来週', done: false, personaId: pid },
    { id: 'demo:task-4', title: '秋のメニュー改定案の整理', priority: 'mid', due: '今月', done: false, personaId: pid },
    { id: 'demo:task-5', title: 'Instagramリール動画の撮影・編集', priority: 'low', due: '来月', done: false, personaId: pid },
  ];

  // ── Persona ────────────────────────────────────────────────────
  const persona = {
    id: pid,
    name: 'カフェ経営者・田中健一',
    subtitle: 'CAFE TANAKA オーナー',
    icon: '☕',
    accentColor: '#c9a96e',
    accentColorLight: 'rgba(201,169,110,0.15)',
    description: '渋谷でカフェを経営するオーナー。2店舗目出店を計画中。コーヒーとラテアートが得意。売上拡大とコスト管理が課題。',
    createdAt: now,
    meetingSlug: 'tanaka-cafe-demo',
    tasks,
    cashflow: { income: 850000, expense: -620000, label: '田中健一・月次収支' },
    timeAllocation: 25,
  };

  // ── Knowledge (3) ─────────────────────────────────────────────
  const knowledge = [
    {
      id: 'demo:knowledge-1',
      personaId: pid,
      title: '店舗情報・事業概要',
      content: '【CAFE TANAKA 概要】\n渋谷区道玄坂にある15席のスペシャルティコーヒー専門店。2019年創業。\n月商：約85万円\n主力商品：シングルオリジンコーヒー各種、季節のラテアートシリーズ\nスタッフ：オーナー含め4名\n2026年中に渋谷2号店の出店を計画中。',
      chunks: [
        { id: 'demo:chunk-1a', content: '渋谷区道玄坂にある15席のスペシャルティコーヒー専門店。2019年創業。月商：約85万円' },
        { id: 'demo:chunk-1b', content: '主力商品：シングルオリジンコーヒー各種、季節のラテアートシリーズ。スタッフ：オーナー含め4名。2026年中に2号店出店計画。' },
      ],
      sourceType: 'note',
      createdAt: now,
      tags: ['経営', 'カフェ', '店舗'],
      analysisStatus: 'done',
    },
    {
      id: 'demo:knowledge-2',
      personaId: pid,
      title: 'スタッフ採用要件メモ',
      content: '【バリスタ採用要件 2026年秋】\n勤務形態：週4日以上（シフト制）\nスキル：ラテアート経験者優遇、SCAJコーヒーマイスター資格者歓迎\n給与：時給1,400円〜1,600円（経験・スキルによる）\n採用人数：2名\n募集背景：2号店オープンに向けた戦力増強\n面接日程：随時（書類選考後1週間以内に連絡）',
      chunks: [
        { id: 'demo:chunk-2a', content: 'バリスタ採用要件 2026年秋。週4日以上シフト制。ラテアート経験者優遇、SCAJコーヒーマイスター資格者歓迎。' },
        { id: 'demo:chunk-2b', content: '時給1,400円〜1,600円。採用人数2名。2号店オープンに向けた戦力増強。' },
      ],
      sourceType: 'note',
      createdAt: now,
      tags: ['採用', 'スタッフ', '人事'],
      analysisStatus: 'done',
    },
    {
      id: 'demo:knowledge-3',
      personaId: pid,
      title: '秋冬メニュー戦略メモ',
      content: '【2026年秋冬メニュー戦略】\n目標：客単価を現在の820円から950円に引き上げ\n新商品候補：\n・スパイスラテ（ターメリック/チャイ）650円\n・焼き芋ホワイトモカ 700円\n・限定コーヒーフライト（3種飲み比べ）1,200円\n施策：SNS先行発表（Instagram/X）で予約注文を受付\nKPI：秋季（9-11月）売上前年比115%',
      chunks: [
        { id: 'demo:chunk-3a', content: '秋冬メニュー戦略。客単価を820円から950円に引き上げ。スパイスラテ650円、焼き芋ホワイトモカ700円、限定コーヒーフライト1,200円。' },
        { id: 'demo:chunk-3b', content: 'SNS先行発表でInstagram/X予約注文受付。秋季売上前年比115%目標。' },
      ],
      sourceType: 'note',
      createdAt: now,
      tags: ['メニュー', '戦略', '売上'],
      analysisStatus: 'done',
    },
  ];

  // ── CRM Deals (2) ─────────────────────────────────────────────
  const deals = [
    {
      id: 'demo:deal-1',
      personaId: pid,
      title: '渋谷2号店 物件契約',
      contact: '不動産エージェント 山田太郎',
      amount: 1200000,
      probability: 60,
      stage: 'proposal',
      expectedCloseDate: '2026-07-31',
      source: '紹介',
      description: '渋谷神泉エリアの物件。25坪・月額家賃48万円。内装工事費込みの初期投資試算中。',
      activities: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'demo:deal-2',
      personaId: pid,
      title: 'コーヒー豆 年間卸契約',
      contact: '田島コーヒー商事 田島部長',
      amount: 480000,
      probability: 80,
      stage: 'negotiation',
      expectedCloseDate: '2026-06-15',
      source: '既存取引先',
      description: 'エチオピア産シングルオリジン年間契約。現在1kg 4,200円 → 3,800円への値下げ交渉中。',
      activities: [],
      createdAt: now,
      updatedAt: now,
    },
  ];

  // ── Estimate Document (1) ──────────────────────────────────────
  const documents = [
    {
      id: 'demo:doc-1',
      personaId: pid,
      kind: 'estimate',
      status: 'draft',
      number: 'EST-TANAKA-2026-001',
      issuerSnapshot: {
        personaId: pid,
        name: 'CAFE TANAKA',
        ownerName: '田中健一',
        postalCode: '150-0043',
        address: '東京都渋谷区道玄坂1-1-1',
        tel: '03-1234-5678',
        email: 'info@cafe-tanaka.example.jp',
      },
      clientSnapshot: {
        id: 'demo:client-1',
        name: '渋谷インテリアデザイン株式会社',
        contactName: '佐藤デザイナー',
        address: '東京都渋谷区渋谷2-2-2',
      },
      subject: '2号店内装リノベーション 見積書',
      issueDate: today,
      validUntil: thirtyDaysLater,
      lines: [
        { id: 'demo:line-1', description: '内装設計・監理費', qty: 1, unitPrice: 450000, taxRate: 0.10 },
        { id: 'demo:line-2', description: 'カウンター製作・設置', qty: 1, unitPrice: 280000, taxRate: 0.10 },
        { id: 'demo:line-3', description: '照明器具・設置工事', qty: 1, unitPrice: 180000, taxRate: 0.10 },
      ],
      notes: 'お支払い条件：工事完了後30日以内\n※これはデモデータのサンプル見積書です',
      createdAt: now,
      updatedAt: now,
    },
  ];

  // ── Expenses (5) ──────────────────────────────────────────────
  const mkExpense = (
    id: string, dayOffset: number, vendor: string,
    category: string, description: string, amountIncl: number,
    payment: string,
  ) => {
    const d = new Date(Date.now() - dayOffset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const amountExcl = Math.round(amountIncl / 1.1);
    return {
      id, personaId: pid, date: d, vendor, category, description,
      amountIncl, taxRate: 10, amountExcl, taxAmount: amountIncl - amountExcl,
      payment, source: 'manual', createdAt: now,
    };
  };
  const expenses = [
    mkExpense('demo:exp-1', 2,  '田島コーヒー商事',     '消耗品費',   'エチオピア産コーヒー豆 12kg',      50400, 'bank'),
    mkExpense('demo:exp-2', 5,  '渋谷不動産管理',       '地代家賃',   '店舗家賃 (5月分)',                 220000, 'bank'),
    mkExpense('demo:exp-3', 8,  '東京電力',             '水道光熱費', '店舗電気代 (4月使用分)',           38500, 'card'),
    mkExpense('demo:exp-4', 11, 'カフェ用品オンライン', '消耗品費',   'テイクアウトカップ・ストロー補充', 14300, 'card'),
    mkExpense('demo:exp-5', 14, 'Meta広告',             '広告宣伝費', 'Instagram リール広告 (秋メニュー)', 22000, 'card'),
  ];

  // ── People (3) + Interactions (2) ─────────────────────────────
  const dayStr = (off: number) =>
    new Date(Date.now() - off * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const people = [
    {
      id: 'demo:person-1', personaId: pid, name: '佐藤美咲',
      role: 'バリスタ (リーダー)', company: 'CAFE TANAKA',
      contactInfo: { email: 'misaki@cafe-tanaka.example.jp' },
      lastInteraction: dayStr(3), createdAt: now,
      notes: 'ラテアートが得意。2号店の店長候補。',
      tags: ['スタッフ', '店長候補'],
    },
    {
      id: 'demo:person-2', personaId: pid, name: '田島部長',
      role: '営業部長', company: '田島コーヒー商事',
      contactInfo: { phone: '03-2345-6789' },
      lastInteraction: dayStr(6), createdAt: now,
      notes: 'コーヒー豆の卸取引先。年間契約を交渉中。',
      tags: ['取引先', '仕入'],
    },
    {
      id: 'demo:person-3', personaId: pid, name: '山田太郎',
      role: '不動産エージェント', company: '渋谷リアルエステート',
      contactInfo: { phone: '090-1234-5678' },
      lastInteraction: dayStr(10), createdAt: now,
      notes: '2号店の物件を紹介してくれた担当。',
      tags: ['取引先', '物件'],
    },
  ];
  const interactions = [
    {
      id: 'demo:inter-1', personId: 'demo:person-1', date: dayStr(3),
      type: '1on1', sentiment: 'positive',
      summary: '2号店の店長候補として意欲を確認。秋メニューのアイデアも前向き。',
      highlights: ['店長に挑戦したい意思あり', 'ラテアート講習を任せられそう'],
      nextTopics: ['シフトリーダー研修の日程'],
    },
    {
      id: 'demo:inter-2', personId: 'demo:person-2', date: dayStr(6),
      type: 'meeting', sentiment: 'neutral',
      summary: '年間卸契約の価格交渉。1kg 4,200円→3,800円を打診、検討中。',
      concerns: ['他社相見積もりの可能性'],
      nextTopics: ['6月中旬までに最終回答'],
    },
  ];

  // ── Write to localStorage (idempotent) ────────────────────────
  const upsert = (key: string, newItems: Array<{ id: string }>) => {
    const existing = loadArr<{ id: string }>(key);
    const cleaned = existing.filter(i => !i.id.startsWith('demo:'));
    saveArr(key, [...newItems, ...cleaned]);
  };

  // Persona uses its own array
  const existingPersonas = loadArr<{ id: string }>(PERSONA_STORE);
  const cleanedPersonas = existingPersonas.filter(p => !p.id.startsWith('demo:'));
  saveArr(PERSONA_STORE, [persona, ...cleanedPersonas]);

  upsert(KNOWLEDGE_STORE, knowledge);
  upsert(CRM_STORE, deals);
  upsert(DOC_STORE, documents);
  upsert(EXPENSE_STORE, expenses);
  upsert(PEOPLE_STORE, people);
  upsert(INTERACTION_STORE, interactions);

  // リロード後に demo 人格のダッシュボードへ直行できるよう、active persona を保存
  try { localStorage.setItem('core_active_persona_id_v1', pid); } catch { /* */ }

  // 1 persona + 5 tasks + 3 knowledge + 2 deals + 1 document
  //   + 5 expenses + 3 people + 2 interactions = 22
  return 22;
}
