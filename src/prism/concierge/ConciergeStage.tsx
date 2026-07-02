// ============================================================
// ConciergeStage — 全画面クリスタル・アバター体験 (2026-07-02)
//
// オーナー指示: 「画面いっぱいに美しいアバターが出てきて、
//               話しかけるだけで全て解決する。シンプルUI。
//               花が開いていくアニメーションを実際に反映したい。」
//
// 構成 (100svh・1画面=1主役):
//   - クリスタルの花のアバター: マウント時に外輪→中輪→内輪の順で "開花"
//     状態反応 (idle=呼吸 / listening=花が開き光る / thinking=ゆっくり回る / speaking=芯が脈動)
//   - 応答は字幕タイポグラフィ (チャットバブル無し)
//   - 下部に最小限の入力: マイク主体 (話し終えると自動送信) + テキスト
//   - 声でも返す (Web Speech Synthesis・ミュート可)
//   - 履歴とリード (ご案内希望) はガラスのシートに収納
// ============================================================
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConcierge, type LeadDraft } from './useConcierge';
import { useVoiceInput, speak, stopSpeaking } from '../../hooks/useVoiceInput';
import type { ConciergeConfig } from './conciergeConfig';

// 実3Dのクリスタル・ロータス (three.js) — 重いので遅延ロード。
// WebGL が使えない環境では従来の SVG アバターにフォールバック。
const CrystalScene = lazy(() => import('./CrystalScene'));

function canUseWebgl(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

const SERIF = `'Didot', 'Bodoni 72', 'Hiragino Mincho ProN', 'Yu Mincho', Georgia, serif`;
const SANS = `-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif`;

const T = {
  fg: '#F4F7FC',
  fgMuted: 'rgba(244,247,252,0.72)',
  fgSubtle: 'rgba(244,247,252,0.5)',
  line: 'rgba(255,255,255,0.16)',
  glass: 'rgba(24,33,52,0.55)',
  glassLight: 'rgba(255,255,255,0.08)',
};

const NOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`;

// ─── 花びらリング (1リング = 1SVG。開花はリング単位で動かす) ───
const PETAL = 'M0,-96 C22,-70 30,-34 20,-2 C13,20 -13,20 -20,-2 C-30,-34 -22,-70 0,-96 Z';

function RingSvg({ id, count, offset, stops, petalScale = 1 }: {
  id: string; count: number; offset: number;
  stops: [string, string, string]; petalScale?: number;
}) {
  return (
    <svg viewBox="0 0 400 400" width="100%" height="100%" aria-hidden style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stops[0]} />
          <stop offset="58%" stopColor={stops[1]} />
          <stop offset="100%" stopColor={stops[2]} />
        </linearGradient>
      </defs>
      <g transform="translate(200,200)">
        {Array.from({ length: count }, (_, i) => (
          <path
            key={i}
            d={PETAL}
            fill={`url(#${id})`}
            stroke="rgba(255,255,255,0.42)"
            strokeWidth={0.5}
            transform={`rotate(${(360 / count) * i + offset}) scale(${petalScale})`}
          />
        ))}
      </g>
    </svg>
  );
}

// 開花のコレオグラフィ: 閉じた蕾 (小さく・すぼまって・回転) → 外輪から順に開く
const bloomEase = [0.16, 1, 0.3, 1] as const;
const ringVariants = (delay: number, duration: number) => ({
  closed: { scale: 0.08, rotate: -95, opacity: 0 },
  open: { scale: 1, rotate: 0, opacity: 1, transition: { delay, duration, ease: bloomEase } },
});

type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';

function CrystalAvatar({ state, accent, size }: { state: AvatarState; accent: string; size: string }) {
  const layer: React.CSSProperties = { position: 'absolute', inset: 0 };
  return (
    <div style={{ position: 'relative', width: size, aspectRatio: '1/1', margin: '0 auto' }}>
      {/* ハロー (傾聴で明るく) */}
      <motion.div
        aria-hidden
        animate={{ opacity: state === 'listening' ? 0.9 : state === 'speaking' ? 0.75 : 0.45 }}
        transition={{ duration: 0.8 }}
        style={{
          ...layer, borderRadius: '50%',
          background: `radial-gradient(circle, ${accent}33 0%, rgba(170,196,236,0.22) 34%, transparent 68%)`,
          filter: 'blur(18px)', transform: 'scale(1.35)',
        }}
      />
      {/* 呼吸 (常時) → 思考でゆっくり回転 → 傾聴で花がさらに開く */}
      <motion.div
        animate={{ scale: [1, 1.024, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        style={layer}
      >
        <motion.div
          animate={state === 'thinking' ? { rotate: 360 } : { rotate: 0 }}
          transition={state === 'thinking'
            ? { duration: 22, repeat: Infinity, ease: 'linear' }
            : { duration: 1.4, ease: bloomEase }}
          style={layer}
        >
          <motion.div
            initial="closed"
            animate="open"
            style={layer}
          >
            {/* 開花: 外輪 → 中輪 → 内輪 → 芯 */}
            <motion.div
              variants={ringVariants(0.15, 1.7)}
              animate={state === 'listening' ? { scale: 1.06 } : { scale: 1 }}
              transition={{ duration: 0.9, ease: bloomEase }}
              style={layer}
            >
              <RingSvg id="czR1" count={12} offset={0} stops={['rgba(226,238,255,0.9)', 'rgba(142,172,216,0.6)', 'rgba(54,78,120,0.72)']} />
            </motion.div>
            <motion.div variants={ringVariants(0.55, 1.5)} style={layer}>
              <RingSvg id="czR2" count={9} offset={20} petalScale={0.66} stops={['rgba(248,251,255,0.95)', 'rgba(182,205,238,0.68)', 'rgba(92,122,168,0.68)']} />
            </motion.div>
            <motion.div variants={ringVariants(0.95, 1.3)} style={layer}>
              <RingSvg id="czR3" count={6} offset={10} petalScale={0.4} stops={['rgba(255,255,255,0.98)', 'rgba(214,228,248,0.85)', 'rgba(150,178,218,0.8)']} />
            </motion.div>
            {/* 芯 (発話で脈動) */}
            <motion.div
              variants={{ closed: { scale: 0, opacity: 0 }, open: { scale: 1, opacity: 1, transition: { delay: 1.3, duration: 0.9, ease: bloomEase } } }}
              style={{ ...layer, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <motion.div
                animate={state === 'speaking' ? { scale: [1, 1.35, 1], opacity: [0.85, 1, 0.85] } : { scale: 1, opacity: 0.85 }}
                transition={state === 'speaking' ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.6 }}
                style={{
                  width: '15%', aspectRatio: '1/1', borderRadius: '50%',
                  background: `radial-gradient(circle, rgba(255,255,255,0.98) 0%, ${accent}AA 55%, transparent 75%)`,
                  filter: 'blur(1px)',
                }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
      {/* 結晶をなでる光 */}
      <div aria-hidden className="czs-glint" style={{ ...layer, borderRadius: '50%' }} />
    </div>
  );
}

// ─── アイコン (OS絵文字不使用・線画SVG) ─────────────────
function MicIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      {on ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> : <path d="M23 9l-6 6M17 9l6 6" />}
    </svg>
  );
}
function HistoryIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3.5 2" />
    </svg>
  );
}

const iconBtn: React.CSSProperties = {
  width: 42, height: 42, minWidth: 42, borderRadius: 999, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: `1px solid ${T.line}`, background: T.glassLight, color: T.fg,
  backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
};

// ─── ガラスの下部シート ─────────────────────────
function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'absolute', inset: 0, background: 'rgba(10,16,30,0.5)', zIndex: 40 }}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 260 }}
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 41,
              maxHeight: '72%', display: 'flex', flexDirection: 'column',
              borderRadius: '24px 24px 0 0', border: `1px solid ${T.line}`, borderBottom: 'none',
              background: 'rgba(30,40,60,0.85)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
              padding: '18px 20px calc(16px + env(safe-area-inset-bottom))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', color: T.fgMuted }}>{title}</div>
              <button onClick={onClose} aria-label="閉じる" style={{ ...iconBtn, width: 38, height: 38, minWidth: 38 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div style={{ overflowY: 'auto', minHeight: 0 }}>{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const sheetInput: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', minHeight: 46, padding: '11px 14px',
  borderRadius: 13, border: `1px solid ${T.line}`, outline: 'none',
  background: 'rgba(13,20,34,0.5)', color: T.fg, fontSize: 16, fontFamily: SANS,
};

// ─── 本体 ─────────────────────────────────
export default function ConciergeStage({ config }: { config: ConciergeConfig }) {
  const cz = useConcierge(config);
  const [input, setInput] = useState('');
  const [voiceOn, setVoiceOn] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [lead, setLead] = useState<LeadDraft>({ name: '', email: '', note: '' });
  const [use3d] = useState(canUseWebgl);

  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;
  const sendRef = useRef(cz.send);
  sendRef.current = cz.send;

  // 音声入力: 話し終えたら自動送信 (「話しかけるだけ」)
  const onVoice = useCallback((text: string, isFinal: boolean) => {
    if (!isFinal) { setInput(text); return; }
    const t = text.trim();
    setInput('');
    if (t) void sendRef.current(t);
  }, []);
  const voice = useVoiceInput(onVoice, { lang: 'ja-JP', interimResults: true, silenceTimeout: 2600 });
  const recording = voice.state === 'listening' || voice.state === 'processing';

  // アバター状態: 録音中は listening を優先
  const state: AvatarState = recording ? 'listening' : cz.state;
  useEffect(() => { cz.setListening(recording); }, [recording]); // eslint-disable-line react-hooks/exhaustive-deps

  // 声で返す: 新しい応答が確定したら読み上げ (ミュート可)
  const spokenRef = useRef<string | null>(null);
  useEffect(() => {
    const last = cz.rawMessages[cz.rawMessages.length - 1];
    if (!last || last.role !== 'assistant' || spokenRef.current === last.id) return;
    spokenRef.current = last.id;
    if (voiceOnRef.current) speak(last.content);
  }, [cz.rawMessages]);
  useEffect(() => () => stopSpeaking(), []);

  // iOS の TTS はユーザー操作内で一度 "起こす" 必要がある
  const ttsUnlocked = useRef(false);
  const unlockTts = () => {
    if (ttsUnlocked.current || typeof window === 'undefined' || !window.speechSynthesis) return;
    try { const u = new SpeechSynthesisUtterance(''); window.speechSynthesis.speak(u); } catch { /* */ }
    ttsUnlocked.current = true;
  };

  const submitText = (e?: React.FormEvent) => {
    e?.preventDefault();
    const t = input.trim();
    if (!t) return;
    unlockTts();
    setInput('');
    void cz.send(t);
  };

  const toggleMic = () => {
    unlockTts();
    if (recording) voice.stop();
    else { setInput(''); voice.start(); }
  };

  // 字幕エリアの内容
  const lastUser = [...cz.messages].reverse().find(m => m.role === 'user');
  const lastAssistant = [...cz.messages].reverse().find(m => m.role === 'assistant');
  const hasConversation = cz.messages.length > 0 || cz.isLoading || !!cz.error;

  const chips = (config.services || []).slice(0, 4);

  return (
    <section style={{
      position: 'relative', height: '100svh', minHeight: 560, overflow: 'hidden',
      color: T.fg, fontFamily: SANS,
      background: `radial-gradient(120% 90% at 50% -20%, #55688C 0%, #33415C 45%, #222C42 100%)`,
    }}>
      <style>{`
        .czs-glint { background: conic-gradient(from 0deg, transparent 0 72%, rgba(255,255,255,0.09) 77%, transparent 82%);
                     mix-blend-mode: screen; pointer-events: none; filter: blur(6px);
                     animation: czsGlint 13s linear infinite; }
        @keyframes czsGlint { to { transform: rotate(360deg); } }
        .czs-pulse { animation: czsPulse 1.6s ease-in-out infinite; }
        @keyframes czsPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(244,247,252,0.35); } 50% { box-shadow: 0 0 0 12px rgba(244,247,252,0); } }
        .czs-dots span { animation: czsDot 1.2s ease-in-out infinite; display: inline-block; }
        .czs-dots span:nth-child(2) { animation-delay: 0.15s; } .czs-dots span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes czsDot { 0%,100% { opacity: 0.25; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-3px); } }
        @media (prefers-reduced-motion: reduce) { .czs-glint, .czs-pulse, .czs-dots span { animation: none; } }
      `}</style>
      {/* 実3Dのクリスタル・ロータス (背景全面) */}
      {use3d && (
        <Suspense fallback={null}>
          <CrystalScene state={state} accent={config.accentColor} />
        </Suspense>
      )}

      <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: NOISE, pointerEvents: 'none' }} />

      {/* 奥でぼける残響の花 (SVGフォールバック時のみ) */}
      {!use3d && (
        <div aria-hidden style={{
          position: 'absolute', left: '50%', bottom: '-30%', width: 'min(160%, 1100px)', aspectRatio: '1/1',
          transform: 'translateX(-50%)', filter: 'blur(34px)', opacity: 0.32, pointerEvents: 'none',
        }}>
          <RingSvg id="czEchoS" count={12} offset={0} stops={['rgba(226,238,255,0.9)', 'rgba(142,172,216,0.6)', 'rgba(54,78,120,0.72)']} />
        </div>
      )}

      {/* ── 上部: 最小限のバー ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        padding: 'calc(12px + env(safe-area-inset-top)) clamp(14px, 3vw, 28px) 12px',
      }}>
        <a href="/crystal" style={{ textDecoration: 'none', color: T.fg, fontFamily: SERIF, fontWeight: 400, fontSize: 16, letterSpacing: '0.34em', whiteSpace: 'nowrap' }}>
          CRYSTAL
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setVoiceOn(v => { if (v) stopSpeaking(); return !v; })} aria-label={voiceOn ? '声を消す' : '声を出す'} style={{ ...iconBtn, color: voiceOn ? T.fg : T.fgSubtle }}>
            <SoundIcon on={voiceOn} />
          </button>
          <button onClick={() => setHistoryOpen(true)} aria-label="会話履歴" style={iconBtn}>
            <HistoryIcon />
          </button>
          <a href="#setup" style={{
            display: 'inline-flex', alignItems: 'center', minHeight: 42, padding: '8px 16px',
            borderRadius: 999, border: `1px solid ${T.line}`, background: T.glassLight,
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            color: T.fg, textDecoration: 'none', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
          }}>
            設置と料金
          </a>
        </div>
      </div>

      {/* ── 中央: アバター + 字幕 (3D時は花がcanvas側にあるので字幕を下寄せ) ── */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: use3d ? 'flex-end' : 'center', padding: '64px 18px 132px',
      }}>
        {!use3d && <CrystalAvatar state={state} accent={config.accentColor} size="min(52svh, 76vw, 470px)" />}

        {/* 字幕 */}
        <div style={{ width: '100%', maxWidth: 660, textAlign: 'center', marginTop: 'clamp(6px, 2svh, 22px)', minHeight: 118, maxHeight: '36svh', overflowY: 'auto' }}>
          {!hasConversation ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6, duration: 1 }}>
              <div style={{ fontFamily: SERIF, fontSize: 'clamp(20px, 3.4vw, 30px)', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 8 }}>
                {config.brandName}
              </div>
              <div style={{ fontSize: 13.5, color: T.fgMuted, letterSpacing: '0.08em', marginBottom: 18 }}>
                {config.tagline} — 話しかけるだけで、ご案内します。
              </div>
              {chips.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  {chips.map(s => (
                    <button
                      key={s}
                      onClick={() => { unlockTts(); void cz.send(s); }}
                      style={{
                        minHeight: 40, padding: '9px 16px', borderRadius: 999, cursor: 'pointer',
                        border: `1px solid ${T.line}`, background: T.glassLight, color: T.fg,
                        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                        fontSize: 13, fontFamily: SANS,
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <div>
              {lastUser && (
                <div style={{
                  fontSize: 12, color: T.fgSubtle, letterSpacing: '0.06em', marginBottom: 10,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  — {lastUser.content}
                </div>
              )}
              {cz.isLoading ? (
                <div className="czs-dots" style={{ fontSize: 24, color: T.fgMuted, letterSpacing: 6 }} aria-label="考え中">
                  <span>·</span><span>·</span><span>·</span>
                </div>
              ) : cz.error ? (
                <div>
                  <div style={{ fontSize: 14, lineHeight: 1.9, color: T.fgMuted, marginBottom: 12 }}>{cz.error}</div>
                  {cz.canRetry && (
                    <button onClick={() => { unlockTts(); cz.retry(); }} style={{
                      minHeight: 44, padding: '10px 22px', borderRadius: 999, cursor: 'pointer',
                      border: 'none', background: '#F4F7FC', color: '#1B2333', fontSize: 13.5, fontWeight: 700,
                    }}>
                      もう一度ためす
                    </button>
                  )}
                </div>
              ) : lastAssistant ? (
                <div style={{
                  fontSize: 'clamp(15.5px, 2vw, 18px)', lineHeight: 2.05, color: T.fg,
                  textShadow: '0 2px 24px rgba(16,26,46,0.5)', whiteSpace: 'pre-wrap',
                }}>
                  {lastAssistant.content}
                </div>
              ) : null}
              {/* 予約ページ (AI の [action:booking] で自動表示) */}
              {!cz.isLoading && !cz.error && lastAssistant?.bookingUrl && (
                <a
                  href={lastAssistant.bookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    marginTop: 16, minHeight: 46, padding: '11px 26px', borderRadius: 999,
                    background: '#F4F7FC', color: '#1B2333', textDecoration: 'none',
                    fontSize: 13.5, fontWeight: 800, letterSpacing: '0.04em',
                  }}
                >
                  ご予約ページを開く
                </a>
              )}
              {/* 日程希望 (会話が進んだら常設の小さな導線) */}
              {!cz.isLoading && !cz.error && !cz.leadSent && cz.messages.length >= 2 && (
                <button onClick={cz.openLead} style={{
                  marginTop: 16, minHeight: 40, padding: '9px 18px', borderRadius: 999, cursor: 'pointer',
                  border: `1px solid ${T.line}`, background: T.glassLight, color: T.fgMuted,
                  backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', fontSize: 12.5,
                }}>
                  ご案内の日程を希望する
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 下部: 入力 (マイク主体) ── */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 30,
        padding: '0 16px calc(18px + env(safe-area-inset-bottom))',
        display: 'flex', justifyContent: 'center',
      }}>
        <form onSubmit={submitText} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: 'min(680px, 100%)',
          borderRadius: 999, border: `1px solid ${T.line}`, background: T.glass,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          padding: 6, boxShadow: '0 18px 50px rgba(10,16,32,0.45)',
        }}>
          {voice.isAvailable && (
            <button
              type="button"
              onClick={toggleMic}
              aria-label={recording ? '聞き取りを止める' : '声で話しかける'}
              className={recording ? 'czs-pulse' : undefined}
              style={{
                width: 52, height: 52, minWidth: 52, borderRadius: 999, cursor: 'pointer', border: 'none',
                background: recording ? '#F4F7FC' : `linear-gradient(160deg, ${config.accentColor}, ${config.accentColor}88)`,
                color: recording ? '#1B2333' : '#10182A',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <MicIcon />
            </button>
          )}
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onFocus={() => cz.setListening(true)}
            onBlur={() => cz.setListening(false)}
            placeholder={recording ? '聞いています…' : '話しかける か、ここに書く…'}
            aria-label="コンシェルジュへのメッセージ"
            style={{
              flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
              color: T.fg, fontSize: 16, fontFamily: SANS, padding: '10px 6px',
            }}
          />
          <button
            type="submit"
            aria-label="送信"
            disabled={!input.trim() || cz.isLoading}
            style={{
              width: 46, height: 46, minWidth: 46, borderRadius: 999,
              border: `1px solid ${T.line}`, cursor: input.trim() ? 'pointer' : 'default',
              background: input.trim() ? '#F4F7FC' : 'transparent',
              color: input.trim() ? '#1B2333' : T.fgSubtle,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <SendIcon />
          </button>
        </form>
      </div>

      {/* マイク不許可などの復旧案内 (silent fail 禁止) */}
      {voice.errorCode && (
        <div style={{
          position: 'absolute', bottom: 'calc(86px + env(safe-area-inset-bottom))', left: 16, right: 16, zIndex: 29,
          textAlign: 'center', fontSize: 12, color: T.fgMuted,
        }}>
          {voice.errorCode === 'not-allowed'
            ? 'マイクが許可されていません。ブラウザの設定で許可すると、声で話せます (文字入力はそのまま使えます)。'
            : 'マイクを使えませんでした。文字入力はそのまま使えます。'}
        </div>
      )}

      {/* ── 会話履歴シート ── */}
      <Sheet open={historyOpen} onClose={() => setHistoryOpen(false)} title="会話履歴">
        {cz.rawMessages.length === 0 ? (
          <div style={{ fontSize: 13, color: T.fgSubtle, padding: '12px 2px' }}>まだ会話はありません。</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
            {cz.rawMessages.map(m => (
              <div key={m.id} style={{ fontSize: 13.5, lineHeight: 1.9 }}>
                <span style={{ color: m.role === 'user' ? T.fgSubtle : T.fgMuted, fontWeight: 700, marginRight: 8 }}>
                  {m.role === 'user' ? 'あなた' : config.conciergeName || 'コンシェルジュ'}
                </span>
                <span style={{ color: T.fg, whiteSpace: 'pre-wrap' }}>{m.content}</span>
              </div>
            ))}
          </div>
        )}
      </Sheet>

      {/* ── リード (ご案内希望) シート ── */}
      <Sheet open={cz.leadOpen} onClose={cz.closeLead} title="ご案内の日程を承ります">
        <p style={{ margin: '0 0 14px', fontSize: 12.5, lineHeight: 1.8, color: T.fgMuted }}>
          ご連絡先をお預かりし、担当より折り返しご連絡いたします。
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input style={sheetInput} value={lead.name} onChange={e => setLead(p => ({ ...p, name: e.target.value }))} placeholder="お名前" aria-label="お名前" />
          <input style={sheetInput} type="email" value={lead.email || cz.detectedEmail} onChange={e => setLead(p => ({ ...p, email: e.target.value }))} placeholder="メールアドレス (必須)" aria-label="メールアドレス" />
          <textarea style={{ ...sheetInput, minHeight: 72, resize: 'vertical', lineHeight: 1.7 }} value={lead.note} onChange={e => setLead(p => ({ ...p, note: e.target.value }))} placeholder="ご希望 (例: 今週末の午後、オンラインで)" aria-label="ご希望" />
          {cz.leadError && <div style={{ fontSize: 12.5, color: '#F2B8C6' }}>{cz.leadError}</div>}
          <button
            onClick={() => void cz.submitLead({ ...lead, email: lead.email || cz.detectedEmail })}
            disabled={cz.leadSending}
            style={{
              minHeight: 50, borderRadius: 999, border: 'none', cursor: 'pointer',
              background: '#F4F7FC', color: '#1B2333', fontSize: 14, fontWeight: 800, letterSpacing: '0.04em',
              opacity: cz.leadSending ? 0.7 : 1,
            }}
          >
            {cz.leadSending ? '送信しています…' : 'この内容で希望する'}
          </button>
        </div>
      </Sheet>
    </section>
  );
}
