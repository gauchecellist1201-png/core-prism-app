// ============================================================
// CORE Iris ▸ Reel Studio (Minimal V2)
// ・Iris LP グラデ (#E1306C → #F77737 → #FBBF24)
// ・キャンバス中央、ステップ式 (素材 → 編集 → 字幕 → 書出)
// ・少ない文字、美しさ重視、ガラスモーフィズム
// ・既存のフル機能は IrisReelStudio.tsx に残る (詳細モード)
// ============================================================
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Image as ImageIcon, Film, Music, Play, Square, Download, Share2,
  Sparkles, Wand2, ChevronRight, Plus, X, Trash2, Settings2, Loader2,
  Flame, Scissors, ArrowLeft, ArrowRight, Eye, Type as TypeIcon,
  AlertCircle, Copy, MessageSquare, Layers, Camera, Mic,
} from 'lucide-react';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { BGM_LIBRARY, VIRAL_PATTERNS, TREND_PULSE_2026_Q2, loadVideo, VIDEO_FORMAT_HELP } from './IrisReelStudio';
import {
  generateReelCaptions,
  type ReelAiResult,
  type BgmMood,
  BGM_MOOD_DEFS,
  snapDurationToBgm,
} from './reelAiCaption';
import { generateReelScript, generateReelCaption, type ReelScriptResult } from './reelAiScript';
import type { ReelStudioSeed } from './IrisReelStudio';
import { suggestNextSlot, type ScheduledPost } from './usePostQueue';
import { notifyInApp } from '../lib/inAppNotify';
import ShareArtifactButton from '../components/ShareArtifactButton';
import GenerationReward from '../components/GenerationReward';
import { shareToInstagram } from './instagramShare';
import {
  REEL_PRESETS, getPreset, drawPresetDecorations, drawPresetBackground,
  type PresetId,
} from './reelStudio/Presets';
import {
  routeEditCommand, interpretEditWithAi, applyActions,
  type ReelEditCtx, type ColorMoodId,
} from './reelChatEdit';

/** キャプションの「最初の1行」を別フックに差し替える（2行目以降は維持） */
function swapFirstLine(caption: string, newHook: string): string {
  const idx = caption.indexOf('\n');
  if (idx === -1) return newHook;
  return newHook + caption.slice(idx);
}

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
  /** 「素材から構成」の結果（順番・秒数・字幕＋素材）。マウント時に1回だけ展開 */
  initialProject?: ReelStudioSeed | null;
  /** 取り込み済みを親に通知（再展開防止） */
  onConsumeInitial?: () => void;
  /** 朝ブリーフ/フローの「今日の一手」テーマ。届いたら入力欄に入れ、AI台本を自動生成する（手入力ゼロ） */
  initialTheme?: string | null;
  /** テーマ取り込み済みを親に通知（再生成防止） */
  onConsumeTheme?: () => void;
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
  /** このカットの終わり→次への繋ぎ (未指定はプリセットの transition を使う) */
  transition?: ClipTransition;
}

/** クリップ間フェード (per-clip)。none=そのまま/fade=黒/white=白フラッシュ/dissolve=次とクロス/slide=横スライド */
type ClipTransition = 'none' | 'fade' | 'white' | 'dissolve' | 'slide';
const CLIP_TRANSITIONS: { id: ClipTransition; label: string }[] = [
  { id: 'none',     label: 'なし' },
  { id: 'fade',     label: 'フェード' },
  { id: 'white',    label: 'ホワイト' },
  { id: 'dissolve', label: 'ディゾルブ' },
  { id: 'slide',    label: 'スライド' },
];

/** リール全体のカラーの雰囲気。CSS filter 文字列を描画前の ctx.filter に適用 */
type ColorMood = 'none' | 'bright' | 'warm' | 'cool' | 'film' | 'mono' | 'vivid';
const COLOR_MOODS: { id: ColorMood; label: string; filter: string; swatch: string }[] = [
  { id: 'none',   label: 'そのまま', filter: 'none',                                         swatch: 'linear-gradient(135deg,#c9c9c9,#efefef)' },
  { id: 'bright', label: '明るく',   filter: 'brightness(1.12) saturate(1.08)',              swatch: 'linear-gradient(135deg,#fff2c4,#fffdf5)' },
  { id: 'warm',   label: '暖色',     filter: 'saturate(1.15) sepia(0.15) brightness(1.02)',  swatch: 'linear-gradient(135deg,#ff9a5a,#ffd27a)' },
  { id: 'cool',   label: '寒色',     filter: 'saturate(1.05) hue-rotate(-12deg) brightness(1.02)', swatch: 'linear-gradient(135deg,#5aa9ff,#a5e4ff)' },
  { id: 'film',   label: 'シネマ',   filter: 'contrast(1.1) saturate(0.85) brightness(0.95)', swatch: 'linear-gradient(135deg,#4a4636,#8a7f6a)' },
  { id: 'mono',   label: 'モノクロ', filter: 'grayscale(1) contrast(1.05)',                  swatch: 'linear-gradient(135deg,#3a3a3a,#c4c4c4)' },
  { id: 'vivid',  label: '鮮やか',   filter: 'saturate(1.5) contrast(1.08)',                 swatch: 'linear-gradient(135deg,#ff2d75,#ffd02d)' },
];

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
// loadVideo は IrisReelStudio の 10 秒タイムアウト + HEVC 案内つき実装を共用
// (HEVC の .mov は onerror すら発火せず永久ハングするため、素の onloadeddata 待ちは禁止)
const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

function drawCover(ctx: CanvasRenderingContext2D, el: HTMLImageElement | HTMLVideoElement, sw: number, sh: number, dw: number, dh: number, progress = 0, filter = 'none', dx = 0) {
  const sr = sw / sh, dr = dw / dh;
  let sx = 0, sy = 0, cw = sw, ch = sh;
  if (sr > dr) { cw = sh * dr; sx = (sw - cw) / 2; }
  else { ch = sw / dr; sy = (sh - ch) / 2; }
  // Ken Burns: 軽い zoom in
  const scale = 1 + 0.08 * easeInOut(progress);
  const zw = cw / scale, zh = ch / scale;
  sx += (cw - zw) / 2; sy += (ch - zh) / 2;
  // カラーの雰囲気 (color mood) は素材にのみ掛ける。描画後に必ず none へ戻す
  const prevFilter = ctx.filter;
  if (filter && filter !== 'none') ctx.filter = filter;
  ctx.drawImage(el, sx, sy, zw, zh, dx, 0, dw, dh);
  ctx.filter = prevFilter;
}

// ─── Main Component ─────
export default function IrisReelStudioMinimal({ bg, onJumpToSchedule, onOpenAdvanced, postQueue, initialProject, onConsumeInitial, initialTheme, onConsumeTheme }: Props) {
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
  // カラーの雰囲気 (リール全体・素材にのみ掛ける)
  const [colorMood, setColorMood] = useState<ColorMood>('none');
  // おまかせ編集が自動で決めたこと (「カラー: 暖色 / 繋ぎ: 自動 / 15秒」) — 納得感のための一言
  const [autoSummary, setAutoSummary] = useState<string>('');
  // タイムラインのドラッグ並べ替え (CapCut 風・長押しドラッグ)
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dragXY, setDragXY] = useState<{ x: number; y: number } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // AI 台本生成 (テーマ → 3 シーン)
  const [scriptBusy, setScriptBusy] = useState(false);

  // ── 音声→字幕: 喋るだけで空きカットから順に字幕が入る (リール特化の要) ──
  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceLive, setVoiceLive] = useState(''); // 認識途中のテキスト (確定前)
  const voiceRecRef = useRef<any>(null);
  const voiceCutIdxRef = useRef(0);
  const clipsLenRef = useRef(0);
  useEffect(() => { clipsLenRef.current = clips.length; }, [clips]);
  const voiceSupported = typeof window !== 'undefined'
    && !!((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition);

  const stopVoice = useCallback(() => {
    try { voiceRecRef.current?.stop(); } catch { /* */ }
    voiceRecRef.current = null;
    setVoiceOn(false); setVoiceLive('');
  }, []);

  const startVoice = useCallback(() => {
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR || clips.length === 0) return;
    // 字幕が空のカットの先頭から埋める (全部埋まっていれば最後のカットに追記)
    const firstEmpty = clips.findIndex(c => !(c.captionText || '').trim());
    voiceCutIdxRef.current = firstEmpty >= 0 ? firstEmpty : clips.length - 1;
    const rec = new SR();
    rec.lang = 'ja-JP';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          const text = (r[0]?.transcript || '').trim();
          if (text) {
            const idx = Math.min(voiceCutIdxRef.current, Math.max(0, clipsLenRef.current - 1));
            setClips(prev => prev.map((c, i2) => i2 === idx
              ? { ...c, captionText: ((c.captionText || '').trim() ? `${c.captionText} ` : '') + text }
              : c));
            // ひと息(確定)ごとに次のカットへ進む — 話す順=カット順で自然に埋まる
            if (voiceCutIdxRef.current < clipsLenRef.current - 1) voiceCutIdxRef.current += 1;
          }
        } else {
          interim += r[0]?.transcript || '';
        }
      }
      setVoiceLive(interim);
    };
    rec.onerror = () => {
      // マイク拒否や無音タイムアウト — 固まらせず静かに停止 (再タップで再開できる)
      voiceRecRef.current = null;
      setVoiceOn(false); setVoiceLive('');
    };
    rec.onend = () => {
      voiceRecRef.current = null;
      setVoiceOn(false); setVoiceLive('');
    };
    try { rec.start(); voiceRecRef.current = rec; setVoiceOn(true); } catch { /* 二重start等は無視 */ }
  }, [clips]);

  // アンマウント時に確実に停止 (裏で録音が残る事故防止)
  useEffect(() => () => { try { voiceRecRef.current?.stop(); } catch { /* */ } }, []);
  const [scriptPhase, setScriptPhase] = useState<string>(''); // 「今 AI が何をしているか」の実況
  const [scriptErr, setScriptErr] = useState<string>('');
  const [scriptResult, setScriptResult] = useState<ReelScriptResult | null>(null);
  const scriptTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Instagram キャプション AI 生成
  const [capBusy, setCapBusy] = useState(false);
  const [capErr, setCapErr] = useState<string>('');
  const [aiCaption, setAiCaption] = useState<{ caption: string; hashtags: string[] } | null>(null);
  // AI 生成が終わった「その瞬間」を祝うごほうび演出 (台本・字幕・投稿文の 3 か所で共有)
  const [reward, setReward] = useState<{ label: string; detail?: string } | null>(null);
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
    // f.type が空になる環境 (D&D の .mov 等) があるため拡張子でも振り分ける
    const imgs = arr.filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|gif)$/i.test(f.name));
    const vids = arr.filter(f => f.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(f.name));
    const auds = arr.filter(f => f.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg)$/i.test(f.name));
    if (auds[0]) setBgmFile(auds[0]);

    const newClips: Clip[] = [];
    const failed: string[] = [];
    for (const f of imgs) {
      const url = URL.createObjectURL(f);
      try { const el = await loadImage(url); newClips.push({ id: makeId(), kind: 'image', url, duration: 2.5, el }); }
      catch { failed.push(`${f.name}: 画像を読めませんでした`); URL.revokeObjectURL(url); }
    }
    for (const f of vids) {
      const url = URL.createObjectURL(f);
      try { const el = await loadVideo(url); newClips.push({ id: makeId(), kind: 'video', url, duration: Math.min(el.duration || 3, 6), el }); }
      catch (err: any) { failed.push(`${f.name}: ${err?.message || `動画を読めませんでした。${VIDEO_FORMAT_HELP}`}`); URL.revokeObjectURL(url); }
    }
    if (!imgs.length && !vids.length && !auds.length && arr.length) {
      failed.push('対応形式: 画像 (jpg/png/webp), 動画 (mp4/mov/webm), 音楽 (mp3/wav/m4a)');
    }
    if (failed.length) setUploadErr(failed.join('\n'));
    if (newClips.length) setClips(prev => [...prev, ...newClips]);
    // チャットバー等の呼び出し元が「何件入ったか」を正直に伝えられるよう件数を返す
    return newClips.length;
  }, []);

  // 「素材から構成」の結果をマウント時に1回だけ展開（一気通貫の最終段）。
  // AI が決めた順番でクリップを並べ、各カットの秒数・字幕(captionText)を反映する。
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !initialProject?.clips?.length) return;
    seededRef.current = true;
    let cancelled = false;
    (async () => {
      // おまかせ編集が決めた繋ぎ(transition)を検証して各カットに載せる
      const validTrans = new Set<ClipTransition>(['none', 'fade', 'white', 'dissolve', 'slide']);
      const seedTrans = (t?: string): ClipTransition | undefined =>
        (t && validTrans.has(t as ClipTransition)) ? (t as ClipTransition) : undefined;
      const built: Clip[] = [];
      for (const seed of initialProject.clips) {
        const url = URL.createObjectURL(seed.file);
        const isVideo = (seed.file.type || '').startsWith('video');
        try {
          if (isVideo) {
            const el = await loadVideo(url);
            built.push({ id: makeId(), kind: 'video', url, duration: Math.min(seed.durationSec || el.duration || 4, Math.max(2, el.duration || 6)), el, captionText: seed.overlayText, transition: seedTrans(seed.transition) });
          } else {
            const el = await loadImage(url);
            built.push({ id: makeId(), kind: 'image', url, duration: Math.max(1.5, Math.min(seed.durationSec || 2.5, 8)), el, captionText: seed.overlayText, transition: seedTrans(seed.transition) });
          }
        } catch { URL.revokeObjectURL(url); /* 壊れた素材はスキップ（残りは展開） */ }
      }
      if (cancelled) return;
      if (built.length) setClips(built);
      if (initialProject.caption) {
        setAiCaption({ caption: initialProject.caption, hashtags: initialProject.hashtags || [] });
      }
      // おまかせ編集が自動選定したカラーの雰囲気を適用
      const validMoods = new Set<ColorMood>(['none', 'bright', 'warm', 'cool', 'film', 'mono', 'vivid']);
      if (initialProject.colorMood && validMoods.has(initialProject.colorMood as ColorMood)) {
        setColorMood(initialProject.colorMood as ColorMood);
      }
      if (initialProject.autoSummary) setAutoSummary(initialProject.autoSummary);
      onConsumeInitial?.();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProject]);

  // ─── BGM ライブラリから取得 ─────
  const applyBgm = useCallback(async (track: typeof BGM_LIBRARY[0]) => {
    setBgmLoading(track.id);
    try {
      const res = await fetchWithTimeout(track.url, {}, 30000);
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
      setReward({ label: '字幕ができました！', detail: `${clips.length} カットに反映しました` });
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
  const runAiScript = useCallback(async (overrideTheme?: string) => {
    const theme = (overrideTheme ?? themeHint).trim();
    if (!theme) {
      setScriptErr('上の入力欄にテーマを入れてからもう一度押してください');
      return;
    }
    setScriptBusy(true); setScriptErr(''); setScriptResult(null);
    // 「今 AI が何をしているか」を順番に見せる実況ティッカー。
    // 1 回の通信中でも画面が動き続けるので「固まった？」という不安が消える。
    const phases = [
      '🪄 テーマを読み解いています…',
      '3 シーンの流れを組み立てています…',
      '字幕を短く言い切る形にしています…',
      'ハッシュタグと投稿文を整えています…',
      'もうすぐできあがります…',
    ];
    let pi = 0;
    setScriptPhase(phases[0]);
    if (scriptTickRef.current) clearInterval(scriptTickRef.current);
    scriptTickRef.current = setInterval(() => {
      pi = Math.min(pi + 1, phases.length - 1); // 最後の一文で待機（巻き戻さない）
      setScriptPhase(phases[pi]);
    }, 1100);
    try {
      const result = await generateReelScript(theme);
      setScriptResult(result);
      setReward({ label: '台本ができました！', detail: `${result.scenes.length} シーンの構成を用意しました` });
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
      if (scriptTickRef.current) { clearInterval(scriptTickRef.current); scriptTickRef.current = null; }
      setScriptPhase('');
      setScriptBusy(false);
    }
  }, [themeHint, presetId]);

  // アンマウント時にティッカーが残らないように後始末
  useEffect(() => () => { if (scriptTickRef.current) clearInterval(scriptTickRef.current); }, []);

  // 朝ブリーフ/フローの「今日の一手」テーマが届いたら、入力欄に入れてそのまま AI 台本を自動生成する。
  // タップ → 何も打たずに台本ができあがる一気通貫（手入力ゼロ）。マウント時に1回だけ。
  const themeSeededRef = useRef(false);
  useEffect(() => {
    const t = (initialTheme || '').trim();
    if (themeSeededRef.current || !t) return;
    themeSeededRef.current = true;
    setThemeHint(t);
    onConsumeTheme?.();
    void runAiScript(t);
  }, [initialTheme, onConsumeTheme, runAiScript]);

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

    const moodFilter = COLOR_MOODS.find(m => m.id === colorMood)?.filter || 'none';
    const srcWH = (elx: HTMLImageElement | HTMLVideoElement): [number, number] => [
      elx instanceof HTMLVideoElement ? (elx.videoWidth || OUT_W) : (elx as HTMLImageElement).naturalWidth,
      elx instanceof HTMLVideoElement ? (elx.videoHeight || OUT_H) : (elx as HTMLImageElement).naturalHeight,
    ];
    const el = cur.el;
    if (el) {
      const [sw, sh] = srcWH(el);
      drawCover(ctx, el, sw, sh, canvas.width, canvas.height, localT, moodFilter);
    }

    // クリップ間トランジション — そのカットの transition を優先、無ければプリセットの transition
    const remaining = (acc + cur.duration) - t;
    const presetTrans: ClipTransition = preset?.transition === 'cut' ? 'none'
      : preset?.transition === 'dissolve' ? 'dissolve' : 'fade';
    const trans: ClipTransition = cur.transition ?? presetTrans;
    const nextClip = clips[curIdx + 1];
    const win = trans === 'none' ? 0.12 : trans === 'dissolve' ? 0.5 : 0.4;
    if (remaining < win && trans !== 'none') {
      const k = Math.max(0, Math.min(1, (win - remaining) / win)); // 0→1
      if (trans === 'white') {
        ctx.fillStyle = `rgba(255,255,255,${k})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (trans === 'dissolve' && nextClip?.el) {
        // 次カットをクロスフェードで重ねる
        const [nsw, nsh] = srcWH(nextClip.el);
        ctx.save();
        ctx.globalAlpha = k;
        drawCover(ctx, nextClip.el, nsw, nsh, canvas.width, canvas.height, 0, moodFilter);
        ctx.restore();
      } else if (trans === 'slide' && nextClip?.el) {
        // 次カットを右から横スライドで入れる (簡易)
        const [nsw, nsh] = srcWH(nextClip.el);
        drawCover(ctx, nextClip.el, nsw, nsh, canvas.width, canvas.height, 0, moodFilter, canvas.width * (1 - k));
      } else {
        // fade、または次カットが無い dissolve/slide → 黒フェードで安全に締める
        ctx.fillStyle = `rgba(0,0,0,${k})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
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
  }, [clips, captionPreset, totalDuration, presetId, colorMood]);

  // ─── 静止描画 (再生してない時) ─────
  useEffect(() => { if (!playing) drawAt(currentTime); }, [drawAt, playing, clips, captionPreset, currentTime, presetId, colorMood]);

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
  /** ドラッグ並べ替え: from の位置のクリップを to の位置へ移す (配列は据え置き移動) */
  const reorderClip = (fromIdx: number, toIdx: number) => {
    setClips(prev => {
      if (fromIdx < 0 || fromIdx >= prev.length || toIdx < 0 || toIdx >= prev.length || fromIdx === toIdx) return prev;
      const next = prev.slice();
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };
  /** そのカットのトランジション (繋ぎ) を選ぶ */
  const setClipTransition = (id: string, tr: ClipTransition) => {
    setClips(prev => prev.map(c => c.id === id ? { ...c, transition: tr } : c));
  };
  /** 全体を指定秒数に均等配分。冒頭カットだけ気持ち短めのフック配分にする */
  const autoDistribute = (targetSec: number) => {
    setClips(prev => {
      const n = prev.length;
      if (n === 0) return prev;
      if (n === 1) return prev.map(c => ({ ...c, duration: Math.max(0.5, Math.min(15, targetSec)) }));
      // 冒頭カット = フックなので平均の 0.7 倍、残りで均等割り
      const even = targetSec / n;
      const hook = Math.max(0.8, even * 0.7);
      const rest = (targetSec - hook) / (n - 1);
      return prev.map((c, i) => ({
        ...c,
        duration: Math.max(0.5, Math.min(15, Number((i === 0 ? hook : rest).toFixed(1)))),
      }));
    });
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

  // ─── タイムラインの長押しドラッグ並べ替え (CapCut 風・タッチ対応) ─────
  // Pointer Events を自作。長押し (200ms) で掴む → 横に動かすと挿入位置がハイライト
  // → 離すと並べ替え。長押し前に動いたらスクロール意図とみなしドラッグしない。
  const thumbIndexAtX = (clientX: number): number | null => {
    const container = timelineRef.current;
    if (!container) return null;
    const kids = Array.from(container.querySelectorAll('[data-clip-thumb]')) as HTMLElement[];
    if (!kids.length) return null;
    for (let i = 0; i < kids.length; i++) {
      const r = kids[i].getBoundingClientRect();
      if (clientX < r.left + r.width / 2) return i;
    }
    return kids.length - 1;
  };
  const beginThumbDrag = (e: React.PointerEvent, idx: number) => {
    // 左クリック / 主タッチのみ
    if (e.button != null && e.button !== 0) return;
    const startX = e.clientX, startY = e.clientY;
    let dragging = false;
    let currentOver = idx;
    const clearTimer = () => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } };
    const cleanup = () => {
      clearTimer();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    const move = (ev: PointerEvent) => {
      if (!dragging) {
        // 長押し確定前に大きく動いたら = スクロール意図。ドラッグは開始しない
        if (Math.abs(ev.clientX - startX) > 8 || Math.abs(ev.clientY - startY) > 8) cleanup();
        return;
      }
      ev.preventDefault();
      setDragXY({ x: ev.clientX, y: ev.clientY });
      const over = thumbIndexAtX(ev.clientX);
      if (over != null) { currentOver = over; setDragOverIdx(over); }
    };
    const up = () => {
      if (dragging && currentOver !== idx) reorderClip(idx, currentOver);
      setDragIdx(null); setDragOverIdx(null); setDragXY(null);
      cleanup();
    };
    longPressTimerRef.current = setTimeout(() => {
      dragging = true;
      setDragIdx(idx); setDragOverIdx(idx); setDragXY({ x: startX, y: startY });
      try { (navigator as any).vibrate?.(12); } catch { /* */ }
    }, 200);
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  // アンマウント時に長押しタイマーが残らないよう後始末
  useEffect(() => () => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); }, []);

  // ─── 投稿予約に追加 (AI 結果と一緒に) ─────
  const sendToQueue = async () => {
    if (!exportUrl || !postQueue) return;
    try {
      const resp = await fetchWithTimeout(exportUrl, {}, 30000);
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
      // rAF はタブが隠れると止まり書き出しが永久に終わらないため setTimeout 駆動
      setTimeout(tick, 1000 / 30);
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
        const res = await fetchWithTimeout(exportUrl, {}, 30000);
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
      setReward({ label: '投稿文ができました！', detail: `ハッシュタグ ${out.hashtags.length} 個つき` });
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

  /** 投稿本文 (字幕/AI 本文 + ハッシュタグ) をまとめる */
  const buildFullCaption = () =>
    (aiCaption?.caption || aiResult?.caption || clips.map(c => c.captionText).filter(Boolean).join('\n'))
    + (aiCaption?.hashtags?.length ? '\n\n' + aiCaption.hashtags.join(' ') : (aiResult?.hashtags?.length ? '\n\n' + aiResult.hashtags.join(' ') : ''));

  /**
   * Instagram へ投稿 (正直で実用的な最短導線)。
   * ・モバイル: 動画を Web Share でシェア (Instagram を選ぶ)。同時に本文をクリップボードへコピー。
   * ・PC: 動画DL + 本文コピー。リールはアプリからのみ投稿できる旨を正直に案内。
   * ※ IG 公式 API での Reel 直接 publish は公開URLとアプリ審査が必要で、ここでは行わない。
   */
  const openInInstagram = async () => {
    if (!exportUrl) return;
    setIgBusy(true);
    const captionAll = buildFullCaption();
    // 先に本文をコピー (共有シートで貼り付けられるように)
    let copied = false;
    try { await navigator.clipboard.writeText(captionAll); copied = true; } catch { /* 後段でフォールバック */ }
    try {
      const res = await fetchWithTimeout(exportUrl, {}, 30000);
      const blob = await res.blob();
      const ext = exportMime.startsWith('video/mp4') ? 'mp4' : 'webm';
      const filename = `iris-reel-${Date.now()}.${ext}`;
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const isMobile = /iPhone|iPad|iPod|Android/i.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
      const nav: any = navigator;
      const file = new File([blob], filename, { type: exportMime });

      if (isMobile && nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        // 動画ファイルを共有 → ユーザーが Instagram を選ぶ。本文はコピー済み
        await nav.share({ files: [file], title: 'リール', text: captionAll });
        setScheduledMsg(copied
          ? '共有シートで Instagram を選んでね。キャプションはコピー済み — 投稿画面で長押し→貼り付けできます'
          : '共有シートで Instagram を選んでね');
        return;
      }
      // 共有不可 → 汎用ヘルパーにフォールバック (DL + コピー + アプリ起動)
      const result = await shareToInstagram({ caption: captionAll, image: blob, filename });
      // PC は「アプリからのみ」を正直に伝える
      if (!isMobile) {
        setScheduledMsg('動画を保存し、本文をコピーしました。リールはスマホの Instagram アプリからのみ投稿できます — 動画をスマホに送って投稿してね');
      } else {
        setScheduledMsg(result.message);
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') { setScheduledMsg('共有をキャンセルしました'); }
      else setScheduledMsg(`Instagram への共有に失敗: ${e?.message || e}`);
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

  // ─── チャット型動画編集 (下部固定バー) ─────
  // 素材を投げて「暖かい感じで15秒にして」と言うだけで編集が進む。
  // 一段目: キーワードルーター (コード確定・即時) / 二段目: AI 解釈 (reelChatEdit.ts)
  const [chatMsgs, setChatMsgs] = useState<{ id: string; role: 'user' | 'assistant'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDragOver, setChatDragOver] = useState(false);
  const [chatVoiceOn, setChatVoiceOn] = useState(false);
  const chatRecRef = useRef<any>(null);
  const chatListRef = useRef<HTMLDivElement>(null);
  const clipsRef = useRef<Clip[]>([]);
  useEffect(() => { clipsRef.current = clips; }, [clips]);

  const pushChat = useCallback((role: 'user' | 'assistant', text: string) => {
    setChatMsgs(prev => [...prev.slice(-19), { id: makeId(), role, text }]);
    setChatOpen(true);
  }, []);

  // 履歴は常に最新へスクロール (最大高 40vh の内部スクロール)
  useEffect(() => {
    const el = chatListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMsgs, chatOpen, chatBusy]);

  /** 既存セッターを reelChatEdit の器 (ctx) に橋渡し。状態は常に最新の clipsRef から作る */
  const buildChatCtx = useCallback((): ReelEditCtx => {
    const cur = clipsRef.current;
    return {
      state: {
        clipCount: cur.length,
        totalSec: cur.reduce((s, c) => s + c.duration, 0),
        presetId,
        colorMood: colorMood as ColorMoodId,
        durations: cur.map(c => c.duration),
        captions: cur.map(c => c.captionText || ''),
      },
      applyPreset: (id) => applyPreset(id),
      setColorMood: (m) => setColorMood(m as ColorMood),
      autoDistribute: (sec) => autoDistribute(sec),
      setClipDuration: (i, sec) => { const c = clipsRef.current[i]; if (c) setClipDuration(c.id, sec); },
      reorder: (from, to) => reorderClip(from, to),
      setTransition: (i, tr) => {
        if (i === 'all') setClips(prev => prev.map(c => ({ ...c, transition: tr as ClipTransition })));
        else { const c = clipsRef.current[i]; if (c) setClipTransition(c.id, tr as ClipTransition); }
      },
      setCaption: (i, text) => { const c = clipsRef.current[i]; if (c) setClipCaption(c.id, text); },
      removeClip: (i) => { const c = clipsRef.current[i]; if (c) removeClip(c.id); },
      runAiCaptions: () => { void runAiCaption(); },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId, colorMood, applyPreset, runAiCaption]);

  /** チャットバーへの素材添付/ドロップ → 既存 addFiles で取込 → 件数を正直に応答 */
  const handleChatFiles = useCallback(async (files: FileList | File[]) => {
    const n = await addFiles(files);
    if (n > 0) {
      pushChat('assistant', `素材 ${n} 件を追加しました。「暖かい感じで 15 秒にして」のように話しかけてください`);
    } else {
      pushChat('assistant', '追加できる素材がありませんでした。画像 (jpg/png/webp) か動画 (mp4/mov/webm) を選んでください');
    }
  }, [addFiles, pushChat]);

  /** テキスト/音声の指示 → ルーター即適用、または AI 解釈 → 適用 → 要約返答 */
  const handleChatSend = useCallback(async (raw?: string) => {
    const text = (raw ?? chatInput).trim();
    if (!text || chatBusy) return;
    setChatInput('');
    pushChat('user', text);
    const ctx = buildChatCtx();
    // 一段目: キーワードルーター (コード確定・即時・無料)
    const routed = routeEditCommand(text, ctx.state);
    if (routed.length) {
      const summaries = applyActions(routed, ctx);
      pushChat('assistant', summaries.length ? `✓ ${summaries.join('。')}` : 'この指示には操作が見つかりませんでした');
      return;
    }
    // 二段目: AI 解釈 (30s タイムアウト・失敗時フォールバック文言)
    setChatBusy(true);
    try {
      const out = await interpretEditWithAi(text, ctx.state);
      if (out.actions.length) {
        const summaries = applyActions(out.actions, buildChatCtx());
        pushChat('assistant', (summaries.length ? `✓ ${summaries.join('。')}` : '') + (out.reply ? `${summaries.length ? '\n' : ''}${out.reply}` : ''));
      } else if (out.reply) {
        pushChat('assistant', out.reply);
      } else {
        throw new Error('empty');
      }
    } catch {
      pushChat('assistant', 'うまく聞き取れませんでした。「暖かい感じで 15 秒に」のように言ってみてください');
    } finally {
      setChatBusy(false);
    }
  }, [chatInput, chatBusy, buildChatCtx, pushChat]);

  /** マイク: 話し終わると入力欄へ入り自動送信 (ja-JP・非対応ブラウザではボタン非表示) */
  const stopChatVoice = useCallback(() => {
    try { chatRecRef.current?.stop(); } catch { /* */ }
  }, []);
  const startChatVoice = useCallback(() => {
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return;
    stopVoice(); // 字幕用の音声入力と同時起動しない (マイク競合防止)
    const rec = new SR();
    rec.lang = 'ja-JP';
    rec.continuous = false;
    rec.interimResults = true;
    let finalText = '';
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += (r[0]?.transcript || '');
        else interim += r[0]?.transcript || '';
      }
      setChatInput((finalText || interim).trim());
    };
    rec.onerror = () => { chatRecRef.current = null; setChatVoiceOn(false); };
    rec.onend = () => {
      chatRecRef.current = null;
      setChatVoiceOn(false);
      const t = finalText.trim();
      if (t) void handleChatSend(t);
    };
    try { rec.start(); chatRecRef.current = rec; setChatVoiceOn(true); } catch { /* 二重 start 等は無視 */ }
  }, [handleChatSend, stopVoice]);
  // アンマウント時に確実に停止
  useEffect(() => () => { try { chatRecRef.current?.stop(); } catch { /* */ } }, []);

  return (
    <div style={{
      position: 'relative',
      minHeight: '100dvh',
      // safe-area-inset 配慮: 下部はホームインジケータ + Dock + チャット編集バー分の余白を確保
      paddingBottom: 'max(11.5rem, calc(10rem + env(safe-area-inset-bottom, 0px)))',
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

      {/* AI 生成が終わった瞬間のごほうび — 画面中央にふわっと光って消える */}
      {reward && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 60 }}>
          <GenerationReward
            accent={bg.accent}
            label={reward.label}
            detail={reward.detail}
            onDone={() => setReward(null)}
          />
        </div>
      )}

      {/* ドラッグ中の浮遊サムネ — 掴んだクリップが指に付いてくる (CapCut 風) */}
      {dragIdx != null && dragXY && clips[dragIdx] && (
        <div style={{
          position: 'fixed', left: dragXY.x, top: dragXY.y,
          transform: 'translate(-50%, -50%) scale(1.08) rotate(-3deg)',
          width: 56, height: 92, borderRadius: 8, overflow: 'hidden',
          pointerEvents: 'none', zIndex: 70,
          boxShadow: '0 12px 28px rgba(0,0,0,0.35), 0 0 0 2px #fff',
          background: '#000',
        }}>
          {clips[dragIdx].kind === 'image'
            ? <img src={clips[dragIdx].url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <video src={clips[dragIdx].url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          }
        </div>
      )}

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

        {/* おまかせ編集が自動で決めたこと — 何が自動選定されたかを1行で見せて納得感を出す */}
        {autoSummary && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center',
            margin: '0 auto 1rem', maxWidth: 360,
            padding: '0.5rem 0.8rem',
            background: 'rgba(225,48,108,0.07)',
            border: `1px solid ${bg.accent}33`,
            borderRadius: 999, fontSize: 11.5, color: bg.ink, fontWeight: 700,
          }}>
            <Wand2 size={12} color={bg.accent} style={{ flexShrink: 0 }} />
            <span>おまかせで整えました — {autoSummary}</span>
          </div>
        )}

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
              <label
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) addFiles(e.dataTransfer.files); }}
                style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.72)', fontSize: 13,
                  textAlign: 'center', padding: '1.6rem', gap: 12, cursor: 'pointer',
                  background: dragOver ? 'rgba(225,48,108,0.18)' : 'transparent',
                  transition: 'background 0.2s',
                }}>
                <span style={{
                  width: 58, height: 58, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: IRIS_GRADIENT, boxShadow: '0 10px 28px rgba(225,48,108,0.5)',
                }}>
                  <Plus size={30} color="#fff" strokeWidth={2} />
                </span>
                <span style={{ fontFamily: IRIS_FONTS.body, fontWeight: 800, fontSize: 14.5, color: '#fff' }}>
                  写真・動画を入れる
                </span>
                <span style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                  タップ、またはドロップ
                </span>
                <input type="file" multiple accept="image/*,video/*" style={{ display: 'none' }}
                  onChange={e => e.target.files && addFiles(e.target.files)} />
              </label>
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

        {/* 3 秒でわかる説明 + サンプル出力 — まだ素材が無い初見の人に「何が出るか」を触らず見せる */}
        {/* JSアニメ非依存の素のdiv: rAFが止まる環境(低電力モード等)でも初見の説明が必ず見える */}
        {clips.length === 0 && (
          <div
            style={{
              marginBottom: '1.4rem',
              padding: '0.95rem 1.05rem',
              background: 'linear-gradient(135deg, rgba(225,48,108,0.10) 0%, rgba(251,191,36,0.08) 100%)',
              border: `1px solid ${bg.accent}33`,
              borderRadius: 16,
            }}
          >
            <p style={{
              margin: 0, fontSize: 13.5, fontWeight: 800, color: bg.ink, lineHeight: 1.5,
            }}>
              写真や動画を入れるだけ。<span style={{ color: bg.accent }}>AI が字幕と投稿文をつけて</span>、そのまま出せる縦型リールにします。
            </p>
            {/* 3 ステップ */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              margin: '10px 0 8px', flexWrap: 'wrap',
            }}>
              {['素材を入れる', 'AI が字幕・色・BGMを整える', 'Instagram に投稿'].map((t, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: bg.ink,
                    background: 'rgba(255,255,255,0.7)',
                    border: `1px solid ${bg.cardBorder}`,
                    borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap',
                  }}>
                    <span style={{ color: bg.accent, fontWeight: 800 }}>{i + 1}.</span> {t}
                  </span>
                  {i < 2 && <span style={{ color: bg.accent, fontSize: 12, fontWeight: 800 }}>→</span>}
                </span>
              ))}
            </div>
            {/* サンプル出力 1 枚 */}
            <p style={{
              margin: 0, fontSize: 11.5, color: bg.inkSoft, lineHeight: 1.5,
            }}>
              例: スキンケアの動画 3 本 → <span style={{ color: bg.ink, fontWeight: 700 }}>「朝の 5 分ルーティン🌿」</span>の字幕付き 15 秒リール＋投稿文が 1 分で完成。
            </p>
          </div>
        )}

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
                  {/* テーマの実配色を映すミニ見本 (一目で仕上がりが分かる) */}
                  <span aria-hidden style={{
                    width: 24, height: 24, borderRadius: 7, background: p.bg,
                    border: `1.5px solid ${active ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.12)'}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 2, overflow: 'hidden', flexShrink: 0,
                  }}>
                    <span style={{ width: 13, height: 3.5, borderRadius: 2, background: p.captionColor }} />
                    <span style={{ width: 8, height: 3.5, borderRadius: 2, background: p.accent }} />
                  </span>
                  <div style={{ fontSize: 10.5, lineHeight: 1.15, textAlign: 'center' }}>{p.label}</div>
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

        {/* カラーの雰囲気 (color mood) — 選ぶと即プレビュー反映。リール全体の色味を変える */}
        <div style={{ marginBottom: '1.2rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 10, letterSpacing: '0.22em', fontWeight: 800,
            color: bg.accent, textTransform: 'uppercase',
            marginBottom: 7, paddingLeft: 2,
          }}>
            <Sparkles size={11} /> カラーの雰囲気
            {colorMood !== 'none' && (
              <button onClick={() => setColorMood('none')} style={{
                marginLeft: 'auto', background: 'transparent', border: 'none',
                color: bg.inkSoft, fontSize: 10, cursor: 'pointer',
                textDecoration: 'underline', letterSpacing: 0,
              }}>解除</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none' }}>
            {COLOR_MOODS.map(m => {
              const active = colorMood === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setColorMood(m.id)}
                  style={{
                    flexShrink: 0, minWidth: 52,
                    padding: '0.4rem 0.5rem 0.45rem',
                    background: active ? IRIS_GRADIENT : 'rgba(255,255,255,0.7)',
                    color: active ? '#fff' : bg.ink,
                    border: `1.5px solid ${active ? 'transparent' : bg.cardBorder}`,
                    borderRadius: 12,
                    cursor: 'pointer', fontFamily: IRIS_FONTS.body,
                    boxShadow: active ? '0 4px 14px rgba(225,48,108,0.28)' : 'none',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}>
                  {/* 実際の色味が伝わる小プレビュー */}
                  <span aria-hidden style={{
                    width: 34, height: 22, borderRadius: 6, background: m.swatch,
                    border: `1px solid ${active ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.1)'}`,
                  }} />
                  <span style={{ fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* タイムライン (キャンバス下) — Edits 風 */}
        {clips.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
              <Label icon={<Scissors size={11} />}>タイムライン</Label>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: bg.ink, marginLeft: 'auto' }}>
                全体 {totalDuration.toFixed(1)}秒
              </span>
            </div>
            {/* 秒数の自動配分 (全カットに均等・冒頭はフック配分) */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {[15, 30].map(sec => (
                <button key={sec} onClick={() => autoDistribute(sec)} style={{
                  flex: 1, minHeight: 34, padding: '0.4rem 0.5rem',
                  background: 'rgba(255,255,255,0.85)', color: bg.ink,
                  border: `1px solid ${bg.cardBorder}`, borderRadius: 10,
                  fontSize: 11.5, fontWeight: 800, cursor: 'pointer',
                  fontFamily: IRIS_FONTS.body,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}>
                  <Scissors size={11} /> {sec}秒に自動配分
                </button>
              ))}
            </div>
            <div ref={timelineRef} style={{
              display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 6,
              scrollbarWidth: 'none',
            }}>
              {clips.map((c, i) => {
                const selected = selectedClipId === c.id;
                const mood = c.bgmMood ? BGM_MOOD_DEFS.find(m => m.id === c.bgmMood) : null;
                const isDragging = dragIdx === i;
                const isDropTarget = dragIdx != null && dragOverIdx === i && dragIdx !== i;
                return (
                  <button
                    key={c.id}
                    data-clip-thumb
                    onPointerDown={e => beginThumbDrag(e, i)}
                    onClick={() => { if (dragIdx == null) { setSelectedClipId(c.id); seekToClip(i); } }}
                    style={{
                      flexShrink: 0, position: 'relative',
                      width: 56, height: 92,
                      borderRadius: 8, overflow: 'hidden',
                      background: '#000',
                      border: `2px solid ${selected ? bg.accent : 'transparent'}`,
                      // ドロップ先は左端にアクセント帯でハイライト
                      boxShadow: isDropTarget
                        ? `inset 3px 0 0 ${bg.accent}, 0 4px 12px rgba(225,48,108,0.32)`
                        : selected ? '0 4px 12px rgba(225,48,108,0.32)' : '0 1px 4px rgba(0,0,0,0.1)',
                      cursor: 'grab', padding: 0,
                      opacity: isDragging ? 0.35 : 1,
                      touchAction: 'pan-x',
                      transition: 'opacity 0.12s, box-shadow 0.12s',
                    }}>
                    {c.kind === 'image'
                      ? <img src={c.url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                      : <video src={c.url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
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
                        pointerEvents: 'none',
                      }}>
                        {c.captionText.slice(0, 10)}{c.captionText.length > 10 ? '…' : ''}
                      </div>
                    )}
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.78), transparent)',
                      color: '#fff', fontSize: 9, fontWeight: 800,
                      padding: '8px 3px 2px', textAlign: 'left',
                      pointerEvents: 'none',
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
                        pointerEvents: 'none',
                      }} />
                    )}
                  </button>
                );
              })}
            </div>
            <p style={{ margin: '2px 2px 0', fontSize: 9.5, color: bg.inkSoft, letterSpacing: '0.01em' }}>
              サムネを長押ししてドラッグ → 順番を入れ替え
            </p>
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
                  {/* 秒数クイックチップ — タップで即適用 */}
                  <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
                    {[1.5, 2, 3, 5].map(sec => {
                      const on = Math.abs(c.duration - sec) < 0.05;
                      return (
                        <button key={sec} onClick={() => setClipDuration(c.id, sec)} style={{
                          flex: 1, minHeight: 30, padding: '0.3rem 0.2rem',
                          background: on ? IRIS_GRADIENT : 'rgba(255,255,255,0.85)',
                          color: on ? '#fff' : bg.ink,
                          border: `1px solid ${on ? 'transparent' : bg.cardBorder}`,
                          borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                          fontFamily: IRIS_FONTS.body,
                        }}>{sec}s</button>
                      );
                    })}
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
                  {/* クリップ間フェード (このカット → 次への繋ぎ) */}
                  {idx < clips.length - 1 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 10, color: bg.inkSoft, marginBottom: 4 }}>次のカットへの繋ぎ</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {CLIP_TRANSITIONS.map(tr => {
                          const on = (c.transition ?? 'fade') === tr.id;
                          return (
                            <button key={tr.id} onClick={() => setClipTransition(c.id, tr.id)} style={{
                              padding: '3px 9px',
                              background: on ? IRIS_GRADIENT : 'rgba(255,255,255,0.85)',
                              color: on ? '#fff' : bg.ink,
                              border: `1px solid ${on ? 'transparent' : bg.cardBorder}`,
                              borderRadius: 999, fontSize: 10.5, fontWeight: 800, cursor: 'pointer',
                              fontFamily: IRIS_FONTS.body,
                              boxShadow: on ? '0 2px 8px rgba(225,48,108,0.26)' : 'none',
                            }}>{tr.label}</button>
                          );
                        })}
                      </div>
                    </div>
                  )}
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

        {/* STEP PANELS — 退場アニメ待ち禁止(rAF停止環境でステップ切替が凍結する)・キー切替入場のみ */}
        <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
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
                  onClick={() => runAiScript()}
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
                {/* 生成中の実況 — 「今 AI が何をしているか」を 1 行で見せる（沈黙する待ち時間ゼロ） */}
                <AnimatePresence>
                  {scriptBusy && scriptPhase && (
                    <motion.div
                      key="script-phase"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.22 }}
                      style={{
                        marginBottom: 10, padding: '0.55rem 0.7rem',
                        background: 'rgba(225,48,108,0.07)',
                        border: '1px solid rgba(225,48,108,0.18)',
                        borderRadius: 12, fontSize: 11.5, color: bg.ink,
                        display: 'flex', alignItems: 'center', gap: 8, lineHeight: 1.5,
                      }}
                    >
                      <span aria-hidden style={{
                        width: 6, height: 6, borderRadius: 999,
                        background: '#E1306C', flexShrink: 0,
                        animation: 'iris-pulse 1s ease-in-out infinite',
                      }} />
                      <motion.span
                        key={scriptPhase}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        style={{ fontWeight: 700 }}
                      >
                        {scriptPhase}
                      </motion.span>
                    </motion.div>
                  )}
                </AnimatePresence>
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

                {/* 音声→字幕: 喋るだけでカットに字幕が入る */}
                {voiceSupported && clips.length > 0 && (
                  <>
                    <button
                      onClick={() => (voiceOn ? stopVoice() : startVoice())}
                      style={{
                        width: '100%', padding: '0.85rem 1rem',
                        background: voiceOn ? '#DC2626' : 'rgba(255,255,255,0.9)',
                        color: voiceOn ? '#fff' : bg.ink,
                        border: voiceOn ? 'none' : '1.5px dashed rgba(225,48,108,0.45)',
                        borderRadius: 14, fontSize: 14, fontWeight: 800,
                        cursor: 'pointer', fontFamily: IRIS_FONTS.body,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        minHeight: 48, marginBottom: 8,
                        boxShadow: voiceOn ? '0 8px 22px rgba(220,38,38,0.3)' : 'none',
                      }}
                    >
                      {voiceOn
                        ? <><Square size={14} /> 停止 (字幕に反映中)</>
                        : <><Mic size={15} /> 喋って字幕にする</>}
                    </button>
                    {voiceOn && (
                      <div style={{
                        marginBottom: 10, padding: '0.55rem 0.7rem',
                        background: 'rgba(220,38,38,0.07)',
                        border: '1px solid rgba(220,38,38,0.2)',
                        borderRadius: 12, fontSize: 11.5, color: bg.ink,
                        display: 'flex', alignItems: 'center', gap: 8, lineHeight: 1.5,
                      }}>
                        <span aria-hidden style={{
                          width: 6, height: 6, borderRadius: 999,
                          background: '#DC2626', flexShrink: 0,
                          animation: 'iris-pulse 1s ease-in-out infinite',
                        }} />
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {voiceLive || '聞いています… ひと息ごとに次のカットへ字幕が入ります'}
                        </span>
                      </div>
                    )}
                  </>
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
                        {/* ── フックの別案（最初の1行＝伸びるかの9割）。タップで冒頭を差し替え ── */}
                        {aiResult.hookOptions && aiResult.hookOptions.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{
                              fontSize: 9, letterSpacing: '0.18em', fontWeight: 800,
                              color: bg.accent, marginBottom: 5, textTransform: 'uppercase',
                            }}>最初の1行を選ぶ（伸びるかの9割）</div>
                            <div style={{ display: 'grid', gap: 5 }}>
                              {aiResult.hookOptions.map((hook, hi) => {
                                const active = (aiResult.caption.split('\n')[0] || '').trim() === hook.trim();
                                return (
                                  <button
                                    key={hi}
                                    onClick={() => setAiResult(prev => prev ? { ...prev, caption: swapFirstLine(prev.caption, hook) } : prev)}
                                    style={{
                                      textAlign: 'left',
                                      minHeight: 40,
                                      padding: '0.5rem 0.7rem',
                                      background: active ? bg.accent : 'rgba(255,255,255,0.7)',
                                      color: active ? '#fff' : bg.ink,
                                      border: `1px solid ${active ? bg.accent : bg.cardBorder}`,
                                      borderRadius: 10,
                                      fontSize: 12, lineHeight: 1.45, fontWeight: active ? 700 : 500,
                                      cursor: 'pointer', fontFamily: IRIS_FONTS.body,
                                    }}
                                  >{hook}</button>
                                );
                              })}
                            </div>
                          </div>
                        )}
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
                          <p style={{
                            margin: '0 2px', fontSize: 10, color: bg.inkSoft, lineHeight: 1.45,
                          }}>
                            動画を保存し、本文はコピー済みに。リールは Instagram の仕様上アプリからの投稿になります（本文は投稿画面で長押し→貼り付け）。
                          </p>
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
                                ? <><Loader2 size={12} className="iris-spin" /> 本文を書いています…</>
                                : <><MessageSquare size={12} /> 投稿の本文を AI に書いてもらう</>}
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

      {/* ─── チャット型動画編集バー (下部固定・safe-area / Dock 重なりゼロ) ─── */}
      <div className="iris-reelchat-bar" style={{
        position: 'fixed', left: 0, right: 0, zIndex: 45, // AI FAB (z-40) より上・ごほうび演出 (z-60) より下
        padding: '0 0.75rem', pointerEvents: 'none',
      }}>
        <div
          style={{ maxWidth: 480, margin: '0 auto', pointerEvents: 'auto' }}
          onDragOver={e => { e.preventDefault(); setChatDragOver(true); }}
          onDragLeave={() => setChatDragOver(false)}
          onDrop={e => { e.preventDefault(); setChatDragOver(false); if (e.dataTransfer.files?.length) void handleChatFiles(e.dataTransfer.files); }}
        >
          {/* 会話履歴 (折りたたみ・最大高 40vh の内部スクロール) */}
          {chatMsgs.length > 0 && chatOpen && (
            <div ref={chatListRef} style={{
              maxHeight: '40vh', overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 6,
              marginBottom: 8, padding: '0.6rem',
              background: 'rgba(255,255,255,0.94)',
              backdropFilter: 'blur(18px)',
              border: '1px solid rgba(225,48,108,0.2)',
              borderRadius: 16,
              boxShadow: '0 10px 30px rgba(31,26,46,0.14)',
            }}>
              {chatMsgs.slice(-6).map(m => (
                <div key={m.id} style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '86%',
                  padding: '0.45rem 0.7rem', borderRadius: 12,
                  fontSize: 12, lineHeight: 1.55, whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  background: m.role === 'user' ? IRIS_GRADIENT : 'rgba(31,26,46,0.06)',
                  color: m.role === 'user' ? '#FFFFFF' : '#1F1A2E',
                  fontWeight: 600, fontFamily: IRIS_FONTS.body,
                }}>{m.text}</div>
              ))}
              {chatBusy && (
                <div style={{
                  alignSelf: 'flex-start',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '0.45rem 0.7rem', borderRadius: 12,
                  fontSize: 12, background: 'rgba(31,26,46,0.06)', color: '#1F1A2E',
                  fontWeight: 600, fontFamily: IRIS_FONTS.body,
                }}>
                  <Loader2 size={12} className="iris-spin" /> 編集内容を考えています…
                </div>
              )}
            </div>
          )}
          {/* 履歴のたたむ/ひらく */}
          {chatMsgs.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
              <button onClick={() => setChatOpen(o => !o)} style={{
                padding: '0.2rem 0.85rem', minHeight: 26,
                background: 'rgba(255,255,255,0.92)', color: '#1F1A2E',
                border: '1px solid rgba(225,48,108,0.25)', borderRadius: 999,
                fontSize: 10.5, fontWeight: 800, cursor: 'pointer',
                fontFamily: IRIS_FONTS.body,
                boxShadow: '0 4px 12px rgba(31,26,46,0.1)',
              }}>{chatOpen ? '履歴をたたむ' : `履歴 (${chatMsgs.length})`}</button>
            </div>
          )}
          {/* 入力バー: 添付 + テキスト + マイク + 送信 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0.35rem 0.4rem',
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(18px)',
            border: chatDragOver ? '1.5px dashed #E1306C' : '1px solid rgba(225,48,108,0.28)',
            borderRadius: 999,
            boxShadow: '0 12px 32px rgba(31,26,46,0.18)',
          }}>
            {/* 素材添付 (自作クリップ SVG) */}
            <label title="素材を添付" style={{
              width: 42, height: 42, minWidth: 42, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#E1306C',
              background: 'rgba(225,48,108,0.09)',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              <input
                type="file" multiple accept="image/*,video/*,audio/*" style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.length) { void handleChatFiles(e.target.files); e.target.value = ''; } }}
              />
            </label>
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void handleChatSend(); } }}
              placeholder={clips.length === 0 ? 'まず素材を入れて、あとは話しかけるだけ' : 'どう編集する？（例: 暖かい感じで15秒にして）'}
              style={{
                flex: 1, minWidth: 0,
                border: 'none', outline: 'none', background: 'transparent',
                fontSize: 16, // iOS Safari 自動ズーム回避
                minHeight: 44, color: '#1F1A2E',
                fontFamily: IRIS_FONTS.body,
              }}
            />
            {/* マイク (音声入力・非対応ブラウザでは非表示) */}
            {voiceSupported && (
              <button
                onClick={() => (chatVoiceOn ? stopChatVoice() : startChatVoice())}
                title={chatVoiceOn ? '停止して送信' : '話して指示する'}
                style={{
                  width: 42, height: 42, minWidth: 42, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', cursor: 'pointer',
                  background: chatVoiceOn ? '#DC2626' : 'rgba(225,48,108,0.09)',
                  color: chatVoiceOn ? '#FFFFFF' : '#E1306C',
                  boxShadow: chatVoiceOn ? '0 0 0 4px rgba(220,38,38,0.22)' : 'none',
                  animation: chatVoiceOn ? 'iris-reelchat-pulse 1.1s ease-in-out infinite' : undefined,
                }}
              >
                <Mic size={17} />
              </button>
            )}
            {/* 送信 (自作の上向き矢印 SVG) */}
            <button
              onClick={() => void handleChatSend()}
              disabled={chatBusy || !chatInput.trim()}
              title="送信"
              style={{
                width: 42, height: 42, minWidth: 42, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none',
                cursor: chatBusy || !chatInput.trim() ? 'not-allowed' : 'pointer',
                background: chatBusy || !chatInput.trim() ? 'rgba(31,26,46,0.12)' : IRIS_GRADIENT,
                color: '#FFFFFF',
                boxShadow: chatBusy || !chatInput.trim() ? 'none' : '0 6px 16px rgba(225,48,108,0.34)',
              }}
            >
              {chatBusy
                ? <Loader2 size={16} className="iris-spin" />
                : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 19V5" /><path d="M5 12l7-7 7 7" />
                  </svg>
                )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes iris-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        .iris-spin { animation: iris-spin 0.9s linear infinite; }
        @keyframes iris-reelchat-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.35); } 50% { box-shadow: 0 0 0 7px rgba(220,38,38,0.12); } }
        /* デスクトップ (>900px): Dock なし → 画面最下部。サイドバー 220px を避けて中央へ */
        .iris-reelchat-bar { bottom: calc(env(safe-area-inset-bottom, 0px) + 12px); }
        @media (min-width: 901px) { .iris-reelchat-bar { left: 220px; } }
        /* モバイル (≤900px): 下部ナビ Dock (64px + safe-area) の真上に。重なりゼロ */
        @media (max-width: 900px) { .iris-reelchat-bar { bottom: calc(env(safe-area-inset-bottom, 0px) + 72px); left: 0; } }
        /* リールスタジオ表示中だけ: 既存の浮遊ボタン群をチャット編集バーの上へ退避 (重なりゼロ) */
        @media (max-width: 900px) {
          .cp-ai-fab-wrap, body[data-iris-dock] .cp-ai-fab-wrap { bottom: calc(env(safe-area-inset-bottom, 0px) + 142px) !important; }
          body[data-iris-dock] .agent-monitor-dock[data-open="false"] { bottom: calc(env(safe-area-inset-bottom, 0px) + 142px) !important; }
        }
        @media (min-width: 901px) {
          .cp-ai-fab-wrap { bottom: calc(env(safe-area-inset-bottom, 0px) + 92px) !important; }
        }
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
      display: 'flex', alignItems: 'flex-start', gap: 5,
      whiteSpace: 'pre-wrap' as const,
    }}>
      <AlertCircle size={11} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{msg}</span>
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
