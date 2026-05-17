// ============================================================
// KpiActualsTab — 実行値 KPI ダッシュボード (Stripe + 手動上書き)
// /strategy の「KPI 実行値」タブ
// オーナー専用 (StrategyDashboard 内で master モード時のみ呼ばれる)
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CountUp, RingProgress } from '../components/visualFx';
import {
  fetchRevenueSnapshot,
  readOverride,
  writeOverride,
  clearOverride,
  fmtJpy,
  fmtJpyShort,
  type RevenueSnapshot,
  type RevenueOverride,
} from '../lib/revenue';
import { CURRENT_MRR_TARGET_JPY, MRR_TARGET_QUARTERS, computeKpiGaps, type KpiGap, formatKpiValue } from '../lib/kpiAggregator';

const FONT_DISPLAY = '"Cinzel", "Noto Serif JP", serif';
const FONT_SERIF_JA = '"Noto Serif JP", "游明朝", serif';

type Scenario = 'conservative' | 'base' | 'aggressive';
const SCENARIO_LABELS: Record<Scenario, string> = {
  conservative: '保守シナリオ目標',
  base: '基準シナリオ目標',
  aggressive: '強気シナリオ目標',
};

interface KpiActualsTabProps {
  scenarioMrrTargetJpy: number;
  scenario: Scenario;
}

export default function KpiActualsTab({ scenarioMrrTargetJpy, scenario }: KpiActualsTabProps) {
  const [snap, setSnap] = useState<RevenueSnapshot | null>(null);
  const [kpiGaps, setKpiGaps] = useState<KpiGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RevenueOverride>(() => readOverride());
  const [refreshAt, setRefreshAt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchRevenueSnapshot(), computeKpiGaps()])
      .then(([s, g]) => {
        if (cancelled) return;
        setSnap(s);
        setKpiGaps(g);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshAt]);

  const saveDraft = () => {
    writeOverride(draft);
    setEditing(false);
    setRefreshAt(Date.now());
  };
  const resetOverride = () => {
    clearOverride();
    setDraft({});
    setEditing(false);
    setRefreshAt(Date.now());
  };

  const mrrTarget = scenarioMrrTargetJpy || CURRENT_MRR_TARGET_JPY;
  const mrrActual = snap?.totals.mrrJpy || 0;
  const mrrGap = mrrActual - mrrTarget;
  const mrrAchievement = mrrTarget > 0 ? (mrrActual / mrrTarget) * 100 : 0;
  const mrrColor = mrrAchievement >= 100 ? '#86efac' : mrrAchievement >= 60 ? '#fbbf24' : '#fca5a5';

  const peakMonthlyMrr = useMemo(() => {
    if (!snap) return 0;
    return Math.max(1, ...snap.monthly.map(m => m.mrrJpy));
  }, [snap]);

  const peakProductMrr = useMemo(() => {
    if (!snap) return 0;
    return Math.max(1, snap.byProduct.prism.mrrJpy, snap.byProduct.iris.mrrJpy, snap.byProduct.other.mrrJpy);
  }, [snap]);

  return (
    <div style={{ color: '#fff', fontFamily: FONT_SERIF_JA }}>
      {/* ステータスバー */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem',
        padding: '0.9rem 1.25rem',
        background: 'linear-gradient(135deg, rgba(96,165,250,0.10), rgba(167,139,250,0.07))',
        border: '1px solid rgba(96,165,250,0.25)',
        borderRadius: 12,
        marginBottom: '1.5rem',
      }}>
        <div>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.6rem', letterSpacing: '0.32em', color: '#93c5fd', fontWeight: 700, margin: 0 }}>
            DATA SOURCE
          </p>
          <p style={{ fontSize: '0.85rem', margin: '4px 0 0', fontWeight: 600 }}>
            {loading ? '取込中…' :
              snap?.source === 'stripe' && snap.stripeConfigured ? 'Stripe 実取得'
              : snap?.source === 'cache' ? 'キャッシュ表示 (オフライン)'
              : snap?.source === 'override' ? '手動上書き値'
              : 'Stripe 未接続 — STRIPE_SECRET_KEY 未設定'}
            {snap?.asOf && (
              <span style={{ marginLeft: 8, fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)' }}>
                {new Date(snap.asOf).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            )}
          </p>
          {snap?.error && (
            <p style={{ fontSize: '0.7rem', color: '#fecaca', marginTop: 4 }}>{snap.error}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setRefreshAt(Date.now())} style={btnGhost}>再取得</button>
          <button onClick={() => { setDraft(readOverride()); setEditing(v => !v); }} style={btnGhost}>
            {editing ? '編集を閉じる' : '手動上書き'}
          </button>
        </div>
      </div>

      {/* MRR vs 目標 メインカード */}
      <div style={{
        padding: '1.5rem 1.75rem',
        background: 'linear-gradient(135deg, rgba(167,139,250,0.10), rgba(96,165,250,0.06))',
        border: '1px solid rgba(167,139,250,0.25)',
        borderRadius: 16,
        marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.65rem', letterSpacing: '0.32em', color: '#c4b5fd', fontWeight: 700, margin: 0 }}>
              MRR — 月次経常収益 (実 vs 目標)
            </p>
            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', margin: '4px 0 0' }}>
              基準: {SCENARIO_LABELS[scenario]} — 12 ヶ月後 {fmtJpyShort(mrrTarget)}
            </p>
          </div>
          <RingProgress percent={mrrAchievement} size={66} stroke={6} color={mrrColor}
            trackColor="rgba(255,255,255,0.10)">
            <div style={{ textAlign: 'center', lineHeight: 1 }}>
              <CountUp value={mrrAchievement} format={(n) => `${Math.round(n)}`}
                style={{ fontSize: '1.05rem', fontWeight: 800, color: mrrColor, fontFamily: 'monospace' }} />
              <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.5)', display: 'block', marginTop: 2 }}>達成%</span>
            </div>
          </RingProgress>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <Stat label="今月の実 MRR" count={mrrActual} fmt={fmtJpyShort} sub={fmtJpy(mrrActual)} accent="#fff" />
          <Stat label="目標" value={fmtJpyShort(mrrTarget)} sub={`${SCENARIO_LABELS[scenario]}`} accent="#c4b5fd" />
          <Stat label="ギャップ" count={Math.abs(mrrGap)} fmt={(n) => (mrrGap >= 0 ? '+' : '−') + fmtJpyShort(n)} sub={mrrGap >= 0 ? '超過' : '不足'} accent={mrrColor} />
          <Stat label="有料サブ数" count={snap?.totals.paidCount || 0} fmt={(n) => Math.round(n).toLocaleString('ja-JP')} sub="active subscriptions" accent="#a78bfa" />
        </div>

        {/* 進捗バー */}
        <div style={{ marginTop: '1.25rem' }}>
          <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, mrrAchievement)}%` }}
              transition={{ duration: 1.1, ease: 'easeOut' }}
              style={{
                height: '100%',
                background: `linear-gradient(90deg, ${mrrColor}, #a78bfa)`,
                boxShadow: `0 0 12px ${mrrColor}88`,
              }}
            />
          </div>
        </div>
      </div>

      {/* プロダクト別 */}
      <div style={{
        marginBottom: '1.5rem',
        padding: '1.4rem 1.5rem',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
      }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.65rem', letterSpacing: '0.32em', color: 'rgba(255,255,255,0.5)', fontWeight: 700, margin: 0 }}>
          PRODUCT BREAKDOWN
        </p>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '4px 0 1rem' }}>プロダクト別 MRR</h3>

        <div style={{ display: 'grid', gap: '0.65rem' }}>
          <ProductBar name="CORE Prism" desc="事業家・経営者向け 7 エージェント"
            mrr={snap?.byProduct.prism.mrrJpy || 0} paid={snap?.byProduct.prism.paidCount || 0}
            peak={peakProductMrr} color="#60a5fa" />
          <ProductBar name="CORE Iris" desc="クリエイター・インフルエンサー向け 6 ファセット"
            mrr={snap?.byProduct.iris.mrrJpy || 0} paid={snap?.byProduct.iris.paidCount || 0}
            peak={peakProductMrr} color="#f472b6" />
          {(snap?.byProduct.other.mrrJpy || 0) > 0 && (
            <ProductBar name="その他" desc="未分類 (Stripe Product ID 未設定)"
              mrr={snap?.byProduct.other.mrrJpy || 0} paid={snap?.byProduct.other.paidCount || 0}
              peak={peakProductMrr} color="#a78bfa" />
          )}
        </div>

        {snap && snap.stripeConfigured && snap.productsConfigured && !snap.productsConfigured.prism && !snap.productsConfigured.iris && (
          <p style={{ fontSize: '0.72rem', color: '#fbbf24', marginTop: '0.75rem', lineHeight: 1.7 }}>
            ヒント: <code>STRIPE_PRODUCT_PRISM</code> / <code>STRIPE_PRODUCT_IRIS</code> 環境変数に Stripe Product ID を設定すると、自動で振り分けます。未設定時は metadata.brand (prism / iris) でも判別します。
          </p>
        )}
      </div>

      {/* 12 ヶ月推移 */}
      <div style={{
        marginBottom: '1.5rem',
        padding: '1.4rem 1.5rem',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        overflowX: 'auto',
      }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.65rem', letterSpacing: '0.32em', color: 'rgba(255,255,255,0.5)', fontWeight: 700, margin: 0 }}>
          12-MONTH TREND
        </p>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '4px 0 1rem' }}>過去 12 ヶ月の月次推移 (GMV / プロダクト構成)</h3>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem', minHeight: 180, paddingTop: '1rem' }}>
          {(snap?.monthly || []).map((m, i) => {
            const total = m.prismJpy + m.irisJpy + m.otherJpy;
            const h = (total / peakMonthlyMrr) * 150;
            const pH = total > 0 ? (m.prismJpy / total) * h : 0;
            const iH = total > 0 ? (m.irisJpy / total) * h : 0;
            const oH = total > 0 ? (m.otherJpy / total) * h : 0;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 28 }}>
                <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>
                  {total > 0 ? fmtJpyShort(total).replace('¥', '') : '—'}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column-reverse', width: '100%', minHeight: 4 }}>
                  {[{ h: pH, c: '#60a5fa' }, { h: iH, c: '#f472b6' }, { h: oH, c: '#a78bfa' }].map((seg, si) => (
                    <motion.div key={si}
                      initial={{ height: 0 }}
                      animate={{ height: seg.h }}
                      transition={{ duration: 0.6, delay: 0.3 + i * 0.045, ease: 'easeOut' }}
                      style={{ background: seg.c }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
                  {m.month.slice(5)}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.65)' }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#60a5fa', marginRight: 4 }} />Prism</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#f472b6', marginRight: 4 }} />Iris</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#a78bfa', marginRight: 4 }} />その他</span>
        </div>
      </div>

      {/* 四半期 MRR マイルストーン */}
      <div style={{
        marginBottom: '1.5rem',
        padding: '1.4rem 1.5rem',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
      }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.65rem', letterSpacing: '0.32em', color: 'rgba(255,255,255,0.5)', fontWeight: 700, margin: 0 }}>
          MRR MILESTONES
        </p>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '4px 0 1rem' }}>四半期目標 vs 現在地</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          {MRR_TARGET_QUARTERS.map((q, i) => {
            const ach = mrrActual / q.mrrJpy * 100;
            const c = ach >= 100 ? '#86efac' : ach >= 50 ? '#fbbf24' : '#fca5a5';
            return (
              <div key={i} style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.62rem', letterSpacing: '0.25em', color: '#c4b5fd', fontWeight: 700 }}>{q.q}</p>
                <p style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: 4 }}>{fmtJpyShort(q.mrrJpy)}</p>
                <p style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: c, marginTop: 4 }}>現在 {ach.toFixed(0)}%</p>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 999, marginTop: 6, overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, ach)}%` }}
                    transition={{ duration: 0.9, delay: 0.2 + i * 0.08, ease: 'easeOut' }}
                    style={{ height: '100%', background: c, borderRadius: 999 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* その他 KPI */}
      <div style={{
        marginBottom: '1.5rem',
        padding: '1.4rem 1.5rem',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
      }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.65rem', letterSpacing: '0.32em', color: 'rgba(255,255,255,0.5)', fontWeight: 700, margin: 0 }}>
          OPERATING KPIs
        </p>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '4px 0 1rem' }}>運営 KPI ギャップ</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
          {kpiGaps.map(g => {
            const c = g.status === 'green' ? '#86efac' : g.status === 'amber' ? '#fbbf24' : g.status === 'red' ? '#fca5a5' : 'rgba(255,255,255,0.5)';
            return (
              <div key={g.target.id} style={{ padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
                <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontFamily: FONT_DISPLAY, letterSpacing: '0.2em', fontWeight: 700 }}>{g.target.category.toUpperCase()}</p>
                <p style={{ fontSize: '0.88rem', fontWeight: 700, marginTop: 4 }}>{g.target.label}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: 'monospace', fontSize: '0.78rem' }}>
                  <span style={{ color: c }}>{formatKpiValue(g.actual.value, g.target.unit)}</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>/ {formatKpiValue(g.target.target, g.target.unit)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 手動上書き編集 */}
      {editing && (
        <div style={{
          marginBottom: '1.5rem',
          padding: '1.4rem 1.5rem',
          background: 'rgba(251,191,36,0.06)',
          border: '1px solid rgba(251,191,36,0.3)',
          borderRadius: 14,
        }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.65rem', letterSpacing: '0.32em', color: '#fbbf24', fontWeight: 700, margin: 0 }}>
            MANUAL OVERRIDE (LOCAL ONLY)
          </p>
          <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', marginTop: 4, lineHeight: 1.7 }}>
            Stripe 値を一時的に上書きします。localStorage にのみ保存され、他デバイスには反映されません。
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
            <InputJpy label="実 MRR (合計, 円)" value={draft.mrrJpy ?? ''} onChange={v => setDraft(d => ({ ...d, mrrJpy: v }))} />
            <InputJpy label="Prism MRR (円)" value={draft.prismMrrJpy ?? ''} onChange={v => setDraft(d => ({ ...d, prismMrrJpy: v }))} />
            <InputJpy label="Iris MRR (円)" value={draft.irisMrrJpy ?? ''} onChange={v => setDraft(d => ({ ...d, irisMrrJpy: v }))} />
            <InputJpy label="ARPU (円 / 月)" value={draft.arpuJpy ?? ''} onChange={v => setDraft(d => ({ ...d, arpuJpy: v }))} />
            <InputJpy label="有料サブ数 (人)" value={draft.paidCount ?? ''} onChange={v => setDraft(d => ({ ...d, paidCount: v }))} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
            <button onClick={saveDraft} style={btnPrimary}>保存</button>
            <button onClick={resetOverride} style={btnDanger}>上書きをクリア</button>
            <button onClick={() => setEditing(false)} style={btnGhost}>キャンセル</button>
          </div>
          {draft.updatedAt && (
            <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>
              最終更新 {new Date(draft.updatedAt).toLocaleString('ja-JP')}
            </p>
          )}
        </div>
      )}

      {/* Stripe 接続案内 */}
      {snap && !snap.stripeConfigured && !editing && (
        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, rgba(96,165,250,0.10), rgba(167,139,250,0.06))',
          border: '1px solid rgba(96,165,250,0.30)',
          borderRadius: 14,
          textAlign: 'center',
        }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.65rem', letterSpacing: '0.32em', color: '#93c5fd', fontWeight: 700, margin: 0 }}>
            STRIPE NOT CONNECTED
          </p>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '6px 0' }}>Stripe を接続すると自動で売上が表示されます</h3>
          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.8 }}>
            Vercel 環境変数 <code>STRIPE_SECRET_KEY</code> を設定 → デプロイで反映。
            <br />プロダクト別表示には <code>STRIPE_PRODUCT_PRISM</code> / <code>STRIPE_PRODUCT_IRIS</code> も推奨。
          </p>
          <button onClick={() => { setDraft(readOverride()); setEditing(true); }} style={{ ...btnPrimary, marginTop: 12 }}>
            手動値で表示する
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, count, fmt, sub, accent }: {
  label: string; value?: string; count?: number; fmt?: (n: number) => string; sub?: string; accent: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -3, background: 'rgba(255,255,255,0.06)' }}
      style={{ padding: '0.9rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}
    >
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.6rem', letterSpacing: '0.28em', color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>{label}</p>
      <p style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: 4, color: accent, fontFamily: FONT_SERIF_JA }}>
        {count !== undefined && fmt
          ? <CountUp value={count} format={fmt} />
          : value}
      </p>
      {sub && <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{sub}</p>}
    </motion.div>
  );
}

function ProductBar({ name, desc, mrr, paid, peak, color }: { name: string; desc: string; mrr: number; paid: number; peak: number; color: string }) {
  const w = Math.max(2, (mrr / peak) * 100);
  return (
    <div style={{ padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div>
          <p style={{ fontSize: '0.92rem', fontWeight: 700 }}>{name}</p>
          <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{desc}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '1rem', fontWeight: 800, fontFamily: FONT_SERIF_JA }}>{fmtJpyShort(mrr)}</p>
          <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>{paid.toLocaleString('ja-JP')} sub</p>
        </div>
      </div>
      <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${w}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ height: '100%', background: color, boxShadow: `0 0 10px ${color}99` }}
        />
      </div>
    </div>
  );
}

function InputJpy({ label, value, onChange }: { label: string; value: number | string; onChange: (v: number | null) => void }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: '0.7rem', color: 'rgba(255,255,255,0.65)', marginBottom: 4 }}>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={value as any}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? null : Number(v));
        }}
        style={{
          width: '100%',
          padding: '0.55rem 0.7rem',
          background: 'rgba(0,0,0,0.4)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 8,
          fontFamily: 'monospace',
          fontSize: '0.9rem',
        }}
      />
    </label>
  );
}

const btnGhost: React.CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.06)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.15)',
  fontSize: '0.78rem',
  fontWeight: 700,
  fontFamily: FONT_SERIF_JA,
  cursor: 'pointer',
};
const btnPrimary: React.CSSProperties = {
  ...btnGhost,
  background: 'linear-gradient(135deg, #a78bfa, #60a5fa)',
  border: 'none',
};
const btnDanger: React.CSSProperties = {
  ...btnGhost,
  background: 'rgba(252,165,165,0.08)',
  border: '1px solid rgba(252,165,165,0.3)',
  color: '#fecaca',
};
