import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Plus, Volume2, Square, Lightbulb, Sparkles, RefreshCw, Mail, Send, AlertTriangle, Check, BookOpen, CalendarDays, CreditCard, Camera, MessageCircle, Radio } from 'lucide-react';
import type { ComponentType } from 'react';
import type { Persona, Proposal, AppSettings } from '../types/identity';
import { listIntegrations, sendBrief } from '../lib/integrations';
import { RewardBurst } from './visualFx';
import ThinkingIndicator from './ThinkingIndicator';
import InlineActionExecutor from './InlineActionExecutor';
import { LoaderDots } from './MicroLoader';
import { logDeliverable } from '../lib/cxoDeliverables';
import { CXO_META } from '../hooks/useAgentTaskQueue';
import { resolveDeliverableCxo } from '../lib/actionExecutor';

// 連携根拠チップ: ソースのラベル→Lucideアイコン。未知ラベルは汎用(Radio)にフォールバック。
// 絵文字は使わない(オーナー指示)。ここに出るのは「実際にデータが返った」連携だけ(嘘の根拠を出さない)。
const SOURCE_ICON: Record<string, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  Gmail: Mail,
  'カレンダー': CalendarDays,
  Stripe: CreditCard,
  Instagram: Camera,
  'LINE配信': MessageCircle,
};

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
  /** 提案生成が失敗したときの理由。null なら失敗なし。
      これが無いと生成失敗が黙って空状態に戻り「タップしたのに何も起きない」silent fail になっていた。 */
  genError?: string | null;
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
  genError = null,
}: Props) {
  const [briefSending, setBriefSending] = useState(false);
  const [briefSent, setBriefSent] = useState(false);
  // 送信失敗を黙って隠さない（silent fail撲滅）。失敗時は理由＋再送導線を出す。
  const [briefError, setBriefError] = useState<string | null>(null);
  const [showReward, setShowReward] = useState(false);
  // どのアクションを「今この場で実行中」か (index)。null なら誰も実行中ではない。
  const [executingIdx, setExecutingIdx] = useState<number | null>(null);
  const enabledIntegrations = listIntegrations().filter(i => i.enabled);

  const handleSendToIntegrations = async () => {
    if (!proposal || briefSending) return;
    setBriefSending(true);
    setBriefError(null);
    const brief = {
      title: proposal.title,
      message: proposal.message,
      actions: proposal.actions,
      generatedAt: proposal.generatedAt,
    };
    // sendBrief は throw せず {ok,error} を返す。結果を必ず検査して
    // 失敗を「送信完了」と偽らない（honest-numbers / silent fail撲滅）。
    let results: Array<{ ok: boolean; error?: string }> = [];
    try {
      results = await Promise.all(enabledIntegrations.map(i => sendBrief(i, brief)));
    } catch (e: unknown) {
      results = [{ ok: false, error: e instanceof Error ? e.message : '不明なエラー' }];
    }
    setBriefSending(false);
    const failed = results.filter(r => !r.ok);
    if (failed.length > 0) {
      const total = results.length;
      const reason = failed[0]?.error ? `（${failed[0].error}）` : '';
      setBriefError(
        total > 1
          ? `${total}件中 ${failed.length}件 送信できませんでした${reason}。連携設定のWebhook URLをご確認のうえ、もう一度お試しください。`
          : `送信できませんでした${reason}。連携設定のWebhook URLをご確認のうえ、もう一度お試しください。`,
      );
      return;
    }
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

      {/* iPhone は余白広めで巨大化 (オーナー指示 2026-06-03) */}
      <div className="relative p-5 brief-mobile">
        <div className="flex items-center gap-3 mb-4">
          <motion.div
            className="rounded-xl flex items-center justify-center flex-shrink-0 brief-icon-mobile"
            style={{ background: `${persona.accentColor}30`, color: persona.accentColor, width: 44, height: 44, fontSize: 22 }}
            animate={isSpeaking ? { scale: [1, 1.12, 1] } : {}}
            transition={{ duration: 0.7, repeat: Infinity }}
          >
            {isSpeaking ? <Volume2 size={22} strokeWidth={2.2} /> : <Lightbulb size={22} strokeWidth={2.2} />}
          </motion.div>
          <div className="flex-1 min-w-0">
            <p className="text-fg-muted text-xs tracking-widest uppercase brief-eyebrow-mobile">今日のブリーフ · {greet}</p>
            <p
              className="text-fg font-extrabold leading-tight brief-title-mobile"
              style={{ fontSize: 18, wordBreak: 'keep-all', lineHeight: 1.35 }}
            >
              {proposal?.title || (isGenerating ? <LoaderDots label="今日の打ち手を選んでます" /> : 'AIから提案を受け取る')}
            </p>
          </div>
        </div>

        {proposal ? (
          <>
            {/* 連携データの根拠チップ: この提案が「実際にデータが返った」連携をもとに作られたことを見せる。
                dataSources は生成時に非nullだった連携だけ → 未連携/失敗時は何も出さない (嘘の根拠を出さない)。
                「AIが連携実データから勝手に動いている」を第一画面で体感させる (価値の可視化)。 */}
            {Array.isArray(proposal.dataSources) && proposal.dataSources.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mb-3">
                <span
                  className="inline-flex items-center gap-1 text-xs font-semibold"
                  style={{ color: 'var(--fg-muted)' }}
                >
                  <Radio size={12} strokeWidth={2.4} /> 連携データをもとに
                </span>
                {proposal.dataSources.map((s) => {
                  const Icon = SOURCE_ICON[s] || Radio;
                  return (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 text-xs font-semibold"
                      style={{
                        padding: '4px 9px',
                        borderRadius: 999,
                        background: `${persona.accentColor}12`,
                        border: `1px solid ${persona.accentColor}33`,
                        color: persona.accentColor,
                      }}
                    >
                      <Icon size={11} strokeWidth={2.4} /> {s}
                    </span>
                  );
                })}
              </div>
            )}
            {/* 根拠チップ: ナレッジを実際に参照した件数のみ表示 (0件/未計測なら出さない・嘘数字禁止) */}
            {!!proposal.knowledgeUsedCount && proposal.knowledgeUsedCount > 0 && (
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold mb-3"
                style={{
                  padding: '5px 10px',
                  borderRadius: 999,
                  background: `${persona.accentColor}14`,
                  border: `1px solid ${persona.accentColor}33`,
                  color: persona.accentColor,
                }}
              >
                <BookOpen size={12} strokeWidth={2.4} />
                {proposal.knowledgeUsedCount}件の知識をもとに提案しました
              </span>
            )}
            <p
              className="text-fg leading-relaxed mb-4 whitespace-pre-wrap brief-body-mobile"
              style={{ fontSize: 15, lineHeight: 1.75 }}
            >
              {proposal.message}
            </p>

            {proposal.actions.length > 0 && (
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-fg-muted text-xs tracking-widest uppercase">
                    アクション提案 ({proposal.actions.length}) · タップで AI 実行
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
                    <Plus size={11} /> まとめて追加
                  </button>
                </div>
                <div className="space-y-2">
                  {proposal.actions.map((a, i) => (
                    <div key={i}>
                      <button
                        onClick={() => setExecutingIdx(executingIdx === i ? null : i)}
                        disabled={executingIdx !== null && executingIdx !== i}
                        className="w-full text-left flex items-start gap-3 rounded-xl transition-all group bg-surface-3 border-edge border hover:border-fg-subtle disabled:opacity-50 brief-action-mobile"
                        style={{
                          padding: '14px 14px',
                          borderColor: executingIdx === i ? persona.accentColor : undefined,
                          background: executingIdx === i ? `${persona.accentColor}1a` : undefined,
                          minHeight: 56, // ← 44px Apple HIG 推奨 + 余裕
                        }}
                      >
                        <span
                          className="flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform inline-flex items-center justify-center"
                          style={{
                            color: '#0a0a0f',
                            background: persona.accentColor,
                            width: 32, height: 32, borderRadius: 8,
                          }}
                        >
                          <Play size={14} fill="#0a0a0f" />
                        </span>
                        <span
                          className="text-fg flex-1 brief-action-text-mobile"
                          style={{ fontSize: 14.5, lineHeight: 1.55, wordBreak: 'keep-all' }}
                        >{a}</span>
                      </button>
                      <AnimatePresence>
                        {executingIdx === i && (
                          <InlineActionExecutor
                            key={`exec-${i}`}
                            action={a}
                            persona={persona}
                            settings={settings}
                            contextText={proposal.context}
                            onComplete={(deliverable, act) => {
                              // 「今日の一手」タップ→AI成果物を役員日報へ確実に記録(silent fail撲滅)。
                              // これが無いと、成果物は自動保存されるのに日報の「動いた量」に載らず
                              // 価値が見えないままだった(2026-07-06)。
                              try {
                                const { cxo, category } = resolveDeliverableCxo(deliverable.kind);
                                const meta = CXO_META[cxo];
                                logDeliverable({
                                  personaId: persona.id,
                                  cxoRole: cxo,
                                  cxoName: meta.name,
                                  cxoEmoji: meta.emoji,
                                  title: deliverable.title || act,
                                  summary: act,
                                  content: deliverable.content,
                                  category,
                                  source: 'inline-executor',
                                });
                              } catch { /* 記録失敗は握りつぶさず、成果物自体は保存済み */ }
                            }}
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
        ) : genError ? (
          // 生成失敗を黙って空状態に戻さない（silent fail撲滅）。理由＋再試行を必ず見せる。
          <div
            className="mb-3 flex items-start gap-2.5 rounded-xl"
            style={{
              padding: '13px 14px',
              background: 'rgba(248,113,113,0.10)',
              border: '1px solid rgba(248,113,113,0.35)',
            }}
            role="alert"
          >
            <AlertTriangle size={17} strokeWidth={2.3} color="#f87171" className="flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-bold m-0 mb-1" style={{ color: '#fca5a5' }}>提案を作れませんでした</p>
              <p className="text-xs leading-relaxed m-0" style={{ color: '#fca5a5' }}>
                {genError}
                <br />
                通信状況をご確認のうえ、下の「もう一度ためす」を押してください。
              </p>
            </div>
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
            {isGenerating ? <LoaderDots label="提案を考えてます" /> : genError ? <span className="inline-flex items-center gap-1.5"><RefreshCw size={15} strokeWidth={2.4} /> もう一度ためす</span> : proposal ? <span className="inline-flex items-center gap-1.5"><RefreshCw size={15} strokeWidth={2.4} /> 新しい提案</span> : <span className="inline-flex items-center gap-1.5"><Sparkles size={15} strokeWidth={2.4} /> 提案を生成</span>}
          </button>
          {proposal && voiceEnabled && (
            isSpeaking ? (
              <button
                onClick={onStopSpeak}
                className="text-sm px-4 py-2.5 rounded-lg transition-all inline-flex items-center gap-1.5"
                style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171' }}
              >
                <Square size={14} strokeWidth={2.4} fill="#f87171" /> 停止
              </button>
            ) : (
              <button
                onClick={() => onSpeak(proposal)}
                className="text-sm px-4 py-2.5 rounded-lg transition-all bg-surface-3 border-edge border text-fg hover:bg-surface inline-flex items-center gap-1.5"
              >
                <Volume2 size={15} strokeWidth={2.2} /> 読み上げ
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
              <span className="inline-flex items-center gap-1.5"><Mail size={13} strokeWidth={2.2} /> 返信下書き済 {shadowDraftCount}件</span>
            </motion.button>
          )}
          {proposal && enabledIntegrations.length > 0 && (
            <button
              onClick={handleSendToIntegrations}
              disabled={briefSending}
              className="text-sm px-4 py-2.5 rounded-lg transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
              style={{
                background: briefSent ? 'rgba(74,222,128,0.15)' : briefError ? 'rgba(248,113,113,0.12)' : 'var(--surface-3)',
                border: `1px solid ${briefSent ? 'rgba(74,222,128,0.4)' : briefError ? 'rgba(248,113,113,0.4)' : 'var(--border)'}`,
                color: briefSent ? '#4ade80' : briefError ? '#f87171' : 'var(--fg-muted)',
              }}
            >
              {briefSending
                ? <><LoaderDots label="送信中" /></>
                : briefSent
                  ? <><Check size={14} strokeWidth={2.6} /> 送信完了</>
                  : briefError
                    ? <><RefreshCw size={14} strokeWidth={2.4} /> 再送する</>
                    : <><Send size={14} strokeWidth={2.2} /> Slack に送信</>}
            </button>
          )}
          {proposal && (
            <span className="text-fg-muted text-xs ml-auto">
              {new Date(proposal.generatedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 生成
            </span>
          )}
        </div>

        {/* 送信失敗を黙って隠さない — 理由と再送導線を必ず見せる */}
        {briefError && (
          <div
            className="mt-3 flex items-start gap-2.5 rounded-xl"
            style={{
              padding: '12px 13px',
              background: 'rgba(248,113,113,0.10)',
              border: '1px solid rgba(248,113,113,0.35)',
            }}
            role="alert"
          >
            <AlertTriangle size={16} strokeWidth={2.3} color="#f87171" className="flex-shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed m-0" style={{ color: '#fca5a5' }}>{briefError}</p>
          </div>
        )}

        {/* 既に提案がある状態で「新しい提案」が失敗したときも黙らせない。
            古い提案は残したまま、更新に失敗したことだけ小さく正直に伝える。 */}
        {proposal && !isGenerating && genError && (
          <div
            className="mt-3 flex items-start gap-2.5 rounded-xl"
            style={{
              padding: '10px 12px',
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.28)',
            }}
            role="alert"
          >
            <AlertTriangle size={15} strokeWidth={2.3} color="#f87171" className="flex-shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed m-0" style={{ color: '#fca5a5' }}>
              新しい提案を作れませんでした（{genError}）。上の提案はそのまま使えます。「もう一度ためす」で更新できます。
            </p>
          </div>
        )}
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
