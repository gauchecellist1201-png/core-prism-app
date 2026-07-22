// ============================================================
// IRIS ▸ Reel Chat Edit — チャット型動画編集のコマンド層
//   「暖かい感じで15秒にして」のような自然文を EditAction に変換し、
//   リールスタジオの既存セッターへコード確定で適用する。
//   一段目: キーワードルーター (即時・無料・確定)
//   二段目: AI 解釈 (/api/ai ・ claude-haiku-4-5 ・ JSON のみ)
// ============================================================
import { REEL_PRESETS, getPreset, type PresetId } from './reelStudio/Presets';
import { enqueueClaudeCall } from '../lib/apiQueue';

export type ColorMoodId = 'none' | 'bright' | 'warm' | 'cool' | 'film' | 'mono' | 'vivid';
export type ChatTransition = 'none' | 'fade' | 'white' | 'dissolve' | 'slide';

export type EditAction =
  | { type: 'applyPreset'; presetId: PresetId }
  | { type: 'setColorMood'; mood: ColorMoodId }
  | { type: 'autoDistribute'; totalSec: number }
  | { type: 'setClipDuration'; index: number; sec: number }
  | { type: 'reorder'; from: number; to: number }
  | { type: 'setTransition'; index: number | 'all'; transition: ChatTransition }
  | { type: 'setCaption'; index: number; text: string }
  | { type: 'removeClip'; index: number }
  | { type: 'autoCompose' }
  | { type: 'aiCaptions' };

/** 適用時に参照する現在状態 (数字の嘘禁止 — 実際の state から作る) */
export interface ReelEditState {
  clipCount: number;
  totalSec: number;
  presetId: string | null;
  colorMood: ColorMoodId;
  durations: number[];
  captions: string[];
}

/** IrisReelStudioMinimal の既存セッターをそのまま橋渡しする器 */
export interface ReelEditCtx {
  state: ReelEditState;
  applyPreset(id: PresetId): void;
  setColorMood(m: ColorMoodId): void;
  autoDistribute(sec: number): void;
  setClipDuration(index: number, sec: number): void;
  reorder(from: number, to: number): void;
  setTransition(index: number | 'all', tr: ChatTransition): void;
  setCaption(index: number, text: string): void;
  removeClip(index: number): void;
  runAiCaptions(): void;
}

const MOOD_LABELS: Record<ColorMoodId, string> = {
  none: 'そのまま', bright: '明るく', warm: '暖色', cool: '寒色',
  film: 'シネマ', mono: 'モノクロ', vivid: '鮮やか',
};
const TRANSITION_LABELS: Record<ChatTransition, string> = {
  none: 'なし', fade: 'フェード', white: 'ホワイト', dissolve: 'ディゾルブ', slide: 'スライド',
};
const VALID_MOODS = new Set<string>(Object.keys(MOOD_LABELS));
const VALID_TRANSITIONS = new Set<string>(Object.keys(TRANSITION_LABELS));
const VALID_PRESETS = new Set<string>(REEL_PRESETS.map(p => p.id));

const clampSec = (n: number) => Math.max(0.5, Math.min(15, Number(n.toFixed(1))));
const snapTotal = (n: number) => (n <= 22 ? 15 : 30);

// ─── 適用 ────────────────────────────────────────────────
/** 1 コマンドずつ既存セッターへ適用し、日本語サマリー配列を返す */
export function applyActions(actions: EditAction[], ctx: ReelEditCtx): string[] {
  const out: string[] = [];
  let count = ctx.state.clipCount;
  const needClips = (): boolean => {
    if (count > 0) return true;
    if (!out.includes('先に素材を入れてください')) out.push('先に素材を入れてください');
    return false;
  };
  const validIdx = (i: number): boolean => Number.isInteger(i) && i >= 0 && i < count;
  for (const a of actions) {
    switch (a.type) {
      case 'applyPreset': {
        const p = getPreset(a.presetId);
        if (!p) break;
        ctx.applyPreset(a.presetId);
        out.push(`テンプレートを「${p.label}」に`);
        break;
      }
      case 'setColorMood':
        ctx.setColorMood(a.mood);
        out.push(a.mood === 'none' ? 'カラーを元に戻しました' : `カラーを「${MOOD_LABELS[a.mood]}」に`);
        break;
      case 'autoDistribute': {
        if (!needClips()) break;
        const sec = snapTotal(a.totalSec);
        ctx.autoDistribute(sec);
        out.push(`全体を ${sec} 秒に整えました`);
        break;
      }
      case 'setClipDuration':
        if (!needClips()) break;
        if (!validIdx(a.index)) { out.push(`${a.index + 1} 番目のカットが見つかりません (今は ${count} カット)`); break; }
        ctx.setClipDuration(a.index, clampSec(a.sec));
        out.push(`${a.index + 1} 番目を ${clampSec(a.sec)} 秒に`);
        break;
      case 'reorder':
        if (!needClips()) break;
        if (!validIdx(a.from) || !validIdx(a.to)) { out.push('並べ替えの番号が範囲外でした'); break; }
        ctx.reorder(a.from, a.to);
        out.push(`${a.from + 1} 番目を ${a.to + 1} 番目へ移動`);
        break;
      case 'setTransition':
        if (!needClips()) break;
        if (a.index !== 'all' && !validIdx(a.index)) { out.push('繋ぎを変えるカットが見つかりません'); break; }
        ctx.setTransition(a.index, a.transition);
        out.push(a.index === 'all'
          ? `繋ぎを全カット「${TRANSITION_LABELS[a.transition]}」に`
          : `${a.index + 1} 番目の繋ぎを「${TRANSITION_LABELS[a.transition]}」に`);
        break;
      case 'setCaption':
        if (!needClips()) break;
        if (!validIdx(a.index)) { out.push('字幕を変えるカットが見つかりません'); break; }
        ctx.setCaption(a.index, a.text.slice(0, 40));
        out.push(`${a.index + 1} 番目の字幕を「${a.text.slice(0, 14)}${a.text.length > 14 ? '…' : ''}」に`);
        break;
      case 'removeClip':
        if (!needClips()) break;
        if (!validIdx(a.index)) { out.push('削除するカットが見つかりません'); break; }
        ctx.removeClip(a.index);
        count -= 1;
        out.push(`${a.index + 1} 番目のカットを削除`);
        break;
      case 'autoCompose':
        if (!needClips()) break;
        ctx.setColorMood('bright');
        ctx.setTransition('all', 'fade');
        ctx.autoDistribute(15);
        out.push('おまかせで整えました — 明るく・フェード・全体 15 秒');
        break;
      case 'aiCaptions':
        if (!needClips()) break;
        ctx.runAiCaptions();
        out.push('AI 字幕の生成を始めました (できあがると各カットに入ります)');
        break;
    }
  }
  return out;
}

// ─── 一段目: キーワードルーター (コード確定・即時) ─────────
const normalize = (s: string) =>
  s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
   .replace(/[\s　]+/g, ' ')
   .trim();

const KANJI_NUM: Record<string, number> = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
const numOf = (s: string): number => KANJI_NUM[s] ?? Number(s);

/** マッチしたら即適用できる EditAction 配列を返す。何も分からなければ [] */
export function routeEditCommand(raw: string, state: ReelEditState): EditAction[] {
  const text = normalize(raw);
  const acts: EditAction[] = [];
  const last = Math.max(0, state.clipCount - 1);
  const IDX = '([0-9]+|[一二三四五六七八九十])\\s*(?:番目|枚目|カット目|つ目|個目)';

  // カラーの雰囲気 (どれか 1 つ)
  if (/暖か|あたたか|あったか|温か|ぬくもり/.test(text)) acts.push({ type: 'setColorMood', mood: 'warm' });
  else if (/モノクロ|白黒|モノトーン|グレースケール/.test(text)) acts.push({ type: 'setColorMood', mood: 'mono' });
  else if (/シネマ|映画(っぽ|風|みたい|調)|フィルム(調|風|っぽ)/.test(text)) acts.push({ type: 'setColorMood', mood: 'film' });
  else if (/寒色|涼し|クール(に|な感じ)|青っぽ|青み/.test(text)) acts.push({ type: 'setColorMood', mood: 'cool' });
  else if (/鮮やか|ビビッド|カラフル|色を?濃く/.test(text)) acts.push({ type: 'setColorMood', mood: 'vivid' });
  else if (/明るく|明るめ|明るい感じ/.test(text)) acts.push({ type: 'setColorMood', mood: 'bright' });
  else if (/色を?(戻|リセット|なし)|元の色/.test(text)) acts.push({ type: 'setColorMood', mood: 'none' });

  // テンプレート (どれか 1 つ)
  if (/かわいく|可愛く|かわいい感じ|キュート|ポップに/.test(text)) acts.push({ type: 'applyPreset', presetId: 'cute' });
  else if (/バズ|バイラル|伸びる感じ/.test(text)) acts.push({ type: 'applyPreset', presetId: 'viral' });
  else if (/高級|ラグジュアリー|上品に/.test(text)) acts.push({ type: 'applyPreset', presetId: 'luxury' });
  else if (/レトロ|エモい|エモく/.test(text)) acts.push({ type: 'applyPreset', presetId: 'retro' });
  else if (/ミニマル|シンプルに/.test(text)) acts.push({ type: 'applyPreset', presetId: 'minimal' });
  else if (/教える系|解説(風|系)|勉強系/.test(text)) acts.push({ type: 'applyPreset', presetId: 'teach' });
  else if (/ニュース(風|系)/.test(text)) acts.push({ type: 'applyPreset', presetId: 'news' });
  else if (/グルメ|カフェ(風|系)|飯テロ/.test(text)) acts.push({ type: 'applyPreset', presetId: 'food' });
  else if (/美容(系|風)|コスメ(系|風)/.test(text)) acts.push({ type: 'applyPreset', presetId: 'beauty' });

  let rest = text;

  // 「N 番目を M 秒」
  {
    const re = new RegExp(`${IDX}[^0-9一-十]{0,10}?([0-9]+(?:\\.[0-9]+)?)\\s*秒`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      acts.push({ type: 'setClipDuration', index: numOf(m[1]) - 1, sec: Number(m[2]) });
      rest = rest.replace(m[0], ' ');
    }
  }
  // 「N 番目を最初に / 最後に / M 番目に」
  {
    let m = new RegExp(`${IDX}\\s*を?\\s*(?:一番)?(最初|先頭|前)に`).exec(text);
    if (m) acts.push({ type: 'reorder', from: numOf(m[1]) - 1, to: 0 });
    m = new RegExp(`${IDX}\\s*を?\\s*(?:一番)?(最後|後ろ|末尾)に`).exec(text);
    if (m) acts.push({ type: 'reorder', from: numOf(m[1]) - 1, to: last });
    // 「N番目をM番目に」の相互指定は誤爆しやすいので AI 側に任せる
  }
  // 全体の秒数 (クリップ個別指定で消費した数字は除外済みの rest を見る)
  {
    const m = /([0-9]+)\s*秒(?:に|で|くらい|程度|へ)?/.exec(rest);
    if (m) acts.push({ type: 'autoDistribute', totalSec: Number(m[1]) });
    else if (/短く|コンパクトに|ぎゅっと/.test(text)) acts.push({ type: 'autoDistribute', totalSec: 15 });
    else if (/長め|じっくり/.test(text)) acts.push({ type: 'autoDistribute', totalSec: 30 });
  }
  // 繋ぎ (トランジション)
  {
    const trWord: [RegExp, ChatTransition][] = [
      [/ディゾルブ/, 'dissolve'],
      [/スライド/, 'slide'],
      [/ホワイト|白フラッシュ/, 'white'],
      [/フェード/, 'fade'],
    ];
    if (/(繋ぎ|つなぎ|トランジション)\s*(を|は)?\s*(なし|無し|カット)/.test(text)) {
      acts.push({ type: 'setTransition', index: 'all', transition: 'none' });
    } else {
      for (const [re, tr] of trWord) {
        if (!re.test(text)) continue;
        const withIdx = new RegExp(`${IDX}[^。]{0,10}${re.source}`).exec(text);
        acts.push({ type: 'setTransition', index: withIdx ? numOf(withIdx[1]) - 1 : 'all', transition: tr });
        break;
      }
    }
  }
  // 「N 番目を削除 / 消して」
  {
    const re = new RegExp(`${IDX}\\s*(?:のカット)?\\s*を?\\s*(削除|消して|消す|いらない)`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) acts.push({ type: 'removeClip', index: numOf(m[1]) - 1 });
  }
  // おまかせ / AI 字幕
  if (/おまかせ|お任せ|いい感じに|よしなに|全部やって|まるっと/.test(text)) acts.push({ type: 'autoCompose' });
  if (/(字幕|テロップ)\s*(を|も)?\s*(つけ|付け|入れ|生成|書い|お願い)/.test(text)) acts.push({ type: 'aiCaptions' });

  // 削除は index の大きい順に並べ替え (連続削除で番号がずれないように)
  const removes = acts.filter(a => a.type === 'removeClip') as Extract<EditAction, { type: 'removeClip' }>[];
  if (removes.length > 1) {
    const others = acts.filter(a => a.type !== 'removeClip');
    removes.sort((a, b) => b.index - a.index);
    return [...others, ...removes];
  }
  return acts;
}

// ─── 二段目: AI 解釈 (一段目で不明なとき) ──────────────────
function sanitizeActions(input: unknown): EditAction[] {
  if (!Array.isArray(input)) return [];
  const out: EditAction[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const a = raw as Record<string, unknown>;
    const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
    switch (a.type) {
      case 'applyPreset':
        if (typeof a.presetId === 'string' && VALID_PRESETS.has(a.presetId)) out.push({ type: 'applyPreset', presetId: a.presetId as PresetId });
        break;
      case 'setColorMood':
        if (typeof a.mood === 'string' && VALID_MOODS.has(a.mood)) out.push({ type: 'setColorMood', mood: a.mood as ColorMoodId });
        break;
      case 'autoDistribute': {
        const s = num(a.totalSec); if (s != null && s > 0) out.push({ type: 'autoDistribute', totalSec: s });
        break;
      }
      case 'setClipDuration': {
        const i = num(a.index), s = num(a.sec);
        if (i != null && s != null && s > 0) out.push({ type: 'setClipDuration', index: Math.trunc(i), sec: s });
        break;
      }
      case 'reorder': {
        const f = num(a.from), t = num(a.to);
        if (f != null && t != null) out.push({ type: 'reorder', from: Math.trunc(f), to: Math.trunc(t) });
        break;
      }
      case 'setTransition': {
        const tr = a.transition;
        if (typeof tr !== 'string' || !VALID_TRANSITIONS.has(tr)) break;
        const i = a.index === 'all' ? 'all' : num(a.index);
        if (i === 'all' || i != null) out.push({ type: 'setTransition', index: i === 'all' ? 'all' : Math.trunc(i as number), transition: tr as ChatTransition });
        break;
      }
      case 'setCaption': {
        const i = num(a.index);
        if (i != null && typeof a.text === 'string' && a.text.trim()) out.push({ type: 'setCaption', index: Math.trunc(i), text: a.text.trim() });
        break;
      }
      case 'removeClip': {
        const i = num(a.index); if (i != null) out.push({ type: 'removeClip', index: Math.trunc(i) });
        break;
      }
      case 'autoCompose': out.push({ type: 'autoCompose' }); break;
      case 'aiCaptions': out.push({ type: 'aiCaptions' }); break;
    }
    if (out.length >= 8) break; // 一度に大量適用しない (安全弁)
  }
  return out;
}

function buildAiSystem(state: ReelEditState): string {
  const presetLine = REEL_PRESETS.map(p => `${p.id}=${p.label}`).join(', ');
  return `あなたは縦型リール (Instagram Reels) 編集アプリの編集コマンド変換器です。
ユーザーの日本語指示を、以下の JSON だけで返してください。説明文・コードフェンス禁止。

現在の状態:
- カット数: ${state.clipCount}
- 合計: ${state.totalSec.toFixed(1)} 秒 (各カット: ${state.durations.map(d => d.toFixed(1)).join('s, ')}s)
- テンプレート: ${state.presetId || 'なし'} / カラー: ${state.colorMood}
- 各カットの字幕: ${state.captions.map((c, i) => `[${i}]「${c || '(なし)'}」`).join(' ')}

出力形式 (これ以外を書かない):
{"actions":[...],"reply":"1文の短い日本語"}

actions に使える type (index は 0 始まり):
- {"type":"applyPreset","presetId":"..."} — ${presetLine}
- {"type":"setColorMood","mood":"none|bright|warm|cool|film|mono|vivid"}
- {"type":"autoDistribute","totalSec":15 または 30}
- {"type":"setClipDuration","index":0,"sec":2.5}
- {"type":"reorder","from":0,"to":2}
- {"type":"setTransition","index":0 または "all","transition":"none|fade|white|dissolve|slide"}
- {"type":"setCaption","index":0,"text":"字幕 (8〜15字)"}
- {"type":"removeClip","index":0}
- {"type":"autoCompose"} — 全部おまかせで整える
- {"type":"aiCaptions"} — AI が映像を見て字幕を全カットに生成

ルール:
- 指示に該当する操作だけを最小限入れる (最大 8 個)
- 編集と無関係な質問なら actions は [] にして reply で 1 文だけ答える
- 数字や状態を勝手に創作しない`;
}

/**
 * AI に指示文を解釈させる。JSON を検証し、不正な action は捨てる。
 * 30 秒タイムアウト。失敗時は throw (呼び出し側でフォールバック文言)。
 */
export async function interpretEditWithAi(text: string, state: ReelEditState): Promise<{ actions: EditAction[]; reply: string }> {
  return enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 700,
        system: buildAiSystem(state),
        messages: [{ role: 'user', content: text }],
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const body: string = data?.content?.[0]?.text || '';
    // コードフェンスや前置きが混ざっても最初の { … 最後の } を拾う
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('no-json');
    let parsed: any;
    try { parsed = JSON.parse(body.slice(start, end + 1)); } catch { throw new Error('bad-json'); }
    const actions = sanitizeActions(parsed?.actions);
    const reply = typeof parsed?.reply === 'string' ? parsed.reply.slice(0, 200) : '';
    if (!actions.length && !reply) throw new Error('empty');
    return { actions, reply };
  });
}
