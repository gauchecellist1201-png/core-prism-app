// ============================================================
// WellnessTracker — 「健康が積み上がっている」実感を見せるカード
//
// Prism / Iris 共用。ホーム上部に置く。
// 「CORE と歩んだ日数」「ウェルネススコア」「改善率」「ストリーク」
// を一目で。サプリのように "やめられない定着感" を作るのが目的。
// ============================================================
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Heart, Flame, TrendingUp, Activity } from 'lucide-react';
import type { DailyHealth } from '../types/health';
import { getWellnessSummary } from '../lib/wellnessScore';

interface Props {
  today: DailyHealth | null;
  /** ブランド配色 */
  accent?: string;
  accentSoft?: string;
  /** Apple Health 連携を促すときのハンドラ */
  onConnectHealth?: () => void;
}

const STATE_THEME: Record<string, { ring: string; glow: string; emoji: string; label: string }> = {
  great: { ring: '#10B981', glow: 'rgba(16,185,129,0.4)',  emoji: '✨', label: 'とても良い' },
  good:  { ring: '#34D399', glow: 'rgba(52,211,153,0.35)', emoji: '🌿', label: '良い' },
  soso:  { ring: '#FBBF24', glow: 'rgba(251,191,36,0.35)', emoji: '☁️', label: 'ふつう' },
  tired: { ring: '#F87171', glow: 'rgba(248,113,113,0.35)', emoji: '🌙', label: 'お疲れ' },
};

export default function WellnessTracker({ today, accent = '#8E5CFF', accentSoft, onConnectHealth }: Props) {
  const w = useMemo(() => getWellnessSummary(today), [today]);
  const soft = accentSoft || `${accent}22`;

  // 未連携 → やさしい誘導
  if (w.empty) {
    return (
      <button
        type="button"
        onClick={onConnectHealth}
        style={{
          width: '100%', textAlign: 'left',
          padding: '1rem 1.2rem', borderRadius: 20,
          background: `linear-gradient(135deg, ${soft}, rgba(255,255,255,0.02))`,
          border: `1px solid ${accent}44`,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 14,
        }}
      >
        <div style={{
          width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
          background: `radial-gradient(circle at 35% 30%, #fff3, ${accent})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Heart size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>
            健康も、CORE と一緒に整える
          </div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', marginTop: 2, lineHeight: 1.5 }}>
            {w.message}
          </div>
        </div>
        <div style={{
          fontSize: 11, fontWeight: 800, color: accent,
          border: `1px solid ${accent}`, borderRadius: 999,
          padding: '5px 12px', flexShrink: 0,
        }}>つなぐ</div>
      </button>
    );
  }

  const theme = STATE_THEME[w.state];
  const R = 32;
  const CIRC = 2 * Math.PI * R;
  const dash = (w.today / 100) * CIRC;

  return (
    <div style={{
      position: 'relative',
      padding: '1.1rem 1.2rem',
      borderRadius: 20,
      background: `linear-gradient(135deg, ${soft}, rgba(255,255,255,0.015))`,
      border: `1px solid ${accent}33`,
      overflow: 'hidden',
    }}>
      <div aria-hidden style={{
        position: 'absolute', top: -50, right: -50,
        width: 160, height: 160, borderRadius: '50%',
        background: `radial-gradient(circle, ${theme.glow} 0%, transparent 70%)`,
        filter: 'blur(30px)', pointerEvents: 'none',
      }} />

      {/* ヘッダ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, position: 'relative' }}>
        <Heart size={12} color={accent} />
        <span style={{
          fontSize: 10, letterSpacing: '0.25em', fontWeight: 800,
          color: accent, textTransform: 'uppercase',
        }}>WELLNESS · 健康の積み立て</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
        {/* スコアリング */}
        <div style={{ position: 'relative', width: 84, height: 84, flexShrink: 0 }}>
          <svg width="84" height="84" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="42" cy="42" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
            <motion.circle
              cx="42" cy="42" r={R} fill="none"
              stroke={theme.ring} strokeWidth="7" strokeLinecap="round"
              strokeDasharray={CIRC}
              initial={{ strokeDashoffset: CIRC }}
              animate={{ strokeDashoffset: CIRC - dash }}
              transition={{ duration: 1.1, ease: 'easeOut' }}
              style={{ filter: `drop-shadow(0 0 6px ${theme.glow})` }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <motion.span
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1 }}
            >{w.today}</motion.span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              {theme.emoji} {theme.label}
            </span>
          </div>
        </div>

        {/* 右側: 数字 3 つ */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Stat
            icon={<Heart size={12} />}
            label="CORE と歩んで"
            value={`${w.daysWithCore}`}
            unit="日"
            accent={accent}
          />
          <Stat
            icon={<Flame size={12} />}
            label="連続記録"
            value={`${w.streak}`}
            unit="日"
            accent={accent}
          />
          <Stat
            icon={<TrendingUp size={12} />}
            label="始めた頃より"
            value={w.improvementPct > 0 ? `+${w.improvementPct}` : `${w.improvementPct}`}
            unit="%"
            accent={w.improvementPct >= 0 ? '#10B981' : '#F87171'}
          />
          <Stat
            icon={<Activity size={12} />}
            label="14日トレンド"
            value=""
            unit=""
            accent={accent}
            spark={w.trend}
          />
        </div>
      </div>

      {/* 一言メッセージ */}
      <p style={{
        marginTop: 12,
        fontSize: 12, color: 'rgba(255,255,255,0.78)',
        lineHeight: 1.6, position: 'relative',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        paddingTop: 10,
      }}>
        {w.message}
      </p>
    </div>
  );
}

function Stat({ icon, label, value, unit, accent, spark }: {
  icon: React.ReactNode; label: string; value: string; unit: string;
  accent: string; spark?: number[];
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      borderRadius: 10, padding: '6px 9px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: 600,
        marginBottom: 3,
      }}>
        <span style={{ color: accent }}>{icon}</span>{label}
      </div>
      {spark && spark.length > 1 ? (
        <Sparkline data={spark} color={accent} />
      ) : (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <span style={{ fontSize: 17, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{value}</span>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{unit}</span>
        </div>
      )}
    </div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 60, h = 20;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline
        points={pts}
        fill="none" stroke={color} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round"
      />
      {data.length > 0 && (() => {
        const lx = w, ly = h - ((data[data.length - 1] - min) / range) * h;
        return <circle cx={lx} cy={ly} r="2.2" fill={color} />;
      })()}
    </svg>
  );
}
