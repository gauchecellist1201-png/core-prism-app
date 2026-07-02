// ============================================================
// CORE Prism ▸ 音声タスク予約 (フローティング UI)
// マイク → 音声認識 → AI パース → 予約 → 自動実行 → 通知
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Sparkles, X, Calendar, Check, Clock, Loader2, Trash2, AlertCircle, Copy, ListChecks, History, RefreshCw, Pencil, Zap } from 'lucide-react';
import { usePrismTaskQueue, parseVoiceCommand, type PrismTask, type TaskKind } from './usePrismTaskQueue';
import { confirmAction } from '../lib/confirmDialog';

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

type QuickTimeKey = 'now' | '1h' | 'morning' | 'custom' | null;

// 「いつ実行する?」 チップ から ISO 文字列を作る
function quickTimeToISO(key: Exclude<QuickTimeKey, null | 'custom'>, now = new Date()): string {
  const d = new Date(now);
  if (key === 'now') {
    d.setSeconds(d.getSeconds() + 30);
    return d.toISOString();
  }
  if (key === '1h') {
    d.setHours(d.getHours() + 1);
    return d.toISOString();
  }
  // 'morning' = 翌朝 9:00 (既に 9 時前なら今日の 9:00)
  const m = new Date(now);
  if (m.getHours() < 9) {
    m.setHours(9, 0, 0, 0);
  } else {
    m.setDate(m.getDate() + 1);
    m.setHours(9, 0, 0, 0);
  }
  return m.toISOString();
}

// datetime-local input の value にする (YYYY-MM-DDTHH:mm, ローカル時刻)
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(s: string): string {
  // ローカル時刻として解釈 → ISO
  return new Date(s).toISOString();
}

// 音声認識のエラーコードを「やさしい日本語 + 次の一手」に翻訳。
// 黙って失敗させず、必ず原因と直し方を本人に伝える（GlobalVoiceInput と同じ思想）。
function friendlyVoiceError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'マイクの使用がオフになっています。アドレスバー横の🔒からマイクを「許可」にして、もう一度お試しください。';
    case 'audio-capture':
      return 'マイクが見つかりませんでした。マイクの接続を確かめて、もう一度お試しください。';
    case 'network':
      return '通信が不安定で聞き取れませんでした。電波のよい場所でもう一度お試しください。';
    default:
      return 'うまく聞き取れませんでした。もう一度ゆっくり話してみてください。';
  }
}

export default function PrismTaskScheduler() {
  const queue = usePrismTaskQueue();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'compose' | 'queue' | 'history'>('compose');

  // 音声録音
  const [listening, setListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [interim, setInterim] = useState('');
  const recogRef = useRef<any>(null);
  const gotResultRef = useRef(false);

  // 「いつ実行する?」 クイックチップ
  const [quickKey, setQuickKey] = useState<QuickTimeKey>(null);
  const [customAt, setCustomAt] = useState<string>(() => {
    // 初期値は 30 分後
    const d = new Date(Date.now() + 30 * 60_000);
    return toLocalInputValue(d.toISOString());
  });

  // パース / 確認
  const [parsing, setParsing] = useState(false);
  const [parseErr, setParseErr] = useState<string>('');
  // 失敗時に「もう一度試す」復旧ボタンを出すためのアクション（null なら復旧ボタンなし）
  const [errAction, setErrAction] = useState<{ label: string; run: () => void } | null>(null);
  const [parsed, setParsed] = useState<null | {
    scheduledAt: string; kind: TaskKind; title: string; description: string; prompt: string;
  }>(null);

  // 完了通知 (アプリ内バッジ)
  const [unseenDone, setUnseenDone] = useState(0);
  useEffect(() => {
    setUnseenDone(queue.tasks.filter(t => t.status === 'done' && !t.notified).length);
  }, [queue.tasks]);

  // モーダルを開いた瞬間にバッジを既読化 (履歴で確認できるため通知バッジは情報過多になる)
  useEffect(() => {
    if (open && unseenDone > 0) {
      // 履歴を見ているときだけ既読化 (compose のままだとユーザーは結果を見ていないので残す)
      if (view === 'history') queue.markAllSeen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view]);

  // モバイル時の Speech Recognition (Web Speech API)
  const startListening = () => {
    setVoiceText('');
    setInterim('');
    setParseErr('');
    setErrAction(null);
    setParsed(null);
    gotResultRef.current = false;

    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      // 非対応ブラウザでは復旧ボタンを出さず、テキスト入力へ誘導（録り直しても無駄なため）
      setParseErr('このブラウザは音声入力に対応していません。下のテキスト欄に直接入力してください。(Chrome / Safari / Edge 推奨)');
      setErrAction(null);
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
      if (finalT || interimT) gotResultRef.current = true;
      setVoiceText(prev => prev + finalT);
      setInterim(interimT);
    };
    rec.onerror = (e: any) => {
      setListening(false);
      const code = e?.error || 'unknown';
      // 自分で止めた(aborted) / 一瞬の無音(no-speech) は「失敗」ではないので赤く出さない
      if (code === 'aborted') return;
      if (code === 'no-speech') {
        setParseErr('声が聞き取れませんでした。マイクに少し近づいて、もう一度お試しください。');
        setErrAction({ label: 'もう一度話す', run: startListening });
        return;
      }
      gotResultRef.current = true; // onend での二重表示を防ぐ
      setParseErr(friendlyVoiceError(code));
      setErrAction({ label: 'もう一度話す', run: startListening });
    };
    rec.onend = () => {
      setListening(false);
      // 何も拾えずに終わった時も黙らせず、すぐ録り直せる導線を出す
      if (!gotResultRef.current) {
        setParseErr('声が聞き取れませんでした。もう一度ボタンを押して話してみてください。');
        setErrAction({ label: 'もう一度話す', run: startListening });
      }
    };
    recogRef.current = rec;
    // iOS Safari 等で start() が例外を投げても黙って固まらないよう保護
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
      setParseErr('マイクを起動できませんでした。もう一度ボタンを押すか、下のテキスト欄に入力してください。');
      setErrAction({ label: 'もう一度試す', run: startListening });
    }
  };

  const stopListening = () => {
    try { recogRef.current?.stop(); } catch {/* */}
    setListening(false);
  };

  const onParse = async () => {
    const text = (voiceText + interim).trim();
    if (!text) {
      setParseErr('まだ何も入力されていません。マイクで話すか、テキスト欄に予定を書いてください。');
      setErrAction({ label: 'マイクで話す', run: startListening });
      return;
    }
    setParsing(true); setParseErr(''); setErrAction(null);
    try {
      const j = await parseVoiceCommand(text);
      setParsed(j);
    } catch (e: any) {
      // parseVoiceCommand は内部でフォールバックするので通常ここに来ない
      setParseErr(e?.message || 'うまく解析できませんでした。時刻と内容を直接入力してから、もう一度お試しください。');
      setErrAction({ label: 'もう一度解析', run: onParse });
    } finally {
      setParsing(false);
    }
  };

  // クイックチップで上書きされた時刻があれば優先
  const effectiveScheduledAt = (): string | null => {
    if (!quickKey) return parsed?.scheduledAt || null;
    if (quickKey === 'custom') {
      try { return fromLocalInputValue(customAt); } catch { return parsed?.scheduledAt || null; }
    }
    return quickTimeToISO(quickKey);
  };

  const onConfirm = () => {
    if (!parsed) return;
    const rawText = (voiceText + interim).trim();
    const when = effectiveScheduledAt() || parsed.scheduledAt;
    queue.add({
      scheduledAt: when,
      kind: parsed.kind,
      rawInput: rawText,
      title: parsed.title,
      description: parsed.description,
      prompt: parsed.prompt,
    });
    queue.requestPermission();
    // リセット
    setVoiceText(''); setInterim(''); setParsed(null);
    setQuickKey(null);
    setView('queue');
  };

  const reset = () => {
    if (listening) stopListening();
    setVoiceText(''); setInterim(''); setParsed(null); setParseErr(''); setErrAction(null);
    setQuickKey(null);
  };

  // 「もう一度試す」(失敗 or 完了から)
  const onRetry = (t: PrismTask) => {
    queue.retry(t.id, 5);
    setView('queue');
  };

  // 「編集して再投入」(失敗 or 履歴から)
  const onEditAndReuse = (t: PrismTask) => {
    setVoiceText(t.rawInput || t.description || t.title);
    setInterim('');
    setParsed(null);
    setParseErr('');
    setErrAction(null);
    setQuickKey(null);
    setView('compose');
  };

  // タスク削除確認
  const onDelete = async (t: PrismTask) => {
    if (await confirmAction({ title: `「${t.title}」を削除しますか?`, tone: 'danger' })) queue.remove(t.id);
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
              {(() => {
                const activeCount = queue.tasks.filter(t => t.status === 'scheduled' || t.status === 'running').length;
                const historyCount = queue.tasks.filter(t => t.status === 'done' || t.status === 'failed' || t.status === 'cancelled').length;
                return (
                  <div style={{ display: 'flex', gap: 6, marginBottom: '0.85rem' }}>
                    <button onClick={() => setView('compose')} style={tabBtn(view === 'compose')}>
                      <Sparkles size={13} /> 新規予約
                    </button>
                    <button onClick={() => setView('queue')} style={tabBtn(view === 'queue')}>
                      <ListChecks size={13} /> 予約中
                      {activeCount > 0 && (
                        <span style={{ background: '#0033A0', color: '#fff', borderRadius: 999, padding: '1px 6px', fontSize: 10, fontWeight: 800, marginLeft: 4 }}>
                          {activeCount}
                        </span>
                      )}
                    </button>
                    <button onClick={() => setView('history')} style={tabBtn(view === 'history')}>
                      <History size={13} /> 履歴
                      {historyCount > 0 && (
                        <span style={{ background: view === 'history' ? '#fff' : '#5A5366', color: view === 'history' ? '#0033A0' : '#fff', borderRadius: 999, padding: '1px 6px', fontSize: 10, fontWeight: 800, marginLeft: 4 }}>
                          {historyCount}
                        </span>
                      )}
                      {unseenDone > 0 && view !== 'history' && (
                        <span style={{ width: 7, height: 7, borderRadius: 999, background: '#E84B97', marginLeft: 4 }} />
                      )}
                    </button>
                  </div>
                );
              })()}

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

                  {/* テキスト表示 / 編集 (録音中も編集可。誤認識を即修正できる) */}
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', fontWeight: 700, marginBottom: 4 }}>
                    <span>入力テキスト <span style={{ color: '#6B7280', fontWeight: 500, fontSize: '0.72rem' }}>(誤認識はここで直してください)</span></span>
                    {(voiceText || interim) && (
                      <button onClick={() => { setVoiceText(''); setInterim(''); setParsed(null); }} style={{
                        background: 'transparent', border: 'none', color: '#6B7280',
                        fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'underline',
                      }}>クリア</button>
                    )}
                  </label>
                  <textarea
                    value={voiceText + (interim ? ` ${interim}` : '')}
                    onChange={e => { setVoiceText(e.target.value); setInterim(''); setParsed(null); }}
                    placeholder="ここに音声テキストが入ります。手動入力も可。"
                    rows={3}
                    style={{
                      width: '100%', padding: '0.65rem 0.8rem',
                      border: '1px solid #E2DEF0', borderRadius: 10,
                      fontSize: '0.92rem', fontFamily: 'inherit',
                      resize: 'vertical', marginBottom: '0.7rem',
                      background: '#fff',
                    }}
                  />

                  {/* 「いつ実行する?」 チップ — 入力が入ったら表示 */}
                  {(voiceText.trim() || interim.trim()) && (
                    <div style={{ marginBottom: '0.7rem' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Clock size={12} /> いつ実行する?
                        <span style={{ color: '#6B7280', fontWeight: 500, fontSize: '0.72rem' }}>(未選択なら AI が自動推定)</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {([
                          { key: 'now' as const, icon: <Zap size={11} />, label: '今すぐ' },
                          { key: '1h' as const, icon: <Clock size={11} />, label: '1時間後' },
                          { key: 'morning' as const, icon: <Calendar size={11} />, label: '明朝 9時' },
                          { key: 'custom' as const, icon: <Pencil size={11} />, label: '指定' },
                        ] as const).map(c => (
                          <button
                            key={c.key}
                            type="button"
                            onClick={() => setQuickKey(prev => prev === c.key ? null : c.key)}
                            style={chipBtn(quickKey === c.key)}
                          >
                            {c.icon} {c.label}
                            {quickKey === c.key && c.key !== 'custom' && (
                              <span style={{ fontSize: 10, opacity: 0.85, marginLeft: 4 }}>
                                ({new Date(quickTimeToISO(c.key)).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })})
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                      {quickKey === 'custom' && (
                        <input
                          type="datetime-local"
                          value={customAt}
                          onChange={e => setCustomAt(e.target.value)}
                          style={{
                            marginTop: 7,
                            padding: '0.45rem 0.7rem',
                            border: '1px solid #93C5FD', borderRadius: 8,
                            fontSize: '0.88rem', fontFamily: 'inherit',
                          }}
                        />
                      )}
                    </div>
                  )}

                  {parseErr && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '0.6rem 0.75rem', background: '#FEE2E2', color: '#991B1B',
                      borderRadius: 8, fontSize: '0.82rem', lineHeight: 1.5, marginBottom: '0.7rem',
                    }}>
                      <span style={{ flex: 1 }}>{parseErr}</span>
                      {errAction && (
                        <button
                          type="button"
                          onClick={() => { setParseErr(''); const r = errAction.run; setErrAction(null); r(); }}
                          style={{
                            flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '6px 11px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            fontSize: '0.78rem', fontWeight: 700, color: '#fff',
                            background: 'linear-gradient(135deg, #DC2626, #B91C1C)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <RefreshCw size={13} /> {errAction.label}
                        </button>
                      )}
                    </div>
                  )}

                  {/* パース結果プレビュー (チップで上書きあれば優先) */}
                  {parsed && (() => {
                    const effective = effectiveScheduledAt() || parsed.scheduledAt;
                    const overridden = quickKey !== null && effective !== parsed.scheduledAt;
                    return (
                      <div style={{
                        padding: '0.85rem 1rem',
                        background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
                        border: '1px solid #93C5FD',
                        borderRadius: 12, marginBottom: '0.7rem',
                      }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                          <Calendar size={14} color="#1E40AF" />
                          <span style={{ fontSize: '0.75rem', color: '#1E40AF', fontWeight: 700 }}>
                            {new Date(effective).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', weekday: 'short' })}
                          </span>
                          {overridden && (
                            <span style={{ fontSize: '0.65rem', color: '#9A3412', background: '#FFEDD5', padding: '1px 6px', borderRadius: 999, fontWeight: 700 }}>
                              チップで上書き
                            </span>
                          )}
                          <span style={{ fontSize: '0.7rem', background: '#1E40AF', color: '#fff', padding: '2px 7px', borderRadius: 999, fontWeight: 700 }}>
                            {KIND_LABEL[parsed.kind]}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: 4 }}>{parsed.title}</div>
                        <div style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.55 }}>{parsed.description}</div>
                      </div>
                    );
                  })()}

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
              ) : view === 'queue' ? (
                /* 予約中 (scheduled / running のみ) */
                (() => {
                  const active = queue.tasks.filter(t => t.status === 'scheduled' || t.status === 'running');
                  if (active.length === 0) {
                    return (
                      <div style={{
                        padding: '2rem 1rem', background: '#F9FAFB',
                        border: '1px dashed #E5E7EB', borderRadius: 12,
                        textAlign: 'center', color: '#6B7280',
                      }}>
                        <Calendar size={28} style={{ opacity: 0.4, marginBottom: 6 }} />
                        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#374151' }}>予約中のタスクはありません</div>
                        <div style={{ fontSize: '0.78rem', marginTop: 4, lineHeight: 1.7 }}>音声で話すだけで、Prismが予定の時刻に下書きを用意します。</div>
                        <button
                          type="button"
                          onClick={() => setView('compose')}
                          style={{
                            marginTop: 14, minHeight: 44, padding: '0 1.3rem',
                            display: 'inline-flex', alignItems: 'center', gap: 7,
                            background: 'linear-gradient(135deg,#3B5BFF,#0033A0)', color: '#fff',
                            border: 'none', borderRadius: 999, fontSize: '0.85rem', fontWeight: 700,
                            cursor: 'pointer', boxShadow: '0 6px 16px rgba(0,51,160,0.28)',
                          }}
                        >
                          <Sparkles size={15} /> 最初の予約をつくる
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {active
                        .slice()
                        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
                        .map(t => renderTaskCard(t, queue, onDelete, onRetry, onEditAndReuse))}
                    </div>
                  );
                })()
              ) : (
                /* 履歴 (done / failed / cancelled) */
                (() => {
                  const history = queue.tasks
                    .filter(t => t.status === 'done' || t.status === 'failed' || t.status === 'cancelled')
                    .slice()
                    .sort((a, b) => {
                      const aT = a.resultGeneratedAt || a.scheduledAt;
                      const bT = b.resultGeneratedAt || b.scheduledAt;
                      return bT.localeCompare(aT); // 新しい順
                    });
                  if (history.length === 0) {
                    return (
                      <div style={{
                        padding: '2rem 1rem', background: '#F9FAFB',
                        border: '1px dashed #E5E7EB', borderRadius: 12,
                        textAlign: 'center', color: '#6B7280',
                      }}>
                        <History size={28} style={{ opacity: 0.4, marginBottom: 6 }} />
                        <div style={{ fontSize: '0.88rem' }}>履歴はまだありません</div>
                        <div style={{ fontSize: '0.74rem', marginTop: 4 }}>完了・失敗・キャンセルしたタスクがここに残ります</div>
                      </div>
                    );
                  }
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: '0.74rem', color: '#6B7280' }}>新しい順 · {history.length} 件</span>
                        <button
                          onClick={async () => {
                            const ok = await confirmAction({
                              title: '履歴を全て削除しますか?',
                              body: '完了・失敗・キャンセルになった分のみが対象です。',
                              tone: 'danger',
                              okLabel: '全て削除',
                            });
                            if (ok) history.forEach(t => queue.remove(t.id));
                          }}
                          style={{ ...btnGhost, color: '#991B1B', fontSize: '0.72rem' }}
                        >
                          <Trash2 size={10} /> 履歴を全て消す
                        </button>
                      </div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {history.map(t => renderTaskCard(t, queue, onDelete, onRetry, onEditAndReuse))}
                      </div>
                    </>
                  );
                })()
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

function chipBtn(active: boolean): React.CSSProperties {
  return {
    padding: '0.4rem 0.7rem',
    background: active ? 'linear-gradient(135deg, #0033A0, #1A4FC4)' : '#fff',
    color: active ? '#fff' : '#1F1A2E',
    border: active ? '1px solid transparent' : '1px solid #E2DEF0',
    borderRadius: 999,
    fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
    display: 'inline-flex', gap: 4, alignItems: 'center',
    fontFamily: 'inherit',
    boxShadow: active ? '0 4px 12px rgba(0,51,160,0.28)' : 'none',
    transition: 'all 0.15s',
  };
}

// タスクカード共通レンダラ (予約中 / 履歴 で共有)
function renderTaskCard(
  t: PrismTask,
  queue: ReturnType<typeof usePrismTaskQueue>,
  onDelete: (t: PrismTask) => void,
  onRetry: (t: PrismTask) => void,
  onEditAndReuse: (t: PrismTask) => void,
) {
  const st = STATUS_META[t.status];
  const when = new Date(t.scheduledAt);
  return (
    <div key={t.id} style={{
      padding: '0.85rem 1rem',
      background: '#fff',
      border: `1px solid ${t.status === 'failed' ? '#FCA5A5' : '#E5E7EB'}`,
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
        {t.resultGeneratedAt && t.status === 'done' && (
          <span style={{ fontSize: '0.68rem', color: '#065F46' }}>
            完了 {new Date(t.resultGeneratedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      <div style={{ fontSize: '0.92rem', fontWeight: 800 }}>{t.title}</div>
      <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.55 }}>{t.description}</div>
      {t.error && (
        <div style={{ display: 'inline-flex', gap: 4, fontSize: '0.74rem', color: '#991B1B', padding: '4px 8px', background: '#FEE2E2', borderRadius: 6 }}>
          <AlertCircle size={11} /> {t.error}
        </div>
      )}
      {t.result && (
        <details style={{ marginTop: 4 }} open={t.status === 'done' && !t.notified}>
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
      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
        {/* 失敗 → 復旧導線をハイライトして必ず提示 */}
        {t.status === 'failed' && (
          <>
            <button
              onClick={() => onRetry(t)}
              style={{
                padding: '0.4rem 0.85rem',
                background: 'linear-gradient(135deg, #0033A0, #1A4FC4)',
                color: '#fff', border: 'none', borderRadius: 999,
                fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer',
                display: 'inline-flex', gap: 4, alignItems: 'center',
                boxShadow: '0 4px 12px rgba(0,51,160,0.25)',
              }}
            >
              <RefreshCw size={11} /> もう一度試す
            </button>
            <button
              onClick={() => onEditAndReuse(t)}
              style={{
                padding: '0.4rem 0.85rem',
                background: '#fff', color: '#0033A0',
                border: '1px solid #0033A0', borderRadius: 999,
                fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                display: 'inline-flex', gap: 4, alignItems: 'center',
              }}
            >
              <Pencil size={11} /> 編集する
            </button>
          </>
        )}
        {/* 完了 / キャンセル → 「もう一度」だけ薄めに提示 */}
        {(t.status === 'done' || t.status === 'cancelled') && (
          <button
            onClick={() => onEditAndReuse(t)}
            style={{ ...btnGhost, color: '#0033A0', borderColor: '#C7D2FE' }}
          >
            <RefreshCw size={11} /> もう一度予約
          </button>
        )}
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
}
