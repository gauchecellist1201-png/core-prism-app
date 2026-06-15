// ============================================================
// TodayCard — ホーム上部に「今日の最初の一手」を 3 つ並べるカード
// ユーザー状態に合った具体的なアクションを提示する
// ============================================================
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface TodaySuggestion {
  id: string;
  icon: LucideIcon | string;
  title: string;
  reason: string;
  cta?: string;
  onClick: () => void;
  /** タイル背景の色相 (人格カラー等) */
  accent?: string;
}

interface Props {
  suggestions: TodaySuggestion[];
  /** 上のラベル (デフォルト「今日の最初の一手」) */
  heading?: string;
  /** ブランド色 (Iris は ピンク、Prism は紫) */
  accent?: string;
  /** 「コンパクト」だと縦並び・小さめ */
  compact?: boolean;
  /** 本文の文字色 (淡背景テーマでは濃色を渡す。白地白文字防止) */
  ink?: string;
  /** 補足文の文字色 */
  inkMuted?: string;
}

export default function TodayCard({
  suggestions, heading = '今日の最初の一手', accent = '#A78BFA', compact = false,
  ink = 'var(--fg, #fff)', inkMuted = 'var(--fg-muted, rgba(255,255,255,0.65))',
}: Props) {
  if (suggestions.length === 0) return null;
  const items = suggestions.slice(0, 3);

  return (
    <section
      aria-label={heading}
      style={{
        marginBottom: compact ? '1rem' : '1.5rem',
      }}
    >
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 10.5, letterSpacing: '0.18em', fontWeight: 800,
        color: accent, marginBottom: 8, textTransform: 'uppercase',
      }}>
        <Sparkles size={11} /> {heading}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: compact ? 6 : 10,
      }}>
        {items.map((s, i) => {
          const itemAccent = s.accent || accent;
          const Icon = typeof s.icon === 'string' ? null : s.icon;
          return (
            <motion.button
              key={s.id}
              type="button"
              onClick={s.onClick}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.985 }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
              style={{
                textAlign: 'left',
                background: `linear-gradient(135deg, ${itemAccent}1F, ${itemAccent}08)`,
                border: `1px solid ${itemAccent}44`,
                borderRadius: 14,
                padding: compact ? '10px 12px' : '14px 14px',
                cursor: 'pointer',
                color: ink,
                display: 'flex', alignItems: 'center', gap: 11,
                minHeight: 60,
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = `linear-gradient(135deg, ${itemAccent}33, ${itemAccent}11)`;
                e.currentTarget.style.borderColor = `${itemAccent}88`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = `linear-gradient(135deg, ${itemAccent}1F, ${itemAccent}08)`;
                e.currentTarget.style.borderColor = `${itemAccent}44`;
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                background: `linear-gradient(135deg, ${itemAccent}, ${itemAccent}cc)`,
                color: '#fff', fontWeight: 900, fontSize: 17,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 6px 16px ${itemAccent}55`,
              }}>
                {Icon ? <Icon size={18} strokeWidth={2.2} /> : (typeof s.icon === 'string' ? s.icon : '✨')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: compact ? 13 : 13.5, fontWeight: 800,
                  marginBottom: 2, lineHeight: 1.4, color: ink,
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{s.title}</div>
                <div style={{
                  fontSize: 11, fontWeight: 500,
                  color: inkMuted,
                  lineHeight: 1.45,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>{s.reason}</div>
              </div>
              <div style={{
                fontSize: 10, fontWeight: 700,
                color: itemAccent,
                display: 'inline-flex', alignItems: 'center', gap: 3,
                flexShrink: 0,
              }}>
                {s.cta || 'やる'} <ArrowRight size={11} />
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
