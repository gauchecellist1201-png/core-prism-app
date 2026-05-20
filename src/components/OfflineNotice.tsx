// ============================================================
// OfflineNotice — 通信が切れたときだけ画面上部に細い案内バーを出す
// 復帰したら自動で消える
// ============================================================
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff } from 'lucide-react';

export default function OfflineNotice() {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            position: 'fixed',
            top: 'env(safe-area-inset-top, 0px)',
            left: 0, right: 0,
            zIndex: 9999,
            background: 'linear-gradient(90deg, #FBBF24, #F59E0B)',
            color: '#1F2937',
            textAlign: 'center',
            padding: '6px 14px',
            fontSize: 12.5,
            fontWeight: 800,
            letterSpacing: '0.02em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
          }}
        >
          <WifiOff size={13} />
          <span>いまインターネットに繋がっていません。電波の良い場所でお試しください。</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** オフライン中かどうかを React の state として購読するフック */
export function useIsOnline(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
