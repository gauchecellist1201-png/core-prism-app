// ============================================================
// IrisDmDraftModal — AI 交渉文 (初回 DM 下書き) モーダル
//
// 案件カテゴリカードの ✨ ボタンから開く。
// AI が生成した DM 本文 + トーン違いの代替案を表示し、
// 編集 → コピー → Instagram DM 起動 まで完結できる UI。
//
// 機能:
// 1) トーンプリセット x 4 (丁寧/フレンドリー/プロ/熱量)
// 2) MediaKit 自動反映 (checkbox)
// 3) NG ワード検出 (赤バナー)
// 4) 返信パターン予測
// 5) 過去 5 件の履歴 (localStorage)
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Sparkles, RefreshCw, Copy, Send, AlertCircle, Check, Loader2,
  Clock, MessageCircle, FileText, AlertTriangle,
} from 'lucide-react';
import type { IgProfile } from './instagramConnect';
import {
  generateDmDraft, copyDmToClipboard, openInstagramDm,
  DM_TONE_META, DM_TONES,
  loadDmHistory, pushDmHistory, detectNgWords,
  type DmDraftResult, type DmDealInput, type DmTone, type DmMediaKitSummary,
  type DmDraftHistoryEntry, type DmGenerateOptions,
} from './dmDraft';
import { IRIS_TYPE, IRIS_RADIUS, IRIS_SHADOW, IRIS_GRADIENT } from './irisDesign';
import type { MediaKit } from '../types/influencerDeal';
import type { BrandGuideline } from './brandGuidelines';

interface Props {
  igProfile: IgProfile;
  deal: DmDealInput;
  mediaKit?: MediaKit;
  brandGuideline?: BrandGuideline;
  onClose: () => void;
}

// ── MediaKit → 簡易サマリ ────────────────────────────────────
function mediaKitSummaryFrom(kit?: MediaKit): DmMediaKitSummary | undefined {
  if (!kit) return undefined;
  // Instagram 中心の場合多いので IG を優先、なければ任意のプラットフォーム
  const igFollowers = kit.followers?.instagram;
  const anyFollowers = igFollowers ?? Object.values(kit.followers || {}).find(v => typeof v === 'number');
  const igEr = kit.avgEngagementRate?.instagram;
  const anyEr = igEr ?? Object.values(kit.avgEngagementRate || {}).find(v => typeof v === 'number');
  return {
    followers: typeof anyFollowers === 'number' ? anyFollowers.toLocaleString() : undefined,
    audience: kit.audienceProfile,
    category: undefined,  // MediaKit にカテゴリ専用フィールドはない
    engagement: typeof anyEr === 'number' ? anyEr : undefined,
  };
}

function hasMediaKitContent(s?: DmMediaKitSummary): boolean {
  if (!s) return false;
  return !!(s.followers || s.audience || s.category || s.engagement);
}

export default function IrisDmDraftModal({ igProfile, deal, mediaKit, brandGuideline, onClose }: Props) {
  const [result, setResult] = useState<DmDraftResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [editedBody, setEditedBody] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTone, setActiveTone] = useState<DmTone>('polite');
  const [mentionMediaKit, setMentionMediaKit] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<DmDraftHistoryEntry[]>([]);
  const [showRepliesAll, setShowRepliesAll] = useState(false);

  const mkSummary = useMemo(() => mediaKitSummaryFrom(mediaKit), [mediaKit]);
  const mkAvailable = hasMediaKitContent(mkSummary);
  const ngWords = useMemo(() => brandGuideline?.ngWords || [], [brandGuideline]);

  // 編集後の本文に対する NG リアルタイム検出
  const liveNgHits = useMemo(() => detectNgWords(editedBody, ngWords), [editedBody, ngWords]);

  // 履歴初回ロード
  useEffect(() => { setHistory(loadDmHistory()); }, []);

  // 初回生成 (トーン未指定 → サーバー側で自動推定)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const r = await generateDmDraft(igProfile, deal, {
        mediaKit: mkSummary,
        mentionMediaKit: false,
        ngWords,
      });
      if (cancelled) return;
      setResult(r);
      setEditedBody(r.draft.body);
      setActiveTone(r.draft.tone);
      setLoading(false);
      // 履歴に保存
      setHistory(pushDmHistory({
        brandName: deal.brandName,
        category: deal.category,
        tone: r.draft.tone,
        body: r.draft.body,
        source: r.source,
      }));
    })();
    return () => { cancelled = true; };
  }, [igProfile, deal]);

  // ESC で閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // トーン切替: alternatives に既に持っていればそれを表示、なければ API 再生成
  const switchTone = async (tone: DmTone) => {
    if (!result || tone === activeTone) return;
    // 既に手元にある?
    if (tone === result.draft.tone) {
      setEditedBody(result.draft.body);
      setActiveTone(tone);
      return;
    }
    const alt = result.alternatives.find(a => a.tone === tone);
    if (alt) {
      setEditedBody(alt.body);
      setActiveTone(tone);
      return;
    }
    // 持っていなければ API 再呼び出し (4 トーン全部 alternatives には載らないため)
    setLoading(true);
    setCopied(false);
    const opts: DmGenerateOptions = {
      customNote: customNote || undefined,
      tone,
      mediaKit: mkSummary,
      mentionMediaKit: mentionMediaKit && mkAvailable,
      ngWords,
    };
    const r = await generateDmDraft(igProfile, deal, opts);
    setResult(r);
    setEditedBody(r.draft.body);
    setActiveTone(r.draft.tone);
    setLoading(false);
    setHistory(pushDmHistory({
      brandName: deal.brandName,
      category: deal.category,
      tone: r.draft.tone,
      body: r.draft.body,
      source: r.source,
    }));
  };

  const regenerate = async () => {
    setLoading(true);
    setCopied(false);
    const opts: DmGenerateOptions = {
      customNote: customNote || undefined,
      tone: activeTone,
      mediaKit: mkSummary,
      mentionMediaKit: mentionMediaKit && mkAvailable,
      ngWords,
    };
    const r = await generateDmDraft(igProfile, deal, opts);
    setResult(r);
    setEditedBody(r.draft.body);
    setActiveTone(r.draft.tone);
    setLoading(false);
    setHistory(pushDmHistory({
      brandName: deal.brandName,
      category: deal.category,
      tone: r.draft.tone,
      body: r.draft.body,
      source: r.source,
    }));
  };

  const handleCopy = async () => {
    const ok = await copyDmToClipboard(editedBody);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleOpenInstagram = async () => {
    await copyDmToClipboard(editedBody);
    openInstagramDm(deal.contactHandle);
  };

  const loadFromHistory = (entry: DmDraftHistoryEntry) => {
    setEditedBody(entry.body);
    setActiveTone(entry.tone);
    setShowHistory(false);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(15, 12, 25, 0.78)',
        backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: 'max(env(safe-area-inset-top), 0.5rem) 0.5rem max(env(safe-area-inset-bottom), 0.5rem)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: 'calc(100vh - max(env(safe-area-inset-top), 0.5rem) - max(env(safe-area-inset-bottom), 0.5rem))',
          background: 'var(--bg, #fff)',
          color: 'var(--fg, #1F1A2E)',
          borderRadius: IRIS_RADIUS.xl,
          boxShadow: IRIS_SHADOW.xl,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── ヘッダー ────────────────────────────── */}
        <div style={{
          background: IRIS_GRADIENT.instagram,
          color: '#fff',
          padding: '1rem 1.1rem 1.1rem',
          position: 'relative',
        }}>
          <button
            onClick={onClose}
            aria-label="閉じる"
            style={{
              position: 'absolute', top: 8, right: 8,
              width: 44, height: 44,
              border: 'none', background: 'rgba(255,255,255,0.18)',
              borderRadius: IRIS_RADIUS.full,
              color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={20} strokeWidth={2.4} />
          </button>
          <button
            onClick={() => setShowHistory(true)}
            aria-label="過去の下書きを見る"
            title="過去の下書きを見る"
            disabled={history.length === 0}
            style={{
              position: 'absolute', top: 8, right: 60,
              width: 44, height: 44,
              border: 'none',
              background: history.length === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.18)',
              borderRadius: IRIS_RADIUS.full,
              color: '#fff',
              cursor: history.length === 0 ? 'not-allowed' : 'pointer',
              opacity: history.length === 0 ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Clock size={18} strokeWidth={2.4} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <Sparkles size={16} strokeWidth={2.4} />
            <span style={{ ...IRIS_TYPE.caption, opacity: 0.92, fontWeight: 600, letterSpacing: '0.04em' }}>
              AI 交渉文
            </span>
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, lineHeight: 1.3 }}>
            {deal.brandName}
          </div>
          <div style={{ ...IRIS_TYPE.small, opacity: 0.88, marginTop: 4 }}>
            {deal.category}
            {deal.fee ? `  •  想定報酬 ¥${deal.fee.toLocaleString()}` : '  •  報酬未確定'}
          </div>
        </div>

        {/* ── 本体 (スクロール領域) ────────────────────── */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '0.9rem 1rem 0.5rem',
          display: 'flex', flexDirection: 'column', gap: '0.85rem',
        }}>
          {loading && !result ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '3rem 1rem', gap: '0.7rem',
              color: 'var(--fg, #1F1A2E)', opacity: 0.7,
            }}>
              <Loader2 size={32} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />
              <div style={{ ...IRIS_TYPE.small }}>AI が下書きを書いています...</div>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : result ? (
            <>
              {/* 履歴オーバーレイ */}
              {showHistory && (
                <HistoryPanel
                  history={history}
                  onPick={loadFromHistory}
                  onClose={() => setShowHistory(false)}
                />
              )}

              {/* ソース表示 (フォールバック時のみ目立たせる) */}
              {result.source === 'fallback' && result.recovery && (
                <div style={{
                  display: 'flex', gap: '0.55rem',
                  padding: '0.65rem 0.75rem',
                  background: 'rgba(245, 158, 11, 0.10)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  borderRadius: IRIS_RADIUS.md,
                  color: 'var(--fg, #1F1A2E)',
                  ...IRIS_TYPE.small,
                }}>
                  <AlertCircle size={16} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{result.recovery}</span>
                </div>
              )}

              {/* NG ワード違反 (赤バナー) — ライブ検出 */}
              {liveNgHits.length > 0 && (
                <div style={{
                  display: 'flex', gap: '0.55rem',
                  padding: '0.7rem 0.8rem',
                  background: 'rgba(239, 68, 68, 0.10)',
                  border: '1.5px solid rgba(239, 68, 68, 0.55)',
                  borderRadius: IRIS_RADIUS.md,
                  color: '#991B1B',
                  ...IRIS_TYPE.small,
                  fontWeight: 600,
                }}>
                  <AlertTriangle size={17} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>
                      NG ワードが含まれています
                    </div>
                    <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>
                      ブランドガイドの禁止語: {liveNgHits.map(w => `「${w}」`).join('、')} — 送信前に必ず書き換えてください
                    </div>
                  </div>
                </div>
              )}

              {/* トーンプリセット x 4 */}
              <div>
                <div style={{ ...IRIS_TYPE.caption, fontWeight: 700, color: 'var(--fg, #1F1A2E)', opacity: 0.7, marginBottom: 6, letterSpacing: '0.04em' }}>
                  トーンを選ぶ
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                  {DM_TONES.map(t => {
                    const meta = DM_TONE_META[t];
                    const active = activeTone === t;
                    return (
                      <button
                        key={t}
                        onClick={() => switchTone(t)}
                        disabled={loading}
                        style={{
                          minHeight: 56,
                          padding: '0.5rem 0.65rem',
                          border: active ? `2px solid ${meta.color}` : '1px solid rgba(31,26,46,0.15)',
                          background: active ? `${meta.color}15` : 'transparent',
                          color: 'var(--fg, #1F1A2E)',
                          borderRadius: IRIS_RADIUS.lg,
                          cursor: loading ? 'not-allowed' : 'pointer',
                          opacity: loading ? 0.55 : 1,
                          textAlign: 'left',
                          display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.88rem', fontWeight: 700 }}>
                          <span>{meta.emoji}</span>
                          <span>{meta.label}</span>
                          {active && loading && (
                            <Loader2 size={12} style={{ marginLeft: 'auto', animation: 'spin 1s linear infinite' }} />
                          )}
                        </div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.65 }}>{meta.subtitle}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* MediaKit 自動反映 オプション */}
              <div style={{
                padding: '0.6rem 0.75rem',
                background: 'rgba(167, 139, 250, 0.06)',
                border: '1px solid rgba(167, 139, 250, 0.25)',
                borderRadius: IRIS_RADIUS.md,
              }}>
                {mkAvailable ? (
                  <label style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    cursor: 'pointer',
                    ...IRIS_TYPE.small,
                    color: 'var(--fg, #1F1A2E)',
                  }}>
                    <input
                      type="checkbox"
                      checked={mentionMediaKit}
                      onChange={e => setMentionMediaKit(e.target.checked)}
                      style={{ marginTop: 3, width: 17, height: 17, accentColor: '#A78BFA', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>
                        MediaKit を自動で反映する
                      </div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.75, marginTop: 2 }}>
                        本文に「私の特徴は◯◯」を1文追加します
                        {mkSummary && (
                          <>
                            {' — '}
                            {[
                              mkSummary.followers && `フォロワー${mkSummary.followers}`,
                              mkSummary.audience,
                              mkSummary.engagement && `ER ${mkSummary.engagement}%`,
                            ].filter(Boolean).join(' / ')}
                          </>
                        )}
                      </div>
                    </div>
                  </label>
                ) : (
                  <div style={{ ...IRIS_TYPE.small, opacity: 0.7, color: 'var(--fg, #1F1A2E)' }}>
                    MediaKit が未設定です。「メディアキット」タブで自分のフォロワー数・主要層を登録すると、本文に自動で反映できます。
                  </div>
                )}
              </div>

              {/* 本文編集エリア */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ ...IRIS_TYPE.caption, fontWeight: 700, color: 'var(--fg, #1F1A2E)', opacity: 0.7, letterSpacing: '0.04em' }}>
                    DM 本文 (編集できます)
                  </span>
                  <span style={{ ...IRIS_TYPE.caption, color: 'var(--fg, #1F1A2E)', opacity: 0.5 }}>
                    {editedBody.length} 字
                  </span>
                </div>
                <textarea
                  value={editedBody}
                  onChange={e => setEditedBody(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: 220,
                    padding: '0.75rem',
                    fontSize: '16px',
                    lineHeight: 1.6,
                    fontFamily: 'inherit',
                    color: 'var(--fg, #1F1A2E)',
                    background: 'var(--bg, #fff)',
                    border: liveNgHits.length > 0
                      ? '1.5px solid rgba(239, 68, 68, 0.5)'
                      : '1px solid rgba(31,26,46,0.15)',
                    borderRadius: IRIS_RADIUS.lg,
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* CTA */}
              {result.draft.callToAction && (
                <div style={{
                  padding: '0.6rem 0.75rem',
                  background: 'rgba(225, 48, 108, 0.06)',
                  border: '1px solid rgba(225, 48, 108, 0.2)',
                  borderRadius: IRIS_RADIUS.md,
                  ...IRIS_TYPE.small,
                  color: 'var(--fg, #1F1A2E)',
                }}>
                  <span style={{ fontWeight: 700, color: '#E1306C' }}>次のアクション: </span>
                  {result.draft.callToAction}
                </div>
              )}

              {/* 返信パターン予測 */}
              {result.replyPredictions && result.replyPredictions.length > 0 && (
                <div style={{
                  padding: '0.7rem 0.8rem',
                  background: 'rgba(59, 130, 246, 0.05)',
                  border: '1px solid rgba(59, 130, 246, 0.22)',
                  borderRadius: IRIS_RADIUS.md,
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    ...IRIS_TYPE.caption, fontWeight: 700,
                    color: '#1E40AF',
                    marginBottom: 6, letterSpacing: '0.04em',
                  }}>
                    <MessageCircle size={13} strokeWidth={2.5} />
                    相手はおそらくこう返してきます
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(showRepliesAll ? result.replyPredictions : result.replyPredictions.slice(0, 1))
                      .map((p, i) => (
                      <div key={i} style={{
                        padding: '0.55rem 0.65rem',
                        background: 'rgba(255,255,255,0.7)',
                        borderRadius: IRIS_RADIUS.sm,
                        ...IRIS_TYPE.small,
                        color: 'var(--fg, #1F1A2E)',
                      }}>
                        <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#1E40AF', marginBottom: 2 }}>
                          {p.label}
                        </div>
                        <div style={{ fontSize: '0.82rem', lineHeight: 1.5, opacity: 0.92 }}>
                          {p.example}
                        </div>
                      </div>
                    ))}
                  </div>
                  {result.replyPredictions.length > 1 && (
                    <button
                      onClick={() => setShowRepliesAll(v => !v)}
                      style={{
                        marginTop: 6,
                        width: '100%', minHeight: 36,
                        background: 'transparent',
                        border: 'none',
                        color: '#1E40AF',
                        fontSize: '0.8rem', fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {showRepliesAll
                        ? '閉じる'
                        : `他 ${result.replyPredictions.length - 1} 件の返信パターンを見る`}
                    </button>
                  )}
                </div>
              )}

              {/* 追加メモ + 再生成 */}
              <div>
                <div style={{ ...IRIS_TYPE.caption, fontWeight: 700, color: 'var(--fg, #1F1A2E)', opacity: 0.7, marginBottom: 6, letterSpacing: '0.04em' }}>
                  追加で伝えたいこと (任意)
                </div>
                <input
                  type="text"
                  value={customNote}
                  onChange={e => setCustomNote(e.target.value)}
                  placeholder="例: 過去にプチプラコスメで月100万再生のリール経験あり"
                  style={{
                    width: '100%',
                    height: 44,
                    padding: '0 0.75rem',
                    fontSize: '16px',
                    fontFamily: 'inherit',
                    color: 'var(--fg, #1F1A2E)',
                    background: 'var(--bg, #fff)',
                    border: '1px solid rgba(31,26,46,0.15)',
                    borderRadius: IRIS_RADIUS.md,
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  onClick={regenerate}
                  disabled={loading}
                  style={{
                    marginTop: 8,
                    width: '100%', minHeight: 44,
                    background: 'transparent',
                    border: '1px solid rgba(31,26,46,0.2)',
                    borderRadius: IRIS_RADIUS.md,
                    color: 'var(--fg, #1F1A2E)',
                    fontSize: '0.9rem', fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading
                    ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> 下書きを書いています…</>
                    : <><RefreshCw size={15} strokeWidth={2.3} /> このトーンで再生成</>}
                </button>
              </div>

              {/* 警告 */}
              {result.warnings && result.warnings.length > 0 && (
                <div style={{
                  background: 'rgba(31,26,46,0.04)',
                  border: '1px solid rgba(31,26,46,0.08)',
                  borderRadius: IRIS_RADIUS.md,
                  padding: '0.6rem 0.75rem',
                }}>
                  <div style={{ ...IRIS_TYPE.caption, fontWeight: 700, color: 'var(--fg, #1F1A2E)', opacity: 0.7, marginBottom: 4, letterSpacing: '0.04em' }}>
                    送信前のチェック
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.1rem', ...IRIS_TYPE.small, color: 'var(--fg, #1F1A2E)', opacity: 0.85 }}>
                    {result.warnings.map((w, i) => <li key={i} style={{ marginBottom: 2 }}>{w}</li>)}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', ...IRIS_TYPE.small, color: 'var(--fg, #1F1A2E)', opacity: 0.7 }}>
              下書きを取得できませんでした。もう一度お試しください。
            </div>
          )}
        </div>

        {/* ── フッター (アクション 2 ボタン) ─────────── */}
        <div style={{
          borderTop: '1px solid rgba(31,26,46,0.08)',
          padding: '0.7rem 0.85rem max(0.7rem, env(safe-area-inset-bottom))',
          display: 'flex', gap: 8,
          background: 'var(--bg, #fff)',
        }}>
          <button
            onClick={handleCopy}
            disabled={!editedBody || loading}
            style={{
              flex: 1, minHeight: 48,
              background: 'transparent',
              border: '1.5px solid rgba(31,26,46,0.2)',
              borderRadius: IRIS_RADIUS.lg,
              color: 'var(--fg, #1F1A2E)',
              fontSize: '0.95rem', fontWeight: 700,
              cursor: editedBody && !loading ? 'pointer' : 'not-allowed',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: editedBody && !loading ? 1 : 0.5,
            }}
          >
            {copied ? <><Check size={17} strokeWidth={2.5} /> コピー済み</> : <><Copy size={17} strokeWidth={2.5} /> コピー</>}
          </button>
          <button
            onClick={handleOpenInstagram}
            disabled={!editedBody || loading}
            style={{
              flex: 1.4, minHeight: 48,
              background: IRIS_GRADIENT.instagram,
              border: 'none',
              borderRadius: IRIS_RADIUS.lg,
              color: '#fff',
              fontSize: '0.95rem', fontWeight: 700,
              cursor: editedBody && !loading ? 'pointer' : 'not-allowed',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: editedBody && !loading ? 1 : 0.5,
              boxShadow: IRIS_SHADOW.card,
            }}
          >
            <Send size={17} strokeWidth={2.5} />
            Instagram で開く
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── 履歴パネル ───────────────────────────────────────────────
function HistoryPanel({
  history, onPick, onClose,
}: {
  history: DmDraftHistoryEntry[];
  onPick: (e: DmDraftHistoryEntry) => void;
  onClose: () => void;
}) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10,
      background: 'var(--bg, #fff)',
      display: 'flex', flexDirection: 'column',
      padding: '0.9rem 1rem',
      gap: '0.7rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...IRIS_TYPE.caption, fontWeight: 700, color: 'var(--fg, #1F1A2E)', letterSpacing: '0.04em' }}>
          <FileText size={14} strokeWidth={2.5} />
          過去の下書き ({history.length}/5)
        </div>
        <button
          onClick={onClose}
          aria-label="閉じる"
          style={{
            width: 36, height: 36, border: 'none',
            background: 'rgba(31,26,46,0.06)',
            borderRadius: IRIS_RADIUS.full,
            color: 'var(--fg, #1F1A2E)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={16} strokeWidth={2.4} />
        </button>
      </div>
      {history.length === 0 ? (
        <div style={{ padding: '2rem 1rem', textAlign: 'center', ...IRIS_TYPE.small, opacity: 0.7 }}>
          まだ下書きの履歴はありません
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {history.map(h => {
            const meta = DM_TONE_META[h.tone];
            const date = new Date(h.ts);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            return (
              <button
                key={h.id}
                onClick={() => onPick(h)}
                style={{
                  textAlign: 'left',
                  padding: '0.7rem 0.8rem',
                  background: 'rgba(31,26,46,0.03)',
                  border: '1px solid rgba(31,26,46,0.1)',
                  borderRadius: IRIS_RADIUS.lg,
                  cursor: 'pointer',
                  color: 'var(--fg, #1F1A2E)',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                  <span style={{ fontWeight: 700, color: meta?.color || '#A78BFA' }}>
                    {meta?.emoji} {meta?.label || h.tone} ・ {h.brandName}
                  </span>
                  <span style={{ opacity: 0.5 }}>{dateStr}</span>
                </div>
                <div style={{
                  fontSize: '0.78rem', opacity: 0.78,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  lineHeight: 1.5,
                }}>
                  {h.body.slice(0, 120)}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
