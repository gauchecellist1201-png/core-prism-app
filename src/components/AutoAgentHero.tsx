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
  BookOpen, FileText, FileType, Recycle,
} from 'lucide-react';
import { generateSuggestions, executeSuggestion, refineSuggestion, clearSuggestionCache, type Suggestion, type AgentContext } from '../lib/autoAgent';

const CATEGORY_META = {
  urgent:  { Icon: AlertCircle,   label: 'いそぎ', gradient: ['#EF4444', '#F87171'] },
  growth:  { Icon: TrendingUp,    label: '伸ばす', gradient: ['#10B981', '#34D399'] },
  content: { Icon: ImageIcon,     label: 'つくる', gradient: ['#E1306C', '#F77737'] },
  admin:   { Icon: ClipboardList, label: '段取り', gradient: ['#6366F1', '#818CF8'] },
  insight: { Icon: Lightbulb,     label: '気づき', gradient: ['#FBBF24', '#FCD34D'] },
  sales:   { Icon: Mail,          label: 'お仕事', gradient: ['#2E6FFF', '#60A5FA'] },
  health:  { Icon: HeartPulse,    label: 'カラダ', gradient: ['#EC4899', '#F472B6'] },
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
  /** 結果をナレッジ化するハンドラ (Prism のみ。提供されると「ナレッジに追加」ボタンが出る) */
  onAddToKnowledge?: (title: string, content: string) => void;
}

export default function AutoAgentHero({
  ctx,
  brandGradient = 'linear-gradient(135deg, #E1306C 0%, #F77737 50%, #FBBF24 100%)',
  brandLabel = ctx.brand === 'prism' ? 'PRISM' : 'IRIS',
  onJump,
  theme = 'light',
  onAddToKnowledge,
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
      setError(e?.message || 'おすすめを作れませんでした');
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
      setError(e?.message || 'うまくいきませんでした');
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
      setError(e?.message || '直せませんでした');
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
              {brandLabel} からの今日のひと言
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
今日、何からはじめる?
          </h2>
          <p style={{
            margin: '0.3rem 0 0',
            fontSize: 12.5, color: textSecondary,
            fontFamily: '"Noto Sans JP", sans-serif', lineHeight: 1.6,
          }}>
いまのあなたを見て、おすすめを並べました。あとは私が動きます。
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

                        {/* AI が動く部分 (Agent Role) */}
                        {s.agentRole && !s.result && (
                          <div style={{
                            padding: '0.65rem 0.85rem',
                            background: `linear-gradient(135deg, ${meta.gradient[0]}10, transparent)`,
                            border: `1px solid ${meta.gradient[0]}30`,
                            borderRadius: 10,
                            marginBottom: 10,
                            display: 'flex', gap: 7, alignItems: 'flex-start',
                          }}>
                            <Sparkles size={12} style={{ color: meta.gradient[0], marginTop: 2, flexShrink: 0 }} />
                            <span style={{
                              fontSize: 11.5, lineHeight: 1.6, color: textPrimary,
                            }}>
                              <strong style={{ color: meta.gradient[0] }}>私がやること:</strong> {s.agentRole}
                            </span>
                          </div>
                        )}

                        {/* 結果表示 + 資料化/ナレッジ化アクション */}
                        {s.result && (
                          <>
                            <div style={{
                              padding: '0.8rem 0.95rem',
                              background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.55)',
                              borderRadius: 12, marginBottom: 8,
                              fontSize: 13, lineHeight: 1.7,
                              color: textPrimary,
                              whiteSpace: 'pre-wrap',
                              maxHeight: 320, overflowY: 'auto',
                              border: `1px solid ${cardBorder}`,
                            }}>
                              {s.result}
                            </div>

                            {/* 次のステップ: 資料化 + ナレッジ追加 */}
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                              <button
                                onClick={() => navigator.clipboard?.writeText(s.result || '')}
                                style={resultActionBtn(cardBorder, textPrimary)}>
                                <Copy size={10} /> コピー
                              </button>
                              <button
                                onClick={() => downloadMarkdown(s.title, s.result || '')}
                                style={resultActionBtn(cardBorder, textPrimary)}>
                                <FileText size={10} /> .md
                              </button>
                              <button
                                onClick={() => downloadHtmlPrintable(s.title, s.result || '')}
                                style={resultActionBtn(cardBorder, textPrimary)}
                                title="HTML を新規タブで開く → ブラウザの印刷で PDF 保存できます">
                                <FileType size={10} /> 印刷/PDF
                              </button>
                              {onAddToKnowledge && (
                                <button
                                  onClick={() => {
                                    onAddToKnowledge(s.title, s.result || '');
                                    updateOne(s.id, { status: 'done', result: (s.result || '') + '\n\n---\n✓ 覚えました (次のおすすめに反映されます)' });
                                  }}
                                  style={{
                                    ...resultActionBtn(cardBorder, textPrimary),
                                    background: `linear-gradient(135deg, ${meta.gradient[0]}, ${meta.gradient[1]})`,
                                    color: '#fff', border: 'none',
                                    fontWeight: 800,
                                  }}>
                                  <BookOpen size={10} /> 覚えておく
                                </button>
                              )}
                            </div>

                            {onAddToKnowledge && (
                              <div style={{
                                display: 'flex', gap: 6, alignItems: 'flex-start',
                                padding: '0.55rem 0.75rem',
                                background: `${meta.gradient[0]}10`,
                                border: `1px dashed ${meta.gradient[0]}44`,
                                borderRadius: 8,
                                fontSize: 11, lineHeight: 1.55,
                                color: textSecondary,
                                marginBottom: 8,
                              }}>
                                <Recycle size={11} style={{ color: meta.gradient[0], marginTop: 2, flexShrink: 0 }} />
                                <span>
                                  <strong style={{ color: meta.gradient[0] }}>覚えておくと得をします:</strong> 「覚えておく」を押すと、この結果が次のおすすめの土台になります。
                                </span>
                              </div>
                            )}
                          </>
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
                                <><Loader2 size={13} className="auto-agent-spin" /> やっています…</>
                              ) : (
                                <><Check size={13} /> おまかせする</>
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
                              <Target size={12} /> 画面で見る
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
                            <X size={12} /> 今回はパス
                          </button>
                        </div>

                        {/* 修正 */}
                        {!done && (
                          <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                            <input
                              value={refineInput}
                              onChange={e => setRefineInput(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') onRefine(s); }}
                              placeholder="もうちょっとこうしてほしい… (例: もっと優しく / もっと攻めて)"
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
                              <MessageSquare size={11} /> 直してもらう
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
            }}>新しいおすすめをもらう</button>
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

// ─── Helpers ─────
function resultActionBtn(border: string, color: string): React.CSSProperties {
  return {
    padding: '5px 11px',
    background: 'transparent', border: `1px solid ${border}`,
    color, borderRadius: 6,
    fontSize: 11, fontWeight: 600, cursor: 'pointer',
    display: 'inline-flex', gap: 4, alignItems: 'center',
    fontFamily: 'inherit',
  };
}

function downloadMarkdown(title: string, content: string) {
  const safe = title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
  const blob = new Blob([`# ${title}\n\n${content}\n`], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safe}-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadHtmlPrintable(title: string, content: string) {
  // 印刷ダイアログを呼べる HTML を新タブで開く
  const safe = title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
  // 簡易 Markdown → HTML
  const html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>')
    .replace(/(<li>.*<\/li>)/gs, m => '<ul>' + m + '</ul>')
    .replace(/(\|[^\n]+\|)/g, m => {
      // テーブル簡易処理
      return m;
    });

  const doc = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: "Hiragino Sans","Noto Sans JP",sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; line-height: 1.85; color: #1F1A2E; }
  h1 { font-family: "Cinzel","Noto Serif JP",serif; font-size: 26px; border-bottom: 2px solid #E1306C; padding-bottom: 10px; margin-bottom: 22px; }
  h2 { font-size: 18px; color: #E1306C; margin-top: 26px; }
  h3 { font-size: 15px; color: #5A4570; margin-top: 18px; }
  p { margin: 12px 0; }
  table { border-collapse: collapse; width: 100%; margin: 14px 0; font-size: 13px; }
  th, td { border: 1px solid #E2DEF0; padding: 6px 10px; }
  th { background: #FFE5EE; font-weight: 700; }
  ul { padding-left: 20px; }
  li { margin: 4px 0; }
  strong { color: #1F1A2E; }
  .meta { color: #999; font-size: 11px; margin-bottom: 16px; }
  @media print { body { margin: 20mm; } .no-print { display: none; } }
</style></head>
<body>
<h1>${title}</h1>
<p class="meta">生成: ${new Date().toLocaleString('ja-JP')} · by CORE Agent</p>
<p>${html}</p>
<button class="no-print" onclick="window.print()" style="position:fixed;bottom:20px;right:20px;padding:12px 20px;background:linear-gradient(135deg,#E1306C,#F77737);color:#fff;border:none;border-radius:999px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 6px 18px rgba(225,48,108,0.3)">🖨 印刷 / PDF 保存</button>
</body></html>`;
  const blob = new Blob([doc], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  void safe;
}
