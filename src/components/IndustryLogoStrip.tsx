// ============================================================
// IndustryLogoStrip — /lp/* の Hero と Pain の間に置く 導入企業 ロゴ ストリップ
//
// オーナー指示 (2026-06-04 第 41 波 HHHHHH):
//   架空名 8 社 を Marquee 風 (CSS animation で 横スクロール) に流す。
//   ロゴはピル+emoji+テキスト で プレースホルダー感 を抑える。
//   業界別に 8 社の セットを切替 (slug → array)。
// ============================================================

import {
  Wrench, Coffee, HardHat, Fish, Newspaper, Palette, Scissors, Citrus,
  Home, Briefcase, TrendingUp, CloudSun, Gem, Building2, Handshake, Scale,
  Brain, Rocket, BarChart3, Shuffle, PawPrint, Lightbulb, Target, Waves,
  Dumbbell, Pill, FileText, HeartHandshake, Flower2, Globe, PenTool,
  Flower, Utensils, Plane, Cat, Music, Clapperboard, Cog, Keyboard, PenLine,
  Feather, Eye, Bot, RefreshCw, Trophy, Grape, Footprints, Notebook,
  type LucideIcon,
} from 'lucide-react';

import { whiteFaceBg } from '../lib/accentFace';

// アイコンは **線画 (lucide)** で統一する。
// OS カラー絵文字 (🔧☕🏗…) は端末ごとに絵柄も色も変わり、こちらで決めた
// ブランド色・コントラストが効かない（[[feedback_no_cheap_emoji]]）。
interface LogoEntry { name: string; Icon: LucideIcon; color: string; }

// 業界別 サンプル 8 社 (匿名化、実際の取引先ではない)
const PRESETS: Record<string, LogoEntry[]> = {
  sme: [
    { name: '田中精機',     Icon: Wrench,    color: '#FBBF24' },
    { name: 'カフェ TANAKA', Icon: Coffee,   color: '#F472B6' },
    { name: '佐藤工務店',   Icon: HardHat,   color: '#A78BFA' },
    { name: 'みなと食品',   Icon: Fish,      color: '#34D399' },
    { name: '青葉印刷',     Icon: Newspaper, color: '#22D3EE' },
    { name: '山本クラフト', Icon: Palette,   color: '#FB923C' },
    { name: '美容室 LIA',   Icon: Scissors,  color: '#EC4899' },
    { name: '整骨院 れもん', Icon: Citrus,   color: '#84CC16' },
  ],
  'realestate-finance': [
    { name: 'プレシス不動産', Icon: Home,       color: '#10B981' },
    { name: '東京FP事務所',   Icon: Briefcase,  color: '#0EA5E9' },
    { name: 'みらい証券',     Icon: TrendingUp, color: '#6366F1' },
    { name: '青空生命',       Icon: CloudSun,   color: '#F59E0B' },
    { name: 'リソル投資',     Icon: Gem,        color: '#8B5CF6' },
    { name: 'シティ仲介',     Icon: Building2,  color: '#3B82F6' },
    { name: 'IFA OUR',        Icon: Handshake,  color: '#EC4899' },
    { name: '相続士法人 北翼', Icon: Scale,     color: '#EAB308' },
  ],
  consulting: [
    { name: 'ハイドCO',       Icon: Brain,      color: '#6366F1' },
    { name: 'BOLD Strategy',  Icon: Rocket,     color: '#A855F7' },
    { name: '森本会計',       Icon: BarChart3,  color: '#10B981' },
    { name: 'リフトM&A',      Icon: Shuffle,    color: '#0EA5E9' },
    { name: '虎ノ門コンサル', Icon: PawPrint,   color: '#F59E0B' },
    { name: 'Lighthouse Group',Icon: Lightbulb, color: '#EAB308' },
    { name: 'PRIM 戦略',      Icon: Target,     color: '#EF4444' },
    { name: '空海リサーチ',   Icon: Waves,      color: '#22D3EE' },
  ],
  solo: [
    { name: '林フィットネス',  Icon: Dumbbell,      color: '#22D3EE' },
    { name: 'ミハシ薬店',      Icon: Pill,          color: '#34D399' },
    { name: '高橋税理士',      Icon: FileText,      color: '#F59E0B' },
    { name: '本間整体',        Icon: HeartHandshake,color: '#EC4899' },
    { name: '佐藤司法書士',    Icon: Scale,         color: '#6366F1' },
    { name: 'ヨガ KOI',        Icon: Flower2,       color: '#F472B6' },
    { name: '島田 web',        Icon: Globe,         color: '#A855F7' },
    { name: 'ふくろう書道塾',  Icon: PenTool,       color: '#FBBF24' },
  ],
  creator: [
    { name: '@hina_lifestyle', Icon: Flower,       color: '#F472B6' },
    { name: '@maru_eats',      Icon: Utensils,     color: '#FB923C' },
    { name: '@itto_design',    Icon: Palette,      color: '#A855F7' },
    { name: '@aya_fitness',    Icon: Dumbbell,     color: '#34D399' },
    { name: '@yota_travel',    Icon: Plane,        color: '#22D3EE' },
    { name: '@neko_cafe',      Icon: Cat,          color: '#FBBF24' },
    { name: '@kiku_music',     Icon: Music,        color: '#EC4899' },
    { name: '@ren_anime',      Icon: Clapperboard, color: '#6366F1' },
  ],
  'freelance-pro': [
    { name: '田川 BE',         Icon: Cog,          color: '#6366F1' },
    { name: '山口 UI/UX',      Icon: Palette,      color: '#EC4899' },
    { name: 'コードリオ',      Icon: Keyboard,     color: '#10B981' },
    { name: '森田 PdM',        Icon: Target,       color: '#F59E0B' },
    { name: 'NOTE w/ Akira',   Icon: PenLine,      color: '#22D3EE' },
    { name: '大村 web',        Icon: Globe,        color: '#A855F7' },
    { name: '葛西 freelance',  Icon: Feather,      color: '#FB923C' },
    { name: '南条 video',      Icon: Clapperboard, color: '#EAB308' },
  ],
  'saas-startup': [
    { name: 'Glance',          Icon: Eye,        color: '#00D4FF' },
    { name: 'Reon AI',         Icon: Bot,        color: '#A855F7' },
    { name: 'Loopwell',        Icon: RefreshCw,  color: '#34D399' },
    { name: 'Vincere CRM',     Icon: Trophy,     color: '#F59E0B' },
    { name: 'Bramble',         Icon: Grape,      color: '#8B5CF6' },
    { name: 'Stride.dev',      Icon: Footprints, color: '#EC4899' },
    { name: 'Plumeria',        Icon: Flower2,    color: '#F472B6' },
    { name: 'Mesa Notes',      Icon: Notebook,   color: '#22D3EE' },
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
            {/* 白い線画を乗せる面なので、面の側で明るさを保証する
                （黄 #FBBF24 は白 1.67＝そのままだとアイコンが消える） */}
            <span aria-hidden="true" style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 13,
              background: whiteFaceBg(l.color),
              color: '#fff',
              boxShadow: `0 2px 8px ${l.color}55`,
              flexShrink: 0,
            }}><l.Icon size={14} strokeWidth={2.2} /></span>
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
        fontSize: 10, color: 'rgba(255,255,255,0.62)',
      }}>
        ※ 上記は <strong>架空企業名</strong> の表示です (実在企業ではありません)。
        実際の 事例は 詳細を 個別 ご共有可能 — お問い合わせ ください。
      </div>
    </section>
  );
}
