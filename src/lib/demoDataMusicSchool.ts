// ============================================================
// GAUCHE Cello School — 音楽スクール デモ Seed
//
// オーナー戦略 (2026-06-02):
//   汎用 LP では刺さらない。垂直立ち上げで音楽スクール業界に集中。
//   GAUCHE Cello School を題材に、生徒 25 名規模・月謝 ¥18,000 の
//   実情に近い 6 ヶ月の運営データを localStorage に流し込む。
//
// 設計:
//   - 生徒 25 名 (うち体験中 3 / 月謝 ¥18,000 / 入会 3 年〜半年)
//   - 月謝売上 ¥450,000 + 不定期レッスン料 ¥30,000 = 約 ¥480,000/月
//   - スタッフ 1 名 (オーナー兼講師) + 副講師 1 名 (週末)
//   - スタジオ家賃 ¥120,000、ピアノ伴奏者謝礼、消耗品 (弦・弓毛)
//   - 退会兆候のある生徒 1 名、入会間近の体験生 2 名
//   - 法人請求 1 件 (近所のオフィスへの出張ミニコンサート)
// ============================================================
import type { Invoice, BusinessDocument, InvoiceLine, IssuerProfile, Client } from '../types/invoice';
import type { SalesEntry } from '../types/sales';
import type { ExpenseEntry } from '../types/expense';
import type { CRMDeal } from '../types/crm';
import type { PersonRecord, PersonInteraction } from '../types/people';

export const DEMO_MUSIC_PID = 'demo:persona-cello-school';

// ── 乱数 (seed 固定) ─────────────────────────────────────
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260602);
const irand = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));

// ── 日付ユーティリティ ───────────────────────────────────
function dateOnly(d: Date): string { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function endOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── 月次データ (6 ヶ月) ───────────────────────────────────
// 月謝 ¥18,000 × 生徒数 (季節で多少変動) + 入会金 + 単発レッスン
export interface MonthlyPoint {
  month: string;
  revenueJpy: number;
  expenseJpy: number;
  profitJpy: number;
  txnCount: number;
}

const STUDENT_HISTORY: Record<number, number> = {
  // 5 ヶ月前 → 当月 までの月末時点の在籍生徒数
  5: 22, 4: 23, 3: 24, 2: 24, 1: 25, 0: 25,
};

function buildMonthlySeries(today: Date): { monthly: MonthlyPoint[]; thisMonth: MonthlyPoint } {
  const monthly: MonthlyPoint[] = [];
  let thisMonth: MonthlyPoint | null = null;

  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const isCurrent = i === 0;

    // 直近 6 ヶ月は実生徒数ベース、それ以前は緩やかな立ち上げ
    let students = STUDENT_HISTORY[i] ?? Math.max(12, 22 - (i - 5) * 2);
    if (students > 25) students = 25;

    // 月謝
    const tuition = students * 18000;
    // 単発レッスン (月により変動)
    const oneOff = irand(15000, 45000);
    // 入会金 (たまに発生)
    const joinFee = rand() < 0.35 ? 10000 : 0;
    let revenue = tuition + oneOff + joinFee;
    // 当月は月の途中なので日割り
    if (isCurrent) {
      const dayOfMonth = today.getDate();
      const daysInMonth = endOfMonth(today).getDate();
      revenue = Math.round(revenue * dayOfMonth / daysInMonth);
    }

    // 経費
    const rent = 120000;             // スタジオ家賃
    const subTeacher = irand(40000, 60000); // 副講師謝礼
    const accompanist = irand(15000, 30000); // ピアノ伴奏者 (発表会前は増える)
    const supplies = irand(8000, 18000);     // 弦・弓毛・楽譜
    const ads = irand(5000, 12000);          // SNS 広告
    const utilities = irand(8000, 12000);
    const misc = irand(4000, 8000);
    let expense = rent + subTeacher + accompanist + supplies + ads + utilities + misc;
    if (isCurrent) {
      const dayOfMonth = today.getDate();
      const daysInMonth = endOfMonth(today).getDate();
      expense = Math.round((rent + subTeacher + accompanist + supplies + ads + utilities + misc) * dayOfMonth / daysInMonth);
    }

    const point: MonthlyPoint = {
      month: monthKey(monthStart),
      revenueJpy: revenue,
      expenseJpy: expense,
      profitJpy: revenue - expense,
      txnCount: students + (oneOff > 0 ? irand(1, 3) : 0),
    };
    monthly.push(point);
    if (isCurrent) thisMonth = point;
  }

  return { monthly, thisMonth: thisMonth! };
}

// ── Stripe-like キャッシュを書き込み ────────────────────
export function seedStripeCacheMusic(today: Date): MonthlyPoint {
  const { monthly, thisMonth } = buildMonthlySeries(today);
  const cache = {
    key: 'rk_test_',
    fetchedAt: Date.now(),
    data: {
      thisMonth: {
        revenueJpy: thisMonth.revenueJpy,
        expenseJpy: thisMonth.expenseJpy,
        profitJpy: thisMonth.profitJpy,
        txnCount: thisMonth.txnCount,
      },
      monthly,
      currencies: ['jpy'],
      fxSource: 'demo:cello-school',
      fetchedAt: Date.now(),
    },
  };
  try {
    // 本物の Stripe キーがある場合はデモで上書きしない (オーナー報告 2026-05-26)
    const existing = localStorage.getItem('core_integration_stripe') || '';
    const isRealKey = /^(rk|sk)_live_/.test(existing);
    if (!isRealKey) {
      localStorage.setItem('core_stripe_revenue_cache_v1', JSON.stringify(cache));
      localStorage.setItem('core_integration_stripe', 'rk_test_demo_cello_school_xxxxxxxx');
    }
  } catch { /* quota */ }
  return thisMonth;
}

// ── 売上 ledger (過去 60 日、レッスン日ベース) ───────────
export function buildMusicSalesLedger(today: Date, nowIso: string): SalesEntry[] {
  const entries: SalesEntry[] = [];
  // 月初に「○月分月謝」のまとめ売上を 1 行、
  // 月の途中で発表会参加費・単発レッスンを数行。
  for (let m = 2; m >= 0; m--) {
    const monthStart = new Date(today.getFullYear(), today.getMonth() - m, 1);
    if (monthStart > today) continue;
    const isCurrent = m === 0;
    const students = STUDENT_HISTORY[m] ?? 22;
    const tuition = students * 18000;

    // 月謝請求 (月初)
    const date5 = new Date(monthStart.getFullYear(), monthStart.getMonth(), 5);
    if (date5 <= today) {
      const totalIncl = tuition;
      const totalExcl = Math.round(totalIncl / 1.1);
      entries.push({
        id: `demo:music-ledger-tuition-${monthKey(monthStart)}`,
        personaId: DEMO_MUSIC_PID,
        source: 'manual',
        date: dateOnly(date5),
        clientName: `生徒 ${students} 名 (月謝)`,
        subject: `${monthStart.getMonth() + 1}月分 月謝 一括`,
        subtotal10: totalExcl,
        subtotal8: 0,
        subtotal0: 0,
        tax10: totalIncl - totalExcl,
        tax8: 0,
        totalExcl,
        totalTax: totalIncl - totalExcl,
        totalIncl,
        status: isCurrent ? 'paid' : 'paid',
        paidDate: dateOnly(date5),
        notes: `Stripe Billing 自動引き落とし`,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    // 単発レッスン (月内 2-3 回)
    const oneOffCount = irand(2, 3);
    for (let i = 0; i < oneOffCount; i++) {
      const d = new Date(monthStart.getFullYear(), monthStart.getMonth(), 8 + i * 9);
      if (d > today) continue;
      const fee = irand(4000, 8000);
      const totalIncl = fee;
      const totalExcl = Math.round(totalIncl / 1.1);
      entries.push({
        id: `demo:music-ledger-oneoff-${monthKey(monthStart)}-${i}`,
        personaId: DEMO_MUSIC_PID,
        source: 'manual',
        date: dateOnly(d),
        clientName: `単発レッスン受講者`,
        subject: `60 分レッスン (体験 / 不定期)`,
        subtotal10: totalExcl,
        subtotal8: 0,
        subtotal0: 0,
        tax10: totalIncl - totalExcl,
        tax8: 0,
        totalExcl,
        totalTax: totalIncl - totalExcl,
        totalIncl,
        status: 'paid',
        paidDate: dateOnly(d),
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
  }
  return entries;
}

// ── Invoice 発行者プロファイル ────────────────────────────
const MUSIC_ISSUER: IssuerProfile = {
  personaId: DEMO_MUSIC_PID,
  companyName: 'GAUCHE Cello School',
  representativeName: '井出 直毅',
  postalCode: '150-0042',
  address: '東京都渋谷区宇田川町20-3',
  phone: '03-6890-1234',
  email: 'info@gauche-cello.example.jp',
  registrationNumber: 'T9876543210123',
  bankInfo: '三菱UFJ銀行 渋谷支店 普通 7654321 ガウシュチェロスクール',
  notes: 'お支払期限を過ぎた場合、年利 14.6% の遅延損害金を頂戴することがございます。',
};

const MUSIC_CLIENTS: Client[] = [
  { id: 'demo:music-client-koyamada',    name: '株式会社コヤマダ商会',     contactName: '総務部 谷口様',   postalCode: '150-0002', address: '東京都渋谷区渋谷3-1-1',  email: 'soumu@koyamada.example.jp' },
  { id: 'demo:music-client-shibuya-arts', name: '渋谷アーツ財団',          contactName: '事務局 平松様',   postalCode: '150-0041', address: '東京都渋谷区神南2-2-2',  email: 'office@shibuya-arts.example.jp' },
];

// ── 法人請求 (出張ミニコンサート / 法人レッスン) ──────────
export function buildMusicInvoices(today: Date, nowIso: string): Invoice[] {
  const invoices: Invoice[] = [];
  let seq = 1;
  const mkInv = (monthsAgo: number, dayOfMonth: number, clientId: string, subject: string, lines: Array<Omit<InvoiceLine, 'id'>>, status: Invoice['status']) => {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - monthsAgo, dayOfMonth);
    const issueDate = dateOnly(monthDate);
    const dueDate = dateOnly(endOfMonth(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1)));
    const year = monthDate.getFullYear();
    const number = `INV-GAUCHE-${year}-${String(seq).padStart(3, '0')}`;
    seq++;
    const client = MUSIC_CLIENTS.find(c => c.id === clientId)!;
    invoices.push({
      id: `demo:music-inv-${number}`,
      personaId: DEMO_MUSIC_PID,
      number,
      issuerSnapshot: MUSIC_ISSUER,
      clientSnapshot: client,
      subject,
      issueDate,
      dueDate,
      lines: lines.map((l, i) => ({ ...l, id: `demo:music-line-${number}-${i}` })),
      paymentTerms: '月末締・翌月末払い',
      status,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  };

  mkInv(2, 20, 'demo:music-client-koyamada', '社内イベント ミニチェロコンサート', [
    { description: 'チェロ演奏 (30 分 × 2 回)', quantity: 1, unit: '式', unitPrice: 80000, taxRate: 10 },
    { description: 'ピアノ伴奏者派遣', quantity: 1, unit: '名', unitPrice: 25000, taxRate: 10 },
    { description: '機材搬入・搬出', quantity: 1, unit: '式', unitPrice: 8000, taxRate: 10 },
  ], 'paid');

  mkInv(1, 15, 'demo:music-client-shibuya-arts', '春の地域音楽教室 講師派遣', [
    { description: '体験レッスン講師 (90 分 × 4 回)', quantity: 4, unit: '回', unitPrice: 18000, taxRate: 10 },
  ], 'paid');

  mkInv(0, 18, 'demo:music-client-koyamada', '社内イベント 第2回 ミニチェロコンサート', [
    { description: 'チェロ演奏 (30 分 × 2 回)', quantity: 1, unit: '式', unitPrice: 80000, taxRate: 10 },
    { description: 'ピアノ伴奏者派遣', quantity: 1, unit: '名', unitPrice: 25000, taxRate: 10 },
    { description: '機材搬入・搬出', quantity: 1, unit: '式', unitPrice: 8000, taxRate: 10 },
  ], 'issued');

  return invoices;
}

// ── Expenses (過去 60 日、音楽スクール特有) ───────────────
export function buildMusicExpenses(today: Date, nowIso: string): ExpenseEntry[] {
  const list: ExpenseEntry[] = [];
  const mk = (
    idSuffix: string, daysAgo: number, vendor: string,
    category: ExpenseEntry['category'], description: string,
    amountIncl: number, payment: ExpenseEntry['payment'],
  ): ExpenseEntry => {
    const d = dateOnly(addDays(today, -daysAgo));
    const amountExcl = Math.round(amountIncl / 1.1);
    return {
      id: `demo:music-exp-${idSuffix}`,
      personaId: DEMO_MUSIC_PID,
      date: d, vendor, category, description,
      amountIncl, taxRate: 10, amountExcl, taxAmount: amountIncl - amountExcl,
      payment, source: 'manual', createdAt: nowIso,
    };
  };

  for (let m = 0; m < 2; m++) {
    const monthStart = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const daysAgoStart = Math.floor((today.getTime() - monthStart.getTime()) / (24 * 60 * 60 * 1000));
    const ym = `${monthStart.getMonth() + 1}月分`;

    // スタジオ家賃
    list.push(mk(`rent-${m}`, daysAgoStart, '渋谷スタジオプロパティ', '地代家賃',
      `スタジオ家賃 (${ym})`, 120000, 'bank'));
    // 副講師謝礼
    list.push(mk(`sub-teacher-${m}`, Math.max(0, daysAgoStart - 25), '副講師 (佐々木さん)', '外注費',
      `副講師謝礼 (${ym})`, irand(40000, 60000), 'bank'));
    // ピアノ伴奏者
    list.push(mk(`accompanist-${m}`, Math.max(0, daysAgoStart - 14), '伴奏者 (高橋さん)', '外注費',
      `伴奏者謝礼 (${ym})`, irand(15000, 30000), 'bank'));
    // 弦・弓毛・楽譜
    for (let s = 0; s < 2; s++) {
      const daysAgo = daysAgoStart - 7 - s * 14;
      if (daysAgo < 0 || daysAgo > 60) continue;
      const vendor = s === 0 ? 'ストリングス販売 上野店' : '楽譜の森 オンライン';
      const desc = s === 0 ? 'チェロ弦 4 セット + 松脂' : '練習曲楽譜 5 冊';
      list.push(mk(`supplies-${m}-${s}`, daysAgo, vendor, '消耗品費', desc, irand(8000, 18000), 'card'));
    }
    // SNS 広告
    list.push(mk(`ads-${m}`, daysAgoStart - 10, 'Meta Platforms', '広告宣伝費',
      `Instagram 広告 (${ym})`, irand(5000, 12000), 'card'));
    // 水道光熱費
    list.push(mk(`utilities-${m}`, daysAgoStart - 16, '東京電力エナジーパートナー', '水道光熱費',
      `スタジオ電気代 (${ym})`, irand(8000, 12000), 'card'));
  }

  return list;
}

// ── CRM (体験 → 入会パイプライン) ─────────────────────────
export function buildMusicDeals(nowIso: string): CRMDeal[] {
  const mk = (
    id: string, title: string, stage: CRMDeal['stage'], amount: number, probability: number,
    closeDate: string, contactName: string, company: string, description: string, source: string,
  ): CRMDeal => ({
    id: `demo:music-deal-${id}`,
    personaId: DEMO_MUSIC_PID,
    title,
    contact: { id: `demo:music-contact-${id}`, name: contactName, company },
    amount, probability, stage, expectedCloseDate: closeDate,
    source, description,
    activities: [],
    createdAt: nowIso, updatedAt: nowIso,
    closedAt: stage === 'won' || stage === 'lost' ? closeDate : undefined,
  });

  return [
    mk('1', '体験→入会: 田村さん (大人初心者)', 'proposal', 216000, 70, '2026-06-25',
      '田村 由香里', '個人',
      '体験レッスン受講済み。週 1 ペースで継続意欲あり。月謝 ¥18,000 × 12 ヶ月想定。', 'Instagram'),
    mk('2', '体験→入会: 小学 3 年 中島くん', 'proposal', 216000, 60, '2026-06-30',
      '中島 さくらさん (母)', '個人',
      'お子さんが学校でチェロを聴いて興味。体験後に保護者と要相談。', '紹介 (常連生徒)'),
    mk('3', '体験→入会: 高校生 久保田くん', 'qualified', 216000, 35, '2026-07-15',
      '久保田 翔太', '個人',
      '部活の引退後に始めたい。本人意欲は強いが家庭の経済事情で要検討。', 'Web 問合せ'),
    mk('4', '法人定期: コヤマダ商会 (社内サークル)', 'negotiation', 360000, 70, '2026-07-31',
      '谷口 様', '株式会社コヤマダ商会',
      '社員の趣味サークル向けに月 2 回の出張レッスン。月 ¥30,000 × 12 ヶ月。', 'スポット案件からの拡大'),
    mk('5', '発表会 ホール手配 (秋)', 'qualified', 80000, 50, '2026-08-10',
      '池田 様', 'クラシックホール さくら',
      '秋の発表会会場仮押さえ。本契約待ち。', '昨年実績'),
    mk('6', '楽器調整 提携 (ベルリン弦楽器工房)', 'won', 0, 100, '2026-04-15',
      '工房長 平岡 様', 'ベルリン弦楽器工房',
      '生徒紹介の調整費 10% 還元提携が成立。物的売上はないが生徒満足度に貢献。', '展示会'),
    mk('7', '体験→入会: 渡辺さん (リタイア後)', 'lost', 216000, 0, '2026-05-08',
      '渡辺 健次', '個人',
      '見学のみで終了。「もう少し近場で探す」と辞退。', 'Web 問合せ'),
  ];
}

// ── People (生徒 + スタッフ + 取引先) ─────────────────────
export function buildMusicPeople(today: Date, nowIso: string): { people: PersonRecord[]; interactions: PersonInteraction[] } {
  const day = (off: number) => dateOnly(addDays(today, -off));

  const people: PersonRecord[] = [
    // ── スタッフ 2 ────────────────────────────────
    { id: 'demo:music-p-sasaki',  personaId: DEMO_MUSIC_PID, name: '佐々木 美穂', role: '副講師 (週末)',     company: 'GAUCHE Cello School', contactInfo: { email: 'sasaki@gauche-cello.example.jp' }, lastInteraction: day(3),  createdAt: nowIso, notes: '土日メイン。初心者・子供クラス担当。音大卒。', tags: ['スタッフ', '副講師'] },
    { id: 'demo:music-p-takahashi', personaId: DEMO_MUSIC_PID, name: '高橋 慶子', role: 'ピアノ伴奏者',     company: 'フリーランス',         contactInfo: { email: 'takahashi@example.jp' },             lastInteraction: day(7),  createdAt: nowIso, notes: '発表会・コンサートの伴奏。月 1 回ペース。', tags: ['スタッフ', '伴奏者'] },
    // ── 生徒 (代表 6 名) ─────────────────────────
    { id: 'demo:music-s-tamura',  personaId: DEMO_MUSIC_PID, name: '田村 由香里', role: '体験中 (入会前)',  company: '個人',                contactInfo: { email: 'tamura@example.com' },               lastInteraction: day(2),  createdAt: nowIso, notes: '大人初心者。週 1 ペース希望。仕事帰り 19 時〜が中心。', tags: ['生徒', '体験中', '大人'] },
    { id: 'demo:music-s-nakajima', personaId: DEMO_MUSIC_PID, name: '中島 さくら (母)', role: '体験中 (お子さん入会検討)', company: '個人', contactInfo: { email: 'nakajima@example.com' },           lastInteraction: day(5),  createdAt: nowIso, notes: '小 3 男児の習い事として検討。週末希望。', tags: ['生徒', '体験中', 'こども'] },
    { id: 'demo:music-s-itoyama', personaId: DEMO_MUSIC_PID, name: '糸山 美智子', role: '在籍 3 年・上級',  company: '個人',                contactInfo: { email: 'itoyama@example.com' },              lastInteraction: day(8),  createdAt: nowIso, notes: '発表会では毎回ソロ。退会の気配なし。', tags: ['生徒', '上級', '主力'] },
    { id: 'demo:music-s-fujimoto', personaId: DEMO_MUSIC_PID, name: '藤本 真', role: '在籍 1 年・中級',     company: '個人',                contactInfo: { email: 'fujimoto@example.com' },             lastInteraction: day(45), createdAt: nowIso, notes: '⚠ 直近 6 週間で 2 回欠席。連絡頻度も落ちている。退会兆候の可能性。', tags: ['生徒', '中級', '⚠ 退会兆候'] },
    { id: 'demo:music-s-kawano',  personaId: DEMO_MUSIC_PID, name: '河野 隆司', role: '在籍 半年・初級',  company: '個人',                contactInfo: { email: 'kawano@example.com' },               lastInteraction: day(6),  createdAt: nowIso, notes: '40 代男性。リタイア前から始めたい派。練習熱心。', tags: ['生徒', '初級', '大人'] },
    { id: 'demo:music-s-okabe',   personaId: DEMO_MUSIC_PID, name: '岡部 結菜', role: '在籍 2 年・中級 (高校生)', company: '個人',         contactInfo: { email: 'okabe-parent@example.com' },         lastInteraction: day(4),  createdAt: nowIso, notes: '高校 1 年。コンクール本選経験あり。発表会の目玉枠。', tags: ['生徒', '中級', '高校生'] },
    // ── 取引先 2 ────────────────────────────────
    { id: 'demo:music-p-taniguchi', personaId: DEMO_MUSIC_PID, name: '谷口 様', role: '総務部',           company: '株式会社コヤマダ商会', contactInfo: { email: 'soumu@koyamada.example.jp' },        lastInteraction: day(12), createdAt: nowIso, notes: '社内イベント窓口。秋の社員サークル化を検討中。', tags: ['取引先', '法人'] },
    { id: 'demo:music-p-hiraoka',  personaId: DEMO_MUSIC_PID, name: '工房長 平岡 様', role: '弦楽器調整 工房長', company: 'ベルリン弦楽器工房', contactInfo: { email: 'hiraoka@berlin-luthier.example.jp' }, lastInteraction: day(20), createdAt: nowIso, notes: '生徒紹介で調整費 10% 還元。提携 2 年目。', tags: ['取引先', '楽器'] },
  ];

  const interactions: PersonInteraction[] = [
    { id: 'demo:music-int-1', personId: 'demo:music-s-tamura',    date: day(2),  type: 'meeting', sentiment: 'positive', summary: '2 回目の体験レッスン。「思っていたより音が出る!」と前向き。', highlights: ['入会の意思 7 割', '平日夜希望'], nextTopics: ['入会手続き案内'] },
    { id: 'demo:music-int-2', personId: 'demo:music-s-nakajima',  date: day(5),  type: 'email',   sentiment: 'neutral',  summary: 'お子さん体験後の保護者へ料金とスケジュール再送付。' },
    { id: 'demo:music-int-3', personId: 'demo:music-s-fujimoto',  date: day(45), type: 'note',    sentiment: 'negative', summary: '直近 6 週で 2 回欠席。前回振替も流れた。連絡が短文に。', concerns: ['退会兆候', 'モチベ低下'], nextTopics: ['カジュアル 1on1 を打診', '練習負荷の調整提案'] },
    { id: 'demo:music-int-4', personId: 'demo:music-s-itoyama',   date: day(8),  type: '1on1',    sentiment: 'positive', summary: '発表会曲の選曲相談。ドヴォルザーク第 1 楽章で合意。', highlights: ['発表会主役級', '友人紹介の見込みあり'] },
    { id: 'demo:music-int-5', personId: 'demo:music-s-kawano',    date: day(6),  type: 'meeting', sentiment: 'positive', summary: '基礎練習メニュー見直し。週 5 日 30 分の自主練継続中。', highlights: ['練習継続率 高'] },
    { id: 'demo:music-int-6', personId: 'demo:music-s-okabe',     date: day(4),  type: '1on1',    sentiment: 'positive', summary: 'コンクール課題曲の伴奏あわせ予定確定。' },
    { id: 'demo:music-int-7', personId: 'demo:music-p-sasaki',    date: day(3),  type: '1on1',    sentiment: 'positive', summary: '副講師シフト相談。発表会前の週末増コマを依頼、快諾。' },
    { id: 'demo:music-int-8', personId: 'demo:music-p-takahashi', date: day(7),  type: 'email',   sentiment: 'neutral',  summary: '次回伴奏あわせ日程調整。秋発表会向け 3 回確保。' },
    { id: 'demo:music-int-9', personId: 'demo:music-p-taniguchi', date: day(12), type: 'meeting', sentiment: 'positive', summary: '社内サークル化の打診を受領。月 2 回 ¥30,000 で試算合意。', highlights: ['法人定期化チャンス'], nextTopics: ['7 月開始の試算書提出'] },
    { id: 'demo:music-int-10', personId: 'demo:music-p-hiraoka',  date: day(20), type: 'email',   sentiment: 'neutral',  summary: '糸山さんの楽器調整完了報告。次の紹介候補は河野さん。' },
  ];

  return { people, interactions };
}

// ── Knowledge (5 件、analysis 入り) ──────────────────────
export function buildMusicKnowledge(nowIso: string) {
  const mk = (
    id: string, title: string, content: string, tags: string[],
    summary: string, insights: string[], strategy: string[], actions: string[], risks: string[],
  ) => ({
    id: `demo:music-k-${id}`,
    personaId: DEMO_MUSIC_PID,
    title,
    content,
    chunks: [{ id: `demo:music-k-${id}-c1`, content: content.slice(0, 300) }],
    sourceType: 'note' as const,
    createdAt: nowIso,
    tags,
    analysisStatus: 'done' as const,
    analysis: {
      summary, insights, strategy, actions, risks,
      generatedAt: nowIso,
    },
  });

  return [
    mk('overview', '教室概要・運営方針',
      '【GAUCHE Cello School 概要】\n渋谷・宇田川町のチェロ専門教室。2023 年開校。\n生徒 25 名 (大人 18 / こども 7) ・月謝 ¥18,000\n月商 約 ¥480,000 (月謝 + 単発 + イベント)\n講師:オーナー 1 名 + 副講師 1 名 (週末)\n伴奏者:月 1 ペースで業務委託\n強み:大人初心者・リタイア層に強い。発表会の質が高い。',
      ['経営', '音楽教室', '概要'],
      '生徒 25 名のチェロ専門教室。月商 ¥480,000 規模。大人初心者層に強い。',
      ['月謝 ¥18,000 は地域相場の中央', '生徒継続率 (年間) 約 85%'],
      ['法人サークル化で売上の山を作る', '退会兆候の早期察知が継続率の鍵'],
      ['コヤマダ商会 月 2 回 サークル契約化', 'CRM の体験パイプ 3 名を入会へ'],
      ['副講師退職時のオペレ崩壊', '発表会会場費の高騰']),
    mk('retention', '退会兆候の見極めメモ',
      '【退会兆候 4 サイン】\n① 直近 6 週で 2 回以上の欠席\n② 振替日程の調整連絡が短文化\n③ 自主練習の話題が減る\n④ 発表会の参加に消極的\n→ 上記 2 つ以上が重なったら、カジュアル 1on1 を 1 週以内に。',
      ['継続', '退会', 'CS'],
      '欠席・連絡短文化・練習話題減・発表会消極で退会兆候。2 つ重なれば 1 週以内に 1on1。',
      ['藤本さんは現在 3 サイン該当', '早期接触で退会率 -40% 実績'],
      ['週 1 で兆候レビュー (CRO + 講師)', '1on1 では学習負荷の調整も提示'],
      ['今週中に藤本さんへ連絡', '退会理由テンプレを WIP'],
      ['過剰接触で逆効果のリスク', '講師の感情労働増']),
    mk('autumn-recital', '秋の発表会 運営計画',
      '【2026 秋 発表会 計画】\n日程:10/26 (日) 14:00 開演\n会場:クラシックホール さくら (要仮押さえ)\n参加生徒:15 名 (うちソロ 6 名)\nピアノ伴奏:高橋さん (3 回あわせ予定)\n参加費:大人 ¥8,000 / こども ¥5,000\nコスト:会場 ¥80,000 + 伴奏 ¥40,000 + 印刷 ¥15,000\n見込み利益:¥35,000-¥45,000 + 翌期入会促進効果',
      ['発表会', 'イベント', '運営'],
      '10/26 (日) 秋発表会。ホール仮押さえ済み。利益 ¥40,000 程度 + 入会促進効果。',
      ['発表会後 30 日は問い合わせ +40% 傾向', '糸山さん・岡部さんがソロ目玉枠'],
      ['SNS 用ハイライト動画を当日撮影', '体験申込導線を発表会案内 LP に'],
      ['会場本契約 (8/10 期限)', 'プログラム冊子の WBS 作成'],
      ['伴奏者ダブルブッキング', '当日ノーショー (大雨等)']),
    mk('marketing', 'SNS / 紹介の流入分析',
      '【流入元 直近 3 ヶ月】\nInstagram 自然流入:18 件 (体験申込 5)\nInstagram 広告:8 件 (¥35,000 投下、体験 2)\n友人紹介:6 件 (体験 4 → 入会 3 → 紹介率 50%)\nWeb 検索:9 件 (体験 2)\n→ 紹介が CVR 圧倒的に高い。紹介インセンティブの設計余地あり。',
      ['集客', 'SNS', '紹介'],
      '紹介流入が CVR 50% でダントツ。Instagram 広告は ROAS 微妙。紹介設計が要。',
      ['広告 CPA 約 ¥17,500 (高い)', '紹介は CPA ¥0 で CVR 50%'],
      ['紹介者へ「次月月謝 -¥3,000」のインセ', 'Instagram は広告→自然投稿比率を逆転'],
      ['紹介プログラム文案作成', '在籍 1 年以上の生徒に告知'],
      ['不公平感 (紹介できる人/できない人)', '値引き原資の捻出']),
    mk('financial', '月次収支メモ',
      '【月次収支 (直近 3 ヶ月平均)】\n売上:¥482,000 (月謝 ¥450,000 + 単発 ¥32,000)\n経費:¥247,000 (家賃 ¥120,000 + 副講師 ¥50,000 + 伴奏 ¥22,000 + 消耗品 ¥15,000 + 広告 ¥8,000 + 光熱 ¥10,000 + 雑費 ¥22,000)\n営業利益:¥235,000 (利益率 49%)\n所感:利益率は健全。法人サークル契約が成立すれば月 +¥30,000。',
      ['財務', '月次', '振り返り'],
      '月次利益 ¥235,000 (利益率 49%)。法人サークル獲得で +¥30,000 の上振れ余地。',
      ['利益率 49% は教室業として優秀', '生徒 1 名追加で月 +¥18,000'],
      ['コヤマダ商会の法人サークル化', '生徒 28 名を年内目標'],
      ['法人試算書を 7/15 までに送付', '生徒満員時の場所拡張検討'],
      ['副講師依存 (週末オペ崩壊リスク)', 'スタジオ家賃の段階値上げ']),
  ];
}

// ── Tasks (10 件、退会兆候対応 + 入会促進が中心) ──────────
export function buildMusicTasks(today: Date, _nowIso: string) {
  const day = (off: number) => dateOnly(addDays(today, off));
  const past = (off: number) => addDays(today, -off).toISOString();
  return [
    { id: 'demo:music-task-1', title: '⚠ 藤本さんに退会兆候対応の 1on1 を打診',                priority: 'high' as const, due: '今週',    done: false, personaId: DEMO_MUSIC_PID, estimatedMin: 15, createdAt: past(1) },
    { id: 'demo:music-task-2', title: '田村さんの入会手続き案内メールを送る',                    priority: 'high' as const, due: '今週',    done: false, personaId: DEMO_MUSIC_PID, estimatedMin: 20, createdAt: past(2) },
    { id: 'demo:music-task-3', title: 'コヤマダ商会 法人サークル試算書を作成',                    priority: 'high' as const, due: day(10),  done: false, personaId: DEMO_MUSIC_PID, estimatedMin: 60, createdAt: past(3) },
    { id: 'demo:music-task-4', title: '中島さん (お子さん) のご家族に料金表 + 体験案内を再送',     priority: 'mid' as const,  due: '来週',    done: false, personaId: DEMO_MUSIC_PID, estimatedMin: 15, createdAt: past(4) },
    { id: 'demo:music-task-5', title: '秋発表会 ホール本契約を進める (8/10 期限)',                  priority: 'high' as const, due: day(35),  done: false, personaId: DEMO_MUSIC_PID, estimatedMin: 30, createdAt: past(5) },
    { id: 'demo:music-task-6', title: '紹介インセンティブ 文案を作る',                            priority: 'mid' as const,  due: '今月',    done: false, personaId: DEMO_MUSIC_PID, estimatedMin: 45, createdAt: past(2) },
    { id: 'demo:music-task-7', title: '5 月分月謝の未収はないか Stripe で確認',                    priority: 'mid' as const,  due: '今週',    done: false, personaId: DEMO_MUSIC_PID, estimatedMin: 10, createdAt: past(1) },
    { id: 'demo:music-task-8', title: '副講師 佐々木さんへ発表会前の増コマ依頼 (済)',              priority: 'mid' as const,  due: '完了',    done: true,  personaId: DEMO_MUSIC_PID, estimatedMin: 10, createdAt: past(7), completedAt: past(3) },
    { id: 'demo:music-task-9', title: '楽譜の森 オンラインで練習曲 5 冊発注 (済)',                  priority: 'low' as const,  due: '完了',    done: true,  personaId: DEMO_MUSIC_PID, estimatedMin: 15, createdAt: past(15), completedAt: past(12) },
    { id: 'demo:music-task-10', title: 'Instagram 投稿: 体験レッスン Before/After 動画',           priority: 'low' as const,  due: day(7),   done: false, personaId: DEMO_MUSIC_PID, estimatedMin: 60, createdAt: past(0) },
  ];
}

// ── Documents (発表会 ホール見積) ────────────────────────
export function buildMusicDocuments(today: Date, nowIso: string): BusinessDocument[] {
  const todayStr = dateOnly(today);
  const validUntil = dateOnly(addDays(today, 30));
  return [{
    id: 'demo:music-doc-1',
    personaId: DEMO_MUSIC_PID,
    kind: 'estimate',
    status: 'sent',
    number: 'EST-GAUCHE-2026-001',
    issuerSnapshot: MUSIC_ISSUER,
    clientSnapshot: {
      id: 'demo:music-client-hall',
      name: 'クラシックホール さくら',
      contactName: '池田 様',
      address: '東京都目黒区中目黒3-3-3',
    },
    subject: '2026 秋 発表会 会場利用 御見積',
    issueDate: todayStr,
    validUntil,
    lines: [
      { id: 'demo:music-doc-1-l1', description: 'ホール使用料 (午後・本番)', quantity: 1, unitPrice: 60000, taxRate: 10 },
      { id: 'demo:music-doc-1-l2', description: 'リハーサル (午前 2 時間)',   quantity: 1, unitPrice: 15000, taxRate: 10 },
      { id: 'demo:music-doc-1-l3', description: '音響オペレーター 1 名',      quantity: 1, unitPrice: 8000,  taxRate: 10 },
    ],
    notes: '本契約は 2026/8/10 までにご返答ください。',
    createdAt: nowIso,
    updatedAt: nowIso,
  }];
}

// ── AgentTask (CXO 提案 2 件) ────────────────────────────
export function buildMusicAgentTasks(nowIso: string) {
  return [
    {
      id: 'demo:music-agent-retention',
      title: '退会兆候のある生徒へ自動メールを作る',
      summary: '藤本さんへ「久しぶりに 1on1 で近況を話しませんか?」のカジュアル招待文を CDO + COO で作成。',
      why: '退会兆候を早期接触で吸収。継続率 +5pt の効果見込み。',
      expected: '本人宛のメール下書き 2 案 + 送付タイミング提案',
      dueDays: 3,
      status: 'proposed' as const,
      proposedAt: nowIso,
      steps: [
        { cxo: 'CDO' as const, label: '生徒さんとの過去ログ分析', status: 'pending' as const },
        { cxo: 'COO' as const, label: '丁寧で押し付けないメール文案 2 案', status: 'pending' as const },
      ],
    },
    {
      id: 'demo:music-agent-corporate',
      title: 'コヤマダ商会 法人サークル契約 試算書を作る',
      summary: '月 2 回 ¥30,000 で年間 ¥360,000 の法人定期。試算書 + 提案書 1 枚を CSO + CFO で作成。',
      why: '生徒数を増やさずに月商 +6%。先方は既に前向き。',
      expected: '提案書 PDF 1 枚 + Excel 試算表',
      dueDays: 7,
      status: 'proposed' as const,
      proposedAt: nowIso,
      steps: [
        { cxo: 'CSO' as const, label: '提案書 1 枚作成', status: 'pending' as const },
        { cxo: 'CFO' as const, label: '12 ヶ月 試算表 (Excel)', status: 'pending' as const },
      ],
    },
  ];
}
