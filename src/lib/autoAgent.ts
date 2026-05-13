// ============================================================
// CORE Auto Agent — 自律提案エンジン
//
// 哲学:
// - ユーザーはフォームを埋めない、選ぶだけ
// - AI が状況を見て先回りで「これをやりましょうか?」を提案
// - ユーザーは「やる」「直す」「却下」で答えるだけ
// - 「やる」→ AI が裏で実行 → 結果を見せる
// - 営業も、解決も、AI が動く。ユーザーは方向性を示すだけ
// ============================================================

const STORAGE_KEY = 'core_auto_agent_suggestions_v1';
const CACHE_TTL = 25 * 60_000; // 25 分

export type Suggestion = {
  id: string;
  /** 短いアクションタイトル (15-30 字) */
  title: string;
  /** なぜこれが必要か (40-80 字) */
  why: string;
  /** カテゴリ (UI 色分け用) */
  category: 'urgent' | 'growth' | 'content' | 'admin' | 'insight' | 'sales' | 'health';
  /** 1-5: 緊急度 */
  priority: number;
  /** 実行可能か (false = ユーザー入力 or 確認必須) */
  executable: boolean;
  /** 実行時に AI に渡すプロンプト */
  actionPrompt: string;
  /** 実行結果 (text or markdown) */
  result?: string;
  /** 実行先 (どの画面/タブに飛ばすか・任意) */
  jumpTo?: string;
  status: 'idle' | 'running' | 'done' | 'refined' | 'dismissed';
  createdAt: string;
};

export type AgentContext = {
  brand: 'prism' | 'iris';
  /** ユーザー名 / handle */
  user?: string;
  /** ペルソナ (Prism: アクティブペルソナ / Iris: media kit handle) */
  persona?: string;
  /** 時刻 */
  now: Date;
  /** Bond / 個人プロフィール */
  bondContext?: string;
  /** 最近の活動サマリ (caller が文字列化) */
  recent?: string;
  /** 案件状況 (Iris) */
  deals?: string;
  /** 投稿予約状況 (Iris) */
  postQueue?: string;
  /** ナレッジ要約 (Prism) */
  knowledge?: string;
  /** KPI / 戦略状況 (両方) */
  kpis?: string;
  /** ヘルスデータ (両方) */
  health?: string;
};

// ─── AI に提案を生成させる ─────
const SYSTEM_PROMPT_BASE = `あなたは CORE の自律エージェントです。
あなたの役割: ユーザーに代わって考え、先回りで「やるべきこと」を提案し、許可があれば実行する。

## 絶対ルール (これを破ると提案は却下される)
1. **ユーザーから与えられたナレッジ・案件・データだけを根拠にする**
2. ナレッジに無い情報を勝手に想像しない (例: ナレッジに飲食店の情報が無いのに「秋冬メニュー」と言わない)
3. ペルソナ名から業種を推測して提案を作らない。ペルソナ説明とナレッジ本文を参照する
4. 提案ごとに **どのナレッジ/案件/データが根拠か** を why の中で明示 (例: 「ナレッジ#3 の商標調査メモから」)
5. データが薄い場合は「データから読める範囲」で 2-3 件だけ提案。無理に 5 件作らない
6. 「資料を追加してください」「分析しましょう」など抽象的なメタ提案は禁止

## 振る舞いルール
- ユーザーにフォームを埋めさせない
- 「〜しましょうか」「〜を用意しました」と能動的に
- 1 つ提案するごとに「なぜ今これか + どのデータが根拠か」を 1-2 行で
- ユーザーは Yes/No/もう少しこっち寄りで で答えるだけ
- 抽象論ではなく、具体的なアクション (例: "ナレッジ#5 の競合分析から、Notion 動向への対策メモを書く" ✓ / "競合を分析する" ✗)

## 返答形式 (JSON のみ)
{
  "suggestions": [
    {
      "title": "アクション (15-30字, 動詞で始める, 具体的な固有名詞を含める)",
      "why": "根拠のデータ + 今これが必要な理由 (60-100字, 例: 'ナレッジ#3 商標調査メモに保有予定 3 件あり、Q3 調達に間に合わせるなら今月中の出願が必要')",
      "category": "urgent|growth|content|admin|insight|sales|health",
      "priority": 1-5,
      "executable": true|false,
      "actionPrompt": "実行時に AI に渡すプロンプト (具体的・自己完結・ナレッジ参照を含む)",
      "jumpTo": "tab名 or null"
    }
  ]
}

ナレッジが豊富なら 3-5 件、薄ければ 2-3 件。最も根拠が明確で今すぐやるべきものを最初に。`;

const PRISM_FLAVOR = `
## プロダクト文脈: CORE Prism (経営者・事業家向け)
- 7 つの人格 (ペルソナ) を使い分けるユーザー
- アクション例:
  - "新規ナレッジの分析レポートを作る"
  - "Apple ペルソナ用の今日のタスク 3 つを生成"
  - "投資家向けピッチを下書きする"
  - "競合 X の最新動向をまとめる"
  - "営業メール下書きを作る"
  - "戦略ピボットを評価する"
`;

const IRIS_FLAVOR = `
## プロダクト文脈: CORE Iris (クリエイター・インフルエンサー向け)
- リール / 投稿 / 案件 / ブランディング / コミュニティ / 収益 の 6 つを統合
- アクション例:
  - "今夜投稿用のリール『POV ストーリー』を構成する"
  - "Apple 案件の返信下書きを作る"
  - "予約投稿 3 件を Instagram 用にキャプション最終化"
  - "今月の伸びてる投稿パターン分析"
  - "美容相談: 今日のスキンケア提案"
  - "メディアキットを最新の数字で更新"
`;

/** 簡易ハッシュ: ナレッジが変わったらキャッシュ無効化 */
function ctxHash(ctx: AgentContext): string {
  const s = [
    ctx.persona || '', ctx.bondContext || '',
    ctx.knowledge || '', ctx.deals || '', ctx.postQueue || '',
    ctx.kpis || '', ctx.health || '',
  ].join('|');
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return Math.abs(h).toString(36);
}

export async function generateSuggestions(ctx: AgentContext): Promise<Suggestion[]> {
  const hash = ctxHash(ctx);
  const cacheKey = STORAGE_KEY + ':' + ctx.brand + ':' + hash;
  // キャッシュ確認 (ナレッジ変更時は別キーで fresh)
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    if (cached && Date.now() - new Date(cached.cachedAt).getTime() < CACHE_TTL) {
      return cached.suggestions;
    }
  } catch {/* */}

  const system = SYSTEM_PROMPT_BASE + (ctx.brand === 'prism' ? PRISM_FLAVOR : IRIS_FLAVOR);

  const hour = ctx.now.getHours();
  const timeContext = hour < 5 ? '深夜' : hour < 10 ? '朝' : hour < 14 ? '昼' : hour < 18 ? '夕方' : hour < 22 ? '夜' : '深夜';

  const hasKnowledge = !!(ctx.knowledge || ctx.deals || ctx.postQueue || ctx.bondContext);
  const userMsg = `
## 現在
- 時刻: ${ctx.now.toLocaleString('ja-JP')} (${timeContext})
- ユーザー: ${ctx.user || '(匿名)'} ${ctx.persona ? ` / ペルソナ: ${ctx.persona}` : ''}

${ctx.bondContext ? `## あなたが知ってる本人について\n${ctx.bondContext}\n` : ''}
${ctx.recent ? `## 最近の活動\n${ctx.recent}\n` : ''}
${ctx.deals ? `## 案件状況\n${ctx.deals}\n` : ''}
${ctx.postQueue ? `## 投稿予約\n${ctx.postQueue}\n` : ''}
${ctx.knowledge ? `## ナレッジ (ユーザーが与えた資料・メモ・分析結果)\n${ctx.knowledge}\n` : ''}
${ctx.kpis ? `## KPI\n${ctx.kpis}\n` : ''}
${ctx.health ? `## ヘルス\n${ctx.health}\n` : ''}

${hasKnowledge
  ? '上記のナレッジ / 案件 / データを **唯一の根拠** として、論理的に「次の一手」を提案してください。それ以外の情報 (業界の常識・憶測) を入れない。各提案に [ナレッジ#X] または該当データへの参照を必ず含める。'
  : 'まだ何もデータが無い状態です。「資料をアップロード」「最初の案件を登録」など、ユーザーが最初に行うべき設定アクションを 2-3 件だけ提案してください。'}
JSON で返答。`;

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      messages: [{ role: 'user', content: userMsg }],
      system,
      max_tokens: 1600,
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => null);
    throw new Error(e?.error?.message || `Agent API ${res.status}`);
  }
  const data = await res.json();
  const text: string =
    (Array.isArray(data.content) ? data.content[0]?.text : '') ||
    data.text || data.message || '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI が JSON で返答しませんでした');
  const j = JSON.parse(m[0]);
  const list = Array.isArray(j.suggestions) ? j.suggestions : [];

  const suggestions: Suggestion[] = list.map((s: any, i: number) => ({
    id: 's_' + Math.random().toString(36).slice(2, 9) + i,
    title: String(s.title || ''),
    why: String(s.why || ''),
    category: (['urgent', 'growth', 'content', 'admin', 'insight', 'sales', 'health'].includes(s.category) ? s.category : 'admin') as Suggestion['category'],
    priority: Math.max(1, Math.min(5, Number(s.priority) || 3)),
    executable: !!s.executable,
    actionPrompt: String(s.actionPrompt || ''),
    jumpTo: s.jumpTo && typeof s.jumpTo === 'string' ? s.jumpTo : undefined,
    status: 'idle',
    createdAt: new Date().toISOString(),
  }));

  // キャッシュ (ハッシュ別キー)
  try {
    localStorage.setItem(cacheKey, JSON.stringify({
      cachedAt: new Date().toISOString(),
      suggestions,
    }));
  } catch {/* */}

  return suggestions;
}

// ─── 提案を実行 ─────
export async function executeSuggestion(s: Suggestion, ctx: AgentContext): Promise<string> {
  const system = `あなたは CORE ${ctx.brand === 'prism' ? 'Prism (経営者向け)' : 'Iris (クリエイター向け)'} の実行エージェント。
ユーザーから許可を得て、提案を実行している段階です。

## 絶対ルール
1. ユーザーから与えられたナレッジ・案件・データだけを根拠にする
2. ナレッジに無い情報を勝手に作らない
3. 一般論や業界の常識ではなく、具体的にナレッジ#X から引いて書く
4. 数字を出すときは根拠データを明示

## 出力
- 前置きや謝辞は不要。実行結果のみ
- Markdown で構造化、すぐコピペで使える形に
- 該当する箇所に [ナレッジ#X より] のような出典を含める

## ユーザー文脈
${ctx.bondContext || ''}
${ctx.persona ? `ペルソナ: ${ctx.persona}` : ''}

${ctx.knowledge ? `## 参照可能なナレッジ\n${ctx.knowledge}\n` : ''}
${ctx.deals ? `## 案件状況\n${ctx.deals}\n` : ''}
${ctx.kpis ? `## KPI\n${ctx.kpis}\n` : ''}`;

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ai-weight': 'heavy' },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      messages: [{ role: 'user', content: s.actionPrompt }],
      system,
      max_tokens: 2200,
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => null);
    throw new Error(e?.error?.message || `Exec API ${res.status}`);
  }
  const data = await res.json();
  const text: string =
    (Array.isArray(data.content) ? data.content[0]?.text : '') ||
    data.text || data.message || '';
  return text;
}

// ─── 提案を精錬 (ユーザーが「もう少しこっち寄りで」した時) ─────
export async function refineSuggestion(s: Suggestion, refinement: string, ctx: AgentContext): Promise<Partial<Suggestion>> {
  const system = `あなたは CORE の自律エージェント。
元の提案: ${s.title} (${s.why})
ユーザーからの方向修正: ${refinement}

修正版の提案を JSON で 1 件返してください:
{
  "title": "...",
  "why": "...",
  "actionPrompt": "..."
}`;

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      messages: [{ role: 'user', content: refinement }],
      system,
      max_tokens: 600,
    }),
  });
  if (!res.ok) throw new Error(`Refine ${res.status}`);
  const data = await res.json();
  const text: string = (Array.isArray(data.content) ? data.content[0]?.text : '') || data.text || data.message || '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Refine: JSON 無し');
  return JSON.parse(m[0]);
  void ctx;
}

export function clearSuggestionCache(brand: 'prism' | 'iris') {
  // 全てのハッシュキーを削除 (再生成強制)
  try {
    const prefix = STORAGE_KEY + ':' + brand;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch {/* */}
}
