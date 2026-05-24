// ============================================================
// BenchmarkStudio — 業界ベンチマーク比較 (分析 / 履歴 / 競合 タブ + 自前業界 + Markdown 出力 + Agent 委任)
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import type { Persona, AppSettings } from '../types/identity';
import type { BenchmarkEntry } from '../lib/benchmarkData';
import {
  analyzeAgainstIndustry, saveBenchmarkResult,
  getAllIndustries, getBenchmarksForIndustry,
  addCustomIndustry, deleteCustomIndustry, loadCustomIndustries,
  loadHistory, clearHistory,
  loadCompetitors, saveCompetitors,
  generateMarkdownReport,
  type BenchmarkResult, type KpiRanking, type UserMetrics,
  type CompetitorEntry, type BenchmarkSnapshot,
} from '../lib/benchmarkAnalyst';
import { useInvoices } from '../hooks/useInvoices';
import { useSalesLedger } from '../hooks/useSalesLedger';
import { useExpenses } from '../hooks/useExpenses';
import { useAgentTaskQueue } from '../hooks/useAgentTaskQueue';
import { copyText } from '../lib/clipboard';
import { notifyInApp } from '../lib/inAppNotify';
import ApiErrorCard from './ApiErrorCard';

interface Props {
  persona: Persona;
  settings: AppSettings;
  onClose: () => void;
}

type ViewTab = 'analyze' | 'history' | 'competitor';

// ── ランクバッジ ─────────────────────────────────────────
function RankBadge({ rank }: { rank: 'top' | 'mid' | 'low' }) {
  const cfg = {
    top: { label: '上位', bg: 'rgba(74,222,128,0.15)', color: '#4ade80', border: 'rgba(74,222,128,0.4)' },
    mid: { label: '中位', bg: 'rgba(250,204,21,0.12)', color: '#facc15', border: 'rgba(250,204,21,0.35)' },
    low: { label: '要改善', bg: 'rgba(248,113,113,0.12)', color: '#f87171', border: 'rgba(248,113,113,0.35)' },
  }[rank];
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  );
}

// ── KPI バレットバー ────────────────────────────────────
function BulletBar({ r, competitorVals }: { r: KpiRanking; competitorVals?: Array<{ name: string; value: number; color: string }> }) {
  const range = r.p75 - r.p25 || 1;
  const minV = r.p25 - range * 0.3;
  const maxV = r.p75 + range * 0.3;
  const toPos = (v: number) => {
    const clamped = Math.max(minV, Math.min(maxV, v));
    return ((clamped - minV) / (maxV - minV)) * 100;
  };

  const userPos = toPos(r.userValue);
  const medianPos = toPos(r.p50);
  const p25Pos = toPos(r.p25);
  const p75Pos = toPos(r.p75);

  const markerColor = r.rank === 'top' ? '#4ade80' : r.rank === 'mid' ? '#facc15' : '#f87171';

  return (
    <div className="relative h-5 rounded-full overflow-visible" style={{ background: 'var(--surface-3)' }}>
      <div className="absolute inset-y-0 rounded-l-full"
        style={{
          left: 0, width: `${p25Pos}%`,
          background: r.lowerIsBetter ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
        }} />
      <div className="absolute inset-y-0"
        style={{
          left: `${p25Pos}%`,
          width: `${p75Pos - p25Pos}%`,
          background: 'rgba(250,204,21,0.12)',
        }} />
      <div className="absolute inset-y-0 rounded-r-full"
        style={{
          left: `${p75Pos}%`,
          right: 0,
          background: r.lowerIsBetter ? 'rgba(248,113,113,0.15)' : 'rgba(74,222,128,0.15)',
        }} />
      <div className="absolute inset-y-0 w-0.5 opacity-50"
        style={{ left: `${medianPos}%`, background: '#888', transform: 'translateX(-50%)' }} />
      {competitorVals?.map((c, i) => (
        <div key={i}
          className="absolute top-1/2 w-2.5 h-2.5 z-10"
          style={{
            left: `${toPos(c.value)}%`,
            transform: 'translate(-50%, -50%) rotate(45deg)',
            background: c.color, opacity: 0.85,
            border: '1px solid #0a0a0f',
          }}
          title={`${c.name}: ${c.value}${r.unit}`}
        />
      ))}
      <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-lg z-20"
        style={{ left: `${userPos}%`, transform: 'translate(-50%, -50%)', background: markerColor, border: '2px solid #0a0a0f' }}
        title={`自社: ${r.userValue}${r.unit}`}
      />
    </div>
  );
}

// ── レポートHTML生成 (印刷→PDF) ────────────────────────
function generateReportHtml(result: BenchmarkResult, personaName: string): string {
  const date = new Date(result.generatedAt).toLocaleDateString('ja-JP');
  const topPct = 100 - result.overallPercentile;
  const rankRows = result.rankings.map(r => {
    const rankLabel = r.rank === 'top' ? '◎ 上位' : r.rank === 'mid' ? '△ 中位' : '▼ 要改善';
    return `<tr>
      <td>${r.label}</td>
      <td style="text-align:center;font-family:monospace">${r.userValue}${r.unit}</td>
      <td style="text-align:center">${r.p50}${r.unit}</td>
      <td style="text-align:center;color:${r.rank === 'top' ? '#16a34a' : r.rank === 'mid' ? '#b45309' : '#dc2626'}">${rankLabel}</td>
      <td style="text-align:center">${r.estimatedPercentile}%ile</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">
<title>業界ベンチマークレポート — ${personaName}</title>
<style>
  body{font-family:'Hiragino Sans','Meiryo',sans-serif;margin:40px;color:#111;line-height:1.6}
  h1{font-size:1.5rem;border-bottom:3px solid #2563eb;padding-bottom:8px}
  h2{font-size:1.1rem;margin-top:24px;color:#1e3a8a}
  .meta{color:#555;font-size:0.9rem;margin-bottom:16px}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:0.85rem;font-weight:600;background:#dbeafe;color:#1d4ed8}
  table{width:100%;border-collapse:collapse;margin-top:12px;font-size:0.88rem}
  th{background:#f1f5f9;padding:8px 10px;text-align:left;border:1px solid #e2e8f0}
  td{padding:7px 10px;border:1px solid #e2e8f0}
  tr:hover td{background:#f8fafc}
  ul{margin:8px 0;padding-left:20px}
  li{margin:4px 0}
  .strength{color:#15803d}.weakness{color:#b91c1c}.action{color:#1d4ed8}
  @media print{body{margin:20px}}
</style></head><body>
<h1>業界ベンチマーク分析レポート</h1>
<p class="meta">事業者: <strong>${personaName}</strong> &nbsp;|&nbsp; 業界: <strong>${result.industryLabel}</strong> &nbsp;|&nbsp; 生成日: ${date}</p>
<p class="badge">総合評価: 上位 ${topPct}% (${result.overallPercentile}パーセンタイル)</p>
<h2>総合評価</h2>
<p>${result.summary}</p>
<h2>KPI 詳細比較</h2>
<table><thead><tr><th>KPI</th><th>自社</th><th>業界中央値</th><th>評価</th><th>推定パーセンタイル</th></tr></thead>
<tbody>${rankRows}</tbody></table>
<h2>強み (上位KPI)</h2>
<ul>${result.strengths.map(s => `<li class="strength">${s}</li>`).join('')}</ul>
<h2>改善ポイント</h2>
<ul>${result.weaknesses.map(w => `<li class="weakness">${w}</li>`).join('')}</ul>
<h2>推奨アクション</h2>
<ol>${result.recommendedActions.map(a => `<li class="action">${a}</li>`).join('')}</ol>
<p style="margin-top:40px;font-size:0.75rem;color:#888">Generated by CORE Prism OS · ベンチマーク出典: ${[...new Set(result.rankings.map(r => r.source))].join(', ')}</p>
</body></html>`;
}

// ── RadarChart 用データ正規化 ────────────────────────────
function normalizeForRadar(r: KpiRanking): number {
  const range = r.p75 - r.p25 || 1;
  let norm: number;
  if (!r.lowerIsBetter) {
    norm = ((r.userValue - r.p25) / range) * 100;
  } else {
    norm = ((r.p75 - r.userValue) / range) * 100;
  }
  return Math.min(130, Math.max(0, Math.round(norm)));
}

// ── 自前業界の追加エディタ ───────────────────────────────
function CustomIndustryEditor({
  onSaved, onCancel, accentColor,
}: {
  onSaved: (id: string) => void;
  onCancel: () => void;
  accentColor: string;
}) {
  const [label, setLabel] = useState('');
  const [emoji, setEmoji] = useState('📦');
  const [rows, setRows] = useState<Array<{ label: string; unit: string; p25: string; p50: string; p75: string; lowerIsBetter: boolean }>>([
    { label: '', unit: '%', p25: '', p50: '', p75: '', lowerIsBetter: false },
  ]);
  const [error, setError] = useState<string | null>(null);

  const addRow = () => setRows(prev => [...prev, { label: '', unit: '%', p25: '', p50: '', p75: '', lowerIsBetter: false }]);
  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));
  const update = (i: number, key: string, val: string | boolean) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r));

  const save = () => {
    setError(null);
    if (!label.trim()) { setError('業界名を入力してください'); return; }
    const validRows = rows.filter(r => r.label.trim() && r.p25 !== '' && r.p50 !== '' && r.p75 !== '');
    if (validRows.length === 0) { setError('KPI を 1 つ以上完全入力してください'); return; }
    const entries: BenchmarkEntry[] = validRows.map((r, idx) => ({
      industry: 'pending',
      key: 'kpi_' + idx + '_' + r.label.replace(/\s+/g, '_').slice(0, 12),
      label: r.label.trim(),
      unit: r.unit || '',
      lowerIsBetter: r.lowerIsBetter,
      p25: Number(r.p25),
      p50: Number(r.p50),
      p75: Number(r.p75),
      source: '自前定義',
      description: `${r.label.trim()} の業界推計値`,
    }));
    const created = addCustomIndustry({ label: label.trim(), emoji: emoji || '📦', entries });
    onSaved(created.id);
  };

  return (
    <div className="cp-card-section cp-stack-sm" style={{ border: `1px dashed ${accentColor}60` }}>
      <p className="cp-h3">自前業界を追加</p>
      <div className="grid grid-cols-[60px_1fr] gap-2">
        <input
          value={emoji}
          onChange={e => setEmoji(e.target.value.slice(0, 2))}
          placeholder="📦"
          className="px-2 py-2 rounded-lg text-center text-xl"
          style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: '20px' }}
        />
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="業界名 (例: ヨガスタジオ)"
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: '16px' }}
        />
      </div>

      <p className="cp-tiny">KPI と業界の 25/50/75 パーセンタイル値を入れます</p>
      {rows.map((r, i) => (
        <div key={i} className="p-2 rounded-lg cp-stack-sm" style={{ background: 'var(--surface-3)' }}>
          <div className="grid grid-cols-[1fr_70px_28px] gap-1.5">
            <input value={r.label} onChange={e => update(i, 'label', e.target.value)}
              placeholder="KPI 名 (例: 月間予約数)" className="px-2 py-1.5 rounded text-sm"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: '16px' }} />
            <input value={r.unit} onChange={e => update(i, 'unit', e.target.value)}
              placeholder="単位" className="px-2 py-1.5 rounded text-sm"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: '16px' }} />
            {rows.length > 1 ? (
              <button onClick={() => removeRow(i)} className="text-fg-muted hover:text-red-400 text-lg leading-none">×</button>
            ) : <span />}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <input type="number" inputMode="decimal" value={r.p25} onChange={e => update(i, 'p25', e.target.value)}
              placeholder="下位 25%" className="px-2 py-1.5 rounded text-sm font-mono"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: '16px' }} />
            <input type="number" inputMode="decimal" value={r.p50} onChange={e => update(i, 'p50', e.target.value)}
              placeholder="中央値" className="px-2 py-1.5 rounded text-sm font-mono"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: '16px' }} />
            <input type="number" inputMode="decimal" value={r.p75} onChange={e => update(i, 'p75', e.target.value)}
              placeholder="上位 25%" className="px-2 py-1.5 rounded text-sm font-mono"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: '16px' }} />
          </div>
          <label className="cp-row gap-1 text-xs text-fg-muted">
            <input type="checkbox" checked={r.lowerIsBetter}
              onChange={e => update(i, 'lowerIsBetter', e.target.checked)} />
            <span>値が低いほど良い (例: チャーン率)</span>
          </label>
        </div>
      ))}
      <button onClick={addRow} className="cp-btn cp-btn-ghost cp-btn-sm w-full">+ KPI を追加</button>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="cp-row justify-between mt-2 gap-2">
        <button onClick={onCancel} className="cp-btn cp-btn-ghost cp-btn-sm">キャンセル</button>
        <button onClick={save} className="cp-btn cp-btn-sm"
          style={{ background: accentColor, color: '#0a0a0f', borderColor: 'transparent' }}>
          保存して使う
        </button>
      </div>
    </div>
  );
}

// ── ステップ1: 業界選択 ─────────────────────────────────────
function StepIndustry({
  selected, onSelect, accentColor, refreshKey, onRefresh,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
  accentColor: string;
  refreshKey: number;
  onRefresh: () => void;
}) {
  const [showEditor, setShowEditor] = useState(false);
  const industries = useMemo(() => getAllIndustries(), [refreshKey]);
  const customs = useMemo(() => loadCustomIndustries(), [refreshKey]);

  const handleDelete = (id: string) => {
    if (!confirm('この自前業界を削除しますか？')) return;
    deleteCustomIndustry(id);
    onRefresh();
  };

  return (
    <div className="cp-stack">
      <p className="cp-h3">業界を選択</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {industries.map(ind => {
          const isSelected = selected === ind.id;
          const isCustom = ind.isCustom;
          return (
            <button key={ind.id}
              onClick={() => onSelect(ind.id)}
              className="p-3 rounded-xl text-left transition-all relative min-h-[72px]"
              style={isSelected
                ? { background: accentColor + '20', border: `2px solid ${accentColor}`, color: 'var(--fg)' }
                : { background: 'var(--surface-3)', border: '2px solid transparent', color: 'var(--fg-muted)' }}
            >
              <span className="text-2xl block mb-1">{ind.emoji}</span>
              <span className="text-sm font-medium block leading-tight">{ind.label}</span>
              {isCustom && (
                <span className="absolute top-1 right-1 text-[10px] px-1 rounded"
                  style={{ background: accentColor + '30', color: accentColor }}>自前</span>
              )}
            </button>
          );
        })}
        <button
          onClick={() => setShowEditor(true)}
          className="p-3 rounded-xl text-center min-h-[72px] flex flex-col items-center justify-center gap-1"
          style={{ background: 'var(--surface-3)', border: `2px dashed ${accentColor}60`, color: accentColor }}>
          <span className="text-2xl">+</span>
          <span className="text-xs font-medium">自前業界を追加</span>
        </button>
      </div>

      {customs.length > 0 && (
        <div className="cp-card-section">
          <p className="cp-tiny mb-1.5">自前業界の管理</p>
          <div className="cp-stack-sm">
            {customs.map(c => (
              <div key={c.id} className="cp-row-between text-sm">
                <span className="text-fg">{c.emoji} {c.label} <span className="cp-tiny ml-1">({c.entries.length} KPI)</span></span>
                <button onClick={() => handleDelete(c.id)}
                  className="text-fg-muted hover:text-red-400 text-xs px-2 py-1">削除</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showEditor && (
        <CustomIndustryEditor
          accentColor={accentColor}
          onCancel={() => setShowEditor(false)}
          onSaved={id => {
            setShowEditor(false);
            onRefresh();
            onSelect(id);
          }}
        />
      )}
    </div>
  );
}

// ── ステップ2: 数値入力 ─────────────────────────────────────
function StepMetrics({
  industryId,
  metrics,
  onChange,
  autoValues,
  accentColor,
}: {
  industryId: string;
  metrics: UserMetrics;
  onChange: (key: string, val: string) => void;
  autoValues: UserMetrics;
  accentColor: string;
}) {
  const entries = useMemo(() => getBenchmarksForIndustry(industryId), [industryId]);

  return (
    <div className="cp-stack">
      <div className="cp-row-between flex-wrap gap-2">
        <p className="cp-h3">自社数値を入力</p>
        {Object.keys(autoValues).length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: accentColor + '18', color: accentColor, border: `1px solid ${accentColor}40` }}>
            P&L から{Object.keys(autoValues).length}項目を自動入力
          </span>
        )}
      </div>
      <p className="cp-meta">空欄の KPI は分析から除外</p>
      <div className="space-y-3">
        {entries.map(entry => {
          const rawVal = metrics[entry.key];
          const val = rawVal !== undefined ? String(rawVal) : '';
          const isAuto = autoValues[entry.key] !== undefined;
          return (
            <div key={entry.key} className="cp-card-section">
              <div className="cp-row-between mb-1">
                <div className="min-w-0">
                  <span className="text-fg text-sm font-medium">{entry.label}</span>
                  {entry.lowerIsBetter && <span className="text-xs ml-2 text-fg-muted">(低い方が良)</span>}
                  {isAuto && (
                    <span className="text-xs ml-2 px-1.5 py-0.5 rounded"
                      style={{ background: accentColor + '18', color: accentColor }}>自動</span>
                  )}
                </div>
                <span className="cp-meta flex-shrink-0">{entry.unit}</span>
              </div>
              <p className="cp-tiny mb-1.5">{entry.description}</p>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  inputMode="decimal"
                  value={val}
                  onChange={e => onChange(entry.key, e.target.value)}
                  placeholder={`例: ${entry.p50}`}
                  className="flex-1 px-3 py-2 rounded-lg"
                  style={{
                    background: 'var(--surface-3)',
                    border: `1px solid ${val !== '' ? accentColor + '60' : 'var(--border)'}`,
                    color: 'var(--fg)',
                    fontSize: '16px', // iOS 自動ズーム回避
                  }}
                />
                <div className="text-xs text-fg-muted flex-shrink-0">
                  <span>中央値: <strong>{entry.p50}{entry.unit}</strong></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ステップ3: 結果 ──────────────────────────────────────────
function StepResult({
  result,
  personaName,
  accentColor,
  competitors,
  onProposeAgents,
  proposeBusy,
}: {
  result: BenchmarkResult;
  personaName: string;
  accentColor: string;
  competitors: CompetitorEntry[];
  onProposeAgents: () => void;
  proposeBusy: boolean;
}) {
  const radarData = result.rankings.slice(0, 6).map(r => ({
    subject: r.label.length > 8 ? r.label.slice(0, 7) + '…' : r.label,
    value: normalizeForRadar(r),
    fullMark: 100,
  }));

  const compColors = ['#f87171', '#60a5fa', '#a78bfa'];

  const handlePdf = () => {
    const html = generateReportHtml(result, personaName);
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      notifyInApp({ kind: 'warn', title: 'ポップアップがブロックされました', body: 'ブラウザのポップアップ許可をオンにしてください', duration: 5000 });
      return;
    }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 600);
  };

  const handleCopyMarkdown = async () => {
    const md = generateMarkdownReport(result, personaName, competitors);
    await copyText(md, 'ベンチマーク レポート (Markdown)');
  };

  return (
    <div className="cp-stack">
      <motion.div
        className="p-4 rounded-2xl text-center"
        style={{ background: `linear-gradient(135deg, ${accentColor}18, var(--surface-3))`, border: `1px solid ${accentColor}40` }}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <p className="text-fg-muted text-xs tracking-widest uppercase mb-1">{result.industryLabel} 業界</p>
        <p className="text-5xl font-bold mb-1" style={{ color: accentColor }}>上位 {100 - result.overallPercentile}%</p>
        <p className="cp-meta">総合 {result.overallPercentile} パーセンタイル ({result.rankings.length} KPI 分析)</p>
        <p className="text-fg text-sm mt-2 leading-relaxed">{result.summary}</p>
      </motion.div>

      {radarData.length >= 3 && (
        <div className="cp-card-section">
          <p className="cp-h3 mb-3">KPI レーダー</p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--fg-muted)', fontSize: 11 }} />
              <Radar name="自社" dataKey="value" stroke={accentColor} fill={accentColor} fillOpacity={0.2} strokeWidth={2} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: `1px solid ${accentColor}40`, borderRadius: 8 }}
                labelStyle={{ color: 'var(--fg)' }}
                formatter={(v: unknown) => [`${v}pt`, '正規化スコア']}
              />
            </RadarChart>
          </ResponsiveContainer>
          <p className="cp-tiny text-center mt-1">100pt = 業界75パーセンタイル水準</p>
        </div>
      )}

      <div className="cp-card-section cp-stack-sm">
        <div className="cp-row-between flex-wrap gap-2">
          <p className="cp-h3">KPI 詳細</p>
          {competitors.length > 0 && (
            <div className="flex items-center gap-2 text-xs flex-wrap">
              {competitors.map((c, idx) => (
                <span key={c.id} className="flex items-center gap-1 text-fg-muted">
                  <span className="w-2 h-2 inline-block rotate-45" style={{ background: compColors[idx] || '#888' }} />
                  {c.name}
                </span>
              ))}
            </div>
          )}
        </div>
        {result.rankings.map(r => {
          const cvals = competitors
            .map((c, idx) => ({ name: c.name, value: c.metrics[r.key], color: compColors[idx] || '#888' }))
            .filter(v => v.value !== undefined) as Array<{ name: string; value: number; color: string }>;
          return (
            <div key={r.key}>
              <div className="cp-row-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-fg text-sm truncate">{r.label}</span>
                  <RankBadge rank={r.rank} />
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-mono text-fg text-sm">{r.userValue}{r.unit}</span>
                  <span className="cp-tiny">{r.estimatedPercentile}%ile</span>
                </div>
              </div>
              <BulletBar r={r} competitorVals={cvals} />
              <div className="flex justify-between mt-0.5">
                <span className="cp-tiny">{r.p25}{r.unit}</span>
                <span className="cp-tiny">中央値 {r.p50}{r.unit}</span>
                <span className="cp-tiny">{r.p75}{r.unit}</span>
              </div>
            </div>
          );
        })}
      </div>

      {(result.strengths.length > 0 || result.weaknesses.length > 0) && (
        <div className="cp-grid-2">
          {result.strengths.length > 0 && (
            <div className="cp-card-section cp-stack-sm">
              <p className="cp-h3">強み</p>
              {result.strengths.map((s, i) => (
                <div key={i} className="cp-row gap-2">
                  <span className="flex-shrink-0 text-green-400 text-sm">◎</span>
                  <p className="text-fg text-sm leading-snug">{s}</p>
                </div>
              ))}
            </div>
          )}
          {result.weaknesses.length > 0 && (
            <div className="cp-card-section cp-stack-sm">
              <p className="cp-h3">改善ポイント</p>
              {result.weaknesses.map((w, i) => (
                <div key={i} className="cp-row gap-2">
                  <span className="flex-shrink-0 text-red-400 text-sm">▼</span>
                  <p className="text-fg text-sm leading-snug">{w}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {result.recommendedActions.length > 0 && (
        <div className="cp-card-section cp-stack-sm">
          <p className="cp-h3">推奨アクション</p>
          {result.recommendedActions.map((a, i) => (
            <div key={i} className="cp-row gap-3">
              <span className="text-xs w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 font-bold"
                style={{ background: accentColor + '20', color: accentColor }}>
                {i + 1}
              </span>
              <p className="text-fg text-sm leading-snug">{a}</p>
            </div>
          ))}
          <button
            onClick={onProposeAgents}
            disabled={proposeBusy}
            className="cp-btn cp-btn-sm w-full mt-2"
            style={{ background: accentColor + '20', color: accentColor, borderColor: accentColor + '40' }}>
            {proposeBusy ? '提案中...' : '⚡ CDS / CSO / CMO に実行を依頼'}
          </button>
        </div>
      )}

      <p className="cp-tiny">
        データ出典: {[...new Set(result.rankings.map(r => r.source))].join(' / ')} ·
        分析日: {new Date(result.generatedAt).toLocaleDateString('ja-JP')}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          onClick={handleCopyMarkdown}
          className="cp-btn w-full"
          style={{ background: 'var(--surface-3)', color: 'var(--fg)', border: `1px solid ${accentColor}40` }}>
          Markdown をコピー
        </button>
        <button
          onClick={handlePdf}
          className="cp-btn w-full"
          style={{ background: accentColor, color: '#0a0a0f', borderColor: 'transparent' }}>
          PDF レポート (印刷)
        </button>
      </div>
    </div>
  );
}

// ── 履歴タブ ───────────────────────────────────────────
function HistoryTab({ personaId, accentColor }: { personaId: string; accentColor: string }) {
  const [history, setHistory] = useState<BenchmarkSnapshot[]>(() => loadHistory(personaId));
  const [selectedKpi, setSelectedKpi] = useState<string>('overall');

  const kpiOptions = useMemo(() => {
    const set = new Map<string, string>();
    set.set('overall', '総合パーセンタイル');
    history.forEach(s => s.rankings.forEach(r => set.set(r.key, r.label)));
    return Array.from(set.entries()).map(([key, label]) => ({ key, label }));
  }, [history]);

  const chartData = useMemo(() => {
    return history.map(s => {
      const base: Record<string, string | number> = {
        month: s.yearMonth,
        industry: s.industryLabel,
      };
      if (selectedKpi === 'overall') {
        base.value = 100 - s.overallPercentile;
      } else {
        const r = s.rankings.find(rr => rr.key === selectedKpi);
        if (r) {
          base.value = r.userValue;
          base.median = r.p50;
        }
      }
      return base;
    });
  }, [history, selectedKpi]);

  const reload = () => setHistory(loadHistory(personaId));
  const handleClear = () => {
    if (!confirm('履歴を全て削除しますか？')) return;
    clearHistory(personaId);
    reload();
  };

  if (history.length === 0) {
    return (
      <div className="cp-card-section text-center py-12">
        <p className="text-4xl mb-2">📈</p>
        <p className="cp-h3">履歴はまだありません</p>
        <p className="cp-meta">分析を実行すると月次スナップショットが保存され、ここで時系列を見られます</p>
      </div>
    );
  }

  return (
    <div className="cp-stack">
      <div className="cp-row-between flex-wrap gap-2">
        <p className="cp-h3">月次スナップショット ({history.length} 件)</p>
        <button onClick={handleClear} className="cp-btn cp-btn-ghost cp-btn-sm text-xs">履歴を削除</button>
      </div>

      <div className="cp-card-section">
        <div className="cp-row-between mb-3 flex-wrap gap-2">
          <p className="text-sm text-fg">時系列グラフ</p>
          <select
            value={selectedKpi}
            onChange={e => setSelectedKpi(e.target.value)}
            className="px-2 py-1.5 rounded text-sm"
            style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: '16px' }}>
            {kpiOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fill: 'var(--fg-muted)', fontSize: 11 }} />
            <YAxis tick={{ fill: 'var(--fg-muted)', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1a1a2e', border: `1px solid ${accentColor}40`, borderRadius: 8 }}
              labelStyle={{ color: 'var(--fg)' }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="value" stroke={accentColor} strokeWidth={2}
              dot={{ fill: accentColor, r: 3 }} name={selectedKpi === 'overall' ? '上位%' : '自社値'} />
            {selectedKpi !== 'overall' && (
              <Line type="monotone" dataKey="median" stroke="#888" strokeWidth={1.5}
                strokeDasharray="4 3" dot={false} name="業界中央値" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="cp-card-section cp-stack-sm">
        <p className="cp-h3">履歴一覧</p>
        {[...history].reverse().map((s, i) => (
          <div key={s.yearMonth + s.industryId + i} className="cp-row-between text-sm py-1"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="min-w-0">
              <span className="text-fg font-mono mr-2">{s.yearMonth}</span>
              <span className="text-fg-muted">{s.industryLabel}</span>
            </div>
            <span className="text-fg flex-shrink-0">上位 <strong style={{ color: accentColor }}>{100 - s.overallPercentile}%</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 競合タブ ───────────────────────────────────────────
function CompetitorTab({
  personaId, industryId, accentColor,
}: {
  personaId: string;
  industryId: string | null;
  accentColor: string;
}) {
  const [competitors, setCompetitors] = useState<CompetitorEntry[]>(
    () => industryId ? loadCompetitors(personaId, industryId) : []
  );
  const entries = useMemo(() => industryId ? getBenchmarksForIndustry(industryId) : [], [industryId]);

  useEffect(() => {
    if (industryId) setCompetitors(loadCompetitors(personaId, industryId));
    else setCompetitors([]);
  }, [personaId, industryId]);

  const persistAndSet = (list: CompetitorEntry[]) => {
    setCompetitors(list);
    if (industryId) saveCompetitors(personaId, industryId, list);
  };

  const addCompetitor = () => {
    if (competitors.length >= 3) return;
    const id = 'c_' + Math.random().toString(36).slice(2, 8);
    persistAndSet([...competitors, { id, name: `競合${competitors.length + 1}`, metrics: {} }]);
  };

  const removeCompetitor = (id: string) => {
    persistAndSet(competitors.filter(c => c.id !== id));
  };

  const updateName = (id: string, name: string) => {
    persistAndSet(competitors.map(c => c.id === id ? { ...c, name } : c));
  };

  const updateMetric = (id: string, key: string, val: string) => {
    persistAndSet(competitors.map(c => {
      if (c.id !== id) return c;
      const m = { ...c.metrics };
      if (val === '') delete m[key];
      else m[key] = Number(val);
      return { ...c, metrics: m };
    }));
  };

  if (!industryId) {
    return (
      <div className="cp-card-section text-center py-12">
        <p className="text-4xl mb-2">🏢</p>
        <p className="cp-h3">先に業界を選択</p>
        <p className="cp-meta">「分析」タブで業界を選ぶと、ここで競合 1-3 社と並列比較できます</p>
      </div>
    );
  }

  return (
    <div className="cp-stack">
      <div className="cp-row-between flex-wrap gap-2">
        <div className="min-w-0">
          <p className="cp-h3">競合直接比較</p>
          <p className="cp-meta">競合 (最大3社) の KPI を入力すると、結果に並列表示されます</p>
        </div>
        {competitors.length < 3 && (
          <button onClick={addCompetitor}
            className="cp-btn cp-btn-sm flex-shrink-0"
            style={{ background: accentColor + '20', color: accentColor, borderColor: accentColor + '40' }}>
            + 競合を追加
          </button>
        )}
      </div>

      {competitors.length === 0 && (
        <div className="cp-card-section text-center py-8">
          <p className="cp-meta">競合がまだ登録されていません</p>
        </div>
      )}

      {competitors.map((c, idx) => (
        <div key={c.id} className="cp-card-section cp-stack-sm">
          <div className="flex gap-2 items-center">
            <span className="w-3 h-3 rotate-45 flex-shrink-0" style={{ background: ['#f87171', '#60a5fa', '#a78bfa'][idx] }} />
            <input
              value={c.name}
              onChange={e => updateName(c.id, e.target.value)}
              placeholder={`競合${idx + 1}`}
              className="flex-1 px-3 py-2 rounded-lg font-medium min-w-0"
              style={{
                background: 'var(--surface-3)', border: '1px solid var(--border)',
                color: 'var(--fg)', fontSize: '16px',
              }}
            />
            <button onClick={() => removeCompetitor(c.id)}
              className="cp-btn cp-btn-ghost cp-btn-sm text-fg-muted flex-shrink-0">削除</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {entries.map(e => (
              <div key={e.key} className="flex items-center gap-2 text-sm">
                <label className="text-fg-muted text-xs flex-1 min-w-0 truncate">{e.label}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={c.metrics[e.key] !== undefined ? String(c.metrics[e.key]) : ''}
                  onChange={ev => updateMetric(c.id, e.key, ev.target.value)}
                  placeholder={String(e.p50)}
                  className="w-20 px-2 py-1.5 rounded text-sm font-mono text-right"
                  style={{
                    background: 'var(--surface-3)', border: '1px solid var(--border)',
                    color: 'var(--fg)', fontSize: '16px',
                  }}
                />
                <span className="text-xs text-fg-muted w-8 flex-shrink-0">{e.unit}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── メインコンポーネント ────────────────────────────────────
export default function BenchmarkStudio({ persona, settings, onClose }: Props) {
  const [tab, setTab] = useState<ViewTab>('analyze');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [industry, setIndustry] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<UserMetrics>({});
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [industryRefresh, setIndustryRefresh] = useState(0);
  const [proposeBusy, setProposeBusy] = useState(false);

  const inv = useInvoices();
  const ledger = useSalesLedger(inv.invoices);
  const exp = useExpenses();
  const queue = useAgentTaskQueue();

  const autoValues = useMemo<UserMetrics>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const recentSales = ledger.entries.filter(e => e.personaId === persona.id && e.date >= `${y - 1}-${String(now.getMonth() + 2).padStart(2, '0')}-01`);
    const recentExp = exp.entries.filter(e => e.personaId === persona.id && e.date >= `${y - 1}-${String(now.getMonth() + 2).padStart(2, '0')}-01`);
    const revenue = recentSales.reduce((s, e) => s + e.totalExcl, 0);
    const expTotal = recentExp.reduce((s, e) => s + e.amountExcl, 0);
    if (revenue === 0) return {} as UserMetrics;
    const grossMargin = Math.round(((revenue - expTotal) / revenue) * 100);
    const operatingMargin = grossMargin;
    return { grossMargin, operatingMargin } as UserMetrics;
  }, [ledger.entries, exp.entries, persona.id]);

  const competitors = useMemo<CompetitorEntry[]>(() =>
    industry ? loadCompetitors(persona.id, industry) : []
  , [persona.id, industry, tab, step]);

  const historyCount = useMemo(() => loadHistory(persona.id).length, [persona.id, step, tab]);

  const handleSelectIndustry = (id: string) => {
    setIndustry(id);
    setMetrics(prev => ({ ...autoValues, ...prev }));
    setStep(2);
  };

  const handleMetricChange = (key: string, val: string) => {
    setMetrics(prev => {
      const next = { ...prev };
      if (val === '') delete next[key];
      else next[key] = Number(val);
      return next;
    });
  };

  const handleAnalyze = async () => {
    if (!industry) return;
    setIsAnalyzing(true);
    setError(null);
    setStep(3);
    try {
      const res = await analyzeAgainstIndustry(industry, metrics, settings);
      setResult(res);
      saveBenchmarkResult(persona.id, res);
    } catch (e) {
      setError(e instanceof Error ? e.message : '分析中にエラーが発生しました');
      setStep(2);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleProposeAgents = () => {
    if (!result) return;
    setProposeBusy(true);
    try {
      const weakKpi = result.rankings.filter(r => r.rank === 'low').map(r => r.label).slice(0, 3).join(' / ') || '改善余地のある KPI';
      const actionsBlock = result.recommendedActions.slice(0, 4).map((a, i) => `${i + 1}. ${a}`).join('\n');

      queue.propose({
        title: `[ベンチマーク] ${result.industryLabel} の改善案を実行`,
        summary: `業界 ${result.industryLabel} における自社の総合は上位 ${100 - result.overallPercentile}%。要改善 KPI: ${weakKpi}。\n推奨アクション:\n${actionsBlock}`,
        why: `業界平均との差を縮め、上位 25% を目指すための具体策を CDS / CSO / CMO で分担実行します。`,
        expected: `要改善 KPI を 1 つ以上、中央値以上に引き上げる初動 3 つ`,
        dueDays: 7,
        steps: [
          { cxo: 'CDS', label: `${weakKpi} の悪化要因を 2-3 個に絞り、根本原因仮説を立てる` },
          { cxo: 'CSO', label: '営業面で打てる改善策を 2 つ起案 (短期 1ヶ月 / 中期 3ヶ月)' },
          { cxo: 'CMO', label: '改善策を支えるメッセージ・LP コピーを 1 案仕上げる' },
        ],
      });
      notifyInApp({ kind: 'success', title: 'CDS / CSO / CMO に提案しました', body: 'タスクハブで承認すると着手します', duration: 3500 });
    } catch (e) {
      notifyInApp({ kind: 'warn', title: '提案に失敗しました', body: e instanceof Error ? e.message : '', duration: 5000 });
    } finally {
      setProposeBusy(false);
    }
  };

  const canAnalyze = industry !== null && Object.keys(metrics).length > 0;

  return (
    <motion.div className="cp-modal-bg"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}>
      <motion.div className="cp-modal" style={{ maxWidth: '820px' }}
        initial={{ scale: 0.97, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 12 }}
        onClick={e => e.stopPropagation()}>

        <div className="cp-modal-header">
          <div className="cp-row min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: persona.accentColorLight, color: persona.accentColor }}>📊</div>
            <div className="min-w-0">
              <p className="cp-h2 truncate">業界ベンチマーク</p>
              <p className="cp-meta truncate">{persona.name} · 同業他社と比較して改善案まで</p>
            </div>
          </div>
          <button onClick={onClose} className="cp-btn cp-btn-ghost cp-btn-sm flex-shrink-0">✕</button>
        </div>

        {/* タブ */}
        <div className="cp-row px-4 pt-3 gap-1 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)' }}>
          {([
            { v: 'analyze' as const, label: '分析' },
            { v: 'history' as const, label: `履歴 (${historyCount})` },
            { v: 'competitor' as const, label: `競合 (${competitors.length})` },
          ]).map(t => (
            <button key={t.v}
              onClick={() => setTab(t.v)}
              className="px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors"
              style={tab === t.v
                ? { color: persona.accentColor, borderBottom: `2px solid ${persona.accentColor}` }
                : { color: 'var(--fg-muted)', borderBottom: '2px solid transparent' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ステップインジケーター (analyze タブのみ) */}
        {tab === 'analyze' && (
          <div className="cp-row px-4 pt-3 gap-2 flex-wrap">
            {([
              { n: 1 as const, label: '業界' },
              { n: 2 as const, label: '数値' },
              { n: 3 as const, label: '結果' },
            ]).map(s => (
              <div key={s.n} className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0"
                  style={step >= s.n
                    ? { background: persona.accentColor, color: '#0a0a0f' }
                    : { background: 'var(--surface-3)', color: 'var(--fg-muted)' }}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <span className={`text-xs ${step >= s.n ? 'text-fg' : 'text-fg-muted'}`}>{s.label}</span>
                {s.n < 3 && <span className="text-fg-muted text-xs">→</span>}
              </div>
            ))}
          </div>
        )}

        <div className="cp-modal-body cp-stack">
          <AnimatePresence mode="wait">
            {tab === 'analyze' && (
              <motion.div key={'analyze-' + step}
                initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }}>
                {step === 1 && (
                  <StepIndustry
                    selected={industry}
                    onSelect={handleSelectIndustry}
                    accentColor={persona.accentColor}
                    refreshKey={industryRefresh}
                    onRefresh={() => setIndustryRefresh(k => k + 1)}
                  />
                )}

                {step === 2 && industry && (
                  <>
                    <StepMetrics
                      industryId={industry}
                      metrics={metrics}
                      onChange={handleMetricChange}
                      autoValues={autoValues}
                      accentColor={persona.accentColor}
                    />
                    <ApiErrorCard error={error} onRetry={handleAnalyze} variant="auto" />
                    <div className="cp-row justify-between mt-4 gap-2 flex-wrap">
                      <button onClick={() => setStep(1)} className="cp-btn cp-btn-ghost cp-btn-sm">← 業界変更</button>
                      <button
                        onClick={handleAnalyze}
                        disabled={!canAnalyze}
                        className="cp-btn cp-btn-sm"
                        style={canAnalyze
                          ? { background: persona.accentColor, color: '#0a0a0f', borderColor: 'transparent' }
                          : {}}>
                        AI 分析を実行 →
                      </button>
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    {isAnalyzing ? (
                      <div className="text-center py-16">
                        <motion.div
                          className="text-5xl mb-4"
                          animate={{ rotate: [0, 15, -15, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}>
                          📊
                        </motion.div>
                        <p className="text-fg text-base font-medium">業界ベンチマークを分析中…</p>
                        <p className="cp-meta mt-1">Claude が KPI を同業他社と比較しています</p>
                      </div>
                    ) : result ? (
                      <>
                        <StepResult
                          result={result}
                          personaName={persona.name}
                          accentColor={persona.accentColor}
                          competitors={competitors}
                          onProposeAgents={handleProposeAgents}
                          proposeBusy={proposeBusy}
                        />
                        <div className="cp-row justify-between mt-2 gap-2 flex-wrap">
                          <button onClick={() => { setStep(2); setResult(null); }} className="cp-btn cp-btn-ghost cp-btn-sm">← 再入力</button>
                          <button onClick={() => setTab('competitor')} className="cp-btn cp-btn-ghost cp-btn-sm">競合を追加 →</button>
                        </div>
                      </>
                    ) : null}
                  </>
                )}
              </motion.div>
            )}

            {tab === 'history' && (
              <motion.div key="history"
                initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }}>
                <HistoryTab personaId={persona.id} accentColor={persona.accentColor} />
              </motion.div>
            )}

            {tab === 'competitor' && (
              <motion.div key="competitor"
                initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }}>
                <CompetitorTab
                  personaId={persona.id}
                  industryId={industry}
                  accentColor={persona.accentColor}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
