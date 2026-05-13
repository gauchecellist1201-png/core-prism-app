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
  Flame,
} from 'lucide-react';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { BGM_LIBRARY, VIRAL_PATTERNS, TREND_PULSE_2026_Q2 } from './IrisReelStudio';

interface Props {
  bg: IrisBackgroundDef;
  myDeals?: any[];
  postQueue?: any;
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
export default function IrisReelStudioMinimal({ bg, onJumpToSchedule, onOpenAdvanced }: Props) {
  const [step, setStep] = useState<'material' | 'edit' | 'subtitle' | 'export'>('material');
  const [clips, setClips] = useState<Clip[]>([]);
  const [bgmFile, setBgmFile] = useState<File | null>(null);
  const [bgmLoading, setBgmLoading] = useState<string | null>(null);
  const [bgmActiveId, setBgmActiveId] = useState<string | null>(null);
  const [activePattern, setActivePattern] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState<string>('');
  const [captionPreset, setCaptionPreset] = useState<typeof FONT_PRESETS[0]>(FONT_PRESETS[0]);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [uploadErr, setUploadErr] = useState<string>('');

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
    } catch { /* */ }
    finally { setBgmLoading(null); }
  }, []);

  // ─── パターン適用 ─────
  const applyPattern = useCallback((p: typeof VIRAL_PATTERNS[0]) => {
    setActivePattern(p.id);
    if (clips.length === 0) {
      // クリップが無い時はデフォルトの字幕だけセット
      setCaptionText(p.beats[0].textHint.replace(/\[.*?\]\s*/, ''));
      return;
    }
    // 各クリップに beat の秒数を割り当て
    setClips(prev => prev.map((c, i) => {
      const beat = p.beats[Math.min(i, p.beats.length - 1)];
      return { ...c, duration: beat.sec };
    }));
    setCaptionText(p.beats[0].textHint.replace(/\[.*?\]\s*/, ''));
  }, [clips.length]);

  // ─── キャンバス描画 ─────
  const drawAt = useCallback((t: number) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = '#0a0a0f'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!clips.length) return;

    // どのクリップ?
    let acc = 0, cur = clips[0], localT = 0;
    for (const c of clips) {
      if (t >= acc && t < acc + c.duration) { cur = c; localT = (t - acc) / Math.max(c.duration, 0.001); break; }
      acc += c.duration;
    }
    if (t >= totalDuration) { cur = clips[clips.length - 1]; localT = 1; }

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

    // フェード切替
    const remaining = (acc + cur.duration) - t;
    if (remaining < 0.4) {
      ctx.fillStyle = `rgba(0,0,0,${(0.4 - remaining) / 0.4})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 字幕
    if (captionText) {
      ctx.save();
      const x = canvas.width / 2, y = canvas.height * 0.78;
      ctx.font = `bold ${captionPreset.size * (canvas.width / OUT_W)}px ${captionPreset.font}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = captionPreset.stroke;
      ctx.lineWidth = captionPreset.strokeWidth * (canvas.width / OUT_W);
      ctx.lineJoin = 'round';
      // wrap to ~16 chars
      const words = captionText.split('');
      const lines: string[] = []; let line = '';
      for (const ch of words) { if (line.length >= 14 && /[\s、。!\?]/.test(ch)) { lines.push(line); line = ''; } else line += ch; }
      if (line) lines.push(line);
      const lh = captionPreset.size * 1.15 * (canvas.width / OUT_W);
      lines.forEach((ln, i) => {
        const yi = y - (lines.length - 1) * lh / 2 + i * lh;
        ctx.strokeText(ln, x, yi);
        ctx.fillStyle = captionPreset.color;
        ctx.fillText(ln, x, yi);
      });
      ctx.restore();
    }
  }, [clips, captionText, captionPreset, totalDuration]);

  // ─── 静止描画 (再生してない時) ─────
  useEffect(() => { if (!playing) drawAt(0); }, [drawAt, playing, clips.length, captionText, captionPreset]);

  // ─── 再生ループ ─────
  const startPlay = () => {
    if (!clips.length) return;
    setPlaying(true);
    playStartRef.current = performance.now();
    const tick = () => {
      const t = (performance.now() - playStartRef.current) / 1000;
      drawAt(t);
      if (t >= totalDuration) { setPlaying(false); return; }
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
    drawAt(0);
  };

  // ─── 録画 → WebM 書き出し ─────
  const startRecord = async () => {
    if (!canvasRef.current || !clips.length) return;
    setRecording(true); setProgress(0); setExportUrl(null);
    const stream = (canvasRef.current as HTMLCanvasElement).captureStream(30);
    // 音声トラックを混ぜる
    if (bgmFile) {
      try {
        const ac = new AudioContext();
        const buf = await bgmFile.arrayBuffer();
        const audioBuf = await ac.decodeAudioData(buf);
        const src = ac.createBufferSource(); src.buffer = audioBuf;
        const dest = ac.createMediaStreamDestination();
        src.connect(dest); src.start();
        dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      } catch {/* */}
    }
    chunksRef.current = [];
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setExportUrl(URL.createObjectURL(blob));
      setRecording(false); setProgress(1);
    };
    recorderRef.current = rec;
    rec.start();
    // 再生開始
    playStartRef.current = performance.now();
    const tick = () => {
      const t = (performance.now() - playStartRef.current) / 1000;
      drawAt(t);
      setProgress(t / totalDuration);
      if (t >= totalDuration) { rec.stop(); return; }
      animRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const download = () => {
    if (!exportUrl) return;
    const a = document.createElement('a'); a.href = exportUrl; a.download = `iris-reel-${Date.now()}.webm`; a.click();
  };

  // ─── 削除 ─────
  const removeClip = (id: string) => setClips(prev => prev.filter(c => c.id !== id));

  return (
    <div style={{ position: 'relative', minHeight: '100dvh', paddingBottom: '6rem' }}>
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
              padding: '0.85rem 1.6rem',
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
              padding: '0.85rem 1.6rem',
              background: 'rgba(255,255,255,0.9)', color: bg.ink,
              border: `1.5px solid ${bg.accent}`, borderRadius: 999,
              fontSize: 14, fontWeight: 800, cursor: 'pointer',
              fontFamily: IRIS_FONTS.body,
            }}>
              <Square size={14} fill={bg.ink} /> 停止
            </button>
          )}
        </div>

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

            {/* === STEP 3: 字幕 === */}
            {step === 'subtitle' && (
              <>
                <Label>字幕テキスト</Label>
                <textarea
                  value={captionText}
                  onChange={e => setCaptionText(e.target.value)}
                  placeholder="例: 知らないと損する3つのこと"
                  rows={2}
                  style={{
                    width: '100%', padding: '0.85rem 1rem',
                    background: 'rgba(255,255,255,0.7)',
                    border: `1px solid ${bg.cardBorder}`,
                    borderRadius: 14,
                    fontSize: 16, fontFamily: 'inherit',
                    resize: 'vertical',
                    marginBottom: 14,
                  }}
                />
                <Label>スタイル</Label>
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
                      width: '100%', padding: '1.1rem',
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
                    <div style={{ display: 'grid', gap: 8 }}>
                      <button onClick={download} style={{ ...btnPri(), width: '100%' }}>
                        <Download size={14} /> ダウンロード
                      </button>
                      {onJumpToSchedule && (
                        <button onClick={onJumpToSchedule} style={{ ...btnSec(bg), width: '100%' }}>
                          <Share2 size={14} /> 投稿予約をつくる
                        </button>
                      )}
                      <button onClick={() => { setExportUrl(null); setProgress(0); }} style={{ ...btnSec(bg), width: '100%' }}>
                        <Wand2 size={14} /> 別ver. を書き出す
                      </button>
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

// avoid unused imports
void ImageIcon; void Film;
