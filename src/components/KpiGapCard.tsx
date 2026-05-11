// ============================================================
// KpiGapCard — 目標 vs 実績 の比較カード
// 達成率 < 80% は赤、80-100% は琥珀、>= 100% は緑
// 解約率など「低いほど良い」KPI は反転表示する
// ============================================================
import type { KpiGap } from '../lib/kpiAggregator';
import { formatKpiValue } from '../lib/kpiAggregator';

const FONT_DISPLAY = '"Cinzel", "Noto Serif JP", serif';
const FONT_SERIF_JA = '"Noto Serif JP", "游明朝", serif';

const STATUS_COLORS = {
  green: { bar: '#34d399', text: '#a7f3d0', border: 'rgba(52,211,153,0.35)', glow: 'rgba(52,211,153,0.12)' },
  amber: { bar: '#fbbf24', text: '#fde68a', border: 'rgba(251,191,36,0.35)', glow: 'rgba(251,191,36,0.10)' },
  red:   { bar: '#f87171', text: '#fecaca', border: 'rgba(248,113,113,0.40)', glow: 'rgba(248,113,113,0.12)' },
  unknown: { bar: 'rgba(255,255,255,0.4)', text: 'rgba(255,255,255,0.6)', border: 'rgba(255,255,255,0.15)', glow: 'rgba(255,255,255,0.04)' },
} as const;

interface Props {
  gap: KpiGap;
  /** true のとき「低い方が良い」KPI として反転バッジを出す */
  inverted?: boolean;
}

export default function KpiGapCard({ gap, inverted }: Props) {
  const { target, actual, achievement, status } = gap;
  const colors = STATUS_COLORS[status];
  const pct = achievement === null ? null : Math.min(achievement * 100, 200);
  const pctLabel = achievement === null ? '計測未対応'
    : inverted ? `${(achievement * 100).toFixed(0)}% (目標以下が良い)`
    : `${(achievement * 100).toFixed(0)}% 達成`;

  return (
    <div style={{
      background: `linear-gradient(135deg, ${colors.glow}, rgba(0,0,0,0.15))`,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: '0.95rem 1.05rem',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      minHeight: 132,
    }}>
      {/* ヘッダ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
        <p style={{
          fontFamily: FONT_DISPLAY,
          fontSize: '0.55rem',
          letterSpacing: '0.32em',
          color: 'rgba(255,255,255,0.45)',
          fontWeight: 700,
          margin: 0,
          textTransform: 'uppercase',
        }}>
          {target.category}
        </p>
        {target.horizon && (
          <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.65rem', color: 'rgba(255,255,255,0.45)', margin: 0 }}>
            {target.horizon}
          </p>
        )}
      </div>

      {/* ラベル */}
      <h3 style={{
        fontFamily: FONT_SERIF_JA,
        fontSize: '0.92rem',
        fontWeight: 700,
        margin: 0,
        color: '#fff',
        lineHeight: 1.35,
      }}>
        {target.label}
      </h3>

      {/* 実績 / 目標 */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <p style={{
          fontFamily: FONT_DISPLAY,
          fontSize: '1.35rem',
          fontWeight: 800,
          margin: 0,
          color: colors.text,
          lineHeight: 1.1,
        }}>
          {formatKpiValue(actual.value, target.unit)}
        </p>
        <p style={{
          fontFamily: FONT_SERIF_JA,
          fontSize: '0.72rem',
          color: 'rgba(255,255,255,0.55)',
          margin: 0,
        }}>
          / {formatKpiValue(target.target, target.unit)}
        </p>
      </div>

      {/* 達成率バー */}
      <div style={{
        height: 6,
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 999,
        overflow: 'hidden',
        position: 'relative',
      }}>
        {pct !== null && (
          <div style={{
            position: 'absolute',
            inset: 0,
            width: `${Math.min(pct, 100)}%`,
            background: colors.bar,
            transition: 'width 0.6s ease',
            boxShadow: `0 0 8px ${colors.bar}55`,
          }} />
        )}
      </div>

      {/* 達成率テキスト + ソース */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
        <p style={{
          fontFamily: FONT_SERIF_JA,
          fontSize: '0.7rem',
          margin: 0,
          color: colors.text,
          fontWeight: 600,
        }}>
          {pctLabel}
        </p>
        <p style={{
          fontFamily: 'monospace',
          fontSize: '0.6rem',
          margin: 0,
          color: 'rgba(255,255,255,0.35)',
        }}>
          src: {actual.source}
        </p>
      </div>
    </div>
  );
}
