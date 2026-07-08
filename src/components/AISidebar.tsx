import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatMessage, KnowledgeItem, Persona, AppSettings } from '../types/identity';
import { useTypewriter } from '../hooks/useTypewriter';
import PersonaGlyph from './PersonaGlyph';
import { usePhaseButton } from '../hooks/usePhaseButton';
import ContextualUpgradeCard from './ContextualUpgradeCard';
import { isAuthorized as isAuthorizedFn, loadBillingUser } from '../lib/billing';
import ApiErrorCard from './ApiErrorCard';
import AILoadingState from './AILoadingState';
import { readableTextColor } from '../lib/contrast';

// ブランド ライン グリフ — OS カラー絵文字は使わない(恒久ルール)。currentColor 継承で文脈色に馴染む
const glyphBase = (size: number) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  style: { flexShrink: 0 } as const,
});
function BookGlyph({ size = 13 }: { size?: number }) {
  return (<svg {...glyphBase(size)}><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5A1.5 1.5 0 0 1 20 20.5z"/></svg>);
}
function SparkGlyph({ size = 14 }: { size?: number }) {
  return (<svg {...glyphBase(size)}><path d="M12 2l1.7 6.6a2 2 0 0 0 1.7 1.7L22 12l-6.6 1.7a2 2 0 0 0-1.7 1.7L12 22l-1.7-6.6a2 2 0 0 0-1.7-1.7L2 12l6.6-1.7a2 2 0 0 0 1.7-1.7z"/></svg>);
}
function BuildingGlyph({ size = 14 }: { size?: number }) {
  return (<svg {...glyphBase(size)}><rect x="4" y="3" width="16" height="18" rx="1.2"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/></svg>);
}
function AlertGlyph({ size = 13 }: { size?: number }) {
  return (<svg {...glyphBase(size)}><path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/></svg>);
}

interface Props {
  persona: Persona;
  messages: ChatMessage[];
  settings: AppSettings;
  onSend: (msg: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  /** 直近メッセージが送信失敗していて再送可能か */
  canRetry?: boolean;
  /** 失敗メッセージをワンタップで再送 */
  onRetry?: () => void;
  knowledgeCount: number;
  /** persona に紐づく KnowledgeItem 群 — 引用表示・動的サジェスト用 */
  knowledgeItems?: KnowledgeItem[];
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
  canRetry,
  onRetry,
  knowledgeCount,
  knowledgeItems,
  onOpenKnowledge,
  onOpenSettings,
}: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 引用表示用: ナレッジ ID → タイトル (短縮) のマップ
  const knowledgeTitleById = useMemo(() => {
    const map = new Map<string, string>();
    (knowledgeItems ?? []).forEach(it => map.set(it.id, it.title));
    return map;
  }, [knowledgeItems]);

  // 動的サジェスト: 最新のナレッジタイトル + 未完タスクから 3 件生成 (空ならフォールバック)
  const suggestions = useMemo(
    () => buildDynamicSuggestions(persona, knowledgeItems ?? []),
    [persona, knowledgeItems],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendPhase = usePhaseButton({ successDuration: 950 });

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || sendPhase.isPending) return;
    const msg = input.trim();
    setInput('');
    await sendPhase.run(() => onSend(msg));
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
              className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: persona.accentColorLight, color: persona.accentColor }}
            >
              <PersonaGlyph icon={persona.icon} color={persona.accentColor} size={13} />
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
              <span className="inline-flex items-center gap-1"><BookGlyph size={11} />{knowledgeCount}</span>
            </button>
            {!hasApiKey && (
              <button
                onClick={onOpenSettings}
                className="text-xs px-2 py-1 rounded"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}
                title="APIキー未設定"
              >
                <AlertGlyph size={13} />
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
            <motion.div
              className="px-3 py-2.5 rounded-lg mb-1"
              style={{
                background: `linear-gradient(135deg, ${persona.accentColor}18, ${persona.accentColor}06)`,
                border: `1px solid ${persona.accentColor}30`,
              }}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-sm font-semibold inline-flex items-center gap-1.5" style={{ color: persona.accentColor }}>
                <SparkGlyph size={14} />Prism にようこそ
              </p>
              <p className="text-xs text-fg-muted mt-0.5 leading-relaxed">
                {persona.name} の専属秘書として動きます。{knowledgeCount > 0 ? `${knowledgeCount} 件の資料を読了済み。` : ''}まずは下から相談を選んでください。
              </p>
            </motion.div>
            <p className="text-fg-muted text-xs tracking-wider uppercase mb-1">最初の相談</p>
            {suggestions.map((s, i) => (
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
            <motion.button
              onClick={() => onSend(`AI 会社 (13 CXO 体制) として、私の「${persona.name}」を総合的に見直してください。CFO は数字、CMO は集客、COO はオペ、CDS はデータの観点で、それぞれ「次にやること」を 1 つずつ提案して。`)}
              disabled={!hasApiKey || isLoading}
              className="w-full text-left text-sm px-3 py-2.5 rounded-lg transition-all border"
              style={{
                background: `${persona.accentColor}10`,
                borderColor: `${persona.accentColor}40`,
                color: persona.accentColor,
              }}
              whileHover={hasApiKey ? { x: 3 } : {}}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + suggestions.length * 0.05 }}
            >
              <span className="inline-flex items-center gap-1.5"><BuildingGlyph size={14} />AI 会社 (13 CXO) に相談する →</span>
            </motion.button>
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
                {msg.role === 'assistant' && msg.usedKnowledge && msg.usedKnowledge.length > 0 && (
                  (() => {
                    const titles = msg.usedKnowledge
                      .map(id => knowledgeTitleById.get(id))
                      .filter((t): t is string => !!t);
                    if (titles.length === 0) return null;
                    return (
                      <div className="mt-2 pt-2 flex flex-wrap gap-1" style={{ borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                        <span className="text-[10px] opacity-60 mr-1 inline-flex items-center gap-0.5"><BookGlyph size={10} />参照:</span>
                        {titles.slice(0, 5).map((t, k) => (
                          <button
                            key={k}
                            onClick={onOpenKnowledge}
                            className="text-[10px] px-1.5 py-0.5 rounded transition-opacity hover:opacity-100"
                            style={{
                              background: persona.accentColorLight,
                              color: persona.accentColor,
                              opacity: 0.85,
                              maxWidth: '160px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={t}
                          >
                            {t.length > 20 ? t.slice(0, 20) + '…' : t}
                          </button>
                        ))}
                      </div>
                    );
                  })()
                )}
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

        {/* 送信失敗 — 直近の自分の吹き出しの真下に「もう一度送る」を出す。
            打ち直し不要で、同じ内容をワンタップ再送できる（沈黙する失敗を防ぐ） */}
        {!isLoading && canRetry && onRetry && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
          <motion.div
            className="flex justify-start"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className="max-w-[88%] px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.30)' }}
            >
              <p className="text-xs font-semibold inline-flex items-center gap-1" style={{ color: '#f87171' }}>
                <AlertGlyph size={12} />返信を受け取れませんでした
              </p>
              <p className="text-[11px] text-fg-muted mt-0.5 leading-relaxed">
                通信が一瞬不安定だったのかもしれません。打ち直さなくても、同じ内容でもう一度送れます。
              </p>
              <motion.button
                onClick={onRetry}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: '#f87171', color: '#0a0a0f' }}
                whileTap={{ scale: 0.95 }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 2v3H7M2 10v-3h3" />
                  <path d="M9.5 5A4 4 0 0 0 3 3.5M2.5 7A4 4 0 0 0 9 8.5" />
                </svg>
                もう一度送る
              </motion.button>
            </div>
          </motion.div>
        )}

        {isLoading && (
          <AILoadingState
            active={isLoading}
            label={`${persona.name} の AI が考えています`}
            stages={[
              '質問を解析中',
              'ナレッジから関連資料を検索',
              '過去の会話を踏まえて整理',
              '回答を組み立て中',
            ]}
            brand="prism"
            skeletonLines={3}
          />
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
            disabled={!input.trim() || isLoading || !hasApiKey || sendPhase.isPending}
            aria-live="polite"
            aria-label={sendPhase.isPending ? '送信中' : sendPhase.isSuccess ? '送れました' : '送信'}
            className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 mb-0.5 ${sendPhase.successClass ?? ''}`}
            style={{
              background: sendPhase.isSuccess
                ? '#34D399'
                : sendPhase.isPending
                  ? (input.trim() && hasApiKey ? persona.accentColor + 'cc' : 'var(--surface-3)')
                  : (input.trim() && hasApiKey ? persona.accentColor : 'var(--surface-3)'),
              color: sendPhase.isSuccess ? '#0a0a0f' : (input.trim() && hasApiKey ? '#0a0a0f' : 'var(--fg-muted)'),
            }}
            whileTap={input.trim() && hasApiKey && sendPhase.isIdle ? { scale: 0.9 } : {}}
          >
            {sendPhase.isPending ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="cp-phase-spin">
                <path d="M8.5 5a3.5 3.5 0 1 1-3.5-3.5" />
              </svg>
            ) : sendPhase.isSuccess ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 5.2L4.2 7.4L8 3" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M5 1L9 5L5 9M1 5H9" />
              </svg>
            )}
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

// 業種フォールバックの基本サジェスト
function fallbackSuggestions(persona: Persona): string[] {
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

// 動的サジェスト: 最新ナレッジ + 未完タスクから自然な相談文を組み立てる
function buildDynamicSuggestions(persona: Persona, knowledgeItems: KnowledgeItem[]): string[] {
  const out: string[] = [];

  // 1) 最新ナレッジ (createdAt 降順) の上位 2 件をネタにする
  const recent = [...knowledgeItems]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 2);
  for (const it of recent) {
    const title = it.title.length > 22 ? it.title.slice(0, 22) + '…' : it.title;
    if (it.analysis?.summary) {
      out.push(`「${title}」の要点を踏まえて、次の一手を提案して`);
    } else {
      out.push(`「${title}」の中身を要約して`);
    }
  }

  // 2) 未完タスクが多ければ整理を提案
  const openTasks = persona.tasks?.filter(t => !t.done) ?? [];
  if (openTasks.length >= 3) {
    out.push(`未完タスクが ${openTasks.length} 件あります。優先順位を整理して`);
  } else if (openTasks.length > 0) {
    const head = openTasks[0].title.slice(0, 20);
    out.push(`「${head}」を進めるための具体策を教えて`);
  }

  // 3) 不足分はフォールバックで埋める
  const fallback = fallbackSuggestions(persona);
  for (const s of fallback) {
    if (out.length >= 3) break;
    if (!out.includes(s)) out.push(s);
  }
  return out.slice(0, 3);
}
