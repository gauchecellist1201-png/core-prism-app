// ============================================================
// BottomChatDock — Claude Code 風の「下部チャットバー」。
// 右サイドの AISidebar とは別に、画面下中央に常時表示する分かりやすい入口。
// 既存のチャット状態 (messages / onSend / isLoading) をそのまま共有する。
// ・折りたたみ時: 1 本の入力バー（どこからでもすぐ聞ける）
// ・展開時: 上方向に会話スレッドが開く（送信すると自動展開）
// モバイル最優先: full-width / safe-area / 16px入力(自動ズーム防止) / タップ44px。
// ============================================================
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatMessage } from '../types/identity';
import { readableTextColor } from '../lib/contrast';

interface Props {
  /** アクセント色（persona.accentColor）。 */
  accent: string;
  /** 表示名（例: 人格名）。プレースホルダ等に使う。 */
  name: string;
  messages: ChatMessage[];
  onSend: (msg: string) => Promise<void> | void;
  isLoading: boolean;
}

const MINIMIZED_KEY = 'prism-chat-dock-minimized';

export default function BottomChatDock({ accent, name, messages, onSend, isLoading }: Props) {
  const [input, setInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  // 「待機」状態: 帯だけ残して下の画面を広く見せる。次回訪問時も記憶。
  const [minimized, setMinimized] = useState(() => {
    try { return localStorage.getItem(MINIMIZED_KEY) === '1'; } catch { return false; }
  });
  const taRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem(MINIMIZED_KEY, minimized ? '1' : '0'); } catch { /* noop */ }
  }, [minimized]);

  // 送信や新着で会話末尾へスクロール
  useEffect(() => {
    if (expanded) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, expanded]);

  // メッセージが付いたら自動で開く（初回送信の手応え）
  useEffect(() => {
    if (messages.length > 0) setExpanded(true);
  }, [messages.length]);

  const submit = async () => {
    const msg = input.trim();
    if (!msg || isLoading) return;
    setInput('');
    setExpanded(true);
    await onSend(msg);
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const hasMsgs = messages.length > 0;

  // 待機状態: 帯だけ残し、下のコンテンツが見えるスペースを確保する。
  if (minimized) {
    return (
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 'max(12px, env(safe-area-inset-bottom))',
          paddingLeft: 12,
          paddingRight: 84,
          display: 'flex',
          justifyContent: 'center',
          zIndex: 46,
          pointerEvents: 'none',
        }}
      >
        <motion.button
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          onClick={() => setMinimized(false)}
          aria-label={`${name} のチャットを開く`}
          style={{
            pointerEvents: 'auto',
            height: 44,
            padding: '0 18px',
            borderRadius: 999,
            border: `1px solid ${accent}55`,
            background: 'rgba(16,16,28,0.94)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            boxShadow: '0 10px 34px rgba(0,0,0,0.45)',
            color: 'var(--fg-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: 999, background: accent, boxShadow: `0 0 8px ${accent}`, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>{name} に聞く</span>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 8l3.5-3.5L10 8" /></svg>
        </motion.button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 'max(12px, env(safe-area-inset-bottom))',
        // 右下の常駐FAB群（役員日報/音声/アシスタント）と重ならないよう右側を空ける
        paddingLeft: 12,
        paddingRight: 84,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 46,
        pointerEvents: 'none',
      }}
    >
      <div style={{ width: '100%', maxWidth: 720 }}>
      {/* 会話スレッド（展開時のみ） */}
      <AnimatePresence>
        {expanded && hasMsgs && (
          <motion.div
            initial={{ opacity: 0, y: 12, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 12, height: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            style={{
              pointerEvents: 'auto',
              marginBottom: 8,
              maxHeight: '52vh',
              overflowY: 'auto',
              background: 'rgba(12,12,22,0.92)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 16,
              padding: '12px 12px 10px',
              boxShadow: '0 18px 50px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: accent, letterSpacing: '0.04em' }}>
                AI チャット · {name}
              </span>
              <button
                onClick={() => setExpanded(false)}
                aria-label="閉じる"
                style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 5l3.5 3.5L10 5" /></svg>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div
                    style={{
                      maxWidth: '86%',
                      padding: '8px 12px',
                      borderRadius: 14,
                      fontSize: 14,
                      lineHeight: 1.65,
                      whiteSpace: 'pre-wrap',
                      background: m.role === 'user' ? accent : 'var(--surface-3)',
                      color: m.role === 'user' ? readableTextColor(accent) : 'var(--fg)',
                      border: m.role === 'user' ? `1px solid ${accent}` : '1px solid var(--border)',
                    }}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ padding: '8px 12px', borderRadius: 14, background: 'var(--surface-3)', border: '1px solid var(--border)', display: 'flex', gap: 5, alignItems: 'center' }}>
                    {[0, 1, 2].map(d => (
                      <motion.span
                        key={d}
                        style={{ width: 6, height: 6, borderRadius: 999, background: accent, display: 'inline-block' }}
                        animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
                      />
                    ))}
                    <span style={{ fontSize: 12, color: 'var(--fg-muted)', marginLeft: 4 }}>{name} の AI が考えています</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 入力バー（常時表示） */}
      <div
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 8,
          padding: '8px 10px 8px 14px',
          background: 'rgba(16,16,28,0.94)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: `1px solid ${accent}55`,
          borderRadius: 16,
          boxShadow: `0 10px 34px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)`,
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: 999, background: accent, boxShadow: `0 0 10px ${accent}`, flexShrink: 0, marginBottom: 12 }} />
        <button
          onClick={() => setMinimized(true)}
          aria-label="チャットを待機（畳む）"
          title="チャットを待機（畳む）"
          style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 5.5l4 4 4-4" /></svg>
        </button>
        <textarea
          ref={taRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => { if (hasMsgs) setExpanded(true); }}
          rows={1}
          placeholder={`${name} に聞く… (Enterで送信)`}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'none',
            color: 'var(--fg)',
            fontSize: 16, // 16px=iOS自動ズーム防止
            lineHeight: 1.5,
            maxHeight: 120,
            minHeight: 24,
            paddingTop: 6,
            paddingBottom: 6,
          }}
        />
        {hasMsgs && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            aria-label="会話を開く"
            style={{ height: 44, minWidth: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 9l3.5-3.5L11 9" /></svg>
          </button>
        )}
        <button
          onClick={submit}
          disabled={!input.trim() || isLoading}
          aria-label="送信"
          style={{
            height: 44,
            minWidth: 44,
            borderRadius: 12,
            border: 'none',
            cursor: input.trim() && !isLoading ? 'pointer' : 'default',
            background: input.trim() && !isLoading ? accent : 'var(--surface-3)',
            color: input.trim() && !isLoading ? readableTextColor(accent) : 'var(--fg-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
        >
          {isLoading ? (
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="cp-phase-spin"><path d="M12.5 7.5a5 5 0 1 1-5-5" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 9l7-7M14 2l-4.5 12-2.5-5-5-2.5L14 2z" /></svg>
          )}
        </button>
      </div>
      </div>
    </div>
  );
}
