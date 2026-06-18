// ============================================================
// TrialExpiredLock — 無料体験(7日)が終了したユーザーを画面ロックして
// 課金へ自然に誘導する全画面ペイウォール。
//
// オーナー方針 (2026-06-16):
//   最初はカード登録なしで7日無料 → 期限が来たら「これまで使えた画面」が
//   ロックされ、続けるにはプラン選択（課金）へ。使えなくなった瞬間に
//   自然と課金する流れを作る。
//
// ・データ/設定は消さない（残っている旨を明記して不安を消す）
// ・有料プランだけ提示（無料トライアルの再取得はさせない）
// ・選ぶと CheckoutModal(=Stripe, カード登録) が開く
// ============================================================
import { getPlans, getPlanPrice, type Plan, type Brand } from '../lib/billing';
import { computeWeeklyValue } from '../lib/weeklyValue';

interface Props {
  brand: Brand;
  /** アクセント色（prism=紫 / iris=ピンク）。 */
  accent: string;
  /** プラン選択時 — 親が CheckoutModal を開く。 */
  onChoose: (plan: Plan) => void;
  /** 別アカウントでログインし直す（任意）。 */
  onSignout?: () => void;
}

export default function TrialExpiredLock({ brand, accent, onChoose, onSignout }: Props) {
  // 有料プランのみ（free を除外）。多すぎないよう上位3つに絞る。
  const paid = getPlans(brand).filter((p) => p.id !== 'free' && p.priceJpy > 0).slice(0, 3);
  const recommendIdx = paid.length >= 2 ? 1 : 0; // 真ん中を推奨表示

  // 課金前の「動いた量」= 体験中(直近7日)に AI が実際にあなたのために動いた件数。
  // honest-numbers: 実活動の件数だけ。0 件なら何も出さない（捏造しない）。
  const { metrics, total } = computeWeeklyValue();
  // 件数の多い順に上位3つだけ要約表示（ペイウォールは縦スクロールを短く保つ）
  const topMetrics = [...metrics].sort((a, b) => b.count - a.count).slice(0, 3);

  return (
    <div
      style={{
        // アプリ全UIより上、ただし課金モーダル(CheckoutModal=100)より下
        position: 'fixed', inset: 0, zIndex: 90,
        background: 'rgba(8,7,16,0.86)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflowY: 'auto',
        padding: 'max(24px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom))',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="無料体験が終了しました"
    >
      <div style={{ width: '100%', maxWidth: 460, margin: 'auto 0' }}>
        {/* 鍵アイコン */}
        <div style={{
          width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px',
          background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 26px ${accent}88`,
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 900, color: '#fff', textAlign: 'center', margin: '0 0 8px', lineHeight: 1.3 }}>
          無料体験が終了しました
        </h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.78)', textAlign: 'center', margin: '0 0 4px', lineHeight: 1.7 }}>
          7 日間お試しいただき、ありがとうございます。
        </p>
        <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.62)', textAlign: 'center', margin: '0 0 20px', lineHeight: 1.7 }}>
          これまで使っていた機能は、プランを選ぶと<strong style={{ color: '#fff' }}>そのまま続き</strong>から使えます。
          あなたのデータと設定は消えていません。
        </p>

        {/* 課金前の価値証明 — 体験中に AI が実際に動いた量（あれば） */}
        {total > 0 && (
          <div style={{
            padding: '13px 14px', borderRadius: 14, margin: '0 0 16px',
            background: `${accent}14`, border: `1px solid ${accent}59`,
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', margin: '0 0 2px' }}>
              この 7 日間で、AI役員があなたのために動きました
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '4px 0 10px' }}>
              <span style={{ fontSize: 30, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.02em' }}>
                {total.toLocaleString('ja-JP')}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>件 の仕事</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {topMetrics.map((m) => (
                <span key={m.key} style={{
                  fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.88)',
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)',
                  padding: '4px 9px', borderRadius: 999,
                }}>
                  {m.label} <strong style={{ color: '#fff' }}>{m.count.toLocaleString('ja-JP')}</strong>
                </span>
              ))}
            </div>
            <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', margin: '9px 0 0', lineHeight: 1.5 }}>
              続けると、この積み上げはそのまま引き継がれます。数字はアプリ内の実際の活動だけです。
            </p>
          </div>
        )}

        {/* 有料プラン */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {paid.map((p, i) => {
            const rec = i === recommendIdx;
            const price = getPlanPrice(p, 'monthly');
            return (
              <button
                key={p.id}
                onClick={() => onChoose(p)}
                style={{
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: 14,
                  border: rec ? `2px solid ${accent}` : '1px solid rgba(255,255,255,0.16)',
                  background: rec ? `${accent}1f` : 'rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  minHeight: 44,
                  position: 'relative',
                }}
              >
                {rec && (
                  <span style={{
                    position: 'absolute', top: -9, left: 16,
                    fontSize: 10.5, fontWeight: 800, color: '#fff', background: accent,
                    padding: '2px 8px', borderRadius: 999,
                  }}>おすすめ</span>
                )}
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{p.name}</span>
                  <span style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>
                    ¥{price.toLocaleString()}<span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}> /月</span>
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{p.tagline}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)' }}>
                    {p.features[0]}
                  </span>
                  <span style={{
                    fontSize: 12, fontWeight: 800, color: rec ? '#fff' : accent,
                    background: rec ? accent : 'transparent',
                    border: rec ? 'none' : `1px solid ${accent}`,
                    padding: '6px 14px', borderRadius: 999,
                  }}>
                    このプランで続ける →
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center', margin: '16px 0 0', lineHeight: 1.6 }}>
          いつでも解約できます。お支払いは選んだプランの初回からです。
        </p>

        {onSignout && (
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <button
              onClick={onSignout}
              style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 8, minHeight: 40 }}
            >
              別のアカウントでログイン
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
