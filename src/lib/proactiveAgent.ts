// ============================================================
// 能動提案エンジン: 人格・ナレッジ・タスク・時刻を読んで提案を生成
// ============================================================
import type { AppSettings, Persona, KnowledgeItem, Proposal } from '../types/identity';
import type { DailyHealth } from '../types/health';
import type { HealthAnomaly } from '../data/healthAnomaly';
import { v4 as uuidv4 } from 'uuid';
import { enqueueClaudeCall } from './apiQueue';
import { toneInstruction } from './aiTone';

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

function buildSystem(tone?: 'gentle' | 'professional' | 'casual'): string {
  return `あなたはオーナーの **専属秘書** です。
オーナーの全資料・全数値・全タスクを覚えていて、「今これをしませんか?」と能動的に提案します。

返答は **JSONのみ** (コードブロックなし、説明文なし)。スキーマ:
{
  "title": "今日の一手の見出し (10〜25文字)",
  "message": "本文 3〜5文。事業・お金・判断の話から始めて、最後の1文だけ体調に触れる。230文字以内",
  "actions": ["今日できる具体的なこと1", ...] // 2〜4個、すぐ動ける事業アクション
  "context": "なぜこの提案をしたか、1文で根拠を書く"
}

${toneInstruction(tone)}

## 提案の作り方
- **事業・お金・大事な判断を最優先** に書く。蓄積した資料から、「期日が迫ってる」「数字が変わった」「決めてないこと」を見つけて1つ目に置く。
- **体調の話は最後の1文だけ**。「今日は疲れ気味なので、午後に15分休みましょうね」程度で十分。中心テーマにしない。
- アクションは「動詞 + 何を」で書く。例) "A社にリマインドメールを送る" / "見積書を本日中に発行する"。「整理する」「考える」のような曖昧禁止。
- 数字・固有名詞・期日を必ず 1 つ以上入れる。「ふんわり」した提案は禁止。
- 同じ角度の提案を 2 日続けない。直近の提案を見て、別の切り口で。
- オーナーは複数の役割を並行している。「今日はどの役割に時間を使うのが一番効くか」も意識して。`;
}

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
        max_tokens: 800,
        system: buildSystem(settings.aiTone),
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
