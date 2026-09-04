// ============================================================
// Referral Receipt Banner — 「招待の +N 日、本当に付きました」を伝える一枚
//
// なぜこれが要るか:
//   招待リンクから来た人は、LP と決済画面で「合計 10 日無料」と 2 回約束される。
//   ところが登録が終わったあと、その約束がどうなったかを言う画面が無かった。
//    - うまくいっても「付きました」と誰も言わない (信じるしかない)
//    - 断られた時 (使用済みなど) は、黙って通常の 3 日に戻っていた
//   約束した側が結果を黙るのが一番よくないので、成功でも失敗でも 1 回だけ、
//   実際の無料期間の終了日つきで伝える。読んだ控えは消して、二度は出さない。
// ============================================================
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Gift, Info, X } from 'lucide-react';
import {
  peekReferralReceipt, clearReferralReceipt, type ReferralReceipt,
  TRIAL_BASE_DAYS,
} from '../lib/referral';
import { loadBillingUser, isTrialActive } from '../lib/billing';

/** 無料期間の終了日を「9月11日 (木)」の形で返す。分からなければ空文字。 */
function trialEndLabel(): string {
  try {
    const u = loadBillingUser();
    if (!u || !u.trialEndsAt || !isTrialActive(u)) return '';
    const d = new Date(u.trialEndsAt);
    if (Number.isNaN(d.getTime())) return '';
    const week = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    return `${d.getMonth() + 1}月${d.getDate()}日 (${week})`;
  } catch { return ''; }
}

interface Props {
  /** ブランドのアクセント色 (成功時の帯に使う) */
  accent: string;
  /** タップしたときに開きたい招待カード (任意) */
  onOpenInvite?: () => void;
}

export default function ReferralReceiptBanner({ accent, onOpenInvite }: Props) {
  // 控えの読み出しは副作用ではないので、描画前の初期値として取る。
  // (effect の中で setState すると連鎖描画になり lint が止める)
  const [receipt, setReceipt] = useState<ReferralReceipt | null>(() => peekReferralReceipt());
  const [endLabel] = useState<string>(() => trialEndLabel());

  useEffect(() => {
    // 見せた時点で控えを消す。次に開いた時に同じ話をもう一度されると鬱陶しい。
    if (receipt) clearReferralReceipt();
    // 初回マウント時に 1 度だけ。receipt を依存に入れると閉じた時にも走る。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => setReceipt(null);

  // ★早期 return しない。AnimatePresence の外で null を返すと
  //   閉じるアニメーションが一度も再生されず、帯がぱっと消える。
  const ok = !!receipt && receipt.ok && receipt.bonusDays > 0;
  const title = ok
    ? (receipt!.inviter
        ? `${receipt!.inviter} さんの招待で +${receipt!.bonusDays} 日`
        : `友達招待ボーナス +${receipt!.bonusDays} 日`)
    : '招待コードは使えませんでした';
  const detail = ok
    ? (endLabel
        ? `無料期間は ${endLabel} までです`
        : `無料期間が ${receipt!.bonusDays} 日のびました`)
    // ★ここで嘘をつかない。もらえなかった事実と、実際に使える日数を言う。
    : `${receipt?.message || 'この招待は適用できませんでした'}。通常の ${TRIAL_BASE_DAYS} 日間でご利用いただけます`;

  return (
    <AnimatePresence>
      {receipt && (
      <motion.div
        key="referral-receipt"
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        role="status"
        style={{
          position: 'fixed', zIndex: 121,
          left: '50%', transform: 'translateX(-50%)',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
          width: 'min(92vw, 400px)',
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '0.9rem 1rem', borderRadius: 16,
          background: ok
            ? `linear-gradient(135deg, ${accent}, ${accent}cc)`
            : 'linear-gradient(135deg, #3A3348, #2A2436)',
          color: '#fff',
          border: ok ? 'none' : '1px solid rgba(255,255,255,0.14)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
          textAlign: 'left',
        }}
      >
        <span style={{
          width: 36, height: 36, borderRadius: 12, flexShrink: 0,
          background: 'rgba(255,255,255,0.18)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {ok ? <Gift size={18} strokeWidth={2.4} /> : <Info size={18} strokeWidth={2.4} />}
        </span>

        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontSize: '0.92rem', fontWeight: 800, lineHeight: 1.3 }}>
            {title}
          </span>
          <span style={{ display: 'block', fontSize: '0.76rem', opacity: 0.94, marginTop: 3, lineHeight: 1.5 }}>
            {detail}
          </span>
          {ok && onOpenInvite && (
            <button
              onClick={() => { dismiss(); onOpenInvite(); }}
              style={{
                marginTop: 8, background: 'rgba(255,255,255,0.16)',
                border: '1px solid rgba(255,255,255,0.26)', color: '#fff',
                borderRadius: 10, padding: '0.4rem 0.7rem',
                fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer',
              }}>
              あなたも友達を招待して、もっとのばす
            </button>
          )}
        </span>

        <button
          onClick={dismiss}
          aria-label="閉じる"
          style={{
            background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.75)',
            cursor: 'pointer', padding: 4, lineHeight: 0, flexShrink: 0,
          }}>
          <X size={16} strokeWidth={2.4} />
        </button>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
