// ============================================================
// AcceptInviteModal — ?invite=CODE から参加フロー (Phase 5-2)
// ============================================================
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkspace } from '../hooks/useWorkspace';

interface Props {
  code: string;
  onClose: () => void;
}

export default function AcceptInviteModal({ code, onClose }: Props) {
  const { workspace, redeemInvite, createWorkspace } = useWorkspace();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

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

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] flex items-center justify-center px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)' }} onClick={onClose} />
        <motion.div
          className="relative w-full max-w-sm rounded-2xl p-6 space-y-4"
          style={{ background: '#0e0e18', border: '1px solid rgba(255,255,255,0.12)' }}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
        >
          <div className="text-center space-y-2">
            <div className="text-4xl">👥</div>
            <h2 className="text-white font-bold text-lg">ワークスペースへの招待</h2>
            <p className="text-white/60 text-sm">
              招待コード <code className="px-1.5 py-0.5 rounded text-xs font-mono"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)' }}>
                {code}
              </code> でチームに参加できます。
            </p>
          </div>

          {status === 'success' && (
            <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
              <p className="text-green-400 text-sm font-semibold">✓ {message}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="p-3 rounded-xl" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)' }}>
              <p className="text-red-400 text-sm">{message}</p>
            </div>
          )}

          {status !== 'success' && (
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-white/10"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}
              >
                キャンセル
              </button>
              <button
                onClick={handleJoin}
                disabled={status === 'loading'}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: '#7c6fcf' }}
              >
                {status === 'loading' ? '参加中…' : 'このワークスペースに参加する'}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
