// ============================================================
// オンボーディング & デモ Seed
//
// オーナー指示 (2026-05-25):
//   「デモモードでデータが全部 0 だと、財務コンサルが助言できない。
//    実在しそうなカフェの 12 ヶ月ストーリーで全機能を確認できるように」
//
// 実体は ./demoDataCafe.ts に分離。ここは localStorage への書込み窓口のみ。
// ============================================================
import {
  DEMO_PID,
  seedStripeCache,
  buildSalesLedger,
  buildInvoices,
  buildExpenses,
  buildDeals,
  buildPeopleAndInteractions,
  buildKnowledge,
  buildTasks,
  buildDocuments,
  buildAgentTasks,
} from './demoDataCafe';

const ONBOARDED_KEY = 'core_onboarded_v2';
const DEMO_KEY = 'core_demo_active_v1';

const PERSONA_STORE = 'core_personas';
const KNOWLEDGE_STORE = 'core_knowledge';
const CRM_STORE = 'core_crm_deals_v1';
const DOC_STORE = 'core_documents_v1';
const EXPENSE_STORE = 'core_expenses_v1';
const PEOPLE_STORE = 'core_people_v1';
const INTERACTION_STORE = 'core_people_interactions_v1';
const INVOICE_STORE = 'core_invoices_v1';
const INVOICE_ISSUER_STORE = 'core_invoice_issuers_v1';
const INVOICE_CLIENT_STORE = 'core_invoice_clients_v1';
const SALES_LEDGER_STORE = 'core_sales_ledger_v1';
const AGENT_QUEUE_STORE = 'core_agent_task_queue_v1';
const STRIPE_CACHE_STORE = 'core_stripe_revenue_cache_v1';
const STRIPE_KEY_STORE = 'core_integration_stripe';

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
  const stores = [
    KNOWLEDGE_STORE, CRM_STORE, DOC_STORE, EXPENSE_STORE,
    PEOPLE_STORE, INTERACTION_STORE, INVOICE_STORE,
    INVOICE_ISSUER_STORE, INVOICE_CLIENT_STORE, SALES_LEDGER_STORE,
    AGENT_QUEUE_STORE,
  ];
  for (const key of stores) {
    const items = loadArr<{ id: string }>(key);
    saveArr(key, items.filter(i => !i.id.startsWith('demo:')));
  }
  const personas = loadArr<{ id: string }>(PERSONA_STORE);
  saveArr(PERSONA_STORE, personas.filter(p => !p.id.startsWith('demo:')));
  // Stripe demo キャッシュも掃除
  try {
    const stripeKey = localStorage.getItem(STRIPE_KEY_STORE) || '';
    if (stripeKey.startsWith('rk_test_demo_')) {
      localStorage.removeItem(STRIPE_KEY_STORE);
      localStorage.removeItem(STRIPE_CACHE_STORE);
    }
  } catch { /* */ }
  setDemoActive(false);
}

/** Writes demo data for カフェ経営者・田中健一 directly to localStorage.
 *  12 ヶ月の経営ストーリーで全機能を確認できる規模に拡張済み。
 *  Returns total item count seeded. */
export function seedDemoData(): number {
  const now = new Date();
  const nowIso = now.toISOString();
  const today = now; // ローカル基準

  // ── Stripe 売上キャッシュ (これが核 — 12 ヶ月分の月次データ) ───
  const thisMonthPoint = seedStripeCache(today);

  // ── ビルダー呼び出し ────────────────────────────────────
  const tasks = buildTasks(today, nowIso);
  const knowledge = buildKnowledge(nowIso);
  const deals = buildDeals(nowIso);
  const documents = buildDocuments(today, nowIso);
  const expenses = buildExpenses(today, nowIso);
  const { people, interactions } = buildPeopleAndInteractions(today, nowIso);
  const invoices = buildInvoices(today, nowIso);
  const salesLedger = buildSalesLedger(today, nowIso);
  const agentTasks = buildAgentTasks(nowIso);

  // ── Persona (cashflow は Stripe 今月の値に同期) ───────
  const persona = {
    id: DEMO_PID,
    name: 'カフェ経営者・田中健一',
    subtitle: 'CAFE TANAKA オーナー',
    icon: '☕',
    accentColor: '#c9a96e',
    accentColorLight: 'rgba(201,169,110,0.15)',
    description: '渋谷でカフェを経営するオーナー。2店舗目出店を計画中。コーヒーとラテアートが得意。売上拡大とコスト管理が課題。',
    createdAt: nowIso,
    meetingSlug: 'tanaka-cafe-demo',
    tasks,
    cashflow: {
      income: thisMonthPoint.revenueJpy,
      expense: -thisMonthPoint.expenseJpy,
      label: '田中健一・月次収支',
    },
    timeAllocation: 25,
  };

  // ── Invoice 発行者プロファイル ──────────────────────────
  const issuerProfile = invoices[0]?.issuerSnapshot;
  const clientList = Array.from(
    new Map(invoices.map(i => [i.clientSnapshot.id, i.clientSnapshot])).values()
  );

  // ── Write to localStorage (idempotent, demo: のみ置換) ──
  const upsert = (key: string, newItems: Array<{ id: string }>) => {
    const existing = loadArr<{ id: string }>(key);
    const cleaned = existing.filter(i => !i.id.startsWith('demo:'));
    saveArr(key, [...newItems, ...cleaned]);
  };

  // Persona は単独配列
  const existingPersonas = loadArr<{ id: string }>(PERSONA_STORE);
  const cleanedPersonas = existingPersonas.filter(p => !p.id.startsWith('demo:'));
  saveArr(PERSONA_STORE, [persona, ...cleanedPersonas]);

  upsert(KNOWLEDGE_STORE, knowledge);
  upsert(CRM_STORE, deals);
  upsert(DOC_STORE, documents);
  upsert(EXPENSE_STORE, expenses);
  upsert(PEOPLE_STORE, people);
  upsert(INTERACTION_STORE, interactions);
  upsert(INVOICE_STORE, invoices);
  upsert(SALES_LEDGER_STORE, salesLedger);
  upsert(AGENT_QUEUE_STORE, agentTasks);

  // 発行者プロファイル: personaId で照合 (id 不在型なので demo: マーキング不能)
  if (issuerProfile) {
    const issuers = loadArr<{ personaId: string }>(INVOICE_ISSUER_STORE);
    const cleaned = issuers.filter(i => i.personaId !== DEMO_PID);
    saveArr(INVOICE_ISSUER_STORE, [issuerProfile, ...cleaned]);
  }

  // クライアントマスター
  if (clientList.length > 0) {
    const clients = loadArr<{ id: string }>(INVOICE_CLIENT_STORE);
    const cleaned = clients.filter(c => !c.id.startsWith('demo:'));
    saveArr(INVOICE_CLIENT_STORE, [...clientList, ...cleaned]);
  }

  // リロード後に demo 人格のダッシュボードへ直行
  try { localStorage.setItem('core_active_persona_id_v1', DEMO_PID); } catch { /* */ }

  // 件数集計
  const total =
    1 /* persona */ +
    tasks.length +
    knowledge.length +
    deals.length +
    documents.length +
    expenses.length +
    people.length +
    interactions.length +
    invoices.length +
    salesLedger.length +
    agentTasks.length;
  return total;
}
