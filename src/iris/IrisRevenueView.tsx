// ============================================================
// IRIS — 収益管理ビュー
// 案件収入 / スポンサー / アフィリエイト / グッズコラボ を一括計上
// recharts BarChart (月次推移) + PieChart (収入源別内訳)
// ============================================================
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { CountUp, Sparkline } from '../components/visualFx';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  bg: IrisBackgroundDef;
}

export type RevenueSource = '案件PR' | 'スポンサー' | 'アフィリエイト' | 'グッズ/コラボ' | 'その他';

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
  'その他':        '#A0A0B8',
};

const STORAGE_KEY = 'iris_revenue_entries_v1';

function loadEntries(): RevenueEntry[] {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}
function saveEntries(data: RevenueEntry[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* */ }
}

const ALL_SOURCES: RevenueSource[] = ['案件PR', 'スポンサー', 'アフィリエイト', 'グッズ/コラボ', 'その他'];

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
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    source: '案件PR' as RevenueSource,
    description: '',
    amountJPY: '',
  });

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

  // ─── サマリー ──────────────────────────────────────────────
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const summary = useMemo(() => {
    const monthlyTotal = entries
      .filter(e => e.date.startsWith(currentMonth))
      .reduce((s, e) => s + e.amountJPY, 0);
    const yearTotal = entries
      .filter(e => e.date.startsWith(String(now.getFullYear())))
      .reduce((s, e) => s + e.amountJPY, 0);

    const srcMap = new Map<RevenueSource, number>();
    for (const e of entries) srcMap.set(e.source, (srcMap.get(e.source) ?? 0) + e.amountJPY);
    let topSource: RevenueSource = '案件PR';
    let topAmt = 0;
    for (const [src, amt] of srcMap) { if (amt > topAmt) { topAmt = amt; topSource = src; } }

    // 直近 12 ヶ月の月次合計 (スパークライン用)
    const trend: number[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      trend.push(entries.filter(e => e.date.startsWith(m)).reduce((s, e) => s + e.amountJPY, 0));
    }

    return { monthlyTotal, yearTotal, topSource, trend };
  }, [entries, currentMonth]);

  // ─── 月次グラフデータ (12ヶ月) ───────────────────────────
  const barData = useMemo(() => {
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months.map(m => {
      const row: Record<string, number | string> = { month: m.slice(5) + '月' };
      for (const src of ALL_SOURCES) {
        row[src] = entries
          .filter(e => e.date.startsWith(m) && e.source === src)
          .reduce((s, e) => s + e.amountJPY, 0);
      }
      return row;
    });
  }, [entries]);

  // ─── Pie データ ────────────────────────────────────────────
  const pieData = useMemo(() => {
    return ALL_SOURCES
      .map(src => ({
        name: src,
        value: entries
          .filter(e => e.date.startsWith(String(now.getFullYear())) && e.source === src)
          .reduce((s, e) => s + e.amountJPY, 0),
      }))
      .filter(d => d.value > 0);
  }, [entries]);

  return (
    <div style={{ display: 'grid', gap: '1.5rem', fontFamily: IRIS_FONTS.body }}>
      {/* ヘッダ */}
      <div>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 600 }}>REVENUE</p>
        <h1 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', color: bg.ink, margin: '0.25rem 0 0.5rem', fontWeight: 500 }}>
          収益を、見える化。
        </h1>
        <p style={{ fontSize: '0.85rem', color: bg.inkSoft, lineHeight: 1.8, fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>
          案件・スポンサー・アフィリ・グッズ — すべての収入を一か所に。
        </p>
      </div>

      {/* サマリーカード */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
        <SummaryCard bg={bg} label="今月の収益" amount={summary.monthlyTotal} spark={summary.trend.slice(-6)} delay={0} />
        <SummaryCard bg={bg} label="年間累計" amount={summary.yearTotal} spark={summary.trend} delay={0.08} />
        <SummaryCard bg={bg} label="トップ収入源" text={summary.topSource} delay={0.16} />
      </div>

      {/* 月次棒グラフ */}
      <div style={{ padding: '1.5rem', background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 16 }}>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: bg.accent, fontWeight: 600, marginBottom: '1rem' }}>MONTHLY TREND — 12ヶ月</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={barData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: bg.inkSoft }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `¥${(v / 10000).toFixed(0)}万`} tick={{ fontSize: 11, fill: bg.inkSoft }} axisLine={false} tickLine={false} width={54} />
            <Tooltip content={<ChartTooltip />} />
            {ALL_SOURCES.map(src => (
              <Bar key={src} dataKey={src} stackId="a" fill={SOURCE_COLORS[src]} radius={src === 'その他' ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        {/* 凡例 */}
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
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData} cx="50%" cy="50%"
                outerRadius={80} dataKey="value"
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

      {/* 収益追加ボタン */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
            color: '#fff', border: 'none', borderRadius: 999,
            padding: '0.75rem 1.5rem', fontWeight: 700, cursor: 'pointer',
            fontSize: '0.9rem', boxShadow: `0 6px 18px ${bg.accent}44`,
            fontFamily: IRIS_FONTS.body,
          }}
        >
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
      {entries.length > 0 && (
        <div style={{ padding: '1.5rem', background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 16 }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: bg.accent, fontWeight: 600, marginBottom: '0.85rem' }}>HISTORY</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 360, overflowY: 'auto' }}>
            {entries.map(e => (
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
                <span style={{ flex: 1, fontSize: '0.85rem', color: bg.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</span>
                <span style={{ fontWeight: 700, color: bg.ink, fontFamily: IRIS_FONTS.mono, whiteSpace: 'nowrap' }}>
                  ¥{e.amountJPY.toLocaleString()}
                </span>
                <button onClick={() => deleteEntry(e.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: bg.inkSoft, fontSize: '0.9rem', padding: '0.2rem 0.3rem' }}>

                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {entries.length === 0 && !showForm && (
        <div style={{
          padding: '2rem', background: bg.card, border: `1px dashed ${bg.cardBorder}`,
          borderRadius: 16, textAlign: 'center', color: bg.inkSoft,
          fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
        }}>
          まだ収益データがありません。「収益を記録する」から始めましょう。
        </div>
      )}
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
    fontSize: '0.9rem', fontFamily: IRIS_FONTS.body,
    background: 'rgba(255,255,255,0.85)', color: bg.ink,
    outline: 'none', boxSizing: 'border-box',
  };
}
