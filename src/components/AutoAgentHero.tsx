// ============================================================
// CORE Auto Agent Hero
// 「Prism / Iris があなたのために考えた、次の一手」
// ユーザーは Yes / もう少しこっち寄りで / 却下 で答えるだけ。
// やる → AI が裏で実行 → 結果を見せる。
// ============================================================
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, AlertCircle, Mail, TrendingUp, Image as ImageIcon,
  ClipboardList, Lightbulb, Target, HeartPulse,
  Check, X, MessageSquare, Loader2, RefreshCw, Copy, ChevronDown,
} from 'lucide-react';
import { generateSuggestions, executeSuggestion, refineSuggestion, clearSuggestionCache, type Suggestion, type AgentContext } from '../lib/autoAgent';

const CATEGORY_META = {
  urgent:  { Icon: AlertCircle,   label: '緊急',   gradient: ['#EF4444', '#F87171'] },
  growth:  { Icon: TrendingUp,    label: '伸ばす', gradient: ['#10B981', '#34D399'] },
  content: { Icon: ImageIcon,     label: '創作',   gradient: ['#E1306C', '#F77737'] },
  admin:   { Icon: ClipboardList, label: '管理',   gradient: ['#6366F1', '#818CF8'] },
  insight: { Icon: Lightbulb,     label: '気づき', gradient: ['#FBBF24', '#FCD34D'] },
  sales:   { Icon: Mail,          label: '営業',   gradient: ['#2E6FFF', '#60A5FA'] },
  health:  { Icon: HeartPulse,    label: '健康',   gradient: ['#EC4899', '#F472B6'] },
} as const;

interface Props {
  ctx: AgentContext;
  /** Iris LP gradient or Prism prism gradient */
  brandGradient?: string;
  /** "PRISM" or "IRIS" 表示用 */
  brandLabel?: string;
  /** タブ遷移ハンドラ */
  onJump?: (tab: string) => void;
  /** カードのテーマ (white card on dark / dark card on light) */
  theme?: 'light' | 'dark';
}

export default function AutoAgentHero({
  ctx,
  brandGradient = 'linear-gradient(135deg, #E1306C 0%, #F77737 50%, #FBBF24 100%)',
  brandLabel = ctx.brand === 'prism' ? 'PRISM' : 'IRIS',
  onJump,
  theme = 'light',
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refineInput, setRefineInput] = useState<string>('');
  const [refining, setRefining] = useState(false);

  const isDark = theme === 'dark';
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.75)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(225, 48, 108, 0.18)';
  const textPrimary = isDark ? '#fff' : '#1F1A2E';
  const textSecondary = isDark ? 'rgba(255,255,255,0.65)' : '#5A4570';

  // 初回ロード
  const load = useCallback(async (force = false) => {
    if (force) clearSuggestionCache(ctx.brand);
    setLoading(true); setError('');
    try {
      const list = await generateSuggestions(ctx);
      setSuggestions(list);
    } catch (e: any) {
      setError(e?.message || '提案の生成に失敗しました');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.brand, ctx.user, ctx.persona]);

  useEffect(() => { void load(); }, [load]);

  const updateOne = (id: string, patch: Partial<Suggestion>) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const onExecute = async (s: Suggestion) => {
    updateOne(s.id, { status: 'running' });
    try {
      const result = await executeSuggestion(s, ctx);
      updateOne(s.id, { status: 'done', result });
      setExpandedId(s.id);
    } catch (e: any) {
      updateOne(s.id, { status: 'idle' });
      setError(e?.message || '実行に失敗しました');
    }
  };

  const onRefine = async (s: Suggestion) => {
    if (!refineInput.trim()) return;
    setRefining(true);
    try {
      const patched = await refineSuggestion(s, refineInput, ctx);
      updateOne(s.id, {
        title: patched.title || s.title,
        why: patched.why || s.why,
        actionPrompt: patched.actionPrompt || s.actionPrompt,
        status: 'refined',
      });
      setRefineInput('');
    } catch (e: any) {
      setError(e?.message || '修正に失敗しました');
    } finally {
      setRefining(false);
    }
  };

  const onDismiss = (id: string) => updateOne(id, { status: 'dismissed' });

  const visible = suggestions.filter(s => s.status !== 'dismissed');

  return (
    <div style={{
      position: 'relative',
      padding: '1.5rem 1.3rem',
      background: isDark
        ? 'linear-gradient(135deg, rgba(225,48,108,0.10), rgba(46,111,255,0.06))'
        : `linear-gradient(135deg, rgba(225,48,108,0.06), rgba(251,191,36,0.04) 60%, transparent)`,
      border: `1px solid ${isDark ? 'rgba(225,48,108,0.25)' : 'rgba(225,48,108,0.18)'}`,
      borderRadius: 22,
      overflow: 'hidden',
    }}>
      {/* 装飾オーブ */}
      <div style={{
        position: 'absolute', top: -50, right: -50,
        width: 200, height: 200, borderRadius: '50%',
        background: `radial-gradient(circle, ${isDark ? '#E1306C55' : '#FFB8D666'} 0%, transparent 70%)`,
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />

      {/* ヘッダ */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: '0.9rem' }}>
        <div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 4 }}>
            <Sparkles size={10} style={{ color: '#E1306C' }} />
            <span style={{
              fontSize: 10, letterSpacing: '0.3em', fontWeight: 800,
              color: '#E1306C', textTransform: 'uppercase',
            }}>
              {brandLabel} が考えた次の一手
            </span>
          </div>
          <h2 style={{
            margin: 0,
            fontFamily: '"Cinzel", "Noto Serif JP", serif', fontStyle: 'italic',
            fontSize: 'clamp(1.5rem, 4.5vw, 2rem)',
            fontWeight: 500, lineHeight: 1.15,
            background: brandGradient,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.01em',
          }}>
            今日やること、3 つ用意しました。
          </h2>
          <p style={{
            margin: '0.3rem 0 0',
            fontSize: 12.5, color: textSecondary,
            fontFamily: '"Noto Sans JP", sans-serif', lineHeight: 1.6,
          }}>
            タップでそのまま実行。違えば「もっとこうして」と言うだけ。
          </p>
        </div>
        <button onClick={() => load(true)} disabled={loading} title="再生成" style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: textSecondary, padding: 6, borderRadius: 999,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <RefreshCw size={15} className={loading ? 'auto-agent-spin' : ''} />
        </button>
      </div>

      {/* ローディング / エラー / 空 */}
      {loading && suggestions.length === 0 && (
        <div style={{
          display: 'grid', gap: 10,
          padding: '1rem 0',
        }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              height: 78, borderRadius: 14,
              background: `linear-gradient(90deg, ${cardBg}, ${cardBg} 50%, transparent)`,
              border: `1px solid ${cardBorder}`,
              animation: 'auto-agent-pulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      )}

      {error && !suggestions.length && (
        <div style={{
          padding: '0.7rem 0.85rem',
          background: 'rgba(239, 68, 68, 0.12)',
          color: '#DC2626', borderRadius: 12,
          fontSize: 12.5, marginBottom: 10,
          display: 'flex', gap: 6, alignItems: 'center',
        }}>
          <AlertCircle size={14} /> {error}
          <button onClick={() => load(true)} style={{
            marginLeft: 'auto', background: 'transparent', border: '1px solid currentColor',
            color: 'inherit', padding: '3px 9px', borderRadius: 6,
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}>再試行</button>
        </div>
      )}

      {/* サジェスト カード群 */}
      <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: 8 }}>
        <AnimatePresence>
          {visible.map((s) => {
            const meta = CATEGORY_META[s.category];
            const Icon = meta.Icon;
            const expanded = expandedId === s.id;
            const running = s.status === 'running';
            const done = s.status === 'done';

            return (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: -100, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                style={{
                  position: 'relative',
                  background: cardBg,
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${cardBorder}`,
                  borderRadius: 16,
                  overflow: 'hidden',
                  boxShadow: done ? '0 8px 24px rgba(16, 185, 129, 0.18)' : '0 4px 14px rgba(225, 48, 108, 0.06)',
                }}>
                {/* メイン情報 */}
                <button
                  onClick={() => setExpandedId(expanded ? null : s.id)}
                  style={{
                    width: '100%', display: 'grid',
                    gridTemplateColumns: '36px 1fr auto', gap: 12,
                    padding: '0.8rem 1rem',
                    background: 'transparent', border: 'none',
                    cursor: 'pointer', textAlign: 'left',
                    color: textPrimary, fontFamily: 'inherit',
                  }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: `linear-gradient(135deg, ${meta.gradient[0]}, ${meta.gradient[1]})`,
                    color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 2,
                  }}>
                    <Icon size={15} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      display: 'flex', gap: 5, alignItems: 'center', marginBottom: 3, flexWrap: 'wrap',
                    }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: '1.5px 6px',
                        borderRadius: 999,
                        background: `${meta.gradient[0]}22`, color: meta.gradient[0],
                        letterSpacing: '0.1em',
                      }}>{meta.label.toUpperCase()}</span>
                      {Array.from({ length: s.priority }).map((_, i) => (
                        <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: meta.gradient[0], opacity: 0.6 }} />
                      ))}
                      {done && (
                        <span style={{
                          fontSize: 9, fontWeight: 800, padding: '1.5px 6px',
                          borderRadius: 999, background: '#10B98122', color: '#059669',
                          letterSpacing: '0.1em',
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                        }}>
                          <Check size={9} /> 完了
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.3, marginBottom: 3 }}>
                      {s.title}
                    </div>
                    <div style={{ fontSize: 11.5, color: textSecondary, lineHeight: 1.5 }}>
                      {s.why}
                    </div>
                  </div>
                  <ChevronDown size={16} style={{
                    color: textSecondary, marginTop: 8, flexShrink: 0,
                    transform: expanded ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                  }} />
                </button>

                {/* 展開部 (アクションボタン or 結果) */}
                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ padding: '0 1rem 1rem', borderTop: `1px solid ${cardBorder}`, paddingTop: 12 }}>

                        {/* 結果表示 */}
                        {s.result && (
                          <div style={{
                            padding: '0.8rem 0.95rem',
                            background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.55)',
                            borderRadius: 12, marginBottom: 10,
                            fontSize: 13, lineHeight: 1.7,
                            color: textPrimary,
                            whiteSpace: 'pre-wrap',
                            maxHeight: 320, overflowY: 'auto',
                            border: `1px solid ${cardBorder}`,
                          }}>
                            {s.result}
                            <button
                              onClick={() => navigator.clipboard?.writeText(s.result || '')}
                              style={{
                                marginTop: 10, padding: '5px 11px',
                                background: 'transparent', border: `1px solid ${cardBorder}`,
                                color: textPrimary, borderRadius: 6,
                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                display: 'inline-flex', gap: 4, alignItems: 'center',
                              }}>
                              <Copy size={10} /> コピー
                            </button>
                          </div>
                        )}

                        {/* アクションボタン群 */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {!done && (
                            <button
                              onClick={() => onExecute(s)}
                              disabled={running}
                              style={{
                                flex: 1, minWidth: 120,
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                padding: '0.65rem 1rem',
                                background: running
                                  ? `linear-gradient(135deg, ${meta.gradient[0]}aa, ${meta.gradient[1]}aa)`
                                  : `linear-gradient(135deg, ${meta.gradient[0]}, ${meta.gradient[1]})`,
                                color: '#fff', border: 'none', borderRadius: 999,
                                fontSize: 13, fontWeight: 800,
                                cursor: running ? 'wait' : 'pointer',
                                boxShadow: `0 4px 14px ${meta.gradient[0]}44`,
                                fontFamily: 'inherit',
                              }}>
                              {running ? (
                                <><Loader2 size={13} className="auto-agent-spin" /> 実行中…</>
                              ) : (
                                <><Check size={13} /> やる</>
                              )}
                            </button>
                          )}
                          {s.jumpTo && onJump && (
                            <button
                              onClick={() => onJump(s.jumpTo!)}
                              style={{
                                padding: '0.65rem 1rem',
                                background: 'transparent',
                                color: textPrimary,
                                border: `1.5px solid ${cardBorder}`,
                                borderRadius: 999,
                                fontSize: 12, fontWeight: 700,
                                cursor: 'pointer', fontFamily: 'inherit',
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                              }}>
                              <Target size={12} /> 画面で開く
                            </button>
                          )}
                          <button
                            onClick={() => onDismiss(s.id)}
                            style={{
                              padding: '0.65rem 0.9rem',
                              background: 'transparent',
                              color: textSecondary,
                              border: `1px solid ${cardBorder}`, borderRadius: 999,
                              fontSize: 12, fontWeight: 600, cursor: 'pointer',
                              fontFamily: 'inherit',
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}>
                            <X size={12} /> 却下
                          </button>
                        </div>

                        {/* 修正 */}
                        {!done && (
                          <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                            <input
                              value={refineInput}
                              onChange={e => setRefineInput(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') onRefine(s); }}
                              placeholder="もう少しこっち寄りで… (例: もっと攻めて / より丁寧に)"
                              style={{
                                flex: 1, padding: '0.55rem 0.85rem',
                                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.7)',
                                border: `1px solid ${cardBorder}`,
                                borderRadius: 999,
                                fontSize: 16, color: textPrimary,
                                fontFamily: 'inherit',
                              }}
                            />
                            <button
                              onClick={() => onRefine(s)}
                              disabled={refining || !refineInput.trim()}
                              style={{
                                padding: '0.55rem 0.95rem',
                                background: 'transparent',
                                color: '#E1306C',
                                border: '1px solid #E1306C', borderRadius: 999,
                                fontSize: 12, fontWeight: 700,
                                cursor: refineInput.trim() ? 'pointer' : 'not-allowed',
                                opacity: refineInput.trim() ? 1 : 0.4,
                                fontFamily: 'inherit',
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                              }}>
                              <MessageSquare size={11} /> 直す
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {!loading && visible.length === 0 && !error && (
          <div style={{
            padding: '1.5rem', textAlign: 'center', color: textSecondary,
            fontSize: 13, fontStyle: 'italic',
          }}>
            ぜんぶ片付きましたね。少し休んでください。
            <button onClick={() => load(true)} style={{
              display: 'block', margin: '8px auto 0',
              padding: '5px 12px',
              background: 'transparent', border: `1px solid ${cardBorder}`,
              color: textPrimary, borderRadius: 999,
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}>新しい提案を作る</button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes auto-agent-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes auto-agent-spin {
          from { transform: rotate(0); }
          to { transform: rotate(360deg); }
        }
        .auto-agent-spin { animation: auto-agent-spin 0.9s linear infinite; }
      `}</style>
    </div>
  );
}
