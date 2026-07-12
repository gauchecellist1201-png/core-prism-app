// ============================================================
// CeoStudio — 経営 (CEO) エージェント Studio
//
// オーナー指示 (2026-05-27):
//   「経営エージェントなら、現状を把握し、経営状態を分析し、
//    今後の方針をすべて提示できるものに。7 つのエージェントを
//    『これはすごい』と思わせるレベルに強化、ユーザー定着の鍵」
//
// 設計:
//   モーダル開いた瞬間 → Stripe 売上 + ナレッジ + CRM + 経費 を全部読んで
//   AI に「現状 / 強み / 弱み / 90 日の重点 3 つ / 今すぐやる 3 つ」を出させる
//   結果は構造化カードで表示。やさしい日本語、数字根拠付き。
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Persona, AppSettings, KnowledgeItem } from '../types/identity';
import { useStripeRevenue } from '../hooks/useStripeRevenue';
import { useCRM } from '../hooks/useCRM';
import { useExpenses } from '../hooks/useExpenses';
import { fmtJpy } from '../lib/invoiceCalc';
import ApiErrorCard from './ApiErrorCard';
import AILoadingState from './AILoadingState';
import { StudioIntro } from './StudioIntro';
import { aiFetch } from '../lib/aiFetch';

interface Props {
  persona: Persona;
  settings: AppSettings;
  knowledge: KnowledgeItem[];
  onClose: () => void;
}

interface CeoBrief {
  /** 現状を 2-3 文で */
  currentState: string;
  /** 強み 3 つ */
  strengths: string[];
  /** 弱み・課題 3 つ */
  weaknesses: string[];
  /** 90 日の重点方針 3 つ (動詞 + 期日 + 数字) */
  ninetyDayPlan: Array<{ title: string; why: string }>;
  /** 今週中にやる具体的アクション 3 つ */
  thisWeekActions: Array<{ action: string; deadline: string }>;
  /** リスク・気をつけるべき兆候 (あれば) */
  warnings: string[];
}

const SYS = `あなたは中小企業の社長によりそう、経験豊富な経営パートナーです。
オーナーの全資料 / 数字 / 案件 / 経費を読んで、現状を冷静に分析し、90 日の方針と今週のアクションを出します。

## やさしい日本語ルール (絶対遵守)
- 専門用語・横文字を使わない (LTV / KPI / ROI / リテンション 等は全て言い換え)
- 中学生でも読める短文
- 数字・固有名詞・期日を必ず根拠に含める
- 「がんばりましょう」「整理しましょう」のような曖昧禁止

## 返答は JSON のみ (コードブロックなし):
{
  "currentState": "現状の経営状態を 2-3 文 (数字を 1 つ以上含める)",
  "strengths": ["強み 1 (具体的に)", "強み 2", "強み 3"],
  "weaknesses": ["課題 1 (具体的に)", "課題 2", "課題 3"],
  "ninetyDayPlan": [
    { "title": "重点 1 (動詞 + 何を)", "why": "なぜ重要か 1 文" },
    { "title": "重点 2", "why": "..." },
    { "title": "重点 3", "why": "..." }
  ],
  "thisWeekActions": [
    { "action": "今週やる 1 (具体的)", "deadline": "曜日 or 日付" },
    { "action": "今週やる 2", "deadline": "..." },
    { "action": "今週やる 3", "deadline": "..." }
  ],
  "warnings": ["リスク兆候があれば短く。無ければ空配列"]
}`;

export default function CeoStudio({ persona, settings, knowledge, onClose }: Props) {
  const stripe = useStripeRevenue();
  const crm = useCRM();
  const exp = useExpenses();

  const [brief, setBrief] = useState<CeoBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aborted, setAborted] = useState(false);
  const autoFiredRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const accent = persona.accentColor;

  // 入力データのサマリを 1 段組で構築 (AI に渡す)
  const contextBlock = useMemo(() => {
    const now = new Date();
    const ym = now.toISOString().slice(0, 7);

    // Stripe 数字
    let stripeBlock = '## Stripe 売上 (実データ)\n';
    if (stripe.connected && stripe.monthly.length > 0) {
      const last12 = stripe.monthly.slice(-12);
      const total = last12.reduce((s, m) => s + m.revenueJpy, 0);
      const avg = total / last12.length;
      const thisMonth = stripe.thisMonth;
      stripeBlock += `- 今月: 売上 ${fmtJpy(thisMonth.revenueJpy)} / 経費 ${fmtJpy(thisMonth.expenseJpy)} / 利益 ${fmtJpy(thisMonth.profitJpy)} (${thisMonth.txnCount} 件)\n`;
      stripeBlock += `- 12 ヶ月累計: ${fmtJpy(total)} / 月平均: ${fmtJpy(avg)}\n`;
      stripeBlock += `- 月次推移: ${last12.map(m => `${m.month}=${Math.round(m.revenueJpy/10000)}万`).join(' / ')}\n`;
    } else {
      stripeBlock += '- まだ Stripe を連携していない、または取引データなし\n';
    }

    // 案件 (CRM)
    const personaDeals = crm.deals.filter(d => d.personaId === persona.id);
    const openDeals = personaDeals.filter(d => d.stage !== 'won' && d.stage !== 'lost');
    const wonDeals = personaDeals.filter(d => d.stage === 'won');
    const pipelineSum = openDeals.reduce((s, d) => s + (d.amount || 0) * ((d.probability ?? 0) / 100), 0);
    let dealsBlock = '## 進行中の案件\n';
    if (openDeals.length === 0) {
      dealsBlock += '- (進行中の案件なし)\n';
    } else {
      dealsBlock += `- 進行中 ${openDeals.length} 件、確度加重合計 ${fmtJpy(pipelineSum)}\n`;
      openDeals.slice(0, 8).forEach(d => {
        const name = d.contact?.company || d.title;
        dealsBlock += `  · ${name} ${fmtJpy(d.amount || 0)} × ${d.probability ?? 0}% (${d.stage})\n`;
      });
      dealsBlock += `- 過去成約 ${wonDeals.length} 件\n`;
    }

    // 経費トレンド (直近 3 ヶ月)
    const last3Expenses = exp.entries.filter(e => {
      if (e.personaId !== persona.id) return false;
      const d = new Date(e.date);
      const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      return monthsAgo >= 0 && monthsAgo < 3;
    });
    const expByCategory = new Map<string, number>();
    last3Expenses.forEach(e => {
      expByCategory.set(e.category, (expByCategory.get(e.category) || 0) + e.amountIncl);
    });
    let expBlock = '## 直近 3 ヶ月の経費 (カテゴリ別)\n';
    if (expByCategory.size === 0) {
      expBlock += '- (経費記録なし)\n';
    } else {
      const sorted = Array.from(expByCategory.entries()).sort((a, b) => b[1] - a[1]);
      sorted.slice(0, 6).forEach(([cat, amt]) => {
        expBlock += `- ${cat}: ${fmtJpy(amt)}\n`;
      });
    }

    // ナレッジサマリ (件数 + 主要トピック)
    let kbBlock = `## 蓄積資料: ${knowledge.length} 件\n`;
    if (knowledge.length > 0) {
      const recent = knowledge.slice(0, 15);
      recent.forEach(k => {
        const sum = k.analysis?.summary || k.content.slice(0, 100);
        kbBlock += `- ${k.title}: ${sum.slice(0, 120)}\n`;
      });
      if (knowledge.length > 15) kbBlock += `- ... ほか ${knowledge.length - 15} 件\n`;
    } else {
      kbBlock += '- まだ資料を読み込んでない\n';
    }

    return `# 経営現状サマリ (${ym})
事業: ${persona.name} (${persona.subtitle || ''})
業種: ${settings.industry || '未設定'}

${stripeBlock}
${dealsBlock}
${expBlock}
${kbBlock}`;
  }, [stripe, crm.deals, exp.entries, persona, knowledge, settings.industry]);

  const runAnalysis = async () => {
    // 直前の AI 呼出しが残っていたら中断 (二重起動防止)
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    setAborted(false);
    try {
      const res = await aiFetch({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 2000,
          system: SYS,
          messages: [{
            role: 'user',
            content: `${contextBlock}\n\nこの社長のために、現状を分析し、90 日の重点 3 つと今週やるべきこと 3 つを提示してください。数字を根拠に、具体的に。`,
          }],
        }),
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.error?.message || `AI エラー: ${res.status}`);
      }
      const data = await res.json();
      if (ac.signal.aborted) return;
      const text = data?.content?.[0]?.text ?? '';
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('AI の返答を読み取れませんでした');
      const p = JSON.parse(m[0]);
      if (!mountedRef.current || ac.signal.aborted) return;
      setBrief({
        currentState: p.currentState || '',
        strengths: Array.isArray(p.strengths) ? p.strengths : [],
        weaknesses: Array.isArray(p.weaknesses) ? p.weaknesses : [],
        ninetyDayPlan: Array.isArray(p.ninetyDayPlan) ? p.ninetyDayPlan : [],
        thisWeekActions: Array.isArray(p.thisWeekActions) ? p.thisWeekActions : [],
        warnings: Array.isArray(p.warnings) ? p.warnings : [],
      });
    } catch (e: any) {
      // 中断は「失敗」ではない — エラー表示せず、aborted フラグだけ立てる
      if (e?.name === 'AbortError' || ac.signal.aborted) return;
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : '分析できませんでした');
    } finally {
      if (mountedRef.current && abortRef.current === ac) setLoading(false);
    }
  };

  const handleAbort = () => {
    // ユーザーが「✕ 中断」を押した瞬間に即座にローディング解除
    abortRef.current?.abort();
    setLoading(false);
    setAborted(true);
  };

  // アンマウント時に進行中の AI 呼出しを止める (モーダル閉じた瞬間に握り続けない)
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  // モーダル開いた瞬間に自動発火 (Stripe ローディング終わるのを待つ)
  useEffect(() => {
    if (autoFiredRef.current) return;
    if (stripe.loading) return;
    autoFiredRef.current = true;
    runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripe.loading]);

  // 入力データの「ひと目」サマリ用
  const summaryStats = useMemo(() => {
    const thisRev = stripe.connected ? stripe.thisMonth.revenueJpy : 0;
    const openDealsCount = crm.deals.filter(d => d.personaId === persona.id && d.stage !== 'won' && d.stage !== 'lost').length;
    return { thisRev, openDealsCount, knowledgeCount: knowledge.length };
  }, [stripe, crm.deals, persona.id, knowledge.length]);

  return (
    <motion.div
      className="cp-modal-bg"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="cp-modal"
        style={{ maxWidth: '1000px' }}
        initial={{ scale: 0.97, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 12 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="cp-modal-header">
          <div className="cp-row min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: persona.accentColorLight, color: accent }}>🧭</div>
            <div className="min-w-0">
              <p className="cp-h2 truncate">経営アドバイザー (CEO)</p>
              <p className="cp-meta truncate">{persona.name} · 現状分析 + 90 日方針 + 今週やること</p>
            </div>
          </div>
          <button onClick={onClose} className="cp-btn cp-btn-ghost cp-btn-sm">✕</button>
        </div>

        <div className="cp-modal-body cp-stack">

          <StudioIntro
            id="ceo"
            accent={accent}
            iconKey="ceo"
            what="あなたの会社の『今の状態』を AI が読み解いて、90 日の方針と『今週やる 3 つ』まで出す場所です。"
            tryThis="開いた瞬間に AI が自動で分析を始めます。売上・案件・経費・資料を全部読んで、たたき台ができます。"
            example="「粗利が落ち気味 → 高単価の案件 A に集中、B は値上げ交渉、C は来月へ」のように具体策が並びます。"
            sampleLabel="出てくる方針"
            samplePreview={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.66rem', lineHeight: 1.35 }}>
                <span style={{ fontWeight: 700 }}>今週やる 3 つ</span>
                <span>① 案件 A に集中する</span>
                <span>② B は値上げを交渉</span>
                <span>③ C は来月にまわす</span>
              </div>
            }
          />

          {/* ひと目サマリ */}
          <div className="cp-row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <Stat label="今月の売上" value={summaryStats.thisRev > 0 ? fmtJpy(summaryStats.thisRev) : '—'} color="#34D399" />
            <Stat label="進行中案件" value={`${summaryStats.openDealsCount} 件`} color="#FBBF24" />
            <Stat label="蓄積資料" value={`${summaryStats.knowledgeCount} 件`} color="#A78BFA" />
          </div>

          {loading && (
            <div className="cp-card-section">
              <AILoadingState
                active={true}
                label="現状を読み解いています…"
                stages={[
                  '売上データを参照中',
                  '案件パイプラインを確認中',
                  '経費の内訳を見ています',
                  `${knowledge.length} 件の資料を読み込み中`,
                  '90 日の方針を組み立て中',
                ]}
                onAbort={handleAbort}
                brand="prism"
                hint="Claude が動いてます · 長くなりそうなら ✕ で中断できます"
              />
            </div>
          )}

          {aborted && !loading && !brief && (
            <div className="cp-card-section" style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.10)',
              textAlign: 'center',
            }}>
              <p className="cp-body" style={{ marginBottom: 10 }}>
                分析を中断しました。今すぐもう一度始められます。
              </p>
              <button
                onClick={runAnalysis}
                className="cp-btn"
                style={{ background: accent, color: '#0a0a0f' }}
              >
                ↻ もう一度分析する
              </button>
            </div>
          )}

          {error && !loading && (
            <ApiErrorCard
              error={error}
              onRetry={runAnalysis}
            />
          )}

          {brief && !loading && (
            <>
              {/* 現状分析 */}
              <div className="cp-card-section" style={{
                background: `linear-gradient(135deg, ${accent}11, transparent)`,
                border: `1px solid ${accent}33`,
              }}>
                <p className="cp-tiny" style={{ color: accent, fontWeight: 800, letterSpacing: '0.2em', marginBottom: 6 }}>
                  📊 いまの経営状況
                </p>
                <p className="cp-body" style={{ lineHeight: 1.75 }}>{brief.currentState}</p>
              </div>

              {/* 強み / 弱み 2 カラム */}
              <div className="cp-grid-2">
                <div className="cp-card-section" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.25)' }}>
                  <p className="cp-tiny" style={{ color: '#34D399', fontWeight: 800, marginBottom: 8 }}>💪 強み</p>
                  <ol style={{ paddingLeft: 20, margin: 0 }}>
                    {brief.strengths.map((s, i) => (
                      <li key={i} style={{ marginBottom: 6, lineHeight: 1.6, fontSize: '0.92rem' }}>{s}</li>
                    ))}
                  </ol>
                </div>
                <div className="cp-card-section" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)' }}>
                  <p className="cp-tiny" style={{ color: '#FBBF24', fontWeight: 800, marginBottom: 8 }}>⚠ 課題</p>
                  <ol style={{ paddingLeft: 20, margin: 0 }}>
                    {brief.weaknesses.map((w, i) => (
                      <li key={i} style={{ marginBottom: 6, lineHeight: 1.6, fontSize: '0.92rem' }}>{w}</li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* 90 日の重点 */}
              <div className="cp-card-section">
                <p className="cp-h3 mb-3">🎯 これから 90 日の重点</p>
                <div className="cp-stack-sm">
                  {brief.ninetyDayPlan.map((p, i) => (
                    <div key={i} style={{
                      padding: '12px 14px',
                      background: 'rgba(255,255,255,0.03)',
                      borderLeft: `3px solid ${accent}`,
                      borderRadius: '0 8px 8px 0',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: '0.98rem', marginBottom: 4 }}>
                        <span style={{ color: accent, marginRight: 6 }}>{i + 1}.</span>
                        {p.title}
                      </div>
                      <div className="cp-meta" style={{ marginLeft: 18 }}>{p.why}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 今週やること */}
              <div className="cp-card-section" style={{
                background: `linear-gradient(135deg, ${accent}08, transparent)`,
                border: `1px solid ${accent}22`,
              }}>
                <p className="cp-h3 mb-3" style={{ color: accent }}>⚡ 今週中にやること 3 つ</p>
                <div className="cp-stack-sm">
                  {brief.thisWeekActions.map((a, i) => (
                    <div key={i} className="cp-row" style={{ gap: 10, alignItems: 'flex-start' }}>
                      <span style={{
                        flexShrink: 0,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 24, height: 24, borderRadius: 6,
                        background: accent, color: '#0a0a0f', fontWeight: 800, fontSize: '0.8rem',
                      }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, lineHeight: 1.5 }}>{a.action}</div>
                        <div className="cp-tiny" style={{ color: '#FBBF24', marginTop: 2 }}>📅 {a.deadline}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 警告 (あれば) */}
              {brief.warnings.length > 0 && (
                <div className="cp-card-section" style={{
                  background: 'rgba(248,113,113,0.08)',
                  border: '1px solid rgba(248,113,113,0.35)',
                }}>
                  <p className="cp-h3 mb-2" style={{ color: '#f87171' }}>🚨 気をつけるべき兆候</p>
                  <ul style={{ paddingLeft: 18, margin: 0 }}>
                    {brief.warnings.map((w, i) => (
                      <li key={i} style={{ marginBottom: 4, color: '#fecaca' }}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* もう一度 */}
              <div className="cp-row" style={{ justifyContent: 'center', marginTop: 8 }}>
                <button onClick={runAnalysis} className="cp-btn cp-btn-ghost cp-btn-sm">
                  ↻ もう一度分析する
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 120,
      padding: '10px 14px',
      background: `${color}10`,
      border: `1px solid ${color}33`,
      borderRadius: 10,
    }}>
      <div className="cp-tiny" style={{ color, fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: '1.15rem', fontWeight: 700, fontFamily: '"SF Mono", monospace', color: 'var(--fg-strong)' }}>{value}</div>
    </div>
  );
}
