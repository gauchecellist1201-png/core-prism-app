// ============================================================
// 意思決定メモ — 構造化されたフレームワークで判断を支援
// ============================================================
import type { AppSettings, Persona, KnowledgeItem } from '../types/identity';
import { enqueueClaudeCall } from './apiQueue';
import { aiFetch } from './aiFetch';

// API キーは main.tsx の fetch interceptor が localStorage から自動付与

export interface DecisionInput {
  question: string;          // 「○○すべきか?」
  context?: string;          // 背景・制約
  options?: string[];        // 選択肢 (なければ AI が補完)
  criteria?: string[];       // 評価軸 (なければ AI が補完)
  timeHorizon?: string;      // 「3ヶ月」「3年」等
  riskTolerance?: 'low' | 'mid' | 'high';
}

export interface DecisionOption {
  name: string;
  pros: string[];
  cons: string[];
  scoreByCriteria: { criterion: string; score: number; reason: string }[]; // 0-10
  totalScore: number;
}

export interface DecisionMemo {
  question: string;
  context: string;
  options: DecisionOption[];
  criteria: string[];
  recommended: string;       // 推奨選択肢の name
  confidence: number;        // 0-100
  rationale: string;         // 推奨の根拠
  risks: string[];
  reversibility: 'reversible' | 'partial' | 'irreversible';
  nextSteps: string[];
  questionsToReflect: string[];  // 自問してほしい質問
  generatedAt: string;
}

const SYS = `あなたは経営戦略コンサルタントです。
意思決定の構造化を支援します。返答は**JSONのみ**(コードブロック不要):

{
  "options": [
    {
      "name": "選択肢名",
      "pros": ["メリット1", ...] // 3-5項目
      "cons": ["デメリット1", ...] // 3-5項目
      "scoreByCriteria": [
        { "criterion": "評価軸", "score": 0-10, "reason": "理由" }
      ],
      "totalScore": 加重合計 (0-100)
    }
  ],
  "criteria": ["評価軸1", "評価軸2", ...] // 4-6項目、最初に提示する
  "recommended": "推奨選択肢の name",
  "confidence": 推奨に対する確度 (0-100),
  "rationale": "推奨の根拠 (3-5文)",
  "risks": ["リスク1", ...] // 2-4項目
  "reversibility": "reversible" | "partial" | "irreversible",
  "nextSteps": ["次の一歩1", ...] // 2-4項目、推奨を進めるなら
  "questionsToReflect": ["自問1", ...] // 3-5項目、決定前に考えるべき質問
}

ルール:
- 選択肢が未指定なら、合理的なものを 2-4 件提示 (現状維持を含めることが多い)
- 評価軸が未指定なら、人格コンテキストから重要な軸を 4-6 件設定
- 各 option の totalScore は scoreByCriteria の合計を 100 換算
- 推奨は最高スコアまたは状況的に最適なもの
- 推測ではなく入力情報に基づく
- すべて日本語、簡潔に`;

export async function generateDecisionMemo(
  settings: AppSettings,
  persona: Persona,
  input: DecisionInput,
  knowledge: KnowledgeItem[],
): Promise<DecisionMemo> {

  // 関連ナレッジを軽く検索
  const relevantKnowledge = knowledge
    .filter(k => k.personaId === persona.id)
    .slice(0, 5)
    .map(k => `- ${k.title}: ${k.analysis?.summary || k.content.slice(0, 200)}`)
    .join('\n') || '(関連ナレッジなし)';

  const userPrompt = `## 人格コンテキスト
${persona.name} (${persona.subtitle})
${persona.description || ''}

## 質問
${input.question}

## 背景・制約
${input.context || '(未指定)'}

## 与えられた選択肢
${input.options?.length ? input.options.map((o, i) => `${i + 1}. ${o}`).join('\n') : '(未指定 — AI が補完)'}

## 評価軸
${input.criteria?.length ? input.criteria.join(' / ') : '(未指定 — 人格に応じて AI が設定)'}

## 時間軸
${input.timeHorizon || '(未指定)'}

## リスク許容度
${input.riskTolerance || '(未指定)'}

## 関連ナレッジ
${relevantKnowledge}

上記を踏まえて、構造化された意思決定メモを JSON で出力してください。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await aiFetch({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.preferredModel,
        max_tokens: 4096,
        system: SYS,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `意思決定 API エラー: ${res.status}`);
    }
    return res.json();
  });
  const text = data.content?.[0]?.text ?? '';
  let parsed: any = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch {
    parsed = {};
  }

  return {
    question: input.question,
    context: input.context || '',
    options: Array.isArray(parsed.options) ? parsed.options : [],
    criteria: Array.isArray(parsed.criteria) ? parsed.criteria : [],
    recommended: parsed.recommended || '',
    confidence: Number(parsed.confidence) || 0,
    rationale: parsed.rationale || '',
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    reversibility: parsed.reversibility || 'partial',
    nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [],
    questionsToReflect: Array.isArray(parsed.questionsToReflect) ? parsed.questionsToReflect : [],
    generatedAt: new Date().toISOString(),
  };
}

// ─── 自然文 → 構造化抽出 ──
// 「迷ってることをそのまま書いた文章」から 6 要素を一発で抽出
export interface ExtractedDecisionFields {
  question: string;
  context: string;
  options: string[];
  criteria: string[];
  timeHorizon: string;
  riskTolerance: 'low' | 'mid' | 'high';
}

export async function extractDecisionFields(
  settings: AppSettings,
  rawText: string,
  persona: Persona,
): Promise<ExtractedDecisionFields> {
  if (!rawText.trim()) throw new Error('内容が空です');

  const sys = `あなたは経営者の「迷い」を聞き取って、意思決定の要素に分解するエキスパートです。
ユーザーが自然文で語った内容から、以下の 6 要素を抽出して JSON で返してください。
返答は JSON のみ。前置きも後置きも、コードブロックも一切なし。

{
  "question": "決めたい質問 (50字以内、疑問形)",
  "context": "背景・制約 (見えてる文脈をまとめる、200字以内)",
  "options": ["選択肢A", "選択肢B"],
  "criteria": ["評価軸1", "評価軸2"],
  "timeHorizon": "判断の時間軸 (例: 3ヶ月 / 1年 / 5年)、不明なら空文字",
  "riskTolerance": "low" | "mid" | "high"
}

ルール:
- options: 文中に明示されていれば全て拾う。明示されていなければ [] を返す (AI 側で後で補完される)
- criteria: 文中に評価基準が示唆されていれば拾う、なければ []
- riskTolerance: 文脈から判断。攻めの表現 / 慎重さ / 不明 を high / low / mid に
- 推測しすぎず、文中に根拠がある情報だけを拾う`;

  const userText = `## 人格コンテキスト
${persona.name} (${persona.subtitle || ''})

## ユーザーが語った内容
${rawText}

上記から 6 要素を JSON で抽出してください。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await aiFetch({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.preferredModel,
        max_tokens: 1500,
        system: sys,
        messages: [{ role: 'user', content: userText }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `要素抽出 API エラー: ${res.status}`);
    }
    return res.json();
  });
  const text = data.content?.[0]?.text ?? '';
  let parsed: any = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch {
    throw new Error('AI からの応答を解析できませんでした');
  }

  const risk = parsed.riskTolerance;
  return {
    question: String(parsed.question || '').trim(),
    context: String(parsed.context || '').trim(),
    options: Array.isArray(parsed.options) ? parsed.options.map(String).filter(Boolean) : [],
    criteria: Array.isArray(parsed.criteria) ? parsed.criteria.map(String).filter(Boolean) : [],
    timeHorizon: String(parsed.timeHorizon || '').trim(),
    riskTolerance: risk === 'low' || risk === 'high' ? risk : 'mid',
  };
}

// 履歴管理 (LocalStorage)
const STORAGE_KEY = 'core_decisions';
const MAX_HISTORY = 50;

export function loadDecisions(): DecisionMemo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDecision(m: DecisionMemo) {
  const cur = loadDecisions();
  cur.unshift(m);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cur.slice(0, MAX_HISTORY)));
}

export function decisionToMarkdown(m: DecisionMemo): string {
  const lines: string[] = [];
  lines.push(`# 意思決定メモ\n`);
  lines.push(`## 質問\n${m.question}\n`);
  if (m.context) lines.push(`## 背景\n${m.context}\n`);
  lines.push(`## 評価軸\n${m.criteria.map(c => `- ${c}`).join('\n')}\n`);

  lines.push(`## 選択肢の比較`);
  m.options.forEach((o, i) => {
    lines.push(`\n### ${i + 1}. ${o.name} (${o.totalScore}/100)`);
    lines.push(`\n**メリット**`);
    o.pros.forEach(p => lines.push(`- ${p}`));
    lines.push(`\n**デメリット**`);
    o.cons.forEach(c => lines.push(`- ${c}`));
    lines.push(`\n**評価軸別スコア**`);
    o.scoreByCriteria.forEach(s => lines.push(`- ${s.criterion}: ${s.score}/10 — ${s.reason}`));
  });

  lines.push(`\n## 推奨: ${m.recommended} (確度 ${m.confidence}%)\n${m.rationale}\n`);
  if (m.risks.length) {
    lines.push(`## リスク\n${m.risks.map(r => `- ${r}`).join('\n')}\n`);
  }
  lines.push(`## 可逆性\n${m.reversibility === 'reversible' ? '✅ 可逆' : m.reversibility === 'partial' ? '⚠ 部分的' : '🔒 不可逆'}\n`);
  if (m.nextSteps.length) {
    lines.push(`## 次のステップ\n${m.nextSteps.map(s => `- ${s}`).join('\n')}\n`);
  }
  if (m.questionsToReflect.length) {
    lines.push(`## 決定前に考えるべき質問\n${m.questionsToReflect.map(q => `- ${q}`).join('\n')}\n`);
  }

  return lines.join('\n');
}
