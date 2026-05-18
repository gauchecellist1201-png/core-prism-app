import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Persona, AppSettings } from '../types/identity';
import type { MeetingMinutes } from '../lib/meetingAnalyzer';
import { analyzeMeeting, minutesToMarkdown } from '../lib/meetingAnalyzer';
import { parseFile } from '../lib/fileParser';
import { transcribeAudioFile, isAudioFile } from '../lib/audioTranscribe';

interface Props {
  persona: Persona;
  settings: AppSettings;
  onClose: () => void;
  onSaveAsKnowledge: (title: string, content: string) => void;
  onAcceptAction: (action: string) => void;
}

type Mode = 'paste' | 'file' | 'record';

// 会議の発言ひとかたまり（無音で区切る）
interface Segment {
  id: string;
  speaker: number;   // 話者番号（1始まり）
  text: string;
  startMs: number;   // 録音開始からの経過ミリ秒
}

// 無音判定のしきい値（音量 RMS）と、話者が変わったとみなす無音の長さ
const SILENCE_RMS = 0.012;
const SPEAKER_GAP_MS = 1400;

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function MeetingMinutesModal({
  persona, settings, onClose, onSaveAsKnowledge, onAcceptAction,
}: Props) {
  const [mode, setMode] = useState<Mode>('paste');
  const [title, setTitle] = useState('');
  const [participants, setParticipants] = useState('');
  const [transcript, setTranscript] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── 録音ファイルの文字起こし進捗 ──
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeMsg, setTranscribeMsg] = useState('');
  const [showPhoneTip, setShowPhoneTip] = useState(false);

  // ── 録音まわり ──
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [speakerNames, setSpeakerNames] = useState<Record<number, string>>({});
  const [recordingMs, setRecordingMs] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  // 文字起こしの状態: live=順調 / audio-only=録音のみ続行中 / off=未対応
  const [recStatus, setRecStatus] = useState<'live' | 'audio-only' | 'off'>('live');
  const [recNote, setRecNote] = useState<string>('');

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const recordingActiveRef = useRef(false);
  const silenceStartRef = useRef(0);
  const speakerGapRef = useRef(false);
  const currentSpeakerRef = useRef(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

  // 話者の人数（参加者欄から推定、最低2人）
  const speakerSlots = useMemo(() => {
    const n = participants.split(/[,、]/).map(s => s.trim()).filter(Boolean).length;
    return Math.max(2, n);
  }, [participants]);
  const speakerSlotsRef = useRef(speakerSlots);
  useEffect(() => { speakerSlotsRef.current = speakerSlots; }, [speakerSlots]);

  const speakerLabel = useCallback((n: number) => {
    return speakerNames[n]?.trim() || `話者${n}`;
  }, [speakerNames]);

  // ── 録音停止（全リソースを片付ける） ──
  const stopRecording = useCallback(() => {
    recordingActiveRef.current = false;
    setIsRecording(false);
    setInterimText('');

    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) { try { rec.stop(); } catch { /* noop */ } }

    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') { try { mr.stop(); } catch { /* noop */ } }

    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (timerRef.current != null) { clearInterval(timerRef.current); timerRef.current = null; }

    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    analyserRef.current = null;
    if (ctx && ctx.state !== 'closed') { ctx.close().catch(() => {}); }

    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) stream.getTracks().forEach(t => t.stop());

    setMicLevel(0);
  }, []);

  // ── 音声認識の起動（録音中は自動再起動して途切れさせない） ──
  const startRecognition = useCallback(() => {
    if (!SR) {
      setRecStatus('off');
      setRecNote('このブラウザは自動文字起こしに対応していません。録音だけ続けます（あとで聞き直せます）。');
      return;
    }
    const r = new SR();
    r.lang = 'ja-JP';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onresult = (e: any) => {
      let final = '';
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setInterimText(interim);
      if (!final) return;
      // 無音区切りが入っていれば「別の話者」とみなして新しい段落にする
      const gap = speakerGapRef.current;
      speakerGapRef.current = false;
      setSegments(prev => {
        if (prev.length === 0) {
          currentSpeakerRef.current = 1;
          return [{ id: uid(), speaker: 1, text: final, startMs: Date.now() - startedAtRef.current }];
        }
        if (gap) {
          const slots = Math.max(2, speakerSlotsRef.current);
          const next = currentSpeakerRef.current >= slots ? 1 : currentSpeakerRef.current + 1;
          currentSpeakerRef.current = next;
          return [...prev, { id: uid(), speaker: next, text: final, startMs: Date.now() - startedAtRef.current }];
        }
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), { ...last, text: last.text + final }];
      });
    };

    r.onerror = (e: any) => {
      const err = e?.error;
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        setRecStatus('audio-only');
        setRecNote('マイクの文字起こしが拒否されました。録音は続いています。停止後に音声を保存できます。');
      } else if (err === 'audio-capture') {
        setRecStatus('audio-only');
        setRecNote('マイクが見つかりません。録音は続行します。');
      } else if (err === 'network') {
        setRecStatus('audio-only');
        setRecNote('文字起こしの通信が不安定です。録音は続いています（再接続を試みます）。');
      }
      // no-speech / aborted などは onend の自動再起動にまかせる
    };

    r.onend = () => {
      // 録音継続中なら即再起動（1人発話で止まらないように）
      if (recordingActiveRef.current && recognitionRef.current === r) {
        try {
          r.start();
        } catch {
          // すぐに再起動できない場合は少し待ってリトライ
          window.setTimeout(() => {
            if (recordingActiveRef.current && recognitionRef.current === r) {
              try { r.start(); } catch { /* noop */ }
            }
          }, 400);
        }
      }
    };

    recognitionRef.current = r;
    try {
      r.start();
      setRecStatus('live');
    } catch {
      setRecStatus('audio-only');
      setRecNote('文字起こしの起動に失敗しました。録音は続行します。');
    }
  }, [SR]);

  // ── 録音開始 ──
  const startRecording = useCallback(async () => {
    setError(null);
    setRecNote('');
    setSegments([]);
    setSpeakerNames({});
    setAudioUrl(null);
    setInterimText('');
    setRecordingMs(0);
    silenceStartRef.current = 0;
    speakerGapRef.current = false;
    currentSpeakerRef.current = 1;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      setError('マイクを使えませんでした。ブラウザのマイク許可を確認してください（アドレスバーの🔒→マイク→許可）。');
      return;
    }
    streamRef.current = stream;
    recordingActiveRef.current = true;
    startedAtRef.current = Date.now();

    // 1) 会議全体を録音（文字起こしが落ちても音声は丸ごと残る）
    audioChunksRef.current = [];
    try {
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find(m => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m));
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mr.ondataavailable = (ev) => { if (ev.data.size > 0) audioChunksRef.current.push(ev.data); };
      mr.onstop = () => {
        if (audioChunksRef.current.length === 0) return;
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        setAudioUrl(URL.createObjectURL(blob));
      };
      mr.start(1000); // 1秒ごとにデータ確定（長時間でも安全）
      mediaRecorderRef.current = mr;
    } catch {
      // MediaRecorder 非対応でも文字起こしは続行
      setRecNote('このブラウザは音声ファイル保存に未対応です。文字起こしのみ行います。');
    }

    // 2) 音量を監視して「無音＝話者の切れ目」を検出
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      analyserRef.current = analyser;
      const buf = new Uint8Array(analyser.fftSize);
      const tick = () => {
        const a = analyserRef.current;
        if (!a) return;
        a.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        setMicLevel(rms);
        const now = performance.now();
        if (rms < SILENCE_RMS) {
          if (silenceStartRef.current === 0) silenceStartRef.current = now;
          else if (now - silenceStartRef.current > SPEAKER_GAP_MS) speakerGapRef.current = true;
        } else {
          silenceStartRef.current = 0;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // 音量監視が使えなくても文字起こし自体は動く
    }

    // 3) ライブ文字起こし
    startRecognition();

    // 4) 経過時間カウンタ
    timerRef.current = window.setInterval(() => {
      setRecordingMs(Date.now() - startedAtRef.current);
    }, 1000);

    setIsRecording(true);
  }, [startRecognition]);

  useEffect(() => () => {
    stopRecording();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 録音した発言を「話者: 発言」形式のテキストに変換
  const segmentsToTranscript = useCallback((): string => {
    return segments
      .filter(s => s.text.trim())
      .map(s => `${speakerLabel(s.speaker)}: ${s.text.trim()}`)
      .join('\n');
  }, [segments, speakerLabel]);

  // 録音中に出てきた話者番号の一覧
  const usedSpeakers = useMemo(() => {
    const set = new Set<number>();
    segments.forEach(s => set.add(s.speaker));
    return [...set].sort((a, b) => a - b);
  }, [segments]);

  // 段落の話者を切り替える（タップでぐるぐる回す）
  const cycleSpeaker = useCallback((id: string) => {
    const max = Math.max(2, speakerSlots, ...usedSpeakers);
    setSegments(prev => prev.map(s =>
      s.id === id ? { ...s, speaker: s.speaker >= max ? 1 : s.speaker + 1 } : s
    ));
  }, [speakerSlots, usedSpeakers]);

  // ── ファイルからトランスクリプト抽出 ──
  const handleFile = useCallback(async (file: File) => {
    setError(null);
    const ext = file.name.toLowerCase().match(/\.([^.]+)$/)?.[1] || '';
    // 会議の録音ファイル (mp3 / m4a / mp4 など) → 文字起こし
    if (isAudioFile(file.name)) {
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
      setTranscribing(true);
      setTranscribeMsg('録音を読み込んでいます…');
      try {
        const text = await transcribeAudioFile(file, {
          model: settings.preferredModel,
          onProgress: (done, total) => {
            setTranscribeMsg(
              done >= total
                ? '文字起こしを仕上げています…'
                : `文字起こし中… ${done}/${total}`,
            );
          },
        });
        setTranscript(text);
        setTranscribeMsg('');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setTranscribing(false);
      }
      return;
    }
    if (['vtt', 'srt'].includes(ext)) {
      const text = await file.text();
      setTranscript(parseSubtitle(text));
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
    } else if (['txt', 'md'].includes(ext)) {
      const text = await file.text();
      setTranscript(text);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
    } else if (['pdf', 'docx'].includes(ext)) {
      const r = await parseFile(file);
      setTranscript(r.text);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
    } else {
      setError(`未対応の形式: ${ext}\n対応: 録音 (mp3/m4a/mp4/wav) / 字幕 (vtt/srt) / 文書 (txt/md/pdf/docx)`);
    }
  }, [title, settings.preferredModel]);

  // ── 解析実行 ──
  const handleAnalyze = useCallback(async () => {
    const text = mode === 'record' && segments.length > 0 ? segmentsToTranscript() : transcript;
    if (!text.trim()) {
      setError('議事録の内容を入力してください');
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    try {
      // 録音モードでは話者名も参加者として渡す
      const speakerParts = usedSpeakers.map(n => speakerLabel(n));
      const typed = participants
        ? participants.split(/[,、]/).map(s => s.trim()).filter(Boolean)
        : [];
      const allParts = [...new Set([...typed, ...(mode === 'record' ? speakerParts : [])])];
      const result = await analyzeMeeting(settings, persona, text, {
        title: title || undefined,
        participants: allParts.length ? allParts : undefined,
      });
      setMinutes(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAnalyzing(false);
    }
  }, [mode, segments, segmentsToTranscript, transcript, title, participants, usedSpeakers, speakerLabel, persona, settings]);

  // ── ナレッジ保存 ──
  const handleSaveToKnowledge = useCallback(() => {
    if (!minutes) return;
    const md = minutesToMarkdown(minutes);
    onSaveAsKnowledge(`📅 ${minutes.title}`, md);
    onClose();
  }, [minutes, onSaveAsKnowledge, onClose]);

  // ── ダウンロード ──
  const handleDownload = useCallback(() => {
    if (!minutes) return;
    const md = minutesToMarkdown(minutes);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${minutes.title.replace(/[\\/:*?"<>|]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [minutes]);

  const handleDownloadAudio = useCallback(() => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `${(title || '会議録音').replace(/[\\/:*?"<>|]/g, '_')}.webm`;
    a.click();
  }, [audioUrl, title]);

  const fmtTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  const hasRecordContent = segments.length > 0;
  const canAnalyze = mode === 'record'
    ? hasRecordContent || transcript.trim().length > 0
    : transcript.trim().length > 0;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--bg, #15151c)',
          border: '1px solid var(--border)',
          maxHeight: 'calc(100dvh - 1.5rem)',
        }}
        initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: persona.accentColorLight, color: persona.accentColor }}
            >
              📅
            </div>
            <div className="min-w-0">
              <p className="text-fg text-lg font-semibold leading-tight truncate">議事録 AI</p>
              <p className="text-fg-muted text-xs">{persona.name} の文脈で会議を構造化</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface text-xl leading-none"
          >×</button>
        </div>

        {!minutes ? (
          /* 入力モード */
          <div className="flex-1 overflow-y-auto">
            {/* モード切替 */}
            <div className="flex gap-1.5 p-3" style={{ borderBottom: '1px solid var(--border)' }}>
              {([
                ['record', '🎙 会議を録音', true],
                ['paste',  '📝 テキスト貼付', true],
                ['file',   '📂 ファイル', true],
              ] as [Mode, string, boolean][]).map(([id, label, ok]) => (
                <button
                  key={id}
                  onClick={() => ok && !isRecording && !transcribing && setMode(id)}
                  disabled={!ok || isRecording || transcribing}
                  className="text-sm px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-40"
                  style={{
                    background: mode === id ? persona.accentColorLight : 'var(--surface-3)',
                    color: mode === id ? persona.accentColor : 'var(--fg-muted)',
                    border: `1px solid ${mode === id ? persona.accentColor + '50' : 'var(--border)'}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="p-5 space-y-4">
              {/* タイトル + 参加者 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">タイトル (任意)</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="例: 営業MTG / 月次レビュー"
                    className="w-full text-sm rounded-lg px-3 py-2 outline-none bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg"
                  />
                </div>
                <div>
                  <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">参加者 (カンマ区切り)</label>
                  <input
                    type="text"
                    value={participants}
                    onChange={e => setParticipants(e.target.value)}
                    placeholder="例: 田中, 佐藤, 鈴木"
                    className="w-full text-sm rounded-lg px-3 py-2 outline-none bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg"
                  />
                </div>
              </div>

              {/* ── 録音モード ── */}
              {mode === 'record' && (
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: isRecording ? `${persona.accentColor}12` : 'var(--surface-3)',
                    border: `1px solid ${isRecording ? persona.accentColor : 'var(--border)'}`,
                  }}
                >
                  {!isRecording && !hasRecordContent ? (
                    /* 録音前 */
                    <div className="text-center">
                      <div className="text-3xl mb-2">🎙</div>
                      <p className="text-fg text-base font-medium mb-1">会議をまるごと録音</p>
                      <p className="text-fg-muted text-xs mb-1">部屋全体の声を録音しながら、自動で文字起こしします。</p>
                      <p className="text-fg-muted text-xs mb-3">話の切れ目で「話者1・話者2…」に分けます（あとで名前を付けられます）。</p>
                      <button
                        onClick={startRecording}
                        className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
                        style={{ background: persona.accentColor, color: '#0a0a0f' }}
                      >▶ 録音をはじめる</button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* 録音ステータスバー */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {isRecording && (
                            <motion.span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ background: '#f87171' }}
                              animate={{ opacity: [1, 0.3, 1] }}
                              transition={{ duration: 1.1, repeat: Infinity }}
                            />
                          )}
                          <span className="text-fg text-sm font-medium tabular-nums">{fmtTime(recordingMs)}</span>
                          <span className="text-fg-muted text-xs truncate">
                            {isRecording
                              ? (recStatus === 'live' ? '録音＋文字起こし中' : '録音中（音声を保存します）')
                              : '録音おわり'}
                          </span>
                        </div>
                        {/* 音量メーター */}
                        {isRecording && (
                          <div className="flex items-center gap-0.5 h-5 flex-shrink-0">
                            {Array.from({ length: 10 }).map((_, i) => (
                              <div
                                key={i}
                                className="w-1 rounded-full transition-all"
                                style={{
                                  height: `${4 + (micLevel * 12 > i ? 14 : 0)}px`,
                                  background: micLevel * 12 > i ? persona.accentColor : 'var(--border)',
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 文字起こしが不安定なときの案内 */}
                      {recNote && (
                        <div
                          className="text-xs px-3 py-2 rounded-lg"
                          style={{ background: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.35)', color: '#c9a96e' }}
                        >
                          {recNote}
                        </div>
                      )}

                      {/* 発言ログ（話者ごと） */}
                      {(hasRecordContent || interimText) && (
                        <div
                          className="rounded-lg p-3 space-y-2 max-h-56 overflow-y-auto"
                          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                        >
                          {segments.map(seg => (
                            <div key={seg.id} className="flex gap-2">
                              <button
                                onClick={() => !isRecording && cycleSpeaker(seg.id)}
                                disabled={isRecording}
                                className="text-xs font-semibold px-2 py-0.5 rounded-md flex-shrink-0 h-fit transition-all disabled:cursor-default"
                                style={{
                                  background: persona.accentColorLight,
                                  color: persona.accentColor,
                                  border: `1px solid ${persona.accentColor}40`,
                                }}
                                title={isRecording ? '' : 'タップで話者を切り替え'}
                              >
                                {speakerLabel(seg.speaker)}
                              </button>
                              {isRecording ? (
                                <p className="text-fg text-sm leading-relaxed flex-1">{seg.text}</p>
                              ) : (
                                <textarea
                                  value={seg.text}
                                  onChange={e => setSegments(prev => prev.map(s =>
                                    s.id === seg.id ? { ...s, text: e.target.value } : s
                                  ))}
                                  className="text-fg text-sm leading-relaxed flex-1 bg-transparent outline-none resize-y rounded px-1 -mx-1 focus:bg-surface-3"
                                  rows={Math.max(1, Math.ceil(seg.text.length / 36))}
                                />
                              )}
                            </div>
                          ))}
                          {interimText && (
                            <p className="text-fg-muted text-sm italic">{interimText}…</p>
                          )}
                          {!hasRecordContent && !interimText && (
                            <p className="text-fg-subtle text-sm">聞き取り中…</p>
                          )}
                        </div>
                      )}

                      {/* 録音中の操作 */}
                      {isRecording ? (
                        <button
                          onClick={stopRecording}
                          className="w-full px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
                          style={{ background: '#f87171', color: '#0a0a0f' }}
                        >■ 録音を停止</button>
                      ) : (
                        <>
                          {/* 話者の名前付け */}
                          {usedSpeakers.length > 0 && (
                            <div>
                              <p className="text-fg-muted text-xs mb-1.5">話者に名前をつける（任意・後でAIに渡します）</p>
                              <div className="grid grid-cols-2 gap-2">
                                {usedSpeakers.map(n => (
                                  <input
                                    key={n}
                                    type="text"
                                    value={speakerNames[n] ?? ''}
                                    onChange={e => setSpeakerNames(prev => ({ ...prev, [n]: e.target.value }))}
                                    placeholder={`話者${n} の名前`}
                                    className="w-full text-sm rounded-lg px-2.5 py-1.5 outline-none bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg"
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          {/* 録音した音声 */}
                          {audioUrl && (
                            <div className="flex items-center gap-2">
                              <audio src={audioUrl} controls className="flex-1 h-9" style={{ minWidth: 0 }} />
                              <button
                                onClick={handleDownloadAudio}
                                className="text-xs px-2.5 py-1.5 rounded-lg flex-shrink-0 bg-surface-3 border-edge border text-fg"
                              >💾 音声</button>
                            </div>
                          )}
                          <button
                            onClick={startRecording}
                            className="w-full px-5 py-2 rounded-lg text-sm font-medium transition-all bg-surface-3 border-edge border text-fg"
                          >🎙 録音をやり直す</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {mode === 'file' && (
                <div className="space-y-2.5">
                  <div
                    className="rounded-xl p-6 text-center"
                    style={{
                      background: 'var(--surface-3)',
                      border: `2px dashed ${transcribing ? persona.accentColor : 'var(--border)'}`,
                      cursor: transcribing ? 'default' : 'pointer',
                    }}
                    onClick={() => !transcribing && fileInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      if (transcribing) return;
                      const f = e.dataTransfer.files[0];
                      if (f) handleFile(f);
                    }}
                  >
                    {transcribing ? (
                      <>
                        <motion.div
                          className="text-3xl mb-2"
                          animate={{ opacity: [1, 0.4, 1] }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                        >🎧</motion.div>
                        <p className="text-fg text-base mb-1">{transcribeMsg || '文字起こし中…'}</p>
                        <p className="text-fg-muted text-xs">録音の長さによって少し時間がかかります</p>
                      </>
                    ) : (
                      <>
                        <p className="text-3xl mb-2">🎙</p>
                        <p className="text-fg text-base mb-1">会議の録音をドロップ or クリック</p>
                        <p className="text-fg-muted text-xs">
                          Zoom / Google Meet / Teams の録音 (mp3 / m4a / mp4 / wav)
                        </p>
                        <p className="text-fg-subtle text-xs mt-0.5">
                          字幕 (vtt / srt) ・文書 (txt / md / pdf / docx) も OK
                        </p>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".mp3,.m4a,.mp4,.wav,.aac,.ogg,.webm,.mov,.flac,.vtt,.srt,.txt,.md,.pdf,.docx,audio/*,video/*"
                      className="hidden"
                      onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                    />
                  </div>

                  {/* iPhone から送るときのヒント */}
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
                  >
                    <button
                      onClick={() => setShowPhoneTip(v => !v)}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 text-left"
                    >
                      <span className="text-fg text-sm">📱 iPhone の録音を送るには</span>
                      <span className="text-fg-muted text-sm">{showPhoneTip ? '−' : '+'}</span>
                    </button>
                    {showPhoneTip && (
                      <div className="px-3.5 pb-3.5 text-fg-muted text-xs leading-relaxed space-y-1.5">
                        <p>iPhone はドラッグできないので「クリック」で選びます。</p>
                        <ol className="list-decimal pl-4 space-y-1">
                          <li>会議アプリやボイスメモで録音を保存（共有 →「ファイルに保存」）。</li>
                          <li>この画面の <span className="text-fg">🎙 枠をタップ</span>。</li>
                          <li>「ブラウズ」から保存した録音を選ぶだけ。</li>
                        </ol>
                        <p className="text-fg-subtle">
                          ヒント: ショートカットアプリで「共有シートから受け取る → ファイルに保存
                          (フォルダ: CORE会議)」を作ると、毎回そのフォルダから選べて速いです。
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* トランスクリプト（貼付・ファイル用。録音モードは上の発言ログを使う） */}
              {mode !== 'record' && (
                <div>
                  <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">
                    文字起こし {transcript.length > 0 && `(${transcript.length}文字)`}
                  </label>
                  <textarea
                    value={transcript}
                    onChange={e => setTranscript(e.target.value)}
                    placeholder={
                      mode === 'paste'
                        ? '会議のメモや文字起こしを貼り付け...'
                        : 'ファイルをアップロードすると自動で読み込まれます'
                    }
                    className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-y bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg"
                    style={{ minHeight: '180px' }}
                  />
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderTop: '1px solid var(--border)' }}>
              <p className="text-fg-muted text-xs">
                {isRecording ? '停止すると議事録を生成できます' : `${persona.name} 視点で議事録を構造化`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors"
                >キャンセル</button>
                <motion.button
                  onClick={handleAnalyze}
                  disabled={!canAnalyze || isAnalyzing || isRecording || transcribing}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                  style={{ background: persona.accentColor, color: '#0a0a0f' }}
                  whileHover={!isAnalyzing ? { scale: 1.02 } : {}}
                  whileTap={!isAnalyzing ? { scale: 0.98 } : {}}
                >
                  {isAnalyzing ? '🧠 解析中…' : '✨ 議事録を生成'}
                </motion.button>
              </div>
            </div>
          </div>
        ) : (
          /* 結果表示 */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* タイトル + メタ */}
              <div>
                <p className="text-fg text-2xl font-bold leading-tight">{minutes.title}</p>
                <p className="text-fg-muted text-sm mt-1">
                  {minutes.date}
                  {(minutes.durationMin ?? 0) > 0 && ` · ${minutes.durationMin}分`}
                  {minutes.participants.length > 0 && ` · 参加: ${minutes.participants.join('、')}`}
                </p>
              </div>

              {/* 要約 */}
              <ResultSection
                title="📋 要約"
                color={persona.accentColor}
              >
                <p className="text-fg text-sm leading-relaxed whitespace-pre-wrap">{minutes.summary}</p>
              </ResultSection>

              {/* 議題 */}
              {minutes.agenda.length > 0 && (
                <ResultSection title="🗒 議題" color={persona.accentColor}>
                  <div className="space-y-2.5">
                    {minutes.agenda.map((a, i) => (
                      <div key={i}>
                        <p className="text-fg text-sm font-semibold mb-1">{i + 1}. {a.topic}</p>
                        <p className="text-fg-muted text-sm leading-relaxed">{a.discussion}</p>
                      </div>
                    ))}
                  </div>
                </ResultSection>
              )}

              {/* 決定事項 */}
              {minutes.decisions.length > 0 && (
                <ResultSection title="✓ 決定事項" color="#34d399">
                  <ul className="space-y-1.5">
                    {minutes.decisions.map((d, i) => (
                      <li key={i} className="text-fg text-sm flex gap-2 leading-relaxed">
                        <span style={{ color: '#34d399' }}>·</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </ResultSection>
              )}

              {/* アクション */}
              {minutes.actions.length > 0 && (
                <ResultSection title="🎯 アクション" color="#34d399">
                  <div className="space-y-2">
                    {minutes.actions.map((a, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-2.5 rounded-lg"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                      >
                        <span style={{ color: '#34d399' }} className="text-sm flex-shrink-0 mt-0.5">▸</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-fg text-sm leading-snug">{a.item}</p>
                          {(a.owner || a.due) && (
                            <p className="text-fg-muted text-xs mt-0.5">
                              {[a.owner, a.due].filter(x => x && x !== '不明').join(' / ')}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => onAcceptAction(a.item)}
                          className="text-xs px-2 py-1 rounded transition-all flex-shrink-0"
                          style={{
                            background: 'rgba(52,211,153,0.15)',
                            color: '#34d399',
                            border: '1px solid rgba(52,211,153,0.4)',
                          }}
                          title="タスクに追加"
                        >＋追加</button>
                      </div>
                    ))}
                  </div>
                </ResultSection>
              )}

              {/* Q&A */}
              {minutes.questions.length > 0 && (
                <ResultSection title="❓ Q&A" color="#a78bfa">
                  <div className="space-y-2">
                    {minutes.questions.map((q, i) => (
                      <div key={i}>
                        <p className="text-fg text-sm"><span className="font-semibold" style={{ color: '#a78bfa' }}>Q.</span> {q.q}</p>
                        <p className="text-fg-muted text-sm mt-0.5"><span className="font-semibold">A.</span> {q.a}</p>
                      </div>
                    ))}
                  </div>
                </ResultSection>
              )}

              {/* 次回 */}
              {minutes.nextSteps.length > 0 && (
                <ResultSection title="📌 次回確認事項" color={persona.accentColor}>
                  <ul className="space-y-1">
                    {minutes.nextSteps.map((n, i) => (
                      <li key={i} className="text-fg text-sm flex gap-2"><span>·</span><span>{n}</span></li>
                    ))}
                  </ul>
                </ResultSection>
              )}

              {/* インサイト */}
              {minutes.insights.length > 0 && (
                <ResultSection title={`💡 ${persona.name} 視点のインサイト`} color="#c9a96e">
                  <ul className="space-y-1">
                    {minutes.insights.map((i2, i) => (
                      <li key={i} className="text-fg text-sm flex gap-2 leading-relaxed">
                        <span style={{ color: '#c9a96e' }}>·</span><span>{i2}</span>
                      </li>
                    ))}
                  </ul>
                </ResultSection>
              )}

              {/* リスク */}
              {minutes.risks.length > 0 && (
                <ResultSection title="⚠ リスク・懸念" color="#f87171">
                  <ul className="space-y-1">
                    {minutes.risks.map((r, i) => (
                      <li key={i} className="text-fg text-sm flex gap-2"><span style={{ color: '#f87171' }}>·</span><span>{r}</span></li>
                    ))}
                  </ul>
                </ResultSection>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-3)' }}>
              <button
                onClick={() => setMinutes(null)}
                className="text-sm text-fg-muted hover:text-fg"
              >← 編集に戻る</button>
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 rounded-lg text-sm transition-all bg-surface-3 border-edge border text-fg hover:bg-surface"
                >📥 .md ダウンロード</button>
                <button
                  onClick={handleSaveToKnowledge}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: persona.accentColor, color: '#0a0a0f' }}
                >📚 ナレッジに保存</button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function ResultSection({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div
      className="p-3.5 rounded-xl"
      style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
    >
      <p
        className="text-xs tracking-widest uppercase font-semibold mb-2"
        style={{ color }}
      >{title}</p>
      {children}
    </div>
  );
}

// VTT/SRT 字幕を平文に変換
function parseSubtitle(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let last = '';
  for (const ln of lines) {
    const t = ln.trim();
    if (!t) continue;
    if (t === 'WEBVTT') continue;
    if (/^\d+$/.test(t)) continue; // SRT インデックス
    if (/-->/.test(t)) continue;   // タイムスタンプ
    if (t === last) continue;       // 重複除去
    out.push(t);
    last = t;
  }
  return out.join(' ');
}
