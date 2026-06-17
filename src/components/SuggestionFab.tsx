// ============================================================
// SuggestionFab — 左下 常駐「💡 改善提案」ボタン
//
// オーナー指示 (2026-06-04 第 14 波 DDD):
//   QuickAskFab (右下) と被らない左下に小さなボタン。タップで textarea +
//   「送る」で /api/feedback (kind=suggestion) に送信。
//
// 注: 既存の FeedbackWidget.tsx は NPS スコア式の重ためフォームなので残置。
//   こちらは「1-2 行で気軽に」用のミニ版。両者は別ファイルで共存。
//
// 動作:
//   - 送信成功 → 「ありがとう」 (1.5s) → 自動 close
//   - 送信失敗 → エラー表示 + リトライ可
//   - localStorage `core_suggestion_sent_count` を +1
// ============================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, X, Send, CheckCircle2 } from 'lucide-react';

type Phase = 'closed' | 'open' | 'sending' | 'done' | 'error';

function detectBrand(): 'prism' | 'iris' {
  if (typeof window === 'undefined') return 'prism';
  return window.location.pathname.startsWith('/iris') ? 'iris' : 'prism';
}

export default function SuggestionFab() {
  const [phase, setPhase] = useState<Phase>('closed');
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const open = () => { setPhase('open'); setErr(null); };
  const close = () => { setPhase('closed'); setText(''); setErr(null); };

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setPhase('sending');
    setErr(null);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: detectBrand(),
          kind: 'suggestion',
          comment: t,
          url: window.location.href,
          userAgent: navigator.userAgent,
          ts: Date.now(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      try {
        const cnt = Number(localStorage.getItem('core_suggestion_sent_count') || '0') + 1;
        localStorage.setItem('core_suggestion_sent_count', String(cnt));
      } catch { /* */ }
      // CORE Credits: 初回フィードバックで +50
      try {
        const { earnOnce } = await import('../lib/coreCredits');
        earnOnce('feedback_first', 'フィードバックを送る', 50);
      } catch { /* クレジット付与失敗は送信成功を妨げない */ }
      setPhase('done');
      setTimeout(close, 1600);
    } catch (e) {
      setErr((e as Error)?.message || 'ネットワークエラー');
      setPhase('error');
    }
  };

  return (
    <>
      <AnimatePresence>
        {phase === 'closed' && (
          <motion.button
            key="open"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={open}
            aria-label="改善提案を送る"
            data-tour-id="suggestion-fab"
            className="cp-fab-iconize"
            style={{
              position: 'fixed',
              left: 'calc(env(safe-area-inset-left, 0px) + 12px)',
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
              // モーダル (z=50) より下 — モーダルが開いてる時は背景に隠れる
              zIndex: 40,
              padding: '10px 14px',
              borderRadius: 999,
              background: 'rgba(15, 14, 27, 0.88)',
              color: '#fde68a',
              border: '1px solid rgba(251,191,36,0.4)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Lightbulb size={14} />
            <span className="cp-fab-label">改善提案</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase !== 'closed' && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.22 }}
            style={{
              position: 'fixed',
              left: 'calc(env(safe-area-inset-left, 0px) + 12px)',
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
              zIndex: 70,
              width: 'min(340px, calc(100vw - 24px))',
              padding: '14px 14px 12px',
              borderRadius: 18,
              background: 'rgba(15, 14, 27, 0.96)',
              border: '1px solid rgba(251,191,36,0.35)',
              boxShadow: '0 18px 40px rgba(0,0,0,0.5)',
              color: '#fff',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <button
              aria-label="閉じる"
              onClick={close}
              style={{
                position: 'absolute', top: 8, right: 8,
                width: 28, height: 28, borderRadius: 14,
                background: 'rgba(255,255,255,0.08)', border: 'none',
                color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={13} />
            </button>

            {phase === 'done' ? (
              <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
                <CheckCircle2 size={36} color="#fbbf24" />
                <div style={{ marginTop: 8, fontWeight: 800, fontSize: '0.95rem' }}>ありがとうございました!</div>
                <div style={{ marginTop: 4, fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>あなたの一言が次のリリースを変えます。</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Lightbulb size={16} color="#fbbf24" />
                  <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>改善提案を送る</div>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', marginBottom: 8, lineHeight: 1.5 }}>
                  使いにくい所、足りない機能、何でも 1〜2 行で。
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="例: モバイルで CXO ピルが見切れる"
                  rows={3}
                  disabled={phase === 'sending'}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    padding: '8px 10px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
                {err && (
                  <div style={{ marginTop: 6, fontSize: '0.7rem', color: '#fda4af' }}>
                    送信に失敗しました ({err})。もう一度試してください。
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button
                    onClick={close}
                    disabled={phase === 'sending'}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      borderRadius: 10,
                      background: 'transparent',
                      color: 'rgba(255,255,255,0.7)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    あとで
                  </button>
                  <button
                    onClick={send}
                    disabled={phase === 'sending' || !text.trim()}
                    style={{
                      flex: 2,
                      padding: '8px 0',
                      borderRadius: 10,
                      background: phase === 'sending' || !text.trim()
                        ? 'rgba(251,191,36,0.4)'
                        : 'linear-gradient(135deg, #fbbf24, #f97316)',
                      color: '#1a1a2e',
                      border: 'none',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      cursor: phase === 'sending' || !text.trim() ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    <Send size={12} />
                    {phase === 'sending' ? '送信中…' : '送る'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
