// ============================================================
// IRIS — AI Video Studio UI
// 9:16 縦動画を脚本→Canvas描画→WebMエクスポートまで一気通貫
// ============================================================
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ApiErrorCard from './ApiErrorCard';
import { LoaderDots } from './MicroLoader';
import { StudioIntro } from './StudioIntro';
import { notifyInApp } from '../lib/inAppNotify';
import type { AppSettings } from '../types/identity';
import type { IrisBackgroundDef } from '../iris/irisStyle';
import { IRIS_FONTS } from '../iris/irisStyle';
import {
  generateScript,
  generateBgmPrompt,
  voiceOverScript,
  type VideoScript,
  type VideoScene,
} from '../iris/videoStudio';

interface Props {
  bg: IrisBackgroundDef;
  settings: AppSettings;
}

type StudioTab = 'script' | 'scenes' | 'preview' | 'export';

// 9:16 参照解像度 — Canvas はこのサイズで描画、CSS で縮小表示
const CANVAS_W = 405;   // 1080 * 0.375
const CANVAS_H = 720;   // 1920 * 0.375

// トランジション種別
type Transition = 'fade' | 'slide';

/** Canvas 1フレーム描画 */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  scene: VideoScene,
  progress: number,
  accentColor: string,
  transition: Transition = 'fade',
) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  // --- 背景グラデ ---
  const grd = ctx.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, '#833AB4');
  grd.addColorStop(0.5, '#E1306C');
  grd.addColorStop(1, '#F77737');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  // --- トランジションオーバーレイ ---
  const TRANS_RATIO = 0.12;
  if (transition === 'fade') {
    if (progress < TRANS_RATIO) {
      const alpha = 1 - progress / TRANS_RATIO;
      ctx.fillStyle = `rgba(0,0,0,${alpha * 0.85})`;
      ctx.fillRect(0, 0, W, H);
    } else if (progress > 1 - TRANS_RATIO) {
      const alpha = (progress - (1 - TRANS_RATIO)) / TRANS_RATIO;
      ctx.fillStyle = `rgba(0,0,0,${alpha * 0.85})`;
      ctx.fillRect(0, 0, W, H);
    }
  } else {
    if (progress < TRANS_RATIO) {
      const slideY = -H * (1 - progress / TRANS_RATIO);
      ctx.save();
      ctx.translate(0, slideY);
      const g2 = ctx.createLinearGradient(0, 0, W, H);
      g2.addColorStop(0, '#833AB4');
      g2.addColorStop(0.5, '#E1306C');
      g2.addColorStop(1, '#F77737');
      ctx.fillStyle = g2;
      ctx.fillRect(0, -slideY, W, H);
      ctx.restore();
    }
  }

  // --- テキストオーバーレイ ---
  if (scene.text) {
    const fontSize = Math.floor(W * 0.075);
    ctx.font = `700 ${fontSize}px "Playfair Display", "Noto Serif JP", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const maxLineW = W * 0.85;
    const chars = Array.from(scene.text);
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

    const lineH = fontSize * 1.55;
    const totalTextH = lines.length * lineH;
    const startY = H / 2 - totalTextH / 2 + lineH / 2;

    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#FFFFFF';
    lines.forEach((l, i) => {
      ctx.fillText(l, W / 2, startY + i * lineH);
    });
    ctx.shadowBlur = 0;
  }

  // --- アクセントカラードット (下部装飾) ---
  ctx.fillStyle = accentColor + 'aa';
  ctx.beginPath();
  ctx.arc(W / 2, H - 40, 5, 0, Math.PI * 2);
  ctx.fill();
}

export default function VideoStudio({ bg, settings }: Props) {
  const [activeTab, setActiveTab] = useState<StudioTab>('script');
  const [theme, setTheme] = useState('');
  const [persona, setPersona] = useState('');
  const [targetSec, setTargetSec] = useState(30);
  const [transition, setTransition] = useState<Transition>('fade');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [script, setScript] = useState<VideoScript | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);
  const animRef = useRef<number>(0);
  const playStateRef = useRef({ sceneIdx: 0, startTime: 0, playing: false });

  const [recording, setRecording] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  // exportUrl は blob URL なので、再生成 / null 化 / unmount のたびに revoke しないと
  // メモリリーク (audit r2 で MeetingMinutes / IgConnectModal は対応済、ここは未対応だった)
  const exportUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (exportUrlRef.current && exportUrlRef.current !== exportUrl) {
      try { URL.revokeObjectURL(exportUrlRef.current); } catch { /* */ }
    }
    exportUrlRef.current = exportUrl;
    return () => {
      // unmount 時の最後の cleanup
      if (exportUrlRef.current) {
        try { URL.revokeObjectURL(exportUrlRef.current); } catch { /* */ }
        exportUrlRef.current = null;
      }
    };
  }, [exportUrl]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [bgmFile, setBgmFile] = useState<File | null>(null);
  const bgmObjectUrlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const inp: React.CSSProperties = {
    background: 'rgba(255,255,255,0.94)',
    border: `1px solid ${bg.cardBorder}`,
    color: '#1F1A2E',
    padding: '0.7rem 1rem',
    borderRadius: 12,
    fontSize: '0.95rem',
    fontFamily: IRIS_FONTS.body,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  const card: React.CSSProperties = {
    background: bg.card,
    backdropFilter: 'blur(10px)',
    border: `1px solid ${bg.cardBorder}`,
    borderRadius: 22,
    padding: '1.4rem',
  };

  const btnPrimary: React.CSSProperties = {
    background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
    color: '#fff', border: 'none', borderRadius: 999,
    padding: '0.75rem 1.6rem', fontWeight: 600, cursor: 'pointer',
    fontSize: '0.88rem', fontFamily: IRIS_FONTS.body,
    boxShadow: `0 8px 22px ${bg.accent}55`,
  };

  const btnSecondary: React.CSSProperties = {
    background: 'rgba(255,255,255,0.92)',
    color: bg.accent,
    border: `1px solid ${bg.accent}`,
    borderRadius: 999,
    padding: '0.75rem 1.4rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.88rem',
    fontFamily: IRIS_FONTS.body,
  };

  const tabBtn = (active: boolean, disabled = false): React.CSSProperties => ({
    background: active
      ? `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`
      : 'rgba(255,255,255,0.88)',
    color: active ? '#fff' : '#1F1A2E',
    border: active ? 'none' : `1px solid ${bg.cardBorder}`,
    borderRadius: 999,
    padding: '0.5rem 1.1rem',
    fontWeight: active ? 700 : 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '0.85rem',
    fontFamily: IRIS_FONTS.body,
    boxShadow: active ? `0 4px 12px ${bg.accent}44` : 'none',
    opacity: disabled ? 0.4 : 1,
    transition: 'all 0.15s',
  });

  const handleGenerate = async () => {
    if (!theme.trim()) { setErr('テーマを入力してください'); return; }
    setBusy(true); setErr(null);
    try {
      const s = await generateScript(theme, persona, settings, targetSec);
      setScript(s);
      setCurrentSceneIdx(0);
      setExportUrl(null);
      setActiveTab('scenes');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '生成に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const updateScene = (idx: number, field: keyof VideoScene, value: string | number) => {
    if (!script) return;
    const scenes = script.scenes.map((s, i) =>
      i === idx ? { ...s, [field]: value } : s,
    );
    const totalDuration = scenes.reduce((a, s) => a + s.duration, 0);
    setScript({ ...script, scenes, totalDuration });
  };

  const draw = useCallback((scene: VideoScene, progress: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawFrame(ctx, scene, progress, bg.accent, transition);
  }, [bg.accent, transition]);

  useEffect(() => {
    if (!script?.scenes?.length || playing) return;
    const scene = script.scenes[Math.min(currentSceneIdx, script.scenes.length - 1)];
    draw(scene, 1);
  }, [script, currentSceneIdx, playing, draw]);

  useEffect(() => {
    if (!playing || !script?.scenes?.length) return;

    playStateRef.current = { sceneIdx: currentSceneIdx, startTime: performance.now(), playing: true };

    const tick = (now: number) => {
      const state = playStateRef.current;
      if (!state.playing) return;

      const scene = script.scenes[state.sceneIdx];
      if (!scene) { setPlaying(false); return; }

      const elapsed = (now - state.startTime) / 1000;
      const progress = Math.min(elapsed / scene.duration, 1);
      draw(scene, progress);

      if (elapsed >= scene.duration) {
        const nextIdx = state.sceneIdx + 1;
        if (nextIdx >= script.scenes.length) {
          setPlaying(false);
          setCurrentSceneIdx(0);
          return;
        }
        playStateRef.current = { sceneIdx: nextIdx, startTime: now, playing: true };
        setCurrentSceneIdx(nextIdx);
      }

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animRef.current);
      playStateRef.current.playing = false;
    };
  }, [playing, script, draw]);

  const startPreview = () => {
    if (!script?.scenes?.length) return;
    setCurrentSceneIdx(0);
    setPlaying(true);
    voiceOverScript(script.scenes);
  };

  const stopPreview = () => {
    setPlaying(false);
    playStateRef.current.playing = false;
    cancelAnimationFrame(animRef.current);
    window.speechSynthesis?.cancel();
  };

  const startExport = async () => {
    if (!canvasRef.current || !script?.scenes?.length) return;

    const supportsMediaRecorder = typeof MediaRecorder !== 'undefined';

    if (!supportsMediaRecorder) {
      exportAsPngs();
      return;
    }

    setRecording(true);
    setExportUrl(null);
    chunksRef.current = [];

    const stream = canvasRef.current.captureStream(30);

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    const mr = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mr;

    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setExportUrl(URL.createObjectURL(blob));
      setRecording(false);
    };

    mr.start();

    const ctx = canvasRef.current.getContext('2d')!;
    for (const scene of script.scenes) {
      const steps = Math.ceil(scene.duration * 30);
      for (let i = 0; i <= steps; i++) {
        drawFrame(ctx, scene, i / steps, bg.accent, transition);
        await new Promise<void>(r => setTimeout(r, 1000 / 30));
      }
    }
    mr.stop();
  };

  const exportAsPngs = () => {
    if (!canvasRef.current || !script?.scenes?.length) return;
    const ctx = canvasRef.current.getContext('2d')!;
    script.scenes.forEach((scene, i) => {
      drawFrame(ctx, scene, 1, bg.accent, transition);
      canvasRef.current!.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `iris-scene-${i + 1}.png`; a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    });
  };

  useEffect(() => {
    if (bgmObjectUrlRef.current) URL.revokeObjectURL(bgmObjectUrlRef.current);
    if (bgmFile) {
      bgmObjectUrlRef.current = URL.createObjectURL(bgmFile);
    }
    return () => { if (bgmObjectUrlRef.current) URL.revokeObjectURL(bgmObjectUrlRef.current); };
  }, [bgmFile]);

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <div>
        <p style={{
          fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
          fontSize: '0.78rem', letterSpacing: '0.3em', textTransform: 'uppercase',
          color: bg.accent, marginBottom: '0.4rem',
        }}>
          AI Video Studio
        </p>
        <h2 style={{
          fontFamily: IRIS_FONTS.display, fontSize: '2.4rem',
          color: bg.ink, margin: 0, fontWeight: 700, letterSpacing: '-0.01em',
        }}>
          動画スタジオ
        </h2>
        <p style={{ color: bg.inkSoft, fontSize: '0.92rem', marginTop: '0.4rem' }}>
          テーマを入れるだけ。脚本 → Canvas 描画 → WebM エクスポートまで全自動。
        </p>
      </div>

      <StudioIntro
        id="video"
        accent={bg.accent}
        iconKey="video"
        what="テーマを 1 行入れるだけで、縦長動画 (Reels・ショート向け) の脚本と画面を AI が組み立てて、そのまま .webm で書き出します。"
        tryThis="下の枠に「春の新作リップ3本を比較」みたいに 1 行入れて、青いボタンを押す。脚本→シーン→プレビュー→書き出しの 4 ステップが順に進みます。"
        example="「30秒で新作コスメを紹介」→ 6 シーンの脚本＋ナレーション＋BGM ヒント＋トランジション付きの 9:16 動画"
        sampleLabel="完成イメージ"
        samplePreview={
          <div
            style={{
              width: 90,
              height: 160,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #833AB4, #E1306C 50%, #F77737)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: 6,
              color: '#fff',
              fontSize: 9,
            }}
          >
            <span style={{ fontWeight: 700 }}>Scene 1</span>
            <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, lineHeight: 1.2 }}>
              話題の<br />新作 3 本
            </div>
            <span style={{ opacity: 0.8 }}>9:16 · 30秒</span>
          </div>
        }
      />

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {([
          { id: 'script' as StudioTab,  label: '① 脚本生成' },
          { id: 'scenes' as StudioTab,  label: '② シーン編集', disabled: !script },
          { id: 'preview' as StudioTab, label: '③ プレビュー', disabled: !script },
          { id: 'export' as StudioTab,  label: '④ エクスポート', disabled: !script },
        ]).map(t => (
          <button key={t.id}
            onClick={() => !t.disabled && setActiveTab(t.id)}
            style={tabBtn(activeTab === t.id, t.disabled)}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'script' && (
        <div style={card}>
          <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.75rem' }}>
            テーマ &amp; 設定
          </p>
          <textarea
            style={{ ...inp, minHeight: 90, resize: 'vertical', marginBottom: '0.75rem' }}
            placeholder="例: 春の新作リップ3本を比較してみた"
            value={theme}
            onChange={e => setTheme(e.target.value)}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <input style={inp} placeholder="ペルソナ (例: 30代コスメ好き)" value={persona} onChange={e => setPersona(e.target.value)} />
            <select style={inp} value={targetSec} onChange={e => setTargetSec(Number(e.target.value))}>
              <option value={15}>15秒</option>
              <option value={30}>30秒</option>
              <option value={45}>45秒</option>
              <option value={60}>60秒</option>
            </select>
            <select style={inp} value={transition} onChange={e => setTransition(e.target.value as Transition)}>
              <option value="fade">フェードトランジション</option>
              <option value="slide">スライドトランジション</option>
            </select>
          </div>
          <button onClick={handleGenerate} disabled={busy} style={btnPrimary}>
            {busy ? <LoaderDots label="脚本を書いてます" /> : '🎬 AI 脚本を生成'}
          </button>
          <ApiErrorCard error={err} onRetry={handleGenerate} />
        </div>
      )}

      {activeTab === 'scenes' && script && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={card}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.4rem' }}>Hook</p>
            <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', color: bg.ink, fontSize: '1.1rem', lineHeight: 1.5 }}>
              {script.hook}
            </p>
          </div>
          {script.scenes.map((scene, i) => (
            <div key={i} style={{ ...card, borderLeft: `4px solid ${bg.accent}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                <span style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', color: bg.accent, fontSize: '1.05rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  Scene {i + 1}
                </span>
                <input
                  type="number" min={1} max={30}
                  value={scene.duration}
                  onChange={e => updateScene(i, 'duration', Number(e.target.value))}
                  style={{ ...inp, width: 72, textAlign: 'center', padding: '0.4rem 0.5rem' }}
                />
                <span style={{ color: bg.inkSoft, fontSize: '0.85rem' }}>秒</span>
              </div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <input style={inp} placeholder="テキストオーバーレイ (15字以内)" value={scene.text}
                  onChange={e => updateScene(i, 'text', e.target.value)} />
                <input style={inp} placeholder="映像の指示" value={scene.visual}
                  onChange={e => updateScene(i, 'visual', e.target.value)} />
                <input style={inp} placeholder="BGM ヒント (任意)" value={scene.bgm || ''}
                  onChange={e => updateScene(i, 'bgm', e.target.value)} />
              </div>
            </div>
          ))}
          <div style={card}>
            <p style={{ fontSize: '0.8rem', color: bg.inkSoft }}>
              合計尺: <strong style={{ color: bg.ink }}>{script.totalDuration}秒</strong>
            </p>
          </div>
          <button onClick={() => setActiveTab('preview')} style={btnPrimary}>③ プレビューへ →</button>
        </div>
      )}

      {activeTab === 'preview' && script && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
          <div style={{ borderRadius: 28, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.35)', border: '3px solid rgba(255,255,255,0.3)' }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              style={{ display: 'block', width: 'clamp(160px, 38vw, 280px)', height: 'auto' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {script.scenes.map((_, i) => (
              <button key={i}
                onClick={() => { stopPreview(); setCurrentSceneIdx(i); }}
                style={{
                  width: i === currentSceneIdx ? 24 : 8, height: 8,
                  borderRadius: 999,
                  background: i === currentSceneIdx ? bg.accent : bg.cardBorder,
                  border: 'none', cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={playing ? stopPreview : startPreview} style={btnPrimary}>
              {playing ? '⏹ 停止' : '▶ プレビュー再生'}
            </button>
            <button onClick={() => script && voiceOverScript(script.scenes)} style={btnSecondary}>
              🔊 音声のみ再生
            </button>
          </div>
          <div style={{ ...card, width: '100%', maxWidth: 480 }}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', color: bg.accent, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              BGM プロンプト (Suno / Udio 用)
            </p>
            <p style={{ color: bg.ink, fontSize: '0.88rem', fontStyle: 'italic', lineHeight: 1.7 }}>
              {generateBgmPrompt(script.scenes)}
            </p>
            <div style={{ marginTop: '0.85rem' }}>
              <p style={{ fontSize: '0.8rem', color: bg.inkSoft, marginBottom: '0.35rem' }}>BGM ファイルをアップロード (任意):</p>
              <input type="file" accept="audio/*"
                onChange={e => { const f = e.target.files?.[0]; if (f) setBgmFile(f); }}
                style={{ fontSize: '0.85rem', color: bg.ink, width: '100%' }}
              />
              {bgmFile && (
                <audio
                  ref={audioRef}
                  src={bgmObjectUrlRef.current ?? undefined}
                  loop
                  style={{ marginTop: '0.5rem', width: '100%' }}
                  controls
                />
              )}
            </div>
          </div>
          <button onClick={() => setActiveTab('export')} style={btnPrimary}>④ エクスポートへ →</button>
        </div>
      )}

      {activeTab === 'export' && script && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={card}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.75rem' }}>
              動画エクスポート
            </p>
            <p style={{ color: bg.inkSoft, fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '1rem' }}>
              {typeof MediaRecorder !== 'undefined'
                ? 'Canvas を WebM 動画として録画します。録画中はしばらお待ちください。'
                : 'このブラウザは MediaRecorder 非対応のため、各シーンを PNG ファイルとしてダウンロードします。'}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={startExport} disabled={recording} style={btnPrimary}>
                {recording ? '⏺ 録画中…' : typeof MediaRecorder !== 'undefined' ? '🎥 WebM 録画開始' : '🖼 PNG シーンを保存'}
              </button>
              {exportUrl && (
                <a href={exportUrl} download="iris-video.webm"
                  style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  ⬇ WebM をダウンロード
                </a>
              )}
            </div>
            {recording && (
              <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: bg.inkSoft }}>
                {script.totalDuration}秒分を 30fps で録画中… 完了までお待ちください。
              </p>
            )}
          </div>
          <div style={card}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.5rem' }}>
              投稿キャプション
            </p>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: bg.ink, lineHeight: 1.75, fontSize: '0.9rem' }}>
              {script.caption}
            </pre>
            <p style={{ color: bg.accent, fontSize: '0.85rem', marginTop: '0.5rem', lineHeight: 1.8 }}>
              {script.hashtags.join(' ')}
            </p>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(script.caption + '\n\n' + script.hashtags.join(' '))
                  .then(() => notifyInApp({ kind: 'success', title: 'コピーしました', body: 'キャプションとハッシュタグをクリップボードに入れました。' }))
                  .catch(() => notifyInApp({ kind: 'warn', title: 'コピーできませんでした', body: 'お使いのブラウザでコピーの権限が許可されているかご確認ください。' }));
              }}
              style={{ ...btnSecondary, marginTop: '0.85rem' }}
            >
              📋 キャプションをコピー
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
