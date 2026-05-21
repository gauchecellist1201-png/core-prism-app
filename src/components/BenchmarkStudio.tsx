// ============================================================
// BenchmarkStudio — 業界ベンチマーク比較 (3ステップ)
// ============================================================
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import type { Persona, AppSettings } from '../types/identity';
import {
  INDUSTRIES, INDUSTRY_BENCHMARKS,
  type IndustryId,
} from '../lib/benchmarkData';
import {
  analyzeAgainstIndustry, saveBenchmarkResult,
  type BenchmarkResult, type KpiRanking, type UserMetrics,
} from '../lib/benchmarkAnalyst';
import { useInvoices } from '../hooks/useInvoices';
import { useSalesLedger } from '../hooks/useSalesLedger';
import { useExpenses } from '../hooks/useExpenses';
import ApiErrorCard from './ApiErrorCard';

interface Props {
  persona: Persona;
  settings: AppSettings;
  onClose: () => void;
}

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
function BulletBar({ r }: { r: KpiRanking }) {
  const range = r.p75 - r.p25 || 1;
  const toPos = (v: number) => {
    const clamped = Math.max(r.p25 - range * 0.3, Math.min(r.p75 + range * 0.3, v));
    const minV = r.p25 - range * 0.3;
    const maxV = r.p75 + range * 0.3;
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
      <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-lg z-10"
        style={{ left: `${userPos}%`, transform: 'translate(-50%, -50%)', background: markerColor, border: '2px solid #0a0a0f' }}
        title={`自社: ${r.userValue}${r.unit}`}
      />
    </div>
  );
}

// ── レポートHTML生成 (印刺→PDF) ────────────────────────
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
<h1>📊 業界ベンチマーク分析レポート</h1>
<p class="meta">事業者: <strong>${personaName}</strong> &nbsp;|&nbsp; 業界: <strong>${result.industryLabel}</strong> &nbsp;|&nbsp; 生成日: ${date}</p>
<p class="badge">総合評価: 上位 ${topPct}% (${result.overallPercentile}パーセンタイル)</p>
<h2>総合評価</h2>
<p>${result.summary}</p>
<h2>KPI 詳細比較</h2>
<table><thead><tr><th>KPI</th><th>自社</th><th>業界中央値</th><th>評価</th><th>推定パーセンタイル</th></tr></thead>
<tbody>${rankRows}</tbody></table>
<h2>✅ 強み (上位KPI)</h2>
<ul>${result.strengths.map(s => `<li class="strength">${s}</li>`).join('')}</ul>
<h2>⚠️ 改善ポイント</h2>
<ul>${result.weaknesses.map(w => `<li class="weakness">${w}</li>`).join('')}</ul>
<h2>💡 推奨アクション</h2>
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

// ── ステップ1: 業界選択 ─────────────────────────────────────
function StepIndustry({
  selected, onSelect, accentColor,
}: {
  selected: IndustryId | null;
  onSelect: (id: IndustryId) => void;
  accentColor: string;
}) {
  return (
    <div className="cp-stack">
      <p className="cp-h3">業界を選択</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {INDUSTRIES.map(ind => {
          const isSelected = selected === ind.id;
          return (
            <button key={ind.id}
              onClick={() => onSelect(ind.id as IndustryId)}
              className="p-3 rounded-xl text-left transition-all"
              style={isSelected
                ? { background: accentColor + '20', border: `2px solid ${accentColor}`, color: 'var(--fg)' }
                : { background: 'var(--surface-3)', border: '2px solid transparent', color: 'var(--fg-muted)' }}
            >
              <span className="text-2xl block mb-1">{ind.emoji}</span>
              <span className="text-sm font-medium">{ind.label}</span>
            </button>
          );
        })}
      </div>
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
  industryId: IndustryId;
  metrics: UserMetrics;
  onChange: (key: string, val: string) => void;
  autoValues: UserMetrics;
  accentColor: string;
}) {
  const entries = INDUSTRY_BENCHMARKS.filter(b => b.industry === industryId);

  return (
    <div className="cp-stack">
      <div className="cp-row-between">
        <p className="cp-h3">自社数値を入力</p>
        {Object.keys(autoValues).length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: accentColor + '18', color: accentColor, border: `1px solid ${accentColor}40` }}>
            ✨ P&L から{Object.keys(autoValues).length}項目を自動入力
          </span>
        )}
      </div>
      <p className="cp-meta">空欄のKPIは分析から除外されます</p>
      <div className="space-y-3">
        {entries.map(entry => {
          const rawVal = metrics[entry.key];
          const val = rawVal !== undefined ? String(rawVal) : '';
          const isAuto = autoValues[entry.key] !== undefined;
          return (
            <div key={entry.key} className="cp-card-section">
              <div className="cp-row-between mb-1">
                <div>
                  <span className="text-fg text-sm font-medium">{entry.label}</span>
                  {entry.lowerIsBetter && <span className="text-xs ml-2 text-fg-muted">(低い方が良)</span>}
                  {isAuto && (
                    <span className="text-xs ml-2 px-1.5 py-0.5 rounded"
                      style={{ background: accentColor + '18', color: accentColor }}>自動</span>
                  )}
                </div>
                <span className="cp-meta">{entry.unit}</span>
              </div>
              <p className="cp-tiny mb-1.5">{entry.description}</p>
              <div className="cp-row gap-2">
                <input
                  type="number"
                  value={val}
                  onChange={e => onChange(entry.key, e.target.value)}
                  placeholder={`例: ${entry.p50}`}
                  className="flex-1 px-3 py-1.5 rounded-lg text-sm"
                  style={{
                    background: 'var(--surface-3)',
                    border: `1px solid ${val !== '' ? accentColor + '60' : 'var(--border)'}`,
                    color: 'var(--fg)',
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
}: {
  result: BenchmarkResult;
  personaName: string;
  accentColor: string;
}) {
  const radarData = result.rankings.slice(0, 6).map(r => ({
    subject: r.label.length > 8 ? r.label.slice(0, 7) + '…' : r.label,
    value: normalizeForRadar(r),
    fullMark: 100,
  }));

  const handleDownload = () => {
    const html = generateReportHtml(result, personaName);
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 600);
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
          <p className="cp-h3 mb-3">📡 KPI レーダー</p>
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
        <p className="cp-h3">📊 KPI 詳細</p>
        {result.rankings.map(r => (
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
            <BulletBar r={r} />
            <div className="flex justify-between mt-0.5">
              <span className="cp-tiny">{r.p25}{r.unit}</span>
              <span className="cp-tiny">中央値 {r.p50}{r.unit}</span>
              <span className="cp-tiny">{r.p75}{r.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {(result.strengths.length > 0 || result.weaknesses.length > 0) && (
        <div className="cp-grid-2">
          {result.strengths.length > 0 && (
            <div className="cp-card-section cp-stack-sm">
              <p className="cp-h3">✅ 強み</p>
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
              <p className="cp-h3">⚠️ 改善ポイント</p>
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
          <p className="cp-h3">💡 推奨アクション</p>
          {result.recommendedActions.map((a, i) => (
            <div key={i} className="cp-row gap-3">
              <span className="text-xs w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 font-bold"
                style={{ background: accentColor + '20', color: accentColor }}>
                {i + 1}
              </span>
              <p className="text-fg text-sm leading-snug">{a}</p>
            </div>
          ))}
        </div>
      )}

      <p className="cp-tiny">
        データ出典: {[...new Set(result.rankings.map(r => r.source))].join(' / ')} ·
        分析日: {new Date(result.generatedAt).toLocaleDateString('ja-JP')}
      </p>

      <button
        onClick={handleDownload}
        className="cp-btn w-full"
        style={{ background: accentColor, color: '#0a0a0f', borderColor: 'transparent' }}>
        📄 レポートを PDF ダウンロード (印刺ダイアログ)
      </button>
    </div>
  );
}

// ── メインコンポーネント ────────────────────────────────────
export default function BenchmarkStudio({ persona, settings, onClose }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [industry, setIndustry] = useState<IndustryId | null>(null);
  const [metrics, setMetrics] = useState<UserMetrics>({});
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inv = useInvoices();
  const ledger = useSalesLedger(inv.invoices);
  const exp = useExpenses();

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

  const handleSelectIndustry = (id: IndustryId) => {
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

  const canAnalyze = industry !== null && Object.keys(metrics).length > 0;

  return (
    <motion.div className="cp-modal-bg"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}>
      <motion.div className="cp-modal" style={{ maxWidth: '780px' }}
        initial={{ scale: 0.97, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 12 }}
        onClick={e => e.stopPropagation()}>

        <div className="cp-modal-header">
          <div className="cp-row min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: persona.accentColorLight, color: persona.accentColor }}>📊</div>
            <div className="min-w-0">
              <p className="cp-h2 truncate">業界ベンチマーク</p>
              <p className="cp-meta truncate">{persona.name} · 自社 KPI を同業他社と比較</p>
            </div>
          </div>
          <button onClick={onClose} className="cp-btn cp-btn-ghost cp-btn-sm flex-shrink-0">✕</button>
        </div>

        <div className="cp-row px-4 pt-3 gap-2">
          {([
            { n: 1 as const, label: '業界選択' },
            { n: 2 as const, label: '数値入力' },
            { n: 3 as const, label: '分析結果' },
          ]).map(s => (
            <div key={s.n} className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0"
                style={step >= s.n
                  ? { background: persona.accentColor, color: '#0a0a0f' }
                  : { background: 'var(--surface-3)', color: 'var(--fg-muted)' }}>
                {step > s.n ? '✓' : s.n}
              </div>
              <span className={`text-xs hidden sm:block ${step >= s.n ? 'text-fg' : 'text-fg-muted'}`}>{s.label}</span>
              {s.n < 3 && <span className="text-fg-muted text-xs">→</span>}
            </div>
          ))}
        </div>

        <div className="cp-modal-body cp-stack">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1"
                initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }}>
                <StepIndustry selected={industry} onSelect={handleSelectIndustry} accentColor={persona.accentColor} />
              </motion.div>
            )}

            {step === 2 && industry && (
              <motion.div key="step2"
                initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }}>
                <StepMetrics
                  industryId={industry}
                  metrics={metrics}
                  onChange={handleMetricChange}
                  autoValues={autoValues}
                  accentColor={persona.accentColor}
                />
                <ApiErrorCard error={error} onRetry={handleAnalyze} variant="auto" />

                <div className="cp-row justify-between mt-4">
                  <button onClick={() => setStep(1)} className="cp-btn cp-btn-ghost cp-btn-sm">← 業界変更</button>
                  <button
                    onClick={handleAnalyze}
                    disabled={!canAnalyze}
                    className="cp-btn cp-btn-sm"
                    style={canAnalyze
                      ? { background: persona.accentColor, color: '#0a0a0f', borderColor: 'transparent' }
                      : {}}>
                    🔍 AI 分析を実行 →
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3"
                initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }}>
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
                    <StepResult result={result} personaName={persona.name} accentColor={persona.accentColor} />
                    <div className="cp-row justify-between mt-2">
                      <button onClick={() => { setStep(2); setResult(null); }} className="cp-btn cp-btn-ghost cp-btn-sm">← 再入力</button>
                    </div>
                  </>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
