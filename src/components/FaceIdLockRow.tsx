// ============================================================
// FaceIdLockRow — サイドバー用「Face ID ロック」トグル行 (2026-07-26)
// 生体認証が使えない端末では出さない（押しても動かないボタンを見せない）。
// ============================================================
import { useEffect, useState } from 'react';
import { ScanFace } from 'lucide-react';
import {
  isBiometricAvailable, isBiometricEnabled, registerBiometric, disableBiometric,
} from '../lib/biometricAuth';

export default function FaceIdLockRow() {
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void isBiometricAvailable().then((ok) => {
      setAvailable(ok);
      if (ok) setEnabled(isBiometricEnabled());
    });
  }, []);

  if (!available) return null;

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (enabled) {
        disableBiometric();
        setEnabled(false);
      } else {
        const email = localStorage.getItem('core_trial_email') || 'owner@core.local';
        const ok = await registerBiometric({ email, displayName: 'CORE Prism' });
        if (ok) {
          setEnabled(true);
        } else {
          window.alert('Face ID / Touch ID の登録がキャンセルまたは失敗しました。もう一度お試しください。');
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={() => void toggle()}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-surface-3 group transition-colors"
      title="アプリを開くとき Face ID / Touch ID で本人確認します"
      aria-pressed={enabled}
    >
      <ScanFace size={14} className="text-fg-muted group-hover:text-fg" />
      <span className="text-fg-muted group-hover:text-fg text-sm flex-1">Face ID ロック</span>
      <span
        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
        style={enabled
          ? { background: 'rgba(52,211,153,0.15)', color: '#34D399' }
          : { background: 'rgba(255,255,255,0.06)', color: 'var(--fg-muted)' }}
      >
        {busy ? '…' : enabled ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}
