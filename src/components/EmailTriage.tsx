import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Persona, AppSettings } from '../types/identity';
import type { TriageBatch, EmailTriaged } from '../lib/emailTriage';
import { copyText } from '../lib/clipboard';
import { triageEmails, regenerateDraft } from '../lib/emailTriage';
import ApiErrorCard from './ApiErrorCard';
import AILoadingState from './AILoadingState';
import {
  isGmailConfigured,
  isGmailConnected,
  connectGmail,
  fetchInbox,
  gmailToTriageText,
  sendReply,
  buildReplyMeta,
  clearGmailToken,
  loadGmailUser,
  GMAIL_SCOPE_DESCRIPTIONS,
  type GmailMessage,
  type GmailUserInfo,
} from '../lib/gmail';

interface Props {
  persona: Persona;
  settings: AppSettings;
  onClose: () => void;
  onAcceptAction: (action: string) => void;
}

const IMPORT_COLOR: Record<EmailTriaged['importance'], string> = {
  high: '#f87171',
  mid:  '#c9a96e',
  low:  '#8b97b5',
  spam: '#5c6883',
};
const IMPORT_LABEL: Record<EmailTriaged['importance'], string> = {
  high: '高',
  mid:  '中',
  low:  '低',
  spam: '迷惑',
};
const URGENCY_LABEL: Record<EmailTriaged['urgency'], string> = {
  immediate: '🔥 即対応',
  today:     '⏰ 今日中',
  'this-week': '📅 今週中',
  none:      '— ',
};

export default function EmailTriageModal({ persona, settings, onClose, onAcceptAction }: Props) {
  const [raw, setRaw] = useState('');
  const [batch, setBatch] = useState<TriageBatch | null>(null);
  const [filter, setFilter] = useState<'all' | 'high' | 'reply' | 'spam'>('all');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [gmailConnected, setGmailConnected] = useState(isGmailConnected());
  const [gmailUser, setGmailUser] = useState<GmailUserInfo | null>(loadGmailUser());
  const gmailReady = isGmailConfigured();
  const [gmailFetching, setGmailFetching] = useState(false);
  const [gmailMessages, setGmailMessages] = useState<GmailMessage[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    setGmailConnected(isGmailConnected());
    setGmailUser(loadGmailUser());
  }, []);

  const handleConnectGmail = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const { user } = await connectGmail();
      setGmailConnected(true);
      setGmailUser(user);
      setShowConsentModal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }, []);

  const handleFetchGmail = useCallback(async () => {
    setError(null);
    setGmailFetching(true);
    try {
      const msgs = await fetchInbox(20);
      setGmailMessages(msgs);
      if (msgs.length === 0) {
        setError('受信トレイに直近メールがありません');
        return;
      }
      const text = gmailToTriageText(msgs);
      setRaw(text);
      // 取り込み直後にトリアージ実行
      setIsAnalyzing(true);
      const result = await triageEmails(settings, persona, text);
      // Gmail のメッセージID と triaged の id を順序で対応付け
      const enriched = {
        ...result,
        emails: result.emails.map((e, i) => ({
          ...e,
          gmailId: msgs[i]?.id,
          gmailThreadId: msgs[i]?.threadId,
        } as any)),
      };
      setBatch(enriched);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGmailFetching(false);
      setIsAnalyzing(false);
    }
  }, [settings, persona]);

  const handleSendGmail = useCallback(async (triaged: EmailTriaged & { gmailId?: string; gmailThreadId?: string }) => {
    const gmailId = triaged.gmailId;
    if (!gmailId || !triaged.draftReply) return;
    const original = gmailMessages.find(m => m.id === gmailId);
    if (!original) {
      setError('元メッセージが見つかりません。再取得してください。');
      return;
    }
    setSendingId(triaged.id);
    setError(null);
    try {
      const meta = buildReplyMeta(original);
      await sendReply({
        threadId: original.threadId,
        to: meta.to,
        subject: meta.subject,
        body: triaged.draftReply,
        inReplyTo: meta.inReplyTo,
        references: meta.references,
      });
      setSentIds(prev => new Set(prev).add(triaged.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSendingId(null);
    }
  }, [gmailMessages]);

  const handleDisconnectGmail = useCallback(() => {
    clearGmailToken();
    setGmailConnected(false);
    setGmailMessages([]);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!raw.trim()) {
      setError('メール内容を貼り付けてください');
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await triageEmails(settings, persona, raw);
      setBatch(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAnalyzing(false);
    }
  }, [raw, settings, persona]);

  const handleRegenerate = useCallback(async (id: string, tone?: string) => {
    if (!batch) return;
    const email = batch.emails.find(e => e.id === id);
    if (!email) return;
    setRegenerating(id);
    try {
      const draft = await regenerateDraft(settings, persona, email, tone);
      setBatch({
        ...batch,
        emails: batch.emails.map(e => e.id === id ? { ...e, draftReply: draft } : e),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRegenerating(null);
    }
  }, [batch, settings, persona]);

  const copyToClipboard = useCallback((text: string) => {
    copyText(text, '返信文');
  }, []);

  const filtered = batch ? batch.emails.filter(e => {
    if (filter === 'all') return e.importance !== 'spam';
    if (filter === 'high') return e.importance === 'high';
    if (filter === 'reply') return e.needsReply;
    if (filter === 'spam') return e.importance === 'spam';
    return true;
  }) : [];

  return (
    <div>
      {/* Google 認証前の説明モーダル */}
      <AnimatePresence>
        {showConsentModal && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-3"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(24px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => !connecting && setShowConsentModal(false)}
          >
            <motion.div
              className="w-full max-w-md rounded-2xl overflow-hidden"
              style={{ background: '#ffffff', color: '#1a1a1a' }}
              initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 20 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-white border border-[#dadce0] flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-base font-semibold">Gmail に接続</p>
                    <p className="text-xs text-[#5f6368]">CORE Prism が以下の権限を要求します</p>
                  </div>
                </div>

                <ul className="space-y-2 mb-4">
                  {GMAIL_SCOPE_DESCRIPTIONS.map((s, i) => (
                    <li key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-[#f8f9fa]">
                      <span className="text-lg leading-none mt-0.5">{s.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{s.label}</p>
                        <p className="text-xs text-[#5f6368] leading-snug mt-0.5">{s.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="rounded-lg p-3 mb-3" style={{ background: '#e8f0fe' }}>
                  <p className="text-xs leading-relaxed text-[#1967d2]">
                    🔒 「次へ」を押すと <strong>Google の公式認証画面</strong>が開きます。
                    あなたのパスワードは CORE Prism に渡りません。
                    メール本文はサーバーに保存されず、AI 解析のみに使用されます。
                    連携はいつでも解除できます。
                  </p>
                </div>

                {/* Google 審査中のため、現在 Testing モードで運用しています。
                    ユーザーが「このアプリは Google で確認されていません」画面で詰まらないよう、
                    明確に通り抜け方を案内する。 */}
                <div className="rounded-lg p-3 mb-4 border" style={{ background: '#fef7e0', borderColor: '#f9ab00' }}>
                  <p className="text-xs leading-relaxed text-[#b06000] font-semibold mb-1">
                    ⚠️ 次の画面で「このアプリは Google で確認されていません」が出たら
                  </p>
                  <ol className="text-xs leading-relaxed text-[#5f4400] space-y-0.5 list-decimal pl-4">
                    <li>左下の「<strong>詳細</strong>」をクリック</li>
                    <li>「<strong>安全ではないページに移動 (CORE Prism)</strong>」をクリック</li>
                    <li>続けて画面の指示に従う</li>
                  </ol>
                  <p className="text-[10px] leading-relaxed text-[#7a5800] mt-1.5">
                    現在 Google の本番審査中です (6 月リリースに向け申請済)。
                    審査が通れば この警告は出なくなります。
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg p-3 mb-3 text-sm" style={{ background: '#fce8e6', color: '#c5221f' }}>
                    {error}
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowConsentModal(false)}
                    disabled={connecting}
                    className="px-4 py-2 text-sm rounded-md text-[#5f6368] hover:bg-[#f1f3f4] disabled:opacity-40"
                  >キャンセル</button>
                  <button
                    onClick={handleConnectGmail}
                    disabled={connecting}
                    className="px-5 py-2 text-sm font-semibold rounded-md text-white disabled:opacity-50 flex items-center gap-2"
                    style={{ background: '#1a73e8' }}
                  >
                    {connecting ? '認証中…' : 'Google 認証画面へ →'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-[1400px] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg, #15151c)', border: '1px solid var(--border)', maxHeight: 'calc(100dvh - 1.5rem)' }}
        initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: persona.accentColorLight, color: persona.accentColor }}
            >📬</div>
            <div className="min-w-0">
              <p className="text-fg text-lg font-semibold leading-tight truncate">メール・トリアージ AI</p>
              <p className="text-fg-muted text-xs truncate">受信トレイを一括分類・返信ドラフト生成</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface text-xl leading-none"
          >×</button>
        </div>

        {!batch ? (
          /* 入力フェーズ */
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* LINE 連携 (将来対応) */}
            <div className="rounded-xl p-3 opacity-60" style={{ background: 'var(--surface-3)', border: '1px dashed var(--border)' }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xl">💬</span>
                  <div className="min-w-0">
                    <p className="text-fg text-sm font-medium leading-tight">LINE 連携</p>
                    <p className="text-fg-muted text-[11px] leading-snug">
                      個人 LINE は API 仕様で外部読み取り不可。LINE 公式アカウント (Messaging API) 連携は近日対応予定。
                    </p>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-1 rounded text-fg-muted" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>近日</span>
              </div>
            </div>

            {/* Gmail 連携パネル */}
            <div
              className="rounded-xl p-4"
              style={{
                background: gmailConnected ? `${persona.accentColor}12` : 'var(--surface-3)',
                border: `1px solid ${gmailConnected ? persona.accentColor + '50' : 'var(--border)'}`,
              }}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {gmailConnected && gmailUser?.picture ? (
                    <img
                      src={gmailUser.picture}
                      alt=""
                      className="w-10 h-10 rounded-full flex-shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: persona.accentColorLight }}
                    >📮</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-fg text-sm font-semibold leading-tight">Gmail 連携</p>
                      {gmailConnected && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: persona.accentColorLight, color: persona.accentColor, border: `1px solid ${persona.accentColor}40` }}
                        >● 接続中</span>
                      )}
                    </div>
                    {gmailConnected && gmailUser ? (
                      <p className="text-fg-muted text-xs mt-0.5 truncate">
                        {gmailUser.name ? `${gmailUser.name} · ` : ''}<span className="text-fg">{gmailUser.email}</span>
                      </p>
                    ) : (
                      <p className="text-fg-muted text-xs leading-snug mt-0.5">
                        {gmailReady
                          ? 'あなたの Google アカウントで認証して、受信メールの AI 処理と返信送信を行います'
                          : 'Gmail 連携の準備中です。少々お待ちください。'}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {!gmailConnected ? (
                    <button
                      onClick={() => { setError(null); setShowConsentModal(true); }}
                      disabled={!gmailReady}
                      className="text-sm px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-40 flex items-center gap-2"
                      style={{ background: '#ffffff', color: '#1a1a1a', border: '1px solid #dadce0' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
                      </svg>
                      Google で続行
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleFetchGmail}
                        disabled={gmailFetching || isAnalyzing}
                        className="text-xs px-3 py-1.5 rounded-md font-semibold transition-all disabled:opacity-50"
                        style={{ background: persona.accentColor, color: '#0a0a0f' }}
                      >{gmailFetching ? '📥 取り込み中…' : '✨ 受信トレイから一括取込'}</button>
                      <button
                        onClick={handleDisconnectGmail}
                        className="text-xs px-2 py-1.5 rounded-md text-fg-muted hover:text-fg"
                        title="Gmail 連携を解除"
                      >解除</button>
                    </>
                  )}
                </div>
              </div>
              {!gmailConnected && gmailReady && (
                <p className="text-fg-subtle text-[11px] mt-3 leading-relaxed">
                  🔒 認証は Google の公式画面で行われます。CORE Prism はあなたのパスワードを受け取りません。
                  メール本文はサーバーに保存されず、AI 解析のみに使われます。
                </p>
              )}
            </div>

            <div className="rounded-xl p-3" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
              <p className="text-fg text-sm font-medium mb-1">📋 使い方</p>
              <p className="text-fg-muted text-xs leading-relaxed">
                上から Gmail を直接連携できます。または下に手動でメールを貼り付けて分析することもできます。
                AI が重要度・カテゴリ・緊急度を判定し、必要なものに返信ドラフトを自動生成します (最大 30 通)。
              </p>
            </div>

            <div>
              <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">
                受信メール {raw.length > 0 && `(${raw.length}文字)`}
              </label>
              <textarea
                value={raw}
                onChange={e => setRaw(e.target.value)}
                placeholder="From: 田中様 <tanaka@example.com>&#10;件名: 来週のお打ち合わせについて&#10;本文: ...&#10;&#10;---&#10;&#10;From: 佐藤 <sato@example.com>&#10;件名: ..."
                className="w-full text-sm rounded-lg px-3 py-2.5 outline-none resize-y bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg leading-relaxed"
                style={{ minHeight: '260px' }}
              />
              <p className="text-fg-muted text-xs mt-1">
                💡 区切り: 「From:」/「差出人:」/「---」/ 空行3つ で自動分割
              </p>
            </div>

            <ApiErrorCard error={error} onRetry={handleAnalyze} variant="auto" />

            <AILoadingState
              active={isAnalyzing}
              label="メールをトリアージしています"
              stages={[
                'メールを 1 通ずつ読み込み中',
                '重要度・カテゴリ・期限を判定',
                '返信が要るものに下書きを作成',
                '一覧として整形',
              ]}
              brand="prism"
              skeletonLines={6}
            />

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-fg-muted hover:text-fg">キャンセル</button>
              <motion.button
                onClick={handleAnalyze}
                disabled={!raw.trim() || isAnalyzing}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                style={{ background: persona.accentColor, color: '#0a0a0f' }}
                whileHover={!isAnalyzing ? { scale: 1.02 } : {}}
                whileTap={!isAnalyzing ? { scale: 0.98 } : {}}
              >
                {isAnalyzing ? '🧠 解析中...' : '✨ 一括トリアージ'}
              </motion.button>
            </div>
          </div>
        ) : (
          /* 結果フェーズ */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* サマリ */}
            <div
              className="px-5 py-4 flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${persona.accentColor}15, transparent)`, borderBottom: '1px solid var(--border)' }}
            >
              <p className="text-fg text-base font-semibold leading-relaxed mb-2">{batch.digest}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <Stat label="総数" value={batch.totalEmails} color="var(--fg)" />
                <Stat label="高優先" value={batch.highCount} color="#f87171" />
                <Stat label="要返信" value={batch.needReplyCount} color={persona.accentColor} />
                <Stat label="迷惑" value={batch.spamCount} color="#5c6883" />
              </div>
            </div>

            {/* フィルタ */}
            <div className="flex gap-1.5 px-5 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              {([
                ['all',   `全て (${batch.emails.filter(e => e.importance !== 'spam').length})`],
                ['high',  `🔥 高 (${batch.highCount})`],
                ['reply', `↩ 要返信 (${batch.needReplyCount})`],
                ['spam',  `🗑 迷惑 (${batch.spamCount})`],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setFilter(id as any)}
                  className="text-xs px-2.5 py-1 rounded-md font-medium transition-all"
                  style={{
                    background: filter === id ? persona.accentColorLight : 'var(--surface-3)',
                    color: filter === id ? persona.accentColor : 'var(--fg-muted)',
                    border: `1px solid ${filter === id ? persona.accentColor + '50' : 'var(--border)'}`,
                  }}
                >{label}</button>
              ))}
            </div>

            {/* メール一覧 */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filtered.length === 0 ? (
                <p className="text-fg-muted text-sm text-center py-8">該当するメールはありません</p>
              ) : (
                filtered.map(e => {
                  const isOpen = expanded === e.id;
                  return (
                    <motion.div
                      key={e.id}
                      className="rounded-xl"
                      style={{
                        background: 'var(--surface-3)',
                        border: `1px solid ${e.importance === 'high' ? IMPORT_COLOR.high + '60' : 'var(--border)'}`,
                        borderLeftWidth: '3px',
                        borderLeftColor: IMPORT_COLOR[e.importance],
                      }}
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    >
                      <button
                        className="w-full text-left p-3"
                        onClick={() => setExpanded(isOpen ? null : e.id)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase"
                              style={{ background: IMPORT_COLOR[e.importance] + '25', color: IMPORT_COLOR[e.importance], border: `1px solid ${IMPORT_COLOR[e.importance]}50` }}
                            >{IMPORT_LABEL[e.importance]}</span>
                            <span className="text-[10px] text-fg-muted">{URGENCY_LABEL[e.urgency]}</span>
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded"
                              style={{ background: 'var(--surface)', color: 'var(--fg-muted)' }}
                            >{e.category}</span>
                            {e.needsReply && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                style={{ background: persona.accentColorLight, color: persona.accentColor }}
                              >↩ 要返信</span>
                            )}
                            {e.estimatedReplyMin && e.estimatedReplyMin > 0 && (
                              <span className="text-[10px] text-fg-subtle">~{e.estimatedReplyMin}分</span>
                            )}
                          </div>
                          <span className="text-fg-muted text-xs flex-shrink-0">{isOpen ? '▾' : '▸'}</span>
                        </div>
                        <p className="text-fg text-sm font-semibold truncate">{e.subject}</p>
                        <p className="text-fg-muted text-xs truncate mt-0.5">{e.from}</p>
                        <p className="text-fg/85 text-sm mt-1.5 leading-snug">{e.summary}</p>
                      </button>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            className="overflow-hidden"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                          >
                            <div className="px-3 pb-3 space-y-2.5" style={{ borderTop: '1px solid var(--border)' }}>
                              {e.preview && (
                                <div className="pt-2.5">
                                  <p className="text-fg-muted text-xs tracking-wider uppercase mb-1">本文プレビュー</p>
                                  <p className="text-fg/80 text-xs leading-relaxed line-clamp-4 italic">{e.preview}</p>
                                </div>
                              )}

                              {e.actionRequired && (
                                <div
                                  className="p-2 rounded-lg flex items-start justify-between gap-2"
                                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                                >
                                  <div className="flex items-start gap-2 flex-1 min-w-0">
                                    <span className="text-sm" style={{ color: '#34d399' }}>▸</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-fg-muted text-xs">必要アクション</p>
                                      <p className="text-fg text-sm">{e.actionRequired}</p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={(ev) => { ev.stopPropagation(); onAcceptAction(e.actionRequired!); }}
                                    className="text-xs px-2 py-1 rounded flex-shrink-0"
                                    style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.4)' }}
                                  >＋タスク</button>
                                </div>
                              )}

                              {e.needsReply && e.draftReply && (
                                <div>
                                  <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                                    <p className="text-fg-muted text-xs tracking-wider uppercase">返信ドラフト</p>
                                    <div className="flex gap-1.5 flex-wrap">
                                      {gmailConnected && (e as any).gmailId && (
                                        sentIds.has(e.id) ? (
                                          <span
                                            className="text-[10px] px-2 py-1 rounded font-semibold"
                                            style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.4)' }}
                                          >✓ 送信済み</span>
                                        ) : (
                                          <button
                                            onClick={(ev) => { ev.stopPropagation(); handleSendGmail(e as any); }}
                                            disabled={sendingId === e.id}
                                            className="text-[10px] px-2 py-1 rounded font-semibold disabled:opacity-50"
                                            style={{ background: persona.accentColor, color: '#0a0a0f' }}
                                          >{sendingId === e.id ? '送信中…' : '📤 Gmail送信'}</button>
                                        )
                                      )}
                                      <button
                                        onClick={(ev) => { ev.stopPropagation(); copyToClipboard(e.draftReply!); }}
                                        className="text-[10px] px-2 py-1 rounded bg-surface-3 border-edge border text-fg-muted hover:text-fg"
                                      >📋 コピー</button>
                                      <button
                                        onClick={(ev) => { ev.stopPropagation(); handleRegenerate(e.id); }}
                                        disabled={regenerating === e.id}
                                        className="text-[10px] px-2 py-1 rounded bg-surface-3 border-edge border text-fg-muted hover:text-fg disabled:opacity-50"
                                      >{regenerating === e.id ? '...' : '🔄'}</button>
                                    </div>
                                  </div>
                                  <div
                                    className="p-2.5 rounded-lg whitespace-pre-wrap text-fg text-sm leading-relaxed"
                                    style={{ background: 'var(--surface)', border: `1px solid ${persona.accentColor}40` }}
                                  >{e.draftReply}</div>
                                  <div className="flex gap-1 mt-1.5">
                                    {[
                                      ['丁寧に', '丁寧で礼儀正しい'],
                                      ['カジュアル', 'カジュアルでフレンドリー'],
                                      ['簡潔に', '極めて簡潔に (2-3行)'],
                                    ].map(([label, tone]) => (
                                      <button
                                        key={label}
                                        onClick={(ev) => { ev.stopPropagation(); handleRegenerate(e.id, tone); }}
                                        disabled={regenerating === e.id}
                                        className="text-[10px] px-2 py-1 rounded bg-surface-3 border-edge border text-fg-muted hover:text-fg disabled:opacity-50"
                                      >{label}で書き直す</button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between gap-3 px-5 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => setBatch(null)}
                className="text-fg-muted hover:text-fg text-sm"
              >← 別のメールを処理</button>
              <p className="text-fg-muted text-xs">
                {batch.totalEmails}通 · 推定節約 ~{batch.emails.reduce((s, e) => s + (e.estimatedReplyMin || 0), 0)}分
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-fg-muted text-[10px] uppercase tracking-wider">{label}</span>
      <span className="font-bold text-base" style={{ color }}>{value}</span>
    </div>
  );
}
