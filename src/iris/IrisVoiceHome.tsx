// ============================================================
// IRIS Voice Home — エディトリアル Pinterest ホーム
// 上部: ヒーロー週間サマリー + 2カラムグリッド
// 中段: AI チャット (Gemini Voice 風)
// ============================================================
import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import type { AppSettings } from '../types/identity';
import type { MediaKit, InfluencerDeal } from '../types/influencerDeal';
import { chatWithIris, type AssistantMessage } from './irisAssistant';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { useVoiceInput } from '../hooks/useVoiceInput';

const STORAGE_KEY = 'core_iris_voicehome_history_v1';

interface Props {
  bg: IrisBackgroundDef;
  settings: AppSettings;
  myDeals: InfluencerDeal[];
  mediaKit?: MediaKit;
  onNavigate?: (tab: string) => void;
}

// ── Fade-up ユーティリティ ────────────────────────────────
function FadeUp({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
      transition={{ duration: 0.72, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default function IrisVoiceHome({ bg, settings, myDeals, mediaKit, onNavigate }: Props) {
  const [history, setHistory] = useState<AssistantMessage[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-30))); } catch { /* */ }
  }, [history]);

  const [textInput, setTextInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<{ data: string; mediaType: string; preview: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { state: voiceState, transcript, interim, isAvailable: voiceAvailable, start: voiceStart, stop: voiceStop, reset: voiceReset } = useVoiceInput(
    () => { /* handled via transcript watcher */ },
    { lang: 'ja-JP', continuous: true, interimResults: true, silenceTimeout: 2500 }
  );
  const listening = voiceState === 'listening';

  useEffect(() => {
    if (!listening && transcript) {
      setTextInput(prev => (prev ? prev + ' ' : '') + transcript);
      voiceReset();
    }
  }, [listening, transcript, voiceReset]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history.length, busy]);

  // 統計
  const activeCount = myDeals.filter(d => !['closed', 'declined', 'reported'].includes(d.stage)).length;
  const earnings = myDeals.filter(d => ['posted', 'reported', 'closed'].includes(d.stage)).reduce((s, d) => s + (d.fee || 0), 0);
  const upcomingThisWeek = myDeals.flatMap(d => [d.draftDeadline, d.postDeadline, d.reportDeadline])
    .filter(Boolean)
    .filter(iso => {
      if (!iso) return false;
      const days = (new Date(iso).getTime() - Date.now()) / 86400000;
      return days >= 0 && days <= 7;
    }).length;

  const nearestDeal = [...myDeals]
    .filter(d => d.postDeadline && !['closed', 'declined'].includes(d.stage))
    .sort((a, b) => new Date(a.postDeadline!).getTime() - new Date(b.postDeadline!).getTime())[0];

  const handleAddImages = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const next: typeof pendingImages = [];
    for (let i = 0; i < files.length && pendingImages.length + next.length < 3; i++) {
      const f = files[i];
      if (!f.type.startsWith('image/')) continue;
      const reader = new FileReader();
      const dataUrl: string = await new Promise(res => {
        reader.onload = () => res(reader.result as string);
        reader.readAsDataURL(f);
      });
      const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (m) next.push({ mediaType: m[1], data: m[2], preview: dataUrl });
    }
    setPendingImages(p => [...p, ...next]);
  }, [pendingImages]);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter(it => it.type.startsWith('image/'));
      if (imageItems.length === 0) return;
      const dt = new DataTransfer();
      for (const it of imageItems) { const f = it.getAsFile(); if (f) dt.items.add(f); }
      handleAddImages(dt.files);
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleAddImages]);

  const send = async () => {
    const userText = (textInput + (interim ? ' ' + interim : '')).trim();
    if (!userText && pendingImages.length === 0) return;
    if (busy) return;
    if (listening) voiceStop();

    const userMsg: AssistantMessage = {
      role: 'user',
      content: userText || '(画像のみ)',
      timestamp: new Date().toISOString(),
      images: pendingImages.length ? pendingImages.map(({ data, mediaType }) => ({ data, mediaType })) : undefined,
    };
    setHistory(prev => [...prev, userMsg]);
    setTextInput('');
    setPendingImages([]);
    setErr(null);
    setBusy(true);

    try {
      const res = await chatWithIris({ settings, history, userMessage: userText || '(画像)', userImages: userMsg.images, mediaKit });
      const aiMsg: AssistantMessage = {
        role: 'assistant',
        content: res.reply,
        intent: res.intent,
        actions: res.actions,
        timestamp: new Date().toISOString(),
      };
      setHistory(prev => [...prev, aiMsg]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '送信失敗');
    } finally { setBusy(false); }
  };

  const clearChat = () => {
    if (confirm('チャット履歴をクリアしますか?')) setHistory([]);
  };

  const isDark = bg.id === 'neon-night';
  const subtleColor = isDark ? 'rgba(255,255,255,0.65)' : bg.inkSoft;
  const cardSurface = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.88)';
  const accent = bg.accent;

  const today = new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'long' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── ① ヒーロー: 週間コンテンツセッションカード ────── */}
      <FadeUp delay={0}>
        <div style={{
          position: 'relative',
          background: `linear-gradient(135deg, #1A0A26 0%, #2D0B3E 40%, #1A0A26 100%)`,
          borderRadius: 28,
          padding: '2rem 2rem 2rem',
          overflow: 'hidden',
          minHeight: 220,
        }}>
          {/* Aurora halo */}
          <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: '-30%', left: '-10%', width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${accent}44 0%, transparent 65%)`, filter: 'blur(60px)' }} />
            <div style={{ position: 'absolute', bottom: '-20%', right: '-5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, #FCB04533 0%, transparent 60%)', filter: 'blur(50px)' }} />
          </div>

          <div style={{ position: 'relative', zIndex: 2 }}>
            <p style={{
              fontFamily: IRIS_FONTS.body, fontSize: '0.65rem', letterSpacing: '0.35em',
              fontWeight: 700, color: 'rgba(252,176,69,0.9)', marginBottom: '0.6rem', textTransform: 'uppercase',
            }}>
              {today} — WEEKLY SESSION
            </p>
            <h2 style={{
              fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontWeight: 800,
              fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)',
              color: '#FFFAF5', margin: '0 0 0.5rem', lineHeight: 1.1, letterSpacing: '-0.02em',
            }}>
              {mediaKit?.handleName ? `@${mediaKit.handleName} の週` : 'あなたの今週'}
            </h2>
            <p style={{
              fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
              fontSize: 'clamp(1rem, 1.8vw, 1.2rem)',
              color: 'rgba(255,250,245,0.72)', lineHeight: 1.7, marginBottom: '1.5rem',
            }}>
              {nearestDeal
                ? `「${nearestDeal.brandName}」の投稿が近づいています。キャプションを仕上げましょう。`
                : 'AI があなたのコンテンツプランを考えています。'}
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => onNavigate?.('strategy')}
                style={{
                  background: 'linear-gradient(135deg, #E1306C 0%, #833AB4 50%, #FCB045 100%)',
                  color: '#fff', border: 'none', borderRadius: 999,
                  padding: '0.7rem 1.5rem', fontSize: '0.88rem', fontWeight: 700,
                  cursor: 'pointer', fontFamily: IRIS_FONTS.body,
                  boxShadow: '0 8px 24px rgba(225,48,108,0.45)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 14px 30px rgba(225,48,108,0.55)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(225,48,108,0.45)'; }}
              >
                ✦ コンテンツ戦略を開く
              </button>
              {nearestDeal && (
                <button
                  onClick={() => onNavigate?.('draft')}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: '#FFFAF5', border: '1px solid rgba(255,250,245,0.25)',
                    borderRadius: 999, padding: '0.7rem 1.3rem',
                    fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
                    fontFamily: IRIS_FONTS.body, transition: 'all 0.2s',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  ✍ 下書きを書く
                </button>
              )}
            </div>
          </div>
        </div>
      </FadeUp>

      {/* ── ② 2カラムグリッド: 数字サマリー + クイックアクション ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>

        {/* 左: ステータス KPI */}
        <FadeUp delay={0.06}>
          <div style={{
            background: cardSurface, backdropFilter: 'blur(12px)',
            border: `1px solid ${bg.cardBorder}`, borderRadius: 22,
            padding: '1.5rem',
          }}>
            <p style={{ fontFamily: IRIS_FONTS.body, fontSize: '0.65rem', letterSpacing: '0.28em', fontWeight: 700, color: accent, marginBottom: '1rem', textTransform: 'uppercase' }}>
              TODAY'S SNAPSHOT
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              {[
                { icon: '💌', label: '進行中案件', value: `${activeCount} 件`, nav: 'deals' },
                { icon: '📅', label: '今週の締切', value: `${upcomingThisWeek} 件`, nav: 'deals' },
                { icon: '💰', label: '今月報酬',   value: `¥${(earnings / 1000).toFixed(0)}K`, nav: 'kit' },
                { icon: '📊', label: '総案件',     value: `${myDeals.length} 件`, nav: 'strategy' },
              ].map(s => (
                <button key={s.label}
                  onClick={() => onNavigate?.(s.nav)}
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)',
                    border: `1px solid ${bg.cardBorder}`,
                    borderRadius: 16, padding: '0.85rem',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 20px ${accent}22`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ fontSize: '1.2rem', marginBottom: '0.35rem' }}>{s.icon}</div>
                  <div style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '1.25rem', fontWeight: 600, color: bg.ink, lineHeight: 1.1 }}>{s.value}</div>
                  <div style={{ fontSize: '0.72rem', color: subtleColor, marginTop: '0.2rem', letterSpacing: '0.04em' }}>{s.label}</div>
                </button>
              ))}
            </div>
          </div>
        </FadeUp>

        {/* 右: クイックアクション */}
        <FadeUp delay={0.12}>
          <div style={{
            background: cardSurface, backdropFilter: 'blur(12px)',
            border: `1px solid ${bg.cardBorder}`, borderRadius: 22,
            padding: '1.5rem',
          }}>
            <p style={{ fontFamily: IRIS_FONTS.body, fontSize: '0.65rem', letterSpacing: '0.28em', fontWeight: 700, color: accent, marginBottom: '1rem', textTransform: 'uppercase' }}>
              QUICK ACCESS
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              {[
                { e: '🔍', l: '案件精査',   t: 'triage' },
                { e: '🎬', l: '丸投げ編集', t: 'director' },
                { e: '💬', l: '交渉文',     t: 'negotiate' },
                { e: '💆', l: '美容相談',   t: 'beauty' },
              ].map(q => (
                <button key={q.l} onClick={() => onNavigate?.(q.t)} style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)',
                  border: `1px solid ${bg.cardBorder}`,
                  borderRadius: 14, padding: '0.85rem 0.65rem',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem',
                  color: bg.ink, fontFamily: IRIS_FONTS.body,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : `${accent}12`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)'; }}
                >
                  <span style={{ fontSize: '1.5rem' }}>{q.e}</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{q.l}</span>
                </button>
              ))}
            </div>
          </div>
        </FadeUp>
      </div>

      {/* ── ③ AI インタラクション ────────────────────── */}
      <FadeUp delay={0.18}>
        <div style={{
          background: cardSurface, backdropFilter: 'blur(12px)',
          border: `1px solid ${bg.cardBorder}`, borderRadius: 24,
          padding: '1.5rem 1.5rem 1.25rem',
        }}>
          {/* AI 名前 */}
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <p style={{
              fontFamily: IRIS_FONTS.body, fontSize: '0.65rem', letterSpacing: '0.35em',
              color: accent, fontWeight: 700, marginBottom: '0.35rem', textTransform: 'uppercase',
            }}>
              YOUR AI MANAGER
            </p>
            <h2 style={{
              fontFamily: IRIS_FONTS.display, fontStyle: 'italic',
              fontSize: 'clamp(1.4rem, 3vw, 2rem)',
              color: bg.ink, margin: 0, fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em',
            }}>
              おかえり。なんでも、話して。
            </h2>
            <p style={{ color: subtleColor, fontSize: '0.82rem', marginTop: '0.35rem', fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>
              スクショを送るか、声で話すか、書くだけ。
            </p>
          </div>

          {/* チャット履歴 */}
          <div ref={scrollRef} style={{
            background: isDark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.55)',
            border: `1px solid ${bg.cardBorder}`, borderRadius: 18,
            padding: '1rem',
            minHeight: 220, maxHeight: 'min(55vh, 480px)', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: '0.75rem',
          }}>
            {history.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem', textAlign: 'center' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', marginBottom: '0.85rem',
                  background: `linear-gradient(135deg, ${accent}, #FCB045)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.6rem',
                  boxShadow: `0 8px 24px ${accent}44`,
                }}>✨</div>
                <p style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.1rem', color: bg.ink, marginBottom: '0.85rem', fontWeight: 600 }}>
                  何から、はなしましょうか?
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.45rem', maxWidth: 520, width: '100%' }}>
                  {[
                    { e: '📸', t: 'スクショから案件追加' },
                    { e: '💬', t: '断り文を書いて' },
                    { e: '📊', t: '今週、何投稿すべき?' },
                    { e: '💆', t: '肌が荒れて困ってる' },
                  ].map(s => (
                    <button key={s.t} onClick={() => setTextInput(s.t)} style={{
                      background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.92)',
                      border: `1px solid ${bg.cardBorder}`,
                      borderRadius: 12, padding: '0.6rem 0.7rem',
                      cursor: 'pointer', fontSize: '0.83rem',
                      color: bg.ink, fontFamily: IRIS_FONTS.body, textAlign: 'left',
                      transition: 'all 0.18s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${accent}12`; e.currentTarget.style.borderColor = `${accent}55`; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.92)'; e.currentTarget.style.borderColor = bg.cardBorder; }}
                    >
                      {s.e} {s.t}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {history.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{
                      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '88%',
                      display: 'flex', flexDirection: 'column', gap: '0.35rem',
                    }}
                  >
                    {m.images && m.images.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        {m.images.map((img, ii) => (
                          <img key={ii}
                            src={`data:${img.mediaType};base64,${img.data}`}
                            alt=""
                            style={{ maxWidth: 140, borderRadius: 12, border: `1px solid ${bg.cardBorder}` }} />
                        ))}
                      </div>
                    )}
                    <div style={{
                      background: m.role === 'user'
                        ? `linear-gradient(135deg, ${accent}, #833AB4)`
                        : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.95)',
                      color: m.role === 'user' ? '#FFFFFF' : bg.ink,
                      padding: '0.7rem 1rem',
                      borderRadius: m.role === 'user' ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
                      fontSize: '0.92rem', lineHeight: 1.7,
                      whiteSpace: 'pre-wrap',
                      boxShadow: m.role === 'user' ? `0 4px 16px ${accent}44` : '0 2px 8px rgba(0,0,0,0.06)',
                    }}>
                      {m.content}
                    </div>
                    {m.role === 'assistant' && m.actions && m.actions.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {m.actions.map((a, ai) => (
                          <button key={ai}
                            onClick={() => onNavigate?.(a.tab)}
                            style={{
                              background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.95)',
                              border: `1px solid ${accent}44`,
                              color: accent, borderRadius: 999,
                              padding: '0.35rem 0.85rem',
                              fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                              fontFamily: IRIS_FONTS.body,
                              boxShadow: `0 2px 8px ${accent}22`,
                              transition: 'all 0.18s',
                            }}>
                            {a.emoji ? a.emoji + ' ' : ''}{a.label} →
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            {busy && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{
                  alignSelf: 'flex-start',
                  padding: '0.7rem 1rem',
                  background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.95)',
                  borderRadius: '20px 20px 20px 6px',
                  color: subtleColor,
                }}>
                <span style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <motion.span key={i}
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                      style={{ width: 7, height: 7, borderRadius: '50%', background: accent, display: 'block' }} />
                  ))}
                </span>
              </motion.div>
            )}
          </div>

          {err && (
            <div style={{
              background: 'rgba(200,16,46,0.08)', border: '1px solid rgba(200,16,46,0.22)',
              padding: '0.55rem 0.85rem', borderRadius: 10, marginTop: '0.6rem',
              color: '#9B1B30', fontSize: '0.83rem',
            }}>⚠ {err}</div>
          )}

          {/* 入力エリア */}
          <div style={{ marginTop: '1rem' }}>
            {/* 添付画像 */}
            {pendingImages.length > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                {pendingImages.map((img, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={img.preview} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 10, border: `1px solid ${bg.cardBorder}` }} />
                    <button onClick={() => setPendingImages(p => p.filter((_, idx) => idx !== i))} style={{
                      position: 'absolute', top: -4, right: -4,
                      background: '#1F1A2E', color: '#fff', border: 'none',
                      borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', fontSize: '0.65rem', lineHeight: 1,
                    }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* マイクボタン */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '0.85rem' }}>
              <motion.button
                onClick={listening ? voiceStop : (voiceAvailable ? voiceStart : undefined)}
                disabled={!voiceAvailable || busy}
                whileTap={voiceAvailable && !busy ? { scale: 0.94 } : {}}
                style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: listening
                    ? `linear-gradient(135deg, ${accent}, #833AB4)`
                    : `linear-gradient(135deg, ${accent}dd, #833AB4aa)`,
                  color: '#fff', border: '3px solid rgba(255,255,255,0.35)',
                  fontSize: '2.4rem', cursor: voiceAvailable && !busy ? 'pointer' : 'not-allowed',
                  boxShadow: listening
                    ? `0 0 0 12px ${accent}22, 0 0 0 24px ${accent}0e, 0 10px 30px ${accent}66`
                    : `0 10px 28px ${accent}55`,
                  animation: listening ? 'iris-mic-pulse 1.6s ease-in-out infinite' : 'none',
                  opacity: voiceAvailable ? 1 : 0.45,
                  transition: 'box-shadow 0.3s',
                }}
              >
                {listening ? '⏹' : '🎙'}
              </motion.button>
              <p style={{ marginTop: '0.45rem', color: subtleColor, fontSize: '0.75rem', fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>
                {listening ? '聞いてます…' : voiceAvailable ? '押して話す' : '(音声非対応)'}
              </p>
              {interim && (
                <p style={{ marginTop: '0.25rem', color: accent, fontSize: '0.83rem', fontStyle: 'italic' }}>
                  {interim}
                </p>
              )}
            </div>

            {/* テキスト行 */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
              <label style={{
                background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.92)',
                border: `1px solid ${bg.cardBorder}`, borderRadius: 14,
                width: 44, height: 44,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: '1.15rem', flexShrink: 0,
              }}>
                📷
                <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                  onChange={e => handleAddImages(e.target.files)} />
              </label>

              <textarea
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
                placeholder="書いてもいい… (Cmd+Enter で送信)"
                rows={1}
                style={{
                  flex: 1,
                  background: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.94)',
                  border: `1px solid ${bg.cardBorder}`,
                  borderRadius: 14, padding: '0.7rem 0.95rem',
                  fontSize: '0.93rem', fontFamily: IRIS_FONTS.body,
                  color: bg.ink, outline: 'none', resize: 'none',
                  minHeight: 44, maxHeight: 140,
                }}
              />

              <button
                onClick={send}
                disabled={busy || (!textInput.trim() && pendingImages.length === 0)}
                style={{
                  background: `linear-gradient(135deg, ${accent}, #833AB4)`,
                  color: '#fff', border: 'none', borderRadius: 14,
                  width: 44, height: 44,
                  cursor: busy ? 'wait' : 'pointer',
                  fontSize: '1.1rem', fontWeight: 700, flexShrink: 0,
                  boxShadow: `0 6px 18px ${accent}55`,
                  opacity: busy || (!textInput.trim() && pendingImages.length === 0) ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}
              >
                {busy ? '⋯' : '➤'}
              </button>
            </div>

            {history.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.4rem' }}>
                <button onClick={clearChat} style={{
                  background: 'transparent', color: subtleColor,
                  border: 'none', cursor: 'pointer', fontSize: '0.75rem', padding: '0.2rem 0.4rem',
                }}>
                  🗑 履歴を消す
                </button>
              </div>
            )}
          </div>
        </div>
      </FadeUp>

      <style>{`
        @keyframes iris-mic-pulse {
          0%, 100% { box-shadow: 0 0 0 12px ${accent}22, 0 0 0 24px ${accent}0e, 0 10px 30px ${accent}66; }
          50%       { box-shadow: 0 0 0 20px ${accent}11, 0 0 0 40px ${accent}07, 0 10px 38px ${accent}99; }
        }
      `}</style>
    </div>
  );
}
