// ============================================================
// IgConnectModal — Instagram 連携モーダル (即時利用可能版)
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X, ArrowRight, Check, Key, ExternalLink, AlertCircle, Loader2, ImageUp, Sparkles } from 'lucide-react';
import InstagramGlyph from './InstagramGlyph';
import { createSelfReportedProfile, saveIgProfile, tryOauthConnect, connectWithToken, connectFromScreenshot } from './instagramConnect';
import type { IgProfile } from './instagramConnect';

interface Props {
  onClose: () => void;
  onConnected: (p: IgProfile) => void;
}

const CATEGORIES = [
  '美容', 'ファッション', 'コスメ', 'スキンケア', 'ライフスタイル',
  '料理', '旅行', 'フィットネス', 'ペット', '子育て',
  'ガジェット', '本', '映画', 'アート', 'ハンドメイド',
];

type Mode = 'screenshot' | 'self' | 'token';

export default function IgConnectModal({ onClose, onConnected }: Props) {
  const [mode, setMode] = useState<Mode>('screenshot');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  // 最新の blob URL を保持して unmount 時に確実に revoke するための ref
  const previewUrlRef = useRef<string | null>(null);
  const [shotStatus, setShotStatus] = useState<'idle' | 'reading' | 'success' | 'failed'>('idle');
  const [shotRecovery, setShotRecovery] = useState<string | null>(null);

  const handleScreenshotFile = async (file: File | null) => {
    if (!file) return;
    setShotRecovery(null);
    setError(null);
    setShotStatus('reading');
    // プレビュー表示用 (UX 上「読み取り中」を見せる)
    // 前回のプレビュー blob を必ず revoke してメモリリークを防ぐ
    try {
      const url = URL.createObjectURL(file);
      if (previewUrlRef.current) {
        try { URL.revokeObjectURL(previewUrlRef.current); } catch { /* */ }
      }
      previewUrlRef.current = url;
      setScreenshotPreview(url);
    } catch { /* */ }
    const res = await connectFromScreenshot(file);
    if (res.ok) {
      setShotStatus('success');
      setTimeout(() => { onConnected(res.profile); onClose(); }, 1400);
    } else {
      setShotStatus('failed');
      setError(res.message);
      setShotRecovery(res.recovery || null);
    }
  };

  // モーダルを閉じる時に最後のプレビュー blob URL を解放 (ref ベースで stale closure を回避)
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        try { URL.revokeObjectURL(previewUrlRef.current); } catch { /* */ }
        previewUrlRef.current = null;
      }
    };
  }, []);
  const [handle, setHandle] = useState('');
  const [followers, setFollowers] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [oauthState, setOauthState] = useState<'idle' | 'trying' | 'unavailable'>('idle');
  const [oauthError, setOauthError] = useState<{ message: string; recovery: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // トークン直接入力モード
  const [igToken, setIgToken] = useState('');
  const [igAccountId, setIgAccountId] = useState('');
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'connecting' | 'success' | 'failed'>('idle');
  const [tokenRecovery, setTokenRecovery] = useState<string | null>(null);

  const handleTokenSubmit = async () => {
    setError(null);
    setTokenRecovery(null);
    if (!igToken.trim()) {
      setError('アクセストークンを貼り付けてください');
      return;
    }
    setTokenStatus('connecting');
    const result = await connectWithToken(igToken, igAccountId);
    if (result.ok) {
      setTokenStatus('success');
      // 1.2 秒後に閉じてプロフィール反映
      setTimeout(() => { onConnected(result.profile); onClose(); }, 1200);
    } else {
      setTokenStatus('failed');
      setError(result.message);
      setTokenRecovery(result.recovery || null);
    }
  };

  const handleOauth = async () => {
    setOauthState('trying');
    setError(null);
    setOauthError(null);
    const result = await tryOauthConnect();
    if (result.ok && result.mode === 'connected') {
      // 既に連携済み → プロフィール取得成功。閉じて反映 (以前はここで
      // 何も起きず「接続中…」のまま固まるバグがあった)
      setOauthState('idle');
      onConnected(result.profile);
      onClose();
      return;
    }
    if (result.ok && result.mode === 'redirect') {
      // Instagram の許可画面へ遷移中。'trying' のままページが切り替わる
      return;
    }
    if (!result.ok) {
      // 失敗は必ず理由と復旧手段を見せる
      setOauthState(result.reason === 'pending_meta_review' ? 'unavailable' : 'idle');
      setOauthError({ message: result.message, recovery: result.recovery || null });
    }
  };

  const handleSelfSubmit = () => {
    setError(null);
    const h = handle.trim().replace(/^@/, '');
    if (!h) { setError('Instagram のユーザー名を入れてください'); return; }
    const f = parseInt(followers.replace(/,/g, ''), 10);
    if (!f || f < 0) { setError('フォロワー数を半角数字で入れてください'); return; }
    const profile = createSelfReportedProfile({ handle: h, followers: f, categories: selected });
    saveIgProfile(profile);
    onConnected(profile);
    onClose();
  };

  const toggleCat = (c: string) => {
    setSelected(s => s.includes(c) ? s.filter(x => x !== c) : [...s, c]);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(15,10,25,0.7)', backdropFilter: 'blur(14px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <motion.div
        initial={{ scale: 0.92, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 30 }}
        transition={{ type: 'spring', damping: 22, stiffness: 260 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 22, padding: '1.5rem',
          maxWidth: 480, width: '100%',
          maxHeight: 'calc(100dvh - 2rem)', overflow: 'auto',
          color: '#1F1A2E',
          boxShadow: '0 30px 80px rgba(15,10,25,0.4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 10, letterSpacing: '0.25em', fontWeight: 800, color: '#E1306C',
            }}>
              <InstagramGlyph size={12} color="#E1306C" /> INSTAGRAM 連携
            </div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0.3rem 0 0', lineHeight: 1.4 }}>
              あなたに合う案件を見つけます
            </h2>
          </div>
          <button type="button" onClick={onClose} style={{
            background: 'rgba(0,0,0,0.04)', border: 'none', borderRadius: '50%',
            width: 38, height: 38, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }} aria-label="閉じる"><X size={18} /></button>
        </div>

        <button type="button" onClick={handleOauth} disabled={oauthState === 'unavailable'} style={{
          width: '100%', textAlign: 'left',
          padding: '0.9rem 1rem', borderRadius: 14,
          background: 'linear-gradient(135deg, #833AB4, #E1306C 50%, #F77737)',
          color: '#fff', border: 'none',
          cursor: oauthState === 'unavailable' ? 'not-allowed' : 'pointer',
          opacity: oauthState === 'unavailable' ? 0.5 : 1,
          display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: '0.6rem',
          boxShadow: '0 8px 20px rgba(225,48,108,0.3)',
        }}>
          <InstagramGlyph size={20} color="#fff" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {oauthState === 'trying' ? <><Loader2 size={13} className="iris-spin" /> Instagram へ接続中…</> :
               oauthState === 'unavailable' ? '本連携を準備中（まもなく開通）' :
               'Instagram でログインして連携 (本連携・おすすめ)'}
            </div>
            <div style={{ fontSize: 10, opacity: 0.92, marginTop: 2 }}>
              {oauthState === 'unavailable'
                ? '開通までは下の「手入力」でお使いいただけます'
                : 'フォロワー・反応率・伸びる時間帯を自動取得します'}
            </div>
          </div>
          <ArrowRight size={16} />
        </button>

        {/* 本連携のエラー (必ず理由と次の一手を見せる — silent fail 禁止) */}
        {oauthError && (
          <div style={{
            background: 'rgba(200,16,46,0.08)', border: '1px solid rgba(200,16,46,0.25)',
            padding: '0.6rem 0.85rem', borderRadius: 10, marginBottom: '0.6rem',
            color: '#9B1B30', fontSize: 12, lineHeight: 1.6,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <strong>{oauthError.message}</strong>
                {oauthError.recovery && (
                  <div style={{ marginTop: 4, fontSize: 11, color: '#5A5562', fontWeight: 500 }}>{oauthError.recovery}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* モード切替: スクショ / 自己申告 / アクセストークン */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 12,
          background: 'rgba(0,0,0,0.04)', padding: 4, borderRadius: 14,
        }}>
          <button type="button" onClick={() => setMode('screenshot')} style={{
            padding: '8px 6px', borderRadius: 10, border: 'none',
            background: mode === 'screenshot' ? '#fff' : 'transparent',
            color: mode === 'screenshot' ? '#E1306C' : '#5A5562',
            fontSize: 11, fontWeight: 800, cursor: 'pointer',
            boxShadow: mode === 'screenshot' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            lineHeight: 1.25,
          }}>
            <span>📸 スクショで連携</span>
            <span style={{ fontSize: 9, color: mode === 'screenshot' ? '#E1306C' : '#8A8593', fontWeight: 700 }}>本連携が使えない時に</span>
          </button>
          <button type="button" onClick={() => setMode('self')} style={{
            padding: '8px 6px', borderRadius: 10, border: 'none',
            background: mode === 'self' ? '#fff' : 'transparent',
            color: mode === 'self' ? '#E1306C' : '#5A5562',
            fontSize: 11, fontWeight: 800, cursor: 'pointer',
            boxShadow: mode === 'self' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            lineHeight: 1.25,
          }}>
            <span>📝 自己申告</span>
            <span style={{ fontSize: 9, color: mode === 'self' ? '#E1306C' : '#8A8593', fontWeight: 700 }}>手入力</span>
          </button>
          <button type="button" onClick={() => setMode('token')} style={{
            padding: '8px 6px', borderRadius: 10, border: 'none',
            background: mode === 'token' ? '#fff' : 'transparent',
            color: mode === 'token' ? '#E1306C' : '#5A5562',
            fontSize: 11, fontWeight: 800, cursor: 'pointer',
            boxShadow: mode === 'token' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            lineHeight: 1.25,
          }}>
            <span>🔑 上級者用</span>
            <span style={{ fontSize: 9, color: mode === 'token' ? '#E1306C' : '#8A8593', fontWeight: 700 }}>API キー</span>
          </button>
        </div>

        {/* === スクショ連携モード (デフォルト・最も簡単) === */}
        {mode === 'screenshot' && (
          <>
            <div style={{
              background: 'linear-gradient(135deg, rgba(225,48,108,0.06), rgba(252,176,69,0.04))',
              border: '1px solid rgba(225,48,108,0.18)',
              borderRadius: 14, padding: '0.85rem 1rem', marginBottom: '0.85rem',
              fontSize: 11.5, color: '#5A5562', lineHeight: 1.7,
            }}>
              <div style={{ fontWeight: 800, color: '#E1306C', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                <Sparkles size={13} /> 3 タップで完了します
              </div>
              <ol style={{ paddingLeft: 18, margin: 0 }}>
                <li>Instagram アプリで <strong>自分のプロフィール画面</strong> を開く</li>
                <li>スクリーンショットを撮る (iPhone はサイドボタン＋音量上)</li>
                <li>下のボタンでアップロード → <strong>AI が自動で読み取ります</strong></li>
              </ol>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => handleScreenshotFile(e.target.files?.[0] || null)}
              style={{ display: 'none' }}
            />

            {/* プレビュー (アップロード後) */}
            {screenshotPreview && (
              <div style={{
                marginBottom: '0.85rem', position: 'relative',
                borderRadius: 12, overflow: 'hidden',
                border: '1px solid rgba(0,0,0,0.10)',
                maxHeight: 280,
              }}>
                <img src={screenshotPreview} alt="アップロードされたスクショ"
                  style={{ width: '100%', display: 'block', maxHeight: 280, objectFit: 'cover' }} />
                {shotStatus === 'reading' && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(15,10,25,0.55)', backdropFilter: 'blur(6px)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', gap: 8,
                  }}>
                    <Loader2 size={28} className="iris-spin" />
                    <span style={{ fontSize: 12, fontWeight: 800 }}>AI が読み取り中…</span>
                    <span style={{ fontSize: 10, opacity: 0.8 }}>あと数秒お待ちください</span>
                  </div>
                )}
                {shotStatus === 'success' && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(16,185,129,0.85)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', gap: 6,
                  }}>
                    <Check size={36} strokeWidth={3} />
                    <span style={{ fontSize: 13, fontWeight: 800 }}>読み取れました</span>
                  </div>
                )}
              </div>
            )}

            {error && shotStatus === 'failed' && (
              <div style={{
                background: 'rgba(200,16,46,0.08)', border: '1px solid rgba(200,16,46,0.25)',
                padding: '0.6rem 0.85rem', borderRadius: 10, marginBottom: '0.75rem',
                color: '#9B1B30', fontSize: 12, lineHeight: 1.6,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <strong>{error}</strong>
                    {shotRecovery && <div style={{ marginTop: 4, fontSize: 11, color: '#5A5562', fontWeight: 500 }}>{shotRecovery}</div>}
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={shotStatus === 'reading' || shotStatus === 'success'}
              style={{
                width: '100%',
                background: shotStatus === 'success'
                  ? 'linear-gradient(135deg, #10B981, #059669)'
                  : 'linear-gradient(135deg, #E1306C, #F77737)',
                color: '#fff', border: 'none', borderRadius: 99,
                padding: '1rem 1.4rem', fontSize: 15, fontWeight: 800,
                cursor: (shotStatus === 'reading' || shotStatus === 'success') ? 'not-allowed' : 'pointer',
                opacity: (shotStatus === 'reading' || shotStatus === 'success') ? 0.8 : 1,
                boxShadow: '0 10px 28px rgba(225,48,108,0.4)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
              {shotStatus === 'reading' ? <><Loader2 size={16} className="iris-spin" /> 読み取り中…</>
                : shotStatus === 'success' ? <><Check size={16} /> 連携できました</>
                : screenshotPreview ? <><ImageUp size={16} /> 別のスクショで試す</>
                : <><ImageUp size={16} /> スクショをアップロード</>}
            </button>

            <p style={{ fontSize: 10.5, color: '#8A8593', marginTop: 12, lineHeight: 1.75, textAlign: 'center' }}>
              プロフィール画面の <strong style={{ color: '#5A5562' }}>ユーザー名・フォロワー数・投稿数</strong> が映ったスクショを選んでください。<br />
              画像はあなたの端末から直接 AI に送られ、保存されません。
            </p>
          </>
        )}

        {/* === トークン直接入力モード === */}
        {mode === 'token' && (
          <>
            <div style={{
              background: 'rgba(225,48,108,0.06)', border: '1px solid rgba(225,48,108,0.18)',
              borderRadius: 12, padding: '0.7rem 0.85rem', marginBottom: '0.85rem',
              fontSize: 11, color: '#5A5562', lineHeight: 1.7,
            }}>
              <div style={{ fontWeight: 800, color: '#E1306C', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Key size={12} /> 実データ連携の手順 (3 分)
              </div>
              <ol style={{ paddingLeft: 18, margin: 0 }}>
                <li>Instagram を <strong>ビジネス/クリエイター</strong> アカウントに切替、Facebook ページと紐付け</li>
                <li>
                  <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer"
                    style={{ color: '#E1306C', textDecoration: 'underline', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    Graph API Explorer<ExternalLink size={10} />
                  </a>{' '}を開き「User Access Token」を発行
                </li>
                <li>権限: <code style={{ background: 'rgba(0,0,0,0.05)', padding: '1px 4px', borderRadius: 4 }}>instagram_basic</code> /
                  <code style={{ background: 'rgba(0,0,0,0.05)', padding: '1px 4px', borderRadius: 4 }}>instagram_manage_insights</code> /
                  <code style={{ background: 'rgba(0,0,0,0.05)', padding: '1px 4px', borderRadius: 4 }}>pages_show_list</code></li>
                <li>「Generate Access Token」→ 下に貼り付け</li>
              </ol>
            </div>

            <div style={{ marginBottom: '0.7rem' }}>
              <label style={{ display: 'block', fontSize: 11, color: '#5A5562', fontWeight: 700, marginBottom: 4 }}>
                アクセストークン
              </label>
              <textarea value={igToken} onChange={e => setIgToken(e.target.value)}
                placeholder="EAAxxxxxxxxx... (長いトークン)"
                rows={2}
                style={{
                  width: '100%', padding: '0.7rem 0.9rem', borderRadius: 12,
                  border: '1px solid rgba(0,0,0,0.12)', fontSize: 12,
                  fontFamily: 'ui-monospace, Menlo, monospace', outline: 'none',
                  resize: 'vertical',
                }} />
            </div>

            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: 11, color: '#5A5562', fontWeight: 700, marginBottom: 4 }}>
                Instagram Business Account ID <span style={{ fontWeight: 500, color: '#8A8593' }}>(空欄でも自動検出します)</span>
              </label>
              <input type="text" value={igAccountId} onChange={e => setIgAccountId(e.target.value)}
                placeholder="例: 17841400000000000"
                style={{ width: '100%', padding: '0.7rem 0.9rem', borderRadius: 12, border: '1px solid rgba(0,0,0,0.12)', fontSize: 13, fontFamily: 'ui-monospace, Menlo, monospace', outline: 'none' }} />
            </div>

            {error && (
              <div style={{
                background: 'rgba(200,16,46,0.08)', border: '1px solid rgba(200,16,46,0.25)',
                padding: '0.6rem 0.85rem', borderRadius: 10, marginBottom: '0.75rem',
                color: '#9B1B30', fontSize: 12, lineHeight: 1.6,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <strong>{error}</strong>
                    {tokenRecovery && <div style={{ marginTop: 4, fontSize: 11, color: '#5A5562', fontWeight: 500 }}>{tokenRecovery}</div>}
                  </div>
                </div>
              </div>
            )}

            {tokenStatus === 'success' && (
              <div style={{
                background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.35)',
                padding: '0.7rem 0.85rem', borderRadius: 10, marginBottom: '0.75rem',
                color: '#0F7D63', fontSize: 12, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                <Check size={14} /> 実データの取込に成功しました。Iris ホームに反映します…
              </div>
            )}

            <button type="button" onClick={handleTokenSubmit}
              disabled={tokenStatus === 'connecting' || tokenStatus === 'success'}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #E1306C, #F77737)',
                color: '#fff', border: 'none', borderRadius: 99,
                padding: '0.85rem 1.4rem', fontSize: 14, fontWeight: 800,
                cursor: (tokenStatus === 'connecting' || tokenStatus === 'success') ? 'not-allowed' : 'pointer',
                opacity: (tokenStatus === 'connecting' || tokenStatus === 'success') ? 0.65 : 1,
                boxShadow: '0 10px 24px rgba(225,48,108,0.35)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}>
              {tokenStatus === 'connecting' ? <><Loader2 size={14} className="iris-spin" /> 取得中…</>
                : tokenStatus === 'success' ? <><Check size={14} /> 連携できました</>
                : <>🔑 アクセストークンで実データ連携</>}
            </button>

            <p style={{ fontSize: 10, color: '#8A8593', marginTop: 10, lineHeight: 1.7, textAlign: 'center' }}>
              トークンはあなたの端末内にのみ保存されます。CORE のサーバーへは送信しません。
            </p>
          </>
        )}

        {/* === 自己申告モード === */}
        {mode === 'self' && (
        <>
        <div style={{ marginBottom: '0.85rem' }}>
          <label style={{ display: 'block', fontSize: 11, color: '#5A5562', fontWeight: 700, marginBottom: 4 }}>
            Instagram ユーザー名
          </label>
          <input type="text" value={handle} onChange={e => setHandle(e.target.value)} placeholder="@your_handle"
            style={{ width: '100%', padding: '0.7rem 0.9rem', borderRadius: 12, border: '1px solid rgba(0,0,0,0.12)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
        </div>

        <div style={{ marginBottom: '0.85rem' }}>
          <label style={{ display: 'block', fontSize: 11, color: '#5A5562', fontWeight: 700, marginBottom: 4 }}>
            フォロワー数 (おおよそで OK)
          </label>
          <input type="text" inputMode="numeric" value={followers}
            onChange={e => setFollowers(e.target.value.replace(/[^0-9,]/g, ''))} placeholder="例: 8500"
            style={{ width: '100%', padding: '0.7rem 0.9rem', borderRadius: 12, border: '1px solid rgba(0,0,0,0.12)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
        </div>

        <div style={{ marginBottom: '0.85rem' }}>
          <label style={{ display: 'block', fontSize: 11, color: '#5A5562', fontWeight: 700, marginBottom: 6 }}>
            あなたが普段投稿するジャンル (複数選択 OK)
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CATEGORIES.map(c => {
              const isSel = selected.includes(c);
              return (
                <button key={c} type="button" onClick={() => toggleCat(c)} style={{
                  padding: '0.35rem 0.7rem', borderRadius: 99,
                  background: isSel ? 'linear-gradient(135deg, #E1306C, #F77737)' : 'rgba(0,0,0,0.04)',
                  color: isSel ? '#fff' : '#5A5562',
                  border: isSel ? 'none' : '1px solid rgba(0,0,0,0.08)',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  {isSel && <Check size={10} />} {c}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(200,16,46,0.08)', border: '1px solid rgba(200,16,46,0.25)',
            padding: '0.55rem 0.85rem', borderRadius: 10, marginBottom: '0.75rem',
            color: '#9B1B30', fontSize: 12,
          }}>⚠ {error}</div>
        )}

        <button type="button" onClick={handleSelfSubmit} style={{
          width: '100%',
          background: 'linear-gradient(135deg, #E1306C, #F77737)',
          color: '#fff', border: 'none', borderRadius: 99,
          padding: '0.85rem 1.4rem', fontSize: 14, fontWeight: 800,
          cursor: 'pointer',
          boxShadow: '0 10px 24px rgba(225,48,108,0.35)',
        }}>
          手入力ではじめる
        </button>

        <p style={{ fontSize: 10, color: '#8A8593', marginTop: 10, lineHeight: 1.7, textAlign: 'center' }}>
          これは<strong>簡易入力</strong>です（自動連携ではありません）。投稿数・反応率・リーチは取得できません。<br />
          数字を自動取得したい場合は上の「スクショ」または「本連携」をお使いください。
        </p>
        </>
        )}
      </motion.div>
    </motion.div>
  );
}
