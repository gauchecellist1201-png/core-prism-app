import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import type { Persona, AppSettings, KnowledgeItem } from '../types/identity';
import {
  runStrategicAnalysis, type StrategyFramework, type StrategicAnalysis,
  FRAMEWORKS, strategyToMarkdown,
} from '../lib/strategicAnalyst';
import {
  reviewContract, type ContractReview, type ContractStance,
  STANCE_LABELS, contractToMarkdown,
} from '../lib/contractReview';
import {
  analyzeFinancials, type FinancialAnalysis, financialToMarkdown,
} from '../lib/financialAnalyst';
import { parseFile } from '../lib/fileParser';
import { StudioIntro } from './StudioIntro';
import AILoadingState from './AILoadingState';

interface Props {
  persona: Persona;
  settings: AppSettings;
  knowledge: KnowledgeItem[];
  onClose: () => void;
  onSaveAsKnowledge: (title: string, content: string) => void;
}

type Tab = 'strategy' | 'contract' | 'financial';

const RISK_COLOR: Record<string, string> = {
  critical: '#dc2626', high: '#f87171', medium: '#fb923c', info: '#60a5fa',
  good: '#34d399', caution: '#fbbf24', warning: '#f87171', neutral: '#9ca3af',
  excellent: '#10b981', fair: '#fbbf24', concerning: '#f87171', low: '#34d399',
};

export default function PremiumHubModal({ persona, settings, knowledge, onClose, onSaveAsKnowledge }: Props) {
  const [tab, setTab] = useState<Tab>('strategy');

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-[1400px] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg, #15151c)', border: '1px solid var(--border)', maxHeight: 'calc(100dvh - 1.5rem)' }}
        initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${persona.accentColor}25, transparent)`,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: persona.accentColorLight, color: persona.accentColor }}>👑</div>
            <div className="min-w-0">
              <p className="text-fg text-lg font-semibold leading-tight truncate flex items-center gap-2">
                プレミアム AI スイート
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  style={{ background: '#fbbf24', color: '#1a1a1f' }}
                >PREMIUM</span>
              </p>
              <p className="text-fg-muted text-xs">McKinsey 級の戦略分析 / 法務 / 財務を AI で</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="w-11 h-11 rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface text-xl leading-none"
          >✕</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          {([
            ['strategy',  '🎯 戦略コンサル AI'],
            ['contract',  '⚖ 契約書レビュー AI'],
            ['financial', '📊 決算書分析 AI'],
          ] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="text-sm px-4 py-2 rounded-lg font-medium transition-all"
              style={{
                background: tab === id ? persona.accentColorLight : 'var(--surface-3)',
                color: tab === id ? persona.accentColor : 'var(--fg-muted)',
                border: `1px solid ${tab === id ? persona.accentColor + '50' : 'var(--border)'}`,
              }}
            >{label}</button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'strategy' && <StrategyPanel persona={persona} settings={settings} knowledge={knowledge} onSave={onSaveAsKnowledge} />}
          {tab === 'contract' && <ContractPanel persona={persona} settings={settings} onSave={onSaveAsKnowledge} />}
          {tab === 'financial' && <FinancialPanel persona={persona} settings={settings} onSave={onSaveAsKnowledge} />}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================
// Strategy Panel
// ============================================================
function StrategyPanel({ persona, settings, knowledge, onSave }: {
  persona: Persona; settings: AppSettings; knowledge: KnowledgeItem[]; onSave: (t: string, c: string) => void;
}) {
  const [framework, setFramework] = useState<StrategyFramework>('swot');
  const [question, setQuestion] = useState('');
  const [context, setContext] = useState('');
  const [result, setResult] = useState<StrategicAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!question.trim()) { setErr('分析テーマを入力してください'); return; }
    setLoading(true); setErr(null);
    try {
      const r = await runStrategicAnalysis(settings, persona, framework, question, context, knowledge);
      setResult(r);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [framework, question, context, persona, settings, knowledge]);

  return (
    <div className="p-5 space-y-4">
      <StudioIntro
        id="premium-strategy"
        accent="#A78BFA"
        emoji="🎯"
        what="自社の悩み・問いに対し、コンサル会社が使う「分析の型 (SWOT / 5フォースなど)」を AI が当てはめて、強み弱み・機会脅威を整理してくれる戦略の壁打ち AI。"
        tryThis="まず型を 1 つ選ぶ → 問いを 1 行で書く → 「分析する」。3 分で 4 象限の表が返ってきます。"
        example="問い『来期の値上げをすべきか?』→ SWOT 表 + 推奨アクション 3 つ + 想定リスク"
        sampleLabel="返ってくるもの"
        samplePreview={(
          <div className="cp-stack-xs" style={{ fontSize: 11, lineHeight: 1.5 }}>
            <div style={{ color: 'var(--fg)', fontWeight: 700 }}>SWOT 分析</div>
            <div style={{ color: 'var(--fg-muted)' }}>強み: 既存顧客の満足度高</div>
            <div style={{ color: 'var(--fg-muted)' }}>弱み: 営業人員 1 名のみ</div>
            <div style={{ color: 'var(--fg-muted)' }}>機会: 同業の値上げが進行中</div>
            <div style={{ color: 'var(--fg-muted)' }}>脅威: 新規参入 2 社</div>
            <div style={{ color: '#A78BFA', fontWeight: 700, marginTop: 4 }}>→ 推奨: 段階値上げ + 既存維持</div>
          </div>
        )}
      />
      {!result ? (
        <>
          <div>
            <label className="block text-fg-muted text-xs tracking-wider uppercase mb-2">フレームワーク</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(FRAMEWORKS).map(([id, info]) => (
                <button
                  key={id}
                  onClick={() => setFramework(id as StrategyFramework)}
                  className="p-2.5 rounded-lg text-left transition-all"
                  style={{
                    background: framework === id ? persona.accentColorLight : 'var(--surface-3)',
                    border: `1px solid ${framework === id ? persona.accentColor + '50' : 'var(--border)'}`,
                  }}
                >
                  <div className="text-base">{info.emoji}</div>
                  <div className="text-fg text-sm font-medium leading-tight">{info.label}</div>
                  <div className="text-fg-muted text-[10px]">{info.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">分析テーマ <span style={{ color: persona.accentColor }}>*</span></label>
            <input
              type="text" value={question} onChange={e => setQuestion(e.target.value)}
              placeholder="例: 新規事業の参入可否 / 競合B社への対抗策 / 海外展開の優先順位"
              className="w-full text-base rounded-lg px-3 py-2.5 outline-none bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg"
            />
          </div>
          <div>
            <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">背景・前提 (任意)</label>
            <textarea
              value={context} onChange={e => setContext(e.target.value)}
              placeholder="現在の状況、市場環境、リソース、制約条件などを記述..."
              className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-y bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg"
              style={{ minHeight: '100px' }}
            />
          </div>
          {err && <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>{err}</div>}
          <AILoadingState
            active={loading}
            brand="prism"
            label={`${FRAMEWORKS[framework].label} を組み立て中`}
            stages={[
              '質問と背景を読み込み中',
              `${FRAMEWORKS[framework].label} の型に当てはめ中`,
              '強み・弱み・機会・脅威を抽出',
              '推奨アクション 3 つを整理',
            ]}
            skeletonLines={5}
          />
          <div className="flex justify-end pt-2">
            <motion.button
              onClick={run} disabled={!question.trim() || loading}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              style={{ background: persona.accentColor, color: '#0a0a0f' }}
              whileHover={!loading ? { scale: 1.02 } : {}}
              whileTap={!loading ? { scale: 0.98 } : {}}
            >{loading ? '🧠 分析中...' : `✨ ${FRAMEWORKS[framework].label} で 4 象限の表を作ってもらう`}</motion.button>
          </div>
        </>
      ) : (
        <>
          <div>
            <p className="text-fg-muted text-xs tracking-wider uppercase mb-1">{FRAMEWORKS[result.framework].label}</p>
            <p className="text-fg text-xl font-bold">{result.question}</p>
          </div>
          {result.sections.map((sec, i) => (
            <div key={i} className="rounded-xl p-3.5" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
              <p className="text-fg text-base font-semibold mb-1.5">{sec.heading}</p>
              {sec.content && <p className="text-fg/85 text-sm mb-2">{sec.content}</p>}
              <ul className="space-y-1">
                {sec.bullets.map((b, j) => (
                  <li key={j} className="text-fg text-sm flex gap-2"><span style={{ color: persona.accentColor }}>·</span><span>{b}</span></li>
                ))}
              </ul>
            </div>
          ))}
          {result.keyInsights.length > 0 && (
            <Section title="💡 重要な洞察" color={persona.accentColor} items={result.keyInsights} />
          )}
          {result.recommendations.length > 0 && (
            <div className="rounded-xl p-3.5" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
              <p className="text-xs tracking-widest uppercase font-semibold mb-2" style={{ color: '#34d399' }}>🎯 推奨アクション</p>
              <div className="space-y-2">
                {result.recommendations.map((r, i) => (
                  <div key={i} className="p-2 rounded-lg" style={{ background: 'var(--surface)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: RISK_COLOR[r.priority] + '25', color: RISK_COLOR[r.priority], border: `1px solid ${RISK_COLOR[r.priority]}50` }}>
                        {r.priority}
                      </span>
                      <span className="text-fg-muted text-xs">{r.timeline}</span>
                    </div>
                    <p className="text-fg text-sm font-medium">{r.action}</p>
                    <p className="text-fg-muted text-xs mt-1">{r.rationale}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.risks.length > 0 && <Section title="⚠ リスク" color="#f87171" items={result.risks} />}
          {result.metrics.length > 0 && <Section title="📊 見るべき数字" color="#a78bfa" items={result.metrics} />}
          <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <button onClick={() => setResult(null)} className="text-fg-muted hover:text-fg text-sm">← 別の分析</button>
            <div className="flex gap-2">
              <button
                onClick={() => downloadMd(strategyToMarkdown(result), `戦略_${FRAMEWORKS[result.framework].label}_${new Date().toISOString().slice(0,10)}.md`)}
                className="px-4 py-2 rounded-lg text-sm bg-surface-3 border-edge border text-fg hover:bg-surface"
              >📥 .md</button>
              <button
                onClick={() => onSave(`🎯 ${FRAMEWORKS[result.framework].label}: ${result.question}`, strategyToMarkdown(result))}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: persona.accentColor, color: '#0a0a0f' }}
              >📚 ナレッジに保存</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// Contract Panel
// ============================================================
function ContractPanel({ persona, settings, onSave }: {
  persona: Persona; settings: AppSettings; onSave: (t: string, c: string) => void;
}) {
  const [text, setText] = useState('');
  const [stance, setStance] = useState<ContractStance>('buyer');
  const [result, setResult] = useState<ContractReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setErr(null);
    try { const r = await parseFile(file); setText(r.text); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }, []);

  const run = useCallback(async () => {
    if (!text.trim()) { setErr('契約書を入力してください'); return; }
    setLoading(true); setErr(null);
    try {
      const r = await reviewContract(settings, persona, text, stance);
      setResult(r);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [text, stance, persona, settings]);

  return (
    <div className="p-5 space-y-4">
      <StudioIntro
        id="premium-contract"
        accent="#F472B6"
        emoji="⚖"
        what="契約書 (PDF / Word / テキスト) を投げると、AI があなたの立場 (発注 / 受注 / NDA) から「危ない条文」を赤・黄・青で振り分け、修正の提案文まで作ってくれる契約レビュー AI。"
        tryThis="まず立場を選ぶ → 契約書ファイルを投げる → 「分析」。1〜2 分でリスク一覧と修正案が返ります。"
        example="業務委託契約 (受注側) → 危険 2 件 (損害賠償上限なし / 知財帰属) + 修正文案 2 通り"
        sampleLabel="返ってくるもの"
        samplePreview={(
          <div className="cp-stack-xs" style={{ fontSize: 11, lineHeight: 1.5 }}>
            <div className="cp-row" style={{ gap: 4, alignItems: 'baseline' }}>
              <span style={{ color: '#dc2626', fontWeight: 700 }}>● 重大</span>
              <span style={{ color: 'var(--fg)' }}>第 12 条</span>
            </div>
            <div style={{ color: 'var(--fg-muted)' }}>損害賠償の上限が無い</div>
            <div style={{ color: '#F472B6', fontWeight: 700, marginTop: 2 }}>→ 修正案: 「報酬月額の 3 倍を上限とする」</div>
            <div className="cp-row" style={{ gap: 4, alignItems: 'baseline', marginTop: 4 }}>
              <span style={{ color: '#fbbf24', fontWeight: 700 }}>● 注意</span>
              <span style={{ color: 'var(--fg)' }}>第 8 条</span>
            </div>
            <div style={{ color: 'var(--fg-muted)' }}>知財が全て発注側に</div>
          </div>
        )}
      />
      {!result ? (
        <>
          <div>
            <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">あなたの立場</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
              {(Object.entries(STANCE_LABELS) as [ContractStance, string][]).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setStance(id)}
                  className="text-sm py-2 rounded-lg transition-all"
                  style={{
                    background: stance === id ? persona.accentColorLight : 'var(--surface-3)',
                    color: stance === id ? persona.accentColor : 'var(--fg-muted)',
                    border: `1px solid ${stance === id ? persona.accentColor + '50' : 'var(--border)'}`,
                  }}
                >{label}</button>
              ))}
            </div>
          </div>
          <div
            className="rounded-xl p-4 text-center cursor-pointer"
            style={{ background: 'var(--surface-3)', border: '2px dashed var(--border)' }}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            <p className="text-2xl mb-1">📄</p>
            <p className="text-fg text-sm">契約書ファイル (PDF / Word) をドロップ</p>
            <p className="text-fg-muted text-xs">または下にテキスト直接貼付</p>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
          <div>
            <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">契約書本文 {text && `(${text.length}文字)`}</label>
            <textarea
              value={text} onChange={e => setText(e.target.value)}
              placeholder="契約書のテキストを貼り付け..."
              className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-y bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg font-mono"
              style={{ minHeight: '200px' }}
            />
          </div>
          {err && <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>{err}</div>}
          <AILoadingState
            active={loading}
            brand="prism"
            label="契約書をレビュー中"
            stages={[
              '契約書の全文を読み込み中',
              `${STANCE_LABELS[stance]} の視点で条文を点検`,
              '危ない条文を 赤・黄・青 に振り分け',
              '修正案と交渉ポイントを作成',
            ]}
            skeletonLines={6}
          />
          <div className="flex justify-end">
            <motion.button
              onClick={run} disabled={!text.trim() || loading}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{ background: persona.accentColor, color: '#0a0a0f' }}
              whileTap={!loading ? { scale: 0.98 } : {}}
            >{loading ? '⚖ レビュー中...' : '✨ 危ない条文を 赤・黄・青 で振り分けてもらう'}</motion.button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-fg-muted text-xs">{STANCE_LABELS[result.stance]} 視点</p>
              <p className="text-fg text-2xl font-bold leading-tight">{result.documentTitle}</p>
            </div>
            <span
              className="text-xs px-3 py-1.5 rounded-full font-bold uppercase flex-shrink-0"
              style={{
                background: RISK_COLOR[result.overallRisk] + '25',
                color: RISK_COLOR[result.overallRisk],
                border: `1px solid ${RISK_COLOR[result.overallRisk]}50`,
              }}
            >リスク: {result.overallRisk}</span>
          </div>
          <p className="text-fg/90 text-sm leading-relaxed">{result.summary}</p>
          {result.parties.length > 0 && (
            <div className="rounded-xl p-3" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
              <p className="text-fg-muted text-xs tracking-wider uppercase mb-1">当事者</p>
              <p className="text-fg text-sm">{result.parties.join(' ／ ')}</p>
            </div>
          )}
          {result.keyTerms.length > 0 && (
            <div className="rounded-xl p-3" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
              <p className="text-fg-muted text-xs tracking-wider uppercase mb-2">主要条件</p>
              <div className="space-y-1">
                {result.keyTerms.map((t, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <span className="text-fg-muted flex-shrink-0" style={{ width: 90 }}>{t.label}</span>
                    <span className="text-fg flex-1">{t.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.redFlags.length > 0 && (
            <div className="rounded-xl p-3.5" style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.4)' }}>
              <p className="text-xs tracking-widest uppercase font-semibold mb-2" style={{ color: '#dc2626' }}>🚨 レッドフラッグ</p>
              <ul className="space-y-1">
                {result.redFlags.map((r, i) => (
                  <li key={i} className="text-fg text-sm flex gap-2"><span style={{ color: '#dc2626' }}>!</span><span>{r}</span></li>
                ))}
              </ul>
            </div>
          )}
          {result.clauses.length > 0 && (
            <div>
              <p className="text-fg-muted text-xs tracking-wider uppercase mb-2">条項レビュー ({result.clauses.length}件)</p>
              <div className="space-y-2">
                {result.clauses.map((c, i) => (
                  <div key={i} className="rounded-lg p-3"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderLeftWidth: '3px', borderLeftColor: RISK_COLOR[c.severity] }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: RISK_COLOR[c.severity] + '25', color: RISK_COLOR[c.severity] }}>
                        {c.severity}
                      </span>
                      <span className="text-fg text-sm font-semibold">{c.type}</span>
                    </div>
                    <p className="text-fg/70 text-xs italic mb-1.5 px-2 py-1 rounded" style={{ background: 'var(--surface)' }}>「{c.excerpt}」</p>
                    <p className="text-fg text-sm"><strong className="text-fg-muted">問題:</strong> {c.issue}</p>
                    <p className="text-fg text-sm mt-0.5"><strong className="text-fg-muted">提案:</strong> {c.suggestion}</p>
                    {c.redline && <p className="text-sm mt-1" style={{ color: '#34d399' }}><strong>修正案:</strong> {c.redline}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.missingClauses.length > 0 && <Section title="📝 不足条項" color="#fbbf24" items={result.missingClauses} />}
          {result.negotiationPoints.length > 0 && (
            <div className="rounded-xl p-3.5" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
              <p className="text-xs tracking-widest uppercase font-semibold mb-2" style={{ color: persona.accentColor }}>🤝 交渉ポイント</p>
              <ol className="space-y-1.5">
                {result.negotiationPoints.sort((a, b) => a.priority - b.priority).map((p, i) => (
                  <li key={i} className="text-fg text-sm">
                    <strong style={{ color: persona.accentColor }}>{p.priority}.</strong> {p.point}
                    <p className="text-fg-muted text-xs ml-4 mt-0.5">{p.rationale}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <button onClick={() => setResult(null)} className="text-fg-muted hover:text-fg text-sm">← 別の契約</button>
            <div className="flex gap-2">
              <button
                onClick={() => downloadMd(contractToMarkdown(result), `契約レビュー_${result.documentTitle}_${new Date().toISOString().slice(0,10)}.md`)}
                className="px-4 py-2 rounded-lg text-sm bg-surface-3 border-edge border text-fg hover:bg-surface"
              >📥 .md</button>
              <button
                onClick={() => onSave(`⚖ 契約レビュー: ${result.documentTitle}`, contractToMarkdown(result))}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: persona.accentColor, color: '#0a0a0f' }}
              >📚 ナレッジに保存</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// Financial Panel
// ============================================================
function FinancialPanel({ persona, settings, onSave }: {
  persona: Persona; settings: AppSettings; onSave: (t: string, c: string) => void;
}) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<FinancialAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setErr(null);
    try { const r = await parseFile(file); setText(r.text); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }, []);

  const run = useCallback(async () => {
    if (!text.trim()) { setErr('決算データを入力してください'); return; }
    setLoading(true); setErr(null);
    try {
      const r = await analyzeFinancials(settings, persona, text);
      setResult(r);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [text, persona, settings]);

  return (
    <div className="p-5 space-y-4">
      <StudioIntro
        id="premium-financial"
        accent="#5BA8FF"
        emoji="📊"
        what="決算書・試算表・月次レポート (PDF / Excel / CSV) を投げると、AI が「儲かっている / 危ない」を 5 段階で評価し、改善の打ち手を 3 つ提案してくれる決算分析 AI。"
        tryThis="まず財務ファイルを投げる → 「分析」。3 分で安全度スコアと改善案が返ります。"
        example="月次 P&L → 粗利率 32% (業界平均 28%) / キャッシュ残 2 ヶ月 / 改善案: 固定費 -8%"
        sampleLabel="返ってくるもの"
        samplePreview={(
          <div className="cp-stack-xs" style={{ fontSize: 11, lineHeight: 1.5 }}>
            <div style={{ color: 'var(--fg)', fontWeight: 700 }}>健全度: ★★★☆☆ (3/5)</div>
            <div style={{ color: 'var(--fg-muted)' }}>粗利率 32% (業界平均比 +4 pt)</div>
            <div style={{ color: '#fbbf24', fontWeight: 700 }}>● 注意: キャッシュ残 2 ヶ月</div>
            <div style={{ color: '#5BA8FF', fontWeight: 700, marginTop: 4 }}>→ 改善案 1: 固定費 -8%</div>
            <div style={{ color: '#5BA8FF', fontWeight: 700 }}>→ 改善案 2: 売掛 30→14 日</div>
          </div>
        )}
      />
      {!result ? (
        <>
          <div className="rounded-xl p-3" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
            <p className="text-fg text-sm">📊 P&L / BS / CF / 試算表 / 月次レポート / KPI ダッシュボードなど、財務データなら何でも読み取り可能。SaaS の MRR・LTV/CAC も対応。</p>
          </div>
          <div
            className="rounded-xl p-4 text-center cursor-pointer"
            style={{ background: 'var(--surface-3)', border: '2px dashed var(--border)' }}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            <p className="text-2xl mb-1">📈</p>
            <p className="text-fg text-sm">決算書 (Excel / PDF / Word) をドロップ</p>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md" className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
          <div>
            <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">財務データ {text && `(${text.length}文字)`}</label>
            <textarea
              value={text} onChange={e => setText(e.target.value)}
              placeholder="数値データやレポートを貼り付け..."
              className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-y bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg font-mono"
              style={{ minHeight: '180px' }}
            />
          </div>
          {err && <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>{err}</div>}
          <AILoadingState
            active={loading}
            brand="prism"
            label="決算を分析中"
            stages={[
              '財務データを読み込み中',
              '粗利率・キャッシュ残・回転率を計算',
              '業界平均と比較して健全度を採点',
              '改善案 3 つを優先度付きで作成',
            ]}
            skeletonLines={5}
          />
          <div className="flex justify-end">
            <motion.button
              onClick={run} disabled={!text.trim() || loading}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{ background: persona.accentColor, color: '#0a0a0f' }}
              whileTap={!loading ? { scale: 0.98 } : {}}
            >{loading ? '🧠 分析中...' : '✨ 健全度 ★5 段階 + 改善案 3 つ を出してもらう'}</motion.button>
          </div>
        </>
      ) : (
        <>
          {/* Health Score Hero */}
          <div
            className="rounded-2xl p-5 text-center"
            style={{
              background: `linear-gradient(135deg, ${RISK_COLOR[result.overallHealth]}25, var(--surface-3))`,
              border: `1px solid ${RISK_COLOR[result.overallHealth]}50`,
            }}
          >
            <p className="text-fg-muted text-xs tracking-widest uppercase mb-1">{result.documentTitle} · {result.period}</p>
            <p className="text-7xl font-bold leading-none mb-1" style={{ color: RISK_COLOR[result.overallHealth] }}>
              {result.healthScore}
            </p>
            <p className="text-fg-muted text-sm">/ 100 健全性スコア</p>
            <span
              className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase"
              style={{ background: RISK_COLOR[result.overallHealth] + '25', color: RISK_COLOR[result.overallHealth] }}
            >{result.overallHealth}</span>
          </div>
          <p className="text-fg/90 text-sm leading-relaxed">{result.summary}</p>
          {result.redFlags.length > 0 && (
            <div className="rounded-xl p-3.5" style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.4)' }}>
              <p className="text-xs tracking-widest uppercase font-semibold mb-2" style={{ color: '#dc2626' }}>🚨 緊急対応事項</p>
              <ul className="space-y-1">
                {result.redFlags.map((r, i) => (
                  <li key={i} className="text-fg text-sm flex gap-2"><span style={{ color: '#dc2626' }}>!</span><span>{r}</span></li>
                ))}
              </ul>
            </div>
          )}
          {result.keyMetrics.length > 0 && (
            <div className="rounded-xl p-3.5" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
              <p className="text-xs tracking-widest uppercase font-semibold mb-2" style={{ color: persona.accentColor }}>主要メトリクス</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {result.keyMetrics.map((m, i) => (
                  <div key={i} className="p-2.5 rounded-lg" style={{ background: 'var(--surface)' }}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-fg-muted text-xs">{m.name}</span>
                      <span className="text-xs" style={{ color: m.trend === 'up' ? '#34d399' : m.trend === 'down' ? '#f87171' : '#9ca3af' }}>
                        {m.trend === 'up' ? '↑' : m.trend === 'down' ? '↓' : '→'}
                      </span>
                    </div>
                    <p className="text-fg text-lg font-bold leading-tight" style={{ color: RISK_COLOR[m.evaluation] }}>{m.value}</p>
                    <p className="text-fg-muted text-xs mt-0.5">{m.benchmark}</p>
                    <p className="text-fg/80 text-xs mt-1 italic">{m.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.strengths.length > 0 && <Section title="💪 強み" color="#34d399" items={result.strengths} />}
          {result.weaknesses.length > 0 && <Section title="⚠ 弱み" color="#fbbf24" items={result.weaknesses} />}
          {result.cashFlowOutlook && (
            <div className="rounded-xl p-3.5" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
              <p className="text-xs tracking-widest uppercase font-semibold mb-2" style={{ color: persona.accentColor }}>💰 キャッシュフロー見通し</p>
              <p className="text-fg/90 text-sm leading-relaxed">{result.cashFlowOutlook}</p>
            </div>
          )}
          {result.recommendations.length > 0 && (
            <div className="rounded-xl p-3.5" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
              <p className="text-xs tracking-widest uppercase font-semibold mb-2" style={{ color: '#34d399' }}>🎯 推奨施策</p>
              <div className="space-y-2">
                {result.recommendations.map((r, i) => (
                  <div key={i} className="p-2.5 rounded-lg" style={{ background: 'var(--surface)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: RISK_COLOR[r.priority] + '25', color: RISK_COLOR[r.priority] }}>
                        {r.priority}
                      </span>
                    </div>
                    <p className="text-fg text-sm font-medium">{r.action}</p>
                    <p className="text-fg-muted text-xs mt-0.5">期待効果: {r.impact}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.benchmarks.length > 0 && (
            <div className="rounded-xl p-3.5" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
              <p className="text-xs tracking-widest uppercase font-semibold mb-2" style={{ color: persona.accentColor }}>📊 ベンチマーク</p>
              <div className="space-y-1.5">
                {result.benchmarks.map((b, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="text-fg-muted flex-1">{b.metric}</span>
                    <span className="text-fg font-semibold">自社 {b.ours}</span>
                    <span className="text-fg-muted text-xs">業界 {b.industry}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <button onClick={() => setResult(null)} className="text-fg-muted hover:text-fg text-sm">← 別の決算</button>
            <div className="flex gap-2">
              <button
                onClick={() => downloadMd(financialToMarkdown(result), `財務分析_${result.documentTitle}_${new Date().toISOString().slice(0,10)}.md`)}
                className="px-4 py-2 rounded-lg text-sm bg-surface-3 border-edge border text-fg hover:bg-surface"
              >📥 .md</button>
              <button
                onClick={() => onSave(`📊 財務分析: ${result.documentTitle}`, financialToMarkdown(result))}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: persona.accentColor, color: '#0a0a0f' }}
              >📚 ナレッジに保存</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Section({ title, color, items }: { title: string; color: string; items: string[] }) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
      <p className="text-xs tracking-widest uppercase font-semibold mb-2" style={{ color }}>{title}</p>
      <ul className="space-y-1.5">
        {items.map((s, i) => (
          <li key={i} className="text-fg text-sm flex gap-2 leading-relaxed">
            <span style={{ color }}>·</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function downloadMd(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename.replace(/[\\/:*?"<>|]/g, '_');
  a.click();
  URL.revokeObjectURL(url);
}
