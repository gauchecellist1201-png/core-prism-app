// ============================================================
// EarningsAndTimeHero — 「このアプリで稼げる / 楽できる」を一目で
//
// オーナー指示 (2026-05-25):
//   ユーザーがこのアプリを開いた瞬間に
//   「稼げそう / 楽できそう」というビジョンが浮かぶように、
//   数字と時間を主役にした 3 連カードを Dashboard 最上部に表示する。
//
//   3 列の主要数字:
//     1) 今月稼いだ  (緑)  — Stripe 実値、未連携時はヒント表示
//     2) 来月の見込み (青)  — 直近 3 ヶ月平均 + 案件 pipeline の確度加重
//     3) AI が取り戻した時間 (紫) — 完了タスク × 推定節約分 × 時給
//
//   嘘禁止 — 数字が無い時は「—」で表示、推測は出さない。
//   触覚: 数字は monospace + カウントアップ + 微小ホバーリフト。
// ============================================================
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useStripeRevenue } from '../hooks/useStripeRevenue';
import { useAgentTaskQueue } from '../hooks/useAgentTaskQueue';
import { useCRM } from '../hooks/useCRM';
import type { Persona } from '../types/identity';

interface Props {
  persona: Persona;
  /** Stripe 未連携時に「Stripe をつなぐ」CTA を発火するための callback */
  onConnectStripe?: () => void;
}

// 時給デフォルト (オーナー設定があれば将来上書き)
const DEFAULT_HOURLY_JPY = 3000;

// タスク title から推定する節約分 (分)
//   議事録 27 / 営業 18 / レシート 2.5 / SNS 13 / その他 10
function estimateSavedMinutes(title: string): number {
  const t = (title || '').toLowerCase();
  if (/議事録|会議|minutes|meeting/.test(t)) return 27;
  if (/営業|提案|アプローチ|sales|outreach|商談/.test(t)) return 18;
  if (/レシート|経費|expense|receipt/.test(t)) return 2.5;
  if (/sns|note|x投稿|tweet|post|投稿/.test(t)) return 13;
  if (/メール|email|返信|reply/.test(t)) return 8;
  if (/スライド|資料|slide|deck|pptx/.test(t)) return 35;
  return 10;
}

function formatJpy(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  return '¥' + Math.round(n).toLocaleString('ja-JP');
}

function greetByHour(): { line1: string; line2: string } {
  const h = new Date().getHours();
  if (h < 11) return { line1: 'おはようございます。', line2: '今日も「稼ぐ」と「楽する」を AI と一緒に。' };
  if (h < 17) return { line1: 'お疲れ様です。', line2: '今のあなたの数字と、取り戻した時間です。' };
  return { line1: '今日もお疲れさまでした。', line2: '今日の成果と、明日の見込みを置いておきます。' };
}

// =============== カウントアップ表示 ===============
function CountUp({ value, formatter, durationMs = 1600 }: {
  value: number;
  formatter: (n: number) => string;
  durationMs?: number;
}) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (latest) => formatter(latest));
  const [display, setDisplay] = useState(formatter(0));

  useEffect(() => {
    const controls = animate(mv, value, {
      duration: durationMs / 1000,
      ease: [0.22, 1, 0.36, 1], // easeOutCubic-ish
    });
    const unsub = rounded.on('change', (v) => setDisplay(v));
    return () => { controls.stop(); unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span>{display}</span>;
}

// =============== 1 枚分のカード ===============
interface CardProps {
  accent: string;
  label: string;
  value: number | null;          // null = データなし (— を出す)
  valueFormatter: (n: number) => string;
  subtitle: string;
  emptyCta?: { text: string; onClick: () => void } | null;
  delay?: number;
}

function MetricCard({ accent, label, value, valueFormatter, subtitle, emptyCta, delay = 0 }: CardProps) {
  const isEmpty = value === null || !Number.isFinite(value as number) || (value as number) <= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      style={{
        position: 'relative',
        flex: 1,
        minWidth: 0,
        padding: '1.15rem 1rem 1.05rem 1.2rem',
        borderRadius: 16,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        overflow: 'hidden',
        cursor: emptyCta && isEmpty ? 'pointer' : 'default',
        transition: 'background 0.2s ease',
      }}
      onClick={() => { if (emptyCta && isEmpty) emptyCta.onClick(); }}
    >
      {/* 左端 4px アクセントバー (Stripe 風) */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0, top: 10, bottom: 10,
          width: 4,
          borderRadius: 4,
          background: accent,
          boxShadow: `0 0 18px ${accent}66`,
        }}
      />

      <div style={{
        fontSize: 10.5,
        letterSpacing: '0.18em',
        fontWeight: 700,
        color: 'var(--fg-muted)',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        {label}
      </div>

      <div
        style={{
          fontFamily: '"SF Mono", "JetBrains Mono", "Menlo", monospace',
          fontSize: 'clamp(1.8rem, 5.8vw, 2.4rem)',
          fontWeight: 700,
          lineHeight: 1.1,
          color: isEmpty ? 'var(--fg-muted)' : accent,
          letterSpacing: '-0.02em',
          textShadow: isEmpty ? 'none' : `0 0 24px ${accent}33`,
        }}
      >
        {isEmpty
          ? '—'
          : <CountUp value={value as number} formatter={valueFormatter} />
        }
      </div>

      <div style={{
        marginTop: 8,
        fontSize: 12.5,
        color: 'var(--fg-muted)',
        lineHeight: 1.5,
      }}>
        {subtitle}
      </div>

      {isEmpty && emptyCta && (
        <div style={{
          marginTop: 10,
          fontSize: 12,
          fontWeight: 600,
          color: accent,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}>
          {emptyCta.text} →
        </div>
      )}
    </motion.div>
  );
}

// =============== 本体 ===============
export default function EarningsAndTimeHero({ persona, onConnectStripe }: Props) {
  const stripe = useStripeRevenue();
  const queue = useAgentTaskQueue();
  const crm = useCRM();

  const greet = useMemo(greetByHour, []);

  // (1) 今月稼いだ
  const thisMonthRev = stripe.connected ? (stripe.thisMonth.revenueJpy || 0) : 0;
  const momPct = stripe.momGrowth; // number | null

  // (2) 来月の見込み
  //   直近 3 ヶ月平均 + 進行中案件 (won 以外 / lost 以外) の amount × probability/100
  const next3Forecast = useMemo(() => {
    if (!stripe.connected) return null;
    const sum3 = stripe.sumMonths(3).revenueJpy;
    const base = sum3 > 0 ? sum3 / 3 : 0;

    const personaDeals = crm.deals.filter(d =>
      d.personaId === persona.id &&
      d.stage !== 'won' &&
      d.stage !== 'lost'
    );
    const pipelineWeighted = personaDeals.reduce(
      (s, d) => s + (d.amount || 0) * ((d.probability ?? 0) / 100),
      0
    );

    const total = base + pipelineWeighted;
    return total > 0 ? total : null;
  }, [stripe, crm.deals, persona.id]);

  const pipelineDealCount = useMemo(() =>
    crm.deals.filter(d =>
      d.personaId === persona.id &&
      d.stage !== 'won' &&
      d.stage !== 'lost'
    ).length
  , [crm.deals, persona.id]);

  // (3) AI が取り戻した時間
  const aiSaved = useMemo(() => {
    const done = queue.recentDone || [];
    const totalMin = done.reduce((s, t) => s + estimateSavedMinutes(t.title || ''), 0);
    const hours = totalMin / 60;
    const moneyEq = (totalMin / 60) * DEFAULT_HOURLY_JPY;
    return { count: done.length, totalMin, hours, moneyEq };
  }, [queue.recentDone]);

  // --- 数字が全く無い時は、「これから貯まります」モードで控えめに ---
  const hasAnything =
    thisMonthRev > 0 ||
    (next3Forecast !== null && next3Forecast > 0) ||
    aiSaved.count > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        position: 'relative',
        padding: '1.3rem 1.1rem 1.15rem',
        borderRadius: 22,
        background: `linear-gradient(135deg,
          rgba(52,211,153,0.10),
          rgba(46,111,255,0.10) 50%,
          rgba(142,92,255,0.12))`,
        border: '1px solid rgba(142,92,255,0.22)',
        boxShadow: '0 12px 36px rgba(20, 20, 40, 0.25)',
        overflow: 'hidden',
      }}
    >
      {/* 装飾オーブ */}
      <div aria-hidden style={{
        position: 'absolute', top: -70, right: -70,
        width: 240, height: 240, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(52,211,153,0.28) 0%, transparent 70%)',
        filter: 'blur(50px)', pointerEvents: 'none',
      }} />
      <div aria-hidden style={{
        position: 'absolute', bottom: -60, left: -40,
        width: 200, height: 200, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(142,92,255,0.28) 0%, transparent 70%)',
        filter: 'blur(50px)', pointerEvents: 'none',
      }} />

      {/* ヘッダ */}
      <div style={{ position: 'relative', zIndex: 1, marginBottom: '1.1rem' }}>
        <div style={{
          fontSize: 10,
          letterSpacing: '0.3em',
          fontWeight: 800,
          color: '#34D399',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}>
          ✦ YOUR MONEY & TIME
        </div>
        <h2 style={{
          margin: 0,
          fontSize: 'clamp(1.15rem, 3.6vw, 1.5rem)',
          fontWeight: 700,
          color: 'var(--fg)',
          letterSpacing: '-0.01em',
          lineHeight: 1.25,
        }}>
          {persona.name} さん、{greet.line1}
        </h2>
        <p style={{
          margin: '0.35rem 0 0',
          fontSize: 12.5,
          color: 'var(--fg-muted)',
          lineHeight: 1.55,
        }}>
          {hasAnything
            ? greet.line2
            : 'まだ数字は空っぽです。これから 1 つずつ貯まっていきます。'}
        </p>
      </div>

      {/* 3 連カード — モバイルは縦、デスクトップは横 */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.7rem',
        }}
      >
        {/* (1) 今月稼いだ — 緑 */}
        <MetricCard
          accent="#34D399"
          label="今月稼いだ"
          value={stripe.connected && thisMonthRev > 0 ? thisMonthRev : null}
          valueFormatter={formatJpy}
          subtitle={
            !stripe.connected
              ? 'Stripe をつなぐと、今月の売上が出ます'
              : thisMonthRev > 0 && momPct !== null
                ? `先月比 ${momPct >= 0 ? '+' : ''}${(momPct * 100).toFixed(1)}%`
                : thisMonthRev > 0
                  ? `今月 ${stripe.thisMonth.txnCount} 件の取引`
                  : 'まだ今月の取引はありません'
          }
          emptyCta={!stripe.connected && onConnectStripe
            ? { text: 'Stripe をつなぐ', onClick: onConnectStripe }
            : null}
          delay={0.05}
        />

        {/* (2) 来月の見込み — 青 */}
        <MetricCard
          accent="#2E6FFF"
          label="来月の見込み"
          value={next3Forecast}
          valueFormatter={formatJpy}
          subtitle={
            !stripe.connected
              ? '案件を入れると、来月の数字が見えます'
              : pipelineDealCount > 0
                ? `直近 3 ヶ月の平均 + 進行中 ${pipelineDealCount} 件の確度加重`
                : '直近 3 ヶ月の平均 (案件を入れるとさらに伸びます)'
          }
          delay={0.1}
        />

        {/* (3) AI が取り戻した時間 — 紫 */}
        <MetricCard
          accent="#8E5CFF"
          label="AI が取り戻した時間"
          value={aiSaved.moneyEq > 0 ? aiSaved.moneyEq : null}
          valueFormatter={(n) => `${formatJpy(n)} 相当`}
          subtitle={
            aiSaved.count > 0
              ? `今月 ${aiSaved.count} 件 AI 完了 → 通常なら ${aiSaved.hours.toFixed(1)} 時間かかってた`
              : 'タスクを AI に任せると、時間が貯まっていきます'
          }
          delay={0.15}
        />
      </div>

      {/* 帯下 micro-copy */}
      <div style={{
        position: 'relative', zIndex: 1,
        marginTop: '0.85rem',
        fontSize: 11,
        color: 'var(--fg-muted)',
        opacity: 0.75,
        textAlign: 'center',
        letterSpacing: '0.02em',
      }}>
        {hasAnything
          ? 'AI が稼ぐ・楽にする。あなたは決めるだけ。'
          : '使えば使うほど、稼げる金額と取り戻した時間が積み上がります。'}
      </div>
    </motion.div>
  );
}
