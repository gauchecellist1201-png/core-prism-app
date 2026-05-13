// ============================================================
// CORE Prism ▸ 音声タスク予約 (フローティング UI)
// マイク → 音声認識 → AI パース → 予約 → 自動実行 → 通知
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Sparkles, X, Calendar, Check, Clock, Loader2, Trash2, AlertCircle, Copy, ListChecks } from 'lucide-react';
import { usePrismTaskQueue, parseVoiceCommand, type PrismTask, type TaskKind } from './usePrismTaskQueue';

const KIND_LABEL: Record<TaskKind, string> = {
  flyer: 'チラシ', post: '投稿文', email: 'メール',
  document: '文書', analysis: '分析', image_brief: '画像案',
  reminder: 'リマインド', general: '汎用',
};

const STATUS_META = {
  scheduled: { label: '予約中',   color: '#0E7490', bg: '#CFFAFE' },
  running:   { label: '実行中',   color: '#9A3412', bg: '#FFEDD5' },
  done:      { label: '完了',     color: '#065F46', bg: '#ECFDF5' },
  failed:    { label: 'エラー',   color: '#991B1B', bg: '#FEE2E2' },
  cancelled: { label: 'キャンセル', color: '#737373', bg: '#F5F5F5' },
} as const;

export default function PrismTaskScheduler() {
  const queue = usePrismTaskQueue();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'compose' | 'queue'>('compose');

  // 音声録音
  const [listening, setListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [interim, setInterim] = useState('');
  const recogRef = useRef<any>(null);

  // パース / 確認
  const [parsing, setParsing] = useState(false);
  const [parseErr, setParseErr] = useState<string>('');
  const [parsed, setParsed] = useState<null | {
    scheduledAt: string; kind: TaskKind; title: string; description: string; prompt: string;
  }>(null);

  // 完了通知 (アプリ内バッジ)
  const [unseenDone, setUnseenDone] = useState(0);
  useEffect(() => {
    setUnseenDone(queue.tasks.filter(t => t.status === 'done' && !t.notified).length);
  }, [queue.tasks]);

  // モバイル時の Speech Recognition (Web Speech API)
  const startListening = () => {
    setVoiceText('');
    setInterim('');
    setParseErr('');
    setParsed(null);

    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setParseErr('このブラウザは音声入力非対応。下のテキスト入力を使ってください。(Chrome/Safari/Edge 推奨)');
      return;
    }
    const rec = new SR();
    rec.lang = 'ja-JP';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let finalT = '';
      let interimT = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalT += r[0].transcript;
        else interimT += r[0].transcript;
      }
      setVoiceText(prev => prev + finalT);
      setInterim(interimT);
    };
    rec.onerror = (e: any) => {
      setParseErr(`音声認識エラー: ${e.error || 'unknown'}`);
      setListening(false);
    };
    rec.onend = () => { setListening(false); };
    rec.start();
    recogRef.current = rec;
    setListening(true);
  };

  const stopListening = () => {
    try { recogRef.current?.stop(); } catch {/* */}
    setListening(false);
  };

  const onParse = async () => {
    const text = (voiceText + interim).trim();
    if (!text) { setParseErr('音声 or テキストを入力してください'); return; }
    setParsing(true); setParseErr('');
    try {
      const j = await parseVoiceCommand(text);
      setParsed(j);
    } catch (e: any) {
      setParseErr(e?.message || 'AI パース失敗');
    } finally {
      setParsing(false);
    }
  };

  const onConfirm = () => {
    if (!parsed) return;
    const rawText = (voiceText + interim).trim();
    queue.add({
      scheduledAt: parsed.scheduledAt,
      kind: parsed.kind,
      rawInput: rawText,
      title: parsed.title,
      description: parsed.description,
      prompt: parsed.prompt,
    });
    queue.requestPermission();
    // リセット
    setVoiceText(''); setInterim(''); setParsed(null);
    setView('queue');
  };

  const reset = () => {
    if (listening) stopListening();
    setVoiceText(''); setInterim(''); setParsed(null); setParseErr('');
  };

  // タスク削除確認
  const onDelete = (t: PrismTask) => {
    if (confirm(`「${t.title}」を削除しますか?`)) queue.remove(t.id);
  };

  return (
    <>
      {/* フローティング ボタン (右下、AI と話すの少し上) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="音声でタスク予約"
        className="prism-task-fab"
        style={{
          position: 'fixed',
          right: 'calc(env(safe-area-inset-right, 0px) + 16px)',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 110px)',
          zIndex: 9997,
          width: 56, height: 56, borderRadius: 999,
          background: 'linear-gradient(135deg, #0033A0, #1A4FC4)',
          color: '#fff', border: 'none',
          boxShadow: '0 8px 24px rgba(0,51,160,0.42)',
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Mic size={22} />
        {unseenDone > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#E84B97', color: '#fff',
            width: 22, height: 22, borderRadius: 999,
            fontSize: 11, fontWeight: 800,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #fff',
          }}>{unseenDone}</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9998,
              background: 'rgba(10, 14, 30, 0.7)', backdropFilter: 'blur(10px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 16,
            }}>
            <motion.div
              key="modal"
              initial={{ y: 24, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 12, opacity: 0, scale: 0.97 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: 580,
                maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto',
                background: '#fff', borderRadius: 22,
                padding: '1.4rem 1.25rem',
                color: '#1F1A2E',
                boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
              }}>
              {/* ヘッダ */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.9rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                    Prism 音声タスク予約
                  </h3>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#666' }}>
                    「今夜8時にチラシ作って」 → 時刻に AI が実行 → 完了で通知
                  </p>
                </div>
                <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>
                  <X size={22} />
                </button>
              </div>

              {/* タブ切替 */}
              <div style={{ display: 'flex', gap: 6, marginBottom: '0.85rem' }}>
                <button onClick={() => setView('compose')} style={tabBtn(view === 'compose')}>
                  <Sparkles size={13} /> 新規予約
                </button>
                <button onClick={() => setView('queue')} style={tabBtn(view === 'queue')}>
                  <ListChecks size={13} /> キュー
                  {queue.tasks.length > 0 && (
                    <span style={{ background: '#0033A0', color: '#fff', borderRadius: 999, padding: '1px 6px', fontSize: 10, fontWeight: 800, marginLeft: 4 }}>
                      {queue.tasks.length}
                    </span>
                  )}
                </button>
              </div>

              {view === 'compose' ? (
                <>
                  {/* 音声入力ゾーン */}
                  <div style={{
                    padding: '1.2rem 1rem',
                    background: listening ? 'linear-gradient(135deg, #FEF3F2, #FEE4E2)' : '#F9FAFB',
                    border: `2px solid ${listening ? '#F472B6' : '#E5E7EB'}`,
                    borderRadius: 14, marginBottom: '0.85rem',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                  }}>
                    <button
                      onClick={listening ? stopListening : startListening}
                      disabled={!!parsed}
                      style={{
                        width: 84, height: 84, borderRadius: 999,
                        background: listening
                          ? 'linear-gradient(135deg, #F472B6, #E1306C)'
                          : 'linear-gradient(135deg, #0033A0, #1A4FC4)',
                        color: '#fff', border: 'none', cursor: 'pointer',
                        boxShadow: listening
                          ? '0 0 0 6px rgba(225, 48, 108, 0.18), 0 8px 24px rgba(225, 48, 108, 0.32)'
                          : '0 8px 24px rgba(0, 51, 160, 0.32)',
                        marginBottom: 8,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        animation: listening ? 'prism-mic-pulse 1.4s infinite' : 'none',
                      }}>
                      {listening ? <MicOff size={32} /> : <Mic size={32} />}
                    </button>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#1F1A2E' }}>
                      {listening ? '聞いています…' : 'マイクをタップして話す'}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#666' }}>
                      例: 「明日朝9時にプリズム新サービスのチラシを A4 縦で作って」
                    </p>
                  </div>

                  {/* テキスト表示 / 編集 */}
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: 4 }}>
                    入力テキスト
                  </label>
                  <textarea
                    value={voiceText + (interim ? ` ${interim}` : '')}
                    onChange={e => { setVoiceText(e.target.value); setInterim(''); setParsed(null); }}
                    placeholder="ここに音声テキストが入ります。手動入力も可。"
                    rows={3}
                    disabled={listening}
                    style={{
                      width: '100%', padding: '0.65rem 0.8rem',
                      border: '1px solid #E2DEF0', borderRadius: 10,
                      fontSize: '0.92rem', fontFamily: 'inherit',
                      resize: 'vertical', marginBottom: '0.7rem',
                      background: listening ? '#FAFAFA' : '#fff',
                    }}
                  />

                  {parseErr && (
                    <div style={{ padding: '0.55rem 0.75rem', background: '#FEE2E2', color: '#991B1B', borderRadius: 8, fontSize: '0.82rem', marginBottom: '0.7rem' }}>
                      {parseErr}
                    </div>
                  )}

                  {/* パース結果プレビュー */}
                  {parsed && (
                    <div style={{
                      padding: '0.85rem 1rem',
                      background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
                      border: '1px solid #93C5FD',
                      borderRadius: 12, marginBottom: '0.7rem',
                    }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                        <Calendar size={14} color="#1E40AF" />
                        <span style={{ fontSize: '0.75rem', color: '#1E40AF', fontWeight: 700 }}>
                          {new Date(parsed.scheduledAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', weekday: 'short' })}
                        </span>
                        <span style={{ fontSize: '0.7rem', background: '#1E40AF', color: '#fff', padding: '2px 7px', borderRadius: 999, fontWeight: 700 }}>
                          {KIND_LABEL[parsed.kind]}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: 4 }}>{parsed.title}</div>
                      <div style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.55 }}>{parsed.description}</div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    {!parsed ? (
                      <>
                        <button onClick={reset} style={btnSec}>
                          リセット
                        </button>
                        <button onClick={onParse} disabled={parsing || !voiceText.trim()} style={{ ...btnPri, opacity: parsing || !voiceText.trim() ? 0.6 : 1 }}>
                          {parsing ? <Loader2 size={14} className="prism-spin" /> : <Sparkles size={14} />}
                          {parsing ? 'AI 解析中…' : 'AI で予約内容を作る'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setParsed(null)} style={btnSec}>
                          編集に戻る
                        </button>
                        <button onClick={onConfirm} style={btnPri}>
                          <Check size={14} /> 予約を確定
                        </button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                /* キュー表示 */
                <div style={{ display: 'grid', gap: 8 }}>
                  {queue.tasks.length === 0 ? (
                    <div style={{
                      padding: '2rem 1rem', background: '#F9FAFB',
                      border: '1px dashed #E5E7EB', borderRadius: 12,
                      textAlign: 'center', color: '#6B7280',
                    }}>
                      <Calendar size={28} style={{ opacity: 0.4, marginBottom: 6 }} />
                      <div style={{ fontSize: '0.88rem' }}>予約タスクはまだありません</div>
                      <div style={{ fontSize: '0.74rem', marginTop: 4 }}>「新規予約」から音声入力してください</div>
                    </div>
                  ) : (
                    queue.tasks
                      .slice()
                      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
                      .map(t => {
                        const st = STATUS_META[t.status];
                        const when = new Date(t.scheduledAt);
                        return (
                          <div key={t.id} style={{
                            padding: '0.85rem 1rem',
                            background: '#fff',
                            border: '1px solid #E5E7EB',
                            borderRadius: 12,
                            display: 'grid', gap: 6,
                          }}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span>
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: '#F4F0FA', color: '#5A5366' }}>{KIND_LABEL[t.kind]}</span>
                              <span style={{ fontSize: '0.72rem', color: '#475569', display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                                <Clock size={11} />
                                {when.toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.92rem', fontWeight: 800 }}>{t.title}</div>
                            <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.55 }}>{t.description}</div>
                            {t.error && (
                              <div style={{ display: 'inline-flex', gap: 4, fontSize: '0.74rem', color: '#991B1B', padding: '4px 8px', background: '#FEE2E2', borderRadius: 6 }}>
                                <AlertCircle size={11} /> {t.error}
                              </div>
                            )}
                            {t.result && (
                              <details style={{ marginTop: 4 }}>
                                <summary style={{ cursor: 'pointer', fontSize: '0.78rem', color: '#0033A0', fontWeight: 700 }}>
                                  結果を表示 ({t.result.length} 字)
                                </summary>
                                <div style={{
                                  marginTop: 6, padding: '0.65rem 0.85rem',
                                  background: '#F9FAFB', borderRadius: 8,
                                  fontSize: '0.82rem', lineHeight: 1.65,
                                  whiteSpace: 'pre-wrap', maxHeight: 240, overflowY: 'auto',
                                }}>
                                  {t.result}
                                </div>
                                <button onClick={() => navigator.clipboard?.writeText(t.result || '')} style={{
                                  marginTop: 6, padding: '0.35rem 0.65rem',
                                  background: 'transparent', border: '1px solid #E5E7EB', borderRadius: 6,
                                  fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer',
                                  display: 'inline-flex', gap: 4, alignItems: 'center',
                                }}>
                                  <Copy size={11} /> 結果をコピー
                                </button>
                              </details>
                            )}
                            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                              {t.status === 'scheduled' && (
                                <button onClick={() => queue.cancel(t.id)} style={btnGhost}>
                                  キャンセル
                                </button>
                              )}
                              <button onClick={() => onDelete(t)} style={{ ...btnGhost, color: '#991B1B' }}>
                                <Trash2 size={11} /> 削除
                              </button>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              )}

              <style>{`
                @keyframes prism-mic-pulse {
                  0%, 100% { box-shadow: 0 0 0 6px rgba(225, 48, 108, 0.18), 0 8px 24px rgba(225, 48, 108, 0.32); }
                  50%       { box-shadow: 0 0 0 14px rgba(225, 48, 108, 0.08), 0 8px 24px rgba(225, 48, 108, 0.32); }
                }
                @keyframes prism-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
                .prism-spin { animation: prism-spin 0.9s linear infinite; }
              `}</style>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const btnPri: React.CSSProperties = {
  flex: 2, padding: '0.7rem',
  background: 'linear-gradient(135deg, #0033A0, #1A4FC4)',
  color: '#fff', border: 'none', borderRadius: 10,
  fontWeight: 800, fontSize: '0.92rem', cursor: 'pointer',
  display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center',
};
const btnSec: React.CSSProperties = {
  flex: 1, padding: '0.7rem',
  background: '#F4F0FA', color: '#1F1A2E',
  border: 'none', borderRadius: 10,
  fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  padding: '0.35rem 0.65rem',
  background: 'transparent', border: '1px solid #E5E7EB',
  borderRadius: 6, fontSize: '0.74rem', fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex', gap: 4, alignItems: 'center',
  color: '#475569',
};
function tabBtn(active: boolean): React.CSSProperties {
  return {
    flex: 1, padding: '0.55rem',
    background: active ? '#0033A0' : '#F4F0FA',
    color: active ? '#fff' : '#1F1A2E',
    border: 'none', borderRadius: 8,
    fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
    display: 'inline-flex', gap: 5, alignItems: 'center', justifyContent: 'center',
  };
}
