// ============================================================
// IRIS — Reel Director (リール監督モード) ロジック層
//
// 台本 (ProductionScript) を「カット単位で編集できるリール企画」に変換し、
//   ① 2025-26 に伸びている構成テンプレ
//   ② カット単位のタイムライン編集 (秒数/画角/セリフ/テロップ/切替効果)
//   ③ テロップのスタイルプリセット (見え方プレビュー用)
//   ④ 書き出し (SRT / テロップ全文 / 撮影指示書 / 本文+タグ)
//   ⑤ ルールベースの仕上げチェック (AI 演出の嘘をしない)
// を提供する。既存の scriptStudio.ts は壊さず、その上に乗る拡張。
// ============================================================
import type { ProductionScript, ScriptShot } from './scriptStudio';

// ─── 切り替え効果 (次のカットへの遷移) ──────────────────────
export type TransitionId = 'cut' | 'zoom-in' | 'slide' | 'dissolve' | 'whip' | 'match';

export const TRANSITIONS: { id: TransitionId; label: string; desc: string }[] = [
  { id: 'cut',      label: 'カット',       desc: 'そのまま切替。テンポ最速、リールの基本' },
  { id: 'zoom-in',  label: 'ズームイン',   desc: '寄りながら切替。強調したい直前に' },
  { id: 'slide',    label: 'スライド',     desc: '横に流して切替。リスト系(◯選)の区切りに' },
  { id: 'dissolve', label: 'ディゾルブ',   desc: 'ふわっと重ねる。時間経過・Before/Afterに' },
  { id: 'whip',     label: 'ワイプ(高速)', desc: '一瞬ブラーで振る。勢い・場面転換に' },
  { id: 'match',    label: 'マッチカット', desc: '同じ構図で被写体だけ替える。驚きが出る' },
];

export function transitionLabel(id: TransitionId): string {
  return TRANSITIONS.find(t => t.id === id)?.label || 'カット';
}

/** 台本の editNote テキストから切替効果を推定 (編集指示にズーム等が書かれていることが多い) */
export function guessTransition(editNote?: string): TransitionId {
  const s = (editNote || '').toLowerCase();
  if (/ズームイン|zoom\s*in|寄り/.test(s)) return 'zoom-in';
  if (/スライド|slide|横/.test(s)) return 'slide';
  if (/ディゾルブ|dissolve|フェード|オーバーラップ/.test(s)) return 'dissolve';
  if (/ワイプ|whip|スピード|高速|ブラー/.test(s)) return 'whip';
  if (/マッチ|match/.test(s)) return 'match';
  return 'cut';
}

// ─── 編集可能なカット ─────────────────────────────────────
export interface ReelCut {
  id: string;
  /** このカットの秒数 */
  durationSec: number;
  /** 画角・撮り方 (顔寄り / 全身引き / 手元アップ / 俯瞰 …) */
  shot: string;
  /** セリフ / ナレーション */
  line: string;
  /** テロップ (画面に載せる文字) */
  telop: string;
  /** 次のカットへの切替効果 */
  transition: TransitionId;
  /** 編集メモ (効果音・速度など。台本の editNote を引き継ぐ) */
  editNote: string;
}

export interface ReelProject {
  title: string;
  cuts: ReelCut[];
  caption: string;
  hashtags: string[];
  /** 適用中の構成テンプレ id (未適用は null) */
  templateId: string | null;
}

export const cutUid = (): string => 'cut_' + Math.random().toString(36).slice(2, 9);

/** "0-3秒" / "3〜6秒" / "0:03-0:06" などから長さ(秒)を緩く取り出す */
function shotDuration(time: string, fallback: number): number {
  const nums = String(time || '').match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (nums.length >= 2 && nums[1] > nums[0]) return Math.min(15, Math.max(0.5, nums[1] - nums[0]));
  return fallback;
}

/** AI 台本 → 編集可能プロジェクト */
export function scriptToProject(s: ProductionScript): ReelProject {
  const fallback = s.shots.length ? Math.max(1, s.durationSec / s.shots.length) : 3;
  return {
    title: s.title,
    caption: s.caption,
    hashtags: s.hashtags,
    templateId: null,
    cuts: s.shots.map(sh => ({
      id: cutUid(),
      durationSec: Math.round(shotDuration(sh.time, fallback) * 10) / 10,
      shot: sh.shot || '',
      line: sh.line || '',
      telop: sh.onScreenText || '',
      transition: guessTransition(sh.editNote),
      editNote: sh.editNote || '',
    })),
  };
}

/** 編集結果を ProductionScript.shots へ書き戻す (既存のコピー/SRT 動線がそのまま最新化される) */
export function projectToShots(p: ReelProject): ScriptShot[] {
  let acc = 0;
  return p.cuts.map((c, i) => {
    const start = acc;
    acc += c.durationSec;
    const trans = transitionLabel(c.transition);
    const baseNote = (c.editNote || '').trim();
    const note = baseNote
      ? (baseNote.includes(trans) ? baseNote : `${baseNote} / 切替: ${trans}`)
      : `切替: ${trans}`;
    return {
      no: i + 1,
      time: `${fmtSec(start)}-${fmtSec(acc)}秒`,
      shot: c.shot,
      action: c.shot ? `${c.shot}で撮る` : '',
      line: c.line || undefined,
      onScreenText: c.telop || undefined,
      editNote: note,
    };
  });
}

function fmtSec(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function totalDuration(cuts: ReelCut[]): number {
  return Math.round(cuts.reduce((s, c) => s + c.durationSec, 0) * 10) / 10;
}

// ─── ① 2025-26 に伸びている構成テンプレ ───────────────────
export interface TemplateBeat {
  sec: number;
  shotHint: string;
  telopHint: string;
}

export interface ReelTemplate {
  id: string;
  label: string;
  /** なぜ伸びるか (一言・正直な理屈) */
  why: string;
  beats: TemplateBeat[];
}

export const REEL_TEMPLATES: ReelTemplate[] = [
  {
    id: 'conclusion-first',
    label: '結論ドン (3秒フック)',
    why: '冒頭1秒で答えを見せると離脱が減り、最後まで見る人が増える',
    beats: [
      { sec: 1.5, shotHint: '顔寄り or 結果のアップ', telopHint: '結論を一言 (〜はコレ)' },
      { sec: 2.5, shotHint: '引きで全体', telopHint: '理由①' },
      { sec: 2.5, shotHint: '手元アップ', telopHint: '理由②' },
      { sec: 2.5, shotHint: '別アングル', telopHint: '理由③' },
      { sec: 2.0, shotHint: '結果をもう一度', telopHint: 'だから◯◯' },
      { sec: 2.0, shotHint: '顔寄り', telopHint: '保存して見返してね' },
    ],
  },
  {
    id: 'before-after',
    label: 'Before / After',
    why: '変化のギャップが最後まで見る理由になり、保存・共有されやすい',
    beats: [
      { sec: 1.5, shotHint: 'After を一瞬見せる (チラ見せ)', telopHint: 'こうなります' },
      { sec: 2.0, shotHint: 'Before 全体', telopHint: 'やる前はこう' },
      { sec: 2.5, shotHint: '手元アップ (工程1)', telopHint: 'まず◯◯' },
      { sec: 2.5, shotHint: '手元アップ (工程2)', telopHint: 'つぎに◯◯' },
      { sec: 2.0, shotHint: 'After 全体 (ディゾルブで)', telopHint: '完成' },
      { sec: 2.0, shotHint: 'Before→After 並べる', telopHint: '保存してマネしてね' },
    ],
  },
  {
    id: 'pov',
    label: 'POV (視点なりきり)',
    why: '「自分ごと」として見るので視聴維持が高く、コメントが集まる',
    beats: [
      { sec: 2.0, shotHint: '目線カメラ (一人称)', telopHint: 'POV: ◯◯なあなた' },
      { sec: 2.5, shotHint: '目線のまま状況を見せる', telopHint: 'あるあるの状況' },
      { sec: 2.5, shotHint: '転換の瞬間', telopHint: 'そこで◯◯' },
      { sec: 2.5, shotHint: '結果を目線で', telopHint: 'こうなる' },
      { sec: 2.0, shotHint: '顔寄り or 締めの一枚', telopHint: '共感したらコメントで教えて' },
    ],
  },
  {
    id: 'listicle',
    label: 'リスト形式 (◯選)',
    why: '「あとで見返す」需要で保存率が高い。保存はアルゴリズムに一番効く',
    beats: [
      { sec: 1.5, shotHint: '表紙 (全部を一瞬見せる)', telopHint: '◯◯な3選' },
      { sec: 2.5, shotHint: '1つ目のアップ (スライド切替)', telopHint: '① ◯◯' },
      { sec: 2.5, shotHint: '2つ目のアップ', telopHint: '② ◯◯' },
      { sec: 2.5, shotHint: '3つ目のアップ', telopHint: '③ ◯◯' },
      { sec: 2.0, shotHint: '全部並べる', telopHint: '保存していつでも見返してね' },
    ],
  },
  {
    id: 'aruaru',
    label: '共感あるある',
    why: '「わかる」がシェアの動機になる。友達へのメンションが伸びを作る',
    beats: [
      { sec: 1.5, shotHint: '顔寄り (困り顔)', telopHint: '◯◯な人にしか分からないこと' },
      { sec: 2.5, shotHint: 'あるある①を実演', telopHint: 'あるある①' },
      { sec: 2.5, shotHint: 'あるある②を実演', telopHint: 'あるある②' },
      { sec: 2.5, shotHint: 'あるある③を実演 (一番強いの)', telopHint: 'あるある③' },
      { sec: 2.0, shotHint: '顔寄り (笑顔)', telopHint: 'わかる人はメンションして' },
    ],
  },
  {
    id: 'loop',
    label: 'ループ誘発',
    why: '最後と最初がつながると2周目に入り、視聴時間が跳ね上がる',
    beats: [
      { sec: 1.5, shotHint: '結末の直前で始める', telopHint: 'この後どうなった?' },
      { sec: 2.5, shotHint: '巻き戻して経緯①', telopHint: '実はこうだった' },
      { sec: 2.5, shotHint: '経緯②', telopHint: 'そして…' },
      { sec: 2.5, shotHint: '冒頭と同じ画に戻る (マッチカット)', telopHint: '(冒頭につながる一言)' },
    ],
  },
  {
    id: 'routine',
    label: '密着ルーティン',
    why: '世界観で固定ファンがつく。テンポ良い早回しが視聴維持を作る',
    beats: [
      { sec: 1.5, shotHint: '1日の結果 or 一番いい画', telopHint: '◯◯な私の朝' },
      { sec: 2.0, shotHint: '工程1 (手元・早回し)', telopHint: '7:00 ◯◯' },
      { sec: 2.0, shotHint: '工程2', telopHint: '7:15 ◯◯' },
      { sec: 2.0, shotHint: '工程3', telopHint: '7:30 ◯◯' },
      { sec: 2.0, shotHint: '工程4', telopHint: '8:00 ◯◯' },
      { sec: 2.0, shotHint: '締めの一枚 (満足顔)', telopHint: 'フォローで毎朝見れます' },
    ],
  },
  {
    id: 'myth-bust',
    label: 'よくある誤解を斬る',
    why: '「えっ違うの?」の意外性がコメント欄の議論を生み、拡散される',
    beats: [
      { sec: 1.5, shotHint: '顔寄り (断言)', telopHint: '実は◯◯は逆効果' },
      { sec: 2.5, shotHint: '誤解のやり方を見せる', telopHint: 'みんなこうしてるけど' },
      { sec: 2.5, shotHint: '正解のやり方 (ズームイン)', telopHint: '正解はこう' },
      { sec: 2.5, shotHint: '違いを並べる', telopHint: 'ここが違う' },
      { sec: 2.0, shotHint: '顔寄り', telopHint: '知らなかったら保存' },
    ],
  },
];

/**
 * 構成テンプレを既存のカット列に適用する。
 * - 既にあるカットの中身 (セリフ/テロップ/画角) は消さない。秒数と切替のリズムだけ型に合わせる
 * - カットが型より少なければ、ヒント入りの空カットを足す
 * - カットが型より多ければ、余った分は最後のビートのリズムを引き継ぐ
 */
export function applyTemplate(cuts: ReelCut[], tpl: ReelTemplate): ReelCut[] {
  const out: ReelCut[] = [];
  const n = Math.max(cuts.length, tpl.beats.length);
  for (let i = 0; i < n; i++) {
    const beat = tpl.beats[Math.min(i, tpl.beats.length - 1)];
    const src = cuts[i];
    if (src) {
      out.push({
        ...src,
        durationSec: beat.sec,
        shot: src.shot || beat.shotHint,
        telop: src.telop || beat.telopHint,
      });
    } else {
      out.push({
        id: cutUid(),
        durationSec: beat.sec,
        shot: beat.shotHint,
        line: '',
        telop: beat.telopHint,
        transition: tpl.id === 'listicle' ? 'slide' : tpl.id === 'loop' ? 'match' : 'cut',
        editNote: '',
      });
    }
  }
  return out;
}

// ─── ③ テロップのスタイルプリセット (Canva 風) ─────────────
export type TelopStyleId = 'impact' | 'subtitle' | 'highlight' | 'hand' | 'minimal' | 'serif';

export interface TelopStyle {
  id: TelopStyleId;
  label: string;
  desc: string;
  /** プレビュー描画用 CSS (9:16 枠に重ねる)。動画への焼き込みではない */
  fontFamily: string;
  fontWeight: number;
  fontSize: number;         // 枠幅 260px 基準の px
  color: string;
  textShadow?: string;
  background?: string;      // テキスト背景 (ハイライト系)
  padding?: string;
  borderRadius?: number;
  letterSpacing?: string;
  /** オンデマンドで読み込む Google Fonts URL (未指定なら読み込み不要) */
  fontHref?: string;
}

export const TELOP_STYLES: TelopStyle[] = [
  {
    id: 'impact',
    label: '大文字ドン',
    desc: 'フック向き。1〜7文字を画面いっぱいに',
    fontFamily: '"Dela Gothic One", "Noto Sans JP", sans-serif',
    fontWeight: 400,
    fontSize: 30,
    color: '#FFFFFF',
    textShadow: '0 0 4px rgba(0,0,0,0.85), 0 3px 10px rgba(0,0,0,0.6), 2px 2px 0 #E1306C',
    fontHref: 'https://fonts.googleapis.com/css2?family=Dela+Gothic+One&display=swap',
  },
  {
    id: 'subtitle',
    label: '字幕スタイル',
    desc: 'セリフ向き。読みやすさ最優先の定番',
    fontFamily: '"Noto Sans JP", sans-serif',
    fontWeight: 800,
    fontSize: 17,
    color: '#FFFFFF',
    textShadow: '0 0 3px rgba(0,0,0,0.9), 0 2px 6px rgba(0,0,0,0.7)',
  },
  {
    id: 'highlight',
    label: '強調ハイライト',
    desc: 'キーワード向き。黄色地で目に刺さる',
    fontFamily: '"Noto Sans JP", sans-serif',
    fontWeight: 900,
    fontSize: 18,
    color: '#1F1A2E',
    background: '#FDE047',
    padding: '4px 10px',
    borderRadius: 6,
  },
  {
    id: 'hand',
    label: '手書き風',
    desc: 'Vlog・日常系向き。ゆるさと親近感',
    fontFamily: '"Yusei Magic", "Klee One", "Noto Sans JP", sans-serif',
    fontWeight: 400,
    fontSize: 20,
    color: '#FFF8F0',
    textShadow: '0 0 3px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.55)',
    fontHref: 'https://fonts.googleapis.com/css2?family=Yusei+Magic&display=swap',
  },
  {
    id: 'minimal',
    label: 'ミニマル',
    desc: '美容・ファッション向き。細く上品に',
    fontFamily: '"Noto Sans JP", sans-serif',
    fontWeight: 500,
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: '0.18em',
    textShadow: '0 1px 6px rgba(0,0,0,0.65)',
  },
  {
    id: 'serif',
    label: '明朝エレガント',
    desc: '世界観重視。引用・締めの一言に',
    fontFamily: '"Shippori Mincho", "Noto Serif JP", serif',
    fontWeight: 700,
    fontSize: 19,
    color: '#FFF9F2',
    textShadow: '0 1px 8px rgba(0,0,0,0.7)',
    fontHref: 'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@700&display=swap',
  },
];

const loadedTelopFonts = new Set<string>();
export function loadTelopFont(style: TelopStyle): void {
  if (!style.fontHref || loadedTelopFonts.has(style.fontHref)) return;
  try {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = style.fontHref;
    document.head.appendChild(l);
    loadedTelopFonts.add(style.fontHref);
  } catch { /* フォント未読込でもフォールバックで表示される */ }
}

// ─── ⑤ 仕上げチェック (ルールベース・嘘の AI 演出をしない) ──
export interface ReelCheckItem {
  id: string;
  label: string;
  pass: boolean;
  /** 直し方 (落ちている時のみ表示) */
  fix: string;
}

const CTA_WORDS = /保存|フォロー|コメント|プロフ|プロフィール|チェック|DM|リンク|メンション|シェア|いいね|試して|見返/;

export function runReelChecks(p: ReelProject): ReelCheckItem[] {
  const total = totalDuration(p.cuts);
  const first = p.cuts[0];
  const last = p.cuts[p.cuts.length - 1];
  const longTelops = p.cuts.filter(c => (c.telop || '').replace(/\s/g, '').length > 13);
  const avg = p.cuts.length ? total / p.cuts.length : 0;
  const emptyTelops = p.cuts.filter(c => !(c.telop || '').trim()).length;
  const hasCta = CTA_WORDS.test(`${last?.telop || ''} ${last?.line || ''} ${p.caption || ''}`);

  return [
    {
      id: 'hook-first',
      label: '冒頭カットが2秒以内 + テロップあり (1秒目で結論)',
      pass: !!first && first.durationSec <= 2 && !!(first.telop || '').trim(),
      fix: 'カット1を2秒以内に縮め、結論やフックのテロップを入れる。最初の1秒が離脱の9割を決めます',
    },
    {
      id: 'telop-13',
      label: 'テロップが全カット13文字以内 (一瞬で読める)',
      pass: longTelops.length === 0,
      fix: longTelops.length
        ? `カット${p.cuts.map((c, i) => longTelops.includes(c) ? i + 1 : 0).filter(Boolean).join('・')}のテロップが13文字を超えています。短く言い切る形に`
        : '',
    },
    {
      id: 'telop-all',
      label: '全カットにテロップがある (無音でも伝わる)',
      pass: emptyTelops === 0,
      fix: `テロップの無いカットが${emptyTelops}個あります。多くの人は音を出さずに見ます`,
    },
    {
      id: 'cta',
      label: 'CTA がある (保存・フォロー等の一言)',
      pass: hasCta,
      fix: '最後のカットか投稿文に「保存してね」「フォローで続きが見れます」等の一言を入れる',
    },
    {
      id: 'duration',
      label: `合計が15〜30秒 (現在 ${total.toFixed(1)}秒)`,
      pass: total >= 15 && total <= 30,
      fix: total < 15
        ? 'リールは短すぎると内容が薄く見えます。カットを足すか各カットを少し長く'
        : '30秒を超えると視聴完了率が下がります。カットを削るか短く',
    },
    {
      id: 'tempo',
      label: `1カット平均1.5〜2.5秒のテンポ (現在 ${avg.toFixed(1)}秒)`,
      pass: avg >= 1.2 && avg <= 3.0,
      fix: avg > 3.0
        ? '1カットが長いと途中で飽きられます。カットを割って刻む'
        : 'カットが速すぎて読み切れない可能性。少しだけ長く',
    },
    {
      id: 'hashtags',
      label: 'ハッシュタグが5個以上',
      pass: (p.hashtags || []).length >= 5,
      fix: 'ジャンルの具体タグを大・中・小サイズで5〜12個',
    },
  ];
}

// ─── ④ 書き出し ─────────────────────────────────────────
function srtTime(sec: number): string {
  const s = Math.max(0, sec);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(hh)}:${p(mm)}:${p(ss)},${p(ms, 3)}`;
}

/** カット列 → SRT (テロップ優先、無ければセリフ。無い文言は作らない) */
export function projectToSrt(p: ReelProject): string {
  const blocks: string[] = [];
  let cursor = 0;
  let n = 0;
  for (const c of p.cuts) {
    const start = cursor;
    cursor += c.durationSec;
    const text = (c.telop || c.line || '').trim();
    if (!text) continue;
    n += 1;
    blocks.push(`${n}\n${srtTime(start)} --> ${srtTime(cursor)}\n${text}`);
  }
  return blocks.join('\n\n');
}

/** テロップ全文 (1行1カット。CapCut/Edits に手貼りする用) */
export function projectTelopText(p: ReelProject): string {
  return p.cuts.map(c => (c.telop || '').trim()).filter(Boolean).join('\n');
}

/** 撮影指示書 (カット表)。撮影者・編集者がそのまま動ける粒度 */
export function projectToCutSheet(p: ReelProject, clientName?: string): string {
  const L: string[] = [];
  const total = totalDuration(p.cuts);
  L.push(`# 撮影指示書 (カット表): ${p.title}`);
  if (clientName) L.push(`クライアント: ${clientName}`);
  L.push(`全${p.cuts.length}カット / 合計 約${total.toFixed(1)}秒\n`);
  let acc = 0;
  p.cuts.forEach((c, i) => {
    const start = acc;
    acc += c.durationSec;
    L.push(`## カット${i + 1} [${fmtSec(start)}〜${fmtSec(acc)}秒 / ${c.durationSec.toFixed(1)}s]`);
    if (c.shot) L.push(`- 画角・撮り方: ${c.shot}`);
    if (c.line) L.push(`- セリフ: 「${c.line}」`);
    if (c.telop) L.push(`- テロップ: ${c.telop}`);
    L.push(`- 次への切替: ${transitionLabel(c.transition)}`);
    if (c.editNote) L.push(`- 編集メモ: ${c.editNote}`);
    L.push('');
  });
  L.push('---');
  L.push('切替効果は CapCut なら「トランジション」、Edits なら「切り替え」から同名のものを選んでください。');
  return L.join('\n');
}

/** 投稿本文 + ハッシュタグの1ブロック */
export function projectCaptionBlock(p: ReelProject): string {
  const cap = (p.caption || '').trim();
  const tags = (p.hashtags || []).join(' ').trim();
  return [cap, tags].filter(Boolean).join('\n\n');
}
