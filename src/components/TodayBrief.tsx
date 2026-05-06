import { motion } from 'framer-motion';
import type { Persona, Proposal } from '../types/identity';

interface Props {
  persona: Persona;
  proposal: Proposal | null;
  isGenerating: boolean;
  isSpeaking: boolean;
  voiceEnabled: boolean;
  onGenerate: (forceVoice?: boolean) => void;
  onSpeak: (p: Proposal) => void;
  onStopSpeak: () => void;
  onAcceptAction: (a: string) => void;
  shadowDraftCount?: number;
  onOpenShadow?: () => void;
}

export default function TodayBrief({
  persona,
  proposal,
  isGenerating,
  isSpeaking,
  voiceEnabled,
  onGenerate,
  onSpeak,
  onStopSpeak,
  onAcceptAction,
  shadowDraftCount = 0,
  onOpenShadow,
}: Props) {
  const hour = new Date().getHours();
  const greet = hour < 11 ? 'おはよう' : hour < 18 ? 'こんにちは' : 'こんばんは';

  return (
    <motion.div
      className="rounded-2xl overflow-hidden relative"
      style={{
        background: `linear-gradient(135deg, ${persona.accentColor}1f, ${persona.accentColor}0a 60%, var(--surface-3))`,
        border: `1px solid ${persona.accentColor}55`,
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* 装飾オーブ */}
      <motion.div
        className="absolute -top-12 -right-12 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: persona.accentColor, filter: 'blur(60px)', opacity: 0.25 }}
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <motion.div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
            style={{ background: `${persona.accentColor}30`, color: persona.accentColor }}
            animate={isSpeaking ? { scale: [1, 1.12, 1] } : {}}
            transition={{ duration: 0.7, repeat: Infinity }}
          >
            {isSpeaking ? '🔊' : '💡'}
          </motion.div>
          <div className="flex-1 min-w-0">
            <p className="text-fg-muted text-xs tracking-widest uppercase">今日のブリーフ · {greet}</p>
            <p className="text-fg text-lg font-semibold leading-tight truncate">
              {proposal?.title || (isGenerating ? '提案を生成中…' : 'AIから提案を受け取る')}
            </p>
          </div>
        </div>

        {proposal ? (
          <>
            <p className="text-fg text-base leading-relaxed mb-3 whitespace-pre-wrap">
              {proposal.message}
            </p>

            {proposal.actions.length > 0 && (
              <div className="space-y-1.5 mb-3">
                <p className="text-fg-muted text-xs tracking-widest uppercase">アクション提案</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {proposal.actions.map((a, i) => (
                    <button
                      key={i}
                      onClick={() => onAcceptAction(a)}
                      className="text-left flex items-start gap-2 p-2.5 rounded-lg transition-all group bg-surface-3 border-edge border hover:border-fg-subtle"
                    >
                      <span style={{ color: persona.accentColor }} className="text-base flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform">＋</span>
                      <span className="text-fg text-sm leading-snug flex-1">{a}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {proposal.context && (
              <p className="text-fg-muted text-xs italic mb-2">{proposal.context}</p>
            )}
          </>
        ) : (
          <p className="text-fg-muted text-base mb-3 leading-relaxed">
            {isGenerating
              ? '人格・蓄積資料・タスク・時間帯から最適な提案を考えています…'
              : '人格・蓄積した資料・現在のタスクをAIが分析し、今この瞬間に取り組むべきことを提案します。'}
          </p>
        )}

        {/* アクションボタン */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onGenerate(voiceEnabled)}
            disabled={isGenerating}
            className="text-sm px-4 py-2.5 rounded-lg font-semibold transition-all disabled:opacity-50"
            style={{
              background: persona.accentColor,
              color: '#0a0a0f',
            }}
          >
            {isGenerating ? '🧠 生成中…' : proposal ? '🔄 新しい提案' : '✨ 提案を生成'}
          </button>
          {proposal && voiceEnabled && (
            isSpeaking ? (
              <button
                onClick={onStopSpeak}
                className="text-sm px-4 py-2.5 rounded-lg transition-all"
                style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171' }}
              >
                ⏹ 停止
              </button>
            ) : (
              <button
                onClick={() => onSpeak(proposal)}
                className="text-sm px-4 py-2.5 rounded-lg transition-all bg-surface-3 border-edge border text-fg hover:bg-surface"
              >
                🔊 読み上げ
              </button>
            )
          )}
          {shadowDraftCount > 0 && onOpenShadow && (
            <motion.button
              onClick={onOpenShadow}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
              style={{
                background: 'rgba(201,169,110,0.12)',
                border: '1px solid rgba(201,169,110,0.35)',
                color: '#c9a96e',
              }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              📬 返信下書き済 {shadowDraftCount}件
            </motion.button>
          )}
          {proposal && (
            <span className="text-fg-muted text-xs ml-auto">
              {new Date(proposal.generatedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 生成
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
