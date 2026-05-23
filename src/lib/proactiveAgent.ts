// ============================================================
// 能動提案エンジン: 人格・ナレッジ・タスク・時刻を読んで提案を生成
// ============================================================
import type { AppSettings, Persona, KnowledgeItem, Proposal } from '../types/identity';
import type { DailyHealth } from '../types/health';
import type { HealthAnomaly } from '../data/healthAnomaly';
import { v4 as uuidv4 } from 'uuid';
import { enqueueClaudeCall } from './apiQueue';
import { toneInstruction } from './aiTone';
import { buildIndustryContext } from '../prism/industryPacks';

// API キーは main.tsx の interceptor が localStorage から自動付与

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

## 🟢 やさしい日本語で書くルール (絶対遵守)
中学生でも読める言葉で書く。専門用語・横文字は使わない。やむを得ず使う場合は括弧で和訳。
- LTV / MRR / ARPU / チャーン / アップセル / KPI / LP / CTA / ファネル / セグメント / リテンション / コンバージョン / SOP / ROI / ピボット / リソース / アサイン などは **すべて言い換える**
- 例: 「毎月の売上」「やめてしまう人の割合」「上のプランへの切替」「目標の数字」「集客ページ」「申込ボタン」「お客さんの流れ」「お客さんのグループ」「続けてくれる割合」「申込率」「手順書」「使ったお金に対する戻り」「方針を変える」「人や時間」「担当を決める」
- 「メトリクス」→「数字」、「ステークホルダー」→「関係する人」、「インサイト」→「気づき」
- 文末は丁寧 (〜します / 〜できます / 〜してみてください)
- 数字で示せることはすべて数字で

返答は **JSON のみ** (コードブロックなし、説明文なし)。スキーマ:
{
  "title": "今日の一手の見出し (10〜25 文字、やさしい日本語)",
  "message": "本文 3〜5 文。事業・お金・判断の話から始めて、最後の 1 文だけ体調に触れる。230 文字以内。やさしい日本語。",
  "actions": ["今日できる具体的なこと 1", ...] // 2〜4 個、すぐ動ける事業アクション (やさしい日本語)
  "context": "なぜこの提案をしたか、1 文で根拠を書く (やさしい日本語)"
}

${toneInstruction(tone)}

## 提案の作り方
- **事業・お金・大事な判断を最優先** に書く。蓄積した資料から、「期日が迫ってる」「数字が変わった」「決めてないこと」を見つけて 1 つ目に置く。
- **体調の話は最後の 1 文だけ**。「今日は疲れ気味なので、午後に 15 分休みましょうね」程度で十分。中心テーマにしない。
- アクションは「動詞 + 何を」で書く。例) "A 社にお知らせメールを送る" / "見積書を今日中に出す"。「整理する」「考える」のような曖昧禁止。
- 数字・固有名詞・期日を必ず 1 つ以上入れる。「ふんわり」した提案は禁止。
- 同じ角度の提案を 2 日続けない。直近の提案を見て、別の切り口で。
- オーナーは複数の役割を並行している。「今日はどの役割に時間を使うのが一番効くか」も意識して。
- やさしい日本語で書く。専門用語を見つけたら必ず言い換える。`;
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

  const industryBlock = buildIndustryContext(settings.industry);

  const userPrompt = `${industryBlock ? industryBlock + '\n' : ''}## 現在
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
