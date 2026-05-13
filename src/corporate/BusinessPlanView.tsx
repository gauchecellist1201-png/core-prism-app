// ============================================================
// BusinessPlanView — マスターモード専用 事業計画ビューア
// 左ナビ + Markdown レンダリング
// Source: ~/Desktop/CORE_事業計画_2026/*.md (src/data/businessPlan.ts に embed)
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { BUSINESS_PLAN_DOCS, BUSINESS_PLAN_GENERATED_AT, type BusinessPlanDoc } from '../data/businessPlan';
import { isMasterAuth } from '../lib/billing';
import KpiGapCard from '../components/KpiGapCard';
import { computeKpiGaps, computeMrrGap, trackVisit, type KpiGap } from '../lib/kpiAggregator';

const FONT_DISPLAY = '"Cinzel", "Noto Serif JP", serif';
const FONT_SERIF_JA = '"Noto Serif JP", "游明朝", serif';
const FONT_SANS = '"Noto Sans JP", "Inter", sans-serif';

function daysAgo(dateStr: string | null): string {
  if (!dateStr) return '日付不明';
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return dateStr;
  const diff = Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return '今日';
  if (diff === 1) return '昨日';
  return `${diff} 日前`;
}

export default function BusinessPlanView() {
  // セキュリティ: マスターモード時のみアクセス可能
  if (!isMasterAuth()) {
    return (
      <div style={{
        padding: '4rem 1.5rem',
        textAlign: 'center',
        fontFamily: FONT_SERIF_JA,
        color: 'rgba(255,255,255,0.6)',
      }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.4em', color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: '1rem' }}>
          OWNER ONLY
        </p>
        <h2 style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.4rem', marginBottom: '0.75rem', color: '#fff' }}>
          このビューはマスターモード専用です
        </h2>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.9 }}>
          法人情報・財務見込みを含むため、一般ユーザーには表示されません。
        </p>
      </div>
    );
  }

  const docs = BUSINESS_PLAN_DOCS;
  const initialSlug = useMemo(() => {
    if (typeof window === 'undefined' || docs.length === 0) return docs[0]?.slug ?? null;
    const hash = window.location.hash.replace(/^#/, '');
    if (hash && docs.some(d => d.slug === hash)) return hash;
    return docs[0].slug;
  }, [docs]);

  const [activeSlug, setActiveSlug] = useState<string | null>(initialSlug);
  const active: BusinessPlanDoc | undefined = docs.find(d => d.slug === activeSlug) ?? docs[0];

  useEffect(() => {
    if (typeof window === 'undefined' || !activeSlug) return;
    const cur = window.location.hash.replace(/^#/, '');
    if (cur !== activeSlug) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${activeSlug}`);
    }
  }, [activeSlug]);

  // KPI ダッシュボード (Step 2: 自動取込)
  const [kpiGaps, setKpiGaps] = useState<KpiGap[]>([]);
  const [mrrGap, setMrrGap] = useState<KpiGap | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const isKpiDoc = !!active && /KPI|リスク/.test(active.file);

  useEffect(() => {
    trackVisit();
    let cancelled = false;
    setKpiLoading(true);
    Promise.all([computeKpiGaps(), computeMrrGap()])
      .then(([gaps, mrr]) => {
        if (cancelled) return;
        setKpiGaps(gaps);
        setMrrGap(mrr);
        setKpiError(null);
      })
      .catch((e) => { if (!cancelled) setKpiError(String(e?.message || e)); })
      .finally(() => { if (!cancelled) setKpiLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const summary = useMemo(() => {
    if (kpiGaps.length === 0) return { green: 0, amber: 0, red: 0, unknown: 0 };
    return kpiGaps.reduce((acc, g) => {
      acc[g.status] += 1;
      return acc;
    }, { green: 0, amber: 0, red: 0, unknown: 0 } as Record<KpiGap['status'], number>);
  }, [kpiGaps]);

  if (docs.length === 0) {
    return (
      <div style={{ padding: '4rem 1.5rem', textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontFamily: FONT_SERIF_JA }}>
        <p>計画書がまだ同期されていません。</p>
        <p style={{ fontSize: '0.8rem', marginTop: 8 }}>
          <code>npm run sync-plan</code> を実行してください。
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: FONT_SANS, color: '#fff' }}>
      {/* ヘッダ */}
      <div style={{
        marginBottom: '1.5rem',
        padding: '1.25rem 1.5rem',
        background: 'linear-gradient(135deg, rgba(167,139,250,0.12), rgba(96,165,250,0.08))',
        border: '1px solid rgba(167,139,250,0.25)',
        borderRadius: 14,
      }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.65rem', letterSpacing: '0.35em', color: '#c4b5fd', fontWeight: 700, marginBottom: 6 }}>
          BUSINESS PLAN ARCHIVE
        </p>
        <h2 style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.25rem', fontWeight: 700, marginBottom: 4 }}>
          事業計画 2026 — 全 {docs.length} 編
        </h2>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
          ソース: <code style={{ fontSize: '0.75rem' }}>~/Desktop/CORE_事業計画_2026/</code>
          {' '}/ 同期: {new Date(BUSINESS_PLAN_GENERATED_AT).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' })}
        </p>
      </div>

      {/* 2 カラム: 左ナビ + 本文 */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.25rem' }} className="lp-plan-grid">
        {/* 左ナビ */}
        <nav style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: '0.75rem',
          alignSelf: 'flex-start',
          position: 'sticky',
          top: 88,
          maxHeight: 'calc(100dvh - 120px)',
          overflowY: 'auto',
        }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {docs.map(d => {
              const isActive = d.slug === active?.slug;
              return (
                <li key={d.slug}>
                  <button
                    onClick={() => setActiveSlug(d.slug)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.65rem 0.75rem',
                      borderRadius: 8,
                      background: isActive ? 'linear-gradient(135deg, rgba(167,139,250,0.25), rgba(96,165,250,0.15))' : 'transparent',
                      border: isActive ? '1px solid rgba(167,139,250,0.45)' : '1px solid transparent',
                      color: '#fff',
                      cursor: 'pointer',
                      fontFamily: FONT_SERIF_JA,
                      fontSize: '0.82rem',
                      lineHeight: 1.5,
                      fontWeight: isActive ? 700 : 500,
                    }}
                  >
                    {d.title}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* 本文 */}
        <article style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: '2rem 2.25rem',
          minHeight: 480,
        }}>
          {active && (
            <>
              <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
                <p style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>{active.file}</p>
                <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
                  最終更新 {daysAgo(active.updated)}{active.updated ? ` (${active.updated})` : ''}
                </p>
              </div>

              {/* KPI ダッシュボード — 06_リスク_KPI_ロードマップ 表示中は全カード、それ以外は MRR + サマリ */}
              <section style={{
                marginBottom: '1.5rem',
                padding: '1.1rem 1.2rem',
                background: 'linear-gradient(135deg, rgba(96,165,250,0.08), rgba(167,139,250,0.06))',
                border: '1px solid rgba(96,165,250,0.20)',
                borderRadius: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  <div>
                    <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.6rem', letterSpacing: '0.32em', color: '#93c5fd', fontWeight: 700, margin: 0 }}>
                      KPI GAP MONITOR — Step 2
                    </p>
                    <h3 style={{ fontFamily: FONT_SERIF_JA, fontSize: '1rem', fontWeight: 700, margin: '4px 0 0', color: '#fff' }}>
                      目標 vs 実績 (Stripe / 内蔵 telemetry / Analytics)
                    </h3>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                    {kpiLoading
                      ? <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>取込中…</span>
                      : (
                        <>
                          <span style={{ fontSize: '0.72rem', color: '#a7f3d0' }}>● {summary.green}</span>
                          <span style={{ fontSize: '0.72rem', color: '#fde68a' }}>● {summary.amber}</span>
                          <span style={{ fontSize: '0.72rem', color: '#fecaca' }}>● {summary.red}</span>
                          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>○ {summary.unknown}</span>
                        </>
                      )}
                  </div>
                </div>

                {kpiError && (
                  <p style={{ fontSize: '0.72rem', color: '#fecaca', margin: '0 0 8px' }}>取得エラー: {kpiError}</p>
                )}

                {/* MRR 単独カードは常に表示 */}
                {mrrGap && (
                  <div style={{ marginBottom: isKpiDoc ? 12 : 0 }}>
                    <KpiGapCard gap={mrrGap} />
                  </div>
                )}

                {/* KPI ドキュメント表示時は全 KPI を 2 列グリッドで */}
                {isKpiDoc && kpiGaps.length > 0 && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 10,
                  }}>
                    {kpiGaps.map(g => (
                      <KpiGapCard
                        key={g.target.id}
                        gap={g}
                        inverted={g.target.id === 'churn_rate_monthly'}
                      />
                    ))}
                  </div>
                )}

                {!isKpiDoc && (
                  <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', margin: '8px 0 0' }}>
                    全 KPI ギャップは「06_リスク_KPI_ロードマップ」を選択 →
                  </p>
                )}
              </section>

              <div className="bp-markdown">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                >
                  {active.content}
                </ReactMarkdown>
              </div>
            </>
          )}
        </article>
      </div>

      {/* Markdown スタイル */}
      <style>{`
        .bp-markdown {
          font-family: ${FONT_SERIF_JA};
          color: rgba(255,255,255,0.88);
          line-height: 1.95;
          font-size: 0.92rem;
        }
        .bp-markdown h1 {
          font-family: ${FONT_SERIF_JA};
          font-size: 1.6rem;
          font-weight: 800;
          letter-spacing: 0.04em;
          margin: 0 0 1rem;
          padding-bottom: 0.6rem;
          border-bottom: 1px solid rgba(255,255,255,0.12);
          background: linear-gradient(90deg, #fbbf24, #a78bfa, #60a5fa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .bp-markdown h2 {
          font-family: ${FONT_SERIF_JA};
          font-size: 1.2rem;
          font-weight: 700;
          margin: 1.75rem 0 0.75rem;
          color: #c4b5fd;
        }
        .bp-markdown h3 {
          font-family: ${FONT_SERIF_JA};
          font-size: 1.02rem;
          font-weight: 700;
          margin: 1.25rem 0 0.5rem;
          color: #fbbf24;
        }
        .bp-markdown h4 { font-size: 0.95rem; font-weight: 700; margin: 1rem 0 0.4rem; color: rgba(255,255,255,0.9); }
        .bp-markdown p { margin: 0.6rem 0; }
        .bp-markdown ul, .bp-markdown ol { margin: 0.5rem 0 0.5rem 1.4rem; padding: 0; }
        .bp-markdown li { margin: 0.25rem 0; }
        .bp-markdown strong { color: #fff; font-weight: 700; }
        .bp-markdown em { color: rgba(255,255,255,0.75); }
        .bp-markdown a { color: #93c5fd; text-decoration: underline; text-decoration-color: rgba(147,197,253,0.4); }
        .bp-markdown a:hover { text-decoration-color: #93c5fd; }
        .bp-markdown blockquote {
          border-left: 3px solid #a78bfa;
          padding: 0.4rem 0.9rem;
          margin: 0.8rem 0;
          background: rgba(167,139,250,0.06);
          color: rgba(255,255,255,0.78);
          border-radius: 0 8px 8px 0;
        }
        .bp-markdown code {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.82em;
          background: rgba(255,255,255,0.08);
          padding: 0.12em 0.4em;
          border-radius: 4px;
          color: #fde68a;
        }
        .bp-markdown pre {
          background: rgba(0,0,0,0.55);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 0.9rem 1rem;
          overflow-x: auto;
          margin: 0.8rem 0;
        }
        .bp-markdown pre code {
          background: transparent;
          padding: 0;
          color: rgba(255,255,255,0.85);
          font-size: 0.78rem;
        }
        .bp-markdown table {
          border-collapse: collapse;
          width: 100%;
          margin: 0.9rem 0;
          font-size: 0.85rem;
        }
        .bp-markdown th, .bp-markdown td {
          border: 1px solid rgba(255,255,255,0.12);
          padding: 0.5rem 0.75rem;
          text-align: left;
        }
        .bp-markdown th {
          background: rgba(167,139,250,0.12);
          color: #fff;
          font-weight: 700;
        }
        .bp-markdown td { color: rgba(255,255,255,0.82); }
        .bp-markdown tr:nth-child(even) td { background: rgba(255,255,255,0.02); }
        .bp-markdown hr {
          border: 0;
          border-top: 1px solid rgba(255,255,255,0.12);
          margin: 1.5rem 0;
        }
        @media (max-width: 820px) {
          .lp-plan-grid { grid-template-columns: 1fr !important; }
          .lp-plan-grid nav { position: static !important; max-height: none !important; }
        }
      `}</style>
    </div>
  );
}
