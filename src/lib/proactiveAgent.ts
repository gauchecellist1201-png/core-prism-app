// ============================================================
// 能動提案エンジン: 人格・ナレッジ・タスク・時刻を読んで提案を生成
// ============================================================
import type { AppSettings, Persona, KnowledgeItem, Proposal } from '../types/identity';
import type { DailyHealth } from '../types/health';
import type { HealthAnomaly } from '../data/healthAnomaly';
import { v4 as uuidv4 } from 'uuid';
import { enqueueClaudeCall } from './apiQueue';

function getApiKey(settings: AppSettings): string {
  return import.meta.env.VITE_CLAUDE_API_KEY || settings.claudeApiKey || '';
}

function timeOfDay(): string {
  const h = new Date().getHours();
  if (h < 5) return '深夜';
  if (h < 11) return '朝';
  if (h < 14) return '昼';
  if (h < 18) return '午後';
  if (h < 22) return '夕方';
  return '夜';
}

const SYSTEM = `あなたはオーナーの**専属秘書 (Chief of Staff)** です。
オーナーの全人格・全資料・全数値・全タスクを把握しており、ブレインとして「今何をすべきか」を能動的に立案・提案します。

返答は**JSONのみ**(コードブロックなし、説明文なし)。スキーマ:
{
  "title": "戦略フォーカスの短い見出し (10-25文字、日本語)",
  "message": "本文 (3-5文。最初に**事業/財務/戦略の核心**を述べ、最後の1文だけで体調に簡潔に触れる。230文字以内)",
  "actions": ["具体的アクション1", "アクション2", ...] // 2-4項目、すべて事業推進・売上・意思決定に直結するもの。健康アクションは原則含めない
  "context": "この提案の根拠 (1文。どの資料・数値・タスクから導いたか)"
}

絶対ルール:
1. **ビジネス・戦略を最優先** に書く。蓄積資料の財務数値・KPI・契約・期日・顧客動向から直接的な打ち手を必ず1つ以上提示する。
2. **健康データは最後の1文に短く**。「睡眠不足なので午後に15分仮眠を」程度の事務的な一言で十分。健康をテーマの中心にしない。
3. アクションは事業推進系のみ (例: 「営業X社にリマインド」「決算B案を1時間で確定」「価格ページの改訂を発注」)。健康改善や瞑想などのアクションは含めない。
4. 数値・固有名詞・期日を必ず1つ以上含めて具体性を出す。「整理する」「考える」「振り返る」などの抽象語禁止。
5. 同じ角度を繰り返さない。直近提案を見て新しい論点で。
6. オーナーは複数人格 (会社/プロジェクト) を並行運用しているので、「どの人格に今リソースを割くべきか」「他人格との連動」も視野に。
7. 簡潔・断定的に。秘書は迷わない。`;

interface GenInput {
  persona: Persona;
  knowledge: KnowledgeItem[];
  recentProposals: Proposal[];
  health?: { today: DailyHealth | null; week: DailyHealth[]; anomalies: HealthAnomaly[] };
  /** 巡回モード: 'morning' | 'evening' | null (オンデマンド) */
  patrolMode?: 'morning' | 'evening' | null;
}

export async function generateProposal(
  settings: AppSettings,
  input: GenInput,
): Promise<Proposal> {
  const apiKey = getApiKey(settings);
  if (!apiKey) throw new Error('Claude APIキーが設定されていません');

  const { persona, knowledge, recentProposals, health, patrolMode } = input;

  // ナレッジサマリ (最新5件)
  const kbSummary = knowledge
    .slice(0, 5)
    .map(k => {
      const sum = k.analysis?.summary || k.content.slice(0, 200);
      const acts = k.analysis?.actions?.slice(0, 2).join(' / ') || '';
      return `- ${k.title}: ${sum}${acts ? ` [推奨: ${acts}]` : ''}`;
    })
    .join('\n') || '(まだ資料なし)';

  // 未完了タスク
  const openTasks = persona.tasks
    .filter(t => !t.done)
    .slice(0, 5)
    .map(t => `- [${t.priority}] ${t.title} (期限: ${t.due})`)
    .join('\n') || '(タスクなし)';

  // 直近の提案 (重複回避)
  const recent = recentProposals
    .slice(0, 3)
    .map(p => `- ${p.title}: ${p.message.slice(0, 60)}`)
    .join('\n') || '(初回)';

  // 健康データ
  let healthBlock = '';
  if (health?.today) {
    const t = health.today;
    const wk = health.week.filter(Boolean);
    const avg = (k: keyof DailyHealth) => {
      const vals = wk.map(d => Number(d[k] || 0)).filter(n => !Number.isNaN(n));
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };
    healthBlock = `
## 健康メトリクス (今日 / 直近7日平均)
- 睡眠: ${t.sleepHours.toFixed(1)}時間 (深${t.deepSleepMin}m, REM${t.remSleepMin}m, スコア${t.sleepScore}) / 平均${avg('sleepHours').toFixed(1)}h
- HRV: ${t.hrv}ms (平均${avg('hrv').toFixed(0)}ms), 安静時心拍 ${t.restingHR}bpm
- 回復スコア: ${t.recoveryScore}/100, ストレス: ${t.stressLevel}/100
- 活動: ${t.steps.toLocaleString()}歩, 運動${t.activeMinutes}分, ${t.exerciseKcal}kcal
- マインドフル: ${t.mindfulMinutes}分, 水分: ${t.hydrationL.toFixed(1)}L, カフェイン${t.caffeineMg}mg
${t.bp ? `- 血圧: ${t.bp.sys}/${t.bp.dia}` : ''}`;

    if (health.anomalies.length > 0) {
      healthBlock += '\n\n## 検出された異常\n' +
        health.anomalies.slice(0, 4).map(a => `- [${a.severity}] ${a.title}: ${a.detail}`).join('\n');
    }
  }

  // 巡回モード指示
  const patrolInstruction = patrolMode === 'morning'
    ? '\n\n## モード: 朝のブリーフ\n今日着手すべき**事業/財務/戦略の最重要1件**から書き起こす。健康は本文末尾の1文に留める。'
    : patrolMode === 'evening'
      ? '\n\n## モード: 夜のレビュー\n今日の事業・数値の進捗を踏まえ、明日朝イチで動かす**ビジネス上の1手**を確定する。健康は末尾1文。'
      : '';

  const userPrompt = `## 現在
- 時刻: ${new Date().toLocaleString('ja-JP')} (${timeOfDay()})
- アクティブ人格: ${persona.name} (${persona.subtitle})
- 人格の役割: ${persona.description || '(未設定)'}

## 未完了タスク
${openTasks}

## 蓄積ナレッジ
${kbSummary}

## 直近の提案 (重複させない)
${recent}
${healthBlock}${patrolInstruction}

あなたは "${persona.name}" の専属秘書として、今この瞬間に動かすべき**事業上の1手**を立案してください。
財務数値・KPI・蓄積資料・期日・顧客動向のいずれかを根拠に、具体的な打ち手を提示。
健康データは無視せず、本文末尾の1文だけで簡潔に触れる(中心テーマにしない)。`;

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
        model: settings.preferredModel,
        max_tokens: 800,
        system: SYSTEM,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `提案APIエラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';

  let parsed: Partial<Proposal> = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch {
    parsed = { title: '提案', message: text.slice(0, 200), actions: [], context: '' };
  }

  return {
    id: uuidv4(),
    personaId: persona.id,
    title: parsed.title || '提案',
    message: parsed.message || '',
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    context: parsed.context || '',
    generatedAt: new Date().toISOString(),
  };
}
