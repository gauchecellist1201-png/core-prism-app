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
import { Mic, MicOff, Pause, Play, Sparkles, Check, X, Video, Link2, MonitorSpeaker } from 'lucide-react';
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

  // 音源: マイク(対面/スピーカー) or この画面/タブの音声(Meet/Zoom の参加者音声)
  const [sourceMode, setSourceMode] = useState<'mic' | 'tab'>('mic');
  // Google Meet リンク（Prism から発行して相手に送る）
  const [meetLink, setMeetLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  // タブ音声モード用: 画面共有・マイク・AudioContext を個別に保持して確実に開放する
  const displayStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
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
      let stream: MediaStream;
      if (sourceMode === 'tab') {
        // Meet/Zoom の「参加者の声」を取るには、ブラウザのタブ音声を共有してもらう。
        // さらに自分のマイクも足して全員の声を 1 本に混ぜる（AudioContext で合成）。
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        displayStreamRef.current = display;
        const tabAudio = display.getAudioTracks();
        if (tabAudio.length === 0) {
          display.getTracks().forEach(t => t.stop());
          displayStreamRef.current = null;
          throw new Error('タブの音声が共有されませんでした。共有ダイアログで会議の「タブ」を選び、「タブの音声も共有」にチェックを入れてください。');
        }
        // 自分の声（任意・取れなくても続行）
        let mic: MediaStream | null = null;
        try {
          mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
          micStreamRef.current = mic;
        } catch { /* マイク不可でも参加者音声だけで続行 */ }
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        audioCtxRef.current = ctx;
        const dest = ctx.createMediaStreamDestination();
        ctx.createMediaStreamSource(new MediaStream(tabAudio)).connect(dest);
        if (mic) ctx.createMediaStreamSource(mic).connect(dest);
        // 画面映像は不要なので止める（音声だけ録る）
        display.getVideoTracks().forEach(t => t.stop());
        // ユーザーがブラウザの「共有を停止」を押したら自動で確定
        tabAudio[0].addEventListener('ended', () => { stopAndProcess(); });
        stream = dest.stream;
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      }
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
      releaseStreams();
      const msg = e instanceof Error ? e.message : '音声を取得できませんでした';
      // 取消(NotAllowed)はやさしく、それ以外はメッセージをそのまま見せる
      setErrMsg(/denied|notallowed|permission/i.test(msg)
        ? (sourceMode === 'tab' ? '画面共有が許可されませんでした。もう一度「録音を開始」を押し、会議のタブと「タブの音声」を選んでください。' : 'マイクが許可されませんでした。ブラウザのマイク許可をオンにしてください。')
        : msg);
      setPhase('error');
    }
  };

  // すべての入力ストリーム/AudioContext を確実に開放する
  const releaseStreams = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    displayStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    try { audioCtxRef.current?.close(); } catch { /* */ }
    streamRef.current = null; displayStreamRef.current = null; micStreamRef.current = null; audioCtxRef.current = null;
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
    // 入力をすべて開放（マイク / タブ音声 / AudioContext）
    releaseStreams();

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
    releaseStreams();
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
              width: 44, height: 44, color: '#fff',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="閉じる"
          ><X size={20} strokeWidth={2.2} /></button>
        </div>

        {/* タイトル入力 (idle のみ) */}
        {phase === 'idle' && (
          <>
            {/* STEP 1: Google Meet リンクを作って相手に送る */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: accentColor, letterSpacing: '0.1em', marginBottom: 8 }}>STEP 1 ・ 会議リンクを用意</div>
              <a href="https://meet.google.com/new" target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg, #1a73e8, #4285f4)', color: '#fff', fontSize: 14, fontWeight: 800, textDecoration: 'none', marginBottom: 10 }}>
                <Video size={17} /> Google Meet を作成（新しいタブで開く）
              </a>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="url" value={meetLink} onChange={e => { setMeetLink(e.target.value); setLinkCopied(false); }}
                  placeholder="発行された Meet リンクを貼り付け"
                  style={{ flex: 1, minWidth: 0, fontSize: 13, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', outline: 'none' }} />
                <button
                  onClick={async () => {
                    const link = meetLink.trim(); if (!link) return;
                    const shareData = { title: '会議のご案内', text: 'こちらの Google Meet にご参加ください:', url: link };
                    try { if (navigator.share) { await navigator.share(shareData); return; } } catch { /* 共有キャンセルは無視 */ }
                    try { await navigator.clipboard?.writeText(link); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1800); } catch { /* */ }
                  }}
                  style={{ flexShrink: 0, padding: '0 14px', borderRadius: 10, background: accentColor, color: '#fff', border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {linkCopied ? <><Check size={14} /> コピー済</> : <><Link2 size={14} /> 送る</>}
                </button>
              </div>
              <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', marginTop: 8, lineHeight: 1.6 }}>
                作成 → リンクをコピーしてこの欄に貼り、「送る」で相手へ共有。会議に入ったら下で録音を始めます。
              </p>
            </div>

            {/* STEP 2: 音源を選ぶ */}
            <div style={{ fontSize: 11, fontWeight: 800, color: accentColor, letterSpacing: '0.1em', marginBottom: 8 }}>STEP 2 ・ 録音する音</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              {([
                ['tab', 'Meet / Zoom', '画面共有で参加者の声＋あなたの声', MonitorSpeaker],
                ['mic', '対面 / スピーカー', 'マイクで拾う', Mic],
              ] as const).map(([mode, title, desc, Icon]) => {
                const sel = sourceMode === mode;
                return (
                  <button key={mode} onClick={() => setSourceMode(mode)}
                    style={{ textAlign: 'left', padding: '11px 12px', borderRadius: 12, cursor: 'pointer',
                      background: sel ? `${accentColor}22` : 'rgba(255,255,255,0.04)',
                      border: `1.5px solid ${sel ? accentColor : 'rgba(255,255,255,0.10)'}`, color: '#fff' }}>
                    <Icon size={16} color={sel ? accentColor : 'rgba(255,255,255,0.6)'} />
                    <div style={{ fontSize: 12.5, fontWeight: 800, marginTop: 5 }}>{title}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4, marginTop: 2 }}>{desc}</div>
                  </button>
                );
              })}
            </div>

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
              {sourceMode === 'tab' ? <><MonitorSpeaker size={18} /> 画面を共有して録音開始</> : <><Mic size={18} /> マイクで録音開始</>}
            </button>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginTop: 10, lineHeight: 1.6 }}>
              {sourceMode === 'tab'
                ? '※ 次の画面で会議の「タブ」を選び、「タブの音声も共有」にチェックを入れてください'
                : '※ 録音内容は端末内のみで処理 → 文字起こしと要約だけサーバに送信されます'}
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
