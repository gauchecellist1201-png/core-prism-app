import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Persona, AppSettings } from '../types/identity';
import type { MeetingMinutes } from '../lib/meetingAnalyzer';
import { analyzeMeeting, minutesToMarkdown } from '../lib/meetingAnalyzer';
import { parseFile } from '../lib/fileParser';

interface Props {
  persona: Persona;
  settings: AppSettings;
  onClose: () => void;
  onSaveAsKnowledge: (title: string, content: string) => void;
  onAcceptAction: (action: string) => void;
}

type Mode = 'paste' | 'file' | 'record';

// MediaRecorder + Web Speech API でリアルタイム文字起こし

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
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<any>(null);
  const startedAtRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const speechAvailable = !!SR;

  // ── 録音 (Web Speech API でライブ文字起こし) ──
  const startRecording = useCallback(() => {
    if (!SR) {
      setError('このブラウザは音声認識に対応していません。Chrome / Edge / Safari をお試しください。');
      return;
    }
    setError(null);
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
      if (final) setTranscript(prev => prev + (prev ? '\n' : '') + final);
      setInterimText(interim);
    };
    r.onerror = (e: any) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setError(`音声認識エラー: ${e.error}`);
      }
    };
    r.onend = () => {
      // 録音中なら自動再起動 (Web Speech API は数秒で勝手に止まる)
      if (recognitionRef.current === r) {
        try { r.start(); } catch {}
      }
    };

    recognitionRef.current = r;
    startedAtRef.current = Date.now();
    try {
      r.start();
      setIsRecording(true);
    } catch (err) {
      setError('録音開始に失敗しました');
    }
  }, [SR]);

  const stopRecording = useCallback(() => {
    const r = recognitionRef.current;
    recognitionRef.current = null;
    if (r) try { r.stop(); } catch {}
    setIsRecording(false);
    setInterimText('');
  }, []);

  useEffect(() => () => stopRecording(), [stopRecording]);

  // ── ファイルからトランスクリプト抽出 ──
  const handleFile = useCallback(async (file: File) => {
    setError(null);
    const ext = file.name.toLowerCase().match(/\.([^.]+)$/)?.[1] || '';
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
      setError(`未対応の形式: ${ext}\n対応: .vtt .srt .txt .md .pdf .docx`);
    }
  }, [title]);

  // ── 解析実行 ──
  const handleAnalyze = useCallback(async () => {
    if (!transcript.trim()) {
      setError('議事録の内容を入力してください');
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeMeeting(settings, persona, transcript, {
        title: title || undefined,
        participants: participants
          ? participants.split(/[,、]/).map(s => s.trim()).filter(Boolean)
          : undefined,
      });
      setMinutes(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAnalyzing(false);
    }
  }, [transcript, title, participants, persona, settings]);

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
                ['record', '🎙 ライブ録音', speechAvailable],
                ['paste',  '📝 テキスト貼付', true],
                ['file',   '📂 ファイル', true],
              ] as [Mode, string, boolean][]).map(([id, label, ok]) => (
                <button
                  key={id}
                  onClick={() => ok && setMode(id)}
                  disabled={!ok}
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

              {/* モード別 UI */}
              {mode === 'record' && (
                <div
                  className="rounded-xl p-5 text-center"
                  style={{
                    background: isRecording ? `${persona.accentColor}15` : 'var(--surface-3)',
                    border: `1px solid ${isRecording ? persona.accentColor : 'var(--border)'}`,
                  }}
                >
                  <motion.div
                    className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-3"
                    style={{ background: isRecording ? persona.accentColor : 'var(--surface)' }}
                    animate={isRecording ? { scale: [1, 1.08, 1] } : {}}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  >
                    <span className="text-3xl">{isRecording ? '🔴' : '🎙'}</span>
                  </motion.div>
                  {!isRecording ? (
                    <>
                      <p className="text-fg text-base font-medium mb-1">会議を録音 → ライブ文字起こし</p>
                      <p className="text-fg-muted text-xs mb-3">マイクの音声を Web Speech API でリアルタイム認識</p>
                      <button
                        onClick={startRecording}
                        className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
                        style={{ background: persona.accentColor, color: '#0a0a0f' }}
                      >▶ 録音開始</button>
                    </>
                  ) : (
                    <>
                      <p style={{ color: persona.accentColor }} className="text-base font-medium mb-1">録音中…</p>
                      {interimText && (
                        <p className="text-fg-muted text-sm italic mb-3">{interimText}</p>
                      )}
                      <button
                        onClick={stopRecording}
                        className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
                        style={{ background: '#f87171', color: '#0a0a0f' }}
                      >■ 停止</button>
                    </>
                  )}
                </div>
              )}

              {mode === 'file' && (
                <div
                  className="rounded-xl p-6 text-center cursor-pointer"
                  style={{ background: 'var(--surface-3)', border: '2px dashed var(--border)' }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                >
                  <p className="text-3xl mb-2">📂</p>
                  <p className="text-fg text-base mb-1">ドロップ or クリックでアップロード</p>
                  <p className="text-fg-muted text-xs">.vtt / .srt (Zoom字幕) / .txt / .md / .pdf / .docx</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".vtt,.srt,.txt,.md,.pdf,.docx"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                </div>
              )}

              {/* トランスクリプト共通エリア */}
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
                      : mode === 'record'
                        ? '録音すると自動で文字起こしされます'
                        : 'ファイルをアップロードすると自動で読み込まれます'
                  }
                  className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-y bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg"
                  style={{ minHeight: '180px' }}
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderTop: '1px solid var(--border)' }}>
              <p className="text-fg-muted text-xs">{persona.name} 視点で議事録を構造化</p>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors"
                >キャンセル</button>
                <motion.button
                  onClick={handleAnalyze}
                  disabled={!transcript.trim() || isAnalyzing || isRecording}
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
