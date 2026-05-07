// ============================================================
// レシート OCR — Claude Vision で画像から経費情報を抽出
// ============================================================
import type { AppSettings } from '../types/identity';
import type { ExpenseCategory, ExpenseTaxRate } from '../types/expense';
import { enqueueClaudeCall } from './apiQueue';

export interface OCRResult {
  date?: string;          // YYYY-MM-DD
  vendor?: string;
  amountIncl?: number;
  taxRate?: ExpenseTaxRate;
  category?: ExpenseCategory;
  description?: string;
}

const SYS = `あなたはレシート画像から経費情報を抽出する OCR アシスタントです。
日本のレシート (コンビニ・飲食店・タクシー・カフェ等) を読み取って構造化します。

返答は **JSONのみ** (コードブロック・説明文なし):
{
  "date": "YYYY-MM-DD",
  "vendor": "店舗名 (例: スターバックス 銀座店)",
  "amountIncl": 税込合計 (number, 円),
  "taxRate": 10 | 8 | 0,
  "category": "会議費" | "交際費" | "旅費交通費" | "通信費" | "消耗品費" | "広告宣伝費" | "外注費" | "地代家賃" | "水道光熱費" | "新聞図書費" | "研修費" | "支払手数料" | "租税公課" | "保険料" | "その他",
  "description": "摘要 (例: コーヒー 2杯)"
}

ルール:
- 飲食店・カフェ・喫茶 → 会議費
- 居酒屋・バー・接待 → 交際費
- タクシー・電車・新幹線・飛行機・宿泊 → 旅費交通費
- 飲食料品 (お酒以外) → 8% (軽減税率)、その他は基本 10%
- 値が読み取れない場合は省略 (null や undefined にしない)
- 金額は数値のみ (円・カンマ含めず)`;

export async function extractFromReceipt(opts: {
  settings: AppSettings;
  imageDataUrl: string; // data:image/...;base64,...
}): Promise<OCRResult> {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY || opts.settings.claudeApiKey || '';
  if (!apiKey) throw new Error('Claude API キーが未設定です');

  const match = opts.imageDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) throw new Error('画像データ形式が不正です');
  const mediaType = match[1];
  const data = match[2];

  const result = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 1024,
        system: SYS,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
            { type: 'text', text: 'このレシートから経費情報を抽出してJSONで返してください。' },
          ],
        }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `OCR エラー: ${res.status}`);
    }
    return res.json();
  });

  const text = result.content?.[0]?.text ?? '';
  let parsed: any = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch { /* ignore */ }

  return {
    date: parsed.date || undefined,
    vendor: parsed.vendor || undefined,
    amountIncl: typeof parsed.amountIncl === 'number' ? parsed.amountIncl : undefined,
    taxRate: [10, 8, 0].includes(parsed.taxRate) ? parsed.taxRate : 10,
    category: parsed.category || 'その他',
    description: parsed.description || undefined,
  };
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** 税抜・税額を計算 */
export function calcExpenseAmounts(amountIncl: number, taxRate: ExpenseTaxRate): { amountExcl: number; taxAmount: number } {
  if (taxRate === 0) return { amountExcl: amountIncl, taxAmount: 0 };
  const factor = 1 + taxRate / 100;
  const amountExcl = Math.floor(amountIncl / factor);
  const taxAmount = amountIncl - amountExcl;
  return { amountExcl, taxAmount };
}
