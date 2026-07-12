// ============================================================
// FinancialConsultant — 財務コンサルタント (7 柱「財務」の入口)
//
// オーナー指示 (2026-05-18):
//   ユーザーの月次売上を読み込んで、どの月が強い / 弱いを分析。
//   AI (Haiku) がやさしい日本語で繁忙期・閑散期・危険な兆候・
//   来月の見込み・打つべき一手を助言する。
//
// データ源 (上から優先):
//   1. Stripe 連携 … /api/revenue/snapshot の monthly[] (直近12ヶ月)
//   2. アプリに記録した売上 … 売上台帳 + 経費 (人格ごと, 直近24ヶ月)
//   3. 手入力した収支 … persona.cashflow (1点のみ。月別分析は不可)
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Persona, AppSettings } from '../types/identity';
import { useInvoices } from '../hooks/useInvoices';
import { useSalesLedger } from '../hooks/useSalesLedger';
import { useExpenses } from '../hooks/useExpenses';
import { useStripeRevenue } from '../hooks/useStripeRevenue';
import { fmtJpy } from '../lib/invoiceCalc';
import ApiErrorCard from './ApiErrorCard';
import { StudioIntro } from './StudioIntro';
import ThinkingIndicator from './ThinkingIndicator';
import { aiFetch } from '../lib/aiFetch';

interface Props {
  persona: Persona;
  settings: AppSettings;
  onClose: () => void;
}

interface MPoint {
  month: string;   // 'YYYY-MM'
  revenue: number;
  expense: number;
  profit: number;
  txnCount: number;
}

interface Consult {
  summary: string;
  seasonInsight: string;
  marginTrend: string;
  warnings: string[];
  nextMonthForecast: string;
  actions: string[];
}

const pad = (n: number) => String(n).padStart(2, '0');
const monthLabel = (ym: string) => `${Number(ym.slice(5, 7))}月`;
const yearOf = (ym: string) => ym.slice(0, 4);

const SYS = `あなたは中小企業の社長によりそう、やさしい財務コンサルタントです。
むずかしい専門用語は使わず、横文字には必ず日本語の言いかえを ( ) で添えます。
（例: キャッシュフロー→お金の流れ、マージン→利益のうわまえ）
社長を不安にさせず、でも危ない数字はきちんと指摘し、明日からできる一手を出します。

返答は **JSON のみ**。前後に文章をつけないこと:
{
  "summary": "全体をひとことで (1〜2文)",
  "seasonInsight": "強い月・弱い月・繁忙期・閑散期の説明と、閑散期をどう底上げするか (2〜3文)",
  "marginTrend": "利益のうわまえ (利益率) がどう動いているかの説明 (1〜2文)",
  "warnings": ["危ない兆候があれば短く。なければ空配列"],
  "nextMonthForecast": "来月の売上の見こみを、根拠とともに (1〜2文)",
  "actions": ["来月のために今すぐ打つ一手を3つ。具体的に短く"]
}`;

export default function FinancialConsultant({ persona, onClose }: Props) {
  const inv = useInvoices();
  const ledger = useSalesLedger(inv.invoices);
  const exp = useExpenses();

  // ─── Stripe 連携データ (useStripeRevenue 経由で右パネルと完全一致させる) ───
  // オーナー指示 2026-05-27: 「右の Stripe 連携中 ¥255,000 と数字が一致しない」修正
  const stripe = useStripeRevenue();
  const stripeMonthly: MPoint[] | null = useMemo(() => {
    if (!stripe.connected || !stripe.monthly || stripe.monthly.length === 0) return null;
    return stripe.monthly.map(m => ({
      month: m.month,
      revenue: Math.round(m.revenueJpy || 0),
      expense: Math.round(m.expenseJpy || 0),
      profit: Math.round(m.profitJpy || 0),
      txnCount: m.txnCount || 0,
    }));
  }, [stripe.connected, stripe.monthly]);
  const stripeLoading = stripe.loading;

  // ─── アプリ記録データ (直近24ヶ月) ───
  const localTrend = useMemo<MPoint[]>(() => {
    const now = new Date();
    const out: MPoint[] = [];
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      const revenue = ledger.entries
        .filter(e => e.personaId === persona.id && e.date.startsWith(ym))
        .reduce((s, e) => s + e.totalExcl, 0);
      const expense = exp.entries
        .filter(e => e.personaId === persona.id && e.date.startsWith(ym))
        .reduce((s, e) => s + e.amountExcl, 0);
      out.push({ month: ym, revenue, expense, profit: revenue - expense, txnCount: 0 });
    }
    return out;
  }, [ledger.entries, exp.entries, persona.id]);

  const stripeHasData = !!stripeMonthly && stripeMonthly.some(m => m.revenue !== 0 || m.expense !== 0);
  const localHasData = localTrend.some(m => m.revenue > 0 || m.expense > 0);

  const source: 'stripe' | 'local' | 'cashflow' =
    stripeHasData ? 'stripe' : localHasData ? 'local' : 'cashflow';

  // チャート用 (直近12ヶ月) と YoY 用 (フル)
  const fullTrend = source === 'stripe' ? stripeMonthly! : localTrend;
  const series = source === 'cashflow' ? [] : fullTrend.slice(-12);

  const sourceLabel = source === 'stripe'
    ? 'Stripe の入金データ'
    : source === 'local'
      ? 'アプリに記録した売上・経費'
      : '手入力した収支';

  // ─── 分析 (AI を使わない確定計算) ───
  const analysis = useMemo(() => {
    const withData = series.filter(m => m.revenue > 0 || m.expense > 0);
    if (withData.length === 0) return null;

    const avgRevenue = withData.reduce((s, m) => s + m.revenue, 0) / withData.length;
    const avgProfit = withData.reduce((s, m) => s + m.profit, 0) / withData.length;

    const strongest = withData.reduce((a, b) => (b.profit > a.profit ? b : a));
    const weakest = withData.reduce((a, b) => (b.profit < a.profit ? b : a));

    const latest = series[series.length - 1];
    const prev = series.length >= 2 ? series[series.length - 2] : null;
    const momPct = prev && prev.profit !== 0
      ? ((latest.profit - prev.profit) / Math.abs(prev.profit)) * 100
      : null;

    // 前年同月比 (フルデータに同じ月が1年前にあれば)
    const profitByMonth = new Map(fullTrend.map(m => [m.month, m.profit]));
    const lyKey = `${Number(yearOf(latest.month)) - 1}-${latest.month.slice(5, 7)}`;
    const lyProfit = profitByMonth.has(lyKey) ? profitByMonth.get(lyKey)! : null;
    const yoyPct = lyProfit !== null && lyProfit !== 0
      ? ((latest.profit - lyProfit) / Math.abs(lyProfit)) * 100
      : null;

    // 季節性: 売上が平均の1.15倍超=繁忙, 0.85倍未満=閑散
    const season = (m: MPoint): 'busy' | 'slow' | 'normal' => {
      if (m.revenue === 0) return 'normal';
      if (m.revenue > avgRevenue * 1.15) return 'busy';
      if (m.revenue < avgRevenue * 0.85) return 'slow';
      return 'normal';
    };
    const busyMonths = withData.filter(m => season(m) === 'busy').map(m => m.month);
    const slowMonths = withData.filter(m => season(m) === 'slow').map(m => m.month);

    // 危険: 経費が売上を上回った月
    const lossMonths = withData.filter(m => m.expense > m.revenue && m.revenue > 0);

    const latestMargin = latest.revenue > 0 ? (latest.profit / latest.revenue) * 100 : null;

    return {
      avgRevenue, avgProfit, strongest, weakest, latest, prev,
      momPct, yoyPct, lyKey, season, busyMonths, slowMonths, lossMonths, latestMargin,
    };
  }, [series, fullTrend]);

  // ─── キャッシュ予測 (3ヶ月先まで) — 嘘禁止: 直近の実トレンドから線形予測 ───
  // オーナー指示 2026-05-28: 財務エージェントにキャッシュ予測を
  const forecast = useMemo(() => {
    const withData = series.filter(m => m.revenue > 0 || m.expense > 0);
    if (withData.length < 2) return null;
    const recent = withData.slice(-3); // 直近 3 ヶ月
    const avgRev = recent.reduce((s, m) => s + m.revenue, 0) / recent.length;
    const avgExp = recent.reduce((s, m) => s + m.expense, 0) / recent.length;
    const avgProfit = avgRev - avgExp;
    // 線形トレンド (直近 3 ヶ月の利益の傾き)
    const slope = recent.length >= 2
      ? (recent[recent.length - 1].profit - recent[0].profit) / (recent.length - 1)
      : 0;
    const now = new Date();
    const points: Array<{ month: string; revenue: number; expense: number; profit: number; cumulative: number }> = [];
    let cumulative = 0;
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      // 利益 = 平均 + トレンド (極端化しないよう slope は控えめに 0.5 倍)
      const projProfit = Math.round(avgProfit + slope * 0.5 * i);
      const projRev = Math.round(avgRev + slope * 0.5 * i);
      const projExp = Math.max(0, projRev - projProfit);
      cumulative += projProfit;
      points.push({ month, revenue: projRev, expense: projExp, profit: projProfit, cumulative });
    }
    // ランウェイ判定: 平均利益がマイナスなら警告
    const monthlyBurn = avgProfit < 0 ? Math.abs(avgProfit) : 0;
    return { points, avgProfit, avgRev, avgExp, slope, monthlyBurn };
  }, [series]);

  // ─── AI コンサル ───
  const [consult, setConsult] = useState<Consult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  // モーダル開いて Stripe 実データが入った瞬間に AI 助言を自動発火 (1 回だけ)
  // オーナー指示 2026-05-27: 「数字を反映するだけじゃなくて、傾向やパターンを掴んでほしい」
  const autoConsultedRef = useRef(false);

  // 経費をカテゴリ別に集計 (直近 6 ヶ月の合計) — AIが「広告費が高い」のような具体的な助言を出せるよう内訳を渡す
  const expenseBreakdown = useMemo(() => {
    if (source === 'cashflow') return null;
    // series の対象月のうち、ローカル経費データがあるもの
    const targetMonths = new Set(series.slice(-6).map(m => m.month));
    const myEntries = exp.entries.filter(e =>
      e.personaId === persona.id && targetMonths.has(e.date.slice(0, 7))
    );
    if (myEntries.length === 0) return null;
    const byCat = new Map<string, number>();
    for (const e of myEntries) {
      byCat.set(e.category, (byCat.get(e.category) || 0) + e.amountExcl);
    }
    const total = Array.from(byCat.values()).reduce((s, v) => s + v, 0);
    if (total === 0) return null;
    const rows = Array.from(byCat.entries())
      .map(([cat, amount]) => ({ cat, amount, pct: (amount / total) * 100 }))
      .sort((a, b) => b.amount - a.amount);
    return { rows, total, monthCount: targetMonths.size };
  }, [exp.entries, persona.id, series, source]);

  const runConsult = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      // API キーは main.tsx の interceptor が自動付与
      let dataBlock: string;
      if (source === 'cashflow') {
        const inc = persona.cashflow.income || 0;
        const ex = Math.abs(persona.cashflow.expense || 0);
        dataBlock = `月別データはまだありません。手入力された収支のみ:\n`
          + `売上 ${inc} 円 / 経費 ${ex} 円 / 利益 ${inc - ex} 円 (${persona.cashflow.label || '直近'})`;
      } else {
        dataBlock = series.map(m =>
          `${m.month}  売上${m.revenue}円  経費${m.expense}円  利益${m.profit}円`
        ).join('\n');
      }

      // 経費カテゴリ別の集計 (直近 6 ヶ月) を AI へ渡す
      let breakdownBlock = '';
      if (expenseBreakdown) {
        const { rows, total, monthCount } = expenseBreakdown;
        breakdownBlock = `\n## 直近 ${monthCount} ヶ月の経費カテゴリ別 (合計 ${total.toLocaleString('ja-JP')} 円)\n`
          + rows.map(r => `${r.cat}  ${Math.round(r.amount).toLocaleString('ja-JP')} 円  (${r.pct.toFixed(1)} %)`).join('\n')
          + `\n\n助言は上記の内訳に踏み込み、「どのカテゴリが売上比で重いか」「削るならどこか」「投資すべきカテゴリはどれか」を具体的に書いてください。\n`;
      }

      const res = await aiFetch({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 1600,
          system: SYS,
          messages: [{
            role: 'user',
            content: `事業: ${persona.name}\nデータ源: ${sourceLabel}\n\n## 月次の売上・経費・利益\n${dataBlock}\n${breakdownBlock}\n`
              + `この社長のために、強い月・弱い月・繁忙期・閑散期を読み解き、来月の見こみと打つべき一手を助言してください。`,
          }],
        }),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.error?.message || `AI エラー: ${res.status}`);
      }
      const data = await res.json();
      const text = data?.content?.[0]?.text ?? '';
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('AI の返答を読み取れませんでした');
      const p = JSON.parse(m[0]);
      setConsult({
        summary: p.summary || '',
        seasonInsight: p.seasonInsight || '',
        marginTrend: p.marginTrend || '',
        warnings: Array.isArray(p.warnings) ? p.warnings : [],
        nextMonthForecast: p.nextMonthForecast || '',
        actions: Array.isArray(p.actions) ? p.actions : [],
      });
    } catch (e) {
      setAiError(e instanceof Error ? e.message : '助言を作れませんでした');
    } finally {
      setAiLoading(false);
    }
  };

  // モーダル開いた時、Stripe データが揃ったら自動で AI 助言を 1 回発火
  // (オーナー指示 2026-05-27: ボタン待たずに開いた瞬間から分析が始まる)
  useEffect(() => {
    if (autoConsultedRef.current) return;
    if (source !== 'stripe' || !analysis) return;
    if (aiLoading || consult) return;
    autoConsultedRef.current = true;
    runConsult();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, analysis]);

  const accent = persona.accentColor;

  return (
    <motion.div className="cp-modal-bg"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}>
      <motion.div className="cp-modal" style={{ maxWidth: '1000px' }}
        initial={{ scale: 0.97, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 12 }}
        onClick={e => e.stopPropagation()}>

        <div className="cp-modal-header">
          <div className="cp-row min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: persona.accentColorLight, color: accent }}>🧮</div>
            <div className="min-w-0">
              <p className="cp-h2 truncate">財務コンサルタント</p>
              <p className="cp-meta truncate">{persona.name} · どの月が強い / 弱いを読み解きます</p>
            </div>
          </div>
          <button onClick={onClose} className="cp-btn cp-btn-ghost cp-btn-sm">✕</button>
        </div>

        <div className="cp-modal-body cp-stack">

          <StudioIntro
            id="fin-consult"
            accent={accent}
            iconKey="finConsult"
            what="毎月の売上・経費・利益を並べて、『どの月が強い / 弱い』を AI が読み解く場所です。"
            tryThis="開くと自動で集計します。下の「助言をもらう」で、数字をもとにした改善案が出ます。"
            example="「3 月は経費が突出 → 外注費が原因。固定契約に切り替えると月 8 万円減らせます」のように。"
            sampleLabel="出てくる助言"
            samplePreview={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.66rem', lineHeight: 1.35 }}>
                <span style={{ fontWeight: 700 }}>改善案</span>
                <span>3 月: 外注費が突出</span>
                <span>→ 固定契約で月 −8 万円</span>
              </div>
            }
          />

          {/* データ源 */}
          <div className="cp-row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span className="cp-tiny" style={{
              padding: '3px 9px', borderRadius: 999,
              background: persona.accentColorLight, color: accent, fontWeight: 700,
            }}>
              データ源: {sourceLabel}
            </span>
            {stripeLoading && <span className="cp-meta">Stripe を読み込み中…</span>}
          </div>

          {/* 手入力フォールバック */}
          {source === 'cashflow' && (
            <div className="cp-card-section">
              <p className="cp-h3 mb-2">📋 いまの収支 (手入力)</p>
              <div className="cp-grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
                <Stat label="売上" value={fmtJpy(persona.cashflow.income || 0)} color="#34d399" />
                <Stat label="経費" value={fmtJpy(Math.abs(persona.cashflow.expense || 0))} color="#f87171" />
                <Stat label="利益"
                  value={fmtJpy((persona.cashflow.income || 0) - Math.abs(persona.cashflow.expense || 0))}
                  color={accent} />
              </div>
              <p className="cp-meta mt-2">
                Stripe をつなぐか、売上台帳に記録すると、月別の強い月 / 弱い月まで分析できます。
              </p>
            </div>
          )}

          {/* 月次サマリー */}
          {analysis && (
            <>
              <div className="cp-grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                <Stat label="一番強い月"
                  value={fmtJpy(analysis.strongest.profit)}
                  sub={`${monthLabel(analysis.strongest.month)} の利益`}
                  color="#4ADE80" />
                <Stat label="一番弱い月"
                  value={fmtJpy(analysis.weakest.profit)}
                  sub={`${monthLabel(analysis.weakest.month)} の利益`}
                  color="#FF6B6B" />
                <Stat label="前月比"
                  value={analysis.momPct === null ? '—' : `${analysis.momPct >= 0 ? '+' : ''}${analysis.momPct.toFixed(0)}%`}
                  sub={analysis.prev ? `${monthLabel(analysis.prev.month)} → ${monthLabel(analysis.latest.month)}` : 'データ不足'}
                  color={analysis.momPct !== null && analysis.momPct >= 0 ? '#4ADE80' : '#FF6B6B'} />
                <Stat label="前年同月比"
                  value={analysis.yoyPct === null ? '—' : `${analysis.yoyPct >= 0 ? '+' : ''}${analysis.yoyPct.toFixed(0)}%`}
                  sub={analysis.yoyPct === null ? '1年分のデータが必要' : `${monthLabel(analysis.latest.month)}`}
                  color={analysis.yoyPct !== null && analysis.yoyPct >= 0 ? '#4ADE80' : '#FF6B6B'} />
              </div>

              {/* 12ヶ月グラフ */}
              <div className="cp-card-section">
                <p className="cp-h3 mb-3">📊 月別の利益 (直近{series.length}ヶ月)</p>
                <ProfitChart
                  series={series}
                  strongest={analysis.strongest.month}
                  weakest={analysis.weakest.month}
                  season={analysis.season}
                  accent={accent}
                />
                <div className="cp-row mt-3" style={{ gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Legend color="#4ADE80" label="一番強い月" />
                  <Legend color="#FF6B6B" label="一番弱い月" />
                  <Legend color={accent} label="ふつうの月" />
                  <span className="cp-tiny" style={{ color: 'var(--fg-subtle)' }}>
                    🔥 繁忙期 / 🍃 閑散期 は売上の多い少ないで自動判定
                  </span>
                </div>
              </div>

              {/* 季節性 */}
              <div className="cp-grid-2">
                <div className="cp-card">
                  <p className="cp-tiny">🔥 繁忙期 (売上が多い月)</p>
                  <p className="text-fg cp-body mt-1">
                    {analysis.busyMonths.length > 0
                      ? analysis.busyMonths.map(monthLabel).join('・')
                      : 'はっきりした繁忙期はまだ見えません'}
                  </p>
                </div>
                <div className="cp-card">
                  <p className="cp-tiny">🍃 閑散期 (売上が少ない月)</p>
                  <p className="text-fg cp-body mt-1">
                    {analysis.slowMonths.length > 0
                      ? analysis.slowMonths.map(monthLabel).join('・')
                      : 'はっきりした閑散期はまだ見えません'}
                  </p>
                </div>
              </div>

              {/* 危険な兆候 */}
              {analysis.lossMonths.length > 0 && (
                <div className="cp-card-section" style={{
                  background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.35)',
                }}>
                  <p className="cp-h3 mb-1" style={{ color: '#f87171' }}>⚠ 注意したい月</p>
                  <p className="cp-body text-fg">
                    {analysis.lossMonths.map(m => monthLabel(m.month)).join('・')} は
                    経費が売上を上回りました (赤字)。閑散期の固定費を見直す合図です。
                  </p>
                </div>
              )}

              {/* ─── キャッシュ予測 (3ヶ月先) ─── */}
              {forecast && (
                <div className="cp-card-section">
                  <p className="cp-h3 mb-1">🔮 これから 3 ヶ月の見通し</p>
                  <p className="cp-meta" style={{ marginBottom: 12 }}>
                    直近 3 ヶ月の実績から予測。月あたりの利益はおよそ {fmtJpy(forecast.avgProfit)}
                    {forecast.slope > 0 ? '（上向き）' : forecast.slope < 0 ? '（下向き）' : ''} です。
                  </p>
                  <div className="cp-grid-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {forecast.points.map((p, i) => (
                      <div key={p.month} style={{
                        padding: '10px 12px', borderRadius: 12,
                        background: 'var(--surface-3)', border: '1px solid var(--border)',
                      }}>
                        <div className="cp-tiny" style={{ color: 'var(--fg-muted)', marginBottom: 4 }}>
                          {monthLabel(p.month)} {i === 0 ? '(来月)' : ''}
                        </div>
                        <div style={{
                          fontSize: '1.05rem', fontWeight: 800,
                          color: p.profit >= 0 ? '#34D399' : '#F87171',
                          fontFamily: '"SF Mono", monospace',
                        }}>{fmtJpy(p.profit)}</div>
                        <div className="cp-tiny" style={{ color: 'var(--fg-muted)', marginTop: 2 }}>
                          累計 {fmtJpy(p.cumulative)}
                        </div>
                      </div>
                    ))}
                  </div>
                  {forecast.monthlyBurn > 0 ? (
                    <div style={{
                      marginTop: 10, padding: '10px 12px', borderRadius: 10,
                      background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.35)',
                      fontSize: '0.85rem', color: '#FCA5A5', lineHeight: 1.6,
                    }}>
                      ⚠ いまは毎月およそ {fmtJpy(forecast.monthlyBurn)} ずつ持ち出しの状態です。
                      売上を増やすか固定費を見直して、3 ヶ月以内に黒字化を目指しましょう。
                    </div>
                  ) : (
                    <div style={{
                      marginTop: 10, padding: '10px 12px', borderRadius: 10,
                      background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.3)',
                      fontSize: '0.85rem', color: '#34D399', lineHeight: 1.6,
                    }}>
                      ✓ この調子なら 3 ヶ月で約 {fmtJpy(forecast.points[forecast.points.length - 1].cumulative)} 積み上がる見込みです。
                    </div>
                  )}
                  <p className="cp-tiny" style={{ color: 'var(--fg-muted)', marginTop: 8 }}>
                    ※ 直近の実績をもとにした目安です。大きな受注や支出があると変わります。
                  </p>
                </div>
              )}
            </>
          )}

          {/* AI コンサル */}
          <div className="cp-card-section">
            <div className="cp-row-between mb-2">
              <p className="cp-h3">🤖 AI 財務コンサルの助言</p>
              <button onClick={runConsult} disabled={aiLoading}
                className="cp-btn cp-btn-sm"
                style={{ background: accent, color: '#0a0a0f', borderColor: 'transparent', opacity: aiLoading ? 0.5 : 1 }}>
                {aiLoading ? '数字を読んでいます…' : consult ? '↻ もう一度' : '✨ 助言をもらう'}
              </button>
            </div>

            {!consult && !aiLoading && !aiError && (
              <p className="cp-meta">
                ボタンを押すと、強い月・弱い月・来月の見こみ・打つべき一手を、やさしい言葉でまとめます。
              </p>
            )}

            <ApiErrorCard error={aiError} onRetry={runConsult} />

            {aiLoading && !consult && (
              <ThinkingIndicator
                accent={accent}
                variant="full"
                messages={[
                  '12 ヶ月の数字を読み込んでいます…',
                  '売上の強い月・弱い月を見つけています…',
                  '利益のうわまえ (利益率) を調べています…',
                  '来月の売上を予測しています…',
                  '打つべき一手を考えています…',
                ]}
                subtitle="あなたのお金の流れを、やさしい言葉でまとめています"
                onRetry={runConsult}
              />
            )}

            {consult && (
              <motion.div className="cp-stack-sm"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <p className="cp-body text-fg" style={{ fontWeight: 600 }}>{consult.summary}</p>

                {consult.seasonInsight && (
                  <Advice emoji="📅" title="繁忙期・閑散期" body={consult.seasonInsight} />
                )}
                {consult.marginTrend && (
                  <Advice emoji="📈" title="利益のうわまえ (利益率)" body={consult.marginTrend} />
                )}
                {consult.nextMonthForecast && (
                  <Advice emoji="🔮" title="来月の売上の見こみ" body={consult.nextMonthForecast} />
                )}

                {consult.warnings.length > 0 && (
                  <div className="cp-card" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.35)' }}>
                    <p className="cp-tiny" style={{ color: '#FBBF24', fontWeight: 700 }}>⚠ 気をつけたい兆候</p>
                    <ul className="mt-1" style={{ paddingLeft: 16 }}>
                      {consult.warnings.map((w, i) => (
                        <li key={i} className="cp-body text-fg" style={{ listStyle: 'disc' }}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {consult.actions.length > 0 && (
                  <div className="cp-card" style={{ background: persona.accentColorLight, border: `1px solid ${accent}40` }}>
                    <p className="cp-tiny" style={{ color: accent, fontWeight: 700 }}>✅ 来月のために、今すぐ打つ一手</p>
                    <div className="cp-stack-sm mt-2">
                      {consult.actions.map((a, i) => (
                        <div key={i} className="cp-row" style={{ gap: 8, alignItems: 'flex-start' }}>
                          <span className="flex-shrink-0" style={{
                            width: 20, height: 20, borderRadius: 999, fontSize: 11, fontWeight: 800,
                            background: accent, color: '#0a0a0f',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>{i + 1}</span>
                          <span className="cp-body text-fg">{a}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>

        </div>
      </motion.div>
    </motion.div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="cp-card text-center">
      <p className="cp-tiny">{label}</p>
      <p className="text-fg" style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'monospace', color }}>{value}</p>
      {sub && <p className="cp-meta">{sub}</p>}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="cp-meta">
      <span className="inline-block w-3 h-3 rounded mr-1" style={{ background: color, verticalAlign: 'middle' }} />
      {label}
    </span>
  );
}

function Advice({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <div className="cp-card">
      <p className="cp-tiny" style={{ fontWeight: 700 }}>{emoji} {title}</p>
      <p className="cp-body text-fg mt-1">{body}</p>
    </div>
  );
}

function ProfitChart({ series, strongest, weakest, season, accent }: {
  series: MPoint[];
  strongest: string;
  weakest: string;
  season: (m: MPoint) => 'busy' | 'slow' | 'normal';
  accent: string;
}) {
  const max = Math.max(...series.map(s => Math.abs(s.profit)), 1);
  return (
    <div className="flex gap-1.5" style={{ height: 176 }}>
      {series.map(s => {
        const h = (Math.abs(s.profit) / max) * 100;
        const isStrong = s.month === strongest;
        const isWeak = s.month === weakest;
        const color = isStrong ? '#4ADE80' : isWeak ? '#FF6B6B' : accent;
        const se = season(s);
        return (
          <div key={s.month} className="flex-1 h-full flex flex-col items-center gap-0.5 min-w-0">
            <span className="text-[9px] leading-none" style={{ height: 12 }}>
              {se === 'busy' ? '🔥' : se === 'slow' ? '🍃' : ''}
            </span>
            <div className="flex-1 w-full flex items-end">
              <div className="w-full rounded-sm" title={`${s.month} 利益 ${s.profit.toLocaleString()}円`}
                style={{
                  height: `${Math.max(h, 2)}%`,
                  background: color,
                  opacity: s.profit < 0 ? 0.45 : 1,
                  boxShadow: isStrong || isWeak ? `0 0 10px ${color}` : 'none',
                }} />
            </div>
            <p className="text-[8px] text-center leading-none" style={{ color: 'var(--fg-subtle)', fontFamily: 'monospace' }}>
              {monthLabel(s.month)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
