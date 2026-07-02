// ============================================================
// ConciergeWidget — 高級コンシェルジュ・チャットパネル
//
// グラスモーフィズム (blur 24px / 半透明レイヤ / 1px 白ボーダー / 角丸 24px) の
// パネルに Living Portrait のコンシェルジュが常駐。silk のような spring で開閉し、
// メッセージは下からふわりと入場する。どんな背景 (明/暗) の上でも読めるよう、
// パネル自身が深色ガラスの地を持つ (文字は常に白系 = コントラスト保証)。
//
// variant:
//   'inline'   = ショーケースのヒーロー内に常時開いた状態で置く
//   'floating' = 右下バブル (56px 金縁グラス球) → タップでパネル展開 (埋め込み用)
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ConciergeConfig } from './conciergeConfig';
import { useConcierge } from './useConcierge';
import ConciergeAvatar, { type AvatarProvider } from './ConciergeAvatar';
import { readableTextColor } from '../../lib/contrast';

interface Props {
  config: ConciergeConfig;
  variant?: 'inline' | 'floating';
  avatarProvider?: AvatarProvider;
  /** floating の開閉通知 (埋め込み iframe の resize 連携に使う) */
  onOpenChange?: (open: boolean) => void;
}

const SILK = { type: 'spring' as const, stiffness: 260, damping: 30, mass: 0.9 };

// パネル内で使う自前トークン (背景がどんな色でも成立する深色ガラス)
const T = {
  fg: '#F4F1E8',
  fgMuted: 'rgba(244,241,232,0.66)',
  fgSubtle: 'rgba(244,241,232,0.45)',
  glass: 'linear-gradient(168deg, rgba(24,27,43,0.86) 0%, rgba(10,11,20,0.93) 100%)',
  surface: 'rgba(255,255,255,0.07)',
  border: 'rgba(255,255,255,0.16)',
  borderSoft: 'rgba(255,255,255,0.10)',
};

const STATE_LABEL: Record<string, string> = {
  idle: 'ただいまご案内できます',
  listening: '伺っております',
  thinking: '考えております…',
  speaking: 'ご案内しております',
};

function IconSend({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 9l7-7M14 2l-4.5 12-2.5-5-5-2.5L14 2z" />
    </svg>
  );
}

function IconClose({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M3 3l8 8M11 3l-8 8" />
    </svg>
  );
}

function IconCalendar({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="2" y="3" width="12" height="11" rx="2" />
      <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
    </svg>
  );
}

function IconCheck({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 7.5l3 3 6-7" />
    </svg>
  );
}

export default function ConciergeWidget({ config, variant = 'inline', avatarProvider = 'portrait', onOpenChange }: Props) {
  const c = useConcierge(config);
  const accent = config.accentColor;
  const accentFg = readableTextColor(accent);
  const [open, setOpen] = useState(variant === 'inline');
  const [input, setInput] = useState('');
  const [lead, setLead] = useState({ name: '', email: '', note: '' });
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [c.messages, c.isLoading, c.leadOpen]);

  // リードカードを開いたとき、会話から検出済みのメールを初期値に
  useEffect(() => {
    if (c.leadOpen) setLead(prev => ({ ...prev, email: prev.email || c.detectedEmail }));
  }, [c.leadOpen, c.detectedEmail]);

  const submit = async () => {
    const msg = input.trim();
    if (!msg || c.isLoading) return;
    setInput('');
    await c.send(msg);
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); }
  };

  const toggle = (v: boolean) => setOpen(v);

  const hasMsgs = c.messages.length > 0;

  const panel = (
    <motion.div
      key="panel"
      initial={variant === 'floating' ? { opacity: 0, y: 28, scale: 0.94 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={variant === 'floating' ? { opacity: 0, y: 28, scale: 0.94 } : undefined}
      transition={SILK}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: variant === 'floating' ? 'min(392px, calc(100vw - 16px))' : '100%',
        height: variant === 'floating' ? 'min(640px, calc(100svh - 24px))' : '100%',
        maxWidth: 420,
        background: T.glass,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: `1px solid ${T.border}`,
        borderRadius: 24,
        boxShadow: `0 24px 80px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.10)`,
        overflow: 'hidden',
        position: 'relative',
        color: T.fg,
      }}
    >
      {/* ── ヘッダ ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px 12px 16px', borderBottom: `1px solid ${T.borderSoft}` }}>
        <ConciergeAvatar state={c.state} size={44} accent={accent} avatarProvider={avatarProvider} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {config.brandName}
          </div>
          <div style={{ fontSize: 11, color: T.fgMuted, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: 6, height: 6, borderRadius: 999, background: accent, boxShadow: `0 0 8px ${accent}`, flexShrink: 0 }}
            />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{STATE_LABEL[c.state]}</span>
          </div>
        </div>
        {variant === 'floating' && (
          <button
            onClick={() => toggle(false)}
            aria-label="閉じる"
            style={{
              width: 44, height: 44, borderRadius: 12, border: `1px solid ${T.borderSoft}`,
              background: 'transparent', color: T.fgMuted, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <IconClose />
          </button>
        )}
      </div>

      {/* ── 会話スレッド ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 8px', WebkitOverflowScrolling: 'touch' }}>
        {/* お迎えの挨拶 (常設・ローカル) */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SILK, delay: 0.15 }}
          style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}
        >
          <div style={{
            maxWidth: '88%', padding: '10px 14px', borderRadius: '4px 18px 18px 18px',
            background: T.surface, border: `1px solid ${T.borderSoft}`,
            fontSize: 14, lineHeight: 1.75, whiteSpace: 'pre-wrap',
          }}>
            いらっしゃいませ。{config.brandName} の{config.conciergeName || 'コンシェルジュ'}でございます。{'\n'}本日はどのようなご用件でしょうか。
          </div>
        </motion.div>

        {/* はじめのご用件チップ (会話前のみ) */}
        {!hasMsgs && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SILK, delay: 0.3 }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '4px 0 12px' }}
          >
            {config.services.slice(0, 4).map(s => (
              <button
                key={s}
                onClick={() => void c.send(s + 'についてお伺いしたいです')}
                style={{
                  minHeight: 44, padding: '10px 14px', borderRadius: 999,
                  border: `1px solid ${accent}55`, background: `${accent}14`,
                  color: T.fg, fontSize: 13, cursor: 'pointer', letterSpacing: '0.02em',
                }}
              >
                {s}
              </button>
            ))}
          </motion.div>
        )}

        {c.messages.map(m => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SILK}
            style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}
          >
            <div style={{
              maxWidth: '88%', padding: '10px 14px',
              borderRadius: m.role === 'user' ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
              background: m.role === 'user' ? accent : T.surface,
              color: m.role === 'user' ? accentFg : T.fg,
              border: m.role === 'user' ? `1px solid ${accent}` : `1px solid ${T.borderSoft}`,
              fontSize: 14, lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {m.content}
            </div>
          </motion.div>
        ))}

        {/* 考え中インジケータ */}
        {c.isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
            <div style={{ padding: '10px 14px', borderRadius: '4px 18px 18px 18px', background: T.surface, border: `1px solid ${T.borderSoft}`, display: 'flex', gap: 5, alignItems: 'center' }}>
              {[0, 1, 2].map(d => (
                <motion.span
                  key={d}
                  style={{ width: 5, height: 5, borderRadius: 999, background: accent, display: 'inline-block' }}
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
                />
              ))}
            </div>
          </div>
        )}

        {/* エラー: 隠さず、再試行手段とセットで */}
        {c.error && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{
              margin: '4px 0 10px', padding: '10px 12px', borderRadius: 14,
              background: 'rgba(180,60,60,0.16)', border: '1px solid rgba(220,120,120,0.4)',
              fontSize: 12.5, lineHeight: 1.6, color: '#FFD9D9',
            }}
          >
            応答できませんでした ({c.error})
            {c.canRetry && (
              <button
                onClick={c.retry}
                style={{
                  display: 'block', marginTop: 8, minHeight: 40, padding: '8px 14px', borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)',
                  color: T.fg, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                もう一度送る
              </button>
            )}
          </motion.div>
        )}

        {/* リード送信済みバッジ */}
        {c.leadSent && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SILK}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, margin: '2px 0 10px',
              padding: '8px 14px', borderRadius: 999,
              background: `${accent}1E`, border: `1px solid ${accent}66`,
              fontSize: 12.5, color: T.fg,
            }}
          >
            <span style={{ color: accent, display: 'flex' }}><IconCheck /></span>
            ご連絡先を承りました
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── 日程希望チップ + 入力欄 ── */}
      <div style={{ padding: '8px 12px calc(10px + env(safe-area-inset-bottom))', borderTop: `1px solid ${T.borderSoft}` }}>
        {!c.leadSent && (
          <button
            onClick={c.openLead}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 40,
              padding: '8px 14px', marginBottom: 8, borderRadius: 999,
              border: `1px solid ${accent}66`, background: `${accent}12`,
              color: T.fg, fontSize: 12.5, cursor: 'pointer', letterSpacing: '0.02em',
            }}
          >
            <span style={{ color: accent, display: 'flex' }}><IconCalendar /></span>
            ご案内の日程を希望する
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <textarea
            ref={taRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            onFocus={() => c.setListening(true)}
            onBlur={() => c.setListening(false)}
            rows={1}
            placeholder="ご質問をどうぞ…"
            style={{
              flex: 1, background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.borderSoft}`,
              borderRadius: 14, outline: 'none', resize: 'none',
              color: T.fg, fontSize: 16, lineHeight: 1.5,
              padding: '11px 14px', maxHeight: 110, minHeight: 44,
            }}
          />
          <button
            onClick={() => void submit()}
            disabled={!input.trim() || c.isLoading}
            aria-label="送信"
            style={{
              height: 44, minWidth: 44, borderRadius: 13, border: 'none',
              cursor: input.trim() && !c.isLoading ? 'pointer' : 'default',
              background: input.trim() && !c.isLoading ? accent : 'rgba(255,255,255,0.08)',
              color: input.trim() && !c.isLoading ? accentFg : T.fgSubtle,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              transition: 'background 0.15s',
            }}
          >
            <IconSend />
          </button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 7 }}>
          <a
            href="https://core-prism-app.vercel.app/concierge"
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 10, color: T.fgSubtle, textDecoration: 'none', letterSpacing: '0.08em' }}
          >
            Powered by CORE Prism
          </a>
        </div>
      </div>

      {/* ── リードカード (パネル内オーバーレイ) ── */}
      <AnimatePresence>
        {c.leadOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', inset: 0, zIndex: 5,
              background: 'rgba(6,7,14,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 12,
            }}
            onClick={c.closeLead}
          >
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 32 }}
              transition={SILK}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', borderRadius: 20, padding: '18px 16px 16px',
                background: 'linear-gradient(168deg, rgba(30,33,52,0.98), rgba(14,15,26,0.99))',
                border: `1px solid ${T.border}`,
                boxShadow: '0 18px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ color: accent, display: 'flex' }}><IconCalendar size={16} /></span>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.02em' }}>ご案内の日程を承ります</div>
              </div>
              <div style={{ fontSize: 12, color: T.fgMuted, lineHeight: 1.6, marginBottom: 14 }}>
                ご連絡先をお預かりし、担当より折り返しご連絡いたします。
              </div>
              {[
                { key: 'name' as const, label: 'お名前', placeholder: '山田 花子', type: 'text' },
                { key: 'email' as const, label: 'メールアドレス (必須)', placeholder: 'you@example.com', type: 'email' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 11, color: T.fgMuted, marginBottom: 5, letterSpacing: '0.04em' }}>{f.label}</label>
                  <input
                    type={f.type}
                    value={lead[f.key]}
                    onChange={e => setLead(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{
                      width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 13px',
                      borderRadius: 12, border: `1px solid ${T.borderSoft}`, outline: 'none',
                      background: 'rgba(255,255,255,0.06)', color: T.fg, fontSize: 16,
                    }}
                  />
                </div>
              ))}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, color: T.fgMuted, marginBottom: 5, letterSpacing: '0.04em' }}>ご希望 (任意)</label>
                <textarea
                  value={lead.note}
                  onChange={e => setLead(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="例: 今週末の午後、オンラインで相談したい"
                  rows={2}
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 12,
                    border: `1px solid ${T.borderSoft}`, outline: 'none', resize: 'none',
                    background: 'rgba(255,255,255,0.06)', color: T.fg, fontSize: 16, lineHeight: 1.5,
                  }}
                />
              </div>
              {c.leadError && (
                <div style={{ fontSize: 12, color: '#FFB9B9', marginBottom: 10, lineHeight: 1.5 }}>{c.leadError}</div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={c.closeLead}
                  style={{
                    flex: 1, minHeight: 46, borderRadius: 13, border: `1px solid ${T.borderSoft}`,
                    background: 'transparent', color: T.fgMuted, fontSize: 14, cursor: 'pointer',
                  }}
                >
                  戻る
                </button>
                <button
                  onClick={() => void c.submitLead(lead)}
                  disabled={c.leadSending}
                  style={{
                    flex: 2, minHeight: 46, borderRadius: 13, border: 'none',
                    background: accent, color: accentFg, fontSize: 14, fontWeight: 700,
                    cursor: c.leadSending ? 'default' : 'pointer', letterSpacing: '0.03em',
                    opacity: c.leadSending ? 0.7 : 1,
                  }}
                >
                  {c.leadSending ? '送信しています…' : 'この内容で希望する'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  if (variant === 'inline') return panel;

  // ── floating: 右下バブル ⇄ パネル ──
  return (
    <div
      style={{
        position: 'fixed',
        right: 'max(12px, env(safe-area-inset-right))',
        bottom: 'max(12px, env(safe-area-inset-bottom))',
        zIndex: 2147483000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      <AnimatePresence mode="wait">
        {open ? panel : (
          <motion.button
            key="bubble"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={SILK}
            onClick={() => toggle(true)}
            aria-label={`${config.brandName} のコンシェルジュに相談する`}
            style={{
              width: 56, height: 56, borderRadius: '50%', padding: 0,
              border: `1.5px solid ${accent}`,
              background: 'radial-gradient(120% 120% at 30% 25%, rgba(40,44,66,0.92), rgba(10,11,20,0.96))',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              boxShadow: `0 8px 28px rgba(0,0,0,0.45), 0 0 18px ${accent}44, inset 0 1px 0 rgba(255,255,255,0.18)`,
              cursor: 'pointer', display: 'grid', placeItems: 'center',
            }}
          >
            <ConciergeAvatar state="idle" size={40} accent={accent} avatarProvider={avatarProvider} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
