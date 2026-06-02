import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Plus } from 'lucide-react';
import type { Persona, Proposal, AppSettings } from '../types/identity';
import { listIntegrations, sendBrief } from '../lib/integrations';
import { RewardBurst } from './visualFx';
import ThinkingIndicator from './ThinkingIndicator';
import InlineActionExecutor from './InlineActionExecutor';

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
  /** AI 実行に必要 (preferred model 等) */
  settings: AppSettings;
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
  settings,
}: Props) {
  const [briefSending, setBriefSending] = useState(false);
  const [briefSent, setBriefSent] = useState(false);
  const [showReward, setShowReward] = useState(false);
  // どのアクションを「今この場で実行中」か (index)。null なら誰も実行中ではない。
  const [executingIdx, setExecutingIdx] = useState<number | null>(null);
  const enabledIntegrations = listIntegrations().filter(i => i.enabled);

  const handleSendToIntegrations = async () => {
    if (!proposal || briefSending) return;
    setBriefSending(true);
    const brief = {
      title: proposal.title,
      message: proposal.message,
      actions: proposal.actions,
      generatedAt: proposal.generatedAt,
    };
    await Promise.all(enabledIntegrations.map(i => sendBrief(i, brief)));
    setBriefSending(false);
    setBriefSent(true);
    setTimeout(() => setBriefSent(false), 3000);
  };

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
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-fg-muted text-xs tracking-widest uppercase">
                    アクション提案 ({proposal.actions.length}) · タップで AI が実行
                  </p>
                  <button
                    onClick={() => {
                      proposal.actions.forEach(a => onAcceptAction(a));
                      setShowReward(true);
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all inline-flex items-center gap-1"
                    style={{
                      background: 'transparent',
                      border: `1px solid ${persona.accentColor}66`,
                      color: persona.accentColor,
                    }}
                    title="まとめてタスクに追加 (実行はしない)"
                  >
                    <Plus size={11} /> まとめてタスクに追加
                  </button>
                </div>
                <div className="space-y-1.5">
                  {proposal.actions.map((a, i) => (
                    <div key={i}>
                      <button
                        onClick={() => setExecutingIdx(executingIdx === i ? null : i)}
                        disabled={executingIdx !== null && executingIdx !== i}
                        className="w-full text-left flex items-start gap-2 p-2.5 rounded-lg transition-all group bg-surface-3 border-edge border hover:border-fg-subtle disabled:opacity-50"
                        style={{
                          borderColor: executingIdx === i ? persona.accentColor : undefined,
                          background: executingIdx === i ? `${persona.accentColor}1a` : undefined,
                        }}
                      >
                        <span
                          className="flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform inline-flex items-center justify-center"
                          style={{
                            color: '#0a0a0f',
                            background: persona.accentColor,
                            width: 22, height: 22, borderRadius: 6,
                          }}
                        >
                          <Play size={11} fill="#0a0a0f" />
                        </span>
                        <span className="text-fg text-sm leading-snug flex-1">{a}</span>
                      </button>
                      <AnimatePresence>
                        {executingIdx === i && (
                          <InlineActionExecutor
                            key={`exec-${i}`}
                            action={a}
                            persona={persona}
                            settings={settings}
                            contextText={proposal.context}
                            onAddAsTask={(act) => {
                              onAcceptAction(act);
                              setShowReward(true);
                            }}
                            onClose={() => setExecutingIdx(null)}
                          />
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {proposal.context && (
              <p className="text-fg-muted text-xs italic mb-2">{proposal.context}</p>
            )}
          </>
        ) : isGenerating ? (
          <div className="mb-3">
            <ThinkingIndicator
              accent={persona.accentColor}
              variant="compact"
              messages={[
                'あなたのことを思い出しています…',
                '集めた資料を見直しています…',
                '今日のタスクと時間を照らし合わせています…',
                'いちばん良い「次の一手」を考えています…',
              ]}
              onRetry={() => onGenerate(voiceEnabled)}
            />
          </div>
        ) : (
          <p className="text-fg-muted text-base mb-3 leading-relaxed">
            あなたの人格・集めた資料・今のタスクを見て、いま取り組むといちばん良いことを提案します。
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
          {proposal && enabledIntegrations.length > 0 && (
            <button
              onClick={handleSendToIntegrations}
              disabled={briefSending}
              className="text-sm px-4 py-2.5 rounded-lg transition-all disabled:opacity-50"
              style={{
                background: briefSent ? 'rgba(74,222,128,0.15)' : 'var(--surface-3)',
                border: `1px solid ${briefSent ? 'rgba(74,222,128,0.4)' : 'var(--border)'}`,
                color: briefSent ? '#4ade80' : 'var(--fg-muted)',
              }}
            >
              {briefSending ? '送信中…' : briefSent ? '送信完了' : '📤 Slack に送信'}
            </button>
          )}
          {proposal && (
            <span className="text-fg-muted text-xs ml-auto">
              {new Date(proposal.generatedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 生成
            </span>
          )}
        </div>
      </div>

      <RewardBurst
        show={showReward}
        accent={persona.accentColor}
        message="今日のタスクに追加しました"
        onDone={() => setShowReward(false)}
      />
    </motion.div>
  );
}
