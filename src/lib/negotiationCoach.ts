// ============================================================
// AI 交渉コーチ — ロールプレイ + 評価フィードバック
// ============================================================
import type { AppSettings, Persona } from '../types/identity';

function getApiKey(s: AppSettings): string {
  return import.meta.env.VITE_CLAUDE_API_KEY || s.claudeApiKey || '';
}

export interface NegotiationScene {
  scenario: string;     // 「家賃の値下げ交渉」「給与アップ交渉」等
  counterpartRole: string; // 「大家」「人事責任者」等
  counterpartStance: string; // 「強気で動かない」「予算制約あり」等
  userGoal: string;     // 「月5,000円下げる」等
  context?: string;     // 追加コンテキスト
}

export interface NegoTurn {
  role: 'user' | 'counterpart' | 'coach';
  content: string;
  timestamp: string;
}

export interface NegoEvaluation {
  overall: number;        // 0-100
  strengths: string[];
  improvements: string[];
  specificFeedback: { quote: string; suggestion: string }[];
  alternativeApproaches: string[];
  outcome: 'win' | 'partial' | 'loss' | 'in-progress';
}

export const NEGO_PRESETS: Array<{ id: string; emoji: string; title: string; scene: NegotiationScene }> = [
  {
    id: 'rent',
    emoji: '🏠',
    title: '家賃値下げ交渉',
    scene: {
      scenario: '長く住んでいる賃貸物件で、家賃の値下げを大家に交渉する',
      counterpartRole: '物件の大家 / 管理会社の担当者',
      counterpartStance: 'できるだけ収益を維持したい。ただし長期入居者を失うのは避けたい。',
      userGoal: '月額3,000-5,000円の値下げ、または更新料の免除',
    },
  },
  {
    id: 'salary',
    emoji: '💰',
    title: '給与アップ交渉',
    scene: {
      scenario: '直属の上司に対し、給与アップを直接打診する',
      counterpartRole: '直属の上司 / 人事責任者',
      counterpartStance: '予算は限られている。実績ある社員は引き留めたいが、即断はしない。',
      userGoal: '月給を10万円アップ (年収+120万)',
    },
  },
  {
    id: 'contract',
    emoji: '📜',
    title: '業務委託料の値上げ交渉',
    scene: {
      scenario: 'クライアントに対し、業務委託料の値上げを打診する',
      counterpartRole: '長期取引クライアントの担当者',
      counterpartStance: '予算管理が厳しく、値上げには慎重。ただし他社に切り替えるリスクは認識している。',
      userGoal: '20%の値上げ、または契約条件の改善',
    },
  },
  {
    id: 'vendor',
    emoji: '📦',
    title: '仕入れ価格の値下げ交渉',
    scene: {
      scenario: 'サプライヤーに対し、仕入れ単価の値下げを打診する',
      counterpartRole: 'サプライヤーの営業担当',
      counterpartStance: 'マージンは既に薄い。ボリュームディスカウントには応じる余地あり。',
      userGoal: '単価10%値下げ、または支払条件の改善',
    },
  },
  {
    id: 'investor',
    emoji: '💼',
    title: '投資家との条件交渉',
    scene: {
      scenario: 'シードラウンドの投資条件を VC と交渉する',
      counterpartRole: 'VC のパートナー',
      counterpartStance: 'バリュエーションは押さえ、優先株+希薄化防止条項を取りたい。',
      userGoal: 'バリュエーション維持と希薄化防止条項の緩和',
    },
  },
];

const COUNTERPART_SYS = (scene: NegotiationScene) => `あなたは交渉相手のロールプレイをします。

## あなたの役割
${scene.counterpartRole}

## あなたのスタンス
${scene.counterpartStance}

## 状況
${scene.scenario}

## あなたが交渉される側
ユーザーは「${scene.userGoal}」を求めて交渉してきます。

## 行動指針
- 一方的に譲歩しない。リアルなビジネス交渉の相手として振る舞う
- 現実的なプッシュバック (代替案・断る理由・別条件) を提示
- ユーザーが説得力ある根拠を出してきた場合は徐々に妥協
- 1-3 文で簡潔に応答 (長セリフを避ける)
- 必要なら質問返しもする
- 交渉は5-8ターンで一定の決着に近づける
- 必ず日本語で応答`;

const COACH_SYS = (scene: NegotiationScene) => `あなたは交渉コーチです。
ユーザーの交渉ロールプレイを観察し、最後にフィードバックします。

返答は**JSONのみ**(コードブロック・説明文なし):
{
  "overall": 0-100 のスコア,
  "strengths": ["強み1", "強み2", ...] // 2-4項目
  "improvements": ["改善点1", "改善点2", ...] // 2-4項目
  "specificFeedback": [
    { "quote": "ユーザーの実際の発言", "suggestion": "より良かった言い方" }
  ] // 2-4項目
  "alternativeApproaches": ["別の戦術1", "別の戦術2"] // 1-3項目
  "outcome": "win" | "partial" | "loss" | "in-progress"
}

評価軸:
- 根拠の説得力 (データ・実績・市場相場)
- 質問の質 (相手の状況把握)
- BATNA / オプションの提示
- 感情コントロール / 関係性維持
- ゴール達成度 (${scene.userGoal})

すべて日本語、具体的・建設的に`;

export async function counterpartReply(
  settings: AppSettings,
  _persona: Persona,
  scene: NegotiationScene,
  history: NegoTurn[],
): Promise<string> {
  const apiKey = getApiKey(settings);
  if (!apiKey) throw new Error('Claude APIキーが設定されていません');

  const messages = history
    .filter(t => t.role !== 'coach')
    .map(t => ({
      role: t.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: t.content,
    }));

  // 最初のターンの場合、相手から状況的な口火を切る
  if (messages.length === 0) {
    return await callClaude(settings, COUNTERPART_SYS(scene),
      [{ role: 'user', content: '挨拶から交渉を始めてください。短く自然に切り出してください。' }]);
  }

  return await callClaude(settings, COUNTERPART_SYS(scene), messages);
}

export async function evaluateNegotiation(
  settings: AppSettings,
  scene: NegotiationScene,
  history: NegoTurn[],
): Promise<NegoEvaluation> {
  const apiKey = getApiKey(settings);
  if (!apiKey) throw new Error('Claude APIキーが設定されていません');

  const transcript = history
    .filter(t => t.role !== 'coach')
    .map(t => `${t.role === 'user' ? 'ユーザー' : '相手'}: ${t.content}`)
    .join('\n');

  const text = await callClaude(settings, COACH_SYS(scene), [{
    role: 'user', content: `## 交渉ログ\n${transcript}\n\nこの交渉を評価して JSON を返してください。`
  }]);

  try {
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    return {
      overall: Number(parsed.overall) || 0,
      strengths: parsed.strengths || [],
      improvements: parsed.improvements || [],
      specificFeedback: parsed.specificFeedback || [],
      alternativeApproaches: parsed.alternativeApproaches || [],
      outcome: parsed.outcome || 'in-progress',
    };
  } catch {
    return {
      overall: 0,
      strengths: [],
      improvements: [text.slice(0, 200)],
      specificFeedback: [],
      alternativeApproaches: [],
      outcome: 'in-progress',
    };
  }
}

async function callClaude(settings: AppSettings, system: string, messages: Array<{ role: string; content: string }>): Promise<string> {
  const apiKey = getApiKey(settings);
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
      max_tokens: 1024,
      system,
      messages,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `API エラー: ${res.status}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}
