// ============================================================
// アップロードされたナレッジを Claude で自動分析
// ============================================================
import type { AppSettings, KnowledgeAnalysis, Persona } from '../types/identity';
import { enqueueClaudeCall } from './apiQueue';

// 財務関連キーワード (タイトル/本文に含まれていたら財務データと判断)
const FIN_KEYWORDS = [
  '決算', '損益', '月次', '試算表', 'P&L', 'PL', 'BS', '貸借', 'CF',
  '売上高', '売上', '営業利益', '純利益', '当期純利益', '財務', '会計',
  'ARR', 'MRR', '収支', 'バーンレート', 'キャッシュフロー',
  '収入', '支出', '経費', '販管費', '粗利', '原価', '入金', '出金',
  '資金繰り', '営業収益', '事業収益', '請求', '銀行残高',
  'income statement', 'balance sheet', 'cash flow', 'revenue', 'expense', 'profit',
];

const STRONG_FIN_KEYWORDS = ['決算', '損益', '貸借', '試算表', 'P&L', 'BS', 'PL', '売上高', '営業利益', '純利益', 'ARR', 'MRR', 'バーンレート'];

export function looksLikeFinancialData(title: string, content: string): boolean {
  const haystack = (title + ' ' + content.slice(0, 5000)).toLowerCase();
  // 強キーワード1つ、または弱キーワード2つでヒット
  const strongHits = STRONG_FIN_KEYWORDS.filter(kw => haystack.includes(kw.toLowerCase())).length;
  if (strongHits >= 1) return true;
  const hits = FIN_KEYWORDS.filter(kw => haystack.includes(kw.toLowerCase())).length;
  // 金額表記 (¥ または 円) も加点
  const hasMoney = /[¥￥]\s?\d|\d+\s?(円|万円|千円|百万円|億円)/i.test(haystack);
  return hits + (hasMoney ? 1 : 0) >= 2;
}

export interface ExtractedFinancials {
  isFinancial: boolean;
  period?: string;            // 例: "2026年Q1" / "2026年4月"
  income?: number;            // 円単位
  expense?: number;           // 円単位 (絶対値、自動的に - 付与)
  netCashflow?: number;       // 純収支
  recurringRevenue?: number;  // ARR (任意)
  burn?: number;              // バーンレート月次 (任意)
  notes?: string;             // 一行サマリ
}

const FIN_SYS = `あなたは財務データ抽出 AI です。
入力された文書から **金額数値** を抽出し JSON で返します。

返答は **JSONのみ**:
{
  "isFinancial": true | false,
  "period": "対象期間 (例: 2026年Q1 / 2026年4月)",
  "income": 円単位 (number。月額または期間合計の収入総額),
  "expense": 円単位 (number。期間合計の費用総額。正の値で返す),
  "netCashflow": 円単位 (income - expense),
  "recurringRevenue": ARR (number、任意),
  "burn": 月次バーンレート (number、任意),
  "notes": "1文の財務サマリ"
}

ルール:
- 千円単位・百万円単位の場合は円単位に変換 (例: "5,000千円" → 5000000)
- 月次データの場合は月額として income / expense を返す
- 年次データの場合は月額換算 (年額 / 12)
- 複数期間ある場合は最新期間を採用
- 該当数値が見つからない場合は省略
- isFinancial が false なら他のフィールドは省略可`;

export async function extractFinancialData(
  settings: AppSettings,
  title: string,
  content: string,
): Promise<ExtractedFinancials> {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY || settings.claudeApiKey || '';
  if (!apiKey) throw new Error('Claude APIキーが設定されていません');

  return enqueueClaudeCall(async () => {
    const truncated = content.slice(0, 12000);
    const userPrompt = `## タイトル\n${title}\n\n## 本文\n${truncated}\n\n金額を抽出してJSONで返してください。`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: settings.preferredModel,
        max_tokens: 800,
        system: FIN_SYS,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error?.message ?? `財務抽出 API ${res.status}`);
    }
    const data = await res.json();
    const text = data.content?.[0]?.text ?? '';
    try {
      const m = text.match(/\{[\s\S]*\}/);
      return JSON.parse(m ? m[0] : text);
    } catch {
      return { isFinancial: false };
    }
  });
}

function getApiKey(settings: AppSettings): string {
  return import.meta.env.VITE_CLAUDE_API_KEY || settings.claudeApiKey || '';
}

const ANALYSIS_INSTRUCTIONS = `あなたは資料を読み込んで戦略的な提案を行うAIアナリストです。
以下の資料を読み、必ず**JSONのみ**で返答してください(コードブロックや説明文は不要)。

スキーマ:
{
  "summary": "資料全体の要約 (3-5行、日本語)",
  "insights": ["重要ポイント1", "重要ポイント2", ...] // 3-7項目
  "strategy": ["この人格として取るべき戦略1", "戦略2", ...] // 3-5項目
  "actions": ["具体的な次のアクション1", "アクション2", ...] // 3-5項目、すぐ実行できる粒度
  "risks": ["リスク・懸念点1", ...] // 1-3項目、なければ空配列
}

すべて日本語、簡潔に。推測ではなく資料に基づいた提案をすること。`;

export async function analyzeKnowledge(
  settings: AppSettings,
  persona: Persona,
  title: string,
  content: string,
  imageBase64?: string,
): Promise<KnowledgeAnalysis> {
  const apiKey = getApiKey(settings);
  if (!apiKey) {
    throw new Error('Claude APIキーが設定されていません');
  }

  const truncated = content.slice(0, 30000);
  const userText = `## 資料タイトル
${title}

## 人格コンテキスト
${persona.name} (${persona.subtitle})
${persona.description || ''}

## 資料本文
${truncated}${content.length > truncated.length ? '\n\n[...以降省略]' : ''}`;

  const userContent: Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }> = [];

  if (imageBase64) {
    const match = imageBase64.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (match) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: match[1], data: match[2] },
      });
    }
  }
  userContent.push({ type: 'text', text: userText });

  return enqueueClaudeCall(async () => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: settings.preferredModel,
        max_tokens: 2048,
        system: ANALYSIS_INSTRUCTIONS,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `分析APIエラー: ${res.status}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text ?? '';

    let parsed: Partial<KnowledgeAnalysis> = {};
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      parsed = {
        summary: text.slice(0, 400),
        insights: [],
        strategy: [],
        actions: [],
        risks: [],
      };
    }

    return {
      summary: parsed.summary || '',
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      strategy: Array.isArray(parsed.strategy) ? parsed.strategy : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      generatedAt: new Date().toISOString(),
    };
  });
}
