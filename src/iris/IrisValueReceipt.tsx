// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// IrisValueReceipt — 「今週、Iris があなたのために動いた量」
//
//   価値の可視化 (最優先方針 #2 / ROI を数字で・嘘なし)。
//   irisActivity に “実際に生成できたものだけ” が記録される。それを直近 7 日で
//   集計して表示する。水増し・推定は一切しない (honest-numbers)。
//
//   表示ルール:
//   - 直近 7 日の合計が 0 のときは何も出さない (新規ユーザーのホームを汚さない)。
//     最初の 1 本を作った瞬間にレシートが現れる = それ自体が小さな達成体験。
//   - 生成イベント発火 ('iris-activity') と他タブ更新 ('storage') で即時リフレッシュ。
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Type, Lightbulb, IdCard, Send, Sparkles } from 'lucide-react';
import { getActivitySummary, type IrisActivityType } from './irisActivity';
import { IRIS_COLORS } from './irisStyle';

type MetaRow = {
  t: IrisActivityType;
  label: string;
  unit: string;
  icon: typeof FileText;
  accent: string;
};

// 表示順 = 価値の伝わりやすい順 (収益に近い順)
const META: MetaRow[] = [
  { t: 'script',   label: '台本',          unit: '本', icon: FileText,  accent: IRIS_COLORS.gold },
  { t: 'caption',  label: 'キャプション',  unit: '本', icon: Type,      accent: IRIS_COLORS.purpleLt },
  { t: 'ideas',    label: '企画',          unit: '件', icon: Lightbulb, accent: IRIS_COLORS.goldChampagne },
  { t: 'mediakit', label: 'メディアキット', unit: '枚', icon: IdCard,    accent: IRIS_COLORS.hotPink },
  { t: 'dm',       label: '営業DM',        unit: '通', icon: Send,      accent: IRIS_COLORS.goldDeep },
];

type Props = {
  /** mobile=コンパクト, desktop=フルワイド */
  variant?: 'mobile' | 'desktop';
};

export default function IrisValueReceipt({ variant = 'desktop' }: Props) {
  const [summary, setSummary] = useState(() => getActivitySummary(7));

  useEffect(() => {
    const refresh = () => setSummary(getActivitySummary(7));
    window.addEventListener('iris-activity', refresh);
    window.addEventListener('storage', refresh);
    // 別画面で生成→ホーム復帰した時も拾えるよう、可視化復帰でも更新
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('iris-activity', refresh);
      window.removeEventListener('storage', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  // 直近 7 日で 1 件も無ければ出さない (honest: 0 を誇示しない)
  if (summary.total <= 0) return null;

  const rows = META.filter(m => summary.byType[m.t] > 0);
  const isMobile = variant === 'mobile';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{
        position: 'relative',
        zIndex: 1,
        background: `linear-gradient(135deg, ${IRIS_COLORS.purpleDeep}22 0%, ${IRIS_COLORS.inkBlack} 100%)`,
        border: `1px solid ${IRIS_COLORS.gold}33`,
        borderRadius: 16,
        padding: isMobile ? '0.9rem 0.85rem' : '1.15rem 1.4rem',
        margin: isMobile ? '0.5rem 0.75rem' : '0 0 1rem',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isMobile ? 10 : 12 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: `${IRIS_COLORS.gold}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Sparkles size={16} color={IRIS_COLORS.gold} />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{
            fontSize: '0.6rem', letterSpacing: '0.22em',
            color: IRIS_COLORS.gold, fontWeight: 700, margin: 0,
          }}>
            THIS WEEK
          </p>
          <h3 style={{
            fontSize: isMobile ? '0.92rem' : '1.05rem',
            fontWeight: 700, color: IRIS_COLORS.cream, margin: 0, lineHeight: 1.25,
          }}>
            今週、Iris があなたのために動いた量
          </h3>
        </div>
      </div>

      <div style={{
        display: 'grid',
        // auto-fit で常に折返し可能に。デスクトップは広く詰める、狭幅(スマホ実機)では
        // カードが潰れず自然に 2〜3 列へ折り返す（携帯最優先・見切れゼロ）。
        gridTemplateColumns: isMobile
          ? 'repeat(auto-fit, minmax(96px, 1fr))'
          : 'repeat(auto-fit, minmax(108px, 1fr))',
        gap: isMobile ? 8 : 10,
      }}>
        {rows.map((m, i) => {
          const Icon = m.icon;
          const n = summary.byType[m.t];
          return (
            <motion.div
              key={m.t}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${m.accent}22`,
                borderRadius: 12,
                padding: isMobile ? '0.7rem 0.6rem' : '0.85rem 0.9rem',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: `${m.accent}22`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={15} color={m.accent} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{
                  fontSize: isMobile ? '1.35rem' : '1.5rem',
                  fontWeight: 800, color: IRIS_COLORS.cream, lineHeight: 1,
                }}>
                  {n.toLocaleString()}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
                  {m.unit}
                </span>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                {m.label}
              </div>
            </motion.div>
          );
        })}
      </div>

      <p style={{
        marginTop: isMobile ? 9 : 11, marginBottom: 0,
        fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.4,
      }}>
        直近7日で Iris が実際に作った成果物の数です。手を動かすほど、ここが積み上がります。
      </p>
    </motion.div>
  );
}
