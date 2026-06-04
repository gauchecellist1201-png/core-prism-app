// ============================================================
// IndustryLogoStrip — /lp/* の Hero と Pain の間に置く 導入企業 ロゴ ストリップ
//
// オーナー指示 (2026-06-04 第 41 波 HHHHHH):
//   架空名 8 社 を Marquee 風 (CSS animation で 横スクロール) に流す。
//   ロゴはピル+emoji+テキスト で プレースホルダー感 を抑える。
//   業界別に 8 社の セットを切替 (slug → array)。
// ============================================================

interface LogoEntry { name: string; emoji: string; color: string; }

// 業界別 サンプル 8 社 (匿名化、実際の取引先ではない)
const PRESETS: Record<string, LogoEntry[]> = {
  sme: [
    { name: '田中精機',     emoji: '🔧', color: '#FBBF24' },
    { name: 'カフェ TANAKA', emoji: '☕', color: '#F472B6' },
    { name: '佐藤工務店',   emoji: '🏗', color: '#A78BFA' },
    { name: 'みなと食品',   emoji: '🐟', color: '#34D399' },
    { name: '青葉印刷',     emoji: '📰', color: '#22D3EE' },
    { name: '山本クラフト', emoji: '🎨', color: '#FB923C' },
    { name: '美容室 LIA',   emoji: '💇', color: '#EC4899' },
    { name: '整骨院 れもん', emoji: '🍋', color: '#84CC16' },
  ],
  'realestate-finance': [
    { name: 'プレシス不動産', emoji: '🏠', color: '#10B981' },
    { name: '東京FP事務所',   emoji: '💼', color: '#0EA5E9' },
    { name: 'みらい証券',     emoji: '📈', color: '#6366F1' },
    { name: '青空生命',       emoji: '🌤', color: '#F59E0B' },
    { name: 'リソル投資',     emoji: '💎', color: '#8B5CF6' },
    { name: 'シティ仲介',     emoji: '🏢', color: '#3B82F6' },
    { name: 'IFA OUR',        emoji: '🤝', color: '#EC4899' },
    { name: '相続士法人 北翼', emoji: '⚖', color: '#EAB308' },
  ],
  consulting: [
    { name: 'ハイドCO',       emoji: '🧠', color: '#6366F1' },
    { name: 'BOLD Strategy',  emoji: '🚀', color: '#A855F7' },
    { name: '森本会計',       emoji: '📊', color: '#10B981' },
    { name: 'リフトM&A',      emoji: '🔀', color: '#0EA5E9' },
    { name: '虎ノ門コンサル', emoji: '🐯', color: '#F59E0B' },
    { name: 'Lighthouse Group',emoji: '💡', color: '#EAB308' },
    { name: 'PRIM 戦略',      emoji: '🎯', color: '#EF4444' },
    { name: '空海リサーチ',   emoji: '🌊', color: '#22D3EE' },
  ],
  solo: [
    { name: '林フィットネス',  emoji: '💪', color: '#22D3EE' },
    { name: 'ミハシ薬店',      emoji: '💊', color: '#34D399' },
    { name: '高橋税理士',      emoji: '📑', color: '#F59E0B' },
    { name: '本間整体',        emoji: '🤲', color: '#EC4899' },
    { name: '佐藤司法書士',    emoji: '⚖', color: '#6366F1' },
    { name: 'ヨガ KOI',        emoji: '🧘', color: '#F472B6' },
    { name: '島田 web',        emoji: '🕸', color: '#A855F7' },
    { name: 'ふくろう書道塾',  emoji: '✒️', color: '#FBBF24' },
  ],
  creator: [
    { name: '@hina_lifestyle', emoji: '🌸', color: '#F472B6' },
    { name: '@maru_eats',      emoji: '🍣', color: '#FB923C' },
    { name: '@itto_design',    emoji: '🎨', color: '#A855F7' },
    { name: '@aya_fitness',    emoji: '💪', color: '#34D399' },
    { name: '@yota_travel',    emoji: '✈️', color: '#22D3EE' },
    { name: '@neko_cafe',      emoji: '🐱', color: '#FBBF24' },
    { name: '@kiku_music',     emoji: '🎵', color: '#EC4899' },
    { name: '@ren_anime',      emoji: '🎬', color: '#6366F1' },
  ],
  'freelance-pro': [
    { name: '田川 BE',         emoji: '⚙️', color: '#6366F1' },
    { name: '山口 UI/UX',      emoji: '🎨', color: '#EC4899' },
    { name: 'コードリオ',      emoji: '⌨️', color: '#10B981' },
    { name: '森田 PdM',        emoji: '🎯', color: '#F59E0B' },
    { name: 'NOTE w/ Akira',   emoji: '✍️', color: '#22D3EE' },
    { name: '大村 web',        emoji: '🌐', color: '#A855F7' },
    { name: '葛西 freelance',  emoji: '🦊', color: '#FB923C' },
    { name: '南条 video',      emoji: '🎬', color: '#EAB308' },
  ],
  'saas-startup': [
    { name: 'Glance',          emoji: '👁', color: '#00D4FF' },
    { name: 'Reon AI',         emoji: '🤖', color: '#A855F7' },
    { name: 'Loopwell',        emoji: '🔄', color: '#34D399' },
    { name: 'Vincere CRM',     emoji: '🏆', color: '#F59E0B' },
    { name: 'Bramble',         emoji: '🍇', color: '#8B5CF6' },
    { name: 'Stride.dev',      emoji: '🏃', color: '#EC4899' },
    { name: 'Plumeria',        emoji: '🌺', color: '#F472B6' },
    { name: 'Mesa Notes',      emoji: '📓', color: '#22D3EE' },
  ],
};

interface Props {
  slug: string;
  /** 親 (IndustryLanding) から 渡されるアクセント色 — 現状はピル内側で各社色を 使うので 直接 未使用、将来の グラデ強調用 */
  accentLeft?: string;
  accentRight?: string;
}

export default function IndustryLogoStrip({ slug }: Props) {
  const list = PRESETS[slug] || PRESETS.sme;
  // marquee 用 に 2 周 つなぐ
  const loop = [...list, ...list];

  return (
    <section
      aria-label={`サンプル 導入企業 8 社 (架空)`}
      style={{
        padding: '24px 0',
        background: 'rgba(255,255,255,0.02)',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div style={{
        textAlign: 'center', marginBottom: 12,
        fontSize: 10, letterSpacing: '0.32em',
        color: 'rgba(255,255,255,0.45)', fontWeight: 800,
      }}>
        CASE STUDIES · 業界別 サンプル 導入企業 ※ 架空名
      </div>

      {/* fade left / right */}
      <div aria-hidden="true" style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 80,
        background: 'linear-gradient(90deg, #080812, transparent)',
        zIndex: 2, pointerEvents: 'none',
      }} />
      <div aria-hidden="true" style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 80,
        background: 'linear-gradient(270deg, #080812, transparent)',
        zIndex: 2, pointerEvents: 'none',
      }} />

      <div
        style={{
          display: 'flex', gap: 14,
          width: 'max-content',
          animation: 'core-marquee 32s linear infinite',
        }}
      >
        {loop.map((l, i) => (
          <div key={`${l.name}-${i}`} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 999,
            background: `linear-gradient(135deg, ${l.color}1a, rgba(255,255,255,0.03))`,
            border: `1px solid ${l.color}40`,
            color: 'rgba(255,255,255,0.92)',
            fontSize: 13, fontWeight: 700,
            whiteSpace: 'nowrap',
            boxShadow: `0 4px 14px ${l.color}1a`,
            flexShrink: 0,
          }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 13,
              background: `linear-gradient(135deg, ${l.color}, ${l.color}aa)`,
              fontSize: 14, color: '#fff',
              boxShadow: `0 2px 8px ${l.color}55`,
            }}>{l.emoji}</span>
            <span>{l.name}</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes core-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          [class*="marquee"] { animation: none !important; }
        }
      `}</style>

      <div style={{
        textAlign: 'center', marginTop: 10,
        fontSize: 10, color: 'rgba(255,255,255,0.35)',
      }}>
        ※ 上記は <strong>架空企業名</strong> の表示です (実在企業ではありません)。
        実際の 事例は 詳細を 個別 ご共有可能 — お問い合わせ ください。
      </div>
    </section>
  );
}
