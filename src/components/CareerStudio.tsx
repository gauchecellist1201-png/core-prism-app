// ============================================================
// CareerStudio — 「あなたの 5 年後のキャリア レポート」を AI が作る Studio
//
// オーナー指示 (2026-06-04 第 22 波 CCCC):
//   業種 / 経験年数 / 目標 を 3 問だけ聞いて、5 年後の
//   キャリア / 収入 / 学ぶべきスキル を CFO / CDS の AI 視点で 1 枚に。
//
// 設計:
//   - Step 1: 3 問の入力 (業種ピル / 経験年数 / 目標 textarea)
//   - Step 2: AI 生成 (callAiWithFallback) — JSON で 5 セクション返す
//   - Step 3: レポート表示 + コピー / ダウンロード (.md)
// ============================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ArrowRight, Download, Copy, Check, BarChart3, TrendingUp, GraduationCap, Briefcase, Heart } from 'lucide-react';
import { callAiWithFallback } from '../lib/aiFallbackChain';
import ThinkingIndicator from './ThinkingIndicator';

interface Props {
  open: boolean;
  onClose: () => void;
  defaultIndustry?: string;
}

interface CareerReport {
  summary: string;
  career: { now: string; in5y: string; bridge: string };
  income: { now: string; in5y: string; bridge: string };
  skills: Array<{ skill: string; why: string; how: string }>;
  risks: string[];
  one_action: string;
}

const INDUSTRIES = [
  { id: 'sme', emoji: '🏢', label: '中小企業オーナー' },
  { id: 'realestate', emoji: '🏠', label: '不動産 / 金融' },
  { id: 'consulting', emoji: '🧠', label: 'コンサル' },
  { id: 'solo', emoji: '👤', label: '個人事業主' },
  { id: 'creator', emoji: '🎨', label: 'クリエイター' },
  { id: 'freelance', emoji: '⚡', label: 'フリーランスプロ' },
  { id: 'other', emoji: '✨', label: 'その他' },
];

const YEARS = [
  { id: '0-1', label: '0-1 年' },
  { id: '2-5', label: '2-5 年' },
  { id: '6-10', label: '6-10 年' },
  { id: '11-20', label: '11-20 年' },
  { id: '20+', label: '20 年以上' },
];

const SYSTEM = `あなたは CORE Prism の CFO (財務) と CDS (データサイエンス) の AI 役員の合議体です。
ユーザーの「業種」「経験年数」「目標」から、リアルな 5 年後のキャリア予想レポートを作ります。

ルール:
- 数字には根拠を一文添えて (出典の代わりに「同業中央値」「業界平均」など妥当な前置きで)
- 過度に楽観しない / 過度に悲観しない
- スキル提案は具体名 (例: 「機械学習」より「PyTorch + LangChain」)
- リスクは現実的に
- 「明日からまずやる 1 つ」を必ず最後に

出力は厳密に下記 JSON 形式 のみ (前置きや説明は書かない):
{
  "summary": "全体の 2-3 行 要約",
  "career": {
    "now": "現状の役割を 1 文で",
    "in5y": "5 年後にあり得る役割を 1-2 文で",
    "bridge": "現状 → 5 年後 の橋渡し 1 文"
  },
  "income": {
    "now": "現状の年収 レンジ + 妥当性",
    "in5y": "5 年後の年収 レンジ + 妥当性",
    "bridge": "増える要因 / 減るリスク"
  },
  "skills": [
    { "skill": "...", "why": "なぜ重要", "how": "学び方 (書籍 / コミュニティ / 副業)" }
  ],
  "risks": ["..."],
  "one_action": "明日まずやる 1 つ"
}`;

export default function CareerStudio({ open, onClose, defaultIndustry }: Props) {
  const [step, setStep] = useState<'q' | 'busy' | 'report' | 'error'>('q');
  const [industry, setIndustry] = useState<string>(defaultIndustry || 'sme');
  const [years, setYears] = useState<string>('2-5');
  const [goal, setGoal] = useState('');
  const [report, setReport] = useState<CareerReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setStep('busy');
    setErr(null);
    try {
      const industryLabel = INDUSTRIES.find(x => x.id === industry)?.label || industry;
      const yearsLabel = YEARS.find(x => x.id === years)?.label || years;
      const userMsg = [
        `業種: ${industryLabel}`,
        `経験年数: ${yearsLabel}`,
        `5 年後に達成したいこと: ${goal.trim() || '(未入力)'}`,
      ].join('\n');
      const resp = await callAiWithFallback({
        model: 'claude-haiku-4-5',
        max_tokens: 1800,
        system: SYSTEM,
        messages: [{ role: 'user', content: userMsg }],
      });
      const raw = resp.content?.[0]?.text || '';
      // JSON 抽出
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error(`AI から JSON 形式 が 返りませんでした (回答 ${raw.length} 字 — 「もう一度生成」 で 再試行)`);
      let parsed: CareerReport;
      try {
        parsed = JSON.parse(m[0]) as CareerReport;
      } catch (pe) {
        throw new Error(`AI の JSON が 壊れて います (${(pe as Error).message}) — 「もう一度生成」 を 押して ください`);
      }
      setReport(parsed);
      setStep('report');
    } catch (e) {
      setErr((e as Error)?.message || '生成に失敗しました');
      setStep('error');
    }
  };

  const toMarkdown = (r: CareerReport): string => {
    const lines: string[] = [];
    const ind = INDUSTRIES.find(x => x.id === industry)?.label || industry;
    const yr = YEARS.find(x => x.id === years)?.label || years;
    lines.push(`# あなたの 5 年後 キャリア レポート`);
    lines.push('');
    lines.push(`- 業種: ${ind}`);
    lines.push(`- 経験: ${yr}`);
    lines.push(`- 目標: ${goal || '(未入力)'}`);
    lines.push(`- 生成日時: ${new Date().toISOString()}`);
    lines.push('');
    lines.push(`## サマリ`);
    lines.push(r.summary);
    lines.push('');
    lines.push(`## キャリア`);
    lines.push(`- 今: ${r.career.now}`);
    lines.push(`- 5 年後: ${r.career.in5y}`);
    lines.push(`- 橋渡し: ${r.career.bridge}`);
    lines.push('');
    lines.push(`## 年収`);
    lines.push(`- 今: ${r.income.now}`);
    lines.push(`- 5 年後: ${r.income.in5y}`);
    lines.push(`- 増減要因: ${r.income.bridge}`);
    lines.push('');
    lines.push(`## 学ぶべきスキル`);
    for (const s of r.skills) lines.push(`- **${s.skill}** — ${s.why} / ${s.how}`);
    lines.push('');
    lines.push(`## リスク`);
    for (const x of r.risks) lines.push(`- ${x}`);
    lines.push('');
    lines.push(`## 明日からの 1 アクション`);
    lines.push(`> ${r.one_action}`);
    return lines.join('\n');
  };

  const copyReport = () => {
    if (!report) return;
    navigator.clipboard?.writeText(toMarkdown(report));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadReport = () => {
    if (!report) return;
    const blob = new Blob([toMarkdown(report)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `career-report_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 110,
            background: 'rgba(0,0,12,0.7)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px 12px',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(680px, 100%)',
              maxHeight: 'calc(100vh - 48px)',
              background: 'rgba(15,14,27,0.97)',
              border: '1px solid rgba(167,139,250,0.4)',
              borderRadius: 18,
              color: '#fff',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: 'var(--cp-elev-4)',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 18px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              background: 'linear-gradient(180deg, rgba(167,139,250,0.12), transparent)',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'linear-gradient(135deg, #06B6D4, #A78BFA)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <BarChart3 size={16} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.62rem', letterSpacing: '0.22em', color: '#A78BFA', fontWeight: 800 }}>CFO + CDS</div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>5 年後のキャリア レポート</div>
              </div>
              <button onClick={onClose} aria-label="閉じる" style={{
                width: 30, height: 30, borderRadius: 15,
                background: 'rgba(255,255,255,0.08)', border: 'none',
                color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><X size={14} /></button>
            </div>

            <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>
              {step === 'q' && (
                <>
                  {/* 3 秒でわかる説明 + サンプル出力 — 初見の人が「何が出るか」を触らず理解できる */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(167,139,250,0.18), rgba(167,139,250,0.05) 60%)',
                    border: '1px solid rgba(167,139,250,0.35)',
                    borderRadius: 12, padding: '12px 14px', marginBottom: 18,
                  }}>
                    <p style={{ fontSize: '0.86rem', fontWeight: 700, color: '#fff', lineHeight: 1.5, margin: 0 }}>
                      🔮 下の 3 問に答えるだけ。AI が <span style={{ color: '#C4B5FD' }}>あなたの 5 年後の「年収・役割・学ぶべきスキル」</span>を 1 枚のレポートにします。
                    </p>
                    <p style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, margin: '6px 0 0' }}>
                      例: 不動産 10 年 → <span style={{ color: 'rgba(255,255,255,0.85)' }}>「5 年後は独立して年商 8,000 万円。今学ぶべきは AI 査定 × LINE 集客」</span>のように出ます。
                    </p>
                  </div>

                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginBottom: 8 }}>
                    1. 業種は?
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6, marginBottom: 16 }}>
                    {INDUSTRIES.map(it => (
                      <button
                        key={it.id}
                        onClick={() => setIndustry(it.id)}
                        style={{
                          padding: '10px 12px', borderRadius: 10,
                          background: industry === it.id ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${industry === it.id ? '#A78BFA' : 'rgba(255,255,255,0.1)'}`,
                          color: '#fff', cursor: 'pointer',
                          fontSize: 13, fontWeight: 700,
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: 16 }}>{it.emoji}</span> {it.label}
                      </button>
                    ))}
                  </div>

                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginBottom: 8 }}>
                    2. その業種で 何年?
                  </label>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                    {YEARS.map(y => (
                      <button
                        key={y.id}
                        onClick={() => setYears(y.id)}
                        style={{
                          padding: '6px 14px', borderRadius: 999,
                          background: years === y.id ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${years === y.id ? '#A78BFA' : 'rgba(255,255,255,0.1)'}`,
                          color: '#fff', cursor: 'pointer',
                          fontSize: 12, fontWeight: 700,
                        }}
                      >{y.label}</button>
                    ))}
                  </div>

                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginBottom: 8 }}>
                    3. 5 年後 に達成したいこと (1〜2 行)
                  </label>
                  <textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="例: 自分の会社を作って 年商 1 億 / リモートで世界を回りながら働きたい"
                    rows={3}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      padding: '10px 12px',
                      color: '#fff',
                      fontSize: '0.88rem',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  />

                  <button
                    onClick={generate}
                    style={{
                      marginTop: 16, width: '100%',
                      padding: '12px 0', borderRadius: 12,
                      background: 'linear-gradient(135deg, #06B6D4, #A78BFA, #F472B6)',
                      color: '#fff', border: 'none',
                      fontSize: '0.95rem', fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      boxShadow: '0 10px 22px rgba(167,139,250,0.4)',
                    }}
                  >
                    <Sparkles size={14} /> AI に作ってもらう <ArrowRight size={14} />
                  </button>
                </>
              )}

              {step === 'busy' && (
                <ThinkingIndicator
                  accent="#A78BFA"
                  onRetry={generate}
                  subtitle="CFO（財務）と CDS（データ）の AI 役員が合議しています"
                  messages={[
                    '🏢 あなたの業種と経験を読み込んでいます…',
                    '📊 同業の年収・キャリアの中央値を調べています…',
                    '🔭 5 年後にあり得る役割を描いています…',
                    '📚 いま学ぶべきスキルを選んでいます…',
                    '⚠️ 現実的なリスクを洗い出しています…',
                    '✍️ 明日からの一手にまとめています…',
                  ]}
                />
              )}

              {step === 'error' && (
                <div style={{
                  padding: '14px 16px',
                  background: 'rgba(220,38,38,0.1)',
                  border: '1px solid rgba(220,38,38,0.3)',
                  borderRadius: 12, color: '#fca5a5',
                  fontSize: '0.85rem', lineHeight: 1.7,
                }}>
                  <strong>生成に失敗しました</strong><br />
                  {err || '原因不明のエラー'}
                  <button onClick={() => setStep('q')} style={{
                    display: 'block', marginTop: 12,
                    padding: '8px 16px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.08)',
                    border: 'none', color: '#fff', cursor: 'pointer',
                    fontSize: 12, fontWeight: 700,
                  }}>もう一度試す</button>
                </div>
              )}

              {step === 'report' && report && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Section icon={<Sparkles size={14} color="#A78BFA" />} title="サマリ" body={report.summary} />
                  <Compare icon={<Briefcase size={14} color="#60A5FA" />} title="キャリア" now={report.career.now} in5y={report.career.in5y} bridge={report.career.bridge} accent="#60A5FA" />
                  <Compare icon={<TrendingUp size={14} color="#34D399" />} title="年収" now={report.income.now} in5y={report.income.in5y} bridge={report.income.bridge} accent="#34D399" />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <GraduationCap size={14} color="#FBBF24" />
                      <div style={{ fontSize: 13, fontWeight: 800 }}>学ぶべきスキル</div>
                    </div>
                    {report.skills.map((s, i) => (
                      <div key={i} style={{
                        padding: '10px 12px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(251,191,36,0.2)',
                        borderRadius: 10, marginBottom: 6,
                      }}>
                        <div style={{ fontWeight: 800, fontSize: 13, color: '#FBBF24', marginBottom: 2 }}>{s.skill}</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>{s.why}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 3, lineHeight: 1.6 }}>📚 {s.how}</div>
                      </div>
                    ))}
                  </div>
                  {report.risks?.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Heart size={14} color="#F472B6" />
                        <div style={{ fontSize: 13, fontWeight: 800 }}>リスク</div>
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
                        {report.risks.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                  <div style={{
                    padding: '12px 14px',
                    background: 'rgba(52,211,153,0.1)',
                    border: '1px solid rgba(52,211,153,0.4)',
                    borderRadius: 12,
                  }}>
                    <div style={{ fontSize: 11, color: '#34D399', fontWeight: 800, letterSpacing: '0.1em', marginBottom: 6 }}>
                      ✓ 明日まずやる 1 つ
                    </div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, lineHeight: 1.6 }}>{report.one_action}</div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={copyReport} style={{
                      flex: 1, padding: '10px 0', borderRadius: 10,
                      background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff', cursor: 'pointer',
                      fontSize: 12, fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    }}>
                      {copied ? <><Check size={12} /> コピー済</> : <><Copy size={12} /> Markdown コピー</>}
                    </button>
                    <button onClick={downloadReport} style={{
                      flex: 1, padding: '10px 0', borderRadius: 10,
                      background: 'linear-gradient(135deg, #06B6D4, #A78BFA)',
                      border: 'none', color: '#fff', cursor: 'pointer',
                      fontSize: 12, fontWeight: 800,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    }}>
                      <Download size={12} /> .md でダウンロード
                    </button>
                  </div>
                  <button onClick={() => { setStep('q'); setReport(null); }} style={{
                    background: 'transparent', border: 'none',
                    color: 'rgba(255,255,255,0.55)', fontSize: 11,
                    cursor: 'pointer', marginTop: 4,
                  }}>← もう一度別の条件で作る</button>
                </div>
              )}
            </div>

            <style>{`@keyframes core-spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div style={{
      padding: '12px 14px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {icon}
        <div style={{ fontSize: 12, fontWeight: 800 }}>{title}</div>
      </div>
      <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.75 }}>{body}</div>
    </div>
  );
}

function Compare({ icon, title, now, in5y, bridge, accent }: { icon: React.ReactNode; title: string; now: string; in5y: string; bridge: string; accent: string }) {
  return (
    <div style={{
      padding: '12px 14px',
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${accent}33`,
      borderRadius: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {icon}
        <div style={{ fontSize: 12, fontWeight: 800 }}>{title}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 2 }}>今</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>{now}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: accent, fontWeight: 800, marginBottom: 2 }}>5 年後</div>
          <div style={{ fontSize: 12, color: '#fff', fontWeight: 700, lineHeight: 1.6 }}>{in5y}</div>
        </div>
      </div>
      <div style={{
        marginTop: 4,
        padding: '6px 10px',
        background: `${accent}10`,
        borderLeft: `2px solid ${accent}`,
        borderRadius: '0 8px 8px 0',
        fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6,
      }}>
        → {bridge}
      </div>
    </div>
  );
}
