// ============================================================
// AI 戦略コーチ スケジューラ — デイリー 3 回ブリーフ自動生成
// ============================================================
import type { AppSettings, Persona, KnowledgeItem } from '../types/identity';
import type { DailyHealth } from '../types/health';
import type { HealthAnomaly } from '../data/healthAnomaly';
import { v4 as uuidv4 } from 'uuid';
import { enqueueClaudeCall } from './apiQueue';
import { toneInstruction } from './aiTone';
import { buildIndustryContext } from '../prism/industryPacks';

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

/**
 * 業務情報のスナップショット — ブリーフを「具体的な数字 + 課題」ベースにする。
 * 値が無い項目は呼び出し側で省略 OK (undefined 安全)。
 */
export interface BusinessSnapshot {
  /** Stripe 実売上 (今月) — connect 済なら必ず渡す */
  stripe?: {
    thisMonthRevenueJpy: number;
    thisMonthExpenseJpy: number;
    thisMonthProfitJpy: number;
    thisMonthTxnCount: number;
    /** 前月比 (-0.10 = -10%) */
    momGrowth?: number | null;
    /** 直近 3 ヶ月の売上合計 */
    last3mRevenueJpy?: number;
    connected: boolean;
  };
  /** 未請求 / 未送付の請求書 */
  invoices?: { unpaidCount: number; unpaidAmountJpy: number; overdueCount: number };
  /** 未処理経費 (レシート未登録) */
  expenses?: { uncategorizedCount: number; thisMonthAmountJpy: number };
  /** 営業パイプライン */
  deals?: { activeCount: number; weightedPipelineJpy: number; stalledCount: number };
  /** ファン / 顧客 関連 */
  people?: { staleContactCount: number; topFanCount: number };
}

interface GenInput {
  persona: Persona;
  slot: CoachSlot;
  knowledge: KnowledgeItem[];
  health?: { today: DailyHealth | null; week: DailyHealth[]; anomalies: HealthAnomaly[] };
  business?: BusinessSnapshot;
}

export async function generateBrief(
  settings: AppSettings,
  input: GenInput,
): Promise<CoachBrief> {
  // API キー / master key / gemini key は main.tsx の fetch interceptor が
  // localStorage から自動で付与する。ここでは手動で渡さない。
  const { persona, slot, knowledge, health, business } = input;

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

  // Stripe 実売上があれば最優先で使う。無ければ手入力 cashflow にフォールバック。
  const yen = (n: number) => '¥' + Math.round(n).toLocaleString('ja-JP');
  const pct = (g: number | null | undefined) => g == null ? '—' : `${g > 0 ? '+' : ''}${(g * 100).toFixed(0)}%`;

  let cashflow: string;
  if (business?.stripe?.connected && business.stripe.thisMonthRevenueJpy > 0) {
    const s = business.stripe;
    cashflow = `Stripe 実売上 (今月): ${yen(s.thisMonthRevenueJpy)} / 経費: ${yen(s.thisMonthExpenseJpy)} / 利益: ${yen(s.thisMonthProfitJpy)} / 取引 ${s.thisMonthTxnCount} 件 / 前月比 ${pct(s.momGrowth)}`;
    if (s.last3mRevenueJpy && s.last3mRevenueJpy > 0) {
      cashflow += ` / 直近 3 ヶ月合計 ${yen(s.last3mRevenueJpy)}`;
    }
  } else {
    cashflow = `収入: ¥${persona.cashflow.income.toLocaleString()} / 支出: ¥${Math.abs(persona.cashflow.expense).toLocaleString()} (${persona.cashflow.label})`;
    if (!business?.stripe?.connected) {
      cashflow += '\n  (※ Stripe 未連携。連携すると実売上が反映されます)';
    }
  }

  // 業務スナップショットを 1 ブロックに集約
  const bizBlock: string[] = [];
  if (business?.invoices) {
    const i = business.invoices;
    if (i.unpaidCount > 0 || i.overdueCount > 0) {
      bizBlock.push(`- 未請求/未払: ${i.unpaidCount} 件 (合計 ${yen(i.unpaidAmountJpy)})${i.overdueCount > 0 ? ` うち期限超過 ${i.overdueCount} 件` : ''}`);
    }
  }
  if (business?.expenses) {
    const e = business.expenses;
    if (e.uncategorizedCount > 0) {
      bizBlock.push(`- 未処理レシート: ${e.uncategorizedCount} 枚 (今月経費 ${yen(e.thisMonthAmountJpy)})`);
    }
  }
  if (business?.deals) {
    const d = business.deals;
    if (d.activeCount > 0) {
      bizBlock.push(`- 進行中案件: ${d.activeCount} 件 (確度加重 ${yen(d.weightedPipelineJpy)})${d.stalledCount > 0 ? ` うち停滞 ${d.stalledCount} 件` : ''}`);
    }
  }
  if (business?.people) {
    const p = business.people;
    if (p.staleContactCount > 0) {
      bizBlock.push(`- 連絡が空いた相手: ${p.staleContactCount} 人 (30 日以上)`);
    }
  }
  const businessOps = bizBlock.length > 0 ? bizBlock.join('\n') : '(業務情報の追加データなし)';

  // 体調は「業務に影響する場合だけ」1 行で添える。最後に
  let healthBlock = '';
  if (health?.today) {
    const t = health.today;
    const concern = t.sleepHours < 5 || t.recoveryScore < 40 || t.stressLevel > 70;
    if (concern) {
      healthBlock = `\n## 体調 (注意あり)\n- 睡眠 ${t.sleepHours.toFixed(1)}h / 回復 ${t.recoveryScore} / ストレス ${t.stressLevel}`;
      if (health.anomalies.length > 0) {
        healthBlock += ` / ${health.anomalies.slice(0, 1).map(a => a.title).join(', ')}`;
      }
    } else {
      healthBlock = `\n## 体調 — 概ね良好 (睡眠 ${t.sleepHours.toFixed(1)}h / 回復 ${t.recoveryScore})`;
    }
  }

  const systemPrompt = `あなたはオーナーの **AI 戦略コーチ** です。1 日 3 回、自動的にお知らせを届けます。

## 🟢 内容のルール (絶対遵守)
1. **業務 (お金 / 案件 / タスク / 顧客) が常に最優先**。体調の話は、業務に影響しているとき "1 文だけ" 添える。
2. **必ず数字を入れる**: Stripe 実売上 / 未請求金額 / 取引件数 / 残タスク件数 / 案件件数 など、与えられた数字を message と context に入れる。
3. 抽象的な「がんばりましょう」「健康に気をつけて」だけは **禁止**。具体的な行動を 1 つ以上提示。
4. ナレッジに書かれていることだけを根拠にする。推測で数字を作らない。

## 🟢 やさしい日本語で書くルール (絶対遵守)
中学生でも読める言葉で書く。専門用語・横文字は使わない。やむを得ず使う場合は括弧で和訳。
- LTV / MRR / ARPU / チャーン / アップセル / KPI / LP / CTA / ファネル / セグメント など業界用語は **すべて言い換える**
- 例: 「毎月の売上」「やめてしまう人の割合」「上のプランへの切替」「目標の数字」「集客ページ」「申込ボタン」
- 「ブリーフィング」→「お知らせ」、「アクションアイテム」→「やること」、「コンテキスト」→「背景」
- 文末は丁寧 (〜します / 〜できます / 〜してみてください)

## 出力フォーマット
返答は **JSON のみ** (コードブロックなし、説明文なし)。スキーマ:
{
  "title": "時間帯 + 今の中心テーマ (20 文字以内、やさしい日本語)",
  "message": "本文 3〜4 文。具体的な数字・固有名詞・期日を含む。200 文字以内。やさしい日本語。",
  "actions": ["今すぐできる具体的なこと 1 (やさしい日本語)", "具体的なこと 2"],
  "context": "なぜこれを提案したか、1 文 (やさしい日本語)"
}

${toneInstruction(settings.aiTone)}`;

  const slotJa = slot === 'morning' ? '朝' : slot === 'noon' ? '昼' : '夜';

  const industryBlock = buildIndustryContext(settings.industry);

  const userPrompt = `${industryBlock ? industryBlock + '\n' : ''}## アクティブ人格
${persona.name} (${persona.subtitle})
${persona.description || ''}

## 💰 業務状況 (この情報を必ず提案に活かす)
${cashflow}

### 業務オペレーション (未処理 / 進行中)
${businessOps}

## 未完了タスク
${openTasks}

## 蓄積ナレッジ
${kbSummary}${healthBlock}

${buildSlotInstruction(slot)}

"${persona.name}" への${slotJa}のブリーフを生成してください。
**業務 (お金 / 案件 / タスク) を必ず中心に。** 体調は業務に影響していなければ言及しない。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // ブリーフ生成は軽量タスク (max_tokens 600) なので Master でも Gemini で十分
        'x-ai-weight': 'light',
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
