// ============================================================
// 設定タブ — 設立希望日 / 書類作成開始日の手動調整 / クラウド同期 (PC・iPhone)。
// ============================================================
import { useState } from 'react';
import { Cloud, CloudOff } from 'lucide-react';
import type { UseCompanySetupReturn } from '../useCompanySetup';
import { Card, WarningBanner } from '../ui';
import { COLORS, FONT } from '../tokens';

const inputStyle = {
  width: '100%', minHeight: 40, borderRadius: 10, padding: '8px 10px',
  background: 'rgba(255,255,255,0.05)', border: `1px solid ${COLORS.line}`,
  color: COLORS.text, fontSize: 14, fontFamily: FONT, boxSizing: 'border-box' as const,
};
const labelStyle = { fontSize: 11.5, fontWeight: 700, color: COLORS.mut, marginBottom: 5, display: 'block' as const };

export default function SettingsTab({ cs }: { cs: UseCompanySetupReturn }) {
  const { settings, foundingWarnings, docPrepEstimate } = cs;
  const [email, setEmail] = useState('');
  const [signInMsg, setSignInMsg] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    if (!email) return;
    setSigningIn(true);
    setSignInMsg(null);
    try {
      const res = await cs.cloud.signIn(email);
      setSignInMsg(res.message);
    } catch (e) {
      setSignInMsg(`送信に失敗しました: ${String((e as Error)?.message ?? e)}`);
    } finally {
      setSigningIn(false);
      cs.cloud.refresh();
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16, fontFamily: FONT }}>
      <Card style={{ display: 'grid', gap: 10 }}>
        <label style={labelStyle}>希望設立日</label>
        <input
          type="date" style={inputStyle}
          value={settings.foundingDateTarget ?? ''}
          onChange={(e) => cs.updateSettings({ foundingDateTarget: e.target.value || null })}
        />
        {foundingWarnings.map((w) => <WarningBanner key={w} text={w} />)}
      </Card>

      <Card style={{ display: 'grid', gap: 10 }}>
        <label style={labelStyle}>書類作成開始日 (手動調整・任意)</label>
        <input
          type="date" style={inputStyle}
          value={settings.docPrepStartDateOverride ?? ''}
          onChange={(e) => cs.updateSettings({ docPrepStartDateOverride: e.target.value || null })}
        />
        <div style={{ fontSize: 12, color: COLORS.mut, lineHeight: 1.6 }}>
          未入力の場合は「井坂事務所 書類作成中」が解放された日を自動で使う。3営業日後を発送予定として計算する。
          {docPrepEstimate.startDate && <><br />現在の起点: {docPrepEstimate.startDate} → {docPrepEstimate.label}</>}
        </div>
        {settings.docPrepStartDateOverride && (
          <button
            onClick={() => cs.updateSettings({ docPrepStartDateOverride: null })}
            style={{ justifySelf: 'start', fontSize: 12, color: COLORS.mut, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
          >
            自動計算に戻す
          </button>
        )}
      </Card>

      <Card style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {cs.cloud.configured ? <Cloud size={16} color={COLORS.teal} /> : <CloudOff size={16} color={COLORS.mut} />}
          <span style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.text }}>PC・iPhone 同期</span>
        </div>
        {!cs.cloud.configured ? (
          <div style={{ fontSize: 12.5, color: COLORS.mut, lineHeight: 1.6 }}>
            この環境ではクラウド同期が未設定です。端末ごとに localStorage へ保存されます。
          </div>
        ) : cs.cloud.status?.state === 'ready' ? (
          <div style={{ fontSize: 12.5, color: COLORS.teal, lineHeight: 1.6 }}>
            サインイン済み。この端末とほかの端末で同じデータが表示されます。
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: COLORS.mut, lineHeight: 1.6 }}>
              メールでサインインすると、同じアカウントでログインした端末どうしで内容が同期されます。
            </div>
            <input
              type="email" style={inputStyle} placeholder="メールアドレス"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
            <button
              onClick={handleSignIn}
              disabled={!email || signingIn}
              style={{
                minHeight: 40, borderRadius: 10, border: 'none',
                background: !email || signingIn ? 'rgba(255,255,255,0.08)' : COLORS.gold,
                color: !email || signingIn ? COLORS.mut : '#1A1300',
                fontWeight: 700, fontSize: 13.5, cursor: !email || signingIn ? 'not-allowed' : 'pointer',
              }}
            >{signingIn ? '送信中…' : 'サインインリンクを送る'}</button>
            {signInMsg && <div style={{ fontSize: 12, color: COLORS.mut }}>{signInMsg}</div>}
          </>
        )}
      </Card>
    </div>
  );
}
