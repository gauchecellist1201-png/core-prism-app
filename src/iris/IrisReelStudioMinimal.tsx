// ============================================================
// CORE Iris ▸ Reel Studio (Minimal V2)
// ・Iris LP グラデ (#E1306C → #F77737 → #FBBF24)
// ・キャンバス中央、ステップ式 (素材 → 編集 → 字幕 → 書出)
// ・少ない文字、美しさ重視、ガラスモーフィズム
// ・既存のフル機能は IrisReelStudio.tsx に残る (詳細モード)
// ============================================================
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Image as ImageIcon, Film, Music, Play, Square, Download, Share2,
  Sparkles, Wand2, ChevronRight, Plus, X, Trash2, Settings2, Loader2,
  Flame, Scissors, ArrowLeft, ArrowRight, Eye, Type as TypeIcon,
  AlertCircle, Copy, MessageSquare, Layers, Camera,
} from 'lucide-react';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { BGM_LIBRARY, VIRAL_PATTERNS, TREND_PULSE_2026_Q2 } from './IrisReelStudio';
import {
  generateReelCaptions,
  type ReelAiResult,
  type BgmMood,
  BGM_MOOD_DEFS,
  snapDurationToBgm,
} from './reelAiCaption';
import { generateReelScript, generateReelCaption, type ReelScriptResult } from './reelAiScript';
import { suggestNextSlot, type ScheduledPost } from './usePostQueue';
import { notifyInApp } from '../lib/inAppNotify';
import ShareArtifactButton from '../components/ShareArtifactButton';
import { shareToInstagram } from './instagramShare';
import {
  REEL_PRESETS, getPreset, drawPresetDecorations, drawPresetBackground,
  type PresetId,
} from './reelStudio/Presets';

interface Props {
  bg: IrisBackgroundDef;
  myDeals?: any[];
  postQueue?: {
    add: (p: Omit<ScheduledPost, 'id' | 'createdAt' | 'status'> & Partial<Pick<ScheduledPost, 'status'>>) => ScheduledPost;
    [k: string]: any;
  };
  settings?: any;
  persona?: any;
  mediaKit?: any;
  onJumpToSchedule?: () => void;
  /** 旧フル機能版へ遷移 */
  onOpenAdvanced?: () => void;
}

const OUT_W = 1080;
const OUT_H = 1920;
const CANVAS_W = 360;
const CANVAS_H = 640;

type ClipKind = 'image' | 'video';
interface Clip {
  id: string;
  kind: ClipKind;
  url: string;
  duration: number;
  el?: HTMLImageElement | HTMLVideoElement;
  /** カット毎の字幕 (AI 生成または手動編集) */
  captionText?: string;
  /** カット毎の context (AI が読み取った文脈) */
  aiContext?: string;
  /** 字幕の縦位置 (0=上 〜 1=下、デフォルト 0.78) */
  captionY?: number;
  /** カット毎の BGM ジャンル (AI 提案 or 手動) */
  bgmMood?: BgmMood;
  /** カットに合う絵文字候補 */
  emojiOptions?: string[];
}

const FONT_PRESETS = [
  { id: 'classic', label: 'クラシック', font: '"Shippori Mincho"',  size: 56, color: '#FFFFFF', stroke: '#1F1A2E', strokeWidth: 4 },
  { id: 'pop',     label: 'ポップ',     font: '"Dela Gothic One"',  size: 64, color: '#FFFFFF', stroke: '#E1306C', strokeWidth: 6 },
  { id: 'gentle',  label: 'やわらか',   font: '"Klee One"',         size: 52, color: '#FFF8F0', stroke: '#3B2A2A', strokeWidth: 3 },
  { id: 'cool',    label: 'クール',     font: '"Bebas Neue"',       size: 70, color: '#FFFFFF', stroke: '#000000', strokeWidth: 5 },
  { id: 'soft',    label: 'ソフト',     font: '"Noto Sans JP"',     size: 54, color: '#FFFFFF', stroke: '#3B2A2A', strokeWidth: 4 },
];

const IRIS_GRADIENT = 'linear-gradient(135deg, #E1306C 0%, #F77737 50%, #FBBF24 100%)';

// ─── Helpers ─────
const makeId = () => Math.random().toString(36).slice(2, 10);

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
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
const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

function drawCover(ctx: CanvasRenderingContext2D, el: HTMLImageElement | HTMLVideoElement, sw: number, sh: number, dw: number, dh: number, progress = 0) {
  const sr = sw / sh, dr = dw / dh;
  let sx = 0, sy = 0, cw = sw, ch = sh;
  if (sr > dr) { cw = sh * dr; sx = (sw - cw) / 2; }
  else { ch = sw / dr; sy = (sh - ch) / 2; }
  // Ken Burns: 軽い zoom in
  const scale = 1 + 0.08 * easeInOut(progress);
  const zw = cw / scale, zh = ch / scale;
  sx += (cw - zw) / 2; sy += (ch - zh) / 2;
  ctx.drawImage(el, sx, sy, zw, zh, 0, 0, dw, dh);
}

// ─── Main Component ─────
export default function IrisReelStudioMinimal({ bg, onJumpToSchedule, onOpenAdvanced, postQueue }: Props) {
  const [step, setStep] = useState<'material' | 'edit' | 'subtitle' | 'export'>('material');
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [bgmFile, setBgmFile] = useState<File | null>(null);
  const [bgmLoading, setBgmLoading] = useState<string | null>(null);
  const [bgmActiveId, setBgmActiveId] = useState<string | null>(null);
  const [activePattern, setActivePattern] = useState<string | null>(null);
  const [captionPreset, setCaptionPreset] = useState<typeof FONT_PRESETS[0]>(FONT_PRESETS[0]);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportMime, setExportMime] = useState<string>('video/webm');
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [uploadErr, setUploadErr] = useState<string>('');
  // AI 自動字幕
  const [themeHint, setThemeHint] = useState<string>('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiPhase, setAiPhase] = useState<string>('');
  const [aiErr, setAiErr] = useState<string>('');
  const [aiResult, setAiResult] = useState<ReelAiResult | null>(null);
  // タイムライン
  const [currentTime, setCurrentTime] = useState(0);
  const [scheduled, setScheduled] = useState(false);
  const [scheduledMsg, setScheduledMsg] = useState<string>('');
  // 4 種プリセット (テンプレート)
  const [presetId, setPresetId] = useState<PresetId | null>(null);
  // AI 台本生成 (テーマ → 3 シーン)
  const [scriptBusy, setScriptBusy] = useState(false);
  const [scriptErr, setScriptErr] = useState<string>('');
  const [scriptResult, setScriptResult] = useState<ReelScriptResult | null>(null);
  // Instagram キャプション AI 生成
  const [capBusy, setCapBusy] = useState(false);
  const [capErr, setCapErr] = useState<string>('');
  const [aiCaption, setAiCaption] = useState<{ caption: string; hashtags: string[] } | null>(null);
  // Instagram 共有
  const [igBusy, setIgBusy] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const playStartRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const totalDuration = clips.reduce((s, c) => s + c.duration, 0);

  // ─── アップロード ─────
  const addFiles = useCallback(async (files: FileList | File[]) => {
    setUploadErr('');
    const arr = Array.from(files);
    const imgs = arr.filter(f => f.type.startsWith('image/'));
    const vids = arr.filter(f => f.type.startsWith('video/'));
    const auds = arr.filter(f => f.type.startsWith('audio/'));
    if (auds[0]) setBgmFile(auds[0]);

    const newClips: Clip[] = [];
    for (const f of imgs) {
      const url = URL.createObjectURL(f);
      try { const el = await loadImage(url); newClips.push({ id: makeId(), kind: 'image', url, duration: 2.5, el }); }
      catch { setUploadErr(`画像を読めませんでした: ${f.name}`); URL.revokeObjectURL(url); }
    }
    for (const f of vids) {
      const url = URL.createObjectURL(f);
      try { const el = await loadVideo(url); newClips.push({ id: makeId(), kind: 'video', url, duration: Math.min(el.duration || 3, 6), el }); }
      catch { setUploadErr(`動画を読めませんでした: ${f.name}`); URL.revokeObjectURL(url); }
    }
    if (newClips.length) setClips(prev => [...prev, ...newClips]);
  }, []);

  // ─── BGM ライブラリから取得 ─────
  const applyBgm = useCallback(async (track: typeof BGM_LIBRARY[0]) => {
    setBgmLoading(track.id);
    try {
      const res = await fetch(track.url);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      setBgmFile(new File([blob], `${track.id}.mp3`, { type: 'audio/mpeg' }));
      setBgmActiveId(track.id);
    } catch {
      notifyInApp({ kind: 'warn', title: 'BGM を読み込めませんでした', body: '通信状況を確認して、もう一度お試しください。' });
    }
    finally { setBgmLoading(null); }
  }, []);

  // ─── パターン適用 ─────
  const applyPattern = useCallback((p: typeof VIRAL_PATTERNS[0]) => {
    setActivePattern(p.id);
    if (clips.length === 0) return;
    // 各クリップに beat の秒数 + 字幕ヒントを割り当て
    setClips(prev => prev.map((c, i) => {
      const beat = p.beats[Math.min(i, p.beats.length - 1)];
      const hint = beat.textHint.replace(/\[.*?\]\s*/, '');
      return {
        ...c,
        duration: beat.sec,
        captionText: c.captionText || hint,
      };
    }));
  }, [clips.length]);

  // ─── AI 自動字幕 (CORE 機能) ─────
  const runAiCaption = useCallback(async () => {
    if (!clips.length) { setAiErr('先にクリップを追加してください'); return; }
    setAiBusy(true); setAiErr(''); setAiPhase('準備中…');
    try {
      const inputs = clips
        .filter(c => c.el)
        .map(c => ({ kind: c.kind, el: c.el!, duration: c.duration }));
      const result = await generateReelCaptions(inputs, {
        themeHint: themeHint || undefined,
        onProgress: (phase) => setAiPhase(phase),
      });
      // 各クリップに overlayText / BGM ジャンル / 絵文字候補を反映
      setClips(prev => prev.map((c, i) => ({
        ...c,
        captionText: result.cuts[i]?.overlayText || c.captionText || '',
        aiContext: result.cuts[i]?.context || c.aiContext,
        bgmMood: result.cuts[i]?.bgmMood || c.bgmMood,
        emojiOptions: result.cuts[i]?.emojis?.length ? result.cuts[i].emojis : c.emojiOptions,
      })));
      setAiResult(result);
      setStep('subtitle');
    } catch (e: any) {
      setAiErr(e?.message || 'AI 処理に失敗しました。少し待ってから再試行してください。');
    } finally {
      setAiBusy(false);
      setAiPhase('');
    }
  }, [clips, themeHint]);

  // ─── プリセット適用 (1 タップで全カットの長さ + 字幕位置を統一) ─────
  const applyPreset = useCallback((id: PresetId) => {
    setPresetId(id);
    const preset = getPreset(id);
    if (!preset) return;
    setClips(prev => prev.map(c => ({
      ...c,
      captionY: preset.captionY,
    })));
  }, []);

  // ─── AI 台本生成 (テーマ → 3 シーン × 4〜6 秒) ─────
  const runAiScript = useCallback(async () => {
    if (!themeHint || !themeHint.trim()) {
      setScriptErr('上の入力欄にテーマを入れてからもう一度押してください');
      return;
    }
    setScriptBusy(true); setScriptErr(''); setScriptResult(null);
    try {
      const result = await generateReelScript(themeHint);
      setScriptResult(result);
      // 既存クリップが 3 個以上あれば字幕を上書き、無ければプレースホルダー (色付き) クリップを 3 個作る
      setClips(prev => {
        if (prev.length >= 3) {
          return prev.map((c, i) => ({
            ...c,
            captionText: result.scenes[i]?.caption || c.captionText || '',
            duration: result.scenes[i]?.duration || c.duration,
          }));
        }
        // 素材がまだ無い場合 — 字幕だけのプレースホルダー (色のみ) を 3 枚作る
        const preset = getPreset(presetId);
        const palette = preset ? [preset.bg, preset.accent + 'cc', preset.bg] : ['#1F1A2E', '#E1306C', '#0F172A'];
        const placeholders: Clip[] = result.scenes.map((s, i) => {
          // 色塗りキャンバスを画像化
          const c = document.createElement('canvas');
          c.width = OUT_W; c.height = OUT_H;
          const cx = c.getContext('2d')!;
          cx.fillStyle = palette[i % palette.length];
          cx.fillRect(0, 0, OUT_W, OUT_H);
          const url = c.toDataURL('image/png');
          const img = new Image();
          img.src = url;
          return {
            id: makeId(),
            kind: 'image' as const,
            url,
            duration: s.duration,
            el: img,
            captionText: s.caption,
          };
        });
        return [...prev, ...placeholders];
      });
      setStep('subtitle');
    } catch (e: any) {
      setScriptErr(e?.message || 'AI 処理に失敗しました。少し待ってから再試行してください。');
    } finally {
      setScriptBusy(false);
    }
  }, [themeHint, presetId]);

  // ─── キャンバス描画 ─────
  const drawAt = useCallback((t: number) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const preset = getPreset(presetId);
    drawPresetBackground(ctx, preset, canvas.width, canvas.height);
    if (!clips.length) return;

    // どのクリップ?
    let acc = 0, cur = clips[0], localT = 0, curIdx = 0;
    for (let i = 0; i < clips.length; i++) {
      const c = clips[i];
      if (t >= acc && t < acc + c.duration) {
        cur = c; localT = (t - acc) / Math.max(c.duration, 0.001); curIdx = i;
        break;
      }
      acc += c.duration;
    }
    if (t >= totalDuration) {
      cur = clips[clips.length - 1]; localT = 1; curIdx = clips.length - 1;
      acc = totalDuration - cur.duration;
    }

    if (cur.kind === 'video' && cur.el instanceof HTMLVideoElement) {
      const v = cur.el;
      const target = Math.max(0, Math.min((v.duration || cur.duration) - 0.05, localT * (v.duration || cur.duration)));
      if (Math.abs(v.currentTime - target) > 0.1) try { v.currentTime = target; } catch {/* */}
    }

    const el = cur.el;
    if (el) {
      const sw = el instanceof HTMLVideoElement ? (el.videoWidth || OUT_W) : (el as HTMLImageElement).naturalWidth;
      const sh = el instanceof HTMLVideoElement ? (el.videoHeight || OUT_H) : (el as HTMLImageElement).naturalHeight;
      drawCover(ctx, el, sw, sh, canvas.width, canvas.height, localT);
    }

    // フェード切替 (プリセットの transition に応じて)
    const remaining = (acc + cur.duration) - t;
    const fadeWindow = preset?.transition === 'cut' ? 0.12 : preset?.transition === 'dissolve' ? 0.5 : 0.4;
    if (remaining < fadeWindow) {
      ctx.fillStyle = `rgba(0,0,0,${(fadeWindow - remaining) / fadeWindow})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // プリセット装飾 (オーバーレイ + 下部バー)
    if (preset) drawPresetDecorations(ctx, preset, canvas.width, canvas.height, t);

    // 字幕 (カット毎)。0.25s フェードイン / 0.25s フェードアウト
    const overlay = cur.captionText || '';
    if (overlay) {
      const dur = cur.duration;
      const fadeIn  = Math.min(1, (t - acc) / 0.25);
      const fadeOut = Math.min(1, (acc + dur - t) / 0.25);
      const alpha = Math.max(0, Math.min(1, fadeIn, fadeOut));
      ctx.save();
      ctx.globalAlpha = alpha;
      // プリセットがあればそちらを優先 (色・フォント・位置)
      const useFont    = preset?.captionFont    || captionPreset.font;
      const useSize    = preset?.captionSize    ?? captionPreset.size;
      const useColor   = preset?.captionColor   || captionPreset.color;
      const useStroke  = preset?.captionStroke  || captionPreset.stroke;
      const useStrokeW = preset?.captionStrokeWidth ?? captionPreset.strokeWidth;
      const yRatio = cur.captionY ?? preset?.captionY ?? 0.78;
      const x = canvas.width / 2, y = canvas.height * yRatio;
      ctx.font = `bold ${useSize * (canvas.width / OUT_W)}px ${useFont}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = useStroke;
      ctx.lineWidth = useStrokeW * (canvas.width / OUT_W);
      ctx.lineJoin = 'round';
      // wrap to ~14 chars
      const chars = overlay.split('');
      const lines: string[] = []; let line = '';
      for (const ch of chars) {
        line += ch;
        if (line.length >= 14 && /[\s、。!\?！？]/.test(ch)) { lines.push(line); line = ''; }
      }
      if (line) lines.push(line);
      const lh = useSize * 1.15 * (canvas.width / OUT_W);
      lines.forEach((ln, i) => {
        const yi = y - (lines.length - 1) * lh / 2 + i * lh;
        ctx.strokeText(ln, x, yi);
        ctx.fillStyle = useColor;
        ctx.fillText(ln, x, yi);
      });
      ctx.restore();
    }
    // 進捗共有 (タイムライン UI 用)
    void curIdx;
  }, [clips, captionPreset, totalDuration, presetId]);

  // ─── 静止描画 (再生してない時) ─────
  useEffect(() => { if (!playing) drawAt(currentTime); }, [drawAt, playing, clips, captionPreset, currentTime, presetId]);

  // ─── 再生ループ ─────
  const startPlay = () => {
    if (!clips.length) return;
    setPlaying(true);
    playStartRef.current = performance.now() - currentTime * 1000;
    const tick = () => {
      const t = (performance.now() - playStartRef.current) / 1000;
      setCurrentTime(t);
      drawAt(t);
      if (t >= totalDuration) { setPlaying(false); setCurrentTime(0); return; }
      animRef.current = requestAnimationFrame(tick);
    };
    if (bgmFile) {
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = URL.createObjectURL(bgmFile);
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {/* */});
    }
    tick();
  };
  const stopPlay = () => {
    cancelAnimationFrame(animRef.current);
    if (audioRef.current) { try { audioRef.current.pause(); } catch {/* */} }
    setPlaying(false);
    setCurrentTime(0);
    drawAt(0);
  };

  // ─── タイムライン操作 (クリップ並べ替え / 長さ調整 / 削除) ─────
  const moveClip = (id: string, dir: -1 | 1) => {
    setClips(prev => {
      const idx = prev.findIndex(c => c.id === id);
      if (idx < 0) return prev;
      const ni = idx + dir;
      if (ni < 0 || ni >= prev.length) return prev;
      const next = prev.slice();
      [next[idx], next[ni]] = [next[ni], next[idx]];
      return next;
    });
  };
  const setClipDuration = (id: string, d: number) => {
    const clamped = Math.max(0.5, Math.min(15, d));
    setClips(prev => prev.map(c => c.id === id ? { ...c, duration: clamped } : c));
  };
  const setClipCaption = (id: string, text: string) => {
    setClips(prev => prev.map(c => c.id === id ? { ...c, captionText: text } : c));
  };
  const setClipCaptionY = (id: string, y: number) => {
    const clamped = Math.max(0.1, Math.min(0.95, y));
    setClips(prev => prev.map(c => c.id === id ? { ...c, captionY: clamped } : c));
  };
  /** カットの BGM ジャンルを選択。同時にカット長をビートにスナップ (テンポ合わせ) */
  const setClipBgmMood = (id: string, mood: BgmMood) => {
    setClips(prev => prev.map(c => {
      if (c.id !== id) return c;
      const snapped = snapDurationToBgm(c.duration, mood);
      return { ...c, bgmMood: mood, duration: snapped };
    }));
  };
  /** カットの字幕に絵文字を追記 */
  const appendEmojiToCaption = (id: string, emoji: string) => {
    setClips(prev => prev.map(c => {
      if (c.id !== id) return c;
      const cur = c.captionText || '';
      // 末尾に既に同じ絵文字があれば追加しない
      if (cur.endsWith(emoji)) return c;
      return { ...c, captionText: (cur + emoji).slice(0, 30) };
    }));
  };
  const seekToClip = (idx: number) => {
    let acc = 0;
    for (let i = 0; i < idx && i < clips.length; i++) acc += clips[i].duration;
    setCurrentTime(acc + 0.05);
    setSelectedClipId(clips[idx]?.id || null);
  };

  // ─── 投稿予約に追加 (AI 結果と一緒に) ─────
  const sendToQueue = async () => {
    if (!exportUrl || !postQueue) return;
    try {
      const resp = await fetch(exportUrl);
      const blob = await resp.blob();
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const when = suggestNextSlot();
      const caption = aiResult?.caption || clips.map(c => c.captionText).filter(Boolean).join('\n');
      const hashtags = aiResult?.hashtags || [];
      postQueue.add({
        scheduledAt: when.toISOString(),
        platform: 'instagram_reel',
        source: 'reel',
        caption,
        hashtags,
        mediaDataUrl: dataUrl,
        mediaKind: 'video',
        reelPattern: activePattern || undefined,
        note: aiResult?.themeGuess ? `AI テーマ: ${aiResult.themeGuess}` : undefined,
      });
      setScheduled(true);
      setScheduledMsg(`${when.getMonth() + 1}/${when.getDate()} ${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')} に予約しました`);
    } catch (e: any) {
      setScheduledMsg(`予約に失敗しました: ${e?.message || e}`);
    }
  };

  // ─── 録画 → WebM 書き出し ─────
  const startRecord = async () => {
    if (!canvasRef.current || !clips.length) return;
    setRecording(true); setProgress(0); setExportUrl(null);
    const stream = (canvasRef.current as HTMLCanvasElement).captureStream(30);
    // 音声トラックを混ぜる + fade in/out (失敗してもユーザーに気づかせる)
    if (bgmFile) {
      try {
        const ac = new AudioContext();
        const buf = await bgmFile.arrayBuffer();
        const audioBuf = await ac.decodeAudioData(buf);
        const src = ac.createBufferSource(); src.buffer = audioBuf;
        // GainNode で 最初 1s フェードイン + 最後 1s フェードアウト
        const gain = ac.createGain();
        const now = ac.currentTime;
        const FADE = 1.0; // 秒
        const fadeOutAt = Math.max(FADE + 0.05, totalDuration - FADE);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(1, now + FADE);
        gain.gain.setValueAtTime(1, now + fadeOutAt);
        gain.gain.linearRampToValueAtTime(0, now + Math.max(totalDuration, fadeOutAt + 0.1));
        const dest = ac.createMediaStreamDestination();
        src.connect(gain); gain.connect(dest); src.start();
        dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      } catch (e) {
        notifyInApp({
          kind: 'warn',
          title: '音声の書き出しに失敗しました',
          body: '音楽なしで書き出しを続けます。BGM を選び直してもう一度お試しください。',
          duration: 7000,
        });
      }
    }
    chunksRef.current = [];
    // MP4 をまず試す (Safari / 新しめの Chrome で対応)。落ちたら WebM
    const mime = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/mp4'))
      ? 'video/mp4'
      : (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp9'))
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
    setExportMime(mime);
    const rec = new MediaRecorder(stream, { mimeType: mime });
    rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      setExportUrl(URL.createObjectURL(blob));
      setRecording(false); setProgress(1);
    };
    rec.onerror = () => {
      setRecording(false); setProgress(0);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      notifyInApp({
        kind: 'warn',
        title: '動画の書き出しに失敗しました',
        body: 'もう一度「書き出す」ボタンを押してください。素材はそのまま残しています。',
        duration: 7000,
      });
    };
    recorderRef.current = rec;
    rec.start();
    // 再生開始
    playStartRef.current = performance.now();
    setCurrentTime(0);
    const tick = () => {
      const t = (performance.now() - playStartRef.current) / 1000;
      drawAt(t);
      setCurrentTime(t);
      setProgress(t / totalDuration);
      if (t >= totalDuration) { rec.stop(); setCurrentTime(0); return; }
      animRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const download = async () => {
    if (!exportUrl) return;
    const ext = exportMime.startsWith('video/mp4') ? 'mp4' : 'webm';
    const filename = `iris-reel-${Date.now()}.${ext}`;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);

    // iOS Safari は <a download> が効かないため、Web Share API か新規タブで誘導する
    if (isIOS) {
      try {
        const res = await fetch(exportUrl);
        const blob = await res.blob();
        const file = new File([blob], filename, { type: exportMime });
        // Web Share Level 2 (ファイル共有) — iOS 15+ Safari で対応
        const nav: any = navigator;
        if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
          await nav.share({ files: [file], title: 'リール', text: 'CORE Iris で作ったリール' });
          setScheduledMsg('共有シートから「ビデオを保存」を選んでね');
          return;
        }
      } catch {/* 共有失敗 → 新規タブで開いて手動保存に誘導 */}
      // 共有不可なら新規タブで開く (長押し → ビデオを保存)
      window.open(exportUrl, '_blank');
      setScheduledMsg('動画を長押し → 「ビデオを保存」を選んでね');
      return;
    }

    // PC / Android: 通常ダウンロード
    const a = document.createElement('a');
    a.href = exportUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  /** リール用キャプションを AI 生成 (テーマ + 字幕から) */
  const runCaptionGen = async () => {
    setCapBusy(true); setCapErr('');
    try {
      const captionTexts = clips.map(c => c.captionText || '');
      const themeForCap = themeHint || scriptResult?.title || 'リール投稿';
      const out = await generateReelCaption(themeForCap, captionTexts);
      setAiCaption(out);
    } catch (e: any) {
      setCapErr(e?.message || 'キャプション生成に失敗しました');
    } finally {
      setCapBusy(false);
    }
  };

  /** 字幕を一括クリップボードへ */
  const copyAllCaptions = async () => {
    const text = clips.map(c => c.captionText).filter(Boolean).join('\n');
    if (!text) { setScheduledMsg('コピーする字幕がありません'); return; }
    try {
      await navigator.clipboard.writeText(text);
      setScheduledMsg('字幕をコピーしました');
    } catch {
      setScheduledMsg('コピーに失敗しました');
    }
  };

  /** Instagram で開く (Web Share API → URL スキーム → クリップボード) */
  const openInInstagram = async () => {
    if (!exportUrl) return;
    setIgBusy(true);
    try {
      const res = await fetch(exportUrl);
      const blob = await res.blob();
      const ext = exportMime.startsWith('video/mp4') ? 'mp4' : 'webm';
      const captionAll = (aiCaption?.caption || aiResult?.caption || clips.map(c => c.captionText).filter(Boolean).join('\n'))
        + (aiCaption?.hashtags?.length ? '\n\n' + aiCaption.hashtags.join(' ') : (aiResult?.hashtags?.length ? '\n\n' + aiResult.hashtags.join(' ') : ''));
      const result = await shareToInstagram({
        caption: captionAll,
        image: blob,
        filename: `iris-reel-${Date.now()}.${ext}`,
      });
      setScheduledMsg(result.message);
    } catch (e: any) {
      setScheduledMsg(`Instagram への共有に失敗: ${e?.message || e}`);
    } finally {
      setIgBusy(false);
    }
  };

  /** Instagram Story 用の短いコピーをクリップボードへ */
  const copyStoryText = async () => {
    const fallback = clips.map(c => c.captionText).filter(Boolean).join(' / ').slice(0, 60);
    const text = (aiResult?.storyText && aiResult.storyText.trim())
      || (aiResult?.themeGuess ? `✨ ${aiResult.themeGuess}` : '')
      || fallback
      || '✨ 新しいリールができたよ';
    try {
      await navigator.clipboard.writeText(text);
      setScheduledMsg('Story 用の文をコピーしました');
    } catch {
      setScheduledMsg('コピーに失敗しました');
    }
  };

  // ─── 削除 ─────
  const removeClip = (id: string) => setClips(prev => prev.filter(c => c.id !== id));

  return (
    <div style={{
      position: 'relative',
      minHeight: '100dvh',
      // safe-area-inset 配慮: 下部はホームインジケータ分余白を確保
      paddingBottom: 'max(6rem, calc(4.5rem + env(safe-area-inset-bottom, 0px)))',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      // iPhone 幅で ambient BG 円 (520x520, right: -100) が横にはみ出すのを抑制
      overflowX: 'hidden',
    }}>
      {/* AMBIENT BG */}
      <div style={{
        position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)',
        width: 520, height: 520, borderRadius: '50%',
        background: 'radial-gradient(circle, #FFB8D655 0%, #FCB04533 50%, transparent 75%)',
        filter: 'blur(72px)', pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'absolute', top: 200, right: -100,
        width: 320, height: 320, borderRadius: '50%',
        background: 'radial-gradient(circle, #FBBF2444 0%, transparent 70%)',
        filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 480, margin: '0 auto', padding: '1rem' }}>

        {/* HERO */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <p style={{
            fontSize: 11, letterSpacing: '0.5em', color: bg.accent, fontWeight: 800,
            marginBottom: 6, opacity: 0.7, textTransform: 'uppercase',
          }}>REEL STUDIO</p>
          <h1 style={{
            fontFamily: IRIS_FONTS.display, fontStyle: 'italic',
            fontSize: 'clamp(3rem, 13vw, 4.4rem)', margin: 0, fontWeight: 500,
            background: IRIS_GRADIENT,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.02em', lineHeight: 1,
          }}>リール。</h1>
          <p style={{
            marginTop: 8, fontSize: 12.5, color: bg.inkSoft,
            fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
            letterSpacing: '0.02em',
          }}>
            {clips.length === 0 ? '一本目の素材を入れて、はじめましょう' : `${clips.length} クリップ ・ ${totalDuration.toFixed(1)} 秒`}
          </p>
        </motion.div>

        {/* PRESET TEMPLATES (4 種) — 1 タップで色/フォント/レイアウト切替 */}
        <div style={{ marginBottom: '1.2rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 10, letterSpacing: '0.22em', fontWeight: 800,
            color: bg.accent, textTransform: 'uppercase',
            marginBottom: 7, paddingLeft: 2,
          }}>
            <Layers size={11} /> テンプレート
            {presetId && (
              <button onClick={() => setPresetId(null)} style={{
                marginLeft: 'auto', background: 'transparent', border: 'none',
                color: bg.inkSoft, fontSize: 10, cursor: 'pointer',
                textDecoration: 'underline', letterSpacing: 0,
              }}>解除</button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {REEL_PRESETS.map(p => {
              const active = presetId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  title={p.tagline}
                  style={{
                    minHeight: 64,
                    padding: '0.6rem 0.3rem',
                    background: active ? IRIS_GRADIENT : 'rgba(255,255,255,0.7)',
                    color: active ? '#fff' : bg.ink,
                    border: `1.5px solid ${active ? 'transparent' : bg.cardBorder}`,
                    borderRadius: 14,
                    fontSize: 11, fontWeight: 800,
                    cursor: 'pointer', fontFamily: IRIS_FONTS.body,
                    boxShadow: active ? '0 6px 18px rgba(225,48,108,0.32)' : '0 1px 3px rgba(0,0,0,0.04)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 2,
                    transition: 'all 0.18s',
                  }}
                >
                  <div style={{ fontSize: 20, lineHeight: 1 }}>{p.emoji}</div>
                  <div style={{ fontSize: 11, lineHeight: 1.1 }}>{p.label}</div>
                </button>
              );
            })}
          </div>
          {presetId && (() => {
            const p = getPreset(presetId);
            if (!p) return null;
            return (
              <div style={{
                marginTop: 6, padding: '0.45rem 0.65rem',
                background: 'rgba(225,48,108,0.06)', borderRadius: 8,
                fontSize: 10.5, color: bg.inkSoft, lineHeight: 1.4,
              }}>{p.tagline}</div>
            );
          })()}
        </div>

        {/* PHONE CANVAS */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{
            position: 'relative',
            width: 'min(260px, 70vw)',
            margin: '0 auto 1.4rem',
          }}>
          <div style={{
            position: 'relative',
            paddingTop: '177.7%',
            background: '#0a0a0f',
            borderRadius: 30,
            boxShadow: '0 32px 64px rgba(225, 48, 108, 0.16), 0 12px 32px rgba(0, 0, 0, 0.14), 0 0 0 7px rgba(255, 255, 255, 0.85), 0 0 0 8px rgba(225, 48, 108, 0.18)',
            overflow: 'hidden',
          }}>
            <canvas
              ref={canvasRef} width={CANVAS_W} height={CANVAS_H}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
            />
            {clips.length === 0 && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.55)', fontSize: 13,
                fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
                textAlign: 'center', padding: '2rem', gap: 10,
              }}>
                <Sparkles size={28} strokeWidth={1.4} />
                <span>ここに あなたの世界</span>
              </div>
            )}
            {recording && (
              <div style={{
                position: 'absolute', top: 14, left: 14,
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 9px', background: '#EF4444', color: '#fff',
                borderRadius: 999, fontSize: 10, fontWeight: 800,
                fontFamily: IRIS_FONTS.body,
              }}>
                ● REC {Math.round(progress * 100)}%
              </div>
            )}
          </div>
        </motion.div>

        {/* PRIMARY ACTIONS */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: '1.8rem' }}>
          {!playing && !recording ? (
            <button onClick={startPlay} disabled={!clips.length} style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              minHeight: 48, padding: '0.85rem 1.6rem',
              background: clips.length ? IRIS_GRADIENT : 'rgba(255,255,255,0.4)',
              color: '#fff', border: 'none', borderRadius: 999,
              fontSize: 14, fontWeight: 800, cursor: clips.length ? 'pointer' : 'not-allowed',
              boxShadow: clips.length ? '0 8px 24px rgba(225, 48, 108, 0.32)' : 'none',
              opacity: clips.length ? 1 : 0.5,
              fontFamily: IRIS_FONTS.body,
            }}>
              <Play size={15} fill="#fff" /> 再生
            </button>
          ) : (
            <button onClick={stopPlay} style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              minHeight: 48, padding: '0.85rem 1.6rem',
              background: 'rgba(255,255,255,0.9)', color: bg.ink,
              border: `1.5px solid ${bg.accent}`, borderRadius: 999,
              fontSize: 14, fontWeight: 800, cursor: 'pointer',
              fontFamily: IRIS_FONTS.body,
            }}>
              <Square size={14} fill={bg.ink} /> 停止
            </button>
          )}
        </div>

        {/* ✨ AI 自動字幕ボタン (一番目立つ位置) */}
        {clips.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{ marginBottom: 14 }}
          >
            <button
              onClick={runAiCaption}
              disabled={aiBusy}
              style={{
                width: '100%', padding: '0.95rem 1rem',
                background: aiBusy ? 'rgba(255,255,255,0.5)' : IRIS_GRADIENT,
                color: '#fff', border: 'none', borderRadius: 18,
                fontSize: 14.5, fontWeight: 800,
                cursor: aiBusy ? 'wait' : 'pointer',
                boxShadow: aiBusy ? 'none' : '0 12px 32px rgba(225,48,108,0.32)',
                fontFamily: IRIS_FONTS.body,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {aiBusy
                ? <><Loader2 size={16} className="iris-spin" /> {aiPhase || '分析中…'}</>
                : <><Sparkles size={16} /> AI が動画を見て字幕をつける</>}
            </button>
            {aiErr && (
              <div style={{
                marginTop: 8, padding: '0.65rem 0.8rem',
                background: '#FEE2E2', color: '#991B1B',
                borderRadius: 12, fontSize: 12,
                display: 'flex', alignItems: 'flex-start', gap: 6,
                lineHeight: 1.5,
              }}>
                <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  {aiErr}
                  <button onClick={() => { setAiErr(''); runAiCaption(); }} style={{
                    display: 'block', marginTop: 6,
                    background: 'transparent', border: 'none',
                    color: '#991B1B', textDecoration: 'underline',
                    cursor: 'pointer', fontSize: 11, padding: 0,
                  }}>もう一度試す</button>
                </div>
              </div>
            )}
            {aiResult && !aiBusy && !aiErr && (
              <div style={{
                marginTop: 8, padding: '0.55rem 0.7rem',
                background: 'rgba(225,48,108,0.08)',
                color: bg.ink,
                borderRadius: 10, fontSize: 11,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Eye size={12} color={bg.accent} />
                <span><b>テーマ:</b> {aiResult.themeGuess || '—'}</span>
              </div>
            )}
          </motion.div>
        )}

        {/* タイムライン (キャンバス下) — Edits 風 */}
        {clips.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <Label icon={<Scissors size={11} />}>タイムライン</Label>
            <div style={{
              display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 6,
              scrollbarWidth: 'none',
            }}>
              {clips.map((c, i) => {
                const selected = selectedClipId === c.id;
                const mood = c.bgmMood ? BGM_MOOD_DEFS.find(m => m.id === c.bgmMood) : null;
                return (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedClipId(c.id); seekToClip(i); }}
                    style={{
                      flexShrink: 0, position: 'relative',
                      width: 56, height: 92,
                      borderRadius: 8, overflow: 'hidden',
                      background: '#000',
                      border: `2px solid ${selected ? bg.accent : 'transparent'}`,
                      cursor: 'pointer', padding: 0,
                      boxShadow: selected ? '0 4px 12px rgba(225,48,108,0.32)' : '0 1px 4px rgba(0,0,0,0.1)',
                    }}>
                    {c.kind === 'image'
                      ? <img src={c.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <video src={c.url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    }
                    {/* 上: BGM ジャンルバッジ */}
                    {mood && (
                      <div style={{
                        position: 'absolute', top: 2, right: 2,
                        padding: '1px 4px',
                        background: 'rgba(225,48,108,0.92)', color: '#fff',
                        fontSize: 8, fontWeight: 900,
                        borderRadius: 4,
                        letterSpacing: '0.02em',
                      }}>{mood.label}</div>
                    )}
                    {/* 中央: 字幕プレビュー (短く) */}
                    {c.captionText && (
                      <div style={{
                        position: 'absolute', left: 2, right: 2,
                        top: '40%', transform: 'translateY(-50%)',
                        color: '#fff', fontSize: 8.5, fontWeight: 800,
                        lineHeight: 1.15,
                        textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.7)',
                        textAlign: 'center',
                        wordBreak: 'break-all',
                      }}>
                        {c.captionText.slice(0, 10)}{c.captionText.length > 10 ? '…' : ''}
                      </div>
                    )}
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.78), transparent)',
                      color: '#fff', fontSize: 9, fontWeight: 800,
                      padding: '8px 3px 2px', textAlign: 'left',
                    }}>
                      {i + 1}・{c.duration.toFixed(1)}s
                    </div>
                    {/* 左上: AI 字幕済みドット */}
                    {c.captionText && (
                      <div style={{
                        position: 'absolute', top: 2, left: 2,
                        width: 6, height: 6, borderRadius: '50%',
                        background: '#FBBF24',
                        boxShadow: '0 0 6px #FBBF24',
                      }} />
                    )}
                  </button>
                );
              })}
            </div>
            {/* 選択中クリップの操作 */}
            {selectedClipId && (() => {
              const idx = clips.findIndex(c => c.id === selectedClipId);
              const c = clips[idx];
              if (!c) return null;
              return (
                <div style={{
                  marginTop: 8, padding: '0.7rem 0.8rem',
                  background: 'rgba(255,255,255,0.7)',
                  border: `1px solid ${bg.cardBorder}`,
                  borderRadius: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: bg.accent }}>カット {idx + 1}</span>
                    <button onClick={() => moveClip(c.id, -1)} disabled={idx === 0} style={iconBtn(bg, idx === 0)}>
                      <ArrowLeft size={11} />
                    </button>
                    <button onClick={() => moveClip(c.id, 1)} disabled={idx === clips.length - 1} style={iconBtn(bg, idx === clips.length - 1)}>
                      <ArrowRight size={11} />
                    </button>
                    <div style={{ flex: 1 }} />
                    <button onClick={() => { removeClip(c.id); setSelectedClipId(null); }} style={{
                      ...iconBtn(bg, false),
                      color: '#EF4444', borderColor: '#FCA5A5',
                    }}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: bg.inkSoft, minWidth: 28 }}>長さ</span>
                    <input
                      type="range" min={0.5} max={8} step={0.1}
                      value={c.duration}
                      onChange={e => setClipDuration(c.id, Number(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 11, fontWeight: 700, color: bg.ink, minWidth: 36, textAlign: 'right' }}>
                      {c.duration.toFixed(1)}s
                    </span>
                  </div>
                  {c.aiContext && (
                    <div style={{
                      marginTop: 6, padding: '0.4rem 0.55rem',
                      background: 'rgba(225,48,108,0.06)',
                      borderRadius: 8, fontSize: 10.5,
                      color: bg.inkSoft, lineHeight: 1.4,
                    }}>
                      <Eye size={10} style={{ verticalAlign: '-1px', marginRight: 4 }} />
                      {c.aiContext}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* STEP TABS */}
        <div style={{
          display: 'flex', gap: 2,
          padding: 4,
          background: 'rgba(255,255,255,0.55)',
          backdropFilter: 'blur(20px)',
          border: `1px solid ${bg.accent}33`,
          borderRadius: 999,
          marginBottom: 14,
          boxShadow: '0 4px 14px rgba(225,48,108,0.08)',
        }}>
          {[
            { id: 'material' as const, label: '素材' },
            { id: 'edit'     as const, label: '編集' },
            { id: 'subtitle' as const, label: '字幕' },
            { id: 'export'   as const, label: '書出' },
          ].map(s => (
            <button key={s.id} onClick={() => setStep(s.id)} style={{
              flex: 1, padding: '0.55rem 0',
              background: step === s.id ? IRIS_GRADIENT : 'transparent',
              color: step === s.id ? '#fff' : bg.ink,
              border: 'none', borderRadius: 999,
              fontSize: 13, fontWeight: 800, cursor: 'pointer',
              fontFamily: IRIS_FONTS.body,
              transition: 'all 0.2s',
              boxShadow: step === s.id ? '0 4px 14px rgba(225,48,108,0.32)' : 'none',
            }}>{s.label}</button>
          ))}
        </div>

        {/* STEP PANELS */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
            style={{ minHeight: 240 }}
          >

            {/* === STEP 1: 素材 === */}
            {step === 'material' && (
              <>
                <Glass>
                  <label
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) addFiles(e.dataTransfer.files); }}
                    style={{
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      padding: '2rem 1rem',
                      border: `2px dashed ${dragOver ? bg.accent : bg.accent + '55'}`,
                      borderRadius: 18,
                      background: dragOver ? bg.accent + '10' : 'transparent',
                      cursor: 'pointer', textAlign: 'center',
                      transition: 'all 0.2s',
                    }}>
                    <Plus size={28} color={bg.accent} strokeWidth={1.6} />
                    <p style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: bg.ink }}>
                      画像 / 動画 をドロップ
                    </p>
                    <p style={{ marginTop: 2, fontSize: 11, color: bg.inkSoft }}>
                      または タップして選ぶ
                    </p>
                    <input type="file" multiple accept="image/*,video/*" style={{ display: 'none' }}
                      onChange={e => e.target.files && addFiles(e.target.files)} />
                  </label>
                  {uploadErr && <ErrorMsg msg={uploadErr} />}
                </Glass>

                {/* クリップ一覧 (横スクロール) */}
                {clips.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <Label>クリップ</Label>
                    <div style={{
                      display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8,
                      scrollbarWidth: 'none',
                    }}>
                      {clips.map((c, i) => (
                        <div key={c.id} style={{
                          flexShrink: 0, position: 'relative',
                          width: 56, height: 100,
                          borderRadius: 10, overflow: 'hidden',
                          background: '#000',
                          border: `1.5px solid ${bg.cardBorder}`,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        }}>
                          {c.kind === 'image'
                            ? <img src={c.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <video src={c.url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          }
                          <button onClick={() => removeClip(c.id)} style={{
                            position: 'absolute', top: 2, right: 2,
                            width: 20, height: 20, borderRadius: '50%',
                            background: 'rgba(0,0,0,0.6)', color: '#fff',
                            border: 'none', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            padding: 0,
                          }}><X size={11} /></button>
                          <div style={{
                            position: 'absolute', bottom: 2, left: 2,
                            background: 'rgba(0,0,0,0.6)', color: '#fff',
                            padding: '1px 5px', borderRadius: 4,
                            fontSize: 9, fontWeight: 700,
                          }}>{i + 1}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* BGM ライブラリ */}
                <div style={{ marginTop: 16 }}>
                  <Label icon={<Music size={11} />}>BGM (CC0)</Label>
                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none' }}>
                    {BGM_LIBRARY.map(t => {
                      const active = bgmActiveId === t.id;
                      const loading = bgmLoading === t.id;
                      return (
                        <button key={t.id} onClick={() => applyBgm(t)} disabled={loading} style={{
                          flexShrink: 0, minWidth: 140,
                          padding: '0.55rem 0.7rem',
                          background: active ? IRIS_GRADIENT : 'rgba(255,255,255,0.7)',
                          color: active ? '#fff' : bg.ink,
                          border: `1px solid ${active ? 'transparent' : bg.cardBorder}`,
                          borderRadius: 12, textAlign: 'left',
                          cursor: 'pointer', fontFamily: IRIS_FONTS.body,
                          boxShadow: active ? '0 4px 14px rgba(225,48,108,0.32)' : 'none',
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.2 }}>
                            {loading ? <Loader2 size={12} className="iris-spin" style={{ verticalAlign: '-2px' }} /> : null} {t.name}
                          </div>
                          <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>{t.bpm} BPM ・ {t.mood}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* === STEP 2: 編集 === */}
            {step === 'edit' && (
              <>
                <Label icon={<Flame size={11} color="#EA580C" />}>2026 Q2 伸びてる型</Label>
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 14, scrollbarWidth: 'none' }}>
                  {TREND_PULSE_2026_Q2.map(id => {
                    const p = VIRAL_PATTERNS.find(x => x.id === id); if (!p) return null;
                    const active = activePattern === p.id;
                    return (
                      <button key={p.id} onClick={() => applyPattern(p)} style={{
                        flexShrink: 0, minWidth: 150,
                        padding: '0.65rem 0.8rem',
                        background: active ? IRIS_GRADIENT : 'rgba(255,255,255,0.7)',
                        color: active ? '#fff' : bg.ink,
                        border: `1px solid ${active ? 'transparent' : bg.cardBorder}`,
                        borderRadius: 12, textAlign: 'left',
                        cursor: 'pointer', fontFamily: IRIS_FONTS.body,
                        boxShadow: active ? '0 4px 14px rgba(225,48,108,0.32)' : 'none',
                      }}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, lineHeight: 1.2 }}>{p.name}</div>
                        <div style={{ fontSize: 10, opacity: 0.75, marginTop: 3 }}>watch ×{p.watchMultiplier}</div>
                      </button>
                    );
                  })}
                </div>

                {/* 全パターン */}
                <Label>全パターン ({VIRAL_PATTERNS.length})</Label>
                <div style={{ display: 'grid', gap: 6 }}>
                  {VIRAL_PATTERNS.map(p => {
                    const active = activePattern === p.id;
                    return (
                      <button key={p.id} onClick={() => applyPattern(p)} style={{
                        padding: '0.7rem 0.9rem',
                        background: active ? IRIS_GRADIENT : 'rgba(255,255,255,0.6)',
                        color: active ? '#fff' : bg.ink,
                        border: `1px solid ${active ? 'transparent' : bg.cardBorder}`,
                        borderRadius: 12,
                        cursor: 'pointer', fontFamily: IRIS_FONTS.body,
                        textAlign: 'left', display: 'flex',
                        alignItems: 'center', gap: 10,
                        boxShadow: active ? '0 4px 14px rgba(225,48,108,0.32)' : 'none',
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 800 }}>
                            {p.name} <span style={{ fontSize: 10, opacity: 0.7 }}>{''.repeat(p.trend2026)}</span>
                          </div>
                          <div style={{ fontSize: 10.5, opacity: 0.75, marginTop: 2 }}>{p.example}</div>
                        </div>
                        <ChevronRight size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* === STEP 3: 字幕 (カット毎) === */}
            {step === 'subtitle' && (
              <>
                {/* AI ヒント (テーマ) */}
                <Label icon={<Sparkles size={11} />}>テーマ (AI のヒント / 台本生成にも使う)</Label>
                <input
                  type="text"
                  value={themeHint}
                  onChange={e => setThemeHint(e.target.value)}
                  placeholder="例: 朝のスキンケア、新作レビュー"
                  style={{
                    width: '100%', padding: '0.85rem 0.9rem',
                    background: 'rgba(255,255,255,0.85)',
                    border: `1px solid ${bg.cardBorder}`,
                    borderRadius: 12,
                    fontSize: 16, // iOS Safari 自動ズーム回避 (16px+)
                    fontFamily: 'inherit',
                    marginBottom: 8,
                    minHeight: 44, // タップ対象 (Apple HIG)
                  }}
                />
                {/* AI 台本生成 (3 シーン × 4-6 秒) */}
                <button
                  onClick={runAiScript}
                  disabled={scriptBusy || !themeHint.trim()}
                  style={{
                    width: '100%', padding: '0.85rem 1rem',
                    background: scriptBusy ? 'rgba(255,255,255,0.5)' : (themeHint.trim() ? IRIS_GRADIENT : 'rgba(255,255,255,0.4)'),
                    color: '#fff', border: 'none', borderRadius: 14,
                    fontSize: 14, fontWeight: 800,
                    cursor: scriptBusy ? 'wait' : (themeHint.trim() ? 'pointer' : 'not-allowed'),
                    boxShadow: themeHint.trim() && !scriptBusy ? '0 8px 22px rgba(225,48,108,0.28)' : 'none',
                    fontFamily: IRIS_FONTS.body,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    minHeight: 48, marginBottom: 8,
                    opacity: themeHint.trim() || scriptBusy ? 1 : 0.55,
                  }}
                >
                  {scriptBusy
                    ? <><Loader2 size={15} className="iris-spin" /> 台本を考え中…</>
                    : <><Wand2 size={15} /> AI に 3 シーン台本を書いてもらう</>}
                </button>
                {scriptErr && (
                  <div style={{
                    marginBottom: 10, padding: '0.6rem 0.7rem',
                    background: '#FEE2E2', color: '#991B1B', borderRadius: 10,
                    fontSize: 11.5, display: 'flex', gap: 6, alignItems: 'flex-start', lineHeight: 1.5,
                  }}>
                    <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                      {scriptErr}
                      <button onClick={() => { setScriptErr(''); runAiScript(); }} style={{
                        display: 'inline-block', marginLeft: 8,
                        background: 'transparent', border: 'none',
                        color: '#991B1B', textDecoration: 'underline',
                        cursor: 'pointer', fontSize: 11, padding: 0,
                      }}>もう一度</button>
                      <button onClick={() => setScriptErr('')} style={{
                        display: 'inline-block', marginLeft: 8,
                        background: 'transparent', border: 'none',
                        color: '#991B1B', textDecoration: 'underline',
                        cursor: 'pointer', fontSize: 11, padding: 0,
                      }}>手で書く</button>
                    </div>
                  </div>
                )}
                {scriptResult && !scriptBusy && !scriptErr && (
                  <div style={{
                    marginBottom: 12, padding: '0.6rem 0.75rem',
                    background: 'rgba(22,163,74,0.08)',
                    border: '1px solid rgba(22,163,74,0.25)',
                    borderRadius: 10, fontSize: 11.5, color: bg.ink,
                    lineHeight: 1.5,
                  }}>
                    <div style={{ fontWeight: 800, marginBottom: 3 }}>
                      <Sparkles size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />
                      タイトル: {scriptResult.title}
                    </div>
                    <div style={{ fontSize: 10.5, color: bg.inkSoft }}>
                      3 シーン ・ 合計 {scriptResult.scenes.reduce((s, x) => s + x.duration, 0).toFixed(1)} 秒 ・ CTA: {scriptResult.cta}
                    </div>
                  </div>
                )}

                {/* カット毎の字幕編集 */}
                {clips.length === 0 ? (
                  <div style={{
                    padding: '1.5rem', textAlign: 'center',
                    color: bg.inkSoft, fontSize: 13,
                    fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
                  }}>
                    先に「素材」タブでクリップを追加してください
                  </div>
                ) : (
                  <>
                    <Label icon={<TypeIcon size={11} />}>カット毎の字幕 ({clips.length} 個)</Label>
                    <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
                      {clips.map((c, i) => (
                        <div key={c.id} style={{
                          padding: '0.6rem 0.7rem',
                          background: selectedClipId === c.id ? 'rgba(225,48,108,0.08)' : 'rgba(255,255,255,0.6)',
                          border: `1px solid ${selectedClipId === c.id ? bg.accent + '66' : bg.cardBorder}`,
                          borderRadius: 12,
                          display: 'flex', gap: 8, alignItems: 'flex-start',
                        }}>
                          <div style={{
                            width: 36, height: 60, flexShrink: 0,
                            borderRadius: 6, overflow: 'hidden',
                            background: '#000', position: 'relative',
                          }}>
                            {c.kind === 'image'
                              ? <img src={c.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <video src={c.url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            }
                            <div style={{
                              position: 'absolute', top: 1, left: 2,
                              fontSize: 8, fontWeight: 800, color: '#fff',
                              textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                            }}>{i + 1}</div>
                          </div>
                          <div style={{ flex: 1 }}>
                            <textarea
                              value={c.captionText || ''}
                              onChange={e => setClipCaption(c.id, e.target.value)}
                              onFocus={() => { setSelectedClipId(c.id); seekToClip(i); }}
                              placeholder={c.aiContext ? `「${c.aiContext.slice(0, 20)}…」に重ねる短文` : '8〜15字の字幕'}
                              rows={2}
                              style={{
                                width: '100%', padding: '0.55rem 0.65rem',
                                background: 'rgba(255,255,255,0.85)',
                                border: `1px solid ${bg.cardBorder}`,
                                borderRadius: 8,
                                fontSize: 16, // iOS Safari の自動ズーム回避
                                fontFamily: 'inherit',
                                resize: 'none', lineHeight: 1.4,
                                minHeight: 44,
                              }}
                            />
                            {/* 絵文字提案 */}
                            {c.emojiOptions && c.emojiOptions.length > 0 && (
                              <div style={{
                                display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap',
                              }}>
                                {c.emojiOptions.slice(0, 6).map((em, ei) => (
                                  <button
                                    key={ei}
                                    onClick={() => appendEmojiToCaption(c.id, em)}
                                    title={`字幕末尾に ${em} を追加`}
                                    style={{
                                      padding: '1px 6px',
                                      background: 'rgba(255,255,255,0.85)',
                                      border: `1px solid ${bg.cardBorder}`,
                                      borderRadius: 999,
                                      fontSize: 13, lineHeight: 1.4,
                                      cursor: 'pointer',
                                    }}
                                  >{em}</button>
                                ))}
                              </div>
                            )}
                            {/* BGM ジャンル候補 (アップ/しっとり/ポップ/エモ) */}
                            <div style={{ display: 'flex', gap: 3, marginTop: 5, flexWrap: 'wrap' }}>
                              {BGM_MOOD_DEFS.map(m => {
                                const active = c.bgmMood === m.id;
                                return (
                                  <button
                                    key={m.id}
                                    onClick={() => setClipBgmMood(c.id, m.id)}
                                    title={`${m.desc} (${m.bpm} BPM) — 選択でカット長をビートに合わせる`}
                                    style={{
                                      padding: '2px 7px',
                                      background: active ? IRIS_GRADIENT : 'rgba(255,255,255,0.8)',
                                      color: active ? '#fff' : bg.ink,
                                      border: `1px solid ${active ? 'transparent' : bg.cardBorder}`,
                                      borderRadius: 999,
                                      fontSize: 10, fontWeight: 800,
                                      cursor: 'pointer',
                                      boxShadow: active ? '0 2px 8px rgba(225,48,108,0.28)' : 'none',
                                    }}
                                  >♪{m.label}</button>
                                );
                              })}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                              <span style={{ fontSize: 10, color: bg.inkSoft, minWidth: 28 }}>位置</span>
                              <input
                                type="range" min={0.1} max={0.95} step={0.01}
                                value={c.captionY ?? 0.78}
                                onChange={e => setClipCaptionY(c.id, Number(e.target.value))}
                                style={{ flex: 1 }}
                              />
                              <span style={{ fontSize: 10, color: bg.inkSoft, minWidth: 30, textAlign: 'right' }}>
                                {(c.captionText || '').length}字
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <Label>スタイル (全カット共通)</Label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {FONT_PRESETS.map(p => {
                    const active = captionPreset.id === p.id;
                    return (
                      <button key={p.id} onClick={() => setCaptionPreset(p)} style={{
                        padding: '0.5rem 0.95rem',
                        background: active ? IRIS_GRADIENT : 'rgba(255,255,255,0.7)',
                        color: active ? '#fff' : bg.ink,
                        border: `1px solid ${active ? 'transparent' : bg.cardBorder}`,
                        borderRadius: 999,
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        fontFamily: p.font.replace(/"/g, ''),
                        boxShadow: active ? '0 4px 14px rgba(225,48,108,0.32)' : 'none',
                      }}>{p.label}</button>
                    );
                  })}
                </div>
              </>
            )}

            {/* === STEP 4: 書き出し === */}
            {step === 'export' && (
              <>
                {!exportUrl ? (
                  <>
                    <p style={{ fontSize: 13, color: bg.inkSoft, marginBottom: 16, fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>
                      準備ができたら、書き出して Instagram へ
                    </p>
                    <button onClick={startRecord} disabled={!clips.length || recording} style={{
                      width: '100%', minHeight: 64, padding: '1.1rem',
                      background: clips.length && !recording ? IRIS_GRADIENT : 'rgba(255,255,255,0.4)',
                      color: '#fff', border: 'none', borderRadius: 18,
                      fontSize: 16, fontWeight: 800,
                      cursor: clips.length && !recording ? 'pointer' : 'not-allowed',
                      boxShadow: clips.length ? '0 12px 32px rgba(225,48,108,0.32)' : 'none',
                      fontFamily: IRIS_FONTS.body,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                      {recording
                        ? <><Loader2 size={16} className="iris-spin" /> 書き出し中 {Math.round(progress * 100)}%</>
                        : <><Wand2 size={16} /> リールを書き出す</>}
                    </button>
                  </>
                ) : (
                  <>
                    <video src={exportUrl} controls style={{
                      width: '100%', maxWidth: 280, margin: '0 auto 14px',
                      display: 'block', borderRadius: 18,
                      boxShadow: '0 12px 32px rgba(225,48,108,0.18)', background: '#000',
                    }} />

                    {/* AI 生成キャプション + ハッシュタグ */}
                    {aiResult && (
                      <div style={{ marginBottom: 12 }}>
                        <Label>AI が書いた投稿本文</Label>
                        <div style={{
                          padding: '0.7rem 0.85rem',
                          background: 'rgba(255,255,255,0.7)',
                          border: `1px solid ${bg.cardBorder}`,
                          borderRadius: 12,
                          fontSize: 12.5, lineHeight: 1.55,
                          whiteSpace: 'pre-wrap',
                          marginBottom: 8,
                          color: bg.ink,
                        }}>{aiResult.caption || '—'}</div>
                        {aiResult.hashtags.length > 0 && (
                          <div style={{
                            padding: '0.55rem 0.7rem',
                            background: 'rgba(225,48,108,0.06)',
                            border: `1px solid ${bg.accent}33`,
                            borderRadius: 10,
                            fontSize: 11.5, lineHeight: 1.6,
                            color: bg.accent, fontWeight: 700,
                            wordBreak: 'break-all',
                          }}>{aiResult.hashtags.join(' ')}</div>
                        )}
                        <button
                          onClick={() => {
                            const txt = aiResult.caption + (aiResult.hashtags.length ? '\n\n' + aiResult.hashtags.join(' ') : '');
                            try { navigator.clipboard.writeText(txt); setScheduledMsg('本文をコピーしました'); }
                            catch { setScheduledMsg('コピーに失敗しました'); }
                          }}
                          style={{
                            marginTop: 6, padding: '0.4rem 0.8rem',
                            background: 'transparent',
                            border: `1px solid ${bg.cardBorder}`,
                            borderRadius: 999,
                            fontSize: 11, color: bg.ink, cursor: 'pointer',
                          }}
                        >本文 + ハッシュタグをコピー</button>
                        {aiResult.storyText && (
                          <div style={{
                            marginTop: 8, padding: '0.55rem 0.7rem',
                            background: 'rgba(251,191,36,0.10)',
                            border: '1px solid rgba(251,191,36,0.35)',
                            borderRadius: 10,
                            fontSize: 12, color: bg.ink, lineHeight: 1.5,
                          }}>
                            <div style={{
                              fontSize: 9, letterSpacing: '0.22em', fontWeight: 800,
                              color: '#B45309', marginBottom: 4, textTransform: 'uppercase',
                            }}>STORY 用</div>
                            {aiResult.storyText}
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'grid', gap: 8 }}>
                      <button onClick={download} style={{ ...btnPri(), width: '100%' }}>
                        <Download size={14} /> {exportMime.startsWith('video/mp4') ? 'MP4 をダウンロード' : 'WebM をダウンロード'}
                      </button>
                      {!exportMime.startsWith('video/mp4') && (
                        <div style={{
                          padding: '0.4rem 0.6rem',
                          background: 'rgba(251,191,36,0.12)',
                          border: '1px solid rgba(251,191,36,0.4)',
                          borderRadius: 8,
                          fontSize: 10.5, color: bg.inkSoft, lineHeight: 1.4,
                        }}>
                          このブラウザは MP4 書き出しに非対応のため WebM になります。Instagram にそのまま上げると弾かれることがあるので、その場合は <b>Safari</b> で同じ操作を行うか、<b>CloudConvert / HandBrake</b> で MP4 に変換してください。
                        </div>
                      )}
                      {/* ─── Instagram 共有導線 (3 ボタン) ─── */}
                      <div style={{
                        marginTop: 4, padding: '0.75rem 0.65rem',
                        background: 'linear-gradient(135deg, rgba(225,48,108,0.06), rgba(247,119,55,0.08))',
                        border: `1px solid ${bg.accent}33`,
                        borderRadius: 14,
                      }}>
                        <div style={{
                          fontSize: 10, letterSpacing: '0.22em', fontWeight: 800,
                          color: bg.accent, textTransform: 'uppercase',
                          marginBottom: 8, paddingLeft: 2,
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}>
                          <Camera size={11} /> Instagram にすぐ送る
                        </div>
                        <div style={{ display: 'grid', gap: 6 }}>
                          <button
                            onClick={openInInstagram}
                            disabled={igBusy}
                            style={{
                              width: '100%', minHeight: 56,
                              padding: '0.85rem 1rem',
                              background: igBusy ? 'rgba(255,255,255,0.5)' : 'linear-gradient(135deg, #833AB4, #E1306C, #F77737)',
                              color: '#fff', border: 'none', borderRadius: 14,
                              fontSize: 14, fontWeight: 800,
                              cursor: igBusy ? 'wait' : 'pointer',
                              boxShadow: igBusy ? 'none' : '0 8px 22px rgba(225,48,108,0.32)',
                              fontFamily: IRIS_FONTS.body,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            }}
                          >
                            {igBusy
                              ? <><Loader2 size={15} className="iris-spin" /> 共有中…</>
                              : <><Camera size={15} /> インスタで開く</>}
                          </button>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            <button
                              onClick={copyAllCaptions}
                              style={{
                                minHeight: 44,
                                padding: '0.6rem 0.4rem',
                                background: 'rgba(255,255,255,0.85)',
                                color: bg.ink,
                                border: `1px solid ${bg.cardBorder}`,
                                borderRadius: 12,
                                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                fontFamily: IRIS_FONTS.body,
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                              }}
                            >
                              <Copy size={12} /> 字幕コピー
                            </button>
                            <button
                              onClick={runCaptionGen}
                              disabled={capBusy}
                              style={{
                                minHeight: 44,
                                padding: '0.6rem 0.4rem',
                                background: capBusy ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.85)',
                                color: bg.ink,
                                border: `1px solid ${bg.cardBorder}`,
                                borderRadius: 12,
                                fontSize: 12, fontWeight: 700,
                                cursor: capBusy ? 'wait' : 'pointer',
                                fontFamily: IRIS_FONTS.body,
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                              }}
                            >
                              {capBusy
                                ? <><Loader2 size={12} className="iris-spin" /> 生成中</>
                                : <><MessageSquare size={12} /> 本文 AI 生成</>}
                            </button>
                          </div>
                        </div>
                        {capErr && (
                          <div style={{
                            marginTop: 6, padding: '0.45rem 0.6rem',
                            background: '#FEE2E2', color: '#991B1B',
                            borderRadius: 8, fontSize: 11, lineHeight: 1.4,
                          }}>{capErr}</div>
                        )}
                        {aiCaption && (
                          <div style={{
                            marginTop: 8, padding: '0.6rem 0.7rem',
                            background: 'rgba(255,255,255,0.85)',
                            border: `1px solid ${bg.cardBorder}`,
                            borderRadius: 10, fontSize: 12, lineHeight: 1.55,
                            whiteSpace: 'pre-wrap', color: bg.ink,
                          }}>
                            {aiCaption.caption}
                            {aiCaption.hashtags.length > 0 && (
                              <div style={{
                                marginTop: 6, color: bg.accent, fontWeight: 700,
                                wordBreak: 'break-all', fontSize: 11.5,
                              }}>{aiCaption.hashtags.join(' ')}</div>
                            )}
                            <button
                              onClick={async () => {
                                const txt = aiCaption.caption + (aiCaption.hashtags.length ? '\n\n' + aiCaption.hashtags.join(' ') : '');
                                try { await navigator.clipboard.writeText(txt); setScheduledMsg('AI 本文をコピーしました'); }
                                catch { setScheduledMsg('コピーに失敗しました'); }
                              }}
                              style={{
                                marginTop: 6, padding: '0.4rem 0.8rem',
                                background: 'transparent', border: `1px solid ${bg.cardBorder}`,
                                borderRadius: 999, fontSize: 10.5, color: bg.ink,
                                cursor: 'pointer',
                              }}
                            >この本文をコピー</button>
                          </div>
                        )}
                      </div>
                      <button onClick={copyStoryText} style={{
                        ...btnSec(bg), width: '100%',
                        background: 'rgba(225,48,108,0.08)',
                        borderColor: bg.accent + '55',
                      }}>
                        <Share2 size={14} /> Instagram Story 用テキストをコピー
                      </button>
                      {postQueue && !scheduled && (
                        <button onClick={sendToQueue} style={{
                          ...btnPri(), width: '100%',
                          background: 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)',
                          boxShadow: '0 6px 20px rgba(22, 163, 74, 0.28)',
                        }}>
                          <Share2 size={14} /> 投稿予約に追加 (キャプション付き)
                        </button>
                      )}
                      {scheduled && onJumpToSchedule && (
                        <button onClick={onJumpToSchedule} style={{ ...btnSec(bg), width: '100%' }}>
                          <Share2 size={14} /> 予約一覧をひらく
                        </button>
                      )}
                      {!postQueue && onJumpToSchedule && (
                        <button onClick={onJumpToSchedule} style={{ ...btnSec(bg), width: '100%' }}>
                          <Share2 size={14} /> 投稿予約をつくる
                        </button>
                      )}
                      <ShareArtifactButton
                        variant="pill"
                        size="md"
                        accent={bg.accent}
                        label="お友達にリールを送る"
                        shareText={aiResult?.caption || 'AI で作ったリール、見て'}
                        artifact={{
                          kind: 'reel',
                          title: aiResult?.themeGuess ? `${aiResult.themeGuess} のリール` : 'AI が作ったリール',
                          body: aiResult?.caption || '',
                          source: 'iris',
                          createdAt: new Date().toISOString(),
                        }}
                      />
                      <button onClick={() => { setExportUrl(null); setProgress(0); setScheduled(false); setScheduledMsg(''); }} style={{ ...btnSec(bg), width: '100%' }}>
                        <Wand2 size={14} /> 別ver. を書き出す
                      </button>
                      {scheduledMsg && (
                        <div style={{
                          padding: '0.55rem 0.7rem',
                          background: scheduled ? 'rgba(22,163,74,0.1)' : 'rgba(225,48,108,0.06)',
                          color: scheduled ? '#15803D' : bg.ink,
                          borderRadius: 10, fontSize: 12, textAlign: 'center',
                        }}>{scheduledMsg}</div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

          </motion.div>
        </AnimatePresence>

        {/* 詳細モードへ */}
        {onOpenAdvanced && (
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <button onClick={onOpenAdvanced} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '0.5rem 1rem',
              background: 'transparent', color: bg.inkSoft,
              border: `1px solid ${bg.cardBorder}`, borderRadius: 999,
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
              fontFamily: IRIS_FONTS.body,
            }}>
              <Settings2 size={11} /> 詳細モード
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes iris-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        .iris-spin { animation: iris-spin 0.9s linear infinite; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

// ─── Sub Components ─────
function Glass({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.6)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.7)',
      borderRadius: 18,
      boxShadow: '0 4px 18px rgba(225,48,108,0.06)',
    }}>{children}</div>
  );
}
function Label({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      fontSize: 10, letterSpacing: '0.22em', fontWeight: 800,
      color: '#E1306C', textTransform: 'uppercase',
      marginBottom: 7,
    }}>{icon}{children}</div>
  );
}
function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div style={{
      margin: '8px 12px 12px', padding: '0.55rem 0.7rem',
      background: '#FEE2E2', color: '#991B1B',
      borderRadius: 8, fontSize: 11,
      display: 'flex', alignItems: 'center', gap: 5,
    }}>
      <Trash2 size={11} /> {msg}
    </div>
  );
}
function btnPri(): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '0.85rem 1.4rem',
    background: IRIS_GRADIENT,
    color: '#fff', border: 'none', borderRadius: 999,
    fontSize: 13.5, fontWeight: 800, cursor: 'pointer',
    boxShadow: '0 6px 20px rgba(225,48,108,0.28)',
    fontFamily: IRIS_FONTS.body,
  };
}
function btnSec(bg: IrisBackgroundDef): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '0.85rem 1.4rem',
    background: 'rgba(255,255,255,0.75)', color: bg.ink,
    border: `1.5px solid ${bg.accent}`, borderRadius: 999,
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    fontFamily: IRIS_FONTS.body,
  };
}

function iconBtn(bg: IrisBackgroundDef, disabled: boolean): React.CSSProperties {
  return {
    width: 26, height: 26, borderRadius: 7,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: 0,
    background: disabled ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.9)',
    color: bg.ink,
    border: `1px solid ${bg.cardBorder}`,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  };
}

// avoid unused imports
void ImageIcon; void Film;
