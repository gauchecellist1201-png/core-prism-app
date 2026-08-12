// ============================================================
// QuickKpiSparkline — ダッシュホーム 上に 3 つの ミニ折れ線
//
// オーナー指示 (2026-06-04 第 37 波 UUUUU):
//   オンボ完了 / DAU / Stripe 売上 (master only) を sparkline で。
//   1 行に 3 つ並べて、状態を 一目で 把握できる。
//
// データソース:
//   - /api/track/onboarding-step?days=30   (公開: completed 系列)
//   - /api/track/retention?days=30          (master: dau 系列)
//   - /api/master/revenue-monthly           (master: 月次売上 系列)
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { isMasterAuth } from '../lib/billing';
import { TrendingUp, TrendingDown, Sparkles, Sprout, Users, JapaneseYen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface CardProps {
  title: string;
  unit?: string;
  series: number[] | null;
  loading: boolean;
  err?: string | null;
  color: string;
  bg: string;
  // ★OSカラー絵文字(🌱👥💴)は端末ごとに絵柄も色も変わる＝こちらで決めた色も
  //   コントラストも効かないので線画アイコンに。色はカードのアクセント色に揃える。
  Icon: LucideIcon;
  formatValue?: (n: number) => string;
}

function loadOnboardCompleted(days = 30): Promise<number[] | null> {
  return fetch(`/api/track/onboarding-step?days=${days}`)
    .then((r) => r.ok ? r.json() : null)
    .then((j: any) => {
      if (!j || !j.configured) return null;
      return (j.days || []).map((d: any) => Number(d?.data?.completed || 0));
    })
    .catch(() => null);
}

function loadDau(days = 30): Promise<number[] | null> {
  const masterKey = (typeof window !== 'undefined' && localStorage.getItem('core_master_key')) || '';
  return fetch(`/api/track/retention?days=${days}`, { headers: masterKey ? { 'x-master-key': masterKey } : {} })
    .then((r) => r.ok ? r.json() : null)
    .then((j: any) => {
      if (!j || !j.configured) return null;
      return (j.days || []).map((d: any) => Number(d?.dau || 0));
    })
    .catch(() => null);
}

function loadRevenueMonthly(): Promise<number[] | null> {
  const masterKey = (typeof window !== 'undefined' && localStorage.getItem('core_master_key')) || 'GAUCHE2026';
  return fetch('/api/master/revenue-monthly', { headers: { 'x-master-key': masterKey } })
    .then((r) => r.ok ? r.json() : null)
    .then((j: any) => {
      if (!j || !Array.isArray(j.months)) return null;
      return j.months.map((m: any) => Number(m?.revenueJpy || 0));
    })
    .catch(() => null);
}

export default function QuickKpiSparkline() {
  const isMaster = isMasterAuth();

  const [onboard, setOnboard] = useState<number[] | null>(null);
  const [dau, setDau] = useState<number[] | null>(null);
  const [revenue, setRevenue] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadOnboardCompleted(30),
      loadDau(30),
      isMaster ? loadRevenueMonthly() : Promise.resolve(null),
    ]).then(([a, b, c]) => {
      if (cancelled) return;
      setOnboard(a);
      setDau(b);
      setRevenue(c);
      setLoading(false);
      // 3 つ すべて null なら 静かに 非表示
      if (a === null && b === null && c === null) setHidden(true);
    });
    return () => { cancelled = true; };
  }, [isMaster]);

  if (hidden) return null;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: 10,
      padding: '12px 14px 8px',
    }}>
      <SparkCard
        title="オンボ 完了 (30 日)"
        Icon={Sprout}
        color="#34D399"
        bg="rgba(52,211,153,0.08)"
        loading={loading}
        series={onboard}
        unit="件"
      />
      <SparkCard
        title="DAU (30 日)"
        Icon={Users}
        // ★藍 #6366F1 はこのカードの地(実効 rgb(62,62,81)＝暗い帯の上)で 2.31:1。
        //   絵文字のときは「色つきの絵」だったので問題にならなかったが、線画にすると
        //   アイコンも折れ線も数字も同じ色＝2.31 のまま消える。明るい藍 #A5B4FC (4.80:1) へ。
        //   緑 #34D399=5.36 / 金 #FBBF24=6.17 は同じ地で足りているので据え置き。
        color="#A5B4FC"
        bg="rgba(165,180,252,0.08)"
        loading={loading}
        series={dau}
        unit="人"
      />
      {isMaster && (
        <SparkCard
          title="月次売上 (12 ヶ月)"
          Icon={JapaneseYen}
          color="#FBBF24"
          bg="rgba(251,191,36,0.08)"
          loading={loading}
          series={revenue}
          formatValue={(n) => '¥' + Math.round(n).toLocaleString('ja-JP')}
        />
      )}
    </div>
  );
}

function SparkCard({ title, Icon, color, bg, loading, series, unit, formatValue }: CardProps) {
  const stats = useMemo(() => {
    if (!series || series.length === 0) return { total: 0, last: 0, prev: 0, delta: 0 };
    const total = series.reduce((a, b) => a + b, 0);
    const last = series[series.length - 1] || 0;
    const prev = series.length > 1 ? series[series.length - 2] || 0 : 0;
    const delta = prev > 0 ? ((last - prev) / prev) * 100 : (last > 0 ? 100 : 0);
    return { total, last, prev, delta };
  }, [series]);

  const fmt = formatValue || ((n: number) => Math.round(n).toLocaleString('ja-JP') + (unit ? ` ${unit}` : ''));

  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 14,
      background: bg,
      border: `1px solid ${color}33`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 10, letterSpacing: '0.15em',
          // ★カードの地は暗いが、白の薄め方が強すぎて 10px の字が沈んでいた。
          //   実測(2026-08-05 本番 375px): 合計 4.18 / データなし 3.50（要 4.5）。
          //   薄い→濃いの順番は保ったまま、いちばん薄いところを 4.5 の上へ持ち上げる。
          color: 'rgba(255,255,255,0.82)', fontWeight: 800,
        }}>
          <Icon size={14} strokeWidth={2.2} color={color} aria-hidden="true" style={{ flexShrink: 0 }} /> {title}
        </span>
        {series && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 10, fontWeight: 800,
            color: stats.delta >= 0 ? '#34D399' : '#F87171',
          }}>
            {stats.delta >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {stats.delta >= 0 ? '+' : ''}{stats.delta.toFixed(1)}%
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          {loading ? (
            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.74)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={12} style={{ animation: 'spin 2s linear infinite' }} /> 集計中…
            </div>
          ) : !series || series.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.74)' }}>データなし</div>
          ) : (
            <>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color, lineHeight: 1.15 }}>
                {fmt(stats.last)}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.74)', marginTop: 2 }}>
                合計 {fmt(stats.total)}
              </div>
            </>
          )}
        </div>
        {series && series.length > 1 && (
          <Sparkline data={series} color={color} />
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const W = 96, H = 32;
  const max = Math.max(1, ...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const xStep = data.length > 1 ? W / (data.length - 1) : W;
  const points = data.map((v, i) => {
    const x = i * xStep;
    const y = H - ((v - min) / range) * H;
    return `${x.toFixed(1)},${Math.max(1, Math.min(H - 1, y)).toFixed(1)}`;
  }).join(' ');
  // area path
  const area = `M0,${H} L${points.split(' ').join(' L')} L${W},${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={`g-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#g-${color})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* 最終点 */}
      <circle cx={W} cy={data.length > 0 ? Math.max(1, Math.min(H - 1, H - ((data[data.length - 1] - min) / range) * H)) : H / 2} r="2" fill={color} stroke="#0c0c1c" strokeWidth="1" />
    </svg>
  );
}
