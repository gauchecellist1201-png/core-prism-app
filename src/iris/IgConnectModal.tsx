// ============================================================
// IgConnectModal — Instagram 連携モーダル (即時利用可能版)
// ============================================================
import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, ArrowRight, Check, Camera, Key, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';
import { createSelfReportedProfile, saveIgProfile, tryOauthConnect, connectWithToken } from './instagramConnect';
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

type Mode = 'self' | 'token';

export default function IgConnectModal({ onClose, onConnected }: Props) {
  const [mode, setMode] = useState<Mode>('self');
  const [handle, setHandle] = useState('');
  const [followers, setFollowers] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [oauthState, setOauthState] = useState<'idle' | 'trying' | 'unavailable'>('idle');
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
    const result = await tryOauthConnect();
    if (!result.ok) setOauthState('unavailable');
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
              <Camera size={12} /> INSTAGRAM 連携
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
          <Camera size={20} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>
              {oauthState === 'trying' ? '接続中…' :
               oauthState === 'unavailable' ? 'OAuth 接続は近日公開' :
               'Instagram でログインして連携 (おすすめ)'}
            </div>
            <div style={{ fontSize: 10, opacity: 0.92, marginTop: 2 }}>
              {oauthState === 'unavailable'
                ? 'Meta 審査完了次第、自動で有効化されます。それまでは下のいずれかを選んでください'
                : 'フォロワー・反応率・伸びる時間帯を自動取得します'}
            </div>
          </div>
          <ArrowRight size={16} />
        </button>

        {/* モード切替: 自己申告 / アクセストークン直接入力 */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 12,
          background: 'rgba(0,0,0,0.04)', padding: 4, borderRadius: 999,
        }}>
          <button type="button" onClick={() => setMode('self')} style={{
            flex: 1, padding: '7px 10px', borderRadius: 999, border: 'none',
            background: mode === 'self' ? '#fff' : 'transparent',
            color: mode === 'self' ? '#E1306C' : '#5A5562',
            fontSize: 11, fontWeight: 800, cursor: 'pointer',
            boxShadow: mode === 'self' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}>📝 自己申告で今すぐ</button>
          <button type="button" onClick={() => setMode('token')} style={{
            flex: 1, padding: '7px 10px', borderRadius: 999, border: 'none',
            background: mode === 'token' ? '#fff' : 'transparent',
            color: mode === 'token' ? '#E1306C' : '#5A5562',
            fontSize: 11, fontWeight: 800, cursor: 'pointer',
            boxShadow: mode === 'token' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}>🔑 アクセストークンで実データ</button>
        </div>

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
          ✨ 連携して案件を見る
        </button>

        <p style={{ fontSize: 10, color: '#8A8593', marginTop: 10, lineHeight: 1.7, textAlign: 'center' }}>
          ユーザー名 / フォロワー数 / ジャンル のみ保存。<br />
          Instagram のパスワードは不要です。
        </p>
        </>
        )}
      </motion.div>
    </motion.div>
  );
}
