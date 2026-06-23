// ============================================================
// GenerationOrb — 生成中の「感動する」ブランド演出
//
// なぜ作るか:
//   ただのスピナーは「処理中」を伝えるだけ。ここでは "ブランドそのもの" が
//   光をまといながら回り、虹色のハロー（プリズムの分光）と周回する光の粒で
//   「いま、あなたのための何かが生まれている」という高揚を体感させる。
//   Prism は多面体プリズムが 3D で回転、Iris は花が脈動しながら回る。
//
// 使い方:  <GenerationOrb brand="prism" size={48} />
// AILoadingState のヘッダ中央に据えて、全 Studio の生成体験を一斉に格上げする。
// ============================================================
import { motion, useReducedMotion } from 'framer-motion';
import { PrismLogo, IrisLogo } from './Logo';

interface Props {
  brand?: 'prism' | 'iris';
  size?: number;
}

// ブランドごとの分光ハロー（回転する虹／インスタグラデ）とグロー色
const THEME = {
  prism: {
    accent: '#A78BFA',
    halo: 'conic-gradient(from 0deg, #C13584, #7B2CBF, #118AB2, #06A77D, #FFD60A, #F77F00, #E1306C, #C13584)',
    spark: ['#C13584', '#118AB2', '#FFD60A'],
  },
  iris: {
    accent: '#E1306C',
    halo: 'conic-gradient(from 0deg, #FCB045, #FD5949, #D6249F, #833AB4, #285AEB, #FCB045)',
    spark: ['#FCB045', '#D6249F', '#285AEB'],
  },
} as const;

export default function GenerationOrb({ brand = 'prism', size = 48 }: Props) {
  const reduce = useReducedMotion();
  const t = THEME[brand];
  const Mark = brand === 'iris' ? IrisLogo : PrismLogo;
  const markSize = Math.round(size * 0.5);
  const ring = Math.max(2, Math.round(size * 0.05));

  // 静止設定（モーション低減ユーザー）は、回らずに柔らかく光るだけ。
  if (reduce) {
    return (
      <div style={{ position: 'relative', width: size, height: size, display: 'grid', placeItems: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `${t.accent}26`, filter: 'blur(6px)' }} />
        <Mark size={markSize} withWordmark={false} />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0, perspective: 320 }}>
      {/* 後光：ブランド色のやわらかい鼓動 */}
      <motion.div
        aria-hidden
        animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.92, 1.12, 0.92] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', inset: -size * 0.22, borderRadius: '50%',
          background: `radial-gradient(circle, ${t.accent}55 0%, transparent 68%)`,
          filter: 'blur(4px)',
        }}
      />

      {/* 分光ハロー：虹色のリングが一定速で回り続ける（プリズムの屈折） */}
      <motion.div
        aria-hidden
        animate={{ rotate: 360 }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: t.halo,
          WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${ring}px), #000 calc(100% - ${ring}px))`,
          mask: `radial-gradient(farthest-side, transparent calc(100% - ${ring}px), #000 calc(100% - ${ring}px))`,
          filter: `drop-shadow(0 0 ${size * 0.12}px ${t.accent}88)`,
        }}
      />

      {/* 周回する光の粒：3 つが別速度で回り、生成の“躍動”を出す */}
      {t.spark.map((c, i) => (
        <motion.div
          key={i}
          aria-hidden
          animate={{ rotate: 360 }}
          transition={{ duration: 2 + i * 0.7, repeat: Infinity, ease: 'linear' }}
          style={{ position: 'absolute', inset: 0 }}
        >
          <span style={{
            position: 'absolute', top: -size * 0.04, left: '50%', marginLeft: -size * 0.04,
            width: size * 0.09, height: size * 0.09, borderRadius: '50%',
            background: c, boxShadow: `0 0 ${size * 0.12}px ${c}`,
          }} />
        </motion.div>
      ))}

      {/* 中央：ブランドマークが 3D で回転（“ぐるぐる回って生成される”の核） */}
      <motion.div
        animate={{ rotateY: 360 }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
          transformStyle: 'preserve-3d',
          filter: `drop-shadow(0 0 ${size * 0.14}px ${t.accent}aa)`,
        }}
      >
        <Mark size={markSize} withWordmark={false} />
      </motion.div>
    </div>
  );
}
