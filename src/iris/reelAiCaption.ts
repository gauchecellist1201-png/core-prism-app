// ============================================================
// IRIS ▸ Reel AI Caption (per-cut Vision → context → captions)
//
// 役割:
//   1) 各クリップ (画像 or 動画) からフレームを抽出 → base64 JPEG
//   2) /api/ai (Gemini Vision multimodal) に投げて
//        - 1〜2行の "context per cut" (何が映っているか)
//        - 8〜15字の "overlay text" (各クリップに重ねる短文字幕)
//        - リール全体の caption (Instagram 本文)
//        - 10〜15 個の hashtags
//      を一括生成 (1 リクエスト)
//   3) 失敗時は復旧手段付きエラーを投げる
//
// なぜ 1 リクエストか:
//   - カット毎に AI 呼ぶと無料枠を食い潰す
//   - 全カットを並べて見せた方が全体の文脈が読める
//   - 並列ではなく 1 マルチモーダルリクエストでまとめる
// ============================================================

/** カット毎の BGM ジャンル候補。アップ/しっとり/ポップ/エモ の 4 種 */
export type BgmMood = 'up' | 'soft' | 'pop' | 'emo';

export const BGM_MOOD_DEFS: { id: BgmMood; label: string; bpm: number; desc: string }[] = [
  { id: 'up',   label: 'アップ',   bpm: 128, desc: '一気に上げる元気系' },
  { id: 'soft', label: 'しっとり', bpm: 72,  desc: '余韻を残す穏やかさ' },
  { id: 'pop',  label: 'ポップ',   bpm: 110, desc: '明るく軽やか' },
  { id: 'emo',  label: 'エモ',     bpm: 88,  desc: '感情を揺さぶる切なさ' },
];

export interface CutInsight {
  index: number;
  context: string;        // "朝の鏡前。寝起きの素肌のクローズアップ"
  overlayText: string;    // 8〜15字。実際に動画に重なる字幕
  bgmMood?: BgmMood;      // カット毎におすすめの BGM ジャンル
  emojis?: string[];      // カットに合う絵文字候補 (3〜5 個)
}

export interface ReelAiResult {
  cuts: CutInsight[];
  caption: string;        // Instagram 投稿本文 (改行込み)
  hashtags: string[];     // ["#美容", "#朝活", …]
  themeGuess: string;     // AI が読み取ったリール全体のテーマ
  /** Instagram Story 用の短い文 (1〜2 行、絵文字込み) */
  storyText?: string;
  /** 最初の1行（フック）の別案。タップで caption の冒頭1行を差し替えられる */
  hookOptions?: string[];
}

export interface CutInput {
  kind: 'image' | 'video';
  el: HTMLImageElement | HTMLVideoElement;
  duration: number;
}

// ─── フレーム抽出 (動画は真ん中の 1 フレーム / 画像はそのまま) ─────
async function extractFrameJpeg(input: CutInput, maxSide = 512): Promise<{ data: string; mimeType: string }> {
  const { el, kind, duration } = input;
  const srcW = kind === 'video' ? (el as HTMLVideoElement).videoWidth : (el as HTMLImageElement).naturalWidth;
  const srcH = kind === 'video' ? (el as HTMLVideoElement).videoHeight : (el as HTMLImageElement).naturalHeight;
  if (!srcW || !srcH) throw new Error('クリップのサイズが取得できませんでした');

  // 動画は中央フレームに移動
  if (kind === 'video') {
    const v = el as HTMLVideoElement;
    const target = Math.min(Math.max(duration / 2, 0.1), (v.duration || 1) - 0.05);
    await new Promise<void>((resolve) => {
      let done = false;
      const onSeek = () => { if (!done) { done = true; v.removeEventListener('seeked', onSeek); resolve(); } };
      v.addEventListener('seeked', onSeek);
      try { v.currentTime = target; } catch { onSeek(); }
      setTimeout(() => { if (!done) { done = true; v.removeEventListener('seeked', onSeek); resolve(); } }, 1200);
    });
  }

  // 縮小キャンバスに描画 (max 512px 長辺) — トークン節約
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const dw = Math.max(1, Math.round(srcW * scale));
  const dh = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = dw; canvas.height = dh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas が使えませんでした');
  ctx.drawImage(el, 0, 0, dw, dh);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
  const [, b64] = dataUrl.split(',');
  return { data: b64, mimeType: 'image/jpeg' };
}

// ─── プロンプト ─────
function buildSystemPrompt(): string {
  return `あなたはインフルエンサー向けの縦型ショート動画 (Instagram Reels / TikTok) の編集アシスタント。
複数の動画/画像クリップを順番に見て、リール全体のテーマを掴み、各カットに重ねる短文字幕・BGM ジャンル・絵文字・投稿本文を作る。

返答は JSON のみ。前後に説明文を一切入れない:
{
  "themeGuess": "リール全体を貫くテーマを 1 行で",
  "cuts": [
    {
      "index": 0,
      "context": "そのカットに映っている内容を 1〜2 行で具体的に",
      "overlayText": "8〜15字の短い字幕 (動画に重ねる)",
      "bgmMood": "up | soft | pop | emo のいずれか",
      "emojis": ["✨", "🌸", "💫"]
    }
  ],
  "caption": "Instagram 投稿本文。改行を活用、絵文字は適度、3〜6 行",
  "hookOptions": ["最初の1行の別案A", "別案B", "別案C"],
  "hashtags": ["#タグ1", "#タグ2"],
  "storyText": "Instagram Story に貼り付けやすい短いコピー (1〜2 行、絵文字込み)"
}

ルール:
- overlayText は必ず日本語 8〜15 字。長すぎ NG、短すぎ NG
- overlayText はそのカットに映っているものを"言葉で増幅"する (説明ではなく感情的フック)
- context は実際に映っている要素 (人物/場面/物/光/動き) を具体的に
- bgmMood の意味: "up"=テンション上げる元気系 / "soft"=しっとり穏やか / "pop"=明るく軽やか / "emo"=感情に刺さる切なさ。映像の温度感に合うものを必ず 1 つ選ぶ
- emojis は 3〜5 個。カットに映っているものや感情に合う絵文字
- caption は押し売りではなく体験ベース。最初の 1 行で続きを読みたくなる
- hookOptions は caption の「最初の1行」を差し替えられる別案を 3 つ。切り口を必ず変える (共感 / 数字 / 逆説 / 問いかけ など)。各 15〜45 字、改行なし、絵文字は0〜1個
- hashtags は 10〜15 個。具体性と汎用性の混合 (ニッチ + 大規模タグ)
- storyText は Instagram Story にスタンプで貼れる短いコピー (30字以内目安、絵文字込み)`;
}

function buildUserContent(frames: { data: string; mimeType: string }[]): any[] {
  const parts: any[] = [
    {
      type: 'text',
      text: `これから ${frames.length} 枚のサムネを順番に見せます。各カットを観察してから、JSON で返してください。`,
    },
  ];
  frames.forEach((f, i) => {
    parts.push({ type: 'text', text: `--- カット ${i + 1} ---` });
    parts.push({
      type: 'image',
      source: { type: 'base64', media_type: f.mimeType, data: f.data },
    });
  });
  parts.push({ type: 'text', text: '上記すべてを踏まえて、指定の JSON 形式で返してください。' });
  return parts;
}

// ─── JSON 抜き取り (前後の説明文をはがす) ─────
function extractJson(text: string): any {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : text;
  const m = candidate.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI 応答から JSON を取り出せませんでした');
  return JSON.parse(m[0]);
}

// ─── 進捗コールバック ─────
export type ProgressCb = (phase: string, current: number, total: number) => void;

// ─── メイン呼び出し ─────
export async function generateReelCaptions(
  inputs: CutInput[],
  opts: { themeHint?: string; onProgress?: ProgressCb } = {},
): Promise<ReelAiResult> {
  if (!inputs.length) throw new Error('クリップがありません');

  const total = inputs.length + 1; // フレーム抽出 + AI 呼び出し
  const onProgress = opts.onProgress || (() => {});

  // ─── 1) フレーム抽出 ───
  const frames: { data: string; mimeType: string }[] = [];
  for (let i = 0; i < inputs.length; i++) {
    onProgress(`カット ${i + 1} / ${inputs.length} を分析中…`, i, total);
    try {
      const f = await extractFrameJpeg(inputs[i]);
      frames.push(f);
    } catch (e: any) {
      throw new Error(`カット ${i + 1} の読み取りに失敗: ${e.message || e}`);
    }
  }

  // ─── 2) AI 呼び出し (1 リクエストでまとめて) ───
  onProgress('AI が文脈を読み取り中…', inputs.length, total);

  const sys = buildSystemPrompt();
  const userParts = buildUserContent(frames);
  if (opts.themeHint) {
    userParts.unshift({ type: 'text', text: `参考: 投稿者の希望テーマ: ${opts.themeHint}` });
  }

  let res: Response;
  try {
    res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 画像ありなので /api/ai 側で自動的に "heavy" 扱いになる
        'x-ai-weight': 'heavy',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5', // /api/ai 内で Gemini 1.5 Flash にマッピング (画像あり = Vision)
        max_tokens: 2500,
        system: sys,
        messages: [{ role: 'user', content: userParts }],
      }),
    });
  } catch (e: any) {
    throw new Error(`通信に失敗しました: ${e.message || e}。Wi-Fi/モバイル回線を確認して再試行してください。`);
  }

  if (!res.ok) {
    let errJson: any = {};
    try { errJson = await res.json(); } catch { /* ignore */ }
    const userMsg = errJson?.userMessage || errJson?.error?.message || `AI エラー: ${res.status}`;
    const recov = errJson?.recovery || '少し待ってから再試行してください。';
    throw new Error(`${userMsg} ${recov}`);
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text ?? '';
  if (!text) throw new Error('AI から空の応答が返りました。もう一度お試しください。');

  let parsed: any;
  try {
    parsed = extractJson(text);
  } catch (e: any) {
    throw new Error(`AI 応答を解釈できませんでした: ${e.message}。もう一度お試しください。`);
  }

  // ─── 3) 正規化 + デフォルト埋め ───
  const validMoods: BgmMood[] = ['up', 'soft', 'pop', 'emo'];
  const cuts: CutInsight[] = Array.isArray(parsed.cuts)
    ? parsed.cuts.map((c: any, i: number) => {
        const moodRaw = String(c.bgmMood || '').toLowerCase().trim();
        const bgmMood = (validMoods as string[]).includes(moodRaw)
          ? (moodRaw as BgmMood)
          : undefined;
        const emojis = Array.isArray(c.emojis)
          ? c.emojis.map((e: any) => String(e)).filter((s: string) => s && [...s].length <= 4).slice(0, 6)
          : [];
        return {
          index: typeof c.index === 'number' ? c.index : i,
          context: String(c.context || '').slice(0, 200),
          overlayText: clampOverlay(String(c.overlayText || '')),
          bgmMood,
          emojis,
        };
      })
    : [];

  // 不足カット分を埋める (AI がカット数を間違えた時の救済)
  while (cuts.length < inputs.length) {
    cuts.push({
      index: cuts.length,
      context: '',
      overlayText: '',
      bgmMood: undefined,
      emojis: [],
    });
  }
  // 過剰分を切る
  cuts.length = inputs.length;

  onProgress('完了', total, total);

  return {
    cuts,
    caption: String(parsed.caption || '').trim(),
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags.map((h: any) => String(h)).filter((h: string) => h.startsWith('#')).slice(0, 20)
      : [],
    themeGuess: String(parsed.themeGuess || '').trim(),
    storyText: String(parsed.storyText || '').trim() || undefined,
    hookOptions: Array.isArray(parsed.hookOptions)
      ? parsed.hookOptions
          .map((h: any) => String(h).replace(/[\r\n]+/g, ' ').trim())
          .filter((h: string) => h.length >= 4 && h.length <= 60)
          .slice(0, 3)
      : [],
  };
}

// ============================================================
// composeReelFromClips — 素材の「文脈」を理解して、文章・順番・カットまで設計する
//
// オーナー指示 (2026-06-18):
//   動画素材の文脈を理解し、その文脈に対して適切な文章生成と「順番」「カット」を作る。
//
// generateReelCaptions は与えられた順番のまま字幕を付けるだけだった。こちらは
//   AI が全クリップを観てから「リールとして一番伸びる構成」を設計する:
//     - どのクリップを何番目に置くか (order) ＝ 並べ替え
//     - 各カットの役割 (hook / build / payoff / cta)
//     - 各カットに重ねる字幕 + ナレーション + 推奨秒数 + なぜそこに置くか(理由)
//     - 全体のタイトル(フック) / 本文 / ハッシュタグ / BGM
//   オーディエンス/ブランド文脈 (分析結果) を渡すと、その層に刺さる言葉で書く。
// ============================================================

export type CutRole = 'hook' | 'build' | 'payoff' | 'cta';

export interface ComposedCut {
  /** 元クリップの番号 (0-based)。並べ替えの結果ここが飛ぶ */
  sourceIndex: number;
  /** リール内での順番 (0-based) */
  order: number;
  role: CutRole;
  /** このカットに映っている文脈 (AI の読み取り) */
  context: string;
  /** 画面に重ねる字幕 (8〜15字) */
  overlayText: string;
  /** ナレーション / 読み (任意) */
  narration?: string;
  /** 推奨秒数 */
  durationSec: number;
  /** なぜこの順番・この役割なのか (編集意図) */
  reason: string;
}

export interface ReelComposition {
  title: string;            // 1〜3秒のフック (リール冒頭)
  themeGuess: string;
  cuts: ComposedCut[];      // order 昇順で並んだ完成構成
  caption: string;
  hashtags: string[];
  bgmMood?: BgmMood;
  /** 構成全体のねらい (1〜2行) */
  editorNote: string;
}

/** 文脈理解リール構成のための追加文脈 (分析結果から) */
export interface ComposeContext {
  audience?: string;   // 例: "25-34歳女性・コスメ感度高"
  brand?: string;      // 例: "ナチュラル志向の等身大ビューティ"
  theme?: string;      // 例: "朝のスキンケア"
  goal?: string;       // 例: "保存数を伸ばす"
}

function buildComposeSystem(ctx: ComposeContext): string {
  const ctxLines = [
    ctx.audience ? `- 想定オーディエンス: ${ctx.audience}` : '',
    ctx.brand ? `- アカウントの世界観: ${ctx.brand}` : '',
    ctx.theme ? `- 今回のテーマ希望: ${ctx.theme}` : '',
    ctx.goal ? `- ねらう成果: ${ctx.goal}` : '',
  ].filter(Boolean).join('\n');

  return `あなたは Instagram Reels / TikTok のトップ編集者 兼 構成作家です。
これからユーザーが撮った複数のクリップ(画像/動画のサムネ)を順不同で見せます。
あなたの仕事は「素材の文脈を読み取り、リールとして一番伸びる作品に再構成する」こと。

${ctxLines ? `## このアカウントの文脈\n${ctxLines}\n` : ''}
## やること
1. 各クリップに何が映っているか(人物/場面/物/光/動き/感情)を具体的に読み取る
2. リールの黄金構成に沿って「並べ替える」: 冒頭1〜2秒で離脱を止める hook → 中盤で惹きつける build → 山場 payoff → 最後に行動を促す cta
3. クリップの内容に最も合う順番を決める(撮影順は無視してよい。弱いカットは後ろや短くする)
4. 各カットに「重ねる字幕(8〜15字)」「ナレーション(任意,少し長め可)」「推奨秒数(2〜6秒)」「なぜその順番/役割か(理由)」を付ける
5. 全体の title(冒頭フック), caption(本文), hashtags, bgmMood を決める

返答は JSON のみ。前後に説明文を一切入れない:
{
  "themeGuess": "全体テーマ 1 行",
  "title": "冒頭1〜3秒のフック (例: 知らないと損する朝の3秒)",
  "editorNote": "この構成のねらいを1〜2行で(なぜ伸びるか)",
  "bgmMood": "up | soft | pop | emo",
  "cuts": [
    {
      "sourceIndex": 元クリップ番号(0始まり),
      "order": リール内の順番(0始まり),
      "role": "hook | build | payoff | cta",
      "context": "そのカットの内容を具体的に",
      "overlayText": "8〜15字の字幕",
      "narration": "読み上げ用(任意)",
      "durationSec": 2〜6,
      "reason": "なぜこの順番・役割か"
    }
  ],
  "caption": "Instagram 本文(体験ベース・冒頭で続きを読ませる・3〜6行)",
  "hashtags": ["#…"]
}

ルール:
- cuts は必ず全クリップを 1 回ずつ含める(全 ${'${n}'} 枚)。order は 0..N-1 の連番、重複なし
- overlayText は日本語 8〜15字。説明でなく感情フック
- 1 枚目(order:0)は必ず role:"hook"。最後は role:"cta"
- durationSec の合計が 15〜30秒に収まるよう調整
- オーディエンス文脈があれば、その層が「自分ごと」に感じる言葉を選ぶ
- hashtags は 10〜15 個(ニッチ + 大規模の混合)`;
}

export async function composeReelFromClips(
  inputs: CutInput[],
  opts: { context?: ComposeContext; onProgress?: ProgressCb } = {},
): Promise<ReelComposition> {
  if (!inputs.length) throw new Error('クリップがありません');
  const onProgress = opts.onProgress || (() => {});
  const total = inputs.length + 1;

  // 1) フレーム抽出
  const frames: { data: string; mimeType: string }[] = [];
  for (let i = 0; i < inputs.length; i++) {
    onProgress(`素材 ${i + 1} / ${inputs.length} を読み取り中…`, i, total);
    try {
      frames.push(await extractFrameJpeg(inputs[i]));
    } catch (e: any) {
      throw new Error(`素材 ${i + 1} の読み取りに失敗: ${e.message || e}`);
    }
  }

  // 2) Vision + 構成設計 (1 リクエスト)
  onProgress('文脈を読んで構成を設計中…', inputs.length, total);
  const sys = buildComposeSystem(opts.context || {}).replace('${n}', String(inputs.length));
  const userParts = buildUserContent(frames);
  userParts.unshift({
    type: 'text',
    text: `クリップは全 ${inputs.length} 枚。各クリップの長さ(秒): ${inputs.map((c, i) => `#${i}=${Math.round(c.duration * 10) / 10}s`).join(', ')}`,
  });

  let res: Response;
  try {
    res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ai-weight': 'heavy' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 3000,
        system: sys,
        messages: [{ role: 'user', content: userParts }],
      }),
    });
  } catch (e: any) {
    throw new Error(`通信に失敗しました: ${e.message || e}。回線を確認して再試行してください。`);
  }
  if (!res.ok) {
    let errJson: any = {};
    try { errJson = await res.json(); } catch { /* */ }
    const msg = errJson?.userMessage || errJson?.error?.message || `AI エラー: ${res.status}`;
    const recov = errJson?.recovery || '少し待って再試行してください。';
    throw new Error(`${msg} ${recov}`);
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text ?? '';
  if (!text) throw new Error('AI から空の応答が返りました。もう一度お試しください。');

  let parsed: any;
  try { parsed = extractJson(text); }
  catch (e: any) { throw new Error(`AI 応答を解釈できませんでした: ${e.message}。もう一度お試しください。`); }

  // 3) 正規化 + 健全化 (全クリップを 1 回ずつ・order 連番・role 妥当)
  const validRoles: CutRole[] = ['hook', 'build', 'payoff', 'cta'];
  const rawCuts: any[] = Array.isArray(parsed.cuts) ? parsed.cuts : [];
  const used = new Set<number>();
  let cuts: ComposedCut[] = rawCuts
    .map((c: any): ComposedCut => {
      let src = Number.isInteger(c.sourceIndex) ? c.sourceIndex : -1;
      if (src < 0 || src >= inputs.length || used.has(src)) src = -1; // 後で補完
      if (src >= 0) used.add(src);
      const roleRaw = String(c.role || '').toLowerCase().trim();
      return {
        sourceIndex: src,
        order: Number.isInteger(c.order) ? c.order : 0,
        role: (validRoles as string[]).includes(roleRaw) ? (roleRaw as CutRole) : 'build',
        context: String(c.context || '').slice(0, 200),
        overlayText: clampOverlay(String(c.overlayText || '')),
        narration: c.narration ? String(c.narration).slice(0, 160) : undefined,
        durationSec: Math.min(6, Math.max(2, Number(c.durationSec) || 3)),
        reason: String(c.reason || '').slice(0, 160),
      };
    });
  // 欠けたクリップを末尾に補完（AI が落とした素材も必ず使う）
  for (let i = 0; i < inputs.length; i++) {
    if (!used.has(i)) {
      cuts.push({ sourceIndex: i, order: cuts.length, role: 'build', context: '', overlayText: '', durationSec: 3, reason: '自動補完' });
    }
  }
  // sourceIndex 未確定(-1)を残った番号で埋める
  const missing = [...Array(inputs.length).keys()].filter((i) => !cuts.some((c) => c.sourceIndex === i));
  let mi = 0;
  cuts = cuts.map((c) => (c.sourceIndex < 0 ? { ...c, sourceIndex: missing[mi++] ?? 0 } : c));
  // order を 0..N-1 に振り直し（AI の order を尊重しつつ連番化）
  cuts.sort((a, b) => a.order - b.order).forEach((c, i) => { c.order = i; });
  if (cuts.length) { cuts[0].role = 'hook'; cuts[cuts.length - 1].role = 'cta'; }

  onProgress('完了', total, total);

  const validMoods: BgmMood[] = ['up', 'soft', 'pop', 'emo'];
  const moodRaw = String(parsed.bgmMood || '').toLowerCase().trim();

  return {
    title: String(parsed.title || '').trim() || cuts[0]?.overlayText || 'あなたのリール',
    themeGuess: String(parsed.themeGuess || '').trim(),
    editorNote: String(parsed.editorNote || '').trim(),
    bgmMood: (validMoods as string[]).includes(moodRaw) ? (moodRaw as BgmMood) : undefined,
    cuts,
    caption: String(parsed.caption || '').trim(),
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags.map((h: any) => String(h)).filter((h: string) => h.startsWith('#')).slice(0, 20)
      : [],
  };
}

/** BGM ジャンルに対する BPM (テンポ合わせ用) */
export function bgmMoodBpm(mood: BgmMood): number {
  const def = BGM_MOOD_DEFS.find(d => d.id === mood);
  return def?.bpm ?? 100;
}

/**
 * カット長を BGM のビートに合わせる。
 * 例: bpm=128 → 1 拍 0.469s。デフォは 4 拍分。
 */
export function snapDurationToBgm(currentSec: number, mood: BgmMood, beats = 4): number {
  const bpm = bgmMoodBpm(mood);
  const beat = 60 / bpm;
  const target = beat * beats;
  // 既存秒数に近いビート数を選ぶ (2〜8 拍の範囲)
  const candidates = [2, 4, 6, 8].map(b => ({ b, sec: beat * b }));
  let best = { b: beats, sec: target, diff: Math.abs(target - currentSec) };
  for (const c of candidates) {
    const d = Math.abs(c.sec - currentSec);
    if (d < best.diff) best = { b: c.b, sec: c.sec, diff: d };
  }
  return Math.max(0.5, Math.min(8, best.sec));
}

function clampOverlay(s: string): string {
  // 改行/記号を整理して 8〜15字に収める
  const cleaned = s.replace(/[\r\n]+/g, ' ').trim();
  if (cleaned.length <= 15) return cleaned;
  // 句読点で区切れたら最初のセグメント
  const seg = cleaned.split(/[、。!?！？]/)[0].trim();
  if (seg.length >= 4 && seg.length <= 15) return seg;
  return cleaned.slice(0, 15);
}
