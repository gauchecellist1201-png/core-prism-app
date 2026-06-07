// ============================================================
// TotpSetup — 2 段階認証 セットアップ画面
//
// オーナー指示 (2026-06-04 第 25 波 LLLL):
//   オーナーが master キー以外でも自分のアカウントを守れる。
//   Google Authenticator 互換 (RFC 6238)。
//
// フロー:
//   1) 「2 段階認証を設定」 → 新シークレット生成 + QR (Google Charts API 経由)
//   2) ユーザーが Authenticator アプリで読み込み → 6 桁コード入力
//   3) サーバ検証 (/api/auth/totp-verify) + ローカル検証
//   4) 成功 → secret を localStorage に保存 → 「設定完了」
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, Copy, Check, ArrowRight, Loader2, AlertCircle, KeyRound } from 'lucide-react';
import {
  generateSecret, verifyTOTP, buildOtpAuthUri,
  loadStoredSecret, saveStoredSecret, clearStoredSecret,
} from '../lib/totp';

interface Props {
  open: boolean;
  onClose: () => void;
  /** ユーザー識別子 (メアド等) — Authenticator に表示される */
  account: string;
}

type Phase = 'menu' | 'setup' | 'verify' | 'done' | 'remove-confirm';

export default function TotpSetup({ open, onClose, account }: Props) {
  const stored = loadStoredSecret();
  const [phase, setPhase] = useState<Phase>(stored ? 'menu' : 'setup');
  const [secret, setSecret] = useState<string>(stored || '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!stored) {
      // 新規 — シークレット即生成
      const s = generateSecret();
      setSecret(s);
      setPhase('setup');
      setErr(null);
      setCode('');
    } else {
      setPhase('menu');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const otpauth = useMemo(() => buildOtpAuthUri({ secret, account, issuer: 'CORE Prism' }), [secret, account]);
  // QR は Google Charts API (廃止予定だが代替なし → 自前で SVG にした方が良いが今回は外部依存)
  // 代替: api.qrserver.com を使用 (匿名 OK)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=2&data=${encodeURIComponent(otpauth)}`;

  const verify = async () => {
    setBusy(true);
    setErr(null);
    try {
      // ローカル先行検証
      const localOk = await verifyTOTP(secret, code);
      if (!localOk) {
        setErr('コードが正しくありません。もう一度試してください');
        setBusy(false);
        return;
      }
      // サーバー側でも再検証 (時刻ズレ + アンチタンパー)
      try {
        const res = await fetch('/api/auth/totp-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret, code }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || j?.valid !== true) {
          setErr('サーバー側で検証できませんでした。時計を確認してください');
          setBusy(false);
          return;
        }
      } catch {
        // サーバー不達でもローカル OK なら通す (オフライン デバッグ)
      }
      saveStoredSecret(secret);
      setPhase('done');
    } finally {
      setBusy(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard?.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const removeTotp = () => {
    clearStoredSecret();
    setSecret('');
    setPhase('setup');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 110,
            background: 'rgba(0,0,12,0.7)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px 12px',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(440px, 100%)',
              background: 'rgba(15,14,27,0.97)',
              border: '1px solid rgba(167,139,250,0.4)',
              borderRadius: 18,
              color: '#fff',
              overflow: 'hidden',
              boxShadow: 'var(--cp-elev-4)',
            }}
          >
            <div style={{
              padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 10,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              background: 'linear-gradient(180deg, rgba(167,139,250,0.12), transparent)',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'linear-gradient(135deg, #10B981, #06B6D4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><ShieldCheck size={16} color="#fff" /></div>
              <div style={{ flex: 1, fontWeight: 800, fontSize: '0.95rem' }}>2 段階認証 (TOTP)</div>
              <button onClick={onClose} aria-label="閉じる" style={{
                width: 30, height: 30, borderRadius: 15,
                background: 'rgba(255,255,255,0.08)', border: 'none',
                color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><X size={14} /></button>
            </div>

            <div style={{ padding: 18 }}>
              {phase === 'menu' && (
                <div>
                  <div style={{
                    padding: '12px 14px', borderRadius: 12,
                    background: 'rgba(52,211,153,0.1)',
                    border: '1px solid rgba(52,211,153,0.35)',
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 14,
                  }}>
                    <Check size={16} color="#34D399" />
                    <div style={{ fontSize: 13, fontWeight: 700 }}>2 段階認証は 設定済み です</div>
                  </div>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: 14 }}>
                    Authenticator アプリ (Google / Authy / 1Password 等) で 6 桁コードを生成し、
                    重要な操作の前に提示してください。
                  </p>
                  <button
                    onClick={() => setPhase('remove-confirm')}
                    style={{
                      width: '100%', padding: '10px 0', borderRadius: 12,
                      background: 'rgba(220,38,38,0.12)',
                      color: '#fca5a5', border: '1px solid rgba(220,38,38,0.3)',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    解除 / 再設定
                  </button>
                </div>
              )}

              {phase === 'remove-confirm' && (
                <div>
                  <div style={{
                    padding: '12px 14px', borderRadius: 12,
                    background: 'rgba(220,38,38,0.08)',
                    border: '1px solid rgba(220,38,38,0.25)',
                    fontSize: 12, color: '#fca5a5', lineHeight: 1.7,
                    marginBottom: 14,
                    display: 'flex', alignItems: 'flex-start', gap: 6,
                  }}>
                    <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                    解除すると、以降は 6 桁コードによる保護が無効になります。
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setPhase('menu')} style={{
                      flex: 1, padding: '10px 0', borderRadius: 12,
                      background: 'transparent',
                      color: 'rgba(255,255,255,0.7)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}>キャンセル</button>
                    <button onClick={removeTotp} style={{
                      flex: 1, padding: '10px 0', borderRadius: 12,
                      background: 'linear-gradient(135deg, #DC2626, #7F1D1D)',
                      color: '#fff', border: 'none',
                      fontSize: 12, fontWeight: 800, cursor: 'pointer',
                    }}>解除する</button>
                  </div>
                </div>
              )}

              {phase === 'setup' && (
                <div>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, marginBottom: 12 }}>
                    Authenticator アプリ で 下記の QR をスキャン してください。<br />
                    スキャンできない場合は シークレット文字列 を手動で入れてください。
                  </p>
                  <div style={{
                    background: '#fff',
                    borderRadius: 14,
                    padding: 14,
                    display: 'inline-flex',
                    margin: '0 auto 12px',
                    width: '100%', maxWidth: 280,
                    boxSizing: 'border-box',
                    justifyContent: 'center',
                  }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrUrl} alt="2FA セットアップ QR" width={240} height={240} style={{ display: 'block' }} />
                  </div>

                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 10px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    marginBottom: 12,
                  }}>
                    <KeyRound size={12} color="rgba(255,255,255,0.5)" />
                    <div style={{
                      flex: 1, fontFamily: 'Menlo, monospace', fontSize: 11.5,
                      color: '#fff', letterSpacing: '0.08em',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{secret}</div>
                    <button onClick={copySecret} aria-label="コピー" style={{
                      padding: '4px 10px', borderRadius: 8,
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff', cursor: 'pointer',
                      fontSize: 11, fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                    }}>{copied ? <><Check size={11} /> 済</> : <><Copy size={11} /> コピー</>}</button>
                  </div>

                  <button onClick={() => setPhase('verify')} style={{
                    width: '100%', padding: '11px 0', borderRadius: 12,
                    background: 'linear-gradient(135deg, #10B981, #06B6D4)',
                    color: '#fff', border: 'none',
                    fontSize: '0.92rem', fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    QR 読込んだ → コード入力へ <ArrowRight size={14} />
                  </button>
                </div>
              )}

              {phase === 'verify' && (
                <div>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, marginBottom: 12 }}>
                    Authenticator アプリに表示されている <strong>6 桁の番号</strong> を入れてください。
                  </p>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={(e) => { if (e.key === 'Enter') verify(); }}
                    placeholder="000 000"
                    inputMode="numeric"
                    autoFocus
                    disabled={busy}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff',
                      fontSize: 26,
                      fontFamily: 'Menlo, monospace',
                      letterSpacing: '0.4em',
                      textAlign: 'center',
                      outline: 'none',
                      marginBottom: 8,
                      boxSizing: 'border-box',
                    }}
                  />
                  {err && (
                    <div style={{ marginBottom: 10, fontSize: 11.5, color: '#fca5a5' }}>{err}</div>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setPhase('setup')} disabled={busy} style={{
                      flex: 1, padding: '10px 0', borderRadius: 12,
                      background: 'transparent',
                      color: 'rgba(255,255,255,0.7)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      fontSize: 12, fontWeight: 700,
                      cursor: busy ? 'wait' : 'pointer',
                    }}>← 戻る</button>
                    <button onClick={verify} disabled={busy || code.length !== 6} style={{
                      flex: 2, padding: '10px 0', borderRadius: 12,
                      background: busy || code.length !== 6
                        ? 'rgba(255,255,255,0.1)'
                        : 'linear-gradient(135deg, #10B981, #06B6D4)',
                      color: '#fff', border: 'none',
                      fontSize: '0.9rem', fontWeight: 800,
                      cursor: busy || code.length !== 6 ? 'not-allowed' : 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}>
                      {busy ? <Loader2 size={13} style={{ animation: 'core-spin 1s linear infinite' }} /> : null}
                      検証して有効化
                    </button>
                  </div>
                </div>
              )}

              {phase === 'done' && (
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <ShieldCheck size={48} color="#34D399" />
                  <h3 style={{ margin: '12px 0 6px', fontSize: '1.05rem', fontWeight: 800 }}>2 段階認証 設定完了</h3>
                  <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
                    シークレットが端末に保存されました。<br />
                    重要な操作の前に コードの提示を求められます。
                  </p>
                  <button onClick={onClose} style={{
                    marginTop: 14, padding: '10px 24px',
                    borderRadius: 999,
                    background: 'linear-gradient(135deg, #10B981, #06B6D4)',
                    color: '#fff', border: 'none',
                    fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  }}>閉じる</button>
                </div>
              )}
            </div>

            <style>{`@keyframes core-spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
