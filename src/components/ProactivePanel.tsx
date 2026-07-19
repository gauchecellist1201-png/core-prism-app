import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Persona, Proposal } from '../types/identity';
import { PrismLogo } from './Logo';

interface Props {
  persona: Persona;
  proposals: Proposal[];
  latestProposal: Proposal | null;
  isGenerating: boolean;
  isSpeaking: boolean;
  error: string | null;
  voiceEnabled: boolean;
  onGenerate: (forceVoice?: boolean) => void;
  onSpeak: (p: Proposal) => void;
  onStopSpeak: () => void;
  onDismiss: (id: string) => void;
  onAcceptAction: (action: string) => void;
}

export default function ProactivePanel({
  persona,
  proposals,
  latestProposal,
  isGenerating,
  isSpeaking,
  error,
  voiceEnabled,
  onGenerate,
  onSpeak,
  onStopSpeak,
  onDismiss,
  onAcceptAction,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const display = latestProposal;

  return (
    // 下部FAB/役員ドック帯(~90px)を避けて bottom-24 — 重なりゼロ規約 2026-07-19
    <div className="fixed bottom-44 md:bottom-24 right-20 md:right-4 z-30 max-w-sm w-[calc(100vw-7rem)] md:w-96 pointer-events-none">
      <AnimatePresence mode="wait">
        {display && !showHistory && (
          <motion.div
            key={display.id}
            className="rounded-2xl overflow-hidden pointer-events-auto"
            style={{
              background: 'rgba(20,20,28,0.95)',
              backdropFilter: 'blur(20px)',
              border: `1px solid ${persona.accentColor}40`,
              boxShadow: `0 12px 48px ${persona.accentColor}30`,
            }}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', damping: 25 }}
          >
            {/* Header */}
            <div className="px-4 py-3 flex items-center gap-2" style={{ background: `${persona.accentColor}15`, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <motion.div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                style={{ background: `${persona.accentColor}30`, color: persona.accentColor }}
                animate={isSpeaking ? { scale: [1, 1.15, 1] } : {}}
                transition={{ duration: 0.8, repeat: Infinity }}
              >
                {isSpeaking ? '🔊' : '💡'}
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium leading-tight truncate">{display.title}</p>
                <p className="text-white/50 text-[10px]">
                  {persona.name} · {new Date(display.generatedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                  {display.spoken && ' · 再生済'}
                </p>
              </div>
              <button
                onClick={() => onDismiss(display.id)}
                className="w-6 h-6 rounded-full text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center text-sm leading-none flex-shrink-0"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">{display.message}</p>

              {expanded && display.actions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-white/60 text-[10px] tracking-wider uppercase">提案アクション</p>
                  {display.actions.map((a, i) => (
                    <button
                      key={i}
                      onClick={() => onAcceptAction(a)}
                      className="w-full text-left flex items-start gap-2 p-2 rounded-lg transition-all"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <span style={{ color: persona.accentColor }} className="text-xs flex-shrink-0 mt-0.5">＋</span>
                      <span className="text-white/85 text-xs leading-relaxed">{a}</span>
                    </button>
                  ))}
                </div>
              )}

              {expanded && display.context && (
                <p className="text-white/40 text-[10px] italic leading-relaxed">{display.context}</p>
              )}

              <div className="flex items-center gap-2 pt-1">
                {voiceEnabled && (
                  isSpeaking ? (
                    <button
                      onClick={onStopSpeak}
                      className="flex-1 text-xs px-3 py-2 rounded-lg transition-all"
                      style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
                    >
                      ⏹ 停止
                    </button>
                  ) : (
                    <button
                      onClick={() => onSpeak(display)}
                      className="flex-1 text-xs px-3 py-2 rounded-lg transition-all"
                      style={{ background: persona.accentColorLight, border: `1px solid ${persona.accentColor}40`, color: persona.accentColor }}
                    >
                      🔊 読み上げ
                    </button>
                  )
                )}
                <button
                  onClick={() => setExpanded(v => !v)}
                  className="text-xs px-3 py-2 rounded-lg text-white/70 hover:text-white transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {expanded ? '▴' : '▾'} 詳細
                </button>
                <button
                  onClick={() => onGenerate(voiceEnabled)}
                  disabled={isGenerating}
                  className="text-xs px-3 py-2 rounded-lg text-white/70 hover:text-white transition-all disabled:opacity-50"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  aria-label="新しい提案"
                >
                  {isGenerating ? '⏳' : '🔄'}
                </button>
              </div>

              {proposals.length > 1 && (
                <button
                  onClick={() => setShowHistory(true)}
                  className="text-white/50 hover:text-white/80 text-[10px] tracking-wider"
                >
                  過去の提案 ({proposals.length - 1})
                </button>
              )}
            </div>
          </motion.div>
        )}

        {!display && !showHistory && (
          <motion.div
            key="empty"
            className="rounded-2xl pointer-events-auto p-3 flex items-center gap-2"
            style={{
              background: 'rgba(20,20,28,0.85)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {isGenerating ? (
              <>
                <motion.span
                  style={{ display: 'inline-flex' }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
                ><PrismLogo size={18} withWordmark={false} /></motion.span>
                <span className="text-white/80 text-xs">提案を考えています...</span>
              </>
            ) : (
              <>
                <span className="text-base">💡</span>
                <button
                  onClick={() => onGenerate(voiceEnabled)}
                  className="flex-1 text-left text-white/80 hover:text-white text-xs"
                >
                  AI から提案を受け取る
                </button>
              </>
            )}
          </motion.div>
        )}

        {showHistory && (
          <motion.div
            key="history"
            className="rounded-2xl pointer-events-auto overflow-hidden"
            style={{
              background: 'rgba(20,20,28,0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)',
              maxHeight: '70dvh',
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-white text-sm">提案履歴</p>
              <button
                onClick={() => setShowHistory(false)}
                className="text-white/60 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <div className="p-3 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(70dvh - 50px)' }}>
              {proposals.map(p => (
                <button
                  key={p.id}
                  onClick={() => onSpeak(p)}
                  className="w-full text-left p-3 rounded-lg transition-all"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <p className="text-white text-xs font-medium truncate">{p.title}</p>
                  <p className="text-white/70 text-xs mt-1 line-clamp-2">{p.message}</p>
                  <p className="text-white/40 text-[10px] mt-1">
                    {new Date(p.generatedAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div
          className="mt-2 p-2 rounded-lg pointer-events-auto"
          style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-red-300 text-xs">{error}</p>
        </motion.div>
      )}
    </div>
  );
}
