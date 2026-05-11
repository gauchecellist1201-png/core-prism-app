// ============================================================
// IRIS Voice Home — Gemini Voice 風の対話型ホーム
// 中央に大きい🎙、上部に数字サマリー、下部に AI とのチャット履歴
// ============================================================
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  /** AI が action を返したときにタブ切替する */
  onNavigate?: (tab: string) => void;
}

export default function IrisVoiceHome({ bg, settings, myDeals, mediaKit, onNavigate }: Props) {
  // チャット履歴 (localStorage 永続化)
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

  // 音声入力
  const { state: voiceState, transcript, interim, isAvailable: voiceAvailable, start: voiceStart, stop: voiceStop, reset: voiceReset } = useVoiceInput(
    () => { /* on result handled via transcript watcher below */ },
    { lang: 'ja-JP', continuous: true, interimResults: true, silenceTimeout: 2500 }
  );
  const listening = voiceState === 'listening';

  // 音声で確定された transcript を textInput に反映
  useEffect(() => {
    if (!listening && transcript) {
      setTextInput(prev => (prev ? prev + ' ' : '') + transcript);
      voiceReset();
    }
  }, [listening, transcript, voiceReset]);

  // 自動スクロール
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

  // 画像追加
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

  // ペースト (クリップボード画像)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter(it => it.type.startsWith('image/'));
      if (imageItems.length === 0) return;
      const dt = new DataTransfer();
      for (const it of imageItems) {
        const f = it.getAsFile();
        if (f) dt.items.add(f);
      }
      handleAddImages(dt.files);
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleAddImages]);

  // 送信
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
      const res = await chatWithIris({
        settings, history,
        userMessage: userText || '(画像)',
        userImages: userMsg.images,
        mediaKit,
      });
      const aiMsg: AssistantMessage = {
        role: 'assistant',
        content: res.reply,
        intent: res.intent,
        actions: res.actions,
        timestamp: new Date().toISOString(),
      };
      setHistory(prev => [...prev, aiMsg]);
    } catch (e: any) {
      setErr(e.message || '送信失敗');
    } finally { setBusy(false); }
  };

  const clearChat = () => {
    if (confirm('チャット履歴をクリアしますか?')) setHistory([]);
  };

  const isDarkBg = bg.id === 'neon-night';
  const subtleColor = isDarkBg ? 'rgba(255,255,255,0.7)' : '#5A4570';

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      {/* 上部: 数字サマリー (極小) */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem',
      }}>
        <SummaryCard bg={bg} label="進行中"   value={activeCount + ' 件'}   icon="💌" />
        <SummaryCard bg={bg} label="今週納期" value={upcomingThisWeek + ' 件'} icon="📅" />
        <SummaryCard bg={bg} label="今月報酬" value={'¥' + (earnings / 1000).toFixed(0) + 'K'} icon="💰" />
      </div>

      {/* AI 名前 + 開始メッセージ */}
      <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
        <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '0.8rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 700, marginBottom: '0.4rem', textTransform: 'uppercase' }}>
          Your AI Manager
        </p>
        <h2 style={{
          fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
          fontSize: 'clamp(1.5rem, 5.5vw, 2.4rem)',
          color: bg.ink, margin: 0, fontWeight: 500, lineHeight: 1.25,
          textWrap: 'balance' as any,
          wordBreak: 'keep-all',
          overflowWrap: 'break-word',
          padding: '0 0.5rem',
        }}>
          おかえり。<br className="iris-okaeri-br" />なんでも話して。
        </h2>
        <p style={{ color: subtleColor, fontSize: '0.85rem', marginTop: '0.5rem', lineHeight: 1.5 }}>
          スクショ・声・テキスト ── どれでも OK
        </p>
      </div>

      {/* チャット履歴 */}
      <div ref={scrollRef} style={{
        background: bg.card, backdropFilter: 'blur(12px)',
        border: `1px solid ${bg.cardBorder}`, borderRadius: 22,
        padding: '1.2rem',
        minHeight: 280, maxHeight: 'min(60vh, 540px)', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: '0.85rem',
      }}>
        {history.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>✨</div>
            <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '1.15rem', color: bg.ink, marginBottom: '1rem' }}>
              何から、はなしましょうか?
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', maxWidth: 600, width: '100%' }}>
              {/* 動画スタジオへの直接ナビ */}
              <button onClick={() => onNavigate?.('video')} style={{
                background: `linear-gradient(135deg, ${bg.accent}22, ${bg.accent}11)`,
                border: `1px solid ${bg.accent}55`,
                borderRadius: 12, padding: '0.65rem 0.75rem',
                cursor: 'pointer', fontSize: '0.85rem',
                color: bg.ink, fontFamily: IRIS_FONTS.body, textAlign: 'left',
                fontWeight: 600,
              }}>
                🎬 動画スタジオを開く
              </button>
              {[
                { e: '📸', t: 'スクショから案件追加' },
                { e: '💬', t: '断り文を書いて' },
                { e: '📊', t: '今週、何投稿すべき?' },
                { e: '💆', t: '肌が荒れて困ってる' },
              ].map(s => (
                <button key={s.t} onClick={() => setTextInput(s.t)} style={{
                  background: 'rgba(255,255,255,0.85)',
                  border: `1px solid ${bg.cardBorder}`,
                  borderRadius: 12, padding: '0.65rem 0.75rem',
                  cursor: 'pointer', fontSize: '0.85rem',
                  color: '#1F1A2E', fontFamily: IRIS_FONTS.body, textAlign: 'left',
                }}>
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
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  display: 'flex', flexDirection: 'column', gap: '0.4rem',
                }}
              >
                {/* 画像 (ユーザー側) */}
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
                  background: m.role === 'user' ? bg.accent : 'rgba(255,255,255,0.94)',
                  color: m.role === 'user' ? '#FFFFFF' : '#1F1A2E',
                  padding: '0.7rem 1rem',
                  borderRadius: m.role === 'user' ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
                  fontSize: '0.94rem', lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                }}>
                  {m.content}
                </div>
                {/* AI からの提案アクション (タブへ誘導) */}
                {m.role === 'assistant' && m.actions && m.actions.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {m.actions.map((a, ai) => (
                      <button key={ai}
                        onClick={() => onNavigate?.(a.tab)}
                        style={{
                          background: 'rgba(255,255,255,0.94)',
                          border: `1px solid ${bg.accent}55`,
                          color: bg.accent,
                          borderRadius: 999, padding: '0.4rem 0.95rem',
                          fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                          fontFamily: IRIS_FONTS.body,
                          boxShadow: `0 2px 8px ${bg.accent}22`,
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
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{
              alignSelf: 'flex-start',
              padding: '0.7rem 1rem',
              background: 'rgba(255,255,255,0.94)',
              borderRadius: '20px 20px 20px 6px',
              color: '#5A4570',
            }}>
            <span style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <motion.span key={i}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: bg.accent,
                  }} />
              ))}
            </span>
          </motion.div>
        )}
      </div>

      {err && (
        <div style={{
          background: 'rgba(200,16,46,0.08)', border: '1px solid rgba(200,16,46,0.25)',
          padding: '0.6rem 0.85rem', borderRadius: 12,
          color: '#9B1B30', fontSize: '0.85rem',
        }}>⚠ {err}</div>
      )}

      {/* 入力エリア (中央に大きいマイク + 補助テキスト + 画像添付) */}
      <div style={{
        background: bg.card, backdropFilter: 'blur(12px)',
        border: `1px solid ${bg.cardBorder}`, borderRadius: 24,
        padding: '1rem',
      }}>
        {/* 添付画像プレビュー */}
        {pendingImages.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
            {pendingImages.map((img, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={img.preview} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 10, border: `1px solid ${bg.cardBorder}` }} />
                <button onClick={() => setPendingImages(p => p.filter((_, idx) => idx !== i))} style={{
                  position: 'absolute', top: -4, right: -4,
                  background: '#1F1A2E', color: '#fff', border: 'none',
                  borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', fontSize: '0.7rem', lineHeight: 1,
                }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* 中央のマイクボタン */}
        <div style={{ textAlign: 'center', marginBottom: '0.85rem' }}>
          <motion.button
            onClick={listening ? voiceStop : (voiceAvailable ? voiceStart : undefined)}
            disabled={!voiceAvailable || busy}
            whileTap={voiceAvailable && !busy ? { scale: 0.95 } : {}}
            style={{
              width: 88, height: 88, borderRadius: '50%',
              background: listening
                ? `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`
                : `linear-gradient(135deg, ${bg.accent}ee, ${bg.accent}aa)`,
              color: '#fff',
              border: `3px solid rgba(255,255,255,0.4)`,
              fontSize: '2.6rem', cursor: voiceAvailable && !busy ? 'pointer' : 'not-allowed',
              boxShadow: listening
                ? `0 0 0 14px ${bg.accent}22, 0 0 0 28px ${bg.accent}11, 0 12px 32px ${bg.accent}66`
                : `0 12px 32px ${bg.accent}66`,
              animation: listening ? 'voice-home-pulse 1.6s ease-in-out infinite' : 'none',
              opacity: voiceAvailable ? 1 : 0.5,
            }}
          >
            {listening ? '⏹' : '🎙'}
          </motion.button>
          <p style={{ marginTop: '0.5rem', color: subtleColor, fontSize: '0.78rem' }}>
            {listening ? '聞いてます…' : voiceAvailable ? '押して話す or 下に書く' : '(音声非対応)'}
          </p>
          {interim && (
            <p style={{ marginTop: '0.3rem', color: bg.accent, fontSize: '0.85rem', fontStyle: 'italic' }}>
              {interim}
            </p>
          )}
        </div>

        {/* 補助テキスト + 画像 + 送信 */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
          <label style={{
            background: 'rgba(255,255,255,0.92)',
            border: `1px solid ${bg.cardBorder}`,
            borderRadius: 14, width: 44, height: 44,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: '1.2rem', flexShrink: 0,
          }}>
            📷
            <input type="file" accept="image/*" multiple style={{ display: 'none' }}
              onChange={e => handleAddImages(e.target.files)} />
          </label>

          <textarea
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="書いてもいい… (Cmd/Ctrl+Enter で送信)"
            rows={1}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.94)',
              border: `1px solid ${bg.cardBorder}`,
              borderRadius: 14,
              padding: '0.7rem 0.95rem',
              fontSize: '0.95rem',
              fontFamily: IRIS_FONTS.body,
              color: '#1F1A2E',
              outline: 'none',
              resize: 'none',
              minHeight: 44,
              maxHeight: 140,
            }}
          />

          <button
            onClick={send}
            disabled={busy || (!textInput.trim() && pendingImages.length === 0)}
            style={{
              background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
              color: '#fff',
              border: 'none',
              borderRadius: 14,
              width: 44, height: 44,
              cursor: busy ? 'wait' : 'pointer',
              fontSize: '1.1rem',
              fontFamily: IRIS_FONTS.body,
              fontWeight: 700,
              flexShrink: 0,
              boxShadow: `0 6px 16px ${bg.accent}55`,
              opacity: busy || (!textInput.trim() && pendingImages.length === 0) ? 0.5 : 1,
            }}
          >
            {busy ? '⋯' : '➤'}
          </button>
        </div>

        {history.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button onClick={clearChat} style={{
              background: 'transparent', color: subtleColor,
              border: 'none', cursor: 'pointer', fontSize: '0.78rem', padding: '0.2rem 0.5rem',
            }}>
              🗑 履歴を消す
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes voice-home-pulse {
          0%, 100% { box-shadow: 0 0 0 14px ${bg.accent}22, 0 0 0 28px ${bg.accent}11, 0 12px 32px ${bg.accent}66; }
          50%     { box-shadow: 0 0 0 24px ${bg.accent}11, 0 0 0 48px ${bg.accent}05, 0 12px 40px ${bg.accent}99; }
        }
      `}</style>
    </div>
  );
}

function SummaryCard({ bg, label, value, icon }: { bg: IrisBackgroundDef; label: string; value: string; icon: string }) {
  // 数字部分とサフィックス (例: '3 件' / '¥12K') を分離して、数字を強く目立たせる
  const m = value.match(/^([¥]?[\d.,]+)\s*(.*)$/);
  const num = m ? m[1] : value;
  const suffix = m ? m[2] : '';
  return (
    <div style={{
      background: bg.card, backdropFilter: 'blur(8px)',
      border: `1px solid ${bg.cardBorder}`, borderRadius: 16,
      padding: '0.7rem 0.85rem',
      minHeight: 76,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
        <span style={{ fontSize: '0.95rem' }}>{icon}</span>
        <span style={{ fontSize: '0.68rem', color: bg.inkSoft, letterSpacing: '0.06em', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{
        fontFamily: IRIS_FONTS.body,
        color: bg.ink, lineHeight: 1.1,
        display: 'flex', alignItems: 'baseline', gap: '0.2rem',
      }}>
        <span style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{num}</span>
        {suffix && <span style={{ fontSize: '0.78rem', fontWeight: 600, color: bg.inkSoft }}>{suffix}</span>}
      </div>
    </div>
  );
}
