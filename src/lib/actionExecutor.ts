// ============================================================
// actionExecutor — TodayBrief のアクション提案を AI に実行させる
//
// オーナー指示 (2026-06-03):
//   「提案をタップしたら、AI がその場で実行を始めて、過程を見せて、
//    最後にちゃんと成果物を納品してほしい」
//
// 出来ること:
//   - AI に「やってくれ」と頼むと、3-5 ステップに分解された手順 + 成果物を返す
//   - 各ステップは「考えています → 完了」のアニメーションで UI に流す
//   - 最後の成果物 (テキスト / チェックリスト / メール下書き / 表) を保存して
//     コピー・共有・再利用できるようにする
//
// 設計方針:
//   - 1 回の AI コールで「手順 + 成果物」を JSON で受け取り、UI 側で時間を作って流す
//     (擬似ストリーム — トークン節約 + 体験はそのまま)
//   - 完成した成果物は localStorage に保存 (core_action_artifacts_v1)
//   - 外部 API (Sheets/Gmail) を叩く能力はないので、「次の一手」「下書き」「チェックリスト」
//     の形で確実に納品できるものに振り切る
// ============================================================
import { enqueueClaudeCall } from './apiQueue';
import type { AppSettings, Persona } from '../types/identity';

// ── 成果物の型 ─────────────────────────────────────────
export type DeliverableKind = 'text' | 'checklist' | 'email' | 'table' | 'memo';

export interface Deliverable {
  kind: DeliverableKind;
  title: string;
  /** Markdown 文字列 (checklist: `- [ ]` 形式 / email: 「件名:」+本文 / table: GFM テーブル) */
  content: string;
}

export interface ExecutionStep {
  /** ステップ名 (12 文字以内目安) — 「資料を読む」「下書きを作る」等 */
  label: string;
  /** 1 文 (実際の作業の中身) — 「在籍 25 名のうち欠席が増えた人を抽出した」等 */
  detail: string;
}

export interface ExecutionPlan {
  steps: ExecutionStep[];
  deliverable: Deliverable;
  /** 実際にやって気付いたメモ (オーナー向け 1-2 文) */
  note?: string;
}

// ── 保存形式 ────────────────────────────────────────────
export interface SavedArtifact {
  id: string;
  personaId: string;
  action: string;
  plan: ExecutionPlan;
  createdAt: string;
}

const ARTIFACT_KEY = 'core_action_artifacts_v1';

export function listArtifacts(personaId: string): SavedArtifact[] {
  try {
    const raw = localStorage.getItem(ARTIFACT_KEY);
    if (!raw) return [];
    const all: SavedArtifact[] = JSON.parse(raw);
    return all.filter(a => a.personaId === personaId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch { return []; }
}

export function saveArtifact(a: SavedArtifact): void {
  try {
    const raw = localStorage.getItem(ARTIFACT_KEY);
    const all: SavedArtifact[] = raw ? JSON.parse(raw) : [];
    all.unshift(a);
    // 直近 50 件まで保持
    const trimmed = all.slice(0, 50);
    localStorage.setItem(ARTIFACT_KEY, JSON.stringify(trimmed));
  } catch { /* quota */ }
}

export function deleteArtifact(id: string): void {
  try {
    const raw = localStorage.getItem(ARTIFACT_KEY);
    if (!raw) return;
    const all: SavedArtifact[] = JSON.parse(raw);
    localStorage.setItem(ARTIFACT_KEY, JSON.stringify(all.filter(a => a.id !== id)));
  } catch { /* */ }
}

// ── AI コール本体 ──────────────────────────────────────
const SYSTEM_PROMPT = `あなたはオーナーの隣で実務を肩代わりする AI 業務代行員です。
オーナーから「これをやって」と依頼されたら、以下を行ってください:

① その仕事を 3〜5 ステップに分解し、各ステップで「実際に何をしたか」を簡潔に書く
② 最後に「成果物」を 1 つ作る (オーナーが今すぐ使える状態で)
③ 外部 API は叩けないが、「下書き」「チェックリスト」「テンプレ」「次の一手」など、
   オーナーが受け取った瞬間に作業時間が縮む形で納品する

【返答ルール】
- 必ず JSON 1 つだけ で返す (コードブロックや前後説明禁止)
- 日本語のやさしい言葉。横文字は最小限。
- 数字や固有名詞は会話の文脈から拾うこと (作り話禁止)

【スキーマ】
{
  "steps": [
    { "label": "短い動詞句 (12 字以内)", "detail": "実際にやったことを 1 文で" }
  ],
  "deliverable": {
    "kind": "text" | "checklist" | "email" | "table" | "memo",
    "title": "成果物のタイトル (20 字以内)",
    "content": "成果物本体 (Markdown)。checklist は '- [ ] 〜' 形式。email は '件名: 〜\\n\\n本文' 形式。table は GFM。"
  },
  "note": "オーナーに伝えたい気付き 1-2 文 (省略可)"
}`;

function buildUserPrompt(action: string, persona: Persona | null, context?: string): string {
  const who = persona
    ? `【オーナーの状況】${persona.name} (${persona.subtitle})\n${persona.description}\n`
    : '';
  const ctx = context ? `\n【追加コンテキスト】\n${context}\n` : '';
  return `${who}${ctx}
【依頼】
${action}

このタスクを上記スキーマで実行 → 成果物を納品してください。`;
}

/**
 * AI に action を実行させ、完成した plan を返す。
 * UI 側ではこの結果を受け取って、step を 1 つずつ時間差で見せる。
 */
export async function executeAction(
  action: string,
  persona: Persona | null,
  settings: AppSettings,
  context?: string,
): Promise<ExecutionPlan> {
  return enqueueClaudeCall(async () => {
    const userPrompt = buildUserPrompt(action, persona, context);
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.preferredModel || 'claude-haiku-4-5',
        max_tokens: 2400,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || `AI 実行に失敗しました (HTTP ${res.status})`);
    }
    const data = await res.json();
    const text: string = data?.content?.[0]?.text ?? '';
    const parsed = parsePlan(text);
    if (!parsed) {
      throw new Error('AI からの返答を読み取れませんでした。もう一度お試しください。');
    }
    return parsed;
  });
}

function parsePlan(text: string): ExecutionPlan | null {
  // JSON ブロック抽出 (前後に余計な説明があっても拾う)
  const match = text.match(/\{[\s\S]*\}/);
  const raw = match ? match[0] : text;
  try {
    const obj = JSON.parse(raw);
    if (!obj || !Array.isArray(obj.steps) || !obj.deliverable) return null;
    const steps: ExecutionStep[] = obj.steps
      .filter((s: unknown): s is { label?: unknown; detail?: unknown } => !!s && typeof s === 'object')
      .map((s: { label?: unknown; detail?: unknown }) => ({
        label: String(s.label || '').slice(0, 24) || '実行',
        detail: String(s.detail || '').slice(0, 240) || '',
      }))
      .slice(0, 6);
    if (steps.length === 0) return null;
    const d = obj.deliverable;
    const kind: DeliverableKind = ['text', 'checklist', 'email', 'table', 'memo'].includes(d.kind)
      ? d.kind as DeliverableKind
      : 'text';
    const deliverable: Deliverable = {
      kind,
      title: String(d.title || '成果物').slice(0, 40),
      content: String(d.content || '').slice(0, 8000),
    };
    return {
      steps,
      deliverable,
      note: obj.note ? String(obj.note).slice(0, 200) : undefined,
    };
  } catch {
    return null;
  }
}

/** UI 側で「考えている」感を作るためのステップタイミング (ms) */
export const STEP_REVEAL_MS = 650;
export const STEP_THINKING_MS = 500;
