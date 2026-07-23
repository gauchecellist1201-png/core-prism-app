// ============================================================
// IRIS — 確定申告サポート (事業所得 / 雑所得 見積り)
// OCR 経費データを集計し、Claude で申告準備チェックリストを生成
// ============================================================
import type { AppSettings } from '../types/identity';
import { enqueueClaudeCall } from '../lib/apiQueue';
import { toneInstruction } from '../lib/aiTone';
import { aiFetch } from '../lib/aiFetch';

// API キーは main.tsx の fetch interceptor が localStorage から自動付与

/** OCR で取り込んだ経費レコード */
export interface ExpenseRecord {
  id: string;
  date: string;         // YYYY-MM-DD
  category: string;     // 例: 衣装費, 撮影機材, 交通費, 通信費
  description: string;
  amountJPY: number;    // 税込
  receiptImageBase64?: string;
}

/** taxHelper の出力 */
export interface TaxEstimate {
  estimatedIncomeJPY: number;       // 年間総収入 (税抜)
  estimatedExpenseJPY: number;      // 年間経費合計
  taxableIncome: number;            // 所得 = 収入 - 経費 - 基礎控除
  simulatedTaxJPY: number;          // 概算所得税 (速算表)
  checklist: string[];              // 確定申告準備チェックリスト
  byCategory: { category: string; total: number }[];
  byMonth: { month: string; income: number; expense: number }[];
}

/** 所得税速算表 (2024 令和6年度) */
function calcIncomeTax(taxable: number): number {
  if (taxable <= 0) return 0;
  const brackets: [number, number, number][] = [
    [1_950_000,   0.05, 0],
    [3_300_000,   0.10,  97_500],
    [6_950_000,   0.20, 427_500],
    [9_000_000,   0.23, 636_000],
    [18_000_000,  0.33, 1_536_000],
    [40_000_000,  0.40, 2_796_000],
    [Infinity,    0.45, 4_796_000],
  ];
  for (const [limit, rate, deduction] of brackets) {
    if (taxable <= limit) return Math.floor(taxable * rate - deduction);
  }
  return 0;
}

/**
 * 収入リストと経費リストから年間税額を概算する (クライアント側ロジック)
 */
export function estimateTax(
  incomes: { month: string; amountJPY: number }[],
  expenses: ExpenseRecord[],
): Omit<TaxEstimate, 'checklist'> {
  const totalIncome = incomes.reduce((s, r) => s + r.amountJPY, 0);
  const totalExpense = expenses.reduce((s, r) => s + r.amountJPY, 0);

  // 基礎控除 48 万円 (2020年以降)
  const basicDeduction = 480_000;
  const taxableIncome = Math.max(0, totalIncome - totalExpense - basicDeduction);
  const simulatedTaxJPY = calcIncomeTax(taxableIncome);

  // カテゴリ別集計
  const catMap = new Map<string, number>();
  for (const e of expenses) {
    catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.amountJPY);
  }
  const byCategory = [...catMap.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  // 月別集計
  const monthMap = new Map<string, { income: number; expense: number }>();
  for (const inc of incomes) {
    const m = inc.month.slice(0, 7); // YYYY-MM
    const cur = monthMap.get(m) ?? { income: 0, expense: 0 };
    monthMap.set(m, { ...cur, income: cur.income + inc.amountJPY });
  }
  for (const exp of expenses) {
    const m = exp.date.slice(0, 7);
    const cur = monthMap.get(m) ?? { income: 0, expense: 0 };
    monthMap.set(m, { ...cur, expense: cur.expense + exp.amountJPY });
  }
  const byMonth = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));

  return {
    estimatedIncomeJPY: totalIncome,
    estimatedExpenseJPY: totalExpense,
    taxableIncome,
    simulatedTaxJPY,
    byCategory,
    byMonth,
  };
}

/**
 * Claude を使って確定申告準備チェックリストを生成する
 */
export async function generateTaxChecklist(opts: {
  settings: AppSettings;
  income: number;
  expense: number;
  taxable: number;
  tax: number;
  categories: { category: string; total: number }[];
  targetYear: number;
}): Promise<string[]> {

  const sys = `あなたは日本在住のインフルエンサー/フリーランスクリエイターの確定申告を手伝う税務アドバイザー AI。
専門用語は日本語で補足。結論から書く。${toneInstruction()}

返答は JSON のみ (説明文・コードブロック禁止):
{ "checklist": ["チェック項目1", "チェック項目2", ...] }

チェックリストの条件:
- 15〜25 項目
- 各項目は「動詞で始まる 40 文字以内の文」
- 年間所得・経費カテゴリを踏まえた個別最適化 (例: 衣装費が多ければ「衣装の用途証明を準備する」)
- 青色申告特別控除 65 万円の活用チェックも含める
- e-Tax、マイナンバーカード関連も含める
- 源泉徴収票・支払調書の収集も含める`;

  const userMsg = `${opts.targetYear}年分の確定申告チェックリストを作ってください。

収入合計: ¥${opts.income.toLocaleString()}
経費合計: ¥${opts.expense.toLocaleString()}
課税所得 (概算): ¥${opts.taxable.toLocaleString()}
概算所得税: ¥${opts.tax.toLocaleString()}

主な経費カテゴリ:
${opts.categories.map(c => `- ${c.category}: ¥${c.total.toLocaleString()}`).join('\n')}`;

  const data = await enqueueClaudeCall(async () => {
    const res = await aiFetch({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 2000,
        system: sys,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `税務APIエラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    return Array.isArray(parsed.checklist) ? parsed.checklist : [];
  } catch {
    return ['AI 応答の解析に失敗しました。もう一度お試しください。'];
  }
}

/** LocalStorage キー */
const INCOME_KEY  = 'iris_tax_incomes_v1';
const EXPENSE_KEY = 'iris_tax_expenses_v1';

export function loadIncomes(): { month: string; amountJPY: number; source: string }[] {
  try { const r = localStorage.getItem(INCOME_KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}
export function saveIncomes(data: { month: string; amountJPY: number; source: string }[]) {
  try { localStorage.setItem(INCOME_KEY, JSON.stringify(data)); } catch { /* */ }
}

export function loadExpenses(): ExpenseRecord[] {
  try { const r = localStorage.getItem(EXPENSE_KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}
export function saveExpenses(data: ExpenseRecord[]) {
  try { localStorage.setItem(EXPENSE_KEY, JSON.stringify(data)); } catch { /* */ }
}
