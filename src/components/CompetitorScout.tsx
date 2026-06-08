// ============================================================
// CompetitorScout — 業種を指定するだけで「競合 5 社 + URL + 強み」
//
// オーナー指示 (2026-06-04 第 25 波 MMMM):
//   BenchmarkStudio とは別の軽量ツール。業種 (任意 自由記述) を入れて
//   AI が日本国内の代表的な競合 5 社を提案。
// ============================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Sparkles, ExternalLink, Copy, Check, Download, ArrowRight } from 'lucide-react';
import { callAiWithFallback } from '../lib/aiFallbackChain';
import ThinkingIndicator from './ThinkingIndicator';

interface Props {
  open: boolean;
  onClose: () => void;
  defaultIndustry?: string;
}

interface Competitor {
  name: string;
  url: string;
  strength: string;
}

const SYSTEM = `あなたは日本のビジネス市場の専門 リサーチャーです。
ユーザーが指定した「業種 / 領域」に対して、日本国内で代表的な競合企業を 5 社 リストアップしてください。

ルール:
1. 上場/未上場どちらでも可。ただし日本で実際にサービス提供している会社のみ。
2. 各社につき:
   - name: 会社名 (商号 + ブランド名)
   - url: 公式 URL (https://)
   - strength: 強み 1 行 (50 字以内、具体的に)
3. 並び順: ユーザーが意識すべき重要度の高い順 (規模 / 認知度 / 直接競合度)
4. 不明 / 推測の場合は出さない (5 社未満でも可)。事実に忠実に。

出力は JSON のみ:
{ "competitors": [ { "name": "...", "url": "...", "strength": "..." }, ... ] }`;

export default function CompetitorScout({ open, onClose, defaultIndustry }: Props) {
  const [industry, setIndustry] = useState(defaultIndustry || '');
  const [step, setStep] = useState<'q' | 'busy' | 'list' | 'error'>('q');
  const [list, setList] = useState<Competitor[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const run = async () => {
    const q = industry.trim();
    if (!q) return;
    setStep('busy');
    setErr(null);
    try {
      const resp = await callAiWithFallback({
        model: 'claude-haiku-4-5',
        max_tokens: 1200,
        system: SYSTEM,
        messages: [{ role: 'user', content: `業種 / 領域: ${q}\n\n上記に対する 日本国内の競合 5 社 を リストしてください。` }],
      });
      const raw = resp.content?.[0]?.text || '';
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('AI から JSON が返ってきませんでした');
      const parsed = JSON.parse(m[0]) as { competitors?: Competitor[] };
      const arr = Array.isArray(parsed.competitors) ? parsed.competitors.slice(0, 5) : [];
      if (arr.length === 0) throw new Error('該当する競合が見つかりませんでした');
      setList(arr);
      setStep('list');
    } catch (e) {
      setErr((e as Error)?.message || '取得に失敗しました');
      setStep('error');
    }
  };

  const toMd = (): string => {
    const lines: string[] = [];
    lines.push(`# 競合 5 社 リスト — ${industry}`);
    lines.push('');
    lines.push(`生成日時: ${new Date().toISOString()}`);
    lines.push('');
    list.forEach((c, i) => {
      lines.push(`## ${i + 1}. ${c.name}`);
      lines.push(`- URL: ${c.url}`);
      lines.push(`- 強み: ${c.strength}`);
      lines.push('');
    });
    return lines.join('\n');
  };

  const copyAll = () => {
    navigator.clipboard?.writeText(toMd());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const blob = new Blob([toMd()], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `competitors_${industry.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30)}_${new Date().toISOString().slice(0, 10)}.md`;
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
              width: 'min(560px, 100%)',
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
              padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 10,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              background: 'linear-gradient(180deg, rgba(167,139,250,0.12), transparent)',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'linear-gradient(135deg, #F472B6, #A78BFA)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><Search size={16} color="#fff" /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.62rem', letterSpacing: '0.22em', color: '#F472B6', fontWeight: 800 }}>CSO + CDS</div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>競合スカウト</div>
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
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginBottom: 8 }}>
                    あなたの 業種 / 領域 を 1 行で
                  </label>
                  <input
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') run(); }}
                    placeholder="例: クラウド型 給与計算 SaaS / 都内 セルフ脱毛サロン"
                    autoFocus
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      padding: '10px 12px',
                      color: '#fff',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                      marginBottom: 14,
                    }}
                  />
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 14, lineHeight: 1.7 }}>
                    💡 業種だけでなく「地域 + 業態」 でも検索できます<br />
                    (例: 福岡 高単価 美容室 / 中小企業向け 経理代行)
                  </div>
                  <button
                    onClick={run}
                    disabled={!industry.trim()}
                    style={{
                      width: '100%', padding: '12px 0', borderRadius: 12,
                      background: !industry.trim() ? 'rgba(255,255,255,0.1)'
                        : 'linear-gradient(135deg, #F472B6, #A78BFA)',
                      color: '#fff', border: 'none',
                      fontSize: '0.95rem', fontWeight: 800,
                      cursor: !industry.trim() ? 'not-allowed' : 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      boxShadow: industry.trim() ? '0 10px 22px rgba(244,114,182,0.35)' : 'none',
                    }}
                  >
                    <Sparkles size={14} /> 5 社を AI に出してもらう <ArrowRight size={14} />
                  </button>
                </>
              )}

              {step === 'busy' && (
                <ThinkingIndicator
                  accent="#F472B6"
                  onRetry={run}
                  subtitle={industry.trim() ? `「${industry.trim()}」の市場を調べています` : '市場を調べています'}
                  messages={[
                    '🔍 業種にあう市場を絞り込んでいます…',
                    '🏢 日本国内の代表的な会社を集めています…',
                    '⚖️ 直接ぶつかる競合を見分けています…',
                    '💪 各社の強みを 1 行にまとめています…',
                    '📊 意識すべき順に並べています…',
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
                  <strong>取得に失敗</strong><br />
                  {err || '原因不明のエラー'}
                  <button onClick={() => setStep('q')} style={{
                    display: 'block', marginTop: 12,
                    padding: '8px 16px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.08)',
                    border: 'none', color: '#fff', cursor: 'pointer',
                    fontSize: 12, fontWeight: 700,
                  }}>条件を変えて再試行</button>
                </div>
              )}

              {step === 'list' && (
                <>
                  <div style={{
                    fontSize: 11, color: 'rgba(255,255,255,0.55)',
                    marginBottom: 12, padding: '6px 10px',
                    background: 'rgba(255,255,255,0.04)', borderRadius: 8,
                  }}>
                    📌 業種: <strong style={{ color: '#fff' }}>{industry}</strong> · {list.length} 社
                  </div>

                  {list.map((c, i) => (
                    <div key={i} style={{
                      padding: '12px 14px', borderRadius: 12,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(167,139,250,0.2)',
                      marginBottom: 8,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: 11,
                          background: 'linear-gradient(135deg, #F472B6, #A78BFA)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 800,
                          flexShrink: 0,
                        }}>{i + 1}</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, flex: 1, minWidth: 0, wordBreak: 'break-all' }}>
                          {c.name}
                        </div>
                      </div>
                      <a href={c.url} target="_blank" rel="noopener noreferrer" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        fontSize: 11.5, color: '#A78BFA', textDecoration: 'none',
                        fontFamily: 'Menlo, monospace', wordBreak: 'break-all',
                        marginBottom: 6,
                      }}>
                        <ExternalLink size={11} /> {c.url}
                      </a>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                        💪 {c.strength}
                      </div>
                    </div>
                  ))}

                  <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                    <button onClick={copyAll} style={{
                      flex: 1, padding: '10px 0', borderRadius: 10,
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff', cursor: 'pointer',
                      fontSize: 12, fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    }}>{copied ? <><Check size={11} /> コピー済</> : <><Copy size={11} /> コピー</>}</button>
                    <button onClick={download} style={{
                      flex: 1, padding: '10px 0', borderRadius: 10,
                      background: 'linear-gradient(135deg, #F472B6, #A78BFA)',
                      border: 'none', color: '#fff', cursor: 'pointer',
                      fontSize: 12, fontWeight: 800,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    }}><Download size={11} /> .md でダウンロード</button>
                  </div>
                  <button onClick={() => { setStep('q'); setList([]); }} style={{
                    background: 'transparent', border: 'none',
                    color: 'rgba(255,255,255,0.55)', fontSize: 11,
                    cursor: 'pointer', marginTop: 8,
                  }}>← 別の業種で やり直す</button>
                </>
              )}
            </div>

            <style>{`@keyframes core-spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
