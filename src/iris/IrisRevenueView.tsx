// ============================================================
// IRIS — 収益管理ビュー (大幅アップグレード)
//
// 1. 既存: 手動収益エントリ (RevenueEntry) + 月次推移 + Pie
// 2. 追加:
//    - 案件 (useInfluencerDesk) の closedAt+fee を自動集計
//    - 来月予測 (過去3ヶ月平均 + 進行中案件の確度推定)
//    - 月間収益目標バー (デフォ ¥100,000) + 達成時 RewardBurst (花火)
//    - taxHelper で月次概算所得税
//    - 月次 Markdown レポートをコピー
//    - 「収益を月 X 円増やす計画」を CFO+CSO+CMO に propose
// ============================================================
import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Coins, Plus, Copy, Target, ListChecks } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { CountUp, Sparkline, RewardBurst } from '../components/visualFx';
import { v4 as uuidv4 } from 'uuid';
import EmptyInvite from './EmptyInvite';
import { useInfluencerDesk } from '../hooks/useInfluencerDesk';
import { useAgentTaskQueue } from '../hooks/useAgentTaskQueue';
import { estimateTax } from './taxHelper';
import { notifyInApp } from '../lib/inAppNotify';
import { copyText } from '../lib/clipboard';

interface Props {
  bg: IrisBackgroundDef;
}

export type RevenueSource = '案件PR' | 'スポンサー' | 'アフィリエイト' | 'グッズ/コラボ' | 'ライセンス' | '自主商品' | 'その他';

export interface RevenueEntry {
  id: string;
  date: string;          // YYYY-MM-DD
  source: RevenueSource;
  description: string;
  amountJPY: number;     // 税抜
}

const SOURCE_COLORS: Record<RevenueSource, string> = {
  '案件PR':        '#E1306C',
  'スポンサー':    '#833AB4',
  'アフィリエイト':'#F77737',
  'グッズ/コラボ': '#FCB045',
  'ライセンス':    '#5BA8FF',
  '自主商品':      '#10B981',
  'その他':        '#A0A0B8',
};

const STORAGE_KEY = 'iris_revenue_entries_v1';
const GOAL_KEY = 'iris_revenue_monthly_goal_v1';
const GOAL_HIT_KEY = 'iris_revenue_goal_hit_month_v1';
const DEFAULT_GOAL = 100_000;

function loadEntries(): RevenueEntry[] {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}
function saveEntries(data: RevenueEntry[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* */ }
}

function loadGoal(): number {
  try { const r = localStorage.getItem(GOAL_KEY); return r ? Number(r) || DEFAULT_GOAL : DEFAULT_GOAL; }
  catch { return DEFAULT_GOAL; }
}
function saveGoal(v: number) {
  try { localStorage.setItem(GOAL_KEY, String(v)); } catch { /* */ }
}

const ALL_SOURCES: RevenueSource[] = ['案件PR', 'スポンサー', 'アフィリエイト', 'グッズ/コラボ', 'ライセンス', '自主商品', 'その他'];

/** 案件 stage → 成立確度マップ (進行中案件の予測用) */
const STAGE_PROBABILITY: Record<string, number> = {
  'inquiry':         0.20, // 低
  'negotiating':     0.50, // 中
  'contracted':      0.90, // 高
  'drafting':        0.90,
  'draft-submitted': 0.90,
  'approved':        0.95,
  'posted':          0.95,
  'reported':        0.95,
  'closed':          1.00,
  'declined':        0.00,
};

// ─── カスタム Tooltip ───────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.97)',
      border: '1px solid rgba(225,48,108,0.25)',
      borderRadius: 10,
      padding: '0.6rem 0.85rem',
      fontSize: '0.8rem',
      fontFamily: IRIS_FONTS.body,
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    }}>
      <p style={{ fontWeight: 700, color: '#1F1A2E', marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.fill ?? p.color, margin: 0 }}>
          {p.name}: ¥{Number(p.value).toLocaleString()}
        </p>
      ))}
    </div>
  );
}

export default function IrisRevenueView({ bg }: Props) {
  const [entries, setEntries] = useState<RevenueEntry[]>(() => loadEntries());
  const [showForm, setShowForm] = useState(false);
  const [goal, setGoal] = useState<number>(() => loadGoal());
  const [fireworks, setFireworks] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    source: '案件PR' as RevenueSource,
    description: '',
    amountJPY: '',
  });

  const desk = useInfluencerDesk();
  const queue = useAgentTaskQueue();

  const saveAndSet = (next: RevenueEntry[]) => { setEntries(next); saveEntries(next); };

  const addEntry = () => {
    if (!form.description.trim() || !form.amountJPY) return;
    const entry: RevenueEntry = {
      id: uuidv4(),
      date: form.date,
      source: form.source,
      description: form.description.trim(),
      amountJPY: Number(form.amountJPY),
    };
    saveAndSet([entry, ...entries]);
    setForm({ date: new Date().toISOString().slice(0, 10), source: '案件PR', description: '', amountJPY: '' });
    setShowForm(false);
  };

  const deleteEntry = (id: string) => saveAndSet(entries.filter(e => e.id !== id));

  // ─── 案件 → 自動収益エントリ (closed 案件のみ実績、それ以外は予測) ─
  // 案件には closedAt がないので updatedAt を closed の代用とする
  const dealEntries: RevenueEntry[] = useMemo(() => {
    return desk.deals
      .filter(d => d.stage === 'closed' && d.fee > 0)
      .map(d => ({
        id: 'deal-' + d.id,
        date: (d.postedDate || d.updatedAt || d.createdAt).slice(0, 10),
        source: '案件PR' as RevenueSource,
        description: `${d.brandName}${d.productName ? ' / ' + d.productName : ''}`,
        amountJPY: d.fee + (d.usageFee || 0),
      }));
  }, [desk.deals]);

  // 全エントリ (手動 + 案件)
  const allEntries: RevenueEntry[] = useMemo(() => {
    // 重複排除: 同じ ID は手動を優先
    const map = new Map<string, RevenueEntry>();
    for (const e of dealEntries) map.set(e.id, e);
    for (const e of entries) map.set(e.id, e);
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, dealEntries]);

  // ─── サマリー ──────────────────────────────────────────────
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const summary = useMemo(() => {
    const monthlyTotal = allEntries
      .filter(e => e.date.startsWith(currentMonth))
      .reduce((s, e) => s + e.amountJPY, 0);
    const yearTotal = allEntries
      .filter(e => e.date.startsWith(String(now.getFullYear())))
      .reduce((s, e) => s + e.amountJPY, 0);

    const srcMap = new Map<RevenueSource, number>();
    for (const e of allEntries) srcMap.set(e.source, (srcMap.get(e.source) ?? 0) + e.amountJPY);
    let topSource: RevenueSource = '案件PR';
    let topAmt = 0;
    for (const [src, amt] of srcMap) { if (amt > topAmt) { topAmt = amt; topSource = src; } }

    // 直近 12 ヶ月の月次合計 (スパークライン用)
    const trend: number[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      trend.push(allEntries.filter(e => e.date.startsWith(m)).reduce((s, e) => s + e.amountJPY, 0));
    }

    return { monthlyTotal, yearTotal, topSource, trend };
  }, [allEntries, currentMonth]);

  // ─── 来月予測 ────────────────────────────────────────────────
  const nextMonthForecast = useMemo(() => {
    // 過去 3 ヶ月平均
    const past3 = summary.trend.slice(-3);
    const avg3 = past3.length > 0 ? past3.reduce((s, v) => s + v, 0) / past3.length : 0;

    // 進行中案件の確度加重合計
    const inProgress = desk.deals.filter(d =>
      d.stage !== 'closed' && d.stage !== 'declined' && d.fee > 0,
    );
    const probableFromDeals = inProgress.reduce(
      (s, d) => s + (d.fee + (d.usageFee || 0)) * (STAGE_PROBABILITY[d.stage] ?? 0.3),
      0,
    );

    // 統合: 過去平均 × 0.6 + 進行案件確度 × 0.4
    const forecast = Math.round(avg3 * 0.6 + probableFromDeals * 0.4);

    return {
      forecast,
      avg3: Math.round(avg3),
      probableFromDeals: Math.round(probableFromDeals),
      inProgressCount: inProgress.length,
    };
  }, [summary.trend, desk.deals]);

  // ─── 税金見積もり (月次・年累計) ────────────────────────────
  const taxSummary = useMemo(() => {
    const incomes = summary.trend.map((amount, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return { month: m, amountJPY: amount };
    });
    // 経費は別管理。ここでは収入のみで概算 (経費 0 として保守的に税額を出す)
    const est = estimateTax(incomes, []);
    // 月次税額 = 年税額 × (当月収入 / 年間収入)
    const monthlyTax = summary.yearTotal > 0
      ? Math.round(est.simulatedTaxJPY * summary.monthlyTotal / summary.yearTotal)
      : 0;
    return {
      annualTax: est.simulatedTaxJPY,
      taxableIncome: est.taxableIncome,
      monthlyTax,
    };
  }, [summary]);

  // ─── 月間目標達成チェック → 花火 ─────────────────────────────
  useEffect(() => {
    if (summary.monthlyTotal >= goal && goal > 0) {
      try {
        const lastHit = localStorage.getItem(GOAL_HIT_KEY);
        if (lastHit !== currentMonth) {
          localStorage.setItem(GOAL_HIT_KEY, currentMonth);
          setFireworks(true);
        }
      } catch { /* */ }
    }
  }, [summary.monthlyTotal, goal, currentMonth]);

  // ─── 月次棒グラフデータ (12ヶ月) ───────────────────────────
  const barData = useMemo(() => {
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months.map(m => {
      const row: Record<string, number | string> = { month: m.slice(5) + '月' };
      for (const src of ALL_SOURCES) {
        row[src] = allEntries
          .filter(e => e.date.startsWith(m) && e.source === src)
          .reduce((s, e) => s + e.amountJPY, 0);
      }
      return row;
    });
  }, [allEntries]);

  // ─── Pie データ ────────────────────────────────────────────
  const pieData = useMemo(() => {
    return ALL_SOURCES
      .map(src => ({
        name: src,
        value: allEntries
          .filter(e => e.date.startsWith(String(now.getFullYear())) && e.source === src)
          .reduce((s, e) => s + e.amountJPY, 0),
      }))
      .filter(d => d.value > 0);
  }, [allEntries]);

  // ─── Markdown レポートをコピー ───────────────────────────────
  const copyMonthlyReport = useCallback(() => {
    const lines: string[] = [];
    const ym = currentMonth;
    lines.push(`# ${ym} 収益レポート`);
    lines.push('');
    lines.push(`- 月間収益: **¥${summary.monthlyTotal.toLocaleString()}**`);
    lines.push(`- 年間累計: ¥${summary.yearTotal.toLocaleString()}`);
    lines.push(`- 月間目標: ¥${goal.toLocaleString()} (${goal > 0 ? Math.round(summary.monthlyTotal / goal * 100) : 0}%)`);
    lines.push(`- トップ収入源: ${summary.topSource}`);
    lines.push('');
    lines.push('## 収入源別');
    for (const p of pieData) lines.push(`- ${p.name}: ¥${p.value.toLocaleString()}`);
    lines.push('');
    lines.push('## 来月予測');
    lines.push(`- 予測: **¥${nextMonthForecast.forecast.toLocaleString()}**`);
    lines.push(`- 内訳: 過去3ヶ月平均 ¥${nextMonthForecast.avg3.toLocaleString()} × 0.6 + 進行案件確度 ¥${nextMonthForecast.probableFromDeals.toLocaleString()} × 0.4`);
    lines.push(`- 進行中案件: ${nextMonthForecast.inProgressCount} 件`);
    lines.push('');
    lines.push('## 税金見積もり (経費 0 円ベースの保守見積)');
    lines.push(`- 年間概算所得税: ¥${taxSummary.annualTax.toLocaleString()}`);
    lines.push(`- 今月分の按分: ¥${taxSummary.monthlyTax.toLocaleString()}`);
    lines.push('');
    lines.push('## 月次推移 (直近12ヶ月)');
    summary.trend.forEach((v, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      lines.push(`- ${m}: ¥${v.toLocaleString()}`);
    });
    const md = lines.join('\n');
    copyText(md, '月次レポート');
  }, [currentMonth, summary, goal, pieData, nextMonthForecast, taxSummary]);

  // ─── AgentTaskQueue: 月 X 円増やす計画 ───────────────────────
  const proposeRevenuePlan = useCallback(() => {
    setProposing(true);
    const gap = Math.max(0, goal - summary.monthlyTotal);
    const target = gap > 0 ? gap : Math.round(goal * 0.3); // 目標達成済みなら +30%
    queue.propose({
      title: `今月の収益を ¥${target.toLocaleString()} 上積みする計画`,
      summary: `現状: 月収益 ¥${summary.monthlyTotal.toLocaleString()} / 目標 ¥${goal.toLocaleString()}。差分 ¥${gap.toLocaleString()} を、進行中案件 ${nextMonthForecast.inProgressCount} 件と新規開拓・追加商品で埋める三段の打ち手を 1 枚に。`,
      why: '感覚で「足りない」と感じても、何をどう動かせば届くかが見えなければ動けない。数字で「あと何件 / いくら」を見せると、明日の動きが具体化する。',
      expected: '上積み額 + 必要なアクション 5 件 + 各アクションの想定回収額を 1 枚に。',
      dueDays: 1,
      steps: [
        { cxo: 'CFO', label: '直近 12 ヶ月の収益推移と目標差分を分析し、必達ラインを設定' },
        { cxo: 'CSO', label: '進行中案件を確度別に整理し、今週クロージングできる 3 件を抽出' },
        { cxo: 'CMO', label: '新規開拓・自主商品・アフィリエイトで上積みする打ち手を 3 案ドラフト' },
        { cxo: 'CFO', label: '想定回収額と税引後手取りを 1 表にまとめる' },
      ],
    });
    notifyInApp({ kind: 'success', title: '計画を CFO+CSO+CMO に委任しました', body: 'AgentTaskQueue で進捗が見えます' });
    setTimeout(() => setProposing(false), 600);
  }, [summary.monthlyTotal, goal, nextMonthForecast.inProgressCount, queue]);

  const goalPct = goal > 0 ? Math.min(100, summary.monthlyTotal / goal * 100) : 0;
  const isEmpty = allEntries.length === 0;

  return (
    <div style={{ display: 'grid', gap: '1.5rem', fontFamily: IRIS_FONTS.body }}>
      {/* ヘッダ */}
      <div>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 600 }}>REVENUE</p>
        <h1 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', color: bg.ink, margin: '0.25rem 0 0.5rem', fontWeight: 500 }}>
          収益を、見える化。
        </h1>
        <p style={{ fontSize: '0.85rem', color: bg.inkSoft, lineHeight: 1.8, fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>
          案件・スポンサー・アフィリ・グッズ — すべての収入と、来月予測・税金まで一か所に。
        </p>
      </div>

      {/* サマリーカード */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
        <SummaryCard bg={bg} label="今月の収益" amount={summary.monthlyTotal} spark={summary.trend.slice(-6)} delay={0} />
        <SummaryCard bg={bg} label="年間累計" amount={summary.yearTotal} spark={summary.trend} delay={0.08} />
        <SummaryCard bg={bg} label="来月予測" amount={nextMonthForecast.forecast} delay={0.16} />
        <SummaryCard bg={bg} label="トップ収入源" text={summary.topSource} delay={0.24} />
      </div>

      {/* 月間目標バー */}
      <div style={{ padding: '1.25rem', background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <Target size={16} color={bg.accent} />
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: bg.accent, fontWeight: 700, margin: 0 }}>MONTHLY GOAL</p>
          <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: bg.inkSoft, fontFamily: IRIS_FONTS.mono }}>
            ¥{summary.monthlyTotal.toLocaleString()} / ¥{goal.toLocaleString()} ({Math.round(goalPct)}%)
          </span>
        </div>
        <div style={{ height: 14, borderRadius: 999, background: 'rgba(0,0,0,0.07)', overflow: 'hidden', marginBottom: 10 }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${goalPct}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{
              height: '100%',
              background: goalPct >= 100
                ? 'linear-gradient(90deg, #FFD700, #FF6B9D, #833AB4)'
                : `linear-gradient(90deg, ${bg.accent}, ${bg.accent}aa)`,
              borderRadius: 999,
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.75rem', color: bg.inkSoft }}>目標を変更:</label>
          <input
            type="number"
            value={goal}
            onChange={e => { const v = Math.max(0, Number(e.target.value) || 0); setGoal(v); saveGoal(v); }}
            style={{ ...inputStyle(bg), width: 120 }}
            min={0}
            step={10000}
          />
          {goalPct >= 100 && (
            <span style={{ fontSize: '0.85rem', color: '#E1306C', fontWeight: 700 }}>目標達成 おめでとう！</span>
          )}
        </div>
      </div>

      {/* 来月予測の内訳 */}
      <div style={{ padding: '1.25rem', background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 16 }}>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: bg.accent, fontWeight: 700, marginBottom: 10 }}>NEXT MONTH FORECAST</p>
        <p style={{ fontFamily: IRIS_FONTS.display, fontSize: '1.6rem', color: bg.ink, fontWeight: 700, margin: '0 0 6px' }}>
          <CountUp value={nextMonthForecast.forecast} format={(n) => `¥${Math.round(n).toLocaleString()}`} />
        </p>
        <p style={{ fontSize: '0.8rem', color: bg.inkSoft, lineHeight: 1.7 }}>
          過去3ヶ月平均 <b style={{ color: bg.ink }}>¥{nextMonthForecast.avg3.toLocaleString()}</b> × 0.6
          {' + '}
          進行中 {nextMonthForecast.inProgressCount} 件の確度加重 <b style={{ color: bg.ink }}>¥{nextMonthForecast.probableFromDeals.toLocaleString()}</b> × 0.4
        </p>
      </div>

      {/* 税金見積もり */}
      <div style={{ padding: '1.25rem', background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 16 }}>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: bg.accent, fontWeight: 700, marginBottom: 10 }}>TAX ESTIMATE — 経費 0 円ベース (保守)</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          <div>
            <p style={{ fontSize: '0.7rem', color: bg.inkSoft, marginBottom: 4 }}>年間概算所得税</p>
            <p style={{ fontFamily: IRIS_FONTS.mono, fontSize: '1.1rem', color: bg.ink, fontWeight: 700 }}>
              ¥{taxSummary.annualTax.toLocaleString()}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '0.7rem', color: bg.inkSoft, marginBottom: 4 }}>今月分の按分</p>
            <p style={{ fontFamily: IRIS_FONTS.mono, fontSize: '1.1rem', color: bg.ink, fontWeight: 700 }}>
              ¥{taxSummary.monthlyTax.toLocaleString()}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '0.7rem', color: bg.inkSoft, marginBottom: 4 }}>課税所得 (年)</p>
            <p style={{ fontFamily: IRIS_FONTS.mono, fontSize: '1.1rem', color: bg.ink, fontWeight: 700 }}>
              ¥{taxSummary.taxableIncome.toLocaleString()}
            </p>
          </div>
        </div>
        <p style={{ fontSize: '0.7rem', color: bg.inkSoft, marginTop: 10, lineHeight: 1.6 }}>
          基礎控除 48 万円のみ適用。経費を計上すると税額はさらに下がります。詳細は確定申告サポートへ。
        </p>
      </div>

      {/* 月次棒グラフ */}
      <div style={{ padding: '1.5rem', background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 16 }}>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: bg.accent, fontWeight: 600, marginBottom: '1rem' }}>MONTHLY TREND — 12ヶ月</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={barData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: bg.inkSoft }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `¥${(v / 10000).toFixed(0)}万`} tick={{ fontSize: 11, fill: bg.inkSoft }} axisLine={false} tickLine={false} width={54} />
            <Tooltip content={<ChartTooltip />} />
            {ALL_SOURCES.map((src, idx) => (
              <Bar key={src} dataKey={src} stackId="a" fill={SOURCE_COLORS[src]} radius={idx === ALL_SOURCES.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.75rem' }}>
          {ALL_SOURCES.map(src => (
            <span key={src} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: bg.inkSoft }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: SOURCE_COLORS[src], display: 'inline-block' }} />
              {src}
            </span>
          ))}
        </div>
      </div>

      {/* 収入源別 Pie */}
      {pieData.length > 0 && (
        <div style={{ padding: '1.5rem', background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 16 }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: bg.accent, fontWeight: 600, marginBottom: '0.5rem' }}>SOURCE BREAKDOWN — 今年</p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={pieData} cx="50%" cy="50%"
                outerRadius={85} dataKey="value"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={SOURCE_COLORS[entry.name as RevenueSource]} />
                ))}
              </Pie>
              <Legend formatter={(v) => <span style={{ fontSize: '0.8rem', color: bg.ink }}>{v}</span>} />
              <Tooltip formatter={(v) => `¥${Number(v).toLocaleString()}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* アクションボタン */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button onClick={copyMonthlyReport} style={btnSecondary(bg)}>
          <Copy size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          月次レポートをコピー
        </button>
        <button onClick={proposeRevenuePlan} disabled={proposing} style={btnSecondary(bg)}>
          <ListChecks size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          {proposing ? '委任中…' : 'CFO+CSO+CMO に委任'}
        </button>
        <button onClick={() => setShowForm(v => !v)} style={btnPrimary(bg)}>
          <Plus size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          収益を記録する
        </button>
      </div>

      {/* 入力フォーム */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ padding: '1.5rem', background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 16 }}
        >
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: bg.accent, fontWeight: 600, marginBottom: '1rem' }}>NEW ENTRY</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <FieldWrap label="日付">
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                style={inputStyle(bg)} />
            </FieldWrap>
            <FieldWrap label="収入源">
              <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value as RevenueSource }))}
                style={inputStyle(bg)}>
                {ALL_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FieldWrap>
            <FieldWrap label="金額 (税抜・円)">
              <input type="number" value={form.amountJPY} onChange={e => setForm(f => ({ ...f, amountJPY: e.target.value }))}
                placeholder="50000" style={inputStyle(bg)} />
            </FieldWrap>
            <FieldWrap label="詳細" style={{ gridColumn: '1 / -1' }}>
              <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="例: SHISEIDO Instagram リール案件" style={inputStyle(bg)} />
            </FieldWrap>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)}
              style={{ background: 'transparent', color: bg.inkSoft, border: `1px solid ${bg.cardBorder}`, borderRadius: 999, padding: '0.6rem 1.25rem', cursor: 'pointer', fontFamily: IRIS_FONTS.body }}>
              キャンセル
            </button>
            <button onClick={addEntry}
              style={{ background: bg.accent, color: '#fff', border: 'none', borderRadius: 999, padding: '0.6rem 1.5rem', fontWeight: 700, cursor: 'pointer', fontFamily: IRIS_FONTS.body }}>
              保存
            </button>
          </div>
        </motion.div>
      )}

      {/* 収益一覧 */}
      {allEntries.length > 0 && (
        <div style={{ padding: '1.5rem', background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 16 }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: bg.accent, fontWeight: 600, marginBottom: '0.85rem' }}>
            HISTORY ({allEntries.length}件 / 案件自動取込: {dealEntries.length}件)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 360, overflowY: 'auto' }}>
            {allEntries.map(e => {
              const isDealAuto = e.id.startsWith('deal-');
              return (
                <div key={e.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.7rem 0.85rem', borderRadius: 10,
                  background: 'rgba(255,255,255,0.55)',
                  border: `1px solid ${bg.cardBorder}`,
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: SOURCE_COLORS[e.source], flexShrink: 0,
                  }} />
                  <span style={{ fontSize: '0.75rem', color: bg.inkSoft, minWidth: 80 }}>{e.date}</span>
                  <span style={{ fontSize: '0.75rem', color: bg.accent, fontWeight: 600, minWidth: 90 }}>{e.source}</span>
                  <span style={{ flex: 1, fontSize: '0.85rem', color: bg.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.description}
                    {isDealAuto && <span style={{ marginLeft: 8, fontSize: '0.65rem', color: bg.accent, background: `${bg.accent}18`, padding: '1px 6px', borderRadius: 999 }}>案件自動</span>}
                  </span>
                  <span style={{ fontWeight: 700, color: bg.ink, fontFamily: IRIS_FONTS.mono, whiteSpace: 'nowrap' }}>
                    ¥{e.amountJPY.toLocaleString()}
                  </span>
                  {!isDealAuto && (
                    <button onClick={() => deleteEntry(e.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: bg.inkSoft, fontSize: '0.9rem', padding: '0.2rem 0.5rem' }}
                      title="削除">
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isEmpty && !showForm && (
        <EmptyInvite
          bg={bg}
          icon={Coins}
          title="収益の記録はまだありません"
          description={
            <>
              案件 PR / スポンサー / アフィリエイト など、入ってきた金額を 1 件入れるだけで、<br />
              月次推移・来月予測・税金見積りがふわっと立ち上がります。
            </>
          }
          primaryAction={{
            label: '最初の 1 件を記録する',
            onClick: () => setShowForm(true),
            icon: Plus,
          }}
          hint="案件タブで closed にした案件は自動で集計されます"
        />
      )}

      {/* 花火 (目標達成) */}
      <RewardBurst
        show={fireworks}
        accent={bg.accent}
        message="月間目標達成！"
        onDone={() => setFireworks(false)}
      />
    </div>
  );
}

function SummaryCard({ bg, label, amount, text, spark, delay = 0 }: {
  bg: IrisBackgroundDef; label: string; amount?: number; text?: string; spark?: number[]; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: 'easeOut' }}
      whileHover={{ y: -4, boxShadow: `0 14px 30px ${bg.accent}22` }}
      style={{
        padding: '1.1rem 1rem', background: bg.card,
        border: `1px solid ${bg.cardBorder}`, borderRadius: 12,
        position: 'relative', overflow: 'hidden',
        transition: 'box-shadow 0.2s ease',
      }}
    >
      <p style={{ fontSize: '0.7rem', color: bg.inkSoft, letterSpacing: '0.05em', fontWeight: 600, marginBottom: 6 }}>{label}</p>
      <p style={{ fontFamily: IRIS_FONTS.display, fontSize: '1.4rem', fontWeight: 700, color: bg.ink }}>
        {amount !== undefined
          ? <CountUp value={amount} format={(n) => `¥${Math.round(n).toLocaleString()}`} />
          : text}
      </p>
      {spark && spark.some(v => v > 0) && (
        <div style={{ marginTop: 8 }}>
          <Sparkline data={spark} color={bg.accent} width={110} height={26} />
        </div>
      )}
    </motion.div>
  );
}

function FieldWrap({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <label style={{ fontSize: '0.7rem', color: '#3D3247', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 4, fontFamily: IRIS_FONTS.body }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function inputStyle(bg: IrisBackgroundDef): React.CSSProperties {
  return {
    width: '100%', padding: '0.55rem 0.75rem',
    border: `1px solid ${bg.cardBorder}`, borderRadius: 8,
    fontSize: '16px', fontFamily: IRIS_FONTS.body,
    background: 'rgba(255,255,255,0.85)', color: bg.ink,
    outline: 'none', boxSizing: 'border-box',
  };
}

function btnPrimary(bg: IrisBackgroundDef): React.CSSProperties {
  return {
    background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
    color: '#fff', border: 'none', borderRadius: 999,
    padding: '0.65rem 1.4rem', fontWeight: 700, cursor: 'pointer',
    fontSize: '0.85rem', boxShadow: `0 6px 18px ${bg.accent}44`,
    fontFamily: IRIS_FONTS.body, minHeight: 44,
  };
}

function btnSecondary(bg: IrisBackgroundDef): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.85)', color: bg.ink,
    border: `1px solid ${bg.cardBorder}`, borderRadius: 999,
    padding: '0.65rem 1.2rem', fontWeight: 600, cursor: 'pointer',
    fontSize: '0.85rem', fontFamily: IRIS_FONTS.body, minHeight: 44,
  };
}
