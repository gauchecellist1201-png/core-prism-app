// ============================================================
// SupportChat — 画面右側に常駐するAIサポートチャット (Wix「アリア」相当)
// FAB で開閉、デスクトップは右側ドロワー、モバイルはボトムシート
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSupportChat, type SupportContext } from '../hooks/useSupportChat';
import { useTypewriter } from '../hooks/useTypewriter';
import VoiceConversation from './VoiceConversation';
import { PrismLogo, IrisLogo } from './Logo';
import { confirmAction } from '../lib/confirmDialog';

interface Props {
  brand: 'prism' | 'iris';
  accentColor: string;
  context?: Omit<SupportContext, 'brand'>;
}

const SUGGESTIONS_PRISM = [
  '今日まず何から手をつければいい？',
  'CRM に新しい案件をどう追加する？',
  '見積から請求書まで自動で作りたい',
  '音声メモ機能はどこから使える？',
  'マスターモードって何？',
];

const SUGGESTIONS_IRIS = [
  '案件の管理はどうやるの？',
  'Instagram アカウントの分析方法を教えて',
  '投稿のキャプションを AI に書かせたい',
  '料金プランの違いを教えて',
  'コミュニティ機能の使い方は？',
];

export default function SupportChat({ brand, accentColor, context }: Props) {
  const ctx: SupportContext = { brand, ...context };
  const { messages, open, setOpen, isLoading, error, send, clear } = useSupportChat(ctx);
  const [input, setInput] = useState('');
  const [voiceCallOpen, setVoiceCallOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const ctxString = [
    context?.page && `ページ: ${context.page}`,
    context?.personaName && `ペルソナ: ${context.personaName}`,
    typeof context?.taskCount === 'number' && `タスク: ${context.taskCount}件`,
    typeof context?.dealCount === 'number' && `案件: ${context.dealCount}件`,
  ].filter(Boolean).join(' / ');

  const aiName = brand === 'iris' ? 'アイリス' : 'プリズム';
  const BrandIcon = brand === 'iris' ? IrisLogo : PrismLogo;
  const suggestions = brand === 'iris' ? SUGGESTIONS_IRIS : SUGGESTIONS_PRISM;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, open]);

  // Cmd+/ または Ctrl+/ で開閉
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, setOpen]);

  const handleSend = async (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || isLoading) return;
    setInput('');
    await send(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const unreadAssistant = messages.filter(m => m.role === 'assistant').length;

  return (
    <>
      {/* Floating Action Button — デスクトップ: 中央右寄り / モバイル: 中央下で目立つ */}
      <AnimatePresence>
        {!open && (
          <motion.div
            key="fab-wrap"
            className="cp-ai-fab-wrap fixed z-40 flex flex-col items-center"
            initial={{ scale: 0, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0, y: 12 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          >
            {/* breathing リング */}
            <div className="relative">
              <motion.div
                aria-hidden
                animate={{ scale: [1, 1.45], opacity: [0.55, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
                className="cp-ai-fab-ring absolute inset-0 rounded-full"
                style={{ background: `radial-gradient(circle, ${accentColor}77 0%, ${accentColor}00 70%)` }}
              />
              <motion.div
                aria-hidden
                animate={{ scale: [1, 1.7], opacity: [0.35, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut', delay: 0.7 }}
                className="cp-ai-fab-ring absolute inset-0 rounded-full"
                style={{ background: `radial-gradient(circle, ${accentColor}55 0%, ${accentColor}00 70%)` }}
              />

              <motion.button
                onClick={() => setOpen(true)}
                className="cp-ai-fab relative flex items-center justify-center rounded-full"
                style={{
                  background: `radial-gradient(circle at 30% 28%, rgba(255,255,255,0.22), transparent 55%), linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                  color: '#fff',
                  boxShadow: `0 16px 44px ${accentColor}88, 0 6px 14px rgba(0,0,0,0.3), inset 0 0 18px rgba(255,255,255,0.12)`,
                  border: `1px solid ${accentColor}aa`,
                }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.93 }}
                aria-label={`${aiName} と話す`}
                title={`${aiName} に質問・通話 (⌘/)`}
              >
                {/* 回転するスペクトル */}
                <motion.span
                  aria-hidden
                  animate={{ rotate: 360 }}
                  transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    background: `conic-gradient(from 0deg, transparent 0deg, ${accentColor}66 60deg, transparent 130deg, transparent 360deg)`,
                    filter: 'blur(6px)',
                    opacity: 0.6,
                  }}
                />
                <span className="relative z-10 flex items-center justify-center" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.45))' }}>
                  <BrandIcon size={36} withWordmark={false} />
                </span>

                {unreadAssistant > 0 && (
                  <span
                    className="absolute flex items-center justify-center rounded-full text-[10px] font-bold"
                    style={{
                      top: -4,
                      right: -4,
                      minWidth: 22,
                      height: 22,
                      padding: '0 6px',
                      background: '#fff',
                      color: accentColor,
                      border: `2px solid ${accentColor}`,
                      boxShadow: `0 2px 8px ${accentColor}66`,
                      zIndex: 11,
                    }}
                  >
                    {Math.min(unreadAssistant, 99)}
                  </span>
                )}
              </motion.button>
            </div>

            {/* ラベル (モバイルでは常時、デスクトップは hover で淡く表示) */}
            <span
              className="cp-ai-fab-label"
              style={{
                color: '#fff',
                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                boxShadow: `0 4px 12px ${accentColor}55`,
              }}
            >
              <span
                className="cp-ai-fab-label-dot"
                style={{ background: '#fff', boxShadow: `0 0 6px #fff` }}
              />
              AI と話す
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop (mobile only) */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 md:hidden"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Drawer */}
      <AnimatePresence>
        {open && (
          <motion.aside
            key="drawer"
            data-theme="dark"
            className="fixed z-50 flex flex-col overflow-hidden"
            style={{
              right: 0,
              top: 0,
              bottom: 0,
              width: '100%',
              maxWidth: 400,
              background: 'var(--surface-1, #0e0e12)',
              borderLeft: `1px solid ${accentColor}30`,
              boxShadow: `-12px 0 40px rgba(0,0,0,0.5)`,
              // iPhone Dynamic Island / ノッチに隠れないように safe-area を入れる
              // (オーナー報告 2026-06-03: ヘッダーが見切れて X が押せない)
              paddingTop: 'env(safe-area-inset-top, 0px)',
            }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          >
            {/* Header — iPhone 縦狭 (375px) 向けに「× ボタンは必ず右上に固定」+
                通話 / 履歴消去 は飽和したら省略する */}
            <header
              className="flex items-center gap-2 px-3 py-3 flex-shrink-0"
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                background: `linear-gradient(135deg, ${accentColor}18, transparent 60%)`,
              }}
            >
              {/* 左上の戻る (閉じる) — 全サービス共通で必ず左上に置く */}
              <button
                onClick={() => setOpen(false)}
                className="rounded-full flex items-center justify-center flex-shrink-0"
                aria-label="戻る"
                title="戻る"
                style={{
                  width: 36, height: 36,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.16)',
                  color: '#fff',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}, ${accentColor}99)`,
                  boxShadow: `0 4px 12px ${accentColor}55`,
                }}
              >
                <BrandIcon size={22} withWordmark={false} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight truncate" style={{ color: '#fff' }}>{aiName}</p>
                <p className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {brand === 'iris' ? 'Iris サポート' : 'Prism サポート'} ·{' '}
                  {isLoading ? '考えています…' : 'オンライン'}
                </p>
              </div>
              {/* 通話 — iPhone 縦狭ではテキストを省略 (アイコンのみ) */}
              <button
                onClick={() => setVoiceCallOpen(true)}
                className="rounded-full transition-all flex items-center justify-center font-semibold flex-shrink-0"
                style={{
                  width: 36, height: 36,
                  background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                  color: '#fff',
                  boxShadow: `0 2px 8px ${accentColor}55`,
                  fontSize: 15,
                }}
                title={`${aiName} に電話する`}
                aria-label="通話"
              >
                📞
              </button>
              {messages.length > 0 && (
                <button
                  onClick={async () => {
                    if (await confirmAction({ title: 'チャット履歴を消去しますか?', body: '消すと元に戻せません。', tone: 'danger', okLabel: '消去する' })) clear();
                  }}
                  className="rounded-full transition-colors text-fg-muted hover:text-fg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.04)', width: 36, height: 36, fontSize: 15 }}
                  title="履歴を消去"
                  aria-label="履歴を消去"
                >
                  🗑
                </button>
              )}
              {/* × は最右に必ず触れる位置で固定 (44x44 タップ領域確保) */}
              <button
                onClick={() => setOpen(false)}
                className="rounded-full flex items-center justify-center text-fg hover:text-fg leading-none flex-shrink-0"
                aria-label="閉じる"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.16)',
                  color: '#fff',
                  width: 36, height: 36,
                  fontSize: 22,
                  fontWeight: 600,
                }}
              >
                ×
              </button>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
              {messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div
                    className="rounded-2xl p-3.5"
                    style={{
                      background: `linear-gradient(135deg, ${accentColor}1a, transparent 70%)`,
                      border: `1px solid ${accentColor}30`,
                    }}
                  >
                    <p className="text-sm leading-relaxed" style={{ color: '#fff' }}>
                      こんにちは、{aiName} です。
                      <br />
                      {brand === 'iris'
                        ? '案件・投稿・分析・コミュニティのこと、何でも聞いてください。'
                        : '経営・営業・財務・機能の使い方、何でも聞いてください。'}
                    </p>
                  </div>
                  <p className="text-[11px] tracking-widest uppercase mt-4 mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    よくある質問
                  </p>
                  <div className="space-y-1.5">
                    {suggestions.map((s, i) => (
                      <motion.button
                        key={i}
                        onClick={() => handleSend(s)}
                        disabled={isLoading}
                        className="w-full text-left text-sm px-3 py-2.5 rounded-lg transition-all disabled:opacity-50"
                        whileHover={{ x: 3, background: 'rgba(255,255,255,0.08)' }}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 + i * 0.04 }}
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: `1px solid ${accentColor}40`,
                          color: '#fff',
                        }}
                      >
                        <span style={{ color: accentColor, marginRight: 6, fontWeight: 700 }}>›</span>
                        {s}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((msg, mi) => (
                  <motion.div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div
                      className="max-w-[88%] px-3 py-2 rounded-2xl text-sm leading-relaxed"
                      style={
                        msg.role === 'user'
                          ? {
                              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                              color: '#fff',
                              borderBottomRightRadius: 4,
                            }
                          : {
                              background: 'rgba(255,255,255,0.06)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              color: '#fff',
                              borderBottomLeftRadius: 4,
                            }
                      }
                    >
                      {msg.role === 'assistant' && mi === messages.length - 1
                        ? <SupportStreamingText content={msg.content} />
                        : <p className="whitespace-pre-wrap">{msg.content}</p>}
                      <p
                        className="opacity-50 mt-1"
                        style={{ fontSize: 10 }}
                      >
                        {new Date(msg.ts).toLocaleTimeString('ja-JP', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && (
                <motion.div
                  className="flex justify-start"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div
                    className="px-4 py-2.5 rounded-2xl"
                    style={{
                      background: 'var(--surface-3)',
                      border: '1px solid var(--border)',
                      borderBottomLeftRadius: 4,
                    }}
                  >
                    <div className="flex gap-1.5 items-center">
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          className="rounded-full"
                          style={{ width: 6, height: 6, background: accentColor }}
                          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Error banner */}
            {error && (
              <div
                className="px-3 py-2 mx-3 mb-2 rounded-lg text-xs"
                style={{
                  background: 'rgba(248,113,113,0.1)',
                  border: '1px solid rgba(248,113,113,0.25)',
                  color: '#f87171',
                }}
              >
                {error}
              </div>
            )}

            {/* Input */}
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSend();
              }}
              className="px-3 pb-3 pt-2 flex-shrink-0"
              style={{
                borderTop: '1px solid rgba(255,255,255,0.04)',
                paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
              }}
            >
              <div
                className="flex items-end gap-2 px-3 py-2 rounded-2xl"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${accentColor}55`,
                }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="何でも聞いてください…"
                  rows={1}
                  disabled={isLoading}
                  className="flex-1 bg-transparent text-sm outline-none resize-none leading-relaxed support-chat-input"
                  style={{ maxHeight: 120, minHeight: 24, fontSize: 16, color: '#fff' }}
                />
                <motion.button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200"
                  style={{
                    width: 32,
                    height: 32,
                    background: input.trim() ? accentColor : 'var(--surface-3)',
                    color: input.trim() ? '#fff' : 'var(--fg-muted)',
                    border: input.trim() ? 'none' : '1px solid var(--border)',
                  }}
                  whileTap={input.trim() ? { scale: 0.9 } : {}}
                  aria-label="送信"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 13V1M1 7l6-6 6 6" />
                  </svg>
                </motion.button>
              </div>
              <p className="text-[10px] text-fg-muted text-center mt-1.5 select-none">
                ⌘/ で開閉 · Enter で送信 · 📞 通話で音声会話 · ? でショートカット
              </p>
            </form>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* 音声会話モーダル */}
      <AnimatePresence>
        {voiceCallOpen && (
          <VoiceConversation
            open={voiceCallOpen}
            onClose={() => setVoiceCallOpen(false)}
            brand={brand}
            accentColor={accentColor}
            context={ctxString || undefined}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// 最新の AI 返信をタイプライター風に逐次表示
function SupportStreamingText({ content }: { content: string }) {
  const { text } = useTypewriter(content);
  return <p className="whitespace-pre-wrap">{text}</p>;
}
