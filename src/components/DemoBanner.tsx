import { motion } from 'framer-motion';

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
      <p style={{ color: 'rgba(255,220,130,0.9)' }}>
        📚 デモデータ表示中。実際の運用に切替えるとデモデータは消えます。
      </p>
      <motion.button
        onClick={onClearDemo}
        className="flex-shrink-0 px-3 py-1 rounded-full font-medium transition-all"
        style={{
          background: 'rgba(201,169,110,0.25)',
          border: '1px solid rgba(201,169,110,0.5)',
          color: '#c9a96e',
        }}
        whileHover={{ background: 'rgba(201,169,110,0.4)' }}
        whileTap={{ scale: 0.97 }}
      >
        実データに切替
      </motion.button>
    </motion.div>
  );
}
