// ============================================================
// AcceptInviteModal — ?invite=CODE から参加フロー (Day 2 upgrade)
//
//  Day 2 で刷新:
//   - 「◯◯ さんから招待されました」を中央大きく
//   - 「あなたも 7 日無料」を緑バナーで強調
//   - 招待元の名前 (?ref=...&from=NAME 経由) があれば表示
//   - 「登録する →」CTA 1 つを大きく (CheckoutModal を呼ぶ)
//   - workspace.name があればワークスペース名を表示
// ============================================================
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Sparkles, Users, ArrowRight, Check, X } from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import { REFERRAL_BONUS_DAYS, getPendingReferralInviter, getPendingReferralMessage } from '../lib/referral';

interface Props {
  code: string;
  onClose: () => void;
  /** "登録する" を押した時のフック (CheckoutModal を開くなど) — 任意 */
  onSignupRequest?: () => void;
}

export default function AcceptInviteModal({ code, onClose, onSignupRequest }: Props) {
  const { workspace, redeemInvite, createWorkspace } = useWorkspace();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // ?ref=...&from=NAME 経由で来ていれば招待元の名前を取得
  const inviterName = useMemo(() => getPendingReferralInviter(), []);
  // 招待者が添えた一言メッセージ (任意)
  const inviterMsg = useMemo(() => getPendingReferralMessage(), []);

  useEffect(() => {
    try { sessionStorage.removeItem('pending_invite'); } catch { /* */ }
  }, []);

  const handleJoin = () => {
    setStatus('loading');
    if (!workspace) {
      createWorkspace('共有ワークスペース');
    }
    setTimeout(() => {
      const result = redeemInvite(code);
      if (result.ok) {
        setStatus('success');
        setMessage(result.message);
        setTimeout(onClose, 2500);
      } else {
        setStatus('error');
        setMessage(result.message);
      }
    }, 300);
  };

  const handleSignupAndJoin = () => {
    // 未登録ユーザーは CheckoutModal で登録 → 戻ってきたら自動で参加
    if (onSignupRequest) {
      onSignupRequest();
    } else {
      handleJoin();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] flex items-center justify-center px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div
          className="absolute inset-0"
          style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(14px)' }}
          onClick={onClose}
        />
        <motion.div
          className="relative w-full max-w-md rounded-3xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #1A1426 0%, #0e0e18 60%)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          }}
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 閉じるボタン */}
          <button
            onClick={onClose}
            aria-label="閉じる"
            style={{
              position: 'absolute', top: 12, right: 12,
              width: 32, height: 32, borderRadius: 999,
              background: 'rgba(255,255,255,0.08)',
              border: 'none', color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 3,
            }}
          >
            <X size={16} />
          </button>

          {/* ヒーロー: 招待された人にフォーカス */}
          <div style={{
            padding: '2rem 1.5rem 1.5rem',
            textAlign: 'center',
            background: 'radial-gradient(circle at 50% 0%, rgba(124,92,255,0.32), transparent 70%)',
            position: 'relative',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'linear-gradient(135deg, #7C5CFF, #FF6FA9)',
              margin: '0 auto 0.85rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 12px 32px rgba(124,92,255,0.45)',
            }}>
              <Gift size={28} color="#fff" strokeWidth={2.2} />
            </div>

            <h2 style={{
              margin: 0,
              fontSize: '1.55rem',
              fontWeight: 900,
              color: '#fff',
              letterSpacing: '-0.01em',
              lineHeight: 1.3,
            }}>
              {inviterName ? (
                <>
                  <span style={{
                    background: 'linear-gradient(90deg, #FFD86F, #FF6FA9)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>
                    {inviterName} さん
                  </span>
                  <br />から招待されました
                </>
              ) : (
                <>友達から<br />招待されました</>
              )}
            </h2>

            {workspace?.name && (
              <p style={{
                margin: '0.65rem 0 0',
                fontSize: '0.82rem',
                color: 'rgba(255,255,255,0.65)',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <Users size={13} /> ワークスペース「{workspace.name}」
              </p>
            )}

            {inviterMsg && (
              <div
                data-testid="accept-inviter-message"
                style={{
                  margin: '1rem auto 0',
                  maxWidth: 320,
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 14,
                  padding: '0.7rem 0.9rem',
                  fontSize: '0.88rem',
                  fontStyle: 'italic',
                  color: 'rgba(255,255,255,0.92)',
                  lineHeight: 1.55,
                  textAlign: 'left',
                }}
              >
                <span style={{ color: '#FFD86F', fontWeight: 800 }}>“</span>
                {inviterMsg}
                <span style={{ color: '#FFD86F', fontWeight: 800 }}>”</span>
                {inviterName && (
                  <span style={{ display: 'block', marginTop: 4, fontStyle: 'normal', fontSize: '0.74rem', color: 'rgba(255,255,255,0.6)', textAlign: 'right' }}>
                    — {inviterName} さん
                  </span>
                )}
              </div>
            )}
          </div>

          <div style={{ padding: '0 1.5rem 1.5rem', display: 'grid', gap: '1rem' }}>
            {/* 緑バナー: あなたも 7 日無料 */}
            <div style={{
              background: 'linear-gradient(135deg, #16A34A, #22C55E)',
              borderRadius: 16,
              padding: '0.95rem 1rem',
              color: '#fff',
              display: 'flex', alignItems: 'center', gap: '0.7rem',
              boxShadow: '0 8px 22px rgba(22,163,74,0.35)',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'rgba(255,255,255,0.22)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Sparkles size={20} strokeWidth={2.4} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0, fontSize: '1.05rem', fontWeight: 900,
                  lineHeight: 1.3,
                }}>
                  あなたも 7 日無料
                </p>
                <p style={{
                  margin: '0.15rem 0 0', fontSize: '0.78rem',
                  color: 'rgba(255,255,255,0.92)', lineHeight: 1.4,
                }}>
                  招待リンク経由なので合計 <strong>{7 + REFERRAL_BONUS_DAYS} 日無料</strong>。
                  クレジットカード不要。
                </p>
              </div>
            </div>

            {/* 招待コード表示 (小さく) */}
            <div style={{
              textAlign: 'center',
              fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)',
            }}>
              招待コード <code style={{
                background: 'rgba(255,255,255,0.08)',
                padding: '0.15rem 0.45rem',
                borderRadius: 6,
                fontSize: '0.72rem',
                color: 'rgba(255,255,255,0.85)',
                fontFamily: 'ui-monospace, Menlo, monospace',
                letterSpacing: '0.08em',
              }}>{code}</code>
            </div>

            {/* 成功 / エラー表示 */}
            {status === 'success' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  background: 'rgba(34,197,94,0.12)',
                  border: '1px solid rgba(34,197,94,0.35)',
                  borderRadius: 12,
                  padding: '0.8rem 1rem',
                  display: 'flex', alignItems: 'center', gap: '0.55rem',
                  color: '#4ADE80',
                }}>
                <Check size={16} strokeWidth={2.5} />
                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700 }}>{message}</p>
              </motion.div>
            )}

            {status === 'error' && (
              <div style={{
                background: 'rgba(248,113,113,0.1)',
                border: '1px solid rgba(248,113,113,0.3)',
                borderRadius: 12, padding: '0.75rem 1rem',
              }}>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#FCA5A5' }}>{message}</p>
              </div>
            )}

            {/* CTA — 1 つの大きなボタン */}
            {status !== 'success' && (
              <button
                onClick={onSignupRequest ? handleSignupAndJoin : handleJoin}
                disabled={status === 'loading'}
                style={{
                  background: 'linear-gradient(135deg, #7C5CFF, #FF6FA9)',
                  color: '#fff', border: 'none', borderRadius: 16,
                  padding: '1.05rem 1.25rem',
                  fontSize: '1rem', fontWeight: 800,
                  cursor: status === 'loading' ? 'wait' : 'pointer',
                  display: 'inline-flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8,
                  boxShadow: '0 12px 32px rgba(124,92,255,0.45)',
                  opacity: status === 'loading' ? 0.7 : 1,
                  transition: 'transform var(--cp-duration-fast) var(--cp-ease-out), box-shadow var(--cp-duration-fast) var(--cp-ease-smooth)',
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = '')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
              >
                {status === 'loading' ? '参加中…' : (
                  <>
                    {onSignupRequest ? '登録して受け取る' : 'このワークスペースに参加する'}
                    <ArrowRight size={18} strokeWidth={2.4} />
                  </>
                )}
              </button>
            )}

            {/* キャンセル (小さく) */}
            {status !== 'success' && (
              <button
                onClick={onClose}
                style={{
                  background: 'transparent', border: 'none',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '0.78rem', fontWeight: 600,
                  cursor: 'pointer', padding: '0.3rem',
                  textAlign: 'center',
                }}
              >
                あとで決める
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
