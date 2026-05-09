// ============================================================
// Iris Health View — クリエイター向けヘルスタブ
// 美しさ = 健康。Apple Watch / Apple Health からのデータを取込み、
// 心拍・睡眠・歩数・ワークアウトを Iris のトーンで表示
// ============================================================
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AppleHealthImport } from '../components/health/AppleHealthImport';
import type { useHealth } from '../hooks/useHealth';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';

interface Props {
  bg: IrisBackgroundDef;
  health: ReturnType<typeof useHealth>;
}

export default function IrisHealthView({ bg, health }: Props) {
  const today = health.today;
  const week = health.week;

  // 7 日平均
  const avg = useMemo(() => {
    if (!week.length) return null;
    const sum = (k: keyof typeof week[0]) => week.reduce((s, d) => s + (Number(d[k]) || 0), 0);
    const n = week.length;
    return {
      steps: Math.round(sum('steps') / n),
      hr: Math.round(sum('restingHR') / n),
      sleep: +(sum('sleepHours') / n).toFixed(1),
      activeMin: Math.round(sum('activeMinutes') / n),
    };
  }, [week]);

  return (
    <div style={{ display: 'grid', gap: '1.25rem', fontFamily: IRIS_FONTS.body }}>
      {/* ヘッダ */}
      <div>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 600 }}>HEALTH</p>
        <h1 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', color: bg.ink, margin: '0.25rem 0 0.5rem', fontWeight: 500 }}>
          美しさは、内側から。
        </h1>
        <p style={{ fontSize: '0.85rem', color: bg.inkSoft, lineHeight: 1.8, fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>
          Apple Watch のデータを取り込んで、心と体の状態を可視化します。
        </p>
      </div>

      {/* 今日のサマリー */}
      {today ? (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem',
        }}>
          <Stat bg={bg} label="安静時心拍" value={today.restingHR ? String(Math.round(today.restingHR)) : '—'} unit="bpm" emoji="❤️" />
          <Stat bg={bg} label="歩数" value={today.steps?.toLocaleString('ja-JP') ?? '—'} unit="歩" emoji="👟" />
          <Stat bg={bg} label="睡眠" value={today.sleepHours ? today.sleepHours.toFixed(1) : '—'} unit="時間" emoji="🌙" />
          <Stat bg={bg} label="アクティブ時間" value={today.activeMinutes ? String(today.activeMinutes) : '—'} unit="分" emoji="🌸" />
        </div>
      ) : (
        <div style={{
          padding: '1.5rem',
          background: bg.card,
          border: `1px solid ${bg.cardBorder}`,
          borderRadius: 14,
          textAlign: 'center',
          color: bg.inkSoft,
          fontSize: '0.9rem',
          fontFamily: IRIS_FONTS.serif,
          fontStyle: 'italic',
        }}>
          まだ健康データがありません。下の「Apple Health から取込」で開始してください。
        </div>
      )}

      {/* 7 日平均 */}
      {avg && (
        <div style={{
          padding: '1.25rem 1.5rem',
          background: bg.card,
          border: `1px solid ${bg.cardBorder}`,
          borderRadius: 14,
        }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: bg.accent, fontWeight: 600, marginBottom: '0.85rem' }}>WEEKLY AVERAGE</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }} className="lp-info-row">
            <div>
              <p style={{ fontSize: '0.7rem', color: bg.inkSoft }}>心拍</p>
              <p style={{ fontSize: '1.1rem', fontWeight: 800, color: bg.ink, marginTop: 4 }}>{avg.hr} <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>bpm</span></p>
            </div>
            <div>
              <p style={{ fontSize: '0.7rem', color: bg.inkSoft }}>歩数</p>
              <p style={{ fontSize: '1.1rem', fontWeight: 800, color: bg.ink, marginTop: 4 }}>{avg.steps.toLocaleString('ja-JP')}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.7rem', color: bg.inkSoft }}>睡眠</p>
              <p style={{ fontSize: '1.1rem', fontWeight: 800, color: bg.ink, marginTop: 4 }}>{avg.sleep}<span style={{ fontSize: '0.7rem', fontWeight: 500 }}>h</span></p>
            </div>
            <div>
              <p style={{ fontSize: '0.7rem', color: bg.inkSoft }}>運動</p>
              <p style={{ fontSize: '1.1rem', fontWeight: 800, color: bg.ink, marginTop: 4 }}>{avg.activeMin}<span style={{ fontSize: '0.7rem', fontWeight: 500 }}>分</span></p>
            </div>
          </div>
        </div>
      )}

      {/* Apple Health インポート */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: '1.5rem',
          background: bg.card,
          border: `1px solid ${bg.cardBorder}`,
          borderRadius: 16,
        }}
      >
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 600, marginBottom: 6 }}>APPLE HEALTH SYNC</p>
          <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.4rem', color: bg.ink, fontWeight: 500, marginBottom: 4 }}>
            データを取込む
          </h3>
          <p style={{ fontSize: '0.85rem', color: bg.inkSoft, lineHeight: 1.85 }}>
            iPhone の「ヘルスケア」アプリ → プロフィール → 「すべての健康データを書き出す」で
            出力された <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>export.zip</code> をドラッグ＆ドロップしてください。
          </p>
        </div>

        <AppleHealthImport health={health} />
      </motion.div>

      {/* セルフケアのヒント (Iris らしい) */}
      <div style={{
        padding: '1.5rem',
        background: `linear-gradient(135deg, ${bg.accent}10, ${bg.accent}05)`,
        border: `1px solid ${bg.accent}30`,
        borderRadius: 16,
      }}>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 600, marginBottom: 8 }}>SELF-CARE</p>
        <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.25rem', color: bg.ink, fontWeight: 500, marginBottom: '0.85rem' }}>
          光を、内側から。
        </h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
          {[
            { icon: '🌙', text: '睡眠 7 時間以上 — 肌のターンオーバーは寝ている時間に' },
            { icon: '💧', text: '水 1.5L — 朝起きてすぐコップ 1 杯から' },
            { icon: '👟', text: '歩数 8000 歩 — 短時間でも血流が変わる' },
            { icon: '🌸', text: '深呼吸 5 分 — 自律神経が整い、表情が柔らかくなる' },
          ].map((t, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.85rem', color: bg.ink, lineHeight: 1.85, fontFamily: IRIS_FONTS.body }}>
              <span style={{ flexShrink: 0 }}>{t.icon}</span>
              <span>{t.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ bg, label, value, unit, emoji }: { bg: IrisBackgroundDef; label: string; value: string; unit: string; emoji: string }) {
  return (
    <div style={{
      padding: '1.1rem 1rem',
      background: bg.card,
      border: `1px solid ${bg.cardBorder}`,
      borderRadius: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: '0.95rem' }}>{emoji}</span>
        <p style={{ fontSize: '0.7rem', color: bg.inkSoft, letterSpacing: '0.05em', fontWeight: 600 }}>{label}</p>
      </div>
      <p style={{ fontFamily: IRIS_FONTS.display, fontSize: '1.45rem', fontWeight: 700, color: bg.ink }}>
        {value}<span style={{ fontSize: '0.7rem', color: bg.inkSoft, marginLeft: 4, fontWeight: 500 }}>{unit}</span>
      </p>
    </div>
  );
}
