// ============================================================
// MeetingRecorder — ブラウザ内蔵 マイク録音 → AI 要約
//
// オーナー指示 (2026-06-03):
//   Google Meet 無料 / Zoom 無料でも使えるように。
//   一般ユーザーは無料プランが大多数なので、CORE 単体で録音できる仕組みに。
//
// 使い方:
//   1) 会議が始まる前に「録音開始」をタップ
//   2) Meet / Zoom / 対面会議 で会話 (CORE はマイクを聞いている)
//   3) 会議が終わったら「録音停止」をタップ
//   4) AI が要約 → ナレッジに自動で保存
//
// 設計:
//   - MediaRecorder API (全モダンブラウザ対応)
//   - 録音は Blob → audioTranscribe で文字起こし → summarizeMeeting で要約
//   - 長時間対応 (上限: 90 分 = ブラウザのメモリ次第)
//   - PWA でホーム画面起動でもバックグラウンド継続 (iOS Safari は制約あり)
// ============================================================
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Pause, Play, Sparkles, Check } from 'lucide-react';
import { summarizeMeeting } from '../lib/meetingSummarize';
import { transcribeAudioFile } from '../lib/audioTranscribe';

interface Props {
  onClose: () => void;
  onSavedToKnowledge: (title: string, content: string) => void;
  accentColor?: string;
}

type Phase = 'idle' | 'recording' | 'paused' | 'processing' | 'done' | 'error';

const MAX_MINUTES = 120;          // 録音上限 (ブラウザのメモリ次第で実用は 90 分まで)
const MIN_SECONDS_TO_SUMMARIZE = 10;

export default function MeetingRecorder({ onClose, onSavedToKnowledge, accentColor = '#9333EA' }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [processingLabel, setProcessingLabel] = useState('');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [summaryHint, setSummaryHint] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const pauseDurationRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);

  // ── タイマー ─────────────────────────────────────
  const updateElapsed = useCallback(() => {
    if (phase !== 'recording') return;
    const now = Date.now();
    const ms = now - startedAtRef.current - pauseDurationRef.current;
    setElapsedSec(Math.floor(ms / 1000));
    // 上限超過で自動停止
    if (ms > MAX_MINUTES * 60 * 1000) stopAndProcess();
  }, [phase]);

  useEffect(() => {
    if (phase === 'recording') {
      tickRef.current = window.setInterval(updateElapsed, 500);
      return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
    }
  }, [phase, updateElapsed]);

  // ── 録音開始 ─────────────────────────────────────
  const start = async () => {
    setErrMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      const mimeType = chooseMimeType();
      const rec = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64000 });
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.start(2000); // 2 秒ごとにデータを切り出す (長時間対応)
      startedAtRef.current = Date.now();
      pauseDurationRef.current = 0;
      setElapsedSec(0);
      setPhase('recording');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'マイクを使えません';
      setErrMsg(`マイク許可をお願いします: ${msg}`);
      setPhase('error');
    }
  };

  const pause = () => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.pause();
      pausedAtRef.current = Date.now();
      setPhase('paused');
    }
  };
  const resume = () => {
    if (recorderRef.current?.state === 'paused') {
      pauseDurationRef.current += Date.now() - pausedAtRef.current;
      recorderRef.current.resume();
      setPhase('recording');
    }
  };

  // ── 録音停止 → 要約 → 保存 ─────────────────────
  const stopAndProcess = async () => {
    if (elapsedSec < MIN_SECONDS_TO_SUMMARIZE) {
      setErrMsg(`まだ ${elapsedSec} 秒です。10 秒以上の録音から要約できます。`);
      return;
    }
    const rec = recorderRef.current;
    if (!rec) return;

    setPhase('processing');
    setProcessingLabel('録音を確定中');

    // 停止 → onstop で chunks が確定するのを待つ
    await new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
      rec.stop();
    });
    // マイクを開放
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' });
    if (blob.size < 1024) {
      setErrMsg('録音データが空でした。マイクの許可をご確認ください。');
      setPhase('error');
      return;
    }

    try {
      setProcessingLabel('AI で文字起こし中…');
      const fakeName = `${meetingTitle.trim() || '会議'}_${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.${extFromMime(blob.type)}`;
      const file = new File([blob], fakeName, { type: blob.type });
      const transcript = await transcribeAudioFile(file, {
        onProgress: (done, total) => setProcessingLabel(
          total > 1 ? `AI で文字起こし中… ${Math.round((done / total) * 100)}%` : 'AI で文字起こし中…',
        ),
      });

      if (!transcript || transcript.length < 30) {
        throw new Error('音声から十分な内容を取得できませんでした。次回はマイクに近づいてください。');
      }

      setProcessingLabel('AI で要約中');
      const summary = await summarizeMeeting({
        transcript,
        fileName: fakeName,
        date: new Date(startedAtRef.current).toISOString(),
      });

      // ナレッジに登録
      const noteContent = [
        `【会議要約】${summary.title}`,
        `日時: ${new Date(summary.date).toLocaleString('ja-JP')}`,
        `録音時間: 約 ${Math.floor(elapsedSec / 60)} 分 ${elapsedSec % 60} 秒`,
        '',
        '## 1 行サマリ',
        summary.analysis.summary,
        '',
        summary.keyDecisions.length ? '## 決定事項' : '',
        ...summary.keyDecisions.map(d => `- ${d}`),
        '',
        summary.actionItems.length ? '## アクション' : '',
        ...summary.actionItems.map(a =>
          `- ${a.text}${a.owner ? ` (${a.owner})` : ''}${a.due ? ` ▶ ${a.due}` : ''}`
        ),
        '',
        summary.openQuestions.length ? '## 持ち越し論点' : '',
        ...summary.openQuestions.map(q => `- ${q}`),
        '',
        '## 元の文字起こし',
        transcript,
      ].filter(Boolean).join('\n');

      const title = meetingTitle.trim()
        ? `📹 ${meetingTitle.trim()}`
        : `📹 ${summary.title}`;
      onSavedToKnowledge(title, noteContent);

      setSummaryHint(summary.analysis.summary || summary.keyDecisions[0] || '');
      setPhase('done');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '要約に失敗しました';
      setErrMsg(msg);
      setPhase('error');
    }
  };

  // ── 破棄 (録音中なら停止のみ) ─────────────────
  const handleClose = useCallback(() => {
    if (recorderRef.current?.state === 'recording' || recorderRef.current?.state === 'paused') {
      try { recorderRef.current.stop(); } catch { /* */ }
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    onClose();
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 110,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <motion.div
        initial={{ scale: 0.94, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: '#12121E',
          borderRadius: 22,
          padding: '24px 20px',
          maxWidth: 440,
          width: '100%',
          border: `1px solid ${accentColor}44`,
          boxShadow: `0 20px 60px ${accentColor}33`,
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.18em', color: accentColor, fontWeight: 800 }}>
              MEETING RECORDER
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginTop: 2 }}>
              {phase === 'recording' ? '録音中…' :
               phase === 'paused' ? '一時停止' :
               phase === 'processing' ? 'AI が整理中' :
               phase === 'done' ? '保存しました' :
               phase === 'error' ? 'エラー' :
               '会議を録音 → AI が要約'}
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none', borderRadius: '50%',
              width: 36, height: 36, color: '#fff',
              fontSize: 20, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="閉じる"
          >×</button>
        </div>

        {/* タイトル入力 (idle のみ) */}
        {phase === 'idle' && (
          <>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, marginBottom: 14 }}>
              Google Meet 無料・Zoom 無料・対面会議 どれでも OK。
              スマホでもパソコンでも使えます。マイク許可をお願いします。
            </p>
            <input
              type="text"
              value={meetingTitle}
              onChange={e => setMeetingTitle(e.target.value)}
              placeholder="会議名 (例: A 社 提案 MTG) — 省略可"
              style={{
                width: '100%',
                fontSize: 16,
                padding: '11px 14px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.06)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.12)',
                outline: 'none',
                marginBottom: 16,
              }}
            />
            <button
              onClick={start}
              style={{
                width: '100%',
                padding: '16px 18px',
                borderRadius: 14,
                background: `linear-gradient(135deg, ${accentColor}, #E84B97)`,
                color: '#fff',
                fontSize: 16, fontWeight: 800,
                border: 'none', cursor: 'pointer',
                boxShadow: `0 8px 22px ${accentColor}66`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Mic size={18} /> 録音を開始
            </button>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginTop: 10, lineHeight: 1.6 }}>
              ※ 録音内容は端末内のみで処理 → 文字起こしと要約だけサーバに送信されます
            </p>
          </>
        )}

        {/* 録音中 / 一時停止 */}
        {(phase === 'recording' || phase === 'paused') && (
          <>
            <RecordingPulse accent={accentColor} active={phase === 'recording'} />
            <div style={{ fontSize: 44, fontWeight: 800, color: '#fff', textAlign: 'center', marginTop: 14, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(elapsedSec)}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginTop: 4 }}>
              上限 {MAX_MINUTES} 分 ・ Wi-Fi 推奨
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              {phase === 'recording' ? (
                <button onClick={pause} style={ctlBtn(accentColor, false)}>
                  <Pause size={16} /> 一時停止
                </button>
              ) : (
                <button onClick={resume} style={ctlBtn(accentColor, true)}>
                  <Play size={16} /> 再開
                </button>
              )}
              <button onClick={stopAndProcess} style={{
                ...ctlBtn(accentColor, true),
                background: '#34D399', color: '#0a0a0f',
              }}>
                <Check size={16} /> 終了 → 要約
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginTop: 14, lineHeight: 1.6 }}>
              📌 画面をオフにしても録音は続きます (iPhone Safari は画面を点けたままが安全)
            </p>
          </>
        )}

        {/* AI 処理中 */}
        {phase === 'processing' && (
          <div style={{ textAlign: 'center', padding: '14px 0 8px' }}>
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              style={{
                width: 56, height: 56, borderRadius: '50%',
                background: `conic-gradient(${accentColor}, ${accentColor}33, ${accentColor})`,
                margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: '#12121E',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={20} color={accentColor} />
              </div>
            </motion.div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
              {processingLabel}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>
              録音 {formatTime(elapsedSec)} 分を AI が読み解いています
            </div>
          </div>
        )}

        {/* 完了 */}
        {phase === 'done' && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ textAlign: 'center', padding: '4px 0 8px' }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: '#34D399',
                margin: '0 auto 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Check size={28} color="#0a0a0f" strokeWidth={3} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                ナレッジに保存しました
              </div>
              {summaryHint && (
                <div style={{
                  fontSize: 13, color: 'rgba(255,255,255,0.75)',
                  marginTop: 10, padding: '10px 14px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 10, textAlign: 'left',
                  lineHeight: 1.6,
                }}>
                  💭 {summaryHint}
                </div>
              )}
              <button onClick={handleClose} style={{
                ...ctlBtn(accentColor, true),
                marginTop: 18, width: '100%',
              }}>
                閉じる
              </button>
            </motion.div>
          </AnimatePresence>
        )}

        {/* エラー */}
        {phase === 'error' && (
          <div style={{
            background: 'rgba(248,113,113,0.1)',
            border: '1px solid rgba(248,113,113,0.35)',
            borderRadius: 10,
            padding: '12px 14px',
            color: '#f87171',
            fontSize: 13, lineHeight: 1.6,
            marginBottom: 14,
          }}>
            ⚠ {errMsg}
          </div>
        )}
        {phase === 'error' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setPhase('idle'); setErrMsg(null); }} style={ctlBtn(accentColor, true)}>
              もう一度
            </button>
            <button onClick={handleClose} style={ctlBtn(accentColor, false)}>
              閉じる
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── 補助コンポーネント ─────────────────────
function RecordingPulse({ accent, active }: { accent: string; active: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', height: 100 }}>
      {active && [0, 1, 2].map(i => (
        <motion.div
          key={i}
          initial={{ x: '-50%' }}
          animate={{ scale: [1, 2.4], opacity: [0.4, 0], x: '-50%' }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.55, ease: 'easeOut' }}
          style={{
            position: 'absolute', top: 18, left: '50%',
            width: 60, height: 60, borderRadius: '50%',
            background: accent, opacity: 0.4, pointerEvents: 'none',
          }}
        />
      ))}
      <div style={{
        position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)',
        width: 60, height: 60, borderRadius: '50%',
        background: active ? accent : 'rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: active ? `0 0 30px ${accent}88` : 'none',
      }}>
        {active ? <Mic size={24} color="#fff" /> : <MicOff size={24} color="rgba(255,255,255,0.4)" />}
      </div>
    </div>
  );
}

// ─── ヘルパ ─────────────────────────────────
function ctlBtn(accent: string, primary: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '12px 14px',
    borderRadius: 12,
    background: primary
      ? `linear-gradient(135deg, ${accent}, ${accent}cc)`
      : 'rgba(255,255,255,0.08)',
    color: '#fff',
    fontSize: 13, fontWeight: 800,
    border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  };
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function chooseMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return 'audio/webm';
}

function extFromMime(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4'))  return 'm4a';
  if (mime.includes('ogg'))  return 'ogg';
  return 'webm';
}
