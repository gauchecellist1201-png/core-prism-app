// ============================================================
// アップロードされたナレッジを Claude で自動分析
// ============================================================
import type { AppSettings, KnowledgeAnalysis, KnowledgeItem, Persona } from '../types/identity';
import { enqueueClaudeCall } from './apiQueue';
import { toneInstruction } from './aiTone';

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
  // API キーは main.tsx の interceptor が自動付与
  return enqueueClaudeCall(async () => {
    const truncated = content.slice(0, 12000);
    const userPrompt = `## タイトル\n${title}\n\n## 本文\n${truncated}\n\n金額を抽出してJSONで返してください。`;

    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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

// API キーは main.tsx の interceptor が localStorage から自動付与

function buildAnalysisInstructions(tone?: 'gentle' | 'professional' | 'casual'): string {
  return `あなたは資料を読んで「やさしく分かりやすく」提案する秘書です。
以下の資料を読み、必ず **JSONのみ** で返答してください (コードブロックや説明文は不要)。

スキーマ:
{
  "summary": "この資料は何の話か、3〜5行で説明 (日本語)",
  "insights": ["気づき1", "気づき2", ...] // 3〜7個。一文ずつ短く
  "strategy": ["この役割の人として、こう動いてはどうですか? 1", ...] // 3〜5個
  "actions": ["今日・明日できる具体的なこと1", ...] // 3〜5個。すぐやれる粒度
  "risks": ["気をつけたいこと1", ...] // 1〜3個、なければ空配列
}

${toneInstruction(tone)}

## 大事な姿勢
- ユーザーが資料を全部読まなくても、本質が分かる説明を心がけてください。
- 「〜のはずです」「〜してみると良さそうです」のような、押し付けない語り口で。
- 専門用語は必ず日本語で補足を添える。例) "ARR (毎年の継続収入)"
- 推測ではなく資料に書かれていることを根拠に書く。`;
}

export async function analyzeKnowledge(
  settings: AppSettings,
  persona: Persona,
  title: string,
  content: string,
  imageBase64?: string,
): Promise<KnowledgeAnalysis> {

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
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.preferredModel,
        max_tokens: 2048,
        system: buildAnalysisInstructions(settings.aiTone),
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

// ============================================================
// 先回り提案: AI がたまった資料から「この資料こう活かせます」を 3 案先出し
// 操作は ✓承認 (成果物を書き上げる) / ✏️直す (1行指示で再提案) / ✗却下 だけ。
// ============================================================
export type KnowledgeUseKind = 'summary' | 'action' | 'share' | 'decision' | 'content';

export const KNOWLEDGE_USE_LABEL: Record<KnowledgeUseKind, string> = {
  summary: 'まとめる',
  action: 'やることに変える',
  share: '共有用に整える',
  decision: '判断のたたき台',
  content: '発信ネタにする',
};

const KNOWLEDGE_USE_KINDS: KnowledgeUseKind[] = ['summary', 'action', 'share', 'decision', 'content'];

export interface KnowledgeUseProposal {
  title: string;        // そのまま実行できる活用アクション名 (20〜35字)
  hook: string;         // 実行するとどんな成果物が手に入るか (1〜2文)
  kind: KnowledgeUseKind;
  sourceTitle: string;  // 根拠にした資料のタイトル (なければ '')
  reason: string;       // なぜ今これを勧めるか (1文)
}

function buildKnowledgeContextForUse(items: KnowledgeItem[]): string {
  return items.slice(0, 6).map((k, i) => {
    const body = k.analysis?.summary || k.content.slice(0, 600);
    return `[資料${i + 1}: ${k.title}]\n${body}`;
  }).join('\n\n');
}

export interface KnowledgeAction {
  /** 命令形の短いアクション（明日から動ける粒度） */
  action: string;
  /** 何をどうやるか（誰に/何を/どこで）1 行 */
  how: string;
  /** 着手目安 */
  effort: 'today' | 'week' | 'month';
}

/**
 * 提案・戦略の本文を「丸ごとコピー」ではなく、明日から動ける具体アクションへ分解する。
 * （オーナー指示 2026-06-18: 丸ごとコピーは無意味。アクションベースで有益にする）
 */
export async function extractActionPlan(opts: {
  settings: AppSettings;
  title: string;
  body: string;
}): Promise<KnowledgeAction[]> {
  const SYS = `あなたは実行支援のプロ。与えられた提案・戦略の文章を、ユーザーが「明日から手を動かせる」具体的な次のアクションに分解する。
ルール:
- 3〜5 個。各アクションは命令形で短く（20〜36字）、すぐ着手できる粒度にする
- how は 1 行で「何をどうやるか」を具体的に（誰に / 何を / どこで / どの順で）
- effort は today（今日できる）/ week（今週）/ month（今月）のいずれか
- 「意識する」「検討する」などの抽象論・心構えは禁止。手を動かせることだけ
出力は JSON 配列のみ（前後に文章を書かない）:
[{"action":"...","how":"...","effort":"today|week|month"}]`;
  const userMsg = `# ${opts.title}\n\n${opts.body}\n\n上記を、明日から動ける具体アクションに分解して JSON で返してください。`;
  const text = await callKnowledgeAi(opts.settings, SYS, userMsg, 900, 'アクション分解');
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('アクションを取り出せませんでした。もう一度お試しください。');
  const arr = JSON.parse(m[0]);
  const ok: KnowledgeAction['effort'][] = ['today', 'week', 'month'];
  return (Array.isArray(arr) ? arr : [])
    .map((a: { action?: unknown; how?: unknown; effort?: unknown }) => ({
      action: String(a.action ?? '').trim().slice(0, 60),
      how: String(a.how ?? '').trim().slice(0, 140),
      effort: (ok as string[]).includes(String(a.effort)) ? (a.effort as KnowledgeAction['effort']) : 'week',
    }))
    .filter((a: KnowledgeAction) => a.action)
    .slice(0, 6);
}

async function callKnowledgeAi(
  settings: AppSettings,
  system: string,
  userMsg: string,
  maxTokens: number,
  label: string,
): Promise<string> {
  return enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.preferredModel,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `${label} API ${res.status}`);
    }
    const data = await res.json();
    return data.content?.[0]?.text ?? '';
  });
}

function normalizeUseProposal(p: any): KnowledgeUseProposal {
  const kind: KnowledgeUseKind = KNOWLEDGE_USE_KINDS.includes(p?.kind) ? p.kind : 'summary';
  return {
    title: String(p?.title || '').trim(),
    hook: String(p?.hook || '').trim(),
    kind,
    sourceTitle: String(p?.sourceTitle || '').trim(),
    reason: String(p?.reason || '').trim(),
  };
}

/** たまった資料から「こう活かせます」を 3 案、AI が先回りで提案する */
export async function proposeKnowledgeUses(opts: {
  settings: AppSettings;
  persona: Persona;
  knowledge: KnowledgeItem[];
}): Promise<KnowledgeUseProposal[]> {
  const kbCtx = buildKnowledgeContextForUse(opts.knowledge);

  const SYS = `あなたは ${opts.persona.name} (${opts.persona.subtitle}) の学びを支える秘書です。
ユーザーがためた資料を読み、「この資料、こう活かせます」を 3 案、先回りで提案します。
ユーザーは何も入力しません。あなたが具体的な活用アクションまで考えます。

## 人格コンテキスト
${opts.persona.description || '(なし)'}

## 出力フォーマット (JSON のみ、コードブロック・説明文なし)
{
  "proposals": [
    {
      "title": "そのまま実行できる活用アクション (20〜35字の日本語)",
      "hook": "実行するとどんな成果物が手に入るか (1〜2文)",
      "kind": "summary | action | share | decision | content",
      "sourceTitle": "根拠にした資料のタイトルを1つ (なければ空文字)",
      "reason": "なぜ今これを勧めるか (資料の中身を根拠に1文)"
    }
  ]
}

## ルール
- 3 案。活用の切り口を散らす (まとめる / やることに変える / 共有用に整える / 判断のたたき台 / 発信ネタ など)。
- 必ず資料の中身を根拠にする。資料に書いていない話を作らない。
- やさしい日本語。専門用語は使わず、使うときは括弧で和訳を添える。`;

  const userMsg = `## たまっている資料\n${kbCtx}\n\n上記の資料をどう活かせるか、具体的な活用アクションを 3 案提案してください。`;

  const text = await callKnowledgeAi(opts.settings, SYS, userMsg, 1200, '活用提案');
  let parsed: any = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch { /* ignore */ }
  const list: any[] = Array.isArray(parsed.proposals) ? parsed.proposals : [];
  return list.slice(0, 3).map(normalizeUseProposal).filter((p) => p.title);
}

/** ✏️直す: 1 行の自然文指示を受け、活用アクションを 1 案だけ作り直す */
export async function refineKnowledgeUse(opts: {
  settings: AppSettings;
  persona: Persona;
  proposal: KnowledgeUseProposal;
  instruction: string;
  knowledge: KnowledgeItem[];
}): Promise<KnowledgeUseProposal> {
  const kbCtx = buildKnowledgeContextForUse(opts.knowledge);

  const SYS = `あなたは ${opts.persona.name} の学びを支える秘書です。
すでに出した活用アクションの提案を、ユーザーの 1 行の指示にしたがって作り直します。

## 出力フォーマット (JSON のみ)
{
  "title": "...", "hook": "...", "kind": "summary | action | share | decision | content",
  "sourceTitle": "...", "reason": "..."
}

## ルール
- ユーザーの指示を最優先で反映する。
- 資料の中身を根拠にする。やさしい日本語で。`;

  const userMsg = `## いまの提案
タイトル: ${opts.proposal.title}
成果物: ${opts.proposal.hook}
理由: ${opts.proposal.reason}

## たまっている資料
${kbCtx}

## ユーザーの直してほしい指示
${opts.instruction}

この指示を反映して、活用アクションの提案を作り直してください。`;

  const text = await callKnowledgeAi(opts.settings, SYS, userMsg, 800, '提案修正');
  let parsed: any = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch {
    return opts.proposal;
  }
  const refined = normalizeUseProposal(parsed);
  return refined.title ? refined : opts.proposal;
}

/** ✓承認: 採用された活用アクションを実行し、すぐ使える成果物の本文を書き上げる */
export async function expandKnowledgeUse(opts: {
  settings: AppSettings;
  persona: Persona;
  proposal: KnowledgeUseProposal;
  knowledge: KnowledgeItem[];
}): Promise<string> {
  const kbCtx = buildKnowledgeContextForUse(opts.knowledge);

  const SYS = `あなたは ${opts.persona.name} (${opts.persona.subtitle}) の学びを支える秘書です。
採用された活用アクションを実行し、ユーザーがそのまま使える成果物の本文を書き上げます。

## ルール
- 出力は成果物の本文そのもの。あいさつ・前置き・「承知しました」などは書かない。
- 見出し (##) や箇条書き (-) を使って読みやすく。
- 資料に書かれていることを根拠にする。推測は「〜のはずです」と明示。
- やさしい日本語。専門用語は括弧で和訳を添える。`;

  const userMsg = `## 実行する活用アクション
${opts.proposal.title}
${opts.proposal.hook}

## たまっている資料
${kbCtx}

上記の資料をもとに、この活用アクションの成果物を本文として書き上げてください。`;

  const text = await callKnowledgeAi(opts.settings, SYS, userMsg, 2048, '成果物生成');
  return text.trim();
}
