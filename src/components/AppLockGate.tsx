// ============================================================
// AppLockGate — Face ID / Touch ID のアプリロック (2026-07-26 オーナー指示)
//
// 有効にすると、アプリを開くたびに端末の生体認証(Face ID / Touch ID /
// Windows Hello)を通るまで画面全体を覆う。経営数字・顧客情報を
// 覗き見から守る「画面の鍵」。
//
// 正直な設計メモ:
//  - これは端末ローカルの画面ロック (サーバー認証ではない)。
//  - 生体認証が使えない端末では設定画面に出さない (偽の器を見せない)。
//  - 認証に失敗し続けても閉じ込めない — 「ロックを解除できないとき」から
//    ロック自体をオフにできる (端末の持ち主なら localStorage を消せる以上、
//    ここで頑固になっても security theater にしかならないため)。
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { ScanFace, Lock } from 'lucide-react';
import { isBiometricEnabled, authenticateBiometric, disableBiometric } from '../lib/biometricAuth';

const SESSION_KEY = 'core_applock_unlocked_v1';

/** このセッション(タブ)で解錠済みか */
function isUnlockedThisSession(): boolean {
  try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
}
function markUnlocked() {
  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* noop */ }
}

export default function AppLockGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState<boolean>(() => isBiometricEnabled() && !isUnlockedThisSession());
  const [trying, setTrying] = useState(false);
  const [failCount, setFailCount] = useState(0);

  const tryUnlock = useCallback(async () => {
    setTrying(true);
    try {
      const ok = await authenticateBiometric();
      if (ok) {
        markUnlocked();
        setLocked(false);
      } else {
        setFailCount((c) => c + 1);
      }
    } finally {
      setTrying(false);
    }
  }, []);

  // ロック中なら開いた瞬間に一度だけ自動で認証を出す
  useEffect(() => {
    if (locked) void tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!locked) return <>{children}</>;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 18, padding: 24,
        background: 'linear-gradient(160deg, #0B0B14 0%, #16162A 100%)',
      }}
    >
      <div style={{ width: 72, height: 72, borderRadius: 22, background: 'linear-gradient(135deg, #6366F1, #A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 16px 40px rgba(99,102,241,0.45)' }}>
        <Lock size={30} color="#fff" strokeWidth={2.1} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 17, fontWeight: 800, color: '#F3F4F6', margin: 0 }}>ロックされています</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', margin: '6px 0 0', lineHeight: 1.7 }}>
          経営データを守るため、本人確認をお願いします。
        </p>
      </div>
      <button
        onClick={() => void tryUnlock()}
        disabled={trying}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 10, minHeight: 50, padding: '0 26px',
          borderRadius: 999, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #6366F1, #A78BFA)', color: '#fff',
          fontSize: 15, fontWeight: 800, boxShadow: '0 10px 28px rgba(99,102,241,0.5)',
          opacity: trying ? 0.7 : 1,
        }}
      >
        <ScanFace size={19} strokeWidth={2.2} />
        {trying ? '確認中…' : 'Face ID / Touch ID で解除'}
      </button>
      {failCount >= 2 && (
        <button
          onClick={() => {
            if (window.confirm('この端末のアプリロックをオフにしますか？（設定からいつでも再開できます）')) {
              disableBiometric();
              markUnlocked();
              setLocked(false);
            }
          }}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline', minHeight: 44 }}
        >
          ロックを解除できないとき（ロックをオフにする）
        </button>
      )}
    </div>
  );
}
