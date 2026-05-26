// ============================================================
// CAFE TANAKA — 12 ヶ月の経営ストーリー Demo Seed
//
// オーナー指示 (2026-05-25):
//   「デモモードでデータが全部 0 だと、財務コンサルが助言できない。
//    日ごと・週ごと・月ごと・年ごと・四半期ごとの売上データを
//    実在しそうなカフェの実情で出して、全機能を確認できるようにして」
//
// このファイルは onboarding.seedDemoData() から呼ばれ、
// localStorage に書き込むだけで全機能を動かせる demo データを生成する。
//
// 設計:
//   - 渋谷区道玄坂 15 席 スペシャルティコーヒー専門店
//   - 月商レンジ 70-110 万 (季節性あり)
//   - 直近 12 ヶ月の Stripe-like 月次キャッシュ
//   - 過去 90 日の日次売上 ledger / 経費 30+ 件
//   - Invoices 法人請求 12 件、CRM Deals 8 件
//   - People 10 + Interactions 15
//   - Knowledge 8 件 (analysis 入り)
//
// 完全に架空: 取引先名は「株式会社○○」風の汎用ネーミングのみ。
// ============================================================
import type { Invoice, BusinessDocument, InvoiceLine, IssuerProfile, Client } from '../types/invoice';
import type { SalesEntry } from '../types/sales';
import type { ExpenseEntry } from '../types/expense';
import type { CRMDeal } from '../types/crm';
import type { PersonRecord, PersonInteraction } from '../types/people';

export const DEMO_PID = 'demo:persona-tanaka';

// ── 乱数 (seed 固定) ─────────────────────────────────────
// 同じ日に複数回 seed しても同じ値が出るように seeded random を使う
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260525);
const between = (min: number, max: number) => min + rand() * (max - min);
const irand = (min: number, max: number) => Math.floor(between(min, max + 1));

// 日付決定論的 PRNG — monthly と sales ledger で同じ日の売上を一致させるため。
// 同じ日付に対して常に同じ乱数列を返す (呼出し順非依存)。
function dayHash(d: Date): number {
  const y = d.getFullYear(); const m = d.getMonth() + 1; const day = d.getDate();
  // 大きめの素数で雑にミックス
  return ((y * 73856093) ^ (m * 19349663) ^ (day * 83492791)) >>> 0;
}
function dayRand(d: Date): () => number {
  return mulberry32(dayHash(d) ^ 0x20260525);
}

// ── 日付ユーティリティ ───────────────────────────────────
function dateOnly(d: Date): string { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function endOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── 季節性: 月 (1-12) → 売上係数 ────────────────────────
//   春 (3-5月): 0.95-1.05
//   夏 (6-8月): 0.80-0.90 (閑散)
//   秋 (9-11月): 1.05-1.20 (繁忙)
//   冬 (12-2月): 0.90-1.00 (年末年始ムラ)
const SEASONAL_RANGE: Record<number, [number, number]> = {
  1: [0.88, 0.96], 2: [0.85, 0.95], 3: [0.95, 1.03],
  4: [0.98, 1.06], 5: [0.96, 1.05], 6: [0.82, 0.90],
  7: [0.80, 0.88], 8: [0.78, 0.86], 9: [1.05, 1.15],
  10: [1.08, 1.20], 11: [1.10, 1.20], 12: [0.92, 1.05],
};

// ── 1 日の売上を生成 (day-deterministic: 同じ日は呼出順に関わらず同じ値) ──
function dailyRevenue(d: Date): { revenue: number; customers: number; weekend: boolean; rainy: boolean } {
  const dr = dayRand(d);
  const dow = d.getDay();
  const isWeekend = dow === 0 || dow === 6;
  const isRainy = dr() < 0.18;
  let customers = isWeekend
    ? 60 + Math.floor(dr() * 31)   // 60-90
    : 30 + Math.floor(dr() * 21);  // 30-50
  if (isRainy) customers = Math.floor(customers * 0.7);

  // 客単価
  const cutoff = new Date(2025, 8, 1);
  const ticket = d >= cutoff
    ? Math.round(900 + dr() * 50)
    : Math.round(820 + dr() * 60);

  // 季節係数
  const [lo, hi] = SEASONAL_RANGE[d.getMonth() + 1] || [0.95, 1.05];
  const factor = lo + dr() * (hi - lo);

  const revenue = Math.round(customers * ticket * factor);
  return { revenue, customers, weekend: isWeekend, rainy: isRainy };
}

// ── 12 ヶ月分の月次データを生成 (今月は当日まで) ─────────
export interface MonthlyPoint {
  month: string;       // 'YYYY-MM'
  revenueJpy: number;
  expenseJpy: number;
  profitJpy: number;
  txnCount: number;
}

function buildMonthlySeries(today: Date): { monthly: MonthlyPoint[]; thisMonth: MonthlyPoint } {
  const monthly: MonthlyPoint[] = [];
  let thisMonth: MonthlyPoint | null = null;

  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthEnd = endOfMonth(monthStart);
    const isCurrent = i === 0;
    const lastDay = isCurrent ? today : monthEnd;

    let revenue = 0;
    let txnCount = 0;
    for (let d = new Date(monthStart); d <= lastDay; d = addDays(d, 1)) {
      const r = dailyRevenue(d);
      revenue += r.revenue;
      txnCount += r.customers;
    }

    // 経費 (月固定 + 変動)
    const rent = 220000;
    const labor = irand(265000, 295000);
    const cogs = Math.round(revenue * irand(22, 26) / 100); // 仕入は売上の 22-26%
    const utilities = irand(34000, 42000);
    const ads = irand(18000, 26000);
    const misc = irand(12000, 18000); // 通信・消耗品
    let expense = rent + labor + cogs + utilities + ads + misc;
    // 当月は途中までなので経費も日割り (家賃・人件費・広告以外は日割り)
    if (isCurrent) {
      const dayOfMonth = today.getDate();
      const daysInMonth = endOfMonth(today).getDate();
      const dailyVarExpense = (cogs + utilities + misc) / daysInMonth * dayOfMonth;
      const dailyLabor = labor / daysInMonth * dayOfMonth;
      expense = Math.round(rent + dailyLabor + dailyVarExpense + ads * dayOfMonth / daysInMonth);
    }

    const point: MonthlyPoint = {
      month: monthKey(monthStart),
      revenueJpy: revenue,
      expenseJpy: expense,
      profitJpy: revenue - expense,
      txnCount,
    };
    monthly.push(point);
    if (isCurrent) thisMonth = point;
  }

  return { monthly, thisMonth: thisMonth! };
}

// ── Stripe-like キャッシュを書き込み ────────────────────
export function seedStripeCache(today: Date): MonthlyPoint {
  const { monthly, thisMonth } = buildMonthlySeries(today);
  const cache = {
    key: 'rk_test_', // useStripeRevenue が key.slice(0,8) で照合
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
      fxSource: 'demo:cafe-tanaka',
      fetchedAt: Date.now(),
    },
  };
  try {
    // 既に本物の Stripe キー (rk_live_ / sk_live_) が保存されている場合は、
    // デモ seed では絶対に上書きしない (オーナー報告 2026-05-26: タブ閉じで rk_live_
    // が消える根本原因)
    const existing = localStorage.getItem('core_integration_stripe') || '';
    const isRealKey = /^(rk|sk)_live_/.test(existing);
    if (!isRealKey) {
      // 本物キーが無い時のみ、demo cache + demo key をセットする
      localStorage.setItem('core_stripe_revenue_cache_v1', JSON.stringify(cache));
      localStorage.setItem('core_integration_stripe', 'rk_test_demo_cafe_tanaka_xxxxxxxx');
    }
    // 本物キーがある時はキャッシュも上書きしない (実データを優先)
  } catch { /* quota */ }
  return thisMonth;
}

// ── 過去 90 日の日次売上 ledger を生成 ───────────────────
export function buildSalesLedger(today: Date, nowIso: string): SalesEntry[] {
  const entries: SalesEntry[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = addDays(today, -i);
    const r = dailyRevenue(d);
    if (r.revenue === 0) continue;
    // 1 日 1 エントリ (店頭売上を 1 行にまとめる)
    const totalIncl = r.revenue;
    const totalExcl = Math.round(totalIncl / 1.1);
    const tax10 = totalIncl - totalExcl;
    const subject = r.rainy
      ? `店頭売上 (${r.weekend ? '週末' : '平日'}・雨)`
      : `店頭売上 (${r.weekend ? '週末' : '平日'})`;
    entries.push({
      id: `demo:ledger-${dateOnly(d)}`,
      personaId: DEMO_PID,
      source: 'manual',
      date: dateOnly(d),
      clientName: '店頭 (POS)',
      subject,
      subtotal10: totalExcl,
      subtotal8: 0,
      subtotal0: 0,
      tax10,
      tax8: 0,
      totalExcl,
      totalTax: tax10,
      totalIncl,
      status: 'paid',
      paidDate: dateOnly(d),
      notes: `客数 ${r.customers} 名`,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }
  return entries;
}

// ── Invoices (法人請求 12 件) ────────────────────────────
const ISSUER: IssuerProfile = {
  personaId: DEMO_PID,
  companyName: 'CAFE TANAKA',
  representativeName: '田中健一',
  postalCode: '150-0043',
  address: '東京都渋谷区道玄坂1-1-1',
  phone: '03-1234-5678',
  email: 'info@cafe-tanaka.example.jp',
  registrationNumber: 'T1234567890123',
  bankInfo: '渋谷信用金庫 道玄坂支店 普通 1234567 カフエタナカ',
  notes: 'お支払期限を過ぎた場合、年利 14.6% の遅延損害金を頂戴することがございます。',
};

const CORPORATE_CLIENTS: Client[] = [
  { id: 'demo:client-shibuyatech',   name: '株式会社シブヤテック',     contactName: '総務部 鈴木様',   postalCode: '150-0002', address: '東京都渋谷区渋谷2-2-2',  email: 'soumu@shibuyatech.example.jp' },
  { id: 'demo:client-abcrealestate', name: 'ABC 不動産株式会社',       contactName: '管理部 田村様',   postalCode: '150-0031', address: '東京都渋谷区桜丘町3-3-3', email: 'kanri@abc-re.example.jp' },
  { id: 'demo:client-creativelab',   name: '株式会社クリエイティブ・ラボ', contactName: '広報 佐藤様', postalCode: '150-0001', address: '東京都渋谷区神宮前4-4-4', email: 'pr@creative-lab.example.jp' },
  { id: 'demo:client-eventworks',    name: 'イベントワークス合同会社',  contactName: '代表 中村様',     postalCode: '150-0011', address: '東京都渋谷区東5-5-5',     email: 'info@event-works.example.jp' },
  { id: 'demo:client-greenoffice',   name: 'グリーンオフィス株式会社',  contactName: '総務 高橋様',     postalCode: '150-0021', address: '東京都渋谷区恵比寿6-6-6', email: 'office@green-office.example.jp' },
];

interface InvoiceSeed {
  monthsAgo: number;     // 何ヶ月前の請求か
  dayOfMonth: number;    // 月内の発行日
  clientId: string;
  subject: string;
  lines: Array<Omit<InvoiceLine, 'id'>>;
  status: 'paid' | 'issued' | 'draft' | 'cancelled';
}

const INVOICE_SEEDS: InvoiceSeed[] = [
  // ── 定期: 株式会社シブヤテック 月次オフィスコーヒー (3 ヶ月分) ──
  { monthsAgo: 3, dayOfMonth: 28, clientId: 'demo:client-shibuyatech', subject: '2026年2月分 オフィスコーヒー定期配達',
    lines: [{ description: 'オフィス向けコーヒー豆 月次定期 (5kg)', quantity: 1, unit: '式', unitPrice: 48000, taxRate: 10 }],
    status: 'paid' },
  { monthsAgo: 2, dayOfMonth: 28, clientId: 'demo:client-shibuyatech', subject: '2026年3月分 オフィスコーヒー定期配達',
    lines: [{ description: 'オフィス向けコーヒー豆 月次定期 (5kg)', quantity: 1, unit: '式', unitPrice: 48000, taxRate: 10 }],
    status: 'paid' },
  { monthsAgo: 1, dayOfMonth: 28, clientId: 'demo:client-shibuyatech', subject: '2026年4月分 オフィスコーヒー定期配達',
    lines: [{ description: 'オフィス向けコーヒー豆 月次定期 (5kg)', quantity: 1, unit: '式', unitPrice: 48000, taxRate: 10 }],
    status: 'paid' },
  // ── 定期: ABC 不動産 月次 (2 ヶ月分) ──
  { monthsAgo: 2, dayOfMonth: 25, clientId: 'demo:client-abcrealestate', subject: '2026年3月分 来客用ドリップバッグ納品',
    lines: [{ description: 'ドリップバッグ ブレンド 100 個', quantity: 100, unit: '個', unitPrice: 280, taxRate: 10 }],
    status: 'paid' },
  { monthsAgo: 1, dayOfMonth: 25, clientId: 'demo:client-abcrealestate', subject: '2026年4月分 来客用ドリップバッグ納品',
    lines: [{ description: 'ドリップバッグ ブレンド 100 個', quantity: 100, unit: '個', unitPrice: 280, taxRate: 10 }],
    status: 'paid' },
  // ── 定期: クリエイティブ・ラボ ──
  { monthsAgo: 2, dayOfMonth: 30, clientId: 'demo:client-creativelab', subject: '2026年3月分 ミーティング用ケータリング',
    lines: [
      { description: 'スペシャルティブレンド 2kg', quantity: 1, unit: '式', unitPrice: 18000, taxRate: 10 },
      { description: '焼き菓子盛り合わせ', quantity: 1, unit: '式', unitPrice: 12000, taxRate: 8 },
    ],
    status: 'paid' },
  { monthsAgo: 1, dayOfMonth: 30, clientId: 'demo:client-creativelab', subject: '2026年4月分 ミーティング用ケータリング',
    lines: [
      { description: 'スペシャルティブレンド 2kg', quantity: 1, unit: '式', unitPrice: 18000, taxRate: 10 },
      { description: '焼き菓子盛り合わせ', quantity: 1, unit: '式', unitPrice: 12000, taxRate: 8 },
    ],
    status: 'paid' },
  // ── スポット: イベント出張カフェ (2 件) ──
  { monthsAgo: 4, dayOfMonth: 18, clientId: 'demo:client-eventworks', subject: '社内イベント 出張カフェ運営費',
    lines: [
      { description: 'バリスタ派遣 (2 名 × 6 時間)', quantity: 12, unit: '時間', unitPrice: 4500, taxRate: 10 },
      { description: 'コーヒー・ドリンク提供 (100 杯想定)', quantity: 100, unit: '杯', unitPrice: 380, taxRate: 10 },
      { description: '機材搬入・搬出', quantity: 1, unit: '式', unitPrice: 25000, taxRate: 10 },
    ],
    status: 'paid' },
  { monthsAgo: 0, dayOfMonth: 12, clientId: 'demo:client-greenoffice', subject: '新オフィスオープン記念 出張カフェ',
    lines: [
      { description: 'バリスタ派遣 (3 名 × 5 時間)', quantity: 15, unit: '時間', unitPrice: 4500, taxRate: 10 },
      { description: 'コーヒー・ドリンク提供 (150 杯)', quantity: 150, unit: '杯', unitPrice: 380, taxRate: 10 },
      { description: '機材搬入・搬出', quantity: 1, unit: '式', unitPrice: 25000, taxRate: 10 },
    ],
    status: 'paid' },
  // ── 今月発行 (未入金) ──
  { monthsAgo: 0, dayOfMonth: 20, clientId: 'demo:client-shibuyatech', subject: '2026年5月分 オフィスコーヒー定期配達',
    lines: [{ description: 'オフィス向けコーヒー豆 月次定期 (5kg)', quantity: 1, unit: '式', unitPrice: 48000, taxRate: 10 }],
    status: 'issued' },
  { monthsAgo: 0, dayOfMonth: 22, clientId: 'demo:client-abcrealestate', subject: '2026年5月分 来客用ドリップバッグ納品',
    lines: [{ description: 'ドリップバッグ ブレンド 100 個', quantity: 100, unit: '個', unitPrice: 280, taxRate: 10 }],
    status: 'issued' },
  // ── 下書き ──
  { monthsAgo: 0, dayOfMonth: 24, clientId: 'demo:client-creativelab', subject: '2026年5月分 ミーティング用ケータリング (下書き)',
    lines: [
      { description: 'スペシャルティブレンド 2kg', quantity: 1, unit: '式', unitPrice: 18000, taxRate: 10 },
      { description: '焼き菓子盛り合わせ', quantity: 1, unit: '式', unitPrice: 12000, taxRate: 8 },
    ],
    status: 'draft' },
  // ── 取消 (前月に発行したが先方都合でキャンセル) ──
  { monthsAgo: 1, dayOfMonth: 5, clientId: 'demo:client-eventworks', subject: '社内研修 出張カフェ (中止)',
    lines: [{ description: 'バリスタ派遣 (2 名 × 4 時間)', quantity: 8, unit: '時間', unitPrice: 4500, taxRate: 10 }],
    status: 'cancelled' },
];

export function buildInvoices(today: Date, nowIso: string): Invoice[] {
  const invoices: Invoice[] = [];
  let seq = 1;
  for (const s of INVOICE_SEEDS) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - s.monthsAgo, s.dayOfMonth);
    const issueDate = dateOnly(monthDate);
    const dueDate = dateOnly(endOfMonth(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1)));
    const year = monthDate.getFullYear();
    const number = `INV-CAFETANAKA-${year}-${String(seq).padStart(3, '0')}`;
    seq++;
    const client = CORPORATE_CLIENTS.find(c => c.id === s.clientId)!;
    const lines: InvoiceLine[] = s.lines.map((l, i) => ({ ...l, id: `demo:line-${number}-${i}` }));
    invoices.push({
      id: `demo:inv-${number}`,
      personaId: DEMO_PID,
      number,
      issuerSnapshot: ISSUER,
      clientSnapshot: client,
      subject: s.subject,
      issueDate,
      dueDate,
      lines,
      notes: s.status === 'cancelled' ? '※ 先方都合により中止 (請求取消)' : undefined,
      paymentTerms: '月末締・翌月末払い',
      status: s.status,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }
  return invoices;
}

// ── Expenses (過去 90 日に 30+ 件) ───────────────────────
export function buildExpenses(today: Date, nowIso: string): ExpenseEntry[] {
  const list: ExpenseEntry[] = [];
  const mk = (
    idSuffix: string, daysAgo: number, vendor: string,
    category: ExpenseEntry['category'], description: string,
    amountIncl: number, payment: ExpenseEntry['payment'], taxRate: 10 | 8 | 0 = 10,
  ): ExpenseEntry => {
    const d = dateOnly(addDays(today, -daysAgo));
    const div = taxRate === 0 ? 1 : (1 + taxRate / 100);
    const amountExcl = Math.round(amountIncl / div);
    return {
      id: `demo:exp-${idSuffix}`,
      personaId: DEMO_PID,
      date: d, vendor, category, description,
      amountIncl, taxRate, amountExcl, taxAmount: amountIncl - amountExcl,
      payment, source: 'manual', createdAt: nowIso,
    };
  };

  // 過去 3 ヶ月分の経費を月ごとに配置
  for (let m = 0; m < 3; m++) {
    const monthStart = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const daysAgoStart = Math.floor((today.getTime() - monthStart.getTime()) / (24 * 60 * 60 * 1000));
    const ym = `${monthStart.getMonth() + 1}月分`;

    // 家賃 (月初) — 当月は途中なら今月分はまだ
    list.push(mk(`rent-${m}`, daysAgoStart, '渋谷不動産管理株式会社', '地代家賃',
      `店舗家賃 (${ym})`, 220000, 'bank'));
    // 人件費 (月末)
    const laborDaysAgo = Math.max(0, daysAgoStart - 28);
    if (m > 0 || laborDaysAgo > 0) {
      list.push(mk(`labor-${m}`, laborDaysAgo, '給与振込', '外注費',
        `バリスタ給与 (${ym})`, irand(265000, 295000), 'bank'));
    }
    // 仕入 (月内 8 回 = 週 2 回)
    for (let w = 0; w < 8; w++) {
      const daysAgo = daysAgoStart - 3 - w * 3;
      if (daysAgo < 0 || daysAgo > 90) continue;
      const vendor = w % 3 === 0 ? '田島コーヒー商事' : w % 3 === 1 ? '渋谷ミルク商会' : 'シロップ・スイーツ卸';
      const desc = w % 3 === 0 ? 'エチオピア産コーヒー豆 8kg' : w % 3 === 1 ? '低温殺菌牛乳 20L' : 'シロップ・カップ補充';
      const amt = w % 3 === 0 ? irand(28000, 42000) : w % 3 === 1 ? irand(8000, 14000) : irand(12000, 22000);
      list.push(mk(`cogs-${m}-${w}`, daysAgo, vendor, '消耗品費', desc, amt, w % 2 === 0 ? 'bank' : 'card'));
    }
    // 水道光熱費 (月 1 回)
    list.push(mk(`util-${m}`, daysAgoStart - 8, '東京電力エナジーパートナー', '水道光熱費',
      `店舗電気代 (${monthStart.getMonth()}月使用分)`, irand(34000, 42000), 'card'));
    // 広告 (週 1 回 = 月 4 回)
    for (let a = 0; a < 4; a++) {
      const daysAgo = daysAgoStart - 6 - a * 7;
      if (daysAgo < 0 || daysAgo > 90) continue;
      list.push(mk(`ad-${m}-${a}`, daysAgo, 'Meta Platforms', '広告宣伝費',
        `Instagram 広告 (${ym} 第${a + 1}週)`, irand(4500, 6500), 'card'));
    }
    // 消耗品 (月 2 回)
    for (let s = 0; s < 2; s++) {
      const daysAgo = daysAgoStart - 12 - s * 14;
      if (daysAgo < 0 || daysAgo > 90) continue;
      list.push(mk(`misc-${m}-${s}`, daysAgo, 'カフェ用品オンライン', '消耗品費',
        'テイクアウト容器・ストロー補充', irand(7000, 14000), 'card'));
    }
    // 通信費 (月 1 回)
    list.push(mk(`tel-${m}`, daysAgoStart - 15, 'NTT 東日本', '通信費',
      `光回線・電話料金 (${ym})`, irand(7500, 9500), 'bank'));
  }

  return list;
}

// ── CRM Deals (8 件) ─────────────────────────────────────
export function buildDeals(nowIso: string): CRMDeal[] {
  const mk = (
    id: string, title: string, stage: CRMDeal['stage'], amount: number, probability: number,
    closeDate: string, contactName: string, company: string, description: string, source: string,
  ): CRMDeal => ({
    id: `demo:deal-${id}`,
    personaId: DEMO_PID,
    title,
    contact: { id: `demo:contact-${id}`, name: contactName, company },
    amount, probability, stage, expectedCloseDate: closeDate,
    source, description,
    activities: [],
    createdAt: nowIso, updatedAt: nowIso,
    closedAt: stage === 'won' || stage === 'lost' ? closeDate : undefined,
  });

  return [
    mk('1', '渋谷2号店 物件契約', 'proposal', 1200000, 60, '2026-07-31',
      '山田太郎', '渋谷リアルエステート株式会社',
      '渋谷神泉エリアの物件。25坪・月額家賃48万円。内装工事費込みの初期投資 1,200 万試算中。', '紹介'),
    mk('2', 'コーヒー豆 年間卸契約', 'negotiation', 480000, 80, '2026-06-15',
      '田島部長', '田島コーヒー商事',
      'エチオピア産シングルオリジン年間契約。1kg 4,200円 → 3,800円への値下げ交渉中。', '既存取引先'),
    mk('3', '法人定期 5社目候補 (出版社)', 'qualified', 600000, 40, '2026-08-31',
      '小林編集長', '株式会社デジタル出版',
      '社員 80 名向けオフィスコーヒー定期。月 5 万 × 12 ヶ月で年商 60 万。', 'Web 問合せ'),
    mk('4', 'カフェ向け POS リプレース', 'lead', 280000, 20, '2026-09-30',
      '橋本マネージャー', 'スマートレジ株式会社',
      '現行 POS から乗換提案。月額 5,000 円 × 36 ヶ月。', 'SNS DM'),
    mk('5', 'コーヒー教室 法人研修 (月例)', 'proposal', 360000, 50, '2026-07-15',
      '森田人事部長', '株式会社ライフスタイルワークス',
      '社員研修としてバリスタ体験講座。月 1 回 × 6 ヶ月で 36 万。', 'イベント名刺交換'),
    mk('6', '2号店向け焙煎機リース契約', 'won', 720000, 100, '2026-04-20',
      '小川営業', '東京ロースター機材',
      '2号店向け小型焙煎機を 36 ヶ月リース契約。月額 2 万 × 36。', '展示会'),
    mk('7', 'コーヒー卸 (老舗喫茶店)', 'lost', 240000, 0, '2026-03-10',
      '吉田店主', '老舗喫茶 木漏れ日',
      '価格面で他社に敗北。次回見直し時期は 2027 年春。', '既存取引先'),
    mk('8', '焼き菓子 OEM 受注', 'qualified', 180000, 35, '2026-08-15',
      '川村バイヤー', 'プレミアムギフト株式会社',
      '冬季限定ギフトボックス向け焼き菓子 OEM。初回ロット 300 個。', '紹介'),
  ];
}

// ── People (10) + Interactions (15) ─────────────────────
export function buildPeopleAndInteractions(today: Date, nowIso: string): { people: PersonRecord[]; interactions: PersonInteraction[] } {
  const day = (off: number) => dateOnly(addDays(today, -off));
  const people: PersonRecord[] = [
    // スタッフ 4
    { id: 'demo:p-misaki',  personaId: DEMO_PID, name: '佐藤美咲', role: 'バリスタ (リーダー)',    company: 'CAFE TANAKA', contactInfo: { email: 'misaki@cafe-tanaka.example.jp' }, lastInteraction: day(3),  createdAt: nowIso, notes: 'ラテアートが得意。2号店の店長候補。', tags: ['スタッフ', '店長候補'] },
    { id: 'demo:p-kenta',   personaId: DEMO_PID, name: '中村健太', role: 'バリスタ',                company: 'CAFE TANAKA', contactInfo: { email: 'kenta@cafe-tanaka.example.jp' },  lastInteraction: day(7),  createdAt: nowIso, notes: '焙煎担当。SCAJ コーヒーマイスター取得済み。', tags: ['スタッフ', '焙煎'] },
    { id: 'demo:p-yuki',    personaId: DEMO_PID, name: '小林由紀', role: 'バリスタ (パート)',       company: 'CAFE TANAKA', contactInfo: { email: 'yuki@cafe-tanaka.example.jp' },   lastInteraction: day(12), createdAt: nowIso, notes: '土日メインで勤務。学生 (調理師学校)。', tags: ['スタッフ', 'パート'] },
    { id: 'demo:p-ren',     personaId: DEMO_PID, name: '高橋蓮',   role: 'キッチン補助 (パート)',   company: 'CAFE TANAKA', contactInfo: { email: 'ren@cafe-tanaka.example.jp' },    lastInteraction: day(45), createdAt: nowIso, notes: '焼き菓子担当。来月退職予定 → 後任募集要。', tags: ['スタッフ', '退職予定'] },
    // 取引先 4
    { id: 'demo:p-tajima',  personaId: DEMO_PID, name: '田島部長', role: '営業部長',                company: '田島コーヒー商事',           contactInfo: { phone: '03-2345-6789' },  lastInteraction: day(6),  createdAt: nowIso, notes: 'コーヒー豆の卸取引先。年間契約を交渉中。', tags: ['取引先', '仕入'] },
    { id: 'demo:p-yamada',  personaId: DEMO_PID, name: '山田太郎', role: '不動産エージェント',      company: '渋谷リアルエステート株式会社', contactInfo: { phone: '090-1234-5678' }, lastInteraction: day(10), createdAt: nowIso, notes: '2号店物件担当。神泉物件を提案中。', tags: ['取引先', '物件'] },
    { id: 'demo:p-cpa',     personaId: DEMO_PID, name: '渡辺会計士', role: '税理士',               company: '渡辺税理士事務所',           contactInfo: { email: 'watanabe@example-cpa.jp' }, lastInteraction: day(20), createdAt: nowIso, notes: '月次顧問契約。決算 6 月。', tags: ['取引先', '税理士'] },
    { id: 'demo:p-adagent', personaId: DEMO_PID, name: '青木プランナー', role: '広告プランナー',    company: 'ローカル広告株式会社',       contactInfo: { email: 'aoki@local-ad.example.jp' }, lastInteraction: day(35), createdAt: nowIso, notes: 'Instagram 広告運用代行。月 2 万。', tags: ['取引先', '広告'] },
    // 重要顧客 2
    { id: 'demo:p-jokyaku', personaId: DEMO_PID, name: '木村様',   role: '常連客',                  company: '個人',                        contactInfo: { email: 'kimura@example.com' }, lastInteraction: day(2),  createdAt: nowIso, notes: '週 3-4 回来店。ハンドドリップ常連。誕生日は 11 月。', tags: ['顧客', '常連'] },
    { id: 'demo:p-suzuki',  personaId: DEMO_PID, name: '鈴木様',   role: '総務部',                  company: '株式会社シブヤテック',        contactInfo: { email: 'soumu@shibuyatech.example.jp' }, lastInteraction: day(8), createdAt: nowIso, notes: '法人定期の窓口担当。月末請求書受領窓口。', tags: ['顧客', '法人窓口'] },
  ];

  const interactions: PersonInteraction[] = [
    { id: 'demo:int-1',  personId: 'demo:p-misaki', date: day(3),  type: '1on1',    sentiment: 'positive', summary: '2号店店長候補として意欲確認。秋メニュー案も前向き。', highlights: ['店長挑戦の意思'], nextTopics: ['シフトリーダー研修'] },
    { id: 'demo:int-2',  personId: 'demo:p-misaki', date: day(35), type: '1on1',    sentiment: 'positive', summary: '前回の振り返り。ラテアート講習を任せる方向で合意。', highlights: ['講習スケジュール固定'] },
    { id: 'demo:int-3',  personId: 'demo:p-kenta',  date: day(7),  type: 'meeting', sentiment: 'neutral',  summary: '焙煎ロスタンド見直しの相談。深煎り在庫が余り気味。', concerns: ['在庫回転率低下'], nextTopics: ['発注量調整'] },
    { id: 'demo:int-4',  personId: 'demo:p-yuki',   date: day(12), type: '1on1',    sentiment: 'mixed',    summary: 'シフト希望と学業のバランス相談。土曜日のみ確定へ。', concerns: ['テスト期間中の稼働'] },
    { id: 'demo:int-5',  personId: 'demo:p-ren',    date: day(45), type: 'note',    sentiment: 'negative', summary: '退職の申し出 (来月末)。後任採用を急ぐ必要あり。', concerns: ['採用ギャップ', 'キッチン体制'], nextTopics: ['求人票作成'] },
    { id: 'demo:int-6',  personId: 'demo:p-tajima', date: day(6),  type: 'meeting', sentiment: 'neutral',  summary: '年間卸契約の価格交渉。1kg 4,200円→3,800円 検討中。', concerns: ['他社相見積もりの可能性'], nextTopics: ['6月中旬までに最終回答'] },
    { id: 'demo:int-7',  personId: 'demo:p-tajima', date: day(40), type: 'email',   sentiment: 'positive', summary: 'エチオピア新ロット入荷の連絡。サンプル送付依頼済み。' },
    { id: 'demo:int-8',  personId: 'demo:p-yamada', date: day(10), type: 'meeting', sentiment: 'positive', summary: '神泉物件の内見。25坪、月家賃48万。立地良好。', highlights: ['駅徒歩 3 分', '視認性高い'], nextTopics: ['オーナー条件確認'] },
    { id: 'demo:int-9',  personId: 'demo:p-yamada', date: day(28), type: 'call',    sentiment: 'neutral',  summary: '神泉物件オーナーへ条件提示中。返答待ち。' },
    { id: 'demo:int-10', personId: 'demo:p-cpa',    date: day(20), type: 'meeting', sentiment: 'positive', summary: '4月月次レビュー。利益率は前年比 +2pt。' },
    { id: 'demo:int-11', personId: 'demo:p-cpa',    date: day(55), type: 'email',   sentiment: 'neutral',  summary: '6月決算に向けて棚卸予定の確認。' },
    { id: 'demo:int-12', personId: 'demo:p-adagent', date: day(35), type: 'meeting', sentiment: 'mixed',   summary: '秋メニュー広告 ROAS 3.2x。ただし CPM 上昇傾向。', concerns: ['広告費単価上昇'], nextTopics: ['オーガニック比率を上げる施策'] },
    { id: 'demo:int-13', personId: 'demo:p-jokyaku', date: day(2),  type: 'note',    sentiment: 'positive', summary: '常連の木村様、新作スパイスラテを高評価。SNS シェアあり。' },
    { id: 'demo:int-14', personId: 'demo:p-suzuki',  date: day(8),  type: 'email',   sentiment: 'neutral',  summary: '5月分請求書送付完了。先方の入金予定は月末。' },
    { id: 'demo:int-15', personId: 'demo:p-suzuki',  date: day(50), type: 'meeting', sentiment: 'positive', summary: '法人定期、来月から週 1 → 月 1 の配送頻度に変更。', highlights: ['物流コスト軽減'] },
  ];

  return { people, interactions };
}

// ── Knowledge (8 件、analysis 入り) ───────────────────────
export function buildKnowledge(nowIso: string) {
  const mk = (
    id: string, title: string, content: string, tags: string[],
    summary: string, insights: string[], strategy: string[], actions: string[], risks: string[],
  ) => ({
    id: `demo:k-${id}`,
    personaId: DEMO_PID,
    title,
    content,
    chunks: [{ id: `demo:k-${id}-c1`, content: content.slice(0, 300) }],
    sourceType: 'note' as const,
    createdAt: nowIso,
    tags,
    analysisStatus: 'done' as const,
    analysis: {
      summary,
      insights,
      strategy,
      actions,
      risks,
      generatedAt: nowIso,
    },
  });

  return [
    mk('overview', '店舗情報・事業概要',
      '【CAFE TANAKA 概要】\n渋谷区道玄坂にある15席のスペシャルティコーヒー専門店。2019年創業。\n月商:約85万円 (季節変動 70-110万)\n主力商品:シングルオリジンコーヒー各種、季節のラテアートシリーズ\nスタッフ:オーナー含め4名 (バリスタ3、キッチン補助1)\n2026年中に渋谷2号店の出店を計画中。',
      ['経営', 'カフェ', '店舗'],
      '渋谷道玄坂のスペシャルティコーヒー店。月商 85 万、4 名体制、2026 年 2 号店計画中。',
      ['月商の季節変動が大きい (70-110万)', '客単価 820-950円', '2 号店投資 1,200 万を予定'],
      ['客単価向上の余地あり', '法人定期契約で売上の底上げ可能'],
      ['2 号店物件の最終確認', '法人定期 5 社目開拓'],
      ['人材確保: キッチン補助の退職予定', '投資負荷: 2 号店初期費用']),
    mk('recruit', 'スタッフ採用要件メモ',
      '【バリスタ採用要件 2026年秋】\n勤務形態:週4日以上 (シフト制)\nスキル:ラテアート経験者優遇、SCAJコーヒーマイスター資格者歓迎\n給与:時給1,400円〜1,600円\n採用人数:2名 (2号店向け)\n面接日程:随時 (書類選考後1週間以内)',
      ['採用', 'スタッフ', '人事'],
      '2 号店向けバリスタ 2 名採用要件。時給 1,400-1,600 円、ラテアート経験者優遇。',
      ['SCAJ 資格者は採用市場で希少', '時給は地域相場の上位 20%'],
      ['Instagram + Wantedly で並行募集', '既存スタッフのリファラル制度導入'],
      ['8 月末までに 2 名内定確保', '研修プログラム策定 (1 ヶ月)'],
      ['採用ギャップ発生時のオペレ崩壊', '人件費上昇の損益圧迫']),
    mk('autumn-menu', '秋冬メニュー戦略メモ',
      '【2026年秋冬メニュー戦略】\n目標:客単価820円→950円\n新商品候補:\n・スパイスラテ (ターメリック/チャイ) 650円\n・焼き芋ホワイトモカ 700円\n・限定コーヒーフライト (3種飲み比べ) 1,200円\nKPI:秋季 (9-11月) 売上前年比 115%',
      ['メニュー', '戦略', '売上'],
      '秋冬メニューで客単価 130 円アップ目標。新商品 3 種で前年比 115%。',
      ['限定フライトは高単価で利益貢献大', 'スパイス系は SNS 拡散性高い'],
      ['9 月第 1 週に SNS 先行発表', '常連客に試飲会で先行体験'],
      ['原価率算定 (28% 以内)', 'パッケージデザイン発注'],
      ['原材料費高騰 (シナモン・ターメリック)', 'スパイス苦手客の取りこぼし']),
    mk('financial-2024', '2024 年度 決算サマリ',
      '【2024 年度 決算サマリ】\n売上高:1,012 万円\n売上原価:248 万円 (24.5%)\n人件費:331 万円 (32.7%)\n家賃:264 万円 (26.1%)\n営業利益:42 万円 (4.1%)\n前年比:売上 +8%、利益 +12%\n所感:夏の閑散期が利益を圧迫。法人定期で底上げ必要。',
      ['財務', '決算', '振り返り'],
      '2024 年度は売上 +8% / 利益 +12% 成長。夏の閑散期が課題。',
      ['人件費比率 32.7% は業界平均水準', '夏季 6-8 月の月平均は 70 万'],
      ['法人定期で夏季の底上げ', '冷たい飲料の構成比拡大'],
      ['法人定期 +2 社目標', 'コールドメニュー強化'],
      ['夏季の利益赤字', '原材料費上昇 (コーヒー豆 +12%)']),
    mk('autumn-report', '秋メニュー反響レポート',
      '【2025 秋メニュー 反響レポート】\n販売期間:2025/9-11\nスパイスラテ販売数:1,820 杯 (目標 1,500 杯比 121%)\n焼き芋ホワイトモカ:1,240 杯\nコーヒーフライト:380 杯 (高単価で利益貢献大)\nSNS:Instagram フォロワー +320、リール最高再生 8.2 万\n客単価:期間中 945 円 (前年同期 +123 円)',
      ['メニュー', 'マーケ', '実績'],
      '秋メニューは目標達成。SNS 効果でフォロワー +320。客単価 945 円達成。',
      ['コーヒーフライトの単価貢献が想定以上', 'リール広告 ROAS は 3.2x'],
      ['2026 秋は冬メニュー早期投入で売上の山を伸ばす', '限定フライトのレギュラー化検討'],
      ['12 月限定ホリデーフライト企画', 'レビュー 5 件以上獲得'],
      ['原材料供給リスク (焼き芋)', '冬季の SNS 露出減少']),
    mk('store2-compare', '2 号店 物件比較表',
      '【2 号店 候補物件 3 件 比較】\n■ 神泉駅前 (25坪・家賃 48 万) ★最有力\n  + 駅徒歩 3 分、視認性高い\n  - 初期工事 380 万\n■ 松濤エリア (20坪・家賃 42 万)\n  + 高級住宅街、客層良好\n  - 駅徒歩 8 分、視認性低い\n■ 神南エリア (28坪・家賃 56 万)\n  + 渋谷駅近、座席数最大\n  - 家賃負担大、初期工事 450 万',
      ['2号店', '物件', '不動産'],
      '3 件比較で神泉駅前物件が最有力。家賃 48 万、初期 380 万。',
      ['神泉は ROI が最良 (試算 18 ヶ月回収)', '松濤は売上上限が低い'],
      ['神泉に絞って契約交渉', 'オーナーへの条件交渉 (フリーレント 2 ヶ月)'],
      ['契約書ドラフト確認 (税理士同席)', '内装業者 2 社相見積もり'],
      ['契約直前のオーナー条件変更', '同エリア競合店出店']),
    mk('cogs-analysis', 'コーヒー豆 原価率分析',
      '【コーヒー豆原価率 (2024-2025 推移)】\n2024 平均:24.5%\n2025 平均:26.1% (+1.6pt 悪化)\n要因:\n・エチオピア産仕入価格 +12%\n・コロンビア産 +8%\n・歩留まり (焙煎ロス) +0.5pt\n対策案:\n・年間契約で価格固定 (1kg 3,800 円目標)\n・自家焙煎比率を 60% → 80% に拡大',
      ['原価', '財務', '仕入'],
      '原価率 1.6pt 悪化。豆価格上昇が主因。年間契約と自家焙煎比率拡大で吸収。',
      ['原材料費上昇は構造的傾向', '自家焙煎は原価 -3pt 効果'],
      ['田島コーヒー商事と年間契約締結', '焙煎機の稼働率向上'],
      ['年間契約 6 月中決着', '自家焙煎比率モニタリング月次'],
      ['年間契約の不調', '焙煎機故障時のリスク']),
    mk('june-ops', '6 月オペレーション改善案',
      '【6 月運用改善 3 案】\n① ピークタイム (12-14時) のオペ最適化\n  → ドリンク提供時間を平均 6 分 → 4 分へ\n② テイクアウト窓口の動線見直し\n  → 店内客との交差をゼロに\n③ 仕込み時間の短縮\n  → 焼き菓子は前日仕込みに切替',
      ['オペレ', '改善', '効率'],
      '6 月のオペ改善 3 点。提供時間短縮 + 動線最適化 + 仕込み前倒し。',
      ['ピーク時間の機会損失が月 8 万円相当', 'テイクアウト比率 32%'],
      ['オーダーシステムの音声化', '焼き菓子の前日仕込み定常化'],
      ['6 月第 2 週から試験運用', '効果測定 (1 ヶ月後)'],
      ['前日仕込みによる品質低下', 'スタッフ教育コスト']),
  ];
}

// ── Tasks (15 件、一部完了) ──────────────────────────────
export function buildTasks(today: Date, _nowIso: string) {
  const day = (off: number) => dateOnly(addDays(today, off));
  const past = (off: number) => addDays(today, -off).toISOString();
  return [
    { id: 'demo:task-1',  title: '神泉物件の最終契約条件をオーナーに確認',        priority: 'high' as const, due: '今週',   done: false, personaId: DEMO_PID, estimatedMin: 30, createdAt: past(2) },
    { id: 'demo:task-2',  title: 'キッチン補助の求人票を作成・公開',              priority: 'high' as const, due: '今週',   done: false, personaId: DEMO_PID, estimatedMin: 60, createdAt: past(1) },
    { id: 'demo:task-3',  title: '田島コーヒー 年間卸契約 最終回答 (6/15まで)',    priority: 'high' as const, due: '今月',   done: false, personaId: DEMO_PID, estimatedMin: 45, createdAt: past(3) },
    { id: 'demo:task-4',  title: '5月分請求書 (シブヤテック) の入金確認',          priority: 'mid' as const,  due: '来週',   done: false, personaId: DEMO_PID, estimatedMin: 15, createdAt: past(2) },
    { id: 'demo:task-5',  title: '秋メニュー試作 (スパイスラテ ver2)',             priority: 'mid' as const,  due: '今月',   done: false, personaId: DEMO_PID, estimatedMin: 90, createdAt: past(5) },
    { id: 'demo:task-6',  title: 'Instagram リール撮影 (新作スイーツ)',            priority: 'low' as const,  due: '来月',   done: false, personaId: DEMO_PID, estimatedMin: 120, createdAt: past(4) },
    { id: 'demo:task-7',  title: '2号店向け焙煎機リース契約書 押印',                priority: 'mid' as const,  due: '今週',   done: true,  personaId: DEMO_PID, estimatedMin: 20, createdAt: past(10), completedAt: past(7) },
    { id: 'demo:task-8',  title: '4月月次レポートを税理士へ送付',                  priority: 'mid' as const,  due: '完了',   done: true,  personaId: DEMO_PID, estimatedMin: 30, createdAt: past(20), completedAt: past(18) },
    { id: 'demo:task-9',  title: '常連の木村様にスパイスラテ試飲依頼 (済)',         priority: 'low' as const,  due: '完了',   done: true,  personaId: DEMO_PID, estimatedMin: 10, createdAt: past(8), completedAt: past(2) },
    { id: 'demo:task-10', title: 'バリスタ採用 (2 名) 8 月末までに内定',           priority: 'high' as const, due: day(60), done: false, personaId: DEMO_PID, estimatedMin: 180, createdAt: past(7) },
    { id: 'demo:task-11', title: '出版社 (デジタル出版) へ法人定期提案書送付',      priority: 'mid' as const,  due: '来週',   done: false, personaId: DEMO_PID, estimatedMin: 60, createdAt: past(2), delegatedAgentTaskId: 'demo:agent-proposal' },
    { id: 'demo:task-12', title: '焼き菓子 OEM 初回サンプル発送',                   priority: 'mid' as const,  due: '来月',   done: false, personaId: DEMO_PID, estimatedMin: 60, createdAt: past(3) },
    { id: 'demo:task-13', title: 'POS リプレース提案を比較検討',                    priority: 'low' as const,  due: '今月',   done: false, personaId: DEMO_PID, estimatedMin: 90, createdAt: past(5) },
    { id: 'demo:task-14', title: '常連カード (10 杯で 1 杯無料) を再開',             priority: 'low' as const,  due: day(14), done: false, personaId: DEMO_PID, estimatedMin: 45, createdAt: past(1) },
    { id: 'demo:task-15', title: '渋谷ミルク商会 6 月分発注締切',                    priority: 'mid' as const,  due: day(7),  done: false, personaId: DEMO_PID, estimatedMin: 15, createdAt: past(0) },
  ];
}

// ── Documents (見積 / 納品 等) ────────────────────────────
export function buildDocuments(today: Date, nowIso: string): BusinessDocument[] {
  const todayStr = dateOnly(today);
  const thirtyLater = dateOnly(addDays(today, 30));
  // 2号店向け内装見積
  return [{
    id: 'demo:doc-1',
    personaId: DEMO_PID,
    kind: 'estimate',
    status: 'sent',
    number: 'EST-CAFETANAKA-2026-001',
    issuerSnapshot: ISSUER,
    clientSnapshot: {
      id: 'demo:client-interior',
      name: '渋谷インテリアデザイン株式会社',
      contactName: '佐藤デザイナー',
      address: '東京都渋谷区渋谷2-2-2',
    },
    subject: '2号店 内装リノベーション 見積書',
    issueDate: todayStr,
    validUntil: thirtyLater,
    lines: [
      { id: 'demo:doc-1-l1', description: '内装設計・監理費', quantity: 1, unitPrice: 450000, taxRate: 10 },
      { id: 'demo:doc-1-l2', description: 'カウンター製作・設置', quantity: 1, unitPrice: 280000, taxRate: 10 },
      { id: 'demo:doc-1-l3', description: '照明器具・設置工事', quantity: 1, unitPrice: 180000, taxRate: 10 },
    ],
    notes: 'お支払い条件:工事完了後30日以内',
    createdAt: nowIso,
    updatedAt: nowIso,
  }];
}

// ── AgentTask 提案 (2 件) ────────────────────────────────
export function buildAgentTasks(nowIso: string) {
  return [
    {
      id: 'demo:agent-proposal',
      title: '今月の決算サマリを作る',
      summary: '5 月分の P/L サマリと前月比分析、税理士向け資料を CFO 主導で作成。',
      why: '月次クロージングの自動化で 4 時間/月の工数削減。',
      expected: '前月比 +/- 要因分析つき P/L 1 枚 + 経費明細 CSV',
      dueDays: 5,
      status: 'proposed' as const,
      proposedAt: nowIso,
      steps: [
        { cxo: 'CFO' as const, label: '経費・売上データ集計', status: 'pending' as const },
        { cxo: 'CDS' as const, label: '前月比差分分析',         status: 'pending' as const },
        { cxo: 'CFO' as const, label: 'P/L 1 枚作成',          status: 'pending' as const },
      ],
    },
    {
      id: 'demo:agent-store2',
      title: '2 号店オープン準備計画を立てる',
      summary: '物件契約 → 内装 → 採用 → グランドオープンまでの 90 日計画を COO + CFO + CDO で策定。',
      why: '2 号店投資 1,200 万の意思決定材料を揃え、リスクを最小化。',
      expected: '90 日 WBS + 資金計画 + リスクリスト',
      dueDays: 14,
      status: 'proposed' as const,
      proposedAt: nowIso,
      steps: [
        { cxo: 'COO' as const, label: 'オープン WBS 90日分作成', status: 'pending' as const },
        { cxo: 'CFO' as const, label: '初期投資 + 運転資金試算',  status: 'pending' as const },
        { cxo: 'CDO' as const, label: '内装・ブランディング方針', status: 'pending' as const },
      ],
    },
  ];
}
