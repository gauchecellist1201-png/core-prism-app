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

export interface CutInsight {
  index: number;
  context: string;        // "朝の鏡前。寝起きの素肌のクローズアップ"
  overlayText: string;    // 8〜15字。実際に動画に重なる字幕
}

export interface ReelAiResult {
  cuts: CutInsight[];
  caption: string;        // Instagram 投稿本文 (改行込み)
  hashtags: string[];     // ["#美容", "#朝活", …]
  themeGuess: string;     // AI が読み取ったリール全体のテーマ
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
複数の動画/画像クリップを順番に見て、リール全体のテーマを掴み、各カットに重ねる短文字幕と投稿本文を作る。

返答は JSON のみ。前後に説明文を一切入れない:
{
  "themeGuess": "リール全体を貫くテーマを 1 行で",
  "cuts": [
    { "index": 0, "context": "そのカットに映っている内容を 1〜2 行で具体的に", "overlayText": "8〜15字の短い字幕 (動画に重ねる)" }
  ],
  "caption": "Instagram 投稿本文。改行を活用、絵文字は最小限、3〜6 行",
  "hashtags": ["#タグ1", "#タグ2"]
}

ルール:
- overlayText は必ず日本語 8〜15 字。長すぎ NG、短すぎ NG
- overlayText はそのカットに映っているものを"言葉で増幅"する (説明ではなく感情的フック)
- context は実際に映っている要素 (人物/場面/物/光/動き) を具体的に
- caption は押し売りではなく体験ベース。最初の 1 行で続きを読みたくなる
- hashtags は 10〜15 個。具体性と汎用性の混合 (ニッチ + 大規模タグ)`;
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
  const cuts: CutInsight[] = Array.isArray(parsed.cuts)
    ? parsed.cuts.map((c: any, i: number) => ({
        index: typeof c.index === 'number' ? c.index : i,
        context: String(c.context || '').slice(0, 200),
        overlayText: clampOverlay(String(c.overlayText || '')),
      }))
    : [];

  // 不足カット分を埋める (AI がカット数を間違えた時の救済)
  while (cuts.length < inputs.length) {
    cuts.push({
      index: cuts.length,
      context: '',
      overlayText: '',
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
  };
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
