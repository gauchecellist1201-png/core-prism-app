// ============================================================
// IrisEarningsHero — Iris home の「稼げる + 楽できる」3 連ヒーロー
//
// オーナー指示 (2026-05-25):
//   Prism 側の EarningsAndTimeHero と同じ思想を、Iris (クリエイター) 文脈に翻訳。
//   3 列の主要数字:
//     1) 今月稼いだ        (ピンク #E1306C)  — closed 案件の fee 合計 (updatedAt が今月)
//     2) 来月の見込み      (紫 #833AB4)      — 進行中案件 × 確度 (stage → 確度マップ)
//     3) AI が代わりに動いた回数 (オレンジ #F77737) — useAgentTaskQueue の recentDone を
//        Iris 関連 CXO (CMO / CDS / UXE / CDO) で count + 時短換算
//
// 数字 0 / 未連携時は「—」表示。実績ゼロを盛らない。
// ============================================================
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useAgentTaskQueue, type CxoRole } from '../hooks/useAgentTaskQueue';
import type { InfluencerDeal, DealStage } from '../types/influencerDeal';
import type { IgProfile } from './instagramConnect';
import { DUR_BASE, EASE_OUT, EASE_OUT_FM } from './motion';

interface Props {
  myDeals: InfluencerDeal[];
  igProfile?: IgProfile | null;
  /** 案件タブへの遷移 */
  onOpenDeals?: () => void;
  /** Instagram 接続 */
  onConnectInstagram?: () => void;
}

// 時給デフォルト
const DEFAULT_HOURLY_JPY = 3000;

// ステージ → 確度 (%) マップ (オーナー指示: high 90 / mid 50 / low 20)
const STAGE_CONFIDENCE: Record<DealStage, number> = {
  // high — もう決まりに近い
  'contracted':      90,
  'drafting':        90,
  'draft-submitted': 90,
  'approved':        90,
  'posted':          90,   // 投稿済み = 入金待ち
  'reported':        90,
  // mid — まだ条件詰め中
  'negotiating':     50,
  // low — 初回打診
  'inquiry':         20,
  // 数えない
  'closed':          0,
  'declined':        0,
};

// Iris に関わる CXO (オーナー指示: CMO / CDS / UXE 中心 + CDO も含める)
const IRIS_RELEVANT_CXO: ReadonlySet<CxoRole> = new Set<CxoRole>([
  'CMO', 'CDS', 'UXE', 'CDO', 'CPO',
]);

// タスクタイトルから推定する節約分 (分)
//   DM 下書き 8 / 案件取り込み 5 / 戦略提案 25 / リール構成 35 / その他 12
function estimateSavedMinutes(title: string): number {
  const t = (title || '').toLowerCase();
  if (/dm|ダイレクト|メッセージ|下書き/.test(t)) return 8;
  if (/案件|deal|取り込み|キャプチャ/.test(t)) return 5;
  if (/戦略|strateg|分析|insight/.test(t)) return 25;
  if (/リール|reel|動画|video|shorts/.test(t)) return 35;
  if (/キャプション|caption|投稿|post/.test(t)) return 13;
  if (/サムネ|画像|image|thumb/.test(t)) return 18;
  return 12;
}

function formatJpy(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  return '¥' + Math.round(n).toLocaleString('ja-JP');
}

function formatCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  return Math.round(n).toLocaleString('ja-JP') + ' 回';
}

function greetByHour(): { line1: string; line2: string } {
  const h = new Date().getHours();
  if (h < 11) return { line1: 'おはようございます。', line2: 'Iris があなたの今月をサポート中。' };
  if (h < 17) return { line1: 'お疲れ様です。', line2: '今のあなたの数字と、AI が代わりに動いた回数です。' };
  return { line1: '今日もお疲れさまでした。', line2: '今日の成果と、明日の見込みを置いておきます。' };
}

// =============== カウントアップ ===============
function CountUp({ value, formatter, durationMs = 1500 }: {
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
      ease: [0.22, 1, 0.36, 1],
    });
    const unsub = rounded.on('change', (v) => setDisplay(v));
    return () => { controls.stop(); unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span>{display}</span>;
}

// =============== カード ===============
interface CardProps {
  accent: string;
  label: string;
  value: number | null;
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
      transition={{ duration: 0.45, delay, ease: EASE_OUT_FM }}
      whileHover={{ y: -2 }}
      style={{
        position: 'relative',
        flex: 1,
        minWidth: 0,
        padding: '1.1rem 1rem 1rem 1.15rem',
        borderRadius: 16,
        background: 'rgba(255,255,255,0.72)',
        border: '1px solid rgba(225,48,108,0.14)',
        backdropFilter: 'blur(14px)',
        overflow: 'hidden',
        cursor: emptyCta && isEmpty ? 'pointer' : 'default',
        boxShadow: '0 8px 22px rgba(225,48,108,0.07)',
        transition: `background ${DUR_BASE}s ${EASE_OUT}`,
      }}
      onClick={() => { if (emptyCta && isEmpty) emptyCta.onClick(); }}
    >
      {/* 左端 4px アクセントバー */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0, top: 10, bottom: 10,
          width: 4,
          borderRadius: 4,
          background: `linear-gradient(180deg, ${accent}, ${accent}99)`,
          boxShadow: `0 0 18px ${accent}55`,
        }}
      />

      <div style={{
        fontSize: 10.5,
        letterSpacing: '0.18em',
        fontWeight: 800,
        color: '#7A6B7A',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        {label}
      </div>

      <div
        style={{
          fontFamily: '"SF Mono", "JetBrains Mono", "Menlo", monospace',
          fontSize: 'clamp(1.7rem, 5.6vw, 2.3rem)',
          fontWeight: 700,
          lineHeight: 1.1,
          color: isEmpty ? '#B5A7B5' : accent,
          letterSpacing: '-0.02em',
          textShadow: isEmpty ? 'none' : `0 0 22px ${accent}33`,
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
        color: '#5A5562',
        lineHeight: 1.5,
      }}>
        {subtitle}
      </div>

      {isEmpty && emptyCta && (
        <div style={{
          marginTop: 10,
          fontSize: 12,
          fontWeight: 700,
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
export default function IrisEarningsHero({ myDeals, igProfile, onOpenDeals, onConnectInstagram }: Props) {
  const queue = useAgentTaskQueue();
  const greet = useMemo(greetByHour, []);

  // 今月の範囲
  const monthRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    return { start, end };
  }, []);

  // (1) 今月稼いだ — closed 状態 + updatedAt が今月
  const thisMonthEarned = useMemo(() => {
    return myDeals
      .filter(d => d.stage === 'closed')
      .filter(d => {
        const t = new Date(d.updatedAt).getTime();
        return t >= monthRange.start && t < monthRange.end;
      })
      .reduce((s, d) => s + (d.fee || 0), 0);
  }, [myDeals, monthRange]);

  // 先月稼いだ — 比較用
  const lastMonthEarned = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const end = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return myDeals
      .filter(d => d.stage === 'closed')
      .filter(d => {
        const t = new Date(d.updatedAt).getTime();
        return t >= start && t < end;
      })
      .reduce((s, d) => s + (d.fee || 0), 0);
  }, [myDeals]);

  const momPct = useMemo(() => {
    if (lastMonthEarned <= 0) return null;
    return (thisMonthEarned - lastMonthEarned) / lastMonthEarned;
  }, [thisMonthEarned, lastMonthEarned]);

  // (2) 来月の見込み — 進行中案件 × 確度
  const nextMonthForecast = useMemo(() => {
    const active = myDeals.filter(d => d.stage !== 'closed' && d.stage !== 'declined');
    return active.reduce((s, d) => s + (d.fee || 0) * (STAGE_CONFIDENCE[d.stage] / 100), 0);
  }, [myDeals]);

  const activeDealCount = useMemo(
    () => myDeals.filter(d => d.stage !== 'closed' && d.stage !== 'declined').length,
    [myDeals]
  );

  // (3) AI が動いた回数
  //   recentDone は 5 件 cap なので、tasks 全件から「今月 done + Iris 関連 CXO」を絞り込む
  const aiActivity = useMemo(() => {
    const now = new Date();
    const monthStartMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const allDone = (queue.tasks || []).filter(t =>
      t.status === 'done' &&
      t.completedAt &&
      new Date(t.completedAt).getTime() >= monthStartMs
    );
    const irisDone = allDone.filter(t =>
      t.steps.some(s => IRIS_RELEVANT_CXO.has(s.cxo) && s.status === 'done')
    );
    const totalMin = irisDone.reduce((s, t) => s + estimateSavedMinutes(t.title || ''), 0);
    const hours = totalMin / 60;
    const moneyEq = hours * DEFAULT_HOURLY_JPY;
    return { count: irisDone.length, hours, moneyEq };
  }, [queue.tasks]);

  const hasAnything = thisMonthEarned > 0 || nextMonthForecast > 0 || aiActivity.count > 0;

  // 表示名 — オーナーは個人 1 IG なので handle 優先 (なければ「クリエイター」)
  const displayName = igProfile?.handle ? `@${igProfile.handle}` : 'クリエイター';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT_FM }}
      style={{
        position: 'relative',
        padding: '1.3rem 1.1rem 1.15rem',
        borderRadius: 22,
        background: `linear-gradient(135deg,
          rgba(225,48,108,0.10),
          rgba(131,58,180,0.10) 50%,
          rgba(247,119,55,0.10))`,
        border: '1px solid rgba(225,48,108,0.22)',
        boxShadow: '0 12px 36px rgba(225,48,108,0.12)',
        overflow: 'hidden',
        marginBottom: '1rem',
      }}
    >
      {/* 装飾オーブ */}
      <div aria-hidden style={{
        position: 'absolute', top: -70, right: -70,
        width: 240, height: 240, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(225,48,108,0.28) 0%, transparent 70%)',
        filter: 'blur(50px)', pointerEvents: 'none',
      }} />
      <div aria-hidden style={{
        position: 'absolute', bottom: -60, left: -40,
        width: 200, height: 200, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(131,58,180,0.28) 0%, transparent 70%)',
        filter: 'blur(50px)', pointerEvents: 'none',
      }} />

      {/* ヘッダ */}
      <div style={{ position: 'relative', zIndex: 1, marginBottom: '1.1rem' }}>
        <div style={{
          fontSize: 10,
          letterSpacing: '0.3em',
          fontWeight: 800,
          color: '#E1306C',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}>
          ✦ YOUR EARNINGS & AI WORK
        </div>
        <h2 style={{
          margin: 0,
          fontSize: 'clamp(1.15rem, 3.6vw, 1.5rem)',
          fontWeight: 700,
          color: '#1F1A2E',
          fontFamily: '"Playfair Display", "Cormorant Garamond", serif',
          letterSpacing: '-0.01em',
          lineHeight: 1.25,
        }}>
          {displayName} さん、{greet.line1}
        </h2>
        <p style={{
          margin: '0.35rem 0 0',
          fontSize: 12.5,
          color: '#5A5562',
          lineHeight: 1.55,
        }}>
          {hasAnything
            ? greet.line2
            : 'まだ数字は空っぽです。案件を 1 件入れると、ここに数字が積み上がります。'}
        </p>
      </div>

      {/* 3 連カード */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.7rem',
        }}
      >
        {/* (1) 今月稼いだ — ピンク */}
        <MetricCard
          accent="#E1306C"
          label="今月稼いだ"
          value={thisMonthEarned > 0 ? thisMonthEarned : null}
          valueFormatter={formatJpy}
          subtitle={
            thisMonthEarned > 0 && momPct !== null
              ? `先月比 ${momPct >= 0 ? '+' : ''}${(momPct * 100).toFixed(1)}%`
              : thisMonthEarned > 0
                ? `今月 ${myDeals.filter(d => d.stage === 'closed' && new Date(d.updatedAt).getTime() >= monthRange.start).length} 件 入金完了`
                : '案件を登録して入金完了にすると、ここに出ます'
          }
          emptyCta={thisMonthEarned <= 0 && onOpenDeals
            ? { text: '案件を登録する', onClick: onOpenDeals }
            : null}
          delay={0.05}
        />

        {/* (2) 来月の見込み — 紫 */}
        <MetricCard
          accent="#833AB4"
          label="来月の見込み"
          value={nextMonthForecast > 0 ? nextMonthForecast : null}
          valueFormatter={formatJpy}
          subtitle={
            activeDealCount > 0
              ? `進行中 ${activeDealCount} 件 / 確度加重 (打診 20% / 交渉 50% / 確定 90%)`
              : '進行中の案件を入れると、来月の数字が見えます'
          }
          emptyCta={activeDealCount === 0 && onOpenDeals
            ? { text: '案件を探す', onClick: onOpenDeals }
            : null}
          delay={0.1}
        />

        {/* (3) AI が動いた回数 — オレンジ */}
        <MetricCard
          accent="#F77737"
          label="AI が代わりに動いた"
          value={aiActivity.count > 0 ? aiActivity.count : null}
          valueFormatter={formatCount}
          subtitle={
            aiActivity.count > 0
              ? `DM 下書き / 案件取り込み / 戦略提案 など — 通常なら ${aiActivity.hours.toFixed(1)} 時間 (≈ ${formatJpy(aiActivity.moneyEq)})`
              : 'タスクを AI に任せると、ここに回数が積み上がります'
          }
          emptyCta={aiActivity.count === 0 && !igProfile && onConnectInstagram
            ? { text: 'Instagram をつなぐ', onClick: onConnectInstagram }
            : null}
          delay={0.15}
        />
      </div>

      {/* 帯下 micro-copy */}
      <div style={{
        position: 'relative', zIndex: 1,
        marginTop: '0.85rem',
        fontSize: 11,
        color: '#5A5562',
        opacity: 0.8,
        textAlign: 'center',
        letterSpacing: '0.02em',
      }}>
        {hasAnything
          ? 'Iris が稼ぐ仕事を集め、AI が手を動かす。あなたはカメラの前にいるだけ。'
          : '使えば使うほど、稼げる金額と AI が動いた回数が積み上がります。'}
      </div>
    </motion.div>
  );
}
