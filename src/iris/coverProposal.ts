// ============================================================
// IRIS ▸ Cover / Thumbnail AI Proposal (テーマ → 表紙の文言・配色・写真の方向性)
//
// 役割（Resonance のリッチメニュー "プレミアム" と同じ思想）:
//   - 投稿テーマを 1 行入力 → /api/ai に投げる
//   - 「写真ヒーロー＋上質なテキスト」で映える“表紙/サムネ”の構成を提案
//   - 見出し候補(3) / 小見出し / 上の小ラベル / 配色ムード / 写真の方向性 / 配置 を JSON で返す
//   - 失敗しても必ずテーマに沿った無難な提案を返す（silent fail 禁止・UX維持）
//
// 実際の合成は IrisCoverStudio.tsx がクライアントの canvas で高精細に行う。
// ============================================================
import { logIrisActivity } from './irisActivity';

export type CoverMood = 'rose' | 'champagne' | 'lavender' | 'peach' | 'midnight' | 'cream';
export type CoverLayout = 'bottom' | 'center' | 'top';

export interface CoverProposal {
  /** 上に置く小さなラベル（英字や短語。例: BEAUTY / 朝のルーティン） */
  kicker: string;
  /** 大見出しの候補（3 つ。各 22 文字以内、強いフック） */
  titles: string[];
  /** 小見出し（任意・40 文字以内） */
  subtitle: string;
  /** 配色ムード（プリセットに対応） */
  mood: CoverMood;
  /** アクセント色（#rrggbb） */
  accent: string;
  /** どんな写真を上に置くと映えるか（1 文） */
  photoHint: string;
  /** テキストの配置 */
  layout: CoverLayout;
  /** AI が実際に生成したか（フォールバックなら false） */
  ai: boolean;
}

const MOODS: CoverMood[] = ['rose', 'champagne', 'lavender', 'peach', 'midnight', 'cream'];

function extractJson(text: string): any {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : text;
  const first = body.indexOf('{');
  const last = body.lastIndexOf('}');
  if (first < 0 || last < 0) throw new Error('JSON が見つかりません');
  return JSON.parse(body.slice(first, last + 1));
}

function clamp(s: unknown, max: number): string {
  const arr = [...String(s ?? '').replace(/\s+/g, ' ').trim()];
  return arr.length > max ? arr.slice(0, max).join('') : arr.join('');
}

function safeHex(v: unknown, fallback: string): string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim() : fallback;
}

function safeMood(v: unknown): CoverMood {
  return typeof v === 'string' && (MOODS as string[]).includes(v) ? (v as CoverMood) : 'rose';
}

function safeLayout(v: unknown): CoverLayout {
  return v === 'center' || v === 'top' ? v : 'bottom';
}

/** AI が使えない時でも必ず返す、テーマに沿った無難な提案。 */
function fallbackProposal(theme: string): CoverProposal {
  const t = theme.trim();
  return {
    kicker: 'FEATURE',
    titles: [t.slice(0, 22) || '新しい私へ', `${t}のコツ`.slice(0, 22), `知らないと損する${t}`.slice(0, 22)],
    subtitle: '保存して、あとで見返してね',
    mood: 'rose',
    accent: '#E1306C',
    photoHint: 'テーマが伝わる明るく上質な写真を1枚（人物・物・風景どれでも）。',
    layout: 'bottom',
    ai: false,
  };
}

function buildSystemPrompt(): string {
  return `あなたは女性インフルエンサー向けの一流アートディレクターです。
ユーザーのテーマで、Instagram の「表紙/サムネ（写真の上に上質なテキスト）」の構成を提案します。
VOGUE のような洗練された editorial を狙い、軽薄な絵文字や多色は使わない。

ルール:
- kicker: 上に小さく置く短いラベル（英大文字の1語 or 短い和語。例: BEAUTY, ROUTINE, 朝の習慣）。12文字以内。
- titles: 大見出しの候補を必ず3つ。各22文字以内。最初の一瞬で指を止める強いフック。
- subtitle: 小さな添え文。40文字以内（保存・フォロー導線など）。
- mood: 配色ムードを次から1つ: rose(ピンク) / champagne(金) / lavender(紫) / peach(暖色) / midnight(濃紺夜) / cream(生成り)。テーマに最も合うもの。
- accent: アクセント色を #rrggbb で1つ（ラベルや罫線に使う）。
- photoHint: 上に置くと映える写真を1文で具体的に（被写体・明るさ・雰囲気）。
- layout: テキストの配置を bottom / center / top から1つ。

出力は必ず JSON のみ、それ以外の文字を一切含めない:
{"kicker":"...","titles":["...","...","..."],"subtitle":"...","mood":"rose","accent":"#E1306C","photoHint":"...","layout":"bottom"}`;
}

export async function generateCoverProposal(theme: string): Promise<CoverProposal> {
  if (!theme || !theme.trim()) {
    throw new Error('テーマを入力してください（例: 朝のスキンケア、旅の持ち物、新作レビュー）');
  }

  let res: Response;
  try {
    res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ai-weight': 'light' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 900,
        system: buildSystemPrompt(),
        messages: [
          { role: 'user', content: `テーマ: ${theme.trim()}\n\n上記テーマで表紙/サムネの構成を JSON で返してください。` },
        ],
      }),
    });
  } catch {
    // 通信失敗でも提案を返す（手で直せる）。
    return fallbackProposal(theme);
  }

  if (!res.ok) return fallbackProposal(theme);

  let text = '';
  try {
    const data = await res.json();
    text = data?.content?.[0]?.text ?? '';
  } catch {
    return fallbackProposal(theme);
  }
  if (!text) return fallbackProposal(theme);

  let parsed: any;
  try {
    parsed = extractJson(text);
  } catch {
    return fallbackProposal(theme);
  }

  const titlesRaw = Array.isArray(parsed.titles) ? parsed.titles : [];
  const titles = titlesRaw
    .map((s: unknown) => clamp(s, 22))
    .filter((s: string) => s.length > 0)
    .slice(0, 3);
  while (titles.length < 3) titles.push(clamp(theme, 22) || '新しい私へ');

  logIrisActivity('script'); // 提案が実際に生成できた時のみ記録（honest）

  return {
    kicker: clamp(parsed.kicker, 12) || 'FEATURE',
    titles,
    subtitle: clamp(parsed.subtitle, 40),
    mood: safeMood(parsed.mood),
    accent: safeHex(parsed.accent, '#E1306C'),
    photoHint: clamp(parsed.photoHint, 80) || 'テーマが伝わる明るく上質な写真を1枚。',
    layout: safeLayout(parsed.layout),
    ai: true,
  };
}
