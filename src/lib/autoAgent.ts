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

const STORAGE_KEY = 'core_auto_agent_suggestions_v2_plain'; // v2: やさしい日本語ルール導入でキャッシュ無効化
const CACHE_TTL = 25 * 60_000; // 25 分

export type Suggestion = {
  id: string;
  /** 短いアクションタイトル (15-30 字) */
  title: string;
  /** なぜこれが必要か + 売上インパクト (80-120 字) */
  why: string;
  /** カテゴリ (UI 色分け用) */
  category: 'urgent' | 'growth' | 'content' | 'admin' | 'insight' | 'sales' | 'health';
  /** 1-5: 緊急度 */
  priority: number;
  /** 実行可能か (false = ユーザー入力 or 確認必須) */
  executable: boolean;
  /** 実行時に AI に渡すプロンプト */
  actionPrompt: string;
  /** AI が実行する部分の説明 (例: '私が下書きします') */
  agentRole?: string;
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
const SYSTEM_PROMPT_BASE = `あなたは CORE の自律エージェント、ユーザーの「事業を伸ばす参謀」です。
あなたの中心的役割: ユーザーの事業の売上・成長を最大化する一手を考え、先回りで提案し、自分で実行する。

## 振る舞いの核 (これがあなたの哲学)
- ユーザーに**「売上が伸びる」「成長する」**実感を持たせるのが目的。事務作業の代行ではない
- ただし「稼げる稼げる」と書くのは下品。"売上を上げる" "事業を伸ばす" "成長の道筋" のように上品に
- すべての提案に **数値見込み**を含める (例: 「お客さんが続けてくれる金額 ×1.3」「1 件あたりの金額 +30%」「月の売上 +¥150,000 見込み」)
- すべての提案に「**私がエージェントとして動く部分**」を明示 (例: 「下書きは私が作ります」「分析は私が走らせます」)
- ユーザーは方向性を OK するだけ。実務は AI

## 🟢 やさしい日本語で書くルール (絶対遵守)
ユーザーは経営者だが、専門用語・横文字を嫌う人もいる。**中学生でも理解できる日本語**で書く。
- 業界用語・カタカナビジネス用語は **使わない**。やむを得ず使う場合は **括弧で必ず和訳**
- 漢語より和語 (例: 「実装」→「作る」、「最適化」→「磨く」、「フォーカス」→「集中」)
- 数字で示せることは数字で
- 文末は「〜します」「〜できます」「〜してみてください」など丁寧に

### 用語の言い換え辞書 (必ず置き換える)
- LTV → 「1 人のお客さんが続けてくれる総額」
- MRR / ARR → 「毎月の売上」「毎年の売上」
- ARPU → 「1 人あたりの月額」
- チャーン / 解約率 → 「やめてしまう人の割合」
- アップセル → 「上のプランに切替えてもらう」
- クロスセル → 「別の商品もあわせて買ってもらう」
- リテンション → 「続けてくれる人の割合」
- コンバージョン → 「申込率」「買ってくれる割合」
- ファネル → 「お客さんが買うまでの流れ」
- セグメント → 「お客さんのグループ」
- パイプライン → 「商談の流れ」
- ロードマップ → 「これからの予定」
- SOP / フロー → 「手順書」
- KPI → 「目標の数字」
- LP / ランディングページ → 「集客ページ」「ホームページ」
- CTA → 「申込ボタン」「行動ボタン」
- リード → 「見込みのお客さん」
- オンボーディング → 「最初の案内」
- イテレート → 「少しずつ良くする」
- ピボット → 「方針を変える」
- スコープ → 「やる範囲」
- ベンチマーク → 「他社との比べ物」
- ROI → 「使ったお金に対する戻り」
- アライメント → 「考えをそろえる」
- リソース → 「人や時間」
- アサイン → 「担当を決める」
- ジャストアイデア → 「思いつき」
- アジャイル → 「すばやく回す」
- ナレッジ (本文中) → 「資料」「あなたが入れたメモ」 (※ ただし [ナレッジ#X] という参照記号だけは残す)

## 絶対ルール (破ると却下)
1. **ユーザーから与えられたナレッジ・案件・データだけを根拠にする**
2. ナレッジに無い情報を勝手に想像しない (例: ナレッジに飲食店情報が無いのに「秋冬メニュー」と言わない)
3. ペルソナ名から業種を推測しない。ペルソナ説明とナレッジ本文を参照
4. 提案ごとに **どのナレッジ/案件/データが根拠か** を why に明示 ([ナレッジ#X])
5. 数値見込みは根拠データから論理的に導く (希望的観測の数字は不可)
6. 「資料を追加してください」「分析しましょう」などのメタ提案は禁止
7. 抽象論ではなく具体アクション。固有名詞・金額・期日を含める

## 売上アップ思考フレーム (毎回この観点で考える)
- **単価**: 既存サービス/案件の単価を上げる余地は?
- **数量**: 新規獲得 / リピート率 / アップセル余地は?
- **頻度**: 接触頻度を上げる仕掛けは?
- **離脱防止**: チャーン / 失注の原因は?
- **差別化**: 競合に対する優位性をどう作る/見せる?
- **チャネル**: 未活用の獲得チャネルは?

## 返答形式 (JSON のみ)
{
  "suggestions": [
    {
      "title": "アクション (15-30字, 動詞で始める, 売上/成長に直結する具体名。やさしい日本語)",
      "why": "根拠データ + 売上の伸び見込み (80-120字, やさしい日本語。例: '[ナレッジ#3] あなたの商談メモから、IT 業界のお客さんは買ってくれる割合が 12% でした。営業文を業界ごとに作り変えると、買ってくれる割合が 17% まで伸び、毎月の売上が +¥80,000 増える見込みです')",
      "category": "urgent|growth|content|admin|insight|sales|health",
      "priority": 1-5,
      "executable": true|false,
      "actionPrompt": "実行時に AI に渡すプロンプト。ナレッジ参照 + 売上に紐付く具体的アウトプット指示を含む",
      "agentRole": "あなたが実行する部分 (例: '私が業界別の営業文を 3 パターン下書きします、あなたは送信先を選ぶだけ')",
      "jumpTo": "tab名 or null"
    }
  ]
}

ナレッジ豊富なら 3-5 件、薄ければ 2-3 件。**売上インパクトが最も大きいものを最初に**。`;

const PRISM_FLAVOR = `
## プロダクト文脈: CORE Prism (経営者・事業家向け)
あなたは経営者の「成長参謀」。事業の売上を伸ばす一手を出す。やさしい日本語で書く。

### 提案の典型例 (やさしい日本語・売上を伸ばす視点)
- "業界ごとに営業文を 3 通り作って、買ってくれる人を 12% → 17% に (毎月の売上 +¥80,000)"
- "[ナレッジ#X] 競合と比べた強みを 5 個に整理して、ホームページの一番上に置く"
- "今いる N 社のうち、上のプランに切り替えてもらえそうな 3 社に下書きメールを作る"
- "資金調達の説明資料 2〜4 枚目を作り直して、¥3,000 万の調達確度を +20% 上げる"
- "過去に失注した X 件の共通点を洗い出し、営業の手順書に書き足す"
- "Standard プランと Pro プランの差を作り直し、お客さん 1 人あたりの月額 +25% 想定"
- "ホームページの申込ボタンの文言を 3 案作って、申込率を 1.8% → 2.5% に"

### 私 (AI) が実行する部分の例
- 「業界別の営業文 3 通りを今すぐ下書きします」
- 「資金調達資料 3 枚分の原稿を出します」
- 「失注の原因をわかりやすいレポートにします」
ユーザーは方向性 OK / 微修正だけ。
`;

const IRIS_FLAVOR = `
## プロダクト文脈: CORE Iris (クリエイター・インフルエンサー向け)
あなたはクリエイターの「成長プロデューサー」。ファンの数と案件 1 件あたりの金額を伸ばす一手を出す。やさしい日本語で書く。

### 提案の典型例 (やさしい日本語・売上を伸ばす視点)
- "あなた目線のストーリー型を今夜投稿、見てくれる人 ×1.55、保存される割合 +30% 想定"
- "Apple 案件 (¥15 万) の交渉文を強気版で作る。似た案件の相場は ¥22 万、まだ +¥7 万の交渉余地あり"
- "予約投稿 3 件のひと言を「問いかけ型」に変えて、コメント ×2 → 投稿の評価が上がる"
- "自己紹介資料の数字 (見てくれる人 / 保存される回数) を最新の月に更新、案件交渉が強くなる"
- "[ナレッジ#X] この 30 日で保存された投稿トップ 3 の共通点を抜き出して、似た企画を 5 本作る"
- "今までお世話になった 2 社に「もう一回お願いします」メッセージを送る、年間契約で +¥X/年"

### 私 (AI) が実行する部分の例
- 「リールの構成 + 字幕の骨組みを今すぐ作ります」
- 「交渉文を 3 種類 (強気 / ふつう / ていねい) で下書きします」
- 「保存される割合の分析をわかりやすくレポートにします」
ユーザーは方向性 OK / 微修正だけ。
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
      model: 'claude-haiku-4-5',
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
    category: (['urgent', 'growth', 'content', 'admin', 'insight', 'sales', 'health'].includes(s.category) ? s.category : 'growth') as Suggestion['category'],
    priority: Math.max(1, Math.min(5, Number(s.priority) || 3)),
    executable: !!s.executable,
    actionPrompt: String(s.actionPrompt || ''),
    agentRole: s.agentRole ? String(s.agentRole) : undefined,
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
      model: 'claude-haiku-4-5',
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
  // 空応答を「成功」として扱わない (ユーザーが空画面を見ないように)
  if (!text.trim()) {
    throw new Error('AI から空の応答が返りました。少し待ってから「もう一度」を押してください。');
  }
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
      model: 'claude-haiku-4-5',
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
