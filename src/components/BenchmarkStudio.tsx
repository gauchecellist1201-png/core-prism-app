// ============================================================
// BenchmarkStudio — 業界ベンチマーク比較 (分析 / 履歴 / 競合 タブ + 自前業界 + Markdown 出力 + Agent 委任)
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import type { Persona, AppSettings } from '../types/identity';
import type { BenchmarkEntry } from '../lib/benchmarkData';
import {
  analyzeAgainstIndustry, saveBenchmarkResult,
  getAllIndustries, getBenchmarksForIndustry, getIndustryInfo,
  addCustomIndustry, deleteCustomIndustry, loadCustomIndustries,
  loadHistory, clearHistory,
  loadCompetitors, saveCompetitors,
  generateMarkdownReport,
  inferIndustry, estimateMetricsFromQA,
  type BenchmarkResult, type KpiRanking, type UserMetrics,
  type CompetitorEntry, type BenchmarkSnapshot,
  type IndustryInference, type QaAnswers,
} from '../lib/benchmarkAnalyst';
import {
  generateCompetitorList, loadCompetitorList,
  loadUserAddedCompetitors, addUserCompetitor, removeUserCompetitor,
  type CompetitorBrand, type CompetitorListResult,
} from '../lib/competitorList';
import { useInvoices } from '../hooks/useInvoices';
import { useSalesLedger } from '../hooks/useSalesLedger';
import { useExpenses } from '../hooks/useExpenses';
import { useKnowledge } from '../hooks/useKnowledge';
import { useStripeRevenue } from '../hooks/useStripeRevenue';
import { useAgentTaskQueue } from '../hooks/useAgentTaskQueue';
import { copyText } from '../lib/clipboard';
import { notifyInApp } from '../lib/inAppNotify';
import ApiErrorCard from './ApiErrorCard';
import EmptyState from './EmptyState';
import DelegateToAgentTeamBanner from './DelegateToAgentTeamBanner';
import { StudioIntro } from './StudioIntro';

interface Props {
  persona: Persona;
  settings: AppSettings;
  onClose: () => void;
}

type ViewTab = 'assist' | 'analyze' | 'history' | 'competitor';
type AssistStage = 'industry' | 'qa' | 'review' | 'result';

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

// ============================================================
// ── AI 補助モード — サブコンポーネント ──────────────────────
// ============================================================

// 同業他社カード (1 社)
function CompetitorBrandCard({
  brand, accentColor, onRemove,
}: {
  brand: CompetitorBrand;
  accentColor: string;
  onRemove?: () => void;
}) {
  const [iconBroken, setIconBroken] = useState(false);
  const initial = brand.name.trim().slice(0, 1) || '?';
  const sizeBadge = brand.sizeRough === 'L' ? '大手'
    : brand.sizeRough === 'M' ? '中堅'
    : brand.sizeRough === 'S' ? '小規模' : null;

  return (
    <div className="cp-card-section cp-stack-sm relative" style={{ minHeight: 130 }}>
      <div className="flex items-center gap-2.5">
        {brand.iconUrl && !iconBroken ? (
          <img
            src={brand.iconUrl}
            alt=""
            width={32}
            height={32}
            onError={() => setIconBroken(true)}
            className="w-8 h-8 rounded-md flex-shrink-0"
            style={{ background: 'var(--surface-3)' }}
          />
        ) : (
          <div className="w-8 h-8 rounded-md flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: accentColor + '20', color: accentColor }}>
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg truncate">{brand.name}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {sizeBadge && (
              <span className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: 'var(--surface-3)', color: 'var(--fg-muted)' }}>
                {sizeBadge}
              </span>
            )}
            {brand.foundYear && (
              <span className="text-[10px] text-fg-muted">{brand.foundYear}年〜</span>
            )}
            {brand.isUserAdded && (
              <span className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: accentColor + '20', color: accentColor }}>自分で追加</span>
            )}
          </div>
        </div>
        {onRemove && (
          <button onClick={onRemove} className="text-fg-muted hover:text-red-400 text-xs flex-shrink-0">×</button>
        )}
      </div>
      {brand.oneLineNote && (
        <p className="text-xs text-fg-muted leading-snug">{brand.oneLineNote}</p>
      )}
      <a href={brand.hpUrl} target="_blank" rel="noopener noreferrer"
        className="text-xs underline truncate block"
        style={{ color: accentColor }}>
        {brand.hpUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
      </a>
    </div>
  );
}

// 同業他社セクション (一覧 + 追加 UI)
function CompetitorBrandsSection({
  industryId, personaName, settings, accentColor,
  knowledgeTitles, knowledgeSummary,
}: {
  industryId: string;
  personaName: string;
  settings: AppSettings;
  accentColor: string;
  knowledgeTitles: string[];
  knowledgeSummary: string;
}) {
  const [list, setList] = useState<CompetitorListResult | null>(() => loadCompetitorList(industryId));
  const [userAdded, setUserAdded] = useState<CompetitorBrand[]>(() => loadUserAddedCompetitors(industryId));
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newNote, setNewNote] = useState('');

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const r = await generateCompetitorList(industryId, settings, {
        personaName,
        knowledgeTitles, knowledgeSummary,
        forceRefresh,
      });
      setList(r);
    } catch (e) {
      notifyInApp({ kind: 'warn', title: '同業他社の取得に失敗', body: e instanceof Error ? e.message : '', duration: 4000 });
    } finally {
      setLoading(false);
    }
  }, [industryId, settings, personaName, knowledgeTitles, knowledgeSummary]);

  useEffect(() => {
    if (!list && industryId) load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [industryId]);

  const handleAddUser = () => {
    if (!newName.trim() || !/^https?:\/\//.test(newUrl)) {
      notifyInApp({ kind: 'warn', title: '入力エラー', body: '会社名と HP(https://〜) を入れてください', duration: 3500 });
      return;
    }
    addUserCompetitor(industryId, {
      name: newName.trim(),
      hpUrl: newUrl.trim(),
      oneLineNote: newNote.trim().slice(0, 60),
    });
    setUserAdded(loadUserAddedCompetitors(industryId));
    setNewName(''); setNewUrl(''); setNewNote('');
    setShowAddForm(false);
  };

  const handleRemoveUser = (name: string) => {
    removeUserCompetitor(industryId, name);
    setUserAdded(loadUserAddedCompetitors(industryId));
  };

  const all = [...userAdded, ...(list?.competitors ?? [])];

  return (
    <div className="cp-card-section cp-stack-sm">
      <div className="cp-row-between flex-wrap gap-2">
        <div className="min-w-0">
          <p className="cp-h3">同業他社</p>
          <p className="cp-tiny">{list?.industryLabel || ''} の代表的な会社。クリックで HP へ。</p>
        </div>
        <button onClick={() => load(true)} disabled={loading}
          className="cp-btn cp-btn-ghost cp-btn-sm text-xs flex-shrink-0">
          {loading ? '取得中…' : '🔄 更新'}
        </button>
      </div>

      {loading && all.length === 0 && (
        <div className="text-center py-8 text-fg-muted text-sm">同業他社を調べています…</div>
      )}

      {!loading && all.length === 0 && (
        <div className="text-center py-6 text-fg-muted text-sm">
          自動取得に失敗しました。手動で追加してください。
        </div>
      )}

      {all.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {all.map((b, i) => (
            <CompetitorBrandCard key={b.name + i} brand={b} accentColor={accentColor}
              onRemove={b.isUserAdded ? () => handleRemoveUser(b.name) : undefined} />
          ))}
        </div>
      )}

      {list?.disclaimer && (
        <p className="cp-tiny mt-1" style={{ opacity: 0.7 }}>※ {list.disclaimer}</p>
      )}

      {!showAddForm ? (
        <button onClick={() => setShowAddForm(true)}
          className="cp-btn cp-btn-ghost cp-btn-sm w-full mt-1">
          + 自分が知ってる同業を追加
        </button>
      ) : (
        <div className="cp-stack-sm p-2 rounded-lg" style={{ background: 'var(--surface-3)' }}>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="会社名 / サービス名"
            className="px-3 py-2 rounded text-sm"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: '16px' }} />
          <input value={newUrl} onChange={e => setNewUrl(e.target.value)}
            placeholder="HP の URL (https://〜)"
            className="px-3 py-2 rounded text-sm"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: '16px' }} />
          <input value={newNote} onChange={e => setNewNote(e.target.value)}
            placeholder="一言メモ (任意、50字まで)"
            className="px-3 py-2 rounded text-sm"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: '16px' }} />
          <div className="cp-row justify-between gap-2">
            <button onClick={() => setShowAddForm(false)} className="cp-btn cp-btn-ghost cp-btn-sm">キャンセル</button>
            <button onClick={handleAddUser} className="cp-btn cp-btn-sm"
              style={{ background: accentColor, color: '#0a0a0f', borderColor: 'transparent' }}>
              追加
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 業界推定の確認カード
function AssistIndustryStep({
  inference, loading, error, accentColor,
  onConfirm, onChange, onRetry,
}: {
  inference: IndustryInference | null;
  loading: boolean;
  error: string | null;
  accentColor: string;
  onConfirm: () => void;
  onChange: (id: string) => void;
  onRetry: () => void;
}) {
  const industries = useMemo(() => getAllIndustries(), []);

  if (loading) {
    return (
      <div className="text-center py-12">
        <motion.div className="text-5xl mb-3"
          animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>🔍</motion.div>
        <p className="text-fg font-medium">あなたの業種を推定中…</p>
        <p className="cp-meta mt-1">ナレッジや事業内容から AI が判断しています</p>
      </div>
    );
  }

  if (error || !inference) {
    return (
      <div className="cp-card-section text-center py-8 cp-stack-sm">
        <p className="text-3xl">😅</p>
        <p className="text-fg">業種の自動推定ができませんでした</p>
        <p className="cp-tiny">{error || '情報が不足しています'}</p>
        <button onClick={onRetry} className="cp-btn cp-btn-sm"
          style={{ background: accentColor, color: '#0a0a0f', borderColor: 'transparent' }}>
          もう一度試す
        </button>
      </div>
    );
  }

  const confColor = inference.confidence === 'high' ? '#4ade80'
    : inference.confidence === 'medium' ? '#facc15' : '#f87171';
  const confLabel = inference.confidence === 'high' ? '確信あり'
    : inference.confidence === 'medium' ? 'たぶん' : '自信なし';

  return (
    <div className="cp-stack">
      <motion.div className="p-5 rounded-2xl"
        style={{ background: `linear-gradient(135deg, ${accentColor}18, var(--surface-3))`, border: `1px solid ${accentColor}40` }}
        initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <p className="cp-tiny mb-1">あなたの業種はこれですか？</p>
        <p className="text-2xl font-bold text-fg mb-1">
          {getIndustryInfo(inference.industryId)?.emoji || '🏢'} {inference.label}
        </p>
        <div className="cp-row gap-2 flex-wrap mt-2">
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: confColor + '20', color: confColor, border: `1px solid ${confColor}60` }}>
            {confLabel}
          </span>
          {inference.rationale && (
            <p className="text-xs text-fg-muted flex-1 min-w-0 leading-snug">{inference.rationale}</p>
          )}
        </div>
      </motion.div>

      <div className="cp-card-section cp-stack-sm">
        <p className="cp-h3">この業種で進める / 変更する</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {industries.map(ind => {
            const selected = ind.id === inference.industryId;
            return (
              <button key={ind.id} onClick={() => onChange(ind.id)}
                className="p-2 rounded-lg text-left transition-all min-h-[64px]"
                style={selected
                  ? { background: accentColor + '20', border: `2px solid ${accentColor}`, color: 'var(--fg)' }
                  : { background: 'var(--surface-3)', border: '2px solid transparent', color: 'var(--fg-muted)' }}>
                <span className="text-xl block mb-0.5">{ind.emoji}</span>
                <span className="text-xs font-medium block leading-tight">{ind.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="cp-row justify-between gap-2">
        <button onClick={onRetry} className="cp-btn cp-btn-ghost cp-btn-sm">🔄 再推定</button>
        <button onClick={onConfirm} className="cp-btn cp-btn-sm"
          style={{ background: accentColor, color: '#0a0a0f', borderColor: 'transparent' }}>
          この業種で進める →
        </button>
      </div>
    </div>
  );
}

// Q&A ステップ (3-5 問)
function AssistQaStep({
  qa, onChange, onSubmit, onSkip, onBack, accentColor, hasKnowledgeHint,
}: {
  qa: QaAnswers;
  onChange: (patch: Partial<QaAnswers>) => void;
  onSubmit: () => void;
  onSkip: () => void;
  onBack: () => void;
  accentColor: string;
  hasKnowledgeHint: boolean;
}) {
  const fmt = (n?: number) => n === undefined ? '' : String(n);

  const setNum = (key: keyof QaAnswers, raw: string) => {
    if (raw.trim() === '') { onChange({ [key]: undefined } as Partial<QaAnswers>); return; }
    const cleaned = raw.replace(/[,，]/g, '');
    const n = Number(cleaned);
    if (Number.isFinite(n)) onChange({ [key]: n } as Partial<QaAnswers>);
  };

  return (
    <div className="cp-stack">
      <div className="cp-card-section">
        <p className="cp-h3">かんたんな質問だけ答えてください</p>
        <p className="cp-tiny">わからない項目は空欄のままでも進められます。{hasKnowledgeHint && 'ナレッジから取れる値はあとで優先的に使います。'}</p>
      </div>

      {/* Q1 */}
      <div className="cp-card-section cp-stack-sm">
        <p className="text-sm text-fg">先月、月の売上はだいたいいくらでしたか？</p>
        <p className="cp-tiny">ざっくりでOK。「だいたい100万」みたいな感覚で。</p>
        <div className="flex items-center gap-2">
          <input type="text" inputMode="numeric"
            value={fmt(qa.monthlyRevenue)} onChange={e => setNum('monthlyRevenue', e.target.value)}
            placeholder="例: 1000000"
            className="flex-1 px-3 py-2 rounded-lg font-mono"
            style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: '16px' }} />
          <span className="text-fg-muted text-sm flex-shrink-0">円</span>
        </div>
      </div>

      {/* Q2 */}
      <div className="cp-card-section cp-stack-sm">
        <p className="text-sm text-fg">家賃や人件費など、毎月かかる固定費は？</p>
        <p className="cp-tiny">給料・家賃・通信費など、売上に関わらずかかるもの合計</p>
        <div className="flex items-center gap-2">
          <input type="text" inputMode="numeric"
            value={fmt(qa.monthlyFixedCost)} onChange={e => setNum('monthlyFixedCost', e.target.value)}
            placeholder="例: 600000"
            className="flex-1 px-3 py-2 rounded-lg font-mono"
            style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: '16px' }} />
          <span className="text-fg-muted text-sm flex-shrink-0">円</span>
        </div>
      </div>

      {/* Q3 */}
      <div className="cp-card-section cp-stack-sm">
        <p className="text-sm text-fg">仕入れや原材料など、売上に連動する経費は？</p>
        <p className="cp-tiny">(サービス業で仕入れがほぼない場合は空欄で OK)</p>
        <div className="flex items-center gap-2">
          <input type="text" inputMode="numeric"
            value={fmt(qa.monthlyVariableCost)} onChange={e => setNum('monthlyVariableCost', e.target.value)}
            placeholder="例: 200000"
            className="flex-1 px-3 py-2 rounded-lg font-mono"
            style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: '16px' }} />
          <span className="text-fg-muted text-sm flex-shrink-0">円</span>
        </div>
      </div>

      {/* Q4 */}
      <div className="cp-card-section cp-stack-sm">
        <p className="text-sm text-fg">月のお客さんは何人くらい？</p>
        <p className="cp-tiny">わからなければ空欄で</p>
        <div className="flex items-center gap-2">
          <input type="text" inputMode="numeric"
            value={fmt(qa.monthlyCustomers)} onChange={e => setNum('monthlyCustomers', e.target.value)}
            placeholder="例: 50"
            className="flex-1 px-3 py-2 rounded-lg font-mono"
            style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: '16px' }} />
          <span className="text-fg-muted text-sm flex-shrink-0">人</span>
        </div>
      </div>

      {/* Q5 */}
      <div className="cp-card-section cp-stack-sm">
        <p className="text-sm text-fg">同業と比べて、価格は？</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            { v: 'low' as const,  label: '安め', sub: '同業より低価格' },
            { v: 'mid' as const,  label: '普通', sub: '同業並み' },
            { v: 'high' as const, label: '高め', sub: '同業より高価格' },
          ]).map(o => {
            const selected = qa.priceRange === o.v;
            return (
              <button key={o.v} onClick={() => onChange({ priceRange: selected ? undefined : o.v })}
                className="p-2 rounded-lg transition-all"
                style={selected
                  ? { background: accentColor + '20', border: `2px solid ${accentColor}`, color: 'var(--fg)' }
                  : { background: 'var(--surface-3)', border: '2px solid transparent', color: 'var(--fg-muted)' }}>
                <p className="text-sm font-medium">{o.label}</p>
                <p className="text-[10px]">{o.sub}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="cp-row justify-between gap-2 flex-wrap">
        <button onClick={onBack} className="cp-btn cp-btn-ghost cp-btn-sm">← 業界変更</button>
        <div className="flex gap-2">
          <button onClick={onSkip} className="cp-btn cp-btn-ghost cp-btn-sm">スキップ</button>
          <button onClick={onSubmit} className="cp-btn cp-btn-sm"
            style={{ background: accentColor, color: '#0a0a0f', borderColor: 'transparent' }}>
            この回答で分析する →
          </button>
        </div>
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
      <div className="cp-card-section">
        <EmptyState
          iconKey="benchmark"
          title="まだ業界ベンチマーク履歴はありません"
          description={'分析タブで自分の数字を 1 回入れると、業界平均との比較が時系列で残ります。\n月ごとの伸びと弱点が一目で分かるようになります。'}
          showSample={false}
          accent="#c9a96e"
          preview="2026-05　売上前年比 +18%　業界平均 +6%　強み: リピート率"
        />
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
  const [tab, setTab] = useState<ViewTab>('assist');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [industry, setIndustry] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<UserMetrics>({});
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [industryRefresh, setIndustryRefresh] = useState(0);
  const [proposeBusy, setProposeBusy] = useState(false);

  // ── AI 補助モード state ──
  const [assistStage, setAssistStage] = useState<AssistStage>('industry');
  const [inferring, setInferring] = useState(false);
  const [inferError, setInferError] = useState<string | null>(null);
  const [inference, setInference] = useState<IndustryInference | null>(null);
  const [qa, setQa] = useState<QaAnswers>({});
  const [qaNotes, setQaNotes] = useState<string[]>([]);

  const inv = useInvoices();
  const ledger = useSalesLedger(inv.invoices);
  const exp = useExpenses();
  const knowledge = useKnowledge();
  const stripeRev = useStripeRevenue();
  const queue = useAgentTaskQueue();

  const knowledgeForPersona = useMemo(
    () => knowledge.items.filter(i => i.personaId === persona.id),
    [knowledge.items, persona.id],
  );
  const knowledgeTitles = useMemo(
    () => knowledgeForPersona.map(i => i.title),
    [knowledgeForPersona],
  );
  const knowledgeSummary = useMemo(
    () => knowledgeForPersona.map(i => i.analysis?.summary || '').filter(Boolean).join(' ').slice(0, 1200),
    [knowledgeForPersona],
  );
  const knowledgeFinancialHint = useMemo(() => {
    const fin = knowledgeForPersona
      .filter(i => i.tags?.includes('財務') && i.content)
      .map(i => i.content)
      .join('\n')
      .slice(0, 600);
    return fin;
  }, [knowledgeForPersona]);

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

  // ── AI 補助モード ハンドラ ──
  const runInferIndustry = useCallback(async () => {
    setInferring(true);
    setInferError(null);
    try {
      const inf = await inferIndustry({
        personaName: persona.name,
        personaDescription: persona.description,
        knowledgeTitles,
        knowledgeSummary,
        stripeCurrencies: stripeRev.currencies,
        cashflowLabel: persona.cashflow?.label,
      }, settings);
      setInference(inf);
    } catch (e) {
      setInferError(e instanceof Error ? e.message : '推定に失敗しました');
    } finally {
      setInferring(false);
    }
  }, [persona, knowledgeTitles, knowledgeSummary, stripeRev.currencies, settings]);

  // AI 補助タブを開いた / 業界推定がまだ未実行ならまず推定
  useEffect(() => {
    if (tab === 'assist' && assistStage === 'industry' && !inference && !inferring && !inferError) {
      runInferIndustry();
    }
  }, [tab, assistStage, inference, inferring, inferError, runInferIndustry]);

  const confirmIndustry = (id: string) => {
    setIndustry(id);
    setAssistStage('qa');
  };

  const updateQa = (patch: Partial<QaAnswers>) => setQa(prev => ({ ...prev, ...patch }));

  const runEstimateAndAnalyze = async (skipQa: boolean) => {
    if (!industry) return;
    setIsAnalyzing(true);
    setError(null);
    setAssistStage('result');
    try {
      // metrics 推定 (skipQa の場合は空 qa)
      const est = await estimateMetricsFromQA(
        industry,
        skipQa ? {} : qa,
        settings,
        knowledgeFinancialHint ? { knowledgeFinancialHint } : undefined,
      );
      const mergedMetrics = { ...est.metrics, ...autoValues }; // 実値があれば優先
      setMetrics(mergedMetrics);
      setQaNotes(est.notes);
      if (Object.keys(mergedMetrics).length === 0) {
        setError('数値を推定できませんでした。質問にもう少し答えてみてください。');
        setAssistStage('qa');
        return;
      }
      const res = await analyzeAgainstIndustry(industry, mergedMetrics, settings);
      setResult(res);
      saveBenchmarkResult(persona.id, res);
    } catch (e) {
      setError(e instanceof Error ? e.message : '分析中にエラーが発生しました');
      setAssistStage('qa');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetAssist = () => {
    setAssistStage('industry');
    setInference(null);
    setInferError(null);
    setQa({});
    setQaNotes([]);
    setResult(null);
  };

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

        <div className="px-4 pt-3">
          <StudioIntro
            id="benchmark"
            accent={persona.accentColor}
            iconKey="benchmark"
            what="あなたの数字を「同じ業界の会社たち」と比べて、強い所と弱い所を 1 画面で見せます。"
            tryThis="まず「AI 補助」タブで AI に業界を当ててもらう。質問に 2-3 個答えるだけで結果が出ます。"
            example="粗利率 38% → 業界の真ん中より上、上位 30% です。客単価は逆に下位 25%。"
            sampleLabel="こんな結果が出ます"
            samplePreview={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10.5, lineHeight: 1.3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--fg-muted)' }}>粗利率</span>
                  <span style={{ color: '#4ade80', fontWeight: 700 }}>上位 30%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--fg-muted)' }}>客単価</span>
                  <span style={{ color: '#facc15', fontWeight: 700 }}>中位</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--fg-muted)' }}>継続率</span>
                  <span style={{ color: '#f87171', fontWeight: 700 }}>要改善</span>
                </div>
              </div>
            }
          />
        </div>

        <DelegateToAgentTeamBanner
          taskTitle="結果を CDS + CSO + CMO が分析して提案"
          suggestedCxos={['CDS', 'CSO', 'CMO']}
          why="競合との差を放置せず、AI 会社がデータ分析と打ち手まで一気に出します"
          expected="ベンチマーク差異 + 改善打ち手 3 つ"
        />

        {/* タブ */}
        <div className="cp-row px-4 pt-3 gap-1 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)' }}>
          {([
            { v: 'assist' as const, label: 'AI 補助' },
            { v: 'analyze' as const, label: '手入力' },
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
            {tab === 'assist' && (
              <motion.div key={'assist-' + assistStage}
                initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }}>

                {/* AI 補助モード説明 */}
                <div className="cp-card-section mb-3" style={{ background: persona.accentColor + '10', border: `1px solid ${persona.accentColor}30` }}>
                  <p className="text-sm text-fg">
                    <strong>数字がわからなくても大丈夫。</strong>
                  </p>
                  <p className="cp-tiny mt-1">
                    あなたの業種を AI が推定し、3〜5 個のかんたんな質問だけで業界比較ができます。
                  </p>
                </div>

                {assistStage === 'industry' && (
                  <AssistIndustryStep
                    inference={inference}
                    loading={inferring}
                    error={inferError}
                    accentColor={persona.accentColor}
                    onConfirm={() => inference && confirmIndustry(inference.industryId)}
                    onChange={id => setInference(prev => prev ? { ...prev, industryId: id, label: getIndustryInfo(id)?.label || id } : null)}
                    onRetry={() => { setInference(null); setInferError(null); runInferIndustry(); }}
                  />
                )}

                {assistStage === 'qa' && industry && (
                  <>
                    <AssistQaStep
                      qa={qa}
                      onChange={updateQa}
                      onSubmit={() => runEstimateAndAnalyze(false)}
                      onSkip={() => runEstimateAndAnalyze(true)}
                      onBack={() => setAssistStage('industry')}
                      accentColor={persona.accentColor}
                      hasKnowledgeHint={!!knowledgeFinancialHint}
                    />
                    {error && (
                      <div className="mt-3"><ApiErrorCard error={error} onRetry={() => runEstimateAndAnalyze(false)} variant="auto" /></div>
                    )}
                  </>
                )}

                {assistStage === 'result' && industry && (
                  <>
                    {isAnalyzing ? (
                      <div className="text-center py-16">
                        <motion.div className="text-5xl mb-4"
                          animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>📊</motion.div>
                        <p className="text-fg text-base font-medium">あなたの数字を AI が推定中…</p>
                        <p className="cp-meta mt-1">回答とナレッジから KPI を逆算しています</p>
                      </div>
                    ) : result ? (
                      <>
                        {qaNotes.length > 0 && (
                          <div className="cp-card-section mb-3" style={{ background: persona.accentColor + '10' }}>
                            <p className="cp-tiny" style={{ color: persona.accentColor }}>
                              ⚠️ これは AI 推定値です。{qaNotes.join(' / ')}
                            </p>
                          </div>
                        )}

                        <StepResult
                          result={result}
                          personaName={persona.name}
                          accentColor={persona.accentColor}
                          competitors={competitors}
                          onProposeAgents={handleProposeAgents}
                          proposeBusy={proposeBusy}
                        />

                        {/* 同業他社カード */}
                        <CompetitorBrandsSection
                          industryId={industry}
                          personaName={persona.name}
                          settings={settings}
                          accentColor={persona.accentColor}
                          knowledgeTitles={knowledgeTitles}
                          knowledgeSummary={knowledgeSummary}
                        />

                        <div className="cp-row justify-between mt-2 gap-2 flex-wrap">
                          <button onClick={resetAssist} className="cp-btn cp-btn-ghost cp-btn-sm">← やり直す</button>
                          <button onClick={() => setAssistStage('qa')} className="cp-btn cp-btn-ghost cp-btn-sm">回答を修正 →</button>
                        </div>
                      </>
                    ) : (
                      <div className="cp-card-section text-center py-8">
                        <p className="text-fg-muted text-sm">{error || '分析を開始してください'}</p>
                        <button onClick={() => setAssistStage('qa')} className="cp-btn cp-btn-sm mt-3"
                          style={{ background: persona.accentColor, color: '#0a0a0f', borderColor: 'transparent' }}>
                          質問に戻る
                        </button>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

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
