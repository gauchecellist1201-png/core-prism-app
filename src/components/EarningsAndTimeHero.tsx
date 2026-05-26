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
  const clickable = !!(emptyCta && isEmpty);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: 'easeOut' }}
      whileHover={clickable ? { y: -3, borderColor: `${accent}55` } : { y: -2 }}
      style={{
        position: 'relative',
        flex: 1,
        minWidth: 0,
        padding: '1.15rem 1rem 1.05rem 1.2rem',
        borderRadius: 16,
        background: clickable ? `${accent}08` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${clickable ? `${accent}30` : 'rgba(255,255,255,0.07)'}`,
        overflow: 'hidden',
        cursor: clickable ? 'pointer' : 'default',
        transition: 'background 0.2s ease, border-color 0.2s ease',
      }}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={() => { if (clickable) emptyCta!.onClick(); }}
      onKeyDown={(e) => {
        if (clickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          emptyCta!.onClick();
        }
      }}
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
  //   嘘禁止: 過去売上 0 円 + pipeline も極小 (< ¥10,000) の時は「¥600」のような
  //   誤解を招く数字を出さず null を返す (オーナー報告 2026-05-26)
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
    // 過去 Stripe 売上が 0 で、pipeline の確度加重が 1 万円未満 → 数字としては誤解を招く
    if (base === 0 && total < 10000) return null;
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
  //   recentDone は表示用に 5 件 cap されているので、count に使うと過少表示になる。
  //   今月の done 全件を tasks から計算する。
  const aiSaved = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const monthStartMs = monthStart.getTime();
    const done = (queue.tasks || []).filter(t =>
      t.status === 'done' &&
      t.completedAt &&
      new Date(t.completedAt).getTime() >= monthStartMs
    );
    const totalMin = done.reduce((s, t) => s + estimateSavedMinutes(t.title || ''), 0);
    const hours = totalMin / 60;
    const moneyEq = (totalMin / 60) * DEFAULT_HOURLY_JPY;
    return { count: done.length, totalMin, hours, moneyEq };
  }, [queue.tasks]);

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

      {/* Stripe 接続診断 (オーナー指示 2026-05-26: 反映されないのに「成功」と出る問題を可視化) */}
      <StripeDiagnosticChip stripe={stripe} onReconnect={onConnectStripe} />
    </motion.div>
  );
}

function StripeDiagnosticChip({ stripe, onReconnect }: {
  stripe: ReturnType<typeof useStripeRevenue>;
  onReconnect?: () => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [rawDiag, setRawDiag] = useState<string>('まだ取得していません');
  const [diagLoading, setDiagLoading] = useState(false);

  const fetchRawDiag = async () => {
    setDiagLoading(true);
    try {
      const key = localStorage.getItem('core_integration_stripe') || '';
      const masterKey = localStorage.getItem('core_master_key_v1') || '';
      const headers: Record<string, string> = {};
      if (key) headers['x-stripe-key'] = key;
      if (masterKey) headers['x-master-key'] = masterKey;
      // バスター付き URL でキャッシュ完全バイパス
      const r = await fetch('/api/revenue/snapshot?_bust=' + Date.now(), { headers });
      const text = await r.text();
      let parsed: any;
      try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
      const summary = {
        'HTTP ステータス': r.status,
        'キー先頭': key.slice(0, 12) || '(空)',
        'キー長さ': key.length,
        'マスターキー有無': !!masterKey,
        '今月の件数': parsed?.thisMonth?.txnCount,
        '今月の売上 JPY': parsed?.thisMonth?.revenueJpy,
        '通貨': parsed?.currencies,
        '診断 (diag)': parsed?.diag || '(なし — 旧コードのレスポンス)',
        'エラー': parsed?.error,
        'エラーメッセージ': parsed?.message,
        '取得時刻': new Date().toLocaleTimeString('ja-JP'),
      };
      setRawDiag(JSON.stringify(summary, null, 2));
    } catch (e: any) {
      setRawDiag('取得失敗: ' + String(e?.message || e));
    } finally {
      setDiagLoading(false);
    }
  };

  // モーダル開いたら即診断
  useEffect(() => {
    if (detailOpen) fetchRawDiag();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailOpen]);


  const state: { tone: 'green' | 'yellow' | 'red' | 'gray'; line1: string; line2: string } = (() => {
    if (stripe.loading) {
      return { tone: 'yellow', line1: '⏳ Stripe から取得中…', line2: '数秒お待ちください' };
    }
    if (stripe.error) {
      return { tone: 'red', line1: '🔴 Stripe エラー', line2: stripe.error };
    }
    if (!stripe.connected) {
      return { tone: 'gray', line1: '⚪ Stripe 未連携', line2: '右上の連携センターから rk_live_ を貼ると数字が出ます' };
    }
    if (stripe.source === 'manual') {
      return { tone: 'yellow', line1: '📝 手動入力データ (Stripe 未連携)', line2: 'rk_live_ を貼ると自動取得に切り替わります' };
    }
    const tm = stripe.thisMonth;
    if ((tm.txnCount || 0) === 0 && (tm.revenueJpy || 0) === 0) {
      // 診断情報から具体的な原因を割り出す (オーナー指示 2026-05-26)
      const d = stripe.diag;
      if (d) {
        if (d.chargesOk && (d.chargesCount || 0) === 0) {
          return {
            tone: 'yellow',
            line1: `🟡 Stripe 連携中 (${stripe.keyMasked}) — Charges 12 ヶ月で 0 件`,
            line2: '本当に取引が無いか、別の Stripe アカウントの可能性。ダッシュボード URL (acct_xxx) と一致するキーを使ってください',
          };
        }
        if (!d.chargesOk) {
          return {
            tone: 'red',
            line1: `🔴 Stripe — Charges 取得失敗`,
            line2: `Stripe で「Charges → 読み取り」を有効にして作り直してください。詳細: ${(d.errors || []).join(' / ')}`,
          };
        }
      }
      return {
        tone: 'yellow',
        line1: `🟡 Stripe 連携中 (${stripe.keyMasked}) — 取引 0 件`,
        line2: '今月の取引がまだ無いか、キーの権限不足の可能性。Stripe で Charges を「読み取り」に',
      };
    }
    return {
      tone: 'green',
      line1: `✓ Stripe 連携中 (${stripe.keyMasked}) — 今月 ${tm.txnCount} 件`,
      line2: `売上 ¥${Math.round(tm.revenueJpy).toLocaleString()} / 経費 ¥${Math.round(tm.expenseJpy).toLocaleString()}`,
    };
  })();

  const colors = {
    green:  { bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.35)', fg: '#34D399' },
    yellow: { bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.35)',  fg: '#FBBF24' },
    red:    { bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.40)', fg: '#F87171' },
    gray:   { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.10)', fg: 'rgba(255,255,255,0.55)' },
  }[state.tone];

  return (
    <div style={{
      position: 'relative', zIndex: 1,
      marginTop: '0.7rem',
      padding: '8px 12px', borderRadius: 10,
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: colors.fg, lineHeight: 1.4 }}>
          {state.line1}
        </div>
        <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.55, marginTop: 1 }}>
          {state.line2}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {stripe.connected && stripe.source === 'stripe' && (
          <button
            type="button"
            onClick={() => stripe.refresh?.()}
            disabled={stripe.loading}
            style={{
              fontSize: 10.5, fontWeight: 700, color: colors.fg,
              background: 'transparent',
              border: `1px solid ${colors.border}`,
              borderRadius: 6, padding: '4px 8px', cursor: stripe.loading ? 'wait' : 'pointer',
            }}
          >🔄 再取得</button>
        )}
        <button
          type="button"
          onClick={() => setDetailOpen(o => !o)}
          style={{
            fontSize: 10.5, fontWeight: 700, color: '#fff',
            background: 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
          }}
        >🔍 詳細</button>
        {onReconnect && (
          <button
            type="button"
            onClick={onReconnect}
            style={{
              fontSize: 10.5, fontWeight: 700, color: '#fff',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
            }}
          >連携センター</button>
        )}
      </div>
      {detailOpen && (
        <div style={{
          width: '100%', marginTop: 8,
          background: 'rgba(0,0,0,0.55)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8, padding: '8px 10px',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 6,
          }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#FBBF24' }}>
              📋 詳細診断 (このテキストをコピーしてイーロンに送ってください)
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={fetchRawDiag}
                disabled={diagLoading}
                style={{
                  fontSize: 10, fontWeight: 700, color: '#fff',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 5, padding: '2px 7px', cursor: diagLoading ? 'wait' : 'pointer',
                }}
              >{diagLoading ? '取得中…' : '🔄 再診断'}</button>
              <button
                type="button"
                onClick={() => {
                  try {
                    navigator.clipboard.writeText(rawDiag);
                  } catch { /* */ }
                }}
                style={{
                  fontSize: 10, fontWeight: 700, color: '#fff',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 5, padding: '2px 7px', cursor: 'pointer',
                }}
              >📋 コピー</button>
            </div>
          </div>
          <pre style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 10.5, lineHeight: 1.55,
            color: 'rgba(255,255,255,0.85)',
            margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            maxHeight: 280, overflowY: 'auto',
          }}>{rawDiag}</pre>
        </div>
      )}
    </div>
  );
}
