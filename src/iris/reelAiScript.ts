// ============================================================
// IRIS ▸ Reel AI Script Generator (テーマ → 3 シーン台本)
//
// 役割:
//   - 投稿テーマを 1 行入力 → /api/ai に投げる
//   - 3 シーン × 各 4〜6 秒 = 15〜20 秒の台本を JSON で返す
//   - タイトル / 各シーン (caption + duration) / CTA を含む
//
// 軽量タスク: max_tokens 1500 以下 + 画像なし → /api/ai 内で Gemini Flash にルートされる
// (x-ai-weight: light 指定は不要だが明示しておくと意図が伝わる)
// ============================================================

export interface ScriptScene {
  /** シーン番号 (1〜3) */
  index: number;
  /** このシーンに重ねる短い字幕 (8〜18 字) */
  caption: string;
  /** 秒数 (4〜6 推奨) */
  duration: number;
  /** ナレーション (TTS で読ませる時用、字幕より少し長め可) */
  narration?: string;
}

export interface ReelScriptResult {
  /** リール全体のタイトル / フック (最初の 1〜3 秒で離脱阻止) */
  title: string;
  /** 3 シーンの本文 */
  scenes: ScriptScene[];
  /** 最後の Call To Action (フォロー / 保存 / コメント) */
  cta: string;
  /** Instagram 投稿本文 (任意, 失敗時は空) */
  caption?: string;
  /** ハッシュタグ案 (任意) */
  hashtags?: string[];
}

function buildSystemPrompt(): string {
  return `あなたは Instagram リール (短尺縦動画) の構成作家です。
ユーザーが指定したテーマで、15〜20 秒のリール台本を生成します。

ルール:
- 必ず 3 シーン構成 (Hook → Body → CTA)
- 各シーンの caption は 8〜18 文字、視認性最優先
- 各シーン duration は 4〜6 秒 (合計 15〜20 秒)
- title は最初の 1〜3 秒で離脱を防ぐ強いフック (例: "知らないと損する◯◯", "実はやってはいけない◯◯")
- cta は短く、保存 / フォロー / コメントを促す (例: "保存して見返してね")
- caption は Instagram 本文 (300 字以内、改行可)
- hashtags は 8〜12 個、# 付き

出力は必ず JSON のみ、それ以外の文字は一切含めない:
{
  "title": "...",
  "scenes": [
    { "index": 1, "caption": "...", "duration": 5, "narration": "..." },
    { "index": 2, "caption": "...", "duration": 5, "narration": "..." },
    { "index": 3, "caption": "...", "duration": 5, "narration": "..." }
  ],
  "cta": "...",
  "caption": "...",
  "hashtags": ["#...", "#..."]
}`;
}

function extractJson(text: string): any {
  // ```json ... ``` を剥がす
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : text;
  // 最初の { から最後の } まで
  const first = body.indexOf('{');
  const last = body.lastIndexOf('}');
  if (first < 0 || last < 0) throw new Error('JSON が見つかりません');
  return JSON.parse(body.slice(first, last + 1));
}

function clampCaption(s: string, max = 24): string {
  const arr = [...(s || '').replace(/\s+/g, ' ').trim()];
  return arr.length > max ? arr.slice(0, max).join('') + '…' : arr.join('');
}

export async function generateReelScript(theme: string): Promise<ReelScriptResult> {
  if (!theme || !theme.trim()) {
    throw new Error('テーマを入力してください (例: 朝のスキンケア、新作レビュー)');
  }

  let res: Response;
  try {
    res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ai-weight': 'light', // 軽量 (画像なし、max_tokens 小) → Gemini Flash
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5', // /api/ai 内で軽量タスクは Gemini にマップ
        max_tokens: 1200,
        system: buildSystemPrompt(),
        messages: [
          {
            role: 'user',
            content: `テーマ: ${theme.trim()}\n\n上記テーマで 15〜20 秒のリール台本を JSON で返してください。`,
          },
        ],
      }),
    });
  } catch (e: any) {
    throw new Error(`通信に失敗しました: ${e?.message || e}。Wi-Fi / モバイル回線を確認して再試行してください。`);
  }

  if (!res.ok) {
    let errJson: any = {};
    try { errJson = await res.json(); } catch { /* */ }
    const userMsg = errJson?.userMessage || errJson?.error?.message || `AI エラー: ${res.status}`;
    const recov = errJson?.recovery || '少し待ってから再試行するか、「手で書く」ボタンで進めてください。';
    throw new Error(`${userMsg} ${recov}`);
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text ?? '';
  if (!text) throw new Error('AI から空の応答が返りました。もう一度お試しください。');

  let parsed: any;
  try { parsed = extractJson(text); }
  catch (e: any) {
    throw new Error(`AI 応答を解釈できませんでした: ${e?.message || e}。もう一度お試しください。`);
  }

  // ─── 正規化 ───
  const scenesRaw = Array.isArray(parsed.scenes) ? parsed.scenes : [];
  const scenes: ScriptScene[] = scenesRaw.slice(0, 3).map((s: any, i: number) => ({
    index: typeof s.index === 'number' ? s.index : i + 1,
    caption: clampCaption(String(s.caption || ''), 24),
    duration: Math.max(3, Math.min(8, Number(s.duration) || 5)),
    narration: s.narration ? String(s.narration).slice(0, 120) : undefined,
  }));
  // 3 シーンに満たなければ補完
  while (scenes.length < 3) {
    scenes.push({
      index: scenes.length + 1,
      caption: scenes.length === 0 ? clampCaption(theme, 18) : '',
      duration: 5,
    });
  }

  return {
    title: clampCaption(String(parsed.title || theme), 28),
    scenes,
    cta: clampCaption(String(parsed.cta || '保存してね'), 24),
    caption: parsed.caption ? String(parsed.caption).slice(0, 600) : '',
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags
          .map((h: any) => String(h).trim())
          .filter((h: string) => h.length > 0 && h.length < 30)
          .map((h: string) => (h.startsWith('#') ? h : '#' + h))
          .slice(0, 15)
      : [],
  };
}

/** リール用の魅力的なキャプション (短く・絵文字・ハッシュタグ) を生成 */
export async function generateReelCaption(themeOrHint: string, existingCaptions: string[]): Promise<{ caption: string; hashtags: string[] }> {
  const context = existingCaptions.filter(Boolean).join(' / ').slice(0, 200);
  let res: Response;
  try {
    res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ai-weight': 'light',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 800,
        system: `Instagram リールの投稿本文を書きます。短く、絵文字を 1〜2 個、ハッシュタグは 10 個前後。
出力は必ず JSON のみ:
{"caption":"...", "hashtags":["#...","..."]}`,
        messages: [
          {
            role: 'user',
            content: `テーマ: ${themeOrHint || '(指定なし)'}\n字幕参考: ${context || '(なし)'}\n\nリール投稿本文 + ハッシュタグを JSON で返してください。`,
          },
        ],
      }),
    });
  } catch (e: any) {
    throw new Error(`通信に失敗しました: ${e?.message || e}`);
  }
  if (!res.ok) {
    let errJson: any = {};
    try { errJson = await res.json(); } catch { /* */ }
    throw new Error(errJson?.userMessage || errJson?.error?.message || `AI エラー: ${res.status}`);
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text ?? '';
  if (!text) throw new Error('AI から空の応答が返りました');
  const parsed = extractJson(text);
  return {
    caption: String(parsed.caption || '').slice(0, 600),
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags
          .map((h: any) => String(h).trim())
          .filter((h: string) => h.length > 0 && h.length < 30)
          .map((h: string) => (h.startsWith('#') ? h : '#' + h))
          .slice(0, 15)
      : [],
  };
}
