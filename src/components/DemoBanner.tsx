import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';

interface Props {
  onClearDemo: () => void;
}

export default function DemoBanner({ onClearDemo }: Props) {
  return (
    <motion.div
      className="flex items-center justify-between gap-2 px-4 py-2 text-xs flex-shrink-0"
      style={{
        background: 'linear-gradient(90deg, rgba(201,169,110,0.18), rgba(251,191,36,0.14))',
        borderBottom: '1px solid rgba(201,169,110,0.3)',
      }}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
    >
      {/* 文字色は必ず var(--brass-text)。装飾用の金 (#c9a96e / 淡いアンバー) は
          明るい面では 2:1 前後しか出ず、淡いアンバーの帯の上では読めなくなる
          (light 5.2:1 / dark 11.6:1)。帯の下地は両テーマとも半透明の金なので、
          文字だけテーマ追従させれば light/dark どちらでも濃淡が付く。 */}
      <p style={{ color: 'var(--brass-text)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <BookOpen size={14} strokeWidth={2.2} /> デモデータ表示中。実際の運用に切替えるとデモデータは消えます。
      </p>
      <motion.button
        onClick={onClearDemo}
        className="flex-shrink-0 px-3 py-1 rounded-full font-medium transition-all"
        style={{
          background: 'rgba(201,169,110,0.18)',
          border: '1px solid rgba(201,169,110,0.55)',
          color: 'var(--brass-text)',
        }}
        whileHover={{ background: 'rgba(201,169,110,0.4)' }}
        whileTap={{ scale: 0.97 }}
      >
        実データに切替
      </motion.button>
    </motion.div>
  );
}
