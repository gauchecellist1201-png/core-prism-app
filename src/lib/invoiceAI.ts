// ============================================================
// 自然言語から請求書の明細を AI で組み立てる
//
// 2026-05-18 改修 (オーナー指摘):
//   「森川に100万円の請求書作って」で明細も宛先も入らない問題を修正。
//   - 宛先 (clientName) も AI に抽出させる
//   - AI が失敗しても、入力文から金額・宛先を取り出して必ず明細を作る
//     (フォールバック) → 「明細が空」で行き止まりにならない
// ============================================================
import type { AppSettings } from '../types/identity';
import type { InvoiceLine, TaxRate } from '../types/invoice';
import { enqueueClaudeCall } from './apiQueue';
import { isMasterAuth } from './billing';
import { v4 as uuidv4 } from 'uuid';

export interface AISuggestedInvoice {
  subject: string;
  lines: InvoiceLine[];
  /** 依頼文から抽出した宛先 (会社名/個人名) */
  clientName?: string;
  notes?: string;
  paymentTerms?: string;
  dueKind?: 'eom-next' | 'plus30' | 'plus14' | 'plus60';
}

const SYS = `あなたは経理プロです。日本の事業者が発行する請求書 (インボイス制度準拠) の明細を組み立てます。

返答は **JSONのみ** (コードブロック・説明文なし)。スキーマ:
{
  "clientName": "宛先の会社名/個人名 (依頼文から抽出。例: '森川に〜' なら '森川')",
  "subject": "件名 (例: 2026年5月分 ご請求 / Web制作費用 ご請求)",
  "lines": [
    {
      "description": "品目/サービス内容 (具体的に)",
      "quantity": 数量 (number),
      "unit": "単位 (式 / 時間 / 個 / 月 / 名 など)",
      "unitPrice": 単価 税抜 (number、円単位の整数),
      "taxRate": 10 | 8 | 0,
      "reducedTax": false | true
    }
  ],
  "notes": "備考 (任意)",
  "paymentTerms": "支払条件 (例: '月末締・翌月末日払い')",
  "dueKind": "eom-next" | "plus30" | "plus14" | "plus60"
}

ルール:
- 依頼文に金額があれば必ず lines を 1 行以上作る。金額が「税込」か不明なら税抜換算 (÷1.1) して unitPrice に
- 「100万円」=1000000、「50万」=500000 のように万単位を展開
- 品目が不明なら description は「ご請求一式」、quantity 1、unit「式」
- 軽減税率 8% は飲食料品・新聞のみ。それ以外は 10%
- 件名は短く明確に`;

/** 全角数字・カンマを含む文字列を数値に */
function toNum(s: string): number {
  const half = s
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[,，]/g, '');
  return Number(half) || 0;
}

/**
 * AI が失敗しても、入力文から金額と宛先を取り出して明細を必ず作る。
 * 「森川に１００万円の請求書作って」→ 宛先=森川 / 明細=ご請求一式 ¥1,000,000
 */
function fallbackFromPrompt(prompt: string): { lines: InvoiceLine[]; clientName?: string } {
  // 金額: 「100万」「１００万円」「50万円」を優先、無ければ「1000000円」
  let amount = 0;
  const man = prompt.match(/([0-9０-９,，]+)\s*万/);
  if (man) amount = toNum(man[1]) * 10000;
  if (!amount) {
    const yen = prompt.match(/([0-9０-９,，]+)\s*円/);
    if (yen) amount = toNum(yen[1]);
  }
  // 宛先: 文頭の「○○に」「○○へ」「○○宛」「○○様」
  let clientName: string | undefined;
  const to = prompt.match(/^\s*(.+?)\s*(さん|様)?\s*(に|へ|あて|宛て|宛)/);
  if (to && to[1] && to[1].length <= 30) clientName = to[1].trim();

  const lines: InvoiceLine[] = amount > 0
    ? [{
        id: uuidv4(),
        description: 'ご請求一式',
        quantity: 1,
        unit: '式',
        unitPrice: Math.round(amount / 1.1), // 入力額を税込とみなし税抜換算
        taxRate: 10 as TaxRate,
        reducedTax: false,
      }]
    : [];
  return { lines, clientName };
}

export async function aiSuggestInvoice(opts: {
  settings: AppSettings;
  prompt: string;
  clientName?: string;
  issueDate?: string;
}): Promise<AISuggestedInvoice> {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY || opts.settings.claudeApiKey || '';

  const userPrompt = `## 依頼内容
${opts.prompt}

${opts.clientName ? `## 既に選択中の顧客\n${opts.clientName}\n` : ''}
${opts.issueDate ? `## 発行日\n${opts.issueDate}\n` : ''}

上記から請求書の明細を JSON で構成してください。`;

  let parsed: any = {};
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    // マスターなら Claude、一般ユーザーは Gemini に自動ルーティング
    if (isMasterAuth()) headers['x-master-key'] = 'GAUCHE2026';

    const data = await enqueueClaudeCall(async () => {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 1600,
          system: SYS,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message ?? `請求書AI エラー: ${res.status}`);
      }
      return res.json();
    });
    const text = data.content?.[0]?.text ?? data.text ?? '';
    const m = text.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch {
    parsed = {};
  }

  let lines: InvoiceLine[] = (Array.isArray(parsed.lines) ? parsed.lines : []).map((l: any) => ({
    id: uuidv4(),
    description: String(l.description || 'ご請求一式').slice(0, 200),
    quantity: Math.max(1, Number(l.quantity) || 1),
    unit: l.unit ? String(l.unit) : '式',
    unitPrice: Math.max(0, Math.round(Number(l.unitPrice) || 0)),
    taxRate: ([10, 8, 0].includes(Number(l.taxRate)) ? Number(l.taxRate) : 10) as TaxRate,
    reducedTax: !!l.reducedTax,
  })).filter((l: InvoiceLine) => l.unitPrice > 0);

  let clientName: string | undefined = parsed.clientName ? String(parsed.clientName).slice(0, 40) : undefined;

  // フォールバック: AI が明細を出せなかったら、入力文から直接作る
  if (lines.length === 0) {
    const fb = fallbackFromPrompt(opts.prompt);
    lines = fb.lines;
    if (!clientName) clientName = fb.clientName;
  }

  return {
    subject: String(parsed.subject || '').slice(0, 80),
    lines,
    clientName,
    notes: parsed.notes ? String(parsed.notes).slice(0, 500) : undefined,
    paymentTerms: parsed.paymentTerms ? String(parsed.paymentTerms).slice(0, 100) : undefined,
    dueKind: ['eom-next', 'plus30', 'plus14', 'plus60'].includes(parsed.dueKind) ? parsed.dueKind : 'eom-next',
  };
}
