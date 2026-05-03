import { motion } from 'framer-motion';

export const PRISM_COLORS = {
  logic: '#2E6FFF',
  empathy: '#E84B97',
  creative: '#8E5CFF',
  action: '#FF7A1A',
  ethics: '#D9A41A',
} as const;

interface Props {
  intensity?: 'low' | 'normal' | 'high';
}

const POSITIONS = [
  { x: '12%', y: '22%' },
  { x: '78%', y: '18%' },
  { x: '22%', y: '74%' },
  { x: '70%', y: '70%' },
  { x: '50%', y: '40%' },
];

export function PrismBackground({ intensity = 'low' }: Props) {
  // light/dark で見え方を CSS 変数に委ねる
  const scale = intensity === 'high' ? 1.5 : intensity === 'normal' ? 1.1 : 0.85;

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {Object.entries(PRISM_COLORS).map(([key, color], i) => {
        const p = POSITIONS[i];
        return (
          <motion.div
            key={key}
            className="prism-orb"
            style={{
              background: color,
              width: `${38 * scale}vw`,
              height: `${38 * scale}vw`,
              left: p.x,
              top: p.y,
              transform: 'translate(-50%, -50%)',
            }}
            animate={{ scale: [1, 1.12, 1] }}
            transition={{
              duration: 8 + i,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.4,
            }}
          />
        );
      })}
    </div>
  );
}
