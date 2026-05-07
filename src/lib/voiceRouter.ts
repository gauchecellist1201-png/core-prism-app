// ============================================================
// 音声メモ AI 振り分け — 書き起こしを Claude で分類する
// ============================================================
import type { AppSettings } from '../types/identity';
import { enqueueClaudeCall } from './apiQueue';

export type VoiceCategory = 'task' | 'knowledge' | 'crm' | 'expense' | 'idea';

export interface VoiceRouteItem {
  kind: VoiceCategory;
  title: string;
  summary: string;
  confidence: number; // 0-1
  details?: Record<string, unknown>;
}

export interface VoiceRoutingResult {
  categories: VoiceRouteItem[];
}

function getApiKey(settings: AppSettings): string {
  return import.meta.env.VITE_CLAUDE_API_KEY || settings.claudeApiKey || '';
}

const SYS = `あなたはユーザーの音声メモを分析して適切なカテゴリに振り分けるAIアシスタントです。
日本語の書き起こしテキストを受け取り、以下の5つのカテゴリに分類します。

返答は **JSONのみ** (コードブロック・説明文なし):
{
  "categories": [
    {
      "kind": "task" | "knowledge" | "crm" | "expense" | "idea",
      "title": "簡潔なタイトル (20文字以内)",
      "summary": "内容の要約 (50文字以内)",
      "confidence": 0.0〜1.0の数値,
      "details": {} // kind別の追加情報
    }
  ]
}

カテゴリ定義:
- task: やるべきこと・締め切りのある作業・TODO
- knowledge: 参照情報・メモ・学び・調査結果
- crm: 顧客・案件・営業・商談関連
- expense: 経費・支払い・購入履歴
- idea: アイデア・着想・将来の構想

detailsの内容:
- task: { "priority": "high"|"mid"|"low", "due": "YYYY-MM-DD または 相対表現" }
- knowledge: { "tags": ["タグ1","タグ2"] }
- crm: { "contact": "担当者名", "amount": 金額数値または0, "stage": "lead"|"qualified"|"proposal" }
- expense: { "vendor": "店舗名", "amountIncl": 金額数値または0, "category": "会議費"|"交際費"|"旅費交通費"|"通信費"|"消耗品費"|"その他" }
- idea: {}

ルール:
- 1つの音声メモから複数カテゴリが該当することがある
- confidenceが0.4未満のものは省略してよい
- 必ず1つ以上のカテゴリを返す
- タイトルは行動・内容が分かる具体的な表現にする`;

export async function routeVoiceMemo(
  transcript: string,
  settings: AppSettings,
): Promise<VoiceRoutingResult> {
  const apiKey = getApiKey(settings);
  if (!apiKey) throw new Error('Claude API キーが未設定です');

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
        model: settings.preferredModel,
        max_tokens: 1024,
        system: SYS,
        messages: [{
          role: 'user',
          content: `以下の音声メモを分析して分類してください:\n\n${transcript}`,
        }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error?.message ?? `API エラー: ${res.status}`);
    }
    return res.json();
  });

  const text: string = result.content?.[0]?.text ?? '{}';
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned) as VoiceRoutingResult;
    if (!Array.isArray(parsed.categories)) return { categories: [] };
    return parsed;
  } catch {
    return { categories: [] };
  }
}
