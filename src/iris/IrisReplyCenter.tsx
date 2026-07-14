// ============================================================
// CORE Iris — 返信センター
//
// コメント: 実データ取得 → AI 下書き → 人間が編集・確認 → 実送信。
// DM: Instagram API の DM 送信は追加審査が必要で現在は不可のため、
//     「AI で下書き → コピー → Instagram を開く」導線 (正直に明記)。
// プラン: 一覧閲覧=全プラン / AI 下書き=ai-chat 枠 (Lite 30回/月)。
// モバイル最優先 (タップ 44px)、lucide アイコンのみ。
// ============================================================
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Inbox, RefreshCw, Wand2, Send, CheckCircle2, AlertTriangle,
  MessageSquareReply, Copy, ExternalLink, Lock,
} from 'lucide-react';
import type { IrisBackgroundDef, CustomIrisBackground } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import type { IrisAccount } from './multiAccount';
import { ACCOUNT_TYPE_META } from './multiAccount';
import {
  fetchRecentComments, sendCommentReply, generateReplyDraft,
  loadRepliedIds, markReplied,
  type ReplyMediaItem, type FetchCommentsResult,
} from './replyCenter';
import { enforceFeature, getUsageCount, checkFeature, getEffectivePlan, useBillingUser } from '../lib/billing';
import { generateDmDraft, copyDmToClipboard, openInstagramDm, DM_TONE_META, DM_TONES, type DmTone } from './dmDraft';
import { loadIgProfile } from './instagramConnect';
import { confirmAction } from '../lib/confirmDialog';
import { notifyInApp } from '../lib/inAppNotify';
import { LoaderBlock } from '../components/MicroLoader';

type Bg = IrisBackgroundDef | CustomIrisBackground;

interface Props {
  bg: Bg;
  account?: IrisAccount;
  onConnect?: () => void;
}

// ── 小さな共通スタイル ──────────────────────────────────────
const btn = (bg: Bg, primary?: boolean): React.CSSProperties => ({
  minHeight: 44,
  padding: '0.6rem 1rem',
  borderRadius: 12,
  fontSize: '0.85rem',
  fontWeight: 700,
  fontFamily: IRIS_FONTS.body,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  border: primary ? 'none' : `1px solid ${bg.cardBorder}`,
  background: primary ? `linear-gradient(135deg, #833AB4, #E1306C 60%, #F77737)` : 'rgba(255,255,255,0.75)',
  color: primary ? '#fff' : bg.ink,
});

function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'たった今';
  if (m < 60) return `${m} 分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 時間前`;
  return `${Math.floor(h / 24)} 日前`;
}

// ── AI 下書きの利用可否 (ai-chat 枠 — 既存慣行) ────────────
function aiQuotaLabel(planId: ReturnType<typeof getEffectivePlan>): string {
  const check = checkFeature(planId, 'ai-chat');
  if (check.limit === 'unlimited') return 'AI 下書き 無制限';
  if (typeof check.limit === 'number') {
    const used = getUsageCount('ai-chat');
    return `AI 下書き 残り ${Math.max(0, check.limit - used)} 回 (今月)`;
  }
  return '';
}

export default function IrisReplyCenter({ bg, account, onConnect }: Props) {
  const [view, setView] = useState<'comments' | 'dm'>('comments');
  const { user: billingUser } = useBillingUser();
  const planId = getEffectivePlan(billingUser);
  const accountId = account?.id || 'default';

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* タイトル + 作業中アカウント (運用代行で「どのクライアントか」を常に明示) */}
      <div>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.28em', color: bg.accent, fontWeight: 700, marginBottom: 4 }}>返信センター</p>
        <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '2rem', color: bg.ink, margin: 0 }}>
          ぜんぶ、ここで返す。
        </h2>
        <p style={{ color: bg.inkSoft, fontSize: '0.85rem', margin: '0.3rem 0 0', lineHeight: 1.55 }}>
          コメントも DM も、AI が「返し方」を先に下書き。あなたは読んで、選んで、送るだけ。
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          {account && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '0.25rem 0.7rem', borderRadius: 999,
              background: `${ACCOUNT_TYPE_META[account.type].color}14`,
              border: `1px solid ${ACCOUNT_TYPE_META[account.type].color}44`,
              fontSize: '0.75rem', fontWeight: 700, color: bg.ink,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: ACCOUNT_TYPE_META[account.type].color }} />
              @{account.handle.replace(/^@/, '')} の作業スペース ({ACCOUNT_TYPE_META[account.type].label})
            </span>
          )}
          <span style={{ fontSize: '0.72rem', color: bg.inkSoft }}>{aiQuotaLabel(planId)}</span>
        </div>
      </div>

      {/* コメント / DM 切り替え — 押す前に「何が起きるか」が分かるよう一言添える */}
      <div style={{ display: 'flex', gap: 8 }}>
        {([
          { id: 'comments' as const, label: 'コメント返信', sub: '届いたコメントに返す', Icon: MessageSquareReply },
          { id: 'dm' as const, label: 'DM 下書き', sub: '相手を選んで DM を書く', Icon: Send },
        ]).map(({ id, label, sub, Icon }) => {
          const on = view === id;
          return (
            <button key={id} onClick={() => setView(id)}
              style={{
                ...btn(bg, on),
                flex: 1,
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '0.6rem 0.5rem',
              }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                <Icon size={15} strokeWidth={2.4} />
                {label}
              </span>
              <span style={{ fontSize: '0.68rem', fontWeight: 600, opacity: on ? 0.9 : 0.7 }}>
                {sub}
              </span>
            </button>
          );
        })}
      </div>

      {view === 'comments'
        ? <CommentsPanel bg={bg} accountId={accountId} onConnect={onConnect} />
        : <DmPanel bg={bg} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// コメント返信パネル
// ════════════════════════════════════════════════════════════
function CommentsPanel({ bg, accountId, onConnect }: { bg: Bg; accountId: string; onConnect?: () => void }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'not_connected'>('loading');
  const [errMsg, setErrMsg] = useState('');
  const [items, setItems] = useState<ReplyMediaItem[]>([]);
  const [localReplied, setLocalReplied] = useState<Set<string>>(() => loadRepliedIds(accountId));
  const [showAnswered, setShowAnswered] = useState(false);

  // アカウント切替時はそのアカウントの返信済み記録を読み直す (アカウント別分離)
  useEffect(() => { setLocalReplied(loadRepliedIds(accountId)); }, [accountId]);

  const load = useCallback(async () => {
    setState('loading');
    setErrMsg('');
    try {
      const res: FetchCommentsResult = await fetchRecentComments();
      if (!res.ok) {
        setState(res.reason === 'not_connected' ? 'not_connected' : 'error');
        setErrMsg(res.message);
        return;
      }
      setItems(res.items);
      setState('ready');
    } catch {
      // 想定外の例外でも「読み込み中」で固まらせない（error画面→再読み込みへ）。
      setState('error');
      setErrMsg('コメントを読み込めませんでした。通信環境を確認してもう一度お試しください。');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const flat = useMemo(() => items.flatMap(m => m.comments.map(c => ({ media: m, comment: c }))), [items]);
  const pending = flat.filter(({ comment: c }) => !c.repliedByMe && !localReplied.has(c.id));
  const answered = flat.filter(({ comment: c }) => c.repliedByMe || localReplied.has(c.id));

  if (state === 'loading') {
    return <LoaderBlock accent={bg.accent} message="Instagram のコメントを読み込んでいます" padding="3rem 0" />;
  }

  if (state === 'not_connected') {
    return (
      <div style={{ background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 20, padding: '1.5rem', textAlign: 'center' }}>
        <Inbox size={28} color={bg.accent} strokeWidth={2} style={{ marginBottom: 8 }} />
        <p style={{ color: bg.ink, fontWeight: 700, margin: '0 0 4px' }}>Instagram が未連携です</p>
        <p style={{ color: bg.inkSoft, fontSize: '0.82rem', margin: '0 0 12px' }}>OAuth 連携すると、投稿へのコメントをここで読み込み、AI 下書きで返信できます。</p>
        {onConnect && (
          <button onClick={onConnect} style={btn(bg, true)}>Instagram を連携する</button>
        )}
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 20, padding: '1.25rem' }}>
        <p style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#B91C1C', fontWeight: 700, margin: '0 0 4px', fontSize: '0.88rem' }}>
          <AlertTriangle size={15} strokeWidth={2.4} /> コメントを読み込めませんでした
        </p>
        <p style={{ color: bg.inkSoft, fontSize: '0.8rem', margin: '0 0 12px' }}>{errMsg}</p>
        <button onClick={() => void load()} style={btn(bg)}>
          <RefreshCw size={14} strokeWidth={2.4} /> 再試行
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ margin: 0, fontSize: '0.82rem', color: bg.inkSoft }}>
          未返信 <strong style={{ color: bg.accent }}>{pending.length}</strong> 件
          {answered.length > 0 && <> ・ 返信済み {answered.length} 件</>}
        </p>
        <button onClick={() => void load()} title="再読み込み" aria-label="再読み込み" style={{ ...btn(bg), minHeight: 44, padding: '0 0.85rem' }}>
          <RefreshCw size={14} strokeWidth={2.4} />
        </button>
      </div>

      {pending.length === 0 && (
        <div style={{ background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 20, padding: '1.5rem', textAlign: 'center' }}>
          <CheckCircle2 size={26} color="#10B981" strokeWidth={2.2} style={{ marginBottom: 6 }} />
          <p style={{ color: bg.ink, fontWeight: 700, margin: 0 }}>未返信コメントはありません</p>
          <p style={{ color: bg.inkSoft, fontSize: '0.8rem', margin: '4px 0 0' }}>直近 12 投稿のコメントを確認しました。すべて返信済みです。</p>
        </div>
      )}

      {pending.map(({ media, comment }) => (
        <CommentCard key={comment.id} bg={bg} media={media} comment={comment}
          onSent={(id) => {
            markReplied(accountId, id);
            setLocalReplied(prev => new Set(prev).add(id));
          }}
        />
      ))}

      {answered.length > 0 && (
        <button onClick={() => setShowAnswered(v => !v)} style={{ ...btn(bg), alignSelf: 'flex-start' }}>
          返信済み {answered.length} 件を{showAnswered ? '隠す' : '見る'}
        </button>
      )}
      {showAnswered && answered.map(({ comment }) => (
        <div key={comment.id} style={{
          background: 'rgba(255,255,255,0.5)', border: `1px solid ${bg.cardBorder}`,
          borderRadius: 14, padding: '0.75rem 1rem', opacity: 0.75,
        }}>
          <p style={{ margin: 0, fontSize: '0.78rem', color: bg.inkSoft }}>
            <strong style={{ color: bg.ink }}>@{comment.username}</strong> ・ {timeAgo(comment.timestamp)} ・ <span style={{ color: '#10B981', fontWeight: 700 }}>返信済み</span>
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: bg.ink }}>{comment.text}</p>
        </div>
      ))}
    </div>
  );
}

// ── 1 コメント = 1 カード (AI 下書き → 編集 → 確認 → 送信) ──
function CommentCard({ bg, media, comment, onSent }: {
  bg: Bg;
  media: ReplyMediaItem;
  comment: ReplyMediaItem['comments'][number];
  onSent: (commentId: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [gate, setGate] = useState<{ reason: string; upgradeTo?: string } | null>(null);

  async function handleDraft() {
    setError('');
    setGate(null);
    // ai-chat 枠を消費 (Lite 30回/月・Standard 以上無制限 — 既存慣行)
    const guard = enforceFeature('ai-chat');
    if (!guard.ok) {
      setGate({ reason: guard.reason, upgradeTo: guard.upgradeTo });
      return;
    }
    setDrafting(true);
    const res = await generateReplyDraft({
      commentText: comment.text,
      commenterName: comment.username,
      postCaption: media.caption,
    });
    setDrafting(false);
    if (!res.ok) { setError(res.message); return; }
    setDraft(res.draft);
  }

  async function handleSend() {
    setError('');
    const body = draft.trim();
    if (!body) { setError('返信が空です。AI 下書きを作るか、ひとこと書いてください。'); return; }
    const ok = await confirmAction({
      title: `@${comment.username} さんに返信しますか?`,
      body: `この内容が Instagram に実際に投稿されます:\n\n${body}`,
      okLabel: '返信を送信する',
    });
    if (!ok) return;
    setSending(true);
    const res = await sendCommentReply(comment.id, body);
    setSending(false);
    if (!res.ok) { setError(res.message); return; }
    notifyInApp({ kind: 'success', title: '返信を送信しました', body: `@${comment.username} さんへの返信が Instagram に反映されます。` });
    onSent(comment.id);
  }

  return (
    <div style={{
      background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 18,
      padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem',
      boxShadow: '0 4px 16px rgba(31,26,46,0.06)',
    }}>
      {/* コメント本体 */}
      <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'flex-start' }}>
        {media.thumbnailUrl && (
          <img src={media.thumbnailUrl} alt="" width={44} height={44}
            style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '0.76rem', color: bg.inkSoft }}>
            <strong style={{ color: bg.ink }}>@{comment.username}</strong>
            {' ・ '}{timeAgo(comment.timestamp)}
            {comment.likeCount > 0 && <> ・ いいね {comment.likeCount}</>}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: '0.9rem', color: bg.ink, lineHeight: 1.5 }}>{comment.text}</p>
          {media.permalink && (
            <a href={media.permalink} target="_blank" rel="noreferrer"
              style={{ fontSize: '0.72rem', color: bg.accent, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 3 }}>
              投稿を見る <ExternalLink size={11} strokeWidth={2.4} />
            </a>
          )}
        </div>
      </div>

      {/* 下書きエリア */}
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        placeholder="返信を書く (AI 下書きボタンでたたき台を作れます)"
        rows={draft ? 3 : 2}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.8rem',
          borderRadius: 12, border: `1px solid ${bg.cardBorder}`, fontSize: '16px',
          fontFamily: IRIS_FONTS.body, color: bg.ink, background: 'rgba(255,255,255,0.8)',
          resize: 'vertical',
        }}
      />

      {/* プラン上限 (正直表示 + アップグレード導線) */}
      {gate && (
        <div style={{ background: 'rgba(225,48,108,0.06)', border: `1px solid ${bg.accent}44`, borderRadius: 12, padding: '0.7rem 0.85rem' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 6px', fontSize: '0.8rem', color: bg.ink, fontWeight: 700 }}>
            <Lock size={13} strokeWidth={2.4} color={bg.accent} /> {gate.reason}
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('iris:open-plan', { detail: { planId: gate.upgradeTo || 'standard' } }))}
            style={{ ...btn(bg, true), minHeight: 44 }}>
            プランを見る (Standard で AI 無制限)
          </button>
        </div>
      )}

      {/* エラー (silent fail 禁止 — 理由 + 再試行) */}
      {error && (
        <p style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: '0.78rem', color: '#B91C1C', fontWeight: 600 }}>
          <AlertTriangle size={13} strokeWidth={2.4} /> {error}
        </p>
      )}

      {/* アクション */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => void handleDraft()} disabled={drafting} style={{ ...btn(bg), flex: 1, opacity: drafting ? 0.6 : 1 }}>
          <Wand2 size={14} strokeWidth={2.4} color={bg.accent} />
          {drafting ? 'AI が考えています…' : draft ? 'AI で作り直す' : 'AI 下書き'}
        </button>
        <button onClick={() => void handleSend()} disabled={sending || !draft.trim()}
          style={{ ...btn(bg, true), flex: 1, opacity: (sending || !draft.trim()) ? 0.6 : 1 }}>
          <Send size={14} strokeWidth={2.4} />
          {sending ? '送信中…' : '確認して送信'}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// DM パネル — 直接送信は審査取得後に開通 (正直に表示)。
// 今は AI 下書き → コピー → Instagram を開く。
// ════════════════════════════════════════════════════════════
function DmPanel({ bg }: { bg: Bg }) {
  const [toHandle, setToHandle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [tone, setTone] = useState<DmTone>('polite');
  const [draft, setDraft] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState('');
  const [gate, setGate] = useState<{ reason: string; upgradeTo?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleDraft() {
    setError('');
    setGate(null);
    setCopied(false);
    const profile = loadIgProfile();
    if (!profile) {
      setError('Instagram プロフィールが未設定です。先に連携するとあなたらしい DM を作れます。');
      return;
    }
    const guard = enforceFeature('ai-chat');
    if (!guard.ok) {
      setGate({ reason: guard.reason, upgradeTo: guard.upgradeTo });
      return;
    }
    setDrafting(true);
    const res = await generateDmDraft(profile, {
      brandName: toHandle.replace(/^@/, '') || '相手',
      category: purpose || 'ご挨拶',
      contactHandle: toHandle || undefined,
    }, { tone, customNote: purpose || undefined });
    setDrafting(false);
    setDraft(res.draft.body);
    if (res.recovery) setError(res.recovery);
  }

  async function handleCopy() {
    const ok = await copyDmToClipboard(draft);
    setCopied(ok);
    if (!ok) setError('コピーできませんでした。本文を長押しして手動でコピーしてください。');
    else notifyInApp({ kind: 'success', title: 'DM 本文をコピーしました', body: 'Instagram を開いて貼り付けるだけです。' });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* 正直バナー: DM の直接送信は審査後に開通 */}
      <div style={{
        background: 'rgba(131,58,180,0.07)', border: '1px solid rgba(131,58,180,0.25)',
        borderRadius: 14, padding: '0.8rem 1rem',
      }}>
        <p style={{ margin: 0, fontSize: '0.8rem', color: bg.ink, lineHeight: 1.6 }}>
          <strong>DM の直接送信は、Instagram 社の審査取得後に開通します。</strong><br />
          それまでは「AI で下書き → コピー → Instagram を開く」が最速です。コメント返信は上のタブから直接送信できます。
        </p>
      </div>

      <div style={{ background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 18, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <input
          value={toHandle}
          onChange={e => setToHandle(e.target.value)}
          placeholder="送りたい相手 (@handle・任意)"
          style={{
            width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.8rem', minHeight: 44,
            borderRadius: 12, border: `1px solid ${bg.cardBorder}`, fontSize: '16px',
            fontFamily: IRIS_FONTS.body, color: bg.ink, background: 'rgba(255,255,255,0.8)',
          }}
        />
        <textarea
          value={purpose}
          onChange={e => setPurpose(e.target.value)}
          placeholder="用件 (例: コラボのお誘い / 商品レビューのご相談 / お礼)"
          rows={2}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.8rem',
            borderRadius: 12, border: `1px solid ${bg.cardBorder}`, fontSize: '16px',
            fontFamily: IRIS_FONTS.body, color: bg.ink, background: 'rgba(255,255,255,0.8)', resize: 'vertical',
          }}
        />
        {/* トーン選択 */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DM_TONES.map(t => (
            <button key={t} onClick={() => setTone(t)}
              style={{
                minHeight: 44, padding: '0.4rem 0.85rem', borderRadius: 999,
                border: `1px solid ${tone === t ? DM_TONE_META[t].color : bg.cardBorder}`,
                background: tone === t ? `${DM_TONE_META[t].color}14` : 'rgba(255,255,255,0.7)',
                color: tone === t ? DM_TONE_META[t].color : bg.inkSoft,
                fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: IRIS_FONTS.body,
                whiteSpace: 'nowrap',
              }}>
              {DM_TONE_META[t].label}
            </button>
          ))}
        </div>

        {gate && (
          <div style={{ background: 'rgba(225,48,108,0.06)', border: `1px solid ${bg.accent}44`, borderRadius: 12, padding: '0.7rem 0.85rem' }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 6px', fontSize: '0.8rem', color: bg.ink, fontWeight: 700 }}>
              <Lock size={13} strokeWidth={2.4} color={bg.accent} /> {gate.reason}
            </p>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('iris:open-plan', { detail: { planId: gate.upgradeTo || 'standard' } }))}
              style={{ ...btn(bg, true), minHeight: 44 }}>
              プランを見る (Standard で AI 無制限)
            </button>
          </div>
        )}
        {error && (
          <p style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: '0.78rem', color: '#B91C1C', fontWeight: 600 }}>
            <AlertTriangle size={13} strokeWidth={2.4} /> {error}
          </p>
        )}

        <button onClick={() => void handleDraft()} disabled={drafting} style={{ ...btn(bg, true), opacity: drafting ? 0.6 : 1 }}>
          <Wand2 size={14} strokeWidth={2.4} />
          {drafting ? 'AI が下書きしています…' : draft ? 'AI で作り直す' : 'AI で DM を下書き'}
        </button>

        {draft && (
          <>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={8}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '0.75rem 0.85rem',
                borderRadius: 12, border: `1px solid ${bg.cardBorder}`, fontSize: '16px',
                fontFamily: IRIS_FONTS.body, color: bg.ink, background: 'rgba(255,255,255,0.85)',
                resize: 'vertical', lineHeight: 1.6,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => void handleCopy()} style={{ ...btn(bg), flex: 1 }}>
                {copied ? <CheckCircle2 size={14} strokeWidth={2.4} color="#10B981" /> : <Copy size={14} strokeWidth={2.4} />}
                {copied ? 'コピー済み' : '本文をコピー'}
              </button>
              <button onClick={() => openInstagramDm(toHandle || undefined)} style={{ ...btn(bg, true), flex: 1 }}>
                <ExternalLink size={14} strokeWidth={2.4} /> Instagram を開く
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
