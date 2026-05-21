// ============================================================
// IrisDmDraftModal — AI 交渉文 (初回 DM 下書き) モーダル
//
// 案件カテゴリカードの ✨ ボタンから開く。
// AI が生成した DM 本文 + トーン違いの代替案を表示し、
// 編集 → コピー → Instagram DM 起動 まで完結できる UI。
// ============================================================
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Sparkles, RefreshCw, Copy, Send, AlertCircle, Check, Loader2,
} from 'lucide-react';
import type { IgProfile } from './instagramConnect';
import {
  generateDmDraft, copyDmToClipboard, openInstagramDm,
  DM_TONE_META, type DmDraftResult, type DmDealInput, type DmTone,
} from './dmDraft';
import { IRIS_TYPE, IRIS_RADIUS, IRIS_SHADOW, IRIS_GRADIENT } from './irisDesign';

interface Props {
  igProfile: IgProfile;
  deal: DmDealInput;
  onClose: () => void;
}

export default function IrisDmDraftModal({ igProfile, deal, onClose }: Props) {
  const [result, setResult] = useState<DmDraftResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [editedBody, setEditedBody] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTone, setActiveTone] = useState<DmTone>('professional');

  // 初回生成
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const r = await generateDmDraft(igProfile, deal);
      if (cancelled) return;
      setResult(r);
      setEditedBody(r.draft.body);
      setActiveTone(r.draft.tone);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [igProfile, deal]);

  // ESC で閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const switchTone = (tone: DmTone) => {
    if (!result) return;
    if (tone === result.draft.tone) {
      setEditedBody(result.draft.body);
      setActiveTone(tone);
      return;
    }
    const alt = result.alternatives.find(a => a.tone === tone);
    if (alt) {
      setEditedBody(alt.body);
      setActiveTone(tone);
    }
  };

  const regenerate = async () => {
    setLoading(true);
    setCopied(false);
    const r = await generateDmDraft(igProfile, deal, customNote || undefined);
    setResult(r);
    setEditedBody(r.draft.body);
    setActiveTone(r.draft.tone);
    setLoading(false);
  };

  const handleCopy = async () => {
    const ok = await copyDmToClipboard(editedBody);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleOpenInstagram = async () => {
    // 先にクリップボードへコピー (DM 画面でペーストできるように)
    await copyDmToClipboard(editedBody);
    openInstagramDm(deal.contactHandle);
  };

  // 利用可能なトーン (現在の draft + alternatives)
  const availableTones: DmTone[] = result
    ? Array.from(new Set([result.draft.tone, ...result.alternatives.map(a => a.tone)]))
    : ['professional', 'casual', 'friendly'];

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
          {loading ? (
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

              {/* トーン切替 */}
              <div>
                <div style={{ ...IRIS_TYPE.caption, fontWeight: 700, color: 'var(--fg, #1F1A2E)', opacity: 0.7, marginBottom: 6, letterSpacing: '0.04em' }}>
                  トーン
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {availableTones.map(t => {
                    const meta = DM_TONE_META[t];
                    const active = activeTone === t;
                    return (
                      <button
                        key={t}
                        onClick={() => switchTone(t)}
                        style={{
                          minHeight: 44,
                          padding: '0.5rem 0.85rem',
                          border: active ? `2px solid ${meta.color}` : '1px solid rgba(31,26,46,0.15)',
                          background: active ? `${meta.color}15` : 'transparent',
                          color: 'var(--fg, #1F1A2E)',
                          borderRadius: IRIS_RADIUS.full,
                          fontSize: '0.85rem', fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        <span>{meta.emoji}</span>
                        <span>{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
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
                    fontSize: '16px',  // iOS 自動ズーム回避
                    lineHeight: 1.6,
                    fontFamily: 'inherit',
                    color: 'var(--fg, #1F1A2E)',
                    background: 'var(--bg, #fff)',
                    border: '1px solid rgba(31,26,46,0.15)',
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
                  <RefreshCw size={15} strokeWidth={2.3} />
                  別のトーンで再生成
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
