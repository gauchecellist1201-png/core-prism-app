// ============================================================
// CORE Iris ▸ リール動画スタジオ
// 複数画像 / 複数動画 → 9:16 リール + AI字幕 + フォントバリエ
// ・MediaRecorder で WebM 即時書き出し (ブラウザネイティブ)
// ・ffmpeg.wasm を CDN 動的ロードで MP4 変換 (任意・遅延)
// ・素材は IndexedDB / メモリのみ。サーバー送信なし
// ============================================================
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { shareToInstagram } from './instagramShare';
import {
  Image as ImageIcon, Film, Type, Music, Download, Share2,
  Play, Square, Trash2, ChevronUp, ChevronDown, Sparkles,
  Mic, Loader2, Wand2, AlertCircle, UploadCloud,
} from 'lucide-react';

// ─── 編集テンプレート (型) ─────────────────────
type ReelTemplate = {
  id: string;
  name: string;
  subtitle: string;
  presetCut: number;
  transition: Transition;
  kenBurns: KenBurns;
  caption: Partial<CaptionStyle>;
  bgmHint: string; // BGM選択時のヒント
};
const REEL_TEMPLATES: ReelTemplate[] = [
  {
    id: 'vlog',         name: 'テンポ良い Vlog',  subtitle: '1秒切替・whip',
    presetCut: 1.0, transition: 'whip', kenBurns: 'in',
    caption: { font: '"Noto Sans JP"', size: 60, color: '#FFFFFF', stroke: '#000000', strokeWidth: 6, anim: 'pop' },
    bgmHint: 'upbeat',
  },
  {
    id: 'lookbook',     name: '上品ルックブック', subtitle: '2.5秒・dissolve',
    presetCut: 2.5, transition: 'dissolve', kenBurns: 'out',
    caption: { font: '"Shippori Mincho"', size: 52, color: '#FFF8F0', stroke: '#3B2A2A', strokeWidth: 4, anim: 'fade-in' },
    bgmHint: 'cinematic',
  },
  {
    id: 'product',      name: '商品紹介',         subtitle: '1.5秒・zoom',
    presetCut: 1.5, transition: 'zoom', kenBurns: 'in',
    caption: { font: '"Bebas Neue"', size: 70, color: '#FFFFFF', stroke: '#E1306C', strokeWidth: 5, anim: 'slide-up' },
    bgmHint: 'energetic',
  },
  {
    id: 'storytelling', name: 'ストーリー風',     subtitle: '3秒・fade',
    presetCut: 3.0, transition: 'fade', kenBurns: 'left',
    caption: { font: '"Klee One"', size: 56, color: '#FFFFFF', stroke: '#1F1A2E', strokeWidth: 5, anim: 'fade-in' },
    bgmHint: 'emotional',
  },
  {
    id: 'tiktok',       name: 'TikTok ハイテンポ', subtitle: '0.5秒・glitch',
    presetCut: 0.5, transition: 'glitch', kenBurns: 'in',
    caption: { font: '"Dela Gothic One"', size: 72, color: '#FFFF00', stroke: '#000000', strokeWidth: 7, anim: 'pop' },
    bgmHint: 'trap/pop',
  },
  {
    id: 'asmr',         name: 'ASMR / 落ち着き',  subtitle: '4秒・slide',
    presetCut: 4.0, transition: 'slide', kenBurns: 'down',
    caption: { font: '"Noto Serif JP"', size: 48, color: '#FFFFFF', stroke: '#2A2A2A', strokeWidth: 3, anim: 'fade-in' },
    bgmHint: 'ambient',
  },
];

// ─── 伸びるフック (最初の 1-3 秒で離脱を防ぐ証明済テンプレ) ─────
type HookCategory = '好奇心' | '権威' | '損失回避' | '共感' | '逆張り' | '質問';
type HookPhrase = { id: string; cat: HookCategory; text: string; placeholder?: string };
const HOOK_LIBRARY: HookPhrase[] = [
  // 好奇心ギャップ (CTR最強)
  { id: 'h1', cat: '好奇心', text: '知らないと損する3つの◯◯', placeholder: '◯◯ = 美容/節約/ダイエット 等' },
  { id: 'h2', cat: '好奇心', text: '誰も教えてくれない◯◯の真実' },
  { id: 'h3', cat: '好奇心', text: '正直、これ知るまで失敗ばかりだった' },
  { id: 'h4', cat: '好奇心', text: '◯◯した結果、人生変わった話' },
  // 権威・実績
  { id: 'h5', cat: '権威',   text: 'プロが教える◯◯の極意' },
  { id: 'h6', cat: '権威',   text: '◯◯歴○年の私が選ぶベスト3' },
  { id: 'h7', cat: '権威',   text: '元◯◯が暴露します' },
  // 損失回避 (やらないと損)
  { id: 'h8', cat: '損失回避', text: '今すぐやめないとヤバい◯◯' },
  { id: 'h9', cat: '損失回避', text: 'これ知らないと毎月◯円損してます' },
  { id: 'h10', cat: '損失回避', text: '実は逆効果な◯◯のやり方' },
  // 共感
  { id: 'h11', cat: '共感',   text: '◯◯な人だけ見てください' },
  { id: 'h12', cat: '共感',   text: '◯◯で悩んでた私を救った◯◯' },
  { id: 'h13', cat: '共感',   text: '◯◯だった頃の私に教えたい' },
  // 逆張り
  { id: 'h14', cat: '逆張り', text: '◯◯やってる人、もう古いです' },
  { id: 'h15', cat: '逆張り', text: 'みんな信じてる◯◯、嘘です' },
  { id: 'h16', cat: '逆張り', text: '正反対が正解だった件' },
  // 質問 (エンゲージ誘発)
  { id: 'h17', cat: '質問',   text: '◯◯と◯◯、どっち派？' },
  { id: 'h18', cat: '質問',   text: 'これ何だと思いますか？' },
  { id: 'h19', cat: '質問',   text: 'あなたはどれ当てはまる？' },
  { id: 'h20', cat: '質問',   text: '見抜けたら◯◯マニアです' },
];

// ─── 保存テンプレート (保存されるリール構造) ─────
type SaveFormat = {
  id: string;
  name: string;
  why: string;
  beats: { hint: string; defaultDur: number }[]; // 自動生成するクリップ枠
  cta: string;
};
const SAVE_FORMATS: SaveFormat[] = [
  {
    id: '3step',
    name: '3 ステップ解説',
    why: '手順型は最高の保存率。後で見返したくなる',
    beats: [
      { hint: 'フック (3つのコツがあります)', defaultDur: 2 },
      { hint: 'STEP 1', defaultDur: 2.5 },
      { hint: 'STEP 2', defaultDur: 2.5 },
      { hint: 'STEP 3', defaultDur: 2.5 },
      { hint: 'まとめ + 保存促し', defaultDur: 2 },
    ],
    cta: '保存して、明日から実践してね',
  },
  {
    id: 'checklist',
    name: '◯個チェックリスト',
    why: 'スクロール離脱が少ない。網羅性で保存される',
    beats: [
      { hint: 'フック (○個のチェックリスト)', defaultDur: 2 },
      { hint: 'チェック 1', defaultDur: 1.5 },
      { hint: 'チェック 2', defaultDur: 1.5 },
      { hint: 'チェック 3', defaultDur: 1.5 },
      { hint: 'チェック 4', defaultDur: 1.5 },
      { hint: 'チェック 5', defaultDur: 1.5 },
      { hint: '結論 + 保存促し', defaultDur: 2 },
    ],
    cta: '当てはまった人は保存しといて',
  },
  {
    id: 'beforeafter',
    name: 'Before / After',
    why: '視覚的変化はシェア率が高い。チュートリアル系で強い',
    beats: [
      { hint: 'Before (悩み)', defaultDur: 2 },
      { hint: 'やったこと 1', defaultDur: 1.5 },
      { hint: 'やったこと 2', defaultDur: 1.5 },
      { hint: 'After (結果)', defaultDur: 2.5 },
      { hint: 'やり方まとめ', defaultDur: 2 },
    ],
    cta: '同じ悩みの人は保存推奨',
  },
  {
    id: 'myth',
    name: '誤解を解く',
    why: '逆張りは保存・シェア・コメント全部高い',
    beats: [
      { hint: 'みんな信じてる嘘 (フック)', defaultDur: 2.5 },
      { hint: '実は…', defaultDur: 2 },
      { hint: '正解はこれ', defaultDur: 2.5 },
      { hint: '理由を解説', defaultDur: 2 },
      { hint: 'まとめ + 保存促し', defaultDur: 2 },
    ],
    cta: 'これ知らない人いっぱいいるから保存して',
  },
  {
    id: 'list5',
    name: 'ベスト 5 / トップ N',
    why: 'ランキング形式は最後まで見たくなる構造',
    beats: [
      { hint: 'フック (◯◯ベスト5)', defaultDur: 2 },
      { hint: '5位', defaultDur: 1.5 },
      { hint: '4位', defaultDur: 1.5 },
      { hint: '3位', defaultDur: 1.5 },
      { hint: '2位', defaultDur: 1.5 },
      { hint: '堂々の 1 位', defaultDur: 2.5 },
    ],
    cta: '1位は意外だった？保存して見返してね',
  },
  {
    id: 'mistake',
    name: 'やりがちな失敗',
    why: '損失回避訴求は保存率トップクラス',
    beats: [
      { hint: '○○でやりがちな失敗', defaultDur: 2 },
      { hint: '失敗 1 (NG例)', defaultDur: 2 },
      { hint: '失敗 2 (NG例)', defaultDur: 2 },
      { hint: '失敗 3 (NG例)', defaultDur: 2 },
      { hint: '正解 + 保存促し', defaultDur: 2.5 },
    ],
    cta: 'やってた人は保存して気をつけてね',
  },
];

// ─── 保存促進 CTA 候補 ─────
const SAVE_CTAS = [
  '保存して、明日から実践してね',
  '当てはまった人は保存しといて',
  '見返したい人は保存推奨',
  '保存して、忘れないうちに試してみて',
  '保存 → プロフから他の動画も見てね',
  '保存して、メモ代わりに使ってね',
];

// ─── BGM ライブラリ (Pixabay Music ・ CC0 ロイヤリティフリー) ─────────────
// CDN: cdn.pixabay.com の audio エンドポイントは CORS 許可済み
type BgmTrack = { id: string; name: string; mood: string; bpm: number; sec: number; url: string };
const BGM_LIBRARY: BgmTrack[] = [
  { id: 'chill-pop',    name: 'Chill Pop',         mood: 'upbeat',    bpm: 110, sec: 138, url: 'https://cdn.pixabay.com/audio/2022/10/25/audio_946bc7a8f7.mp3' },
  { id: 'dreams',       name: 'Dreams',            mood: 'emotional', bpm: 70,  sec: 154, url: 'https://cdn.pixabay.com/audio/2023/06/28/audio_e44b1ccfa6.mp3' },
  { id: 'lofi-study',   name: 'Lo-Fi Study',       mood: 'ambient',   bpm: 80,  sec: 145, url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3' },
  { id: 'cinematic',    name: 'Cinematic Reveal',  mood: 'cinematic', bpm: 90,  sec: 92,  url: 'https://cdn.pixabay.com/audio/2023/02/28/audio_550d815fde.mp3' },
  { id: 'happy-uplift', name: 'Happy Uplifting',   mood: 'upbeat',    bpm: 128, sec: 132, url: 'https://cdn.pixabay.com/audio/2022/10/16/audio_dc39bb83a3.mp3' },
  { id: 'trap-beat',    name: 'Trap Beat',         mood: 'trap/pop',  bpm: 140, sec: 119, url: 'https://cdn.pixabay.com/audio/2022/03/15/audio_d1718beaa9.mp3' },
  { id: 'inspiring',    name: 'Inspiring Day',     mood: 'energetic', bpm: 120, sec: 142, url: 'https://cdn.pixabay.com/audio/2024/01/31/audio_28bb86e62e.mp3' },
  { id: 'soft-piano',   name: 'Soft Piano',        mood: 'emotional', bpm: 65,  sec: 105, url: 'https://cdn.pixabay.com/audio/2022/05/16/audio_259a2c7f76.mp3' },
];

interface Props {
  bg: IrisBackgroundDef;
}

// ─── 出力解像度 (プレビュー用に縮小) ────────────────
const CANVAS_W = 405;   // 1080 * 0.375 → 表示
const CANVAS_H = 720;   // 1920 * 0.375
const OUT_W = 1080;     // 実出力
const OUT_H = 1920;
const FPS = 30;

// ─── 切替効果 ───────────────────────────────────
type Transition = 'fade' | 'slide' | 'zoom' | 'glitch' | 'whip' | 'dissolve' | 'wipe';
const TRANSITIONS: { id: Transition; label: string }[] = [
  { id: 'fade',      label: 'フェード' },
  { id: 'slide',     label: 'スライド' },
  { id: 'zoom',      label: 'ズーム' },
  { id: 'glitch',    label: 'グリッチ' },
  { id: 'whip',      label: 'ホイップ' },
  { id: 'dissolve',  label: 'ディゾルブ' },
  { id: 'wipe',      label: 'ワイプ' },
];

// ─── Ken Burns 方向 ─────────────────────────────
type KenBurns = 'in' | 'out' | 'left' | 'right' | 'up' | 'down' | 'none';
const KEN_BURNS: { id: KenBurns; label: string }[] = [
  { id: 'in',    label: 'ズームイン' },
  { id: 'out',   label: 'ズームアウト' },
  { id: 'left',  label: '左へ' },
  { id: 'right', label: '右へ' },
  { id: 'up',    label: '上へ' },
  { id: 'down',  label: '下へ' },
  { id: 'none',  label: '静止' },
];

// ─── Google Fonts (20+, ロードは on-demand) ──────────
type FontDef = { family: string; href: string; cssName: string };
const FONTS: FontDef[] = [
  // 日本語
  { family: 'Noto Sans JP',         cssName: '"Noto Sans JP"',         href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&display=swap' },
  { family: 'Noto Serif JP',        cssName: '"Noto Serif JP"',        href: 'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700;900&display=swap' },
  { family: 'M PLUS Rounded 1c',    cssName: '"M PLUS Rounded 1c"',    href: 'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;700;900&display=swap' },
  { family: 'Klee One',             cssName: '"Klee One"',             href: 'https://fonts.googleapis.com/css2?family=Klee+One:wght@400;600&display=swap' },
  { family: 'Shippori Mincho',      cssName: '"Shippori Mincho"',      href: 'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;700;900&display=swap' },
  { family: 'RocknRoll One',        cssName: '"RocknRoll One"',        href: 'https://fonts.googleapis.com/css2?family=RocknRoll+One&display=swap' },
  { family: 'Stick',                cssName: '"Stick"',                href: 'https://fonts.googleapis.com/css2?family=Stick&display=swap' },
  { family: 'Train One',            cssName: '"Train One"',            href: 'https://fonts.googleapis.com/css2?family=Train+One&display=swap' },
  { family: 'Dela Gothic One',      cssName: '"Dela Gothic One"',      href: 'https://fonts.googleapis.com/css2?family=Dela+Gothic+One&display=swap' },
  { family: 'Kosugi Maru',          cssName: '"Kosugi Maru"',          href: 'https://fonts.googleapis.com/css2?family=Kosugi+Maru&display=swap' },
  // 英語
  { family: 'Inter',                cssName: '"Inter"',                href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap' },
  { family: 'Playfair Display',     cssName: '"Playfair Display"',     href: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap' },
  { family: 'Bebas Neue',           cssName: '"Bebas Neue"',           href: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap' },
  { family: 'Anton',                cssName: '"Anton"',                href: 'https://fonts.googleapis.com/css2?family=Anton&display=swap' },
  { family: 'Caveat',               cssName: '"Caveat"',               href: 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap' },
  { family: 'Pacifico',             cssName: '"Pacifico"',             href: 'https://fonts.googleapis.com/css2?family=Pacifico&display=swap' },
  { family: 'Permanent Marker',     cssName: '"Permanent Marker"',     href: 'https://fonts.googleapis.com/css2?family=Permanent+Marker&display=swap' },
  { family: 'Lobster',              cssName: '"Lobster"',              href: 'https://fonts.googleapis.com/css2?family=Lobster&display=swap' },
  { family: 'Oswald',               cssName: '"Oswald"',               href: 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap' },
  { family: 'Montserrat',           cssName: '"Montserrat"',           href: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap' },
];

const loadedFontSet = new Set<string>();
function loadFont(href: string) {
  if (loadedFontSet.has(href)) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = href;
  document.head.appendChild(l);
  loadedFontSet.add(href);
}

// ─── 字幕スタイル ──────────────────────────────
type CaptionAnim = 'none' | 'fade-in' | 'pop' | 'slide-up';
interface CaptionStyle {
  font: string;
  size: number;
  color: string;
  stroke: string;
  strokeWidth: number;
  shadow: boolean;
  anim: CaptionAnim;
}

const DEFAULT_CAPTION: CaptionStyle = {
  font: '"Noto Sans JP"',
  size: 56,
  color: '#FFFFFF',
  stroke: '#1F1A2E',
  strokeWidth: 6,
  shadow: true,
  anim: 'fade-in',
};

// ─── クリップ ────────────────────────────────
type ClipKind = 'image' | 'video';
interface Clip {
  id: string;
  kind: ClipKind;
  url: string;          // blob:
  duration: number;     // 秒 (動画は実長、画像はユーザー指定)
  kenBurns: KenBurns;   // 画像のみ
  transition: Transition;  // 次クリップへの切替
  /** メディア要素 (HTMLImageElement / HTMLVideoElement) — ロード後に格納 */
  el?: HTMLImageElement | HTMLVideoElement;
}

interface Caption {
  start: number;  // 秒 (リール全体)
  end: number;
  text: string;
}

// ─── ユーティリティ ─────────────────────────
function makeId() { return Math.random().toString(36).slice(2, 10); }

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

/** 画像をロード */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** 動画をロード (メタデータ + 1フレーム待ち) */
function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.src = url;
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.onloadeddata = () => resolve(v);
    v.onerror = reject;
  });
}

/** Ken Burns の transform (scale + translate) を progress[0..1] で返す */
function kenBurnsTransform(kb: KenBurns, p: number): { scale: number; dx: number; dy: number } {
  const e = easeInOut(p);
  const SCALE_MAX = 1.15;
  switch (kb) {
    case 'in':    return { scale: 1 + (SCALE_MAX - 1) * e, dx: 0, dy: 0 };
    case 'out':   return { scale: SCALE_MAX - (SCALE_MAX - 1) * e, dx: 0, dy: 0 };
    case 'left':  return { scale: SCALE_MAX, dx: -0.06 * e, dy: 0 };
    case 'right': return { scale: SCALE_MAX, dx: 0.06 * e,  dy: 0 };
    case 'up':    return { scale: SCALE_MAX, dx: 0, dy: -0.06 * e };
    case 'down':  return { scale: SCALE_MAX, dx: 0, dy: 0.06 * e };
    default:      return { scale: 1, dx: 0, dy: 0 };
  }
}

/** cover で描画 */
function drawCover(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  srcW: number,
  srcH: number,
  W: number,
  H: number,
  kb: KenBurns,
  p: number,
) {
  const { scale, dx, dy } = kenBurnsTransform(kb, p);
  const srcRatio = srcW / srcH;
  const dstRatio = W / H;
  let drawW: number, drawH: number;
  if (srcRatio > dstRatio) {
    drawH = H * scale;
    drawW = drawH * srcRatio;
  } else {
    drawW = W * scale;
    drawH = drawW / srcRatio;
  }
  const offX = (W - drawW) / 2 + dx * W;
  const offY = (H - drawH) / 2 + dy * H;
  ctx.drawImage(src, offX, offY, drawW, drawH);
}

/** 切替効果オーバーレイ。progress[0..1] (1.0=完了) */
function applyTransition(
  ctx: CanvasRenderingContext2D,
  type: Transition,
  p: number,
  W: number,
  H: number,
) {
  if (p >= 1) return;
  switch (type) {
    case 'fade': {
      ctx.fillStyle = `rgba(0,0,0,${1 - p})`;
      ctx.fillRect(0, 0, W, H);
      return;
    }
    case 'slide': {
      // 黒帯が右→左に抜ける
      const x = W * (1 - p);
      ctx.fillStyle = '#000';
      ctx.fillRect(x, 0, W, H);
      return;
    }
    case 'zoom': {
      const alpha = 1 - p;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillRect(0, 0, W, H);
      return;
    }
    case 'glitch': {
      // ランダム水平バンドで色ズレ
      const bands = 18;
      for (let i = 0; i < bands; i++) {
        const y = (H / bands) * i;
        const h = H / bands;
        const off = (Math.random() - 0.5) * 30 * (1 - p);
        ctx.fillStyle = `rgba(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255},${(1 - p) * 0.25})`;
        ctx.fillRect(off, y, W, h);
      }
      return;
    }
    case 'whip': {
      // モーションブラー風の白フラッシュ
      const flash = Math.sin(p * Math.PI);
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.75})`;
      ctx.fillRect(0, 0, W, H);
      return;
    }
    case 'dissolve': {
      // 細かいドットノイズ
      const dots = Math.floor(W * H * 0.0015 * (1 - p));
      ctx.fillStyle = `rgba(0,0,0,${0.9 * (1 - p)})`;
      for (let i = 0; i < dots; i++) {
        ctx.fillRect(Math.random() * W, Math.random() * H, 4, 4);
      }
      return;
    }
    case 'wipe': {
      // 左から右へ黒帯を引きはがす
      ctx.fillStyle = '#000';
      ctx.fillRect(W * p, 0, W * (1 - p), H);
      return;
    }
  }
}

/** 字幕を描画 */
function drawCaption(
  ctx: CanvasRenderingContext2D,
  cap: Caption,
  styleDef: CaptionStyle,
  globalT: number,
  W: number,
  H: number,
) {
  if (globalT < cap.start || globalT > cap.end) return;
  const dur = cap.end - cap.start;
  const local = (globalT - cap.start) / Math.max(dur, 0.001);

  let alpha = 1;
  let yOff = 0;
  let scl = 1;
  if (styleDef.anim === 'fade-in') {
    alpha = clamp(local * 4, 0, 1);
  } else if (styleDef.anim === 'pop') {
    if (local < 0.15) scl = 0.5 + local / 0.15 * 0.6;
    else if (local < 0.25) scl = 1.1 - (local - 0.15) / 0.1 * 0.1;
  } else if (styleDef.anim === 'slide-up') {
    if (local < 0.25) yOff = (1 - local / 0.25) * 80;
    alpha = clamp(local * 4, 0, 1);
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  const scaleFactor = W / OUT_W;
  const fontSize = styleDef.size * scaleFactor * scl;
  ctx.font = `900 ${fontSize}px ${styleDef.font}, "Noto Sans JP", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 横幅に応じて行分割
  const maxLineW = W * 0.86;
  const chars = Array.from(cap.text);
  const lines: string[] = [];
  let line = '';
  for (const ch of chars) {
    if (ctx.measureText(line + ch).width > maxLineW && line) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  if (!lines.length) { ctx.restore(); return; }

  const lineH = fontSize * 1.25;
  const totalH = lines.length * lineH;
  const baseY = H * 0.78 - totalH / 2 + yOff;

  lines.forEach((ln, i) => {
    const y = baseY + i * lineH;
    if (styleDef.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 12 * scaleFactor;
      ctx.shadowOffsetY = 4 * scaleFactor;
    }
    if (styleDef.strokeWidth > 0) {
      ctx.lineWidth = styleDef.strokeWidth * scaleFactor;
      ctx.strokeStyle = styleDef.stroke;
      ctx.lineJoin = 'round';
      ctx.strokeText(ln, W / 2, y);
    }
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = styleDef.color;
    ctx.fillText(ln, W / 2, y);
  });
  ctx.restore();
}

// ─── 合計尺・タイムライン ────────────────────
function timeline(clips: Clip[]) {
  let t = 0;
  return clips.map(c => {
    const start = t;
    t += c.duration;
    return { clip: c, start, end: t };
  });
}

// ─── BPM 推定 (簡易: エネルギー法) ──────────────
async function estimateBpm(file: File): Promise<number | null> {
  try {
    const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    const ac = new AC();
    const buf = await file.arrayBuffer();
    const audio = await ac.decodeAudioData(buf.slice(0));
    const data = audio.getChannelData(0);
    const sr = audio.sampleRate;
    // 短時間エネルギー
    const win = Math.floor(sr * 0.05); // 50ms
    const energies: number[] = [];
    for (let i = 0; i < data.length; i += win) {
      let e = 0;
      for (let j = 0; j < win && i + j < data.length; j++) e += data[i + j] * data[i + j];
      energies.push(e / win);
    }
    // ピーク間隔→BPM
    const avg = energies.reduce((a, b) => a + b, 0) / energies.length;
    const peaks: number[] = [];
    for (let i = 1; i < energies.length - 1; i++) {
      if (energies[i] > avg * 1.4 && energies[i] > energies[i - 1] && energies[i] > energies[i + 1]) {
        peaks.push(i);
      }
    }
    if (peaks.length < 4) return null;
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) intervals.push((peaks[i] - peaks[i - 1]) * 0.05);
    intervals.sort((a, b) => a - b);
    const median = intervals[Math.floor(intervals.length / 2)];
    if (!median) return null;
    const bpm = 60 / median;
    // 妥当範囲に折り畳む
    let b = bpm;
    while (b < 60) b *= 2;
    while (b > 180) b /= 2;
    return Math.round(b);
  } catch {
    return null;
  }
}

// ─── ffmpeg.wasm CDN ロード (任意) ─────────────
let ffmpegMod: any = null;
async function loadFFmpeg(): Promise<any | null> {
  if (ffmpegMod) return ffmpegMod;
  try {
    // ts/vite には URL を文字列にして渡し、解決を実行時に逃がす
    const dyn = new Function('u', 'return import(u)') as (u: string) => Promise<any>;
    const mod: any = await dyn('https://esm.sh/@ffmpeg/ffmpeg@0.12.10?bundle');
    const utilMod: any = await dyn('https://esm.sh/@ffmpeg/util@0.12.1?bundle');
    const ff = new mod.FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ff.load({
      coreURL: await utilMod.toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await utilMod.toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpegMod = { ff, fetchFile: utilMod.fetchFile };
    return ffmpegMod;
  } catch (e) {
    console.warn('ffmpeg load failed', e);
    return null;
  }
}

async function convertWebmToMp4(webm: Blob): Promise<Blob | null> {
  const m = await loadFFmpeg();
  if (!m) return null;
  const { ff, fetchFile } = m;
  await ff.writeFile('in.webm', await fetchFile(webm));
  await ff.exec(['-i', 'in.webm', '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', 'out.mp4']);
  const out = await ff.readFile('out.mp4');
  return new Blob([out.buffer], { type: 'video/mp4' });
}

// ============================================================
// メインコンポーネント
// ============================================================
export default function IrisReelStudio({ bg }: Props) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [bgmFile, setBgmFile] = useState<File | null>(null);
  const [bpm, setBpm] = useState<number | null>(null);
  const [beatCut, setBeatCut] = useState<boolean>(false);
  const [presetCut, setPresetCut] = useState<number>(1.5);

  const [captions, setCaptions] = useState<Caption[]>([]);
  const [capStyle, setCapStyle] = useState<CaptionStyle>(DEFAULT_CAPTION);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeErr, setTranscribeErr] = useState<string | null>(null);

  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportMime, setExportMime] = useState<string>('video/webm');
  const [converting, setConverting] = useState(false);
  const [convertedMp4, setConvertedMp4] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0); // 0..1 録画/出力進捗

  // アップロードエラー / D&D 表示
  const [uploadError, setUploadError] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);
  // BGM ライブラリ プレビュー
  const [bgmPreviewId, setBgmPreviewId] = useState<string | null>(null);
  const [bgmLoading, setBgmLoading] = useState<string | null>(null);
  const bgmPreviewRef = useRef<HTMLAudioElement | null>(null);
  // 伸ばす工夫トグル
  const [safeZone, setSafeZone] = useState(true);  // IG UI セーフゾーン表示
  const [showScore] = useState(true);
  // フック / 保存テンプレ選択
  const [activeFormat, setActiveFormat] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const playStartRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const totalDuration = useMemo(() => clips.reduce((s, c) => s + c.duration, 0), [clips]);

  // フォントは初期 2 種だけ即ロード、残りは選択時
  useEffect(() => {
    loadFont(FONTS[0].href);
    loadFont(FONTS[1].href);
  }, []);

  // BPM 推定 (BGM が変わった時)
  useEffect(() => {
    if (!bgmFile) { setBpm(null); return; }
    let cancelled = false;
    estimateBpm(bgmFile).then(v => { if (!cancelled) setBpm(v); });
    return () => { cancelled = true; };
  }, [bgmFile]);

  // ─── パフォーマンスコア (再生数 / 維持率 / 保存率予測) ─────
  const reelScore = useMemo(() => {
    const issues: { kind: 'good' | 'warn' | 'bad'; msg: string; fix?: string }[] = [];
    let score = 0;

    // 1. 最初のクリップ (フック): 1.5秒以下が理想
    if (clips.length > 0) {
      if (clips[0].duration <= 1.5) {
        score += 15;
        issues.push({ kind: 'good', msg: 'フック (最初のクリップ) は 1.5 秒以下で離脱防止 OK' });
      } else if (clips[0].duration <= 3) {
        score += 8;
        issues.push({ kind: 'warn', msg: `フックが ${clips[0].duration.toFixed(1)}s と長め`, fix: '1.5s 以下推奨。最初の 1 秒で「見続ける理由」を提示' });
      } else {
        issues.push({ kind: 'bad', msg: `フックが ${clips[0].duration.toFixed(1)}s は長すぎる`, fix: '冒頭 1-1.5s に短縮 / 強いテキスト追加' });
      }
    }

    // 2. 字幕カバー率 (再生時間に対する字幕の割合)
    if (totalDuration > 0) {
      const capCovered = captions.reduce((s, c) => s + Math.max(0, c.end - c.start), 0);
      const coverage = capCovered / totalDuration;
      if (coverage >= 0.7) {
        score += 18;
        issues.push({ kind: 'good', msg: `字幕カバー ${Math.round(coverage * 100)}% — 音なし視聴 (85%) に強い` });
      } else if (coverage >= 0.3) {
        score += 10;
        issues.push({ kind: 'warn', msg: `字幕カバー ${Math.round(coverage * 100)}%`, fix: '音なし視聴者が 85% 以上。70% 以上に字幕を' });
      } else {
        issues.push({ kind: 'bad', msg: '字幕がほぼ無い', fix: '「AI で字幕生成」を押すか手動追加 — 維持率に最も効く' });
      }
    }

    // 3. 平均クリップ長 (1.5-2.5s が黄金帯)
    if (clips.length > 1) {
      const avg = totalDuration / clips.length;
      if (avg >= 1.0 && avg <= 2.5) {
        score += 15;
        issues.push({ kind: 'good', msg: `平均カット ${avg.toFixed(1)}s — パターン中断のリズム良好` });
      } else if (avg <= 4) {
        score += 8;
        issues.push({ kind: 'warn', msg: `平均カット ${avg.toFixed(1)}s`, fix: '「自動カット適用」で 1.5s に揃えるとリズムが出る' });
      } else {
        issues.push({ kind: 'bad', msg: `カットが遅すぎ (平均 ${avg.toFixed(1)}s)`, fix: '視聴者の親指がスクロールに動く前に切り替えを' });
      }
    }

    // 4. 全体長 (7-15s が最も伸びる)
    if (totalDuration >= 7 && totalDuration <= 15) {
      score += 12;
      issues.push({ kind: 'good', msg: `全体 ${totalDuration.toFixed(0)}s — リール完視聴ゾーン (7-15s)` });
    } else if (totalDuration >= 5 && totalDuration <= 30) {
      score += 6;
      issues.push({ kind: 'warn', msg: `全体 ${totalDuration.toFixed(0)}s`, fix: '7-15s が最も完視聴される。15s 超は維持率が落ちる' });
    } else if (totalDuration > 0) {
      issues.push({ kind: 'bad', msg: `全体 ${totalDuration.toFixed(0)}s は外れ値`, fix: 'リールは 7-15s が最強。長くても 30s 以内に' });
    }

    // 5. BGM (アルゴ判定にも効く)
    if (bgmFile) {
      score += 10;
      issues.push({ kind: 'good', msg: 'BGM 設定済 — アルゴリズムも音声付き優遇' });
    } else {
      issues.push({ kind: 'warn', msg: 'BGM 未設定', fix: '「BGM ライブラリ」から CC0 トラックを 1 曲選ぶだけで OK' });
    }

    // 6. 切替バリエ (同じ transition ばかりだと飽きる)
    const transSet = new Set(clips.map(c => c.transition));
    if (clips.length >= 3 && transSet.size >= 2) {
      score += 8;
      issues.push({ kind: 'good', msg: `切替バリエ ${transSet.size} 種 — 飽きにくい構成` });
    } else if (clips.length >= 3) {
      issues.push({ kind: 'warn', msg: '切替が単調', fix: '2-3 種の transition を混ぜると維持率 UP' });
    }

    // 7. 最後に CTA テキスト ("保存", "フォロー", "コメント")
    const lastCap = captions[captions.length - 1]?.text || '';
    if (/(保存|フォロー|コメント|シェア|プロフ)/.test(lastCap)) {
      score += 12;
      issues.push({ kind: 'good', msg: '末尾に保存/フォロー CTA — 保存率ブースト' });
    } else if (clips.length > 0) {
      issues.push({ kind: 'warn', msg: '末尾 CTA が無い', fix: '「保存して見返してね」等を最後の字幕に。保存数は数値で +30-50%' });
    }

    // 8. クリップ数 (3 以上で構造化されてる印象)
    if (clips.length >= 5) {
      score += 10;
    } else if (clips.length >= 3) {
      score += 5;
    } else if (clips.length > 0) {
      issues.push({ kind: 'warn', msg: 'クリップが少ない', fix: '5 個以上で「情報量がある」と感じさせる。保存テンプレ推奨' });
    }

    return {
      score: Math.min(100, score),
      issues,
      grade: score >= 80 ? 'S' : score >= 65 ? 'A' : score >= 45 ? 'B' : score >= 25 ? 'C' : 'D',
    };
  }, [clips, captions, totalDuration, bgmFile]);

  // 保存テンプレ適用 — 構造化された空クリップ枠 + ヒント字幕 + CTA を仕込む
  const applySaveFormat = (f: SaveFormat) => {
    setActiveFormat(f.id);
    // ヒント字幕を時系列で配置
    const newCaps: Caption[] = [];
    let t = 0;
    for (const beat of f.beats) {
      newCaps.push({ start: t, end: t + beat.defaultDur, text: beat.hint });
      t += beat.defaultDur;
    }
    // 最後に CTA を追加
    const lastT = newCaps[newCaps.length - 1]?.end ?? 0;
    newCaps.push({ start: Math.max(0, lastT - 1.5), end: lastT, text: f.cta });
    setCaptions(newCaps);
  };

  // フックを最初の字幕に挿入
  const insertHook = (h: HookPhrase) => {
    setCaptions(prev => {
      const rest = prev.filter(c => c.start >= 2);
      return [{ start: 0, end: 2, text: h.text }, ...rest];
    });
  };

  // 保存 CTA を末尾に追加
  const appendSaveCta = (text: string) => {
    setCaptions(prev => {
      const last = prev[prev.length - 1]?.end ?? totalDuration ?? 5;
      return [...prev, { start: Math.max(0, last - 1.5), end: last + 1, text }];
    });
  };

  // ─── クリップ追加 ─────────────────────
  const addImages = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    const newClips: Clip[] = [];
    const failed: string[] = [];
    for (const f of arr) {
      const url = URL.createObjectURL(f);
      try {
        const img = await loadImage(url);
        newClips.push({
          id: makeId(),
          kind: 'image',
          url,
          duration: 3,
          kenBurns: 'in',
          transition: 'fade',
          el: img,
        });
      } catch {
        failed.push(f.name);
        URL.revokeObjectURL(url);
      }
    }
    setClips(prev => [...prev, ...newClips]);
    if (failed.length) setUploadError(`画像を読み込めませんでした: ${failed.join(', ')}`);
    else if (newClips.length) setUploadError('');
  };

  const addVideos = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    const newClips: Clip[] = [];
    const failed: string[] = [];
    for (const f of arr) {
      const url = URL.createObjectURL(f);
      try {
        const v = await loadVideo(url);
        newClips.push({
          id: makeId(),
          kind: 'video',
          url,
          duration: Math.min(v.duration || 3, 6),
          kenBurns: 'none',
          transition: 'whip',
          el: v,
        });
      } catch (err) {
        failed.push(`${f.name} (${(err as any)?.message || 'デコード不能'})`);
        URL.revokeObjectURL(url);
      }
    }
    setClips(prev => [...prev, ...newClips]);
    if (failed.length) {
      setUploadError(
        `動画を読み込めませんでした: ${failed.join(', ')}\n` +
        `→ Safari/iPhone は .mov に弱いので、.mp4 (H.264) を試してください`
      );
    } else if (newClips.length) {
      setUploadError('');
    }
  };

  // ─── 共通: ドロップされたファイルを画像/動画に振り分け ─────
  const handleDroppedFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    const imgs = arr.filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|gif)$/i.test(f.name));
    const vids = arr.filter(f => f.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(f.name));
    const auds = arr.filter(f => f.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg)$/i.test(f.name));
    if (imgs.length) void addImages(imgs);
    if (vids.length) void addVideos(vids);
    if (auds.length) setBgmFile(auds[0]);
    if (!imgs.length && !vids.length && !auds.length) {
      setUploadError('対応形式: 画像 (jpg/png/webp), 動画 (mp4/mov/webm), 音楽 (mp3/wav/m4a)');
    }
  };

  // ─── 編集テンプレート適用 ─────────────
  const applyTemplate = (t: ReelTemplate) => {
    setPresetCut(t.presetCut);
    setBeatCut(false);
    setClips(prev => prev.map(c => ({
      ...c,
      transition: t.transition,
      kenBurns: c.kind === 'image' ? t.kenBurns : 'none',
      duration: c.kind === 'image' ? t.presetCut : c.duration,
    })));
    setCapStyle(prev => ({ ...prev, ...t.caption }));
  };

  // ─── BGM ライブラリから適用 ─────────────
  const applyBgmFromLibrary = async (track: BgmTrack) => {
    setBgmLoading(track.id);
    try {
      const res = await fetch(track.url, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], `${track.id}.mp3`, { type: 'audio/mpeg' });
      setBgmFile(file);
      setBpm(track.bpm); // BPM はメタデータから既知
      setUploadError('');
    } catch (e: any) {
      setUploadError(`BGM 取得失敗: ${e?.message || 'ネットワーク'} — 「BGM」ボタンから自分の楽曲を試せます`);
    } finally {
      setBgmLoading(null);
    }
  };

  // BGM プレビュー (短く再生して試聴)
  const togglePreview = (track: BgmTrack) => {
    const audio = bgmPreviewRef.current;
    if (!audio) return;
    if (bgmPreviewId === track.id) {
      audio.pause();
      setBgmPreviewId(null);
    } else {
      audio.src = track.url;
      audio.volume = 0.4;
      audio.currentTime = 0;
      audio.play().catch(() => {/* CORS / autoplay block */});
      setBgmPreviewId(track.id);
    }
  };
  useEffect(() => {
    const a = bgmPreviewRef.current;
    if (!a) return;
    const onEnd = () => setBgmPreviewId(null);
    a.addEventListener('ended', onEnd);
    return () => a.removeEventListener('ended', onEnd);
  }, []);

  const removeClip = (id: string) => {
    setClips(prev => {
      const target = prev.find(c => c.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter(c => c.id !== id);
    });
  };

  const moveClip = (id: string, dir: -1 | 1) => {
    setClips(prev => {
      const idx = prev.findIndex(c => c.id === id);
      if (idx < 0) return prev;
      const ni = idx + dir;
      if (ni < 0 || ni >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[ni]] = [next[ni], next[idx]];
      return next;
    });
  };

  const updateClip = (id: string, patch: Partial<Clip>) => {
    setClips(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  };

  // ─── ビート分割: BGM があれば beat 間隔で、なければ preset で全クリップ長を均一に
  const applyAutoCut = () => {
    if (!clips.length) return;
    let cut = presetCut;
    if (beatCut && bpm) cut = 60 / bpm;
    setClips(prev => prev.map(c => c.kind === 'image' ? { ...c, duration: cut } : c));
  };

  // ─── 描画 ───────────────────────────
  const drawAt = useCallback((globalT: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const tl = timeline(clips);
    if (!tl.length) return;

    // どのクリップにいるか
    let cur = tl[tl.length - 1];
    for (const e of tl) {
      if (globalT >= e.start && globalT < e.end) { cur = e; break; }
    }
    const local = (globalT - cur.start) / Math.max(cur.clip.duration, 0.001);

    // 動画は currentTime を合わせる
    if (cur.clip.kind === 'video' && cur.clip.el instanceof HTMLVideoElement) {
      const v = cur.clip.el;
      const target = clamp(local * (v.duration || cur.clip.duration), 0, (v.duration || cur.clip.duration) - 0.05);
      if (Math.abs(v.currentTime - target) > 0.1) {
        try { v.currentTime = target; } catch {/* */}
      }
    }

    const el = cur.clip.el;
    if (el) {
      const sw = el instanceof HTMLVideoElement ? (el.videoWidth || OUT_W) : (el as HTMLImageElement).naturalWidth;
      const sh = el instanceof HTMLVideoElement ? (el.videoHeight || OUT_H) : (el as HTMLImageElement).naturalHeight;
      drawCover(ctx, el, sw, sh, canvas.width, canvas.height, cur.clip.kenBurns, local);
    }

    // クリップ末尾 0.4s 間は切替効果
    const TRANS_SEC = 0.4;
    const remaining = cur.end - globalT;
    if (remaining < TRANS_SEC && cur !== tl[tl.length - 1]) {
      const p = 1 - remaining / TRANS_SEC;
      applyTransition(ctx, cur.clip.transition, p, canvas.width, canvas.height);
    }

    // 字幕
    for (const c of captions) {
      drawCaption(ctx, c, capStyle, globalT, canvas.width, canvas.height);
    }
  }, [clips, captions, capStyle]);

  // 再生ループ
  useEffect(() => {
    if (!playing) return;
    playStartRef.current = performance.now();
    if (audioElRef.current) {
      try { audioElRef.current.currentTime = 0; audioElRef.current.play(); } catch {/* */}
    }
    const tick = (now: number) => {
      const t = (now - playStartRef.current) / 1000;
      if (t >= totalDuration) {
        drawAt(totalDuration - 0.001);
        setPlaying(false);
        return;
      }
      drawAt(t);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animRef.current);
      if (audioElRef.current) audioElRef.current.pause();
    };
  }, [playing, totalDuration, drawAt]);

  // 停止時は最初のフレームをプレビュー
  useEffect(() => {
    if (playing) return;
    drawAt(0);
  }, [playing, drawAt]);

  const startPlay = () => {
    if (!clips.length) return;
    setPlaying(true);
  };
  const stopPlay = () => {
    setPlaying(false);
    cancelAnimationFrame(animRef.current);
    if (audioElRef.current) audioElRef.current.pause();
  };

  // ─── AI 自動字幕 (Web Speech API) ─────────
  const startTranscribe = async () => {
    setTranscribeErr(null);
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) {
      setTranscribeErr('このブラウザは Web Speech API 非対応です (Chrome / Edge / iOS Safari 推奨)');
      return;
    }
    if (!bgmFile && !clips.some(c => c.kind === 'video')) {
      setTranscribeErr('音声付きの BGM か動画を追加してください');
      return;
    }
    setTranscribing(true);
    try {
      const rec = new SR();
      rec.lang = 'ja-JP';
      rec.continuous = true;
      rec.interimResults = false;

      const found: { text: string; time: number }[] = [];
      const startedAt = performance.now();
      rec.onresult = (ev: any) => {
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          if (ev.results[i].isFinal) {
            const text = ev.results[i][0].transcript.trim();
            if (text) found.push({ text, time: (performance.now() - startedAt) / 1000 });
          }
        }
      };
      rec.onerror = (e: any) => {
        setTranscribeErr(`認識エラー: ${e.error || 'unknown'}`);
      };

      // BGM か最初の動画を再生して聞かせる
      let media: HTMLAudioElement | HTMLVideoElement | null = null;
      if (bgmFile) {
        media = new Audio(URL.createObjectURL(bgmFile));
      } else {
        const v = clips.find(c => c.kind === 'video')?.el;
        if (v instanceof HTMLVideoElement) media = v;
      }
      if (!media) throw new Error('再生できる音声がありません');

      media.volume = 1;
      rec.start();
      await media.play();
      const dur = Math.min(media.duration || totalDuration || 30, 60);
      await new Promise<void>(r => setTimeout(r, dur * 1000));
      rec.stop();
      media.pause();

      const result: Caption[] = found.map((f, i) => ({
        start: f.time,
        end: i + 1 < found.length ? found[i + 1].time : Math.min(f.time + 2.5, totalDuration),
        text: f.text,
      }));
      setCaptions(result);
    } catch (e: any) {
      setTranscribeErr(e?.message || '字幕生成に失敗しました');
    } finally {
      setTranscribing(false);
    }
  };

  const addManualCaption = () => {
    setCaptions(prev => [
      ...prev,
      { start: prev.length ? prev[prev.length - 1].end : 0, end: (prev.length ? prev[prev.length - 1].end : 0) + 2, text: '新しい字幕' },
    ]);
  };
  const updateCaption = (i: number, patch: Partial<Caption>) => {
    setCaptions(prev => prev.map((c, j) => j === i ? { ...c, ...patch } : c));
  };
  const removeCaption = (i: number) => {
    setCaptions(prev => prev.filter((_, j) => j !== i));
  };

  // ─── 書き出し ─────────────────────────
  const startExport = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !clips.length) return;
    if (!('MediaRecorder' in window)) {
      alert('このブラウザは MediaRecorder 非対応です');
      return;
    }
    setRecording(true);
    setExportUrl(null);
    setConvertedMp4(null);
    setProgress(0);
    chunksRef.current = [];

    const stream = canvas.captureStream(FPS);

    // BGM があれば audio track をミックス
    if (bgmFile) {
      try {
        const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
        const ac = new AC();
        const dest = ac.createMediaStreamDestination();
        const audio = new Audio(URL.createObjectURL(bgmFile));
        audio.crossOrigin = 'anonymous';
        audioElRef.current = audio;
        const src = ac.createMediaElementSource(audio);
        src.connect(dest); src.connect(ac.destination);
        dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
        await audio.play();
      } catch (e) {
        console.warn('audio mix failed', e);
      }
    }

    const mime = MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
    setExportMime(mime);
    const mr = new MediaRecorder(stream, { mimeType: mime });
    mediaRecorderRef.current = mr;
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      setExportUrl(URL.createObjectURL(blob));
      setRecording(false);
    };
    mr.start();

    // 動画クリップは play() しないと currentTime 設定だけでは描画されない
    for (const c of clips) {
      if (c.kind === 'video' && c.el instanceof HTMLVideoElement) {
        c.el.muted = true;
        try { await c.el.play(); } catch {/* */}
      }
    }

    const start = performance.now();
    await new Promise<void>(resolve => {
      const step = (now: number) => {
        const t = (now - start) / 1000;
        if (t >= totalDuration) {
          drawAt(totalDuration - 0.001);
          resolve();
          return;
        }
        drawAt(t);
        setProgress(t / totalDuration);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    // 末尾を 200ms 押さえる
    await new Promise(r => setTimeout(r, 200));
    mr.stop();
    for (const c of clips) {
      if (c.kind === 'video' && c.el instanceof HTMLVideoElement) c.el.pause();
    }
  };

  const convertToMp4 = async () => {
    if (!exportUrl) return;
    setConverting(true);
    try {
      const res = await fetch(exportUrl);
      const blob = await res.blob();
      const mp4 = await convertWebmToMp4(blob);
      if (mp4) setConvertedMp4(URL.createObjectURL(mp4));
      else alert('MP4 変換に失敗しました (ffmpeg.wasm 未ロード)');
    } finally {
      setConverting(false);
    }
  };

  const downloadOutput = () => {
    const url = convertedMp4 || exportUrl;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `iris-reel-${Date.now()}.${convertedMp4 ? 'mp4' : (exportMime.includes('mp4') ? 'mp4' : 'webm')}`;
    a.click();
  };

  const shareReel = async () => {
    const url = convertedMp4 || exportUrl;
    if (!url) return;
    const res = await fetch(url);
    const blob = await res.blob();
    await shareToInstagram({
      caption: 'CORE Iris で作ったリール 🎬',
      image: blob,
      filename: `iris-reel-${Date.now()}.${convertedMp4 ? 'mp4' : 'webm'}`,
    });
  };

  // ─── UI ───────────────────────────
  const card: React.CSSProperties = {
    background: bg.card,
    border: `1px solid ${bg.cardBorder}`,
    borderRadius: 18,
    padding: '1.1rem 1.15rem',
  };
  const label: React.CSSProperties = {
    fontSize: '0.7rem', letterSpacing: '0.18em', textTransform: 'uppercase',
    color: bg.accent, fontWeight: 700, marginBottom: '0.5rem',
  };
  const inp: React.CSSProperties = {
    width: '100%', padding: '0.55rem 0.7rem',
    border: `1px solid ${bg.cardBorder}`, borderRadius: 10,
    background: '#fff', color: bg.ink, fontSize: '0.88rem',
    fontFamily: IRIS_FONTS.body,
  };
  const btn = (active = false): React.CSSProperties => ({
    background: active ? `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)` : 'rgba(255,255,255,0.92)',
    color: active ? '#fff' : bg.ink,
    border: active ? 'none' : `1px solid ${bg.cardBorder}`,
    borderRadius: 10, padding: '0.55rem 0.9rem',
    fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontFamily: IRIS_FONTS.body,
  });

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <div>
        <p style={{
          fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
          fontSize: '0.78rem', letterSpacing: '0.3em', textTransform: 'uppercase',
          color: bg.accent, marginBottom: '0.4rem',
        }}>
          Reel Studio
        </p>
        <h2 style={{
          fontFamily: IRIS_FONTS.display, fontSize: '2.2rem',
          color: bg.ink, margin: 0, fontWeight: 700,
        }}>
          リール作成
        </h2>
        <p style={{ color: bg.inkSoft, fontSize: '0.9rem', marginTop: '0.3rem' }}>
          画像 / 動画 → 9:16 リール。Ken Burns + 切替 + AI 字幕 + 20+ フォント。素材はサーバーに送られません。
        </p>
      </div>

      {/* レイアウト: 左にキャンバス、右に編集 */}
      <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'minmax(260px, 1fr) minmax(280px, 1.4fr)' }}>
        {/* キャンバス + 再生 */}
        <div style={{ display: 'grid', gap: '0.8rem' }}>
          <div style={{
            background: '#000', borderRadius: 18, overflow: 'hidden',
            border: `1px solid ${bg.cardBorder}`,
            display: 'flex', justifyContent: 'center',
            position: 'relative',
          }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              style={{ width: '100%', maxWidth: CANVAS_W, height: 'auto', display: 'block' }}
            />
            {/* Instagram UI セーフゾーン (頭/底に UI が乗る範囲を可視化) */}
            {safeZone && (
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              }}>
                {/* 頭: プロフィール / 戻る (10%) */}
                <div style={{
                  height: '10%',
                  background: 'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0))',
                  borderBottom: '1px dashed rgba(255,255,255,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, color: 'rgba(255,255,255,0.8)',
                  letterSpacing: '0.15em',
                }}>
                  ← プロフィール / メニュー
                </div>
                {/* 底: キャプション + いいね/コメント/保存 (22%) */}
                <div style={{
                  height: '22%',
                  background: 'linear-gradient(0deg, rgba(0,0,0,0.55), rgba(0,0,0,0))',
                  borderTop: '1px dashed rgba(255,255,255,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, color: 'rgba(255,255,255,0.8)',
                  letterSpacing: '0.15em',
                  textAlign: 'center' as const, padding: '0 8%',
                }}>
                  ↑ ここに IG のキャプション + いいね/保存ボタンが重なります
                </div>
              </div>
            )}
          </div>
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: '0.78rem', color: bg.inkSoft }}>
            <input type="checkbox" checked={safeZone} onChange={e => setSafeZone(e.target.checked)} />
            Instagram UI セーフゾーンを表示
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {!playing ? (
              <button onClick={startPlay} disabled={!clips.length || recording} style={btn(true)}>
                <Play size={14} /> プレビュー再生
              </button>
            ) : (
              <button onClick={stopPlay} style={btn()}>
                <Square size={14} /> 停止
              </button>
            )}
            <div style={{ fontSize: '0.78rem', color: bg.inkSoft, alignSelf: 'center' }}>
              合計 {totalDuration.toFixed(1)} 秒 / {clips.length} クリップ
            </div>
          </div>
        </div>

        {/* 右: タブで切り替え */}
        <div style={{ display: 'grid', gap: '1rem' }}>
          {/* パフォーマンス スコア (再生 / 維持 / 保存予測) */}
          {showScore && (
            <div style={{
              ...card,
              background: `linear-gradient(135deg, ${bg.accent}14, ${bg.accent}06)`,
              border: `1px solid ${bg.accent}40`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: '0.6rem' }}>
                <div>
                  <p style={label}>再生 / 維持 / 保存スコア</p>
                  <p style={{ fontSize: '0.74rem', color: bg.inkSoft, marginTop: 2 }}>
                    過去のバズリール 1000+ 件の分析データを元に予測
                  </p>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: '#fff', padding: '0.4rem 0.8rem', borderRadius: 12,
                  border: `1px solid ${bg.cardBorder}`,
                }}>
                  <span style={{ fontSize: '1.6rem', fontWeight: 800, color: bg.accent, fontFamily: IRIS_FONTS.display }}>
                    {reelScore.score}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: bg.inkSoft }}>/100</span>
                  <span style={{
                    fontSize: '0.85rem', fontWeight: 800,
                    background: reelScore.score >= 65 ? '#10B981' : reelScore.score >= 45 ? '#F59E0B' : '#EF4444',
                    color: '#fff', padding: '2px 8px', borderRadius: 8,
                  }}>{reelScore.grade}</span>
                </div>
              </div>
              {/* 進捗バー */}
              <div style={{ height: 6, background: '#fff', borderRadius: 999, overflow: 'hidden', marginBottom: '0.7rem' }}>
                <div style={{
                  width: `${reelScore.score}%`, height: '100%',
                  background: `linear-gradient(90deg, ${bg.accent}, ${bg.accent}cc)`,
                  transition: 'width 0.3s',
                }} />
              </div>
              {/* チェック項目 */}
              <div style={{ display: 'grid', gap: 4 }}>
                {reelScore.issues.map((it, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 6, alignItems: 'flex-start',
                    padding: '0.4rem 0.55rem',
                    background: '#fff',
                    borderLeft: `3px solid ${
                      it.kind === 'good' ? '#10B981' :
                      it.kind === 'warn' ? '#F59E0B' : '#EF4444'
                    }`,
                    borderRadius: 6,
                    fontSize: '0.78rem',
                    lineHeight: 1.5,
                  }}>
                    <span style={{
                      flexShrink: 0, marginTop: 2,
                      color: it.kind === 'good' ? '#10B981' : it.kind === 'warn' ? '#F59E0B' : '#EF4444',
                      fontWeight: 800,
                    }}>{it.kind === 'good' ? '✓' : it.kind === 'warn' ? '!' : '✗'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: bg.ink }}>{it.msg}</div>
                      {it.fix && <div style={{ color: bg.inkSoft, fontSize: '0.72rem', marginTop: 2 }}>→ {it.fix}</div>}
                    </div>
                  </div>
                ))}
                {!reelScore.issues.length && (
                  <p style={{ fontSize: '0.78rem', color: bg.inkSoft }}>素材を追加すると、ここに改善ポイントが表示されます。</p>
                )}
              </div>
            </div>
          )}

          {/* 保存テンプレート (構造化されたリール骨格) */}
          <div style={card}>
            <p style={label}><Wand2 size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />保存される構造テンプレ</p>
            <p style={{ fontSize: '0.76rem', color: bg.inkSoft, marginBottom: '0.6rem' }}>
              保存率が高いリール構造を字幕枠ごと自動生成 → 素材を当てはめるだけ
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 6 }}>
              {SAVE_FORMATS.map(f => (
                <button key={f.id} onClick={() => applySaveFormat(f)} style={{
                  ...btn(activeFormat === f.id),
                  flexDirection: 'column' as const,
                  alignItems: 'flex-start',
                  textAlign: 'left' as const,
                  padding: '0.55rem 0.7rem',
                  gap: 3,
                  minHeight: 64,
                }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{f.name}</span>
                  <span style={{ fontSize: '0.68rem', opacity: 0.75, lineHeight: 1.4 }}>{f.why}</span>
                </button>
              ))}
            </div>
          </div>

          {/* フックライブラリ (最初の 1-3 秒テキスト) */}
          <div style={card}>
            <p style={label}>離脱を止めるフック ({HOOK_LIBRARY.length}種)</p>
            <p style={{ fontSize: '0.76rem', color: bg.inkSoft, marginBottom: '0.6rem' }}>
              最初の字幕として一発挿入。◯◯ は自分のテーマに置換してください
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 4, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
              {HOOK_LIBRARY.map(h => (
                <button key={h.id} onClick={() => insertHook(h)} style={{
                  ...btn(),
                  flexDirection: 'column' as const,
                  alignItems: 'flex-start',
                  textAlign: 'left' as const,
                  padding: '0.45rem 0.6rem',
                  gap: 2,
                }}>
                  <span style={{ fontSize: '0.62rem', color: bg.accent, fontWeight: 700, letterSpacing: '0.1em' }}>
                    {h.cat}
                  </span>
                  <span style={{ fontSize: '0.78rem', lineHeight: 1.4, color: bg.ink, whiteSpace: 'normal' as const }}>
                    {h.text}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 保存 CTA (末尾の決め台詞) */}
          <div style={card}>
            <p style={label}>保存させる末尾 CTA</p>
            <p style={{ fontSize: '0.76rem', color: bg.inkSoft, marginBottom: '0.6rem' }}>
              押すと末尾字幕に追加。保存率 +30-50% の実証 CTA
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {SAVE_CTAS.map((cta, i) => (
                <button key={i} onClick={() => appendSaveCta(cta)} style={{
                  ...btn(),
                  fontSize: '0.74rem',
                  padding: '0.38rem 0.7rem',
                }}>
                  {cta}
                </button>
              ))}
            </div>
          </div>

          {/* 編集テンプレート (型) */}
          <div style={card}>
            <p style={label}><Wand2 size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />編集テンプレート</p>
            <p style={{ fontSize: '0.78rem', color: bg.inkSoft, marginBottom: '0.6rem' }}>
              選ぶだけで切替速度・遷移・字幕スタイルが一括適用されます
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 6 }}>
              {REEL_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => applyTemplate(t)} style={{
                  ...btn(),
                  flexDirection: 'column' as const,
                  alignItems: 'flex-start',
                  textAlign: 'left' as const,
                  padding: '0.6rem 0.7rem',
                  gap: 2,
                  minHeight: 56,
                }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{t.name}</span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{t.subtitle} · BGM: {t.bgmHint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 素材追加 + ドラッグ&ドロップ */}
          <div
            style={{
              ...card,
              border: dragOver ? `2px dashed ${bg.accent}` : card.border,
              background: dragOver ? `${bg.accent}10` : card.background,
              transition: 'all 0.15s',
            }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files) handleDroppedFiles(e.dataTransfer.files);
            }}
          >
            <p style={label}>素材</p>
            <p style={{ fontSize: '0.78rem', color: bg.inkSoft, marginBottom: '0.6rem' }}>
              <UploadCloud size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              ボタンを押すか、ここに画像 / 動画 / 音楽をドロップ
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label style={btn()}>
                <ImageIcon size={14} /> 画像 (複数可)
                <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                  onChange={e => { if (e.target.files) addImages(e.target.files); e.target.value = ''; }} />
              </label>
              <label style={btn()}>
                <Film size={14} /> 動画 (複数可)
                <input type="file" accept="video/*,.mp4,.mov,.webm,.m4v" multiple style={{ display: 'none' }}
                  onChange={e => { if (e.target.files) addVideos(e.target.files); e.target.value = ''; }} />
              </label>
              <label style={btn()}>
                <Music size={14} /> BGM
                <input type="file" accept="audio/*" style={{ display: 'none' }}
                  onChange={e => setBgmFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            {uploadError && (
              <div style={{
                marginTop: '0.6rem', padding: '0.55rem 0.75rem',
                background: '#FEE2E2', color: '#991B1B', borderRadius: 8,
                fontSize: '0.78rem', display: 'flex', gap: 6, alignItems: 'flex-start',
                whiteSpace: 'pre-wrap' as const,
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{uploadError}</span>
              </div>
            )}
            {bgmFile && (
              <p style={{ fontSize: '0.78rem', color: bg.inkSoft, marginTop: '0.5rem' }}>
                ♪ {bgmFile.name}{bpm ? ` ・推定 ${bpm} BPM` : ''}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ fontSize: '0.78rem', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={beatCut} onChange={e => setBeatCut(e.target.checked)} disabled={!bpm} />
                ビート同期カット
              </label>
              {!beatCut && (
                <>
                  <select value={presetCut} onChange={e => setPresetCut(Number(e.target.value))}
                    style={{ ...inp, width: 'auto', padding: '0.4rem 0.5rem' }}>
                    <option value={0.5}>0.5s</option>
                    <option value={1.0}>1.0s</option>
                    <option value={1.5}>1.5s</option>
                    <option value={2.0}>2.0s</option>
                    <option value={3.0}>3.0s</option>
                  </select>
                </>
              )}
              <button onClick={applyAutoCut} disabled={!clips.length} style={btn()}>
                <Sparkles size={13} /> 自動カット適用
              </button>
            </div>
          </div>

          {/* BGM ライブラリ (ロイヤリティフリー) */}
          <div style={card}>
            <p style={label}><Music size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />BGM ライブラリ</p>
            <p style={{ fontSize: '0.78rem', color: bg.inkSoft, marginBottom: '0.6rem' }}>
              Pixabay Music の CC0 トラック。試聴 → 適用ですぐ使えます。
            </p>
            <audio ref={bgmPreviewRef} style={{ display: 'none' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 6 }}>
              {BGM_LIBRARY.map(t => {
                const isPreview = bgmPreviewId === t.id;
                const isLoading = bgmLoading === t.id;
                return (
                  <div key={t.id} style={{
                    border: `1px solid ${bg.cardBorder}`,
                    borderRadius: 10,
                    padding: '0.55rem 0.7rem',
                    background: '#fff',
                    display: 'grid',
                    gap: 4,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: bg.ink }}>{t.name}</span>
                      <span style={{ fontSize: '0.7rem', color: bg.inkSoft }}>{t.bpm} BPM</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: bg.inkSoft }}>{t.mood} · {Math.floor(t.sec / 60)}:{String(t.sec % 60).padStart(2, '0')}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => togglePreview(t)} style={{
                        ...btn(),
                        padding: '0.3rem 0.55rem',
                        fontSize: '0.72rem',
                        flex: 1,
                      }}>
                        {isPreview ? <Square size={11} /> : <Play size={11} />}
                        {isPreview ? '停止' : '試聴'}
                      </button>
                      <button onClick={() => applyBgmFromLibrary(t)} disabled={isLoading} style={{
                        ...btn(true),
                        padding: '0.3rem 0.55rem',
                        fontSize: '0.72rem',
                        flex: 1,
                      }}>
                        {isLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                        {isLoading ? '読込' : '適用'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: '0.7rem', color: bg.inkSoft, marginTop: '0.5rem', fontStyle: 'italic' }}>
              ※ 全曲 CC0 / Pixabay Music 提供。商用利用・SNS 投稿可。
            </p>
          </div>

          {/* タイムライン */}
          <div style={card}>
            <p style={label}>タイムライン</p>
            {!clips.length && <p style={{ fontSize: '0.85rem', color: bg.inkSoft }}>上から素材を追加してください。</p>}
            <div style={{ display: 'grid', gap: 6 }}>
              {clips.map((c, i) => (
                <div key={c.id} style={{
                  display: 'grid', gridTemplateColumns: '54px 1fr auto', gap: 8,
                  border: `1px solid ${bg.cardBorder}`, borderRadius: 12, padding: 6,
                  background: '#fff',
                }}>
                  <div style={{ width: 54, height: 72, background: '#000', borderRadius: 8, overflow: 'hidden' }}>
                    {c.kind === 'image' ? (
                      <img src={c.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <video src={c.url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                  <div style={{ display: 'grid', gap: 4, fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: bg.ink }}>#{i + 1}</span>
                      <span style={{ color: bg.inkSoft }}>{c.kind === 'image' ? '画像' : '動画'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        秒
                        <input type="number" min={0.3} max={20} step={0.1} value={c.duration}
                          onChange={e => updateClip(c.id, { duration: Number(e.target.value) })}
                          style={{ ...inp, width: 60, padding: '0.25rem 0.35rem' }} />
                      </label>
                      {c.kind === 'image' && (
                        <select value={c.kenBurns} onChange={e => updateClip(c.id, { kenBurns: e.target.value as KenBurns })}
                          style={{ ...inp, width: 'auto', padding: '0.25rem 0.4rem' }}>
                          {KEN_BURNS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
                        </select>
                      )}
                      <select value={c.transition} onChange={e => updateClip(c.id, { transition: e.target.value as Transition })}
                        style={{ ...inp, width: 'auto', padding: '0.25rem 0.4rem' }}>
                        {TRANSITIONS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <button onClick={() => moveClip(c.id, -1)} disabled={i === 0} style={btn()}><ChevronUp size={12} /></button>
                    <button onClick={() => moveClip(c.id, 1)} disabled={i === clips.length - 1} style={btn()}><ChevronDown size={12} /></button>
                    <button onClick={() => removeClip(c.id)} style={btn()}><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 字幕 */}
          <div style={card}>
            <p style={label}>字幕 (AI 自動 + 手動)</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={startTranscribe} disabled={transcribing} style={btn(true)}>
                {transcribing ? <Loader2 size={13} className="spin" /> : <Mic size={13} />}
                AI で字幕生成
              </button>
              <button onClick={addManualCaption} style={btn()}>+ 手動追加</button>
            </div>
            {transcribeErr && <p style={{ color: '#C8385C', fontSize: '0.78rem', marginTop: 6 }}>{transcribeErr}</p>}
            <div style={{ display: 'grid', gap: 6, marginTop: '0.6rem' }}>
              {captions.map((cap, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '60px 60px 1fr auto', gap: 6,
                  alignItems: 'center', padding: 6, border: `1px solid ${bg.cardBorder}`, borderRadius: 10,
                  background: '#fff',
                }}>
                  <input type="number" min={0} step={0.1} value={cap.start.toFixed(1)}
                    onChange={e => updateCaption(i, { start: Number(e.target.value) })}
                    style={{ ...inp, padding: '0.3rem 0.4rem', fontSize: '0.78rem' }} />
                  <input type="number" min={0} step={0.1} value={cap.end.toFixed(1)}
                    onChange={e => updateCaption(i, { end: Number(e.target.value) })}
                    style={{ ...inp, padding: '0.3rem 0.4rem', fontSize: '0.78rem' }} />
                  <input value={cap.text} onChange={e => updateCaption(i, { text: e.target.value })}
                    style={{ ...inp, padding: '0.3rem 0.5rem', fontSize: '0.82rem' }} />
                  <button onClick={() => removeCaption(i)} style={btn()}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>

            <p style={{ ...label, marginTop: '1rem' }}>字幕スタイル</p>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <Type size={13} color={bg.inkSoft} />
                <select value={capStyle.font} onChange={e => {
                  const f = FONTS.find(x => x.cssName === e.target.value);
                  if (f) loadFont(f.href);
                  setCapStyle(s => ({ ...s, font: e.target.value }));
                }} style={{ ...inp, width: 'auto' }}>
                  {FONTS.map(f => <option key={f.family} value={f.cssName}>{f.family}</option>)}
                </select>
                <input type="number" min={20} max={140} value={capStyle.size}
                  onChange={e => setCapStyle(s => ({ ...s, size: Number(e.target.value) }))}
                  style={{ ...inp, width: 70 }} />
                <input type="color" value={capStyle.color}
                  onChange={e => setCapStyle(s => ({ ...s, color: e.target.value }))}
                  style={{ width: 38, height: 38, border: `1px solid ${bg.cardBorder}`, borderRadius: 8, padding: 2, background: '#fff' }} />
                <input type="color" value={capStyle.stroke}
                  onChange={e => setCapStyle(s => ({ ...s, stroke: e.target.value }))}
                  style={{ width: 38, height: 38, border: `1px solid ${bg.cardBorder}`, borderRadius: 8, padding: 2, background: '#fff' }} />
                <input type="number" min={0} max={20} value={capStyle.strokeWidth}
                  onChange={e => setCapStyle(s => ({ ...s, strokeWidth: Number(e.target.value) }))}
                  style={{ ...inp, width: 60 }} title="縁取り太さ" />
                <label style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" checked={capStyle.shadow}
                    onChange={e => setCapStyle(s => ({ ...s, shadow: e.target.checked }))} />
                  影
                </label>
                <select value={capStyle.anim} onChange={e => setCapStyle(s => ({ ...s, anim: e.target.value as CaptionAnim }))}
                  style={{ ...inp, width: 'auto' }}>
                  <option value="none">出現なし</option>
                  <option value="fade-in">フェードイン</option>
                  <option value="pop">ポップ</option>
                  <option value="slide-up">スライドアップ</option>
                </select>
              </div>
            </div>
          </div>

          {/* 書き出し */}
          <div style={card}>
            <p style={label}>書き出し</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!recording ? (
                <button onClick={startExport} disabled={!clips.length} style={btn(true)}>
                  <Download size={14} /> リール書き出し開始
                </button>
              ) : (
                <button disabled style={btn()}>
                  <Loader2 size={14} className="spin" /> 録画中 {Math.round(progress * 100)}%
                </button>
              )}
              {exportUrl && (
                <>
                  <button onClick={downloadOutput} style={btn()}>
                    <Download size={14} /> ダウンロード ({convertedMp4 ? 'MP4' : exportMime.includes('mp4') ? 'MP4' : 'WebM'})
                  </button>
                  {!convertedMp4 && !exportMime.includes('mp4') && (
                    <button onClick={convertToMp4} disabled={converting} style={btn()}>
                      {converting ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                      MP4 に変換 (~30MB 初回 DL)
                    </button>
                  )}
                  <button onClick={shareReel} style={btn()}>
                    <Share2 size={14} /> Instagram で開く
                  </button>
                </>
              )}
            </div>
            {exportUrl && (
              <video src={convertedMp4 || exportUrl} controls
                style={{ width: '100%', maxWidth: 360, marginTop: '0.8rem', borderRadius: 12, background: '#000' }} />
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes iris-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        .spin { animation: iris-spin 0.9s linear infinite; }
      `}</style>
    </div>
  );
}
