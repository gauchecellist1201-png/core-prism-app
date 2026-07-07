// ============================================================
// TrialConversionNudge — 無料お試しの「残りわずか」に、たまった価値を見せて課金へ橋渡し
//
// 価値で価格を超える（オーナー方針 2026-06-13 / テーマ⑤ 転換・継続）:
//   7日無料の 3日目 / 前日に「あなたの成果」を見せて課金提案する。
//   ただし数字はすべて実データだけ（honest-numbers）。動いた記録が 0 のときは
//   課金を押しつけず「まず一手を作る」導線にする＝嘘の演出をしない。
//
// 表示条件:
//   - free プラン かつ trialEndsAt があり、残り 1〜3 日（＝3日目/前日/当日の帯）。
//   - その日ごとに 1 回だけ（×で閉じたら同じ日は出ない・翌日は再度出る）。
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { Clock, Sparkles, ArrowRight, X, TrendingUp } from 'lucide-react';
import { loadBillingUser } from '../lib/billing';
import { computeWeeklyValue } from '../lib/weeklyValue';

// 今日の日付キー（ローカル基準）。閉じた状態を「その日だけ」保持するのに使う。
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const dismissKey = () => `core:trial-nudge-dismissed:${todayKey()}`;

// free プランのトライアル残り日数（切り上げ）。対象外なら null。
function trialDaysLeft(): number | null {
  const u = loadBillingUser();
  if (!u || u.plan !== 'free' || !u.trialEndsAt) return null;
  const ms = new Date(u.trialEndsAt).getTime() - Date.now();
  if (ms <= 0) return null; // 期限切れは TrialExpiredLock の担当
  return Math.ceil(ms / 86_400_000);
}

export default function TrialConversionNudge({ onUpgrade, onRunLoop }: { onUpgrade: () => void; onRunLoop?: () => void }) {
  const [daysLeft, setDaysLeft] = useState<number | null>(() => trialDaysLeft());
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(dismissKey()) === '1'; } catch { return false; }
  });

  // たまった価値（実データのみ）。総件数と、いちばん多い1指標を「証拠」に使う。
  const value = useMemo(() => computeWeeklyValue(), [daysLeft]);
  const topMetric = useMemo(
    () => value.metrics.filter((m) => m.count > 0).sort((a, b) => b.count - a.count)[0] ?? null,
    [value],
  );

  // 課金や連携で状態が変わったら残り日数を取り直す（帯の外に出たら消える）。
  useEffect(() => {
    const refresh = () => setDaysLeft(trialDaysLeft());
    window.addEventListener('focus', refresh);
    window.addEventListener('core:value-updated', refresh as EventListener);
    const t = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('core:value-updated', refresh as EventListener);
      window.clearInterval(t);
    };
  }, []);

  // 表示帯: 残り 1〜3 日だけ（3日目/前日/当日）。それ以外・閉じた日は出さない。
  if (dismissed || daysLeft === null || daysLeft > 3) return null;

  const total = value.total;
  const hasValue = total > 0;

  const close = () => {
    try { localStorage.setItem(dismissKey(), '1'); } catch { /* noop */ }
    setDismissed(true);
  };

  return (
    <div style={{
      position: 'relative', padding: '15px 15px 16px', borderRadius: 16, marginBottom: 14,
      background: 'linear-gradient(135deg, rgba(142,92,255,0.16), rgba(46,111,255,0.06))',
      border: '1px solid rgba(142,92,255,0.38)', color: 'var(--fg)',
    }}>
      {/* 閉じる（その日だけ・翌日また出す）— 44px タップ確保 */}
      <button onClick={close} aria-label="閉じる" style={{
        position: 'absolute', top: 6, right: 6, width: 34, height: 34, borderRadius: 9,
        border: 'none', background: 'transparent', color: 'var(--fg-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      }}><X size={16} /></button>

      {/* 残り日数バッジ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingRight: 30 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 11, fontWeight: 900, padding: '3px 10px', borderRadius: 999,
          background: daysLeft <= 1 ? 'rgba(255,107,107,0.16)' : 'rgba(142,92,255,0.16)',
          color: daysLeft <= 1 ? '#FF6B6B' : '#8E5CFF',
          border: `1px solid ${daysLeft <= 1 ? 'rgba(255,107,107,0.4)' : 'rgba(142,92,255,0.4)'}`,
        }}>
          <Clock size={12} strokeWidth={2.4} />
          無料お試しはあと {daysLeft} 日
        </span>
      </div>

      {hasValue ? (
        <>
          {/* 実データの「動いた量」を証拠に、続ける（=課金）へ橋渡し */}
          <h3 style={{ fontSize: 15, fontWeight: 900, color: 'var(--fg-strong)', margin: '0 0 6px', lineHeight: 1.45, letterSpacing: '-0.01em' }}>
            このお試し中に、AI役員があなたのために{' '}
            <span style={{ color: '#8E5CFF' }}>{total.toLocaleString('ja-JP')} 件</span>{' '}
            動きました
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--fg-muted)', margin: '0 0 12px', lineHeight: 1.6 }}>
            {topMetric
              ? <>いちばん多いのは「{topMetric.label}」で {topMetric.count.toLocaleString('ja-JP')} 件。</>
              : null}
            このまま続けると、この成果が毎日たまり続けます。
          </p>

          <button onClick={onUpgrade} style={primaryBtn}>
            このまま続ける（プランを見る）
            <ArrowRight size={16} strokeWidth={2.6} />
          </button>
        </>
      ) : (
        <>
          {/* 動いた記録が 0 — 課金を押しつけず、まず一手を作る導線（honest） */}
          <h3 style={{ fontSize: 15, fontWeight: 900, color: 'var(--fg-strong)', margin: '0 0 6px', lineHeight: 1.45, letterSpacing: '-0.01em' }}>
            残りのお試しで、AIの実力をまず体感してみませんか
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--fg-muted)', margin: '0 0 12px', lineHeight: 1.6 }}>
            まだAI役員が動いた記録がありません。ループを回すか、メールやドキュメントを取り込むと、あなたのための成果がここにたまっていきます。
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {onRunLoop && (
              <button onClick={onRunLoop} style={primaryBtn}>
                <Sparkles size={15} strokeWidth={2.4} />
                まず最初の一手を作る
              </button>
            )}
            <button onClick={onUpgrade} style={ghostBtn}>
              <TrendingUp size={15} strokeWidth={2.4} />
              プランを見る
            </button>
          </div>
        </>
      )}

      <p style={{ fontSize: 10, color: 'var(--fg-subtle)', margin: '11px 2px 0', lineHeight: 1.5 }}>
        ※ 件数はこのアプリ内での実際の活動だけです。推定や水増しはしていません。
      </p>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
  padding: '11px 18px', minHeight: 46, borderRadius: 11, border: 'none',
  background: 'linear-gradient(135deg,#8E5CFF,#2E6FFF)', color: '#fff',
  fontSize: 13.5, fontWeight: 800, cursor: 'pointer', width: '100%',
  boxShadow: '0 4px 16px rgba(142,92,255,0.42)',
};

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
  padding: '11px 16px', minHeight: 46, borderRadius: 11,
  border: '1px solid rgba(142,92,255,0.4)', background: 'var(--surface-3)',
  color: 'var(--fg-strong)', fontSize: 13, fontWeight: 800, cursor: 'pointer', flex: 1,
};
