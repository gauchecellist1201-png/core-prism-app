import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatMessage, Persona, AppSettings } from '../types/identity';
import { useTypewriter } from '../hooks/useTypewriter';
import ContextualUpgradeCard from './ContextualUpgradeCard';
import { isAuthorized as isAuthorizedFn, loadBillingUser } from '../lib/billing';
import ApiErrorCard from './ApiErrorCard';
import { readableTextColor } from '../lib/contrast';

interface Props {
  persona: Persona;
  messages: ChatMessage[];
  settings: AppSettings;
  onSend: (msg: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  knowledgeCount: number;
  onOpenKnowledge: () => void;
  onOpenSettings: () => void;
}

export default function AISidebar({
  persona,
  messages,
  settings,
  onSend,
  isLoading,
  error,
  knowledgeCount,
  onOpenKnowledge,
  onOpenSettings,
}: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    const msg = input.trim();
    setInput('');
    await onSend(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // /api/ai は env Gemini で fallback できるので、ユーザー鍵未設定でも AI が使える。
  // hasApiKey は常に true で扱う (UX 上の「鍵を設定してください」ガードを撤廃)。
  const hasApiKey = true;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center text-xs flex-shrink-0"
              style={{ background: persona.accentColorLight, color: persona.accentColor }}
            >
              {persona.icon}
            </div>
            <p className="text-sm text-fg truncate">AI · {persona.name}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={onOpenKnowledge}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{
                background: knowledgeCount > 0 ? persona.accentColorLight : 'var(--surface-3)',
                color: knowledgeCount > 0 ? persona.accentColor : 'var(--fg-muted)',
              }}
              title="ナレッジベース"
            >
              📚 {knowledgeCount}
            </button>
            {!hasApiKey && (
              <button
                onClick={onOpenSettings}
                className="text-xs px-2 py-1 rounded"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}
              >
                ⚠
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-fg-muted mt-0.5">
          {settings.preferredModel?.replace('claude-', '').replace('-4-5', '') ?? 'haiku'} · {knowledgeCount}件参照中
        </p>
      </div>

      {/* No API key warning は env Gemini fallback により不要になったので撤去 */}

      {/* Error — ポップ + dismiss 永続化 (60秒) + 解消手順 */}
      <ApiErrorCard error={error} onOpenSettings={onOpenSettings} variant="auto" />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <motion.div className="space-y-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="text-fg-muted text-xs tracking-wider uppercase mb-2">よく使う質問</p>
            {getSuggestions(persona).map((s, i) => (
              <motion.button
                key={i}
                onClick={() => onSend(s)}
                disabled={!hasApiKey || isLoading}
                className={`w-full text-left text-sm px-3 py-2.5 rounded-lg transition-all bg-surface-3 border-edge border ${hasApiKey ? 'text-fg' : 'text-fg-subtle'}`}
                whileHover={hasApiKey ? { x: 3, borderColor: persona.accentColor + '60' } : {}}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
              >
                {s}
              </motion.button>
            ))}
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div
                className={msg.role === 'user'
                  ? 'max-w-[88%] px-3 py-2 rounded-xl text-sm leading-relaxed'
                  : 'max-w-[88%] px-3 py-2 rounded-xl text-sm leading-relaxed bg-surface-3 border-edge border text-fg'}
                style={
                  msg.role === 'user'
                    ? { background: persona.accentColor, color: readableTextColor(persona.accentColor), border: `1px solid ${persona.accentColor}` }
                    : undefined
                }
              >
                {msg.role === 'assistant' && i === messages.length - 1
                  ? <AssistantStreamingText content={msg.content} />
                  : <p className="whitespace-pre-wrap">{msg.content}</p>}
                <div className="flex items-center justify-between mt-1 gap-2">
                  <span className="opacity-40" style={{ fontSize: '10px' }}>{msg.timestamp}</span>
                  {msg.tokensUsed && (
                    <span className="opacity-30" style={{ fontSize: '10px' }}>{msg.tokensUsed}tok</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div className="flex justify-start" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="px-4 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex gap-1.5 items-center">
                {[0, 1, 2].map(i => (
                  <motion.div key={i} className="w-1 h-1 rounded-full"
                    style={{ background: persona.accentColor }}
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Usage stats */}
      {messages.length > 0 && (
        <div className="px-3 py-1 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          <p className="text-xs text-neutral-800">{messages.length}通のメッセージ</p>
        </div>
      )}

      {/* 文脈型アップグレード提案 — チャットを使い込んでいる無料/トライアル ユーザー向け */}
      {messages.length >= 25 && (() => {
        const user = loadBillingUser();
        const isOnFreePlan = !isAuthorizedFn() || (user?.plan === 'free');
        if (!isOnFreePlan) return null;
        return (
          <div className="px-3 pb-2">
            <ContextualUpgradeCard
              trigger="generation-cap"
              planName="標準プラン"
              context={`今日 ${messages.length} 通のメッセージを送りました。`}
              dismissKey={`chat-cap-${persona.id}`}
              accent={persona.accentColor}
              onUpgrade={() => { window.location.href = '/pricing'; }}
            />
          </div>
        );
      })()}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="p-3 flex-shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div
          className="flex items-end gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasApiKey ? '思考を入力… (Enter送信)' : 'APIキーを設定してください'}
            className="flex-1 bg-transparent text-sm text-fg placeholder:text-fg-muted outline-none resize-none leading-relaxed"
            rows={1}
            disabled={!hasApiKey}
            style={{ maxHeight: '120px', minHeight: '24px' }}
          />
          <motion.button
            type="submit"
            disabled={!input.trim() || isLoading || !hasApiKey}
            className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 mb-0.5"
            style={{
              background: input.trim() && hasApiKey ? persona.accentColor : 'var(--surface-3)',
              color: input.trim() && hasApiKey ? '#0a0a0f' : 'var(--fg-muted)',
            }}
            whileTap={input.trim() && hasApiKey ? { scale: 0.9 } : {}}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M5 1L9 5L5 9M1 5H9" />
            </svg>
          </motion.button>
        </div>
      </form>
    </div>
  );
}

// 最新のアシスタント返信をタイプライター風に逐次表示 (待ち時間の体感短縮)
function AssistantStreamingText({ content }: { content: string }) {
  const { text } = useTypewriter(content);
  return <p className="whitespace-pre-wrap">{text}</p>;
}

function getSuggestions(persona: Persona): string[] {
  const desc = persona.description.toLowerCase();
  if (desc.includes('不動産') || desc.includes('物件')) {
    return ['今月の収益サマリーを分析して', '空室リスクを評価して', '新規投資の判断基準を教えて'];
  }
  if (desc.includes('医療') || desc.includes('歯科')) {
    return ['最新の研究トレンドは？', '臨床でよく使う手技のポイントは？', '患者説明のコツを教えて'];
  }
  if (desc.includes('音楽') || desc.includes('チェロ')) {
    return ['今の感情を音楽で表現するなら？', '練習メニューを提案して', 'この曲の解釈を教えて'];
  }
  return [
    'この人格の今週の優先事項は？',
    '現在の課題を整理して',
    '次のアクションを提案して',
  ];
}
