// ============================================================
// FeedbackWidget — 右下に浮かぶ「💌 フィードバック」ボタン + モーダル
// ベータ初日 (2026-05-13) のためのユーザーフィードバック収集
// ============================================================
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail } from 'lucide-react';
import { submitFeedback } from '../lib/feedback';

interface Props {
  brand: 'prism' | 'iris';
}

export default function FeedbackWidget({ brand }: Props) {
  const [open, setOpen] = useState(false);
  const [nps, setNps] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const accent = brand === 'iris' ? '#E1306C' : '#0033A0';
  const accentLight = brand === 'iris' ? '#F472B6' : '#1A4FC4';

  const reset = () => {
    setNps(null);
    setComment('');
    setEmail('');
    setDone(false);
    setSubmitting(false);
  };

  const close = () => {
    setOpen(false);
    setTimeout(reset, 300);
  };

  const handleSubmit = async () => {
    if (nps === null) return;
    setSubmitting(true);
    try {
      await submitFeedback({
        brand,
        nps,
        comment,
        email,
      });
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating button — 左下に配置 (右下は AI と話すボタンが占有) */}
      <button
        type="button"
        aria-label="フィードバックを送る"
        onClick={() => setOpen(true)}
        className="cp-feedback-fab"
        style={{
          position: 'fixed',
          left: 'max(16px, env(safe-area-inset-left))',
          bottom: 'max(16px, env(safe-area-inset-bottom))',
          zIndex: 9998,
          background: `linear-gradient(135deg, ${accent}, ${accentLight})`,
          color: '#fff',
          border: 'none',
          borderRadius: 999,
          padding: '10px 14px',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 0.2,
          cursor: 'pointer',
          boxShadow: '0 6px 24px rgba(0,0,0,0.22)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          maxWidth: 'calc(100vw - 32px)',
        }}
      >
        <Mail size={16} strokeWidth={2.25} aria-hidden />
        <span>フィードバック</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="fb-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={close}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 12, 30, 0.55)',
              backdropFilter: 'blur(6px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <motion.div
              key="fb-modal"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 460,
                background: '#fff',
                color: '#1F1A2E',
                borderRadius: 20,
                padding: '24px 22px 22px',
                boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
                maxHeight: 'calc(100dvh - 32px)',
                overflowY: 'auto',
              }}
            >
              {done ? (
                <div style={{ textAlign: 'center', padding: '24px 8px 8px' }}>
                  <div style={{ fontSize: 42, marginBottom: 12 }}>🙏</div>
                  <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>
                    ありがとうございました
                  </h3>
                  <p style={{ margin: '0 0 20px', fontSize: 14, color: '#5A5366', lineHeight: 1.7 }}>
                    いただいたフィードバックを開発に活かします。<br />
                    ベータ期間中もどんどんお寄せください。
                  </p>
                  <button
                    type="button"
                    onClick={close}
                    style={{
                      background: `linear-gradient(135deg, ${accent}, ${accentLight})`,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 999,
                      padding: '12px 28px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    閉じる
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, letterSpacing: -0.2 }}>
                        使ってどうだった?
                      </h3>
                      <p style={{ margin: 0, fontSize: 12, color: '#8A8593' }}>
                        ベータ初日のあなたの声で {brand === 'iris' ? 'Iris' : 'Prism'} は進化します
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="閉じる"
                      onClick={close}
                      style={{
                        background: 'transparent', border: 'none', fontSize: 20,
                        color: '#8A8593', cursor: 'pointer', padding: 4, lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>

                  {/* NPS 0-10 */}
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                    1. 知人に勧める可能性は? <span style={{ color: '#C0392B' }}>*</span>
                  </label>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(11, 1fr)',
                    gap: 4,
                    marginBottom: 6,
                  }}>
                    {Array.from({ length: 11 }, (_, i) => i).map(n => {
                      const sel = nps === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setNps(n)}
                          style={{
                            padding: '8px 0',
                            fontSize: 13,
                            fontWeight: 700,
                            border: sel ? `2px solid ${accent}` : '1px solid #E2DEF0',
                            background: sel ? accent : '#fff',
                            color: sel ? '#fff' : '#1F1A2E',
                            borderRadius: 8,
                            cursor: 'pointer',
                          }}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8A8593', marginBottom: 16 }}>
                    <span>勧めない</span>
                    <span>絶対に勧める</span>
                  </div>

                  {/* Free comment */}
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                    2. 改善してほしい点・嬉しかった点
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="例: 〇〇の機能が分かりにくかった / △△で助かった"
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #E2DEF0',
                      borderRadius: 10,
                      fontSize: 16,
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      marginBottom: 16,
                      boxSizing: 'border-box',
                    }}
                  />

                  {/* Email optional */}
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                    3. 返信を希望するメール (任意)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #E2DEF0',
                      borderRadius: 10,
                      fontSize: 16,
                      marginBottom: 20,
                      boxSizing: 'border-box',
                    }}
                  />

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={nps === null || submitting}
                    style={{
                      width: '100%',
                      background: nps === null ? '#C4C0D0' : `linear-gradient(135deg, ${accent}, ${accentLight})`,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 999,
                      padding: '14px',
                      fontSize: 15,
                      fontWeight: 800,
                      cursor: nps === null || submitting ? 'not-allowed' : 'pointer',
                      boxShadow: nps === null ? 'none' : '0 6px 20px rgba(0,0,0,0.16)',
                    }}
                  >
                    {submitting ? '送信中…' : '送信する'}
                  </button>
                  <p style={{ margin: '12px 0 0', fontSize: 11, color: '#8A8593', textAlign: 'center', lineHeight: 1.6 }}>
                    送信内容は端末にも保存され、開発元に共有されます。
                  </p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
