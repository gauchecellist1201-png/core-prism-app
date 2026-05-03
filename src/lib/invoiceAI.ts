// ============================================================
// 自然言語から請求書の明細を AI で組み立てる
// ============================================================
import type { AppSettings } from '../types/identity';
import type { InvoiceLine, TaxRate } from '../types/invoice';
import { enqueueClaudeCall } from './apiQueue';
import { v4 as uuidv4 } from 'uuid';

export interface AISuggestedInvoice {
  subject: string;
  lines: InvoiceLine[];
  notes?: string;
  paymentTerms?: string;
  /** 提案された支払期限の種別 */
  dueKind?: 'eom-next' | 'plus30' | 'plus14' | 'plus60';
}

const SYS = `あなたは経理プロです。日本の事業者が発行する請求書 (インボイス制度準拠) の明細を組み立てます。

返答は **JSONのみ** (コードブロック・説明文なし)。スキーマ:
{
  "subject": "件名 (例: 2026年5月分 ご請求 / Web制作費用 ご請求)",
  "lines": [
    {
      "description": "品目/サービス内容 (具体的に。例: 'Webサイト制作 - トップページ + 商品一覧 + 問い合わせフォーム')",
      "quantity": 数量 (number),
      "unit": "単位 (式 / 時間 / 個 / 月 / 名 など)",
      "unitPrice": 単価 税抜 (number、円単位の整数),
      "taxRate": 10 | 8 | 0,
      "reducedTax": false | true (軽減税率対象なら true)
    }
  ],
  "notes": "備考 (任意。例: '振込手数料はご負担ください')",
  "paymentTerms": "支払条件 (例: '月末締・翌月末日払い')",
  "dueKind": "eom-next" | "plus30" | "plus14" | "plus60"
}

ルール:
- 日本の慣習に合った勘定/品目名で
- 単価は税抜の整数 (円)
- 軽減税率 8% は飲食料品・新聞のみ。それ以外は基本 10%
- ユーザー入力に複数項目があれば全て個別行に分解 (まとめない)
- 不明な数量は 1、単位は「式」をデフォルトに
- 件名は短く明確に`;

export async function aiSuggestInvoice(opts: {
  settings: AppSettings;
  prompt: string;             // 自然言語の依頼内容
  clientName?: string;
  issueDate?: string;
}): Promise<AISuggestedInvoice> {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY || opts.settings.claudeApiKey || '';
  if (!apiKey) throw new Error('Claude APIキーが未設定です');

  const userPrompt = `## 依頼内容
${opts.prompt}

${opts.clientName ? `## 顧客名\n${opts.clientName}\n` : ''}
${opts.issueDate ? `## 発行日\n${opts.issueDate}\n` : ''}

上記から請求書の明細を JSON で構成してください。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 2000,
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

  const text = data.content?.[0]?.text ?? '';
  let parsed: any = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch {
    parsed = { subject: '', lines: [] };
  }

  const lines: InvoiceLine[] = (Array.isArray(parsed.lines) ? parsed.lines : []).map((l: any) => ({
    id: uuidv4(),
    description: String(l.description || '').slice(0, 200),
    quantity: Math.max(1, Number(l.quantity) || 1),
    unit: l.unit ? String(l.unit) : '式',
    unitPrice: Math.max(0, Math.round(Number(l.unitPrice) || 0)),
    taxRate: ([10, 8, 0].includes(Number(l.taxRate)) ? Number(l.taxRate) : 10) as TaxRate,
    reducedTax: !!l.reducedTax,
  }));

  return {
    subject: String(parsed.subject || '').slice(0, 80),
    lines,
    notes: parsed.notes ? String(parsed.notes).slice(0, 500) : undefined,
    paymentTerms: parsed.paymentTerms ? String(parsed.paymentTerms).slice(0, 100) : undefined,
    dueKind: ['eom-next', 'plus30', 'plus14', 'plus60'].includes(parsed.dueKind) ? parsed.dueKind : 'eom-next',
  };
}
