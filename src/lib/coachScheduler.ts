// ============================================================
// AI 戦略コーチ スケジューラ — デイリー 3 回ブリーフ自動生成
// ============================================================
import type { AppSettings, Persona, KnowledgeItem } from '../types/identity';
import type { DailyHealth } from '../types/health';
import type { HealthAnomaly } from '../data/healthAnomaly';
import { v4 as uuidv4 } from 'uuid';
import { enqueueClaudeCall } from './apiQueue';
import { toneInstruction } from './aiTone';

export type CoachSlot = 'morning' | 'noon' | 'evening';

export interface CoachBrief {
  id: string;
  date: string;        // YYYY-MM-DD
  slot: CoachSlot;
  personaId: string;
  title: string;
  message: string;
  actions: string[];
  context: string;
  generatedAt: string;
  dismissed?: boolean;
  read?: boolean;
}

const STORAGE_KEY = 'core_coach_briefs_v1';

function loadBriefs(): CoachBrief[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBriefs(briefs: CoachBrief[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(briefs.slice(0, 30)));
}

export function getSlotForHour(hour: number): CoachSlot | null {
  if (hour >= 6 && hour < 10) return 'morning';
  if (hour >= 12 && hour < 14) return 'noon';
  if (hour >= 18 && hour < 21) return 'evening';
  return null;
}

export function getCurrentSlot(): CoachSlot | null {
  return getSlotForHour(new Date().getHours());
}

export function getSlotLabel(slot: CoachSlot): string {
  switch (slot) {
    case 'morning': return '今朝';
    case 'noon':    return '今昼';
    case 'evening': return '今夜';
  }
}

export function shouldRefresh(slot: CoachSlot, personaId: string): boolean {
  const briefs = loadBriefs();
  const today = new Date().toISOString().slice(0, 10);
  const existing = briefs.find(
    b => b.date === today && b.slot === slot && b.personaId === personaId,
  );
  return !existing;
}

export function getTodayBrief(slot: CoachSlot, personaId: string): CoachBrief | null {
  const briefs = loadBriefs();
  const today = new Date().toISOString().slice(0, 10);
  return briefs.find(
    b => b.date === today && b.slot === slot && b.personaId === personaId,
  ) ?? null;
}

export function markBriefRead(id: string): void {
  const briefs = loadBriefs();
  saveBriefs(briefs.map(b => (b.id === id ? { ...b, read: true } : b)));
}

function buildSlotInstruction(slot: CoachSlot): string {
  switch (slot) {
    case 'morning':
      return `## モード: 朝のブリーフ (自動配信)
今日のフォーカスを決める。体調を踏まえて、今日重点にすべき事業アクション3件を具体的に提示。
"title" は「おはよう + 今日の核心1行」の形式 (20文字以内)。`;

    case 'noon':
      return `## モード: 昼のブリーフ (自動配信)
午前の進捗を踏まえてボトルネックを特定し、午後〜夜に向けてキャッチアップする最重要アクション1手を提示。
"title" は「昼の一手: ～～」形式 (20文字以内)。`;

    case 'evening':
      return `## モード: 夜のブリーフ (自動配信)
今日を振り返り、うまくいったこと1点を評価し、明日の最重要タスク1個だけを確定する。
"title" は「今日の振り返り: ～～」形式 (20文字以内)。リラックスした締めくくりにする。`;
  }
}

interface GenInput {
  persona: Persona;
  slot: CoachSlot;
  knowledge: KnowledgeItem[];
  health?: { today: DailyHealth | null; week: DailyHealth[]; anomalies: HealthAnomaly[] };
}

export async function generateBrief(
  settings: AppSettings,
  input: GenInput,
): Promise<CoachBrief> {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY || settings.claudeApiKey || '';

  const { persona, slot, knowledge, health } = input;

  const kbSummary = knowledge
    .slice(0, 5)
    .map(k => {
      const sum = k.analysis?.summary || k.content.slice(0, 150);
      const acts = k.analysis?.actions?.slice(0, 2).join(' / ') || '';
      return `- ${k.title}: ${sum}${acts ? ` [推奨: ${acts}]` : ''}`;
    })
    .join('\n') || '(まだ資料なし)';

  const openTasks = persona.tasks
    .filter(t => !t.done)
    .slice(0, 6)
    .map(t => `- [${t.priority}] ${t.title} (期限: ${t.due})`)
    .join('\n') || '(タスクなし)';

  const cashflow = `収入: ¥${persona.cashflow.income.toLocaleString()} / 支出: ¥${Math.abs(persona.cashflow.expense).toLocaleString()} (${persona.cashflow.label})`;

  let healthBlock = '';
  if (health?.today) {
    const t = health.today;
    healthBlock = `\n## 体調 (今日)\n- 睡眠: ${t.sleepHours.toFixed(1)}h (スコア${t.sleepScore}) / 回復: ${t.recoveryScore}/100 / ストレス: ${t.stressLevel}/100`;
    if (health.anomalies.length > 0) {
      healthBlock += '\n- 注意: ' + health.anomalies.slice(0, 2).map(a => a.title).join(', ');
    }
  }

  const systemPrompt = `あなたはオーナーの **AI 戦略コーチ** です。1日3回、自動的にブリーフィングを届けます。
返答は **JSONのみ** (コードブロックなし、説明文なし)。スキーマ:
{
  "title": "スロット名 + 今の核心 (20文字以内)",
  "message": "本文 3〜4文。具体的な数字・固有名詞・期日を含む。200文字以内。",
  "actions": ["今すぐできる具体的なこと1", "具体的なこと2"],
  "context": "なぜこれを提案したか、1文で"
}

${toneInstruction(settings.aiTone)}`;

  const slotJa = slot === 'morning' ? '朝' : slot === 'noon' ? '昼' : '夜';

  const userPrompt = `## アクティブ人格
${persona.name} (${persona.subtitle})
${persona.description || ''}

## 財務状況
${cashflow}

## 未完了タスク
${openTasks}

## 蓄積ナレッジ
${kbSummary}${healthBlock}

${buildSlotInstruction(slot)}

"${persona.name}" への${slotJa}のブリーフを生成してください。`;

  const data = await enqueueClaudeCall(async () => {
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
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: { message?: string } }).error?.message ?? `ブリーフAPIエラー: ${res.status}`);
    }
    return res.json();
  });

  const text = (data as { content?: Array<{ text?: string }> }).content?.[0]?.text ?? '';

  let parsed: Partial<CoachBrief> = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch {
    parsed = {
      title: `${slotJa}のブリーフ`,
      message: text.slice(0, 200),
      actions: [],
      context: '',
    };
  }

  const brief: CoachBrief = {
    id: uuidv4(),
    date: new Date().toISOString().slice(0, 10),
    slot,
    personaId: persona.id,
    title: String(parsed.title || `${slotJa}のブリーフ`),
    message: String(parsed.message || ''),
    actions: Array.isArray(parsed.actions) ? parsed.actions as string[] : [],
    context: String(parsed.context || ''),
    generatedAt: new Date().toISOString(),
  };

  // 同スロット・同日の既存ブリーフを置換して保存
  const existing = loadBriefs().filter(
    b => !(b.date === brief.date && b.slot === brief.slot && b.personaId === brief.personaId),
  );
  saveBriefs([brief, ...existing]);

  return brief;
}
