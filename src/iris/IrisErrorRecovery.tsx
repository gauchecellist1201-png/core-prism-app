// ============================================================
// IRIS — 失敗したときの復旧パネル (共有部品)
//
// なぜ切り出したか (2026-08-17):
//   「もう一度ためす / 別の画像で / 手で入力」の復旧パネルは
//   IrisStrategyHome の中にだけ書かれていて、スクショ取り込みの
//   1 か所でしか使われていなかった。
//   同じ画面の他の AI 機能 (AI で読み解く・戦略スタジオの 4 機能) は
//   赤い文字が 1 行出るだけで、やり直す手段がどこにも無かった。
//   = 一度失敗した人は、そこで行き止まりになる。
//
// この部品が必ず守ること:
//   ・失敗したら必ず「次の一手」を出す (もう一度ためす／別のやり方)
//   ・押せる大きさは 44px 以上 (iPhone で指が届く)
//   ・画面の外で失敗したことになっていない = 出たら自分から視界に入る
//   ・読み上げにも届く (role="alert")
// ============================================================
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RefreshCw, Check, X } from 'lucide-react';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS, accentFaceBg, accentFaceInk } from './irisStyle';
import { DUR_BASE, EASE_OUT } from './motion';

/** 「もう一度」以外の逃げ道 (別の画像で／手で入力する など) */
export interface RecoveryAction {
  key: string;
  icon?: ReactNode;
  label: string;
  onClick: () => void;
}

/** 押せる面は必ず 44px 以上。ここを 1 か所にして書き手の付け忘れを無くす */
const TAP: React.CSSProperties = {
  minHeight: 44,
  padding: '0.55rem 1.05rem',
  borderRadius: 999,
  fontWeight: 700,
  fontSize: '0.82rem',
  fontFamily: IRIS_FONTS.body,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.4rem',
  cursor: 'pointer',
};

export default function IrisErrorRecovery({
  bg,
  message,
  onRetry,
  retryLabel = 'もう一度ためす',
  actions = [],
  marginTop = '0.9rem',
}: {
  bg: IrisBackgroundDef;
  /** 人に見せる一文。番号や英語の原文は入れない */
  message: string;
  /** やり直せるときだけ渡す。渡さないと「もう一度」は出ない (押しても無駄なボタンを出さない) */
  onRetry?: () => void | Promise<void>;
  retryLabel?: string;
  actions?: RecoveryAction[];
  marginTop?: string | number;
}) {
  type Phase = 'idle' | 'pending' | 'success';
  const [phase, setPhase] = useState<Phase>('idle');
  const mounted = useRef(true);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => { mounted.current = false; }, []);

  // 押したボタンが画面の下、赤い文字が画面のいちばん上 —— という並びだと、
  // スマホでは「押したのに何も起きなかった」ようにしか見えない。
  // 見えていない時だけ自分から視界に入る (既に見えているなら動かさない)。
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const visible = r.top >= 0 && r.bottom <= (window.innerHeight || 0);
    if (!visible) {
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch { /* 古い端末 */ }
    }
  }, []);

  const handleRetry = async () => {
    if (!onRetry || phase !== 'idle') return;
    setPhase('pending');
    try { await Promise.resolve(onRetry()); } catch { /* 失敗は親が新しい message を渡してくる */ }
    if (!mounted.current) return;
    setPhase('success');
    setTimeout(() => { if (mounted.current) setPhase('idle'); }, 1000);
  };

  return (
    <div
      ref={boxRef}
      role="alert"
      aria-live="assertive"
      style={{
        marginTop,
        padding: '0.9rem 1rem',
        background: 'rgba(200,16,46,0.06)',
        border: '1px solid rgba(200,16,46,0.18)',
        borderRadius: 14,
        display: 'grid', gap: '0.6rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
        <X size={16} style={{ color: '#C8102E', marginTop: 2, flexShrink: 0 }} />
        <p style={{ color: '#9B1024', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
          {message}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {onRetry && (
          <button
            onClick={handleRetry}
            disabled={phase === 'pending'}
            className={phase === 'success' ? 'cp-phase-success' : undefined}
            style={{
              ...TAP,
              minWidth: 144,
              background: phase === 'success'
                ? 'linear-gradient(135deg, #34D399, #34D399cc)'
                : accentFaceBg(bg.accent),
              color: accentFaceInk(bg.accent),
              border: 'none',
              cursor: phase === 'pending' ? 'progress' : 'pointer',
              boxShadow: phase === 'success'
                ? '0 6px 16px rgba(52, 211, 153, 0.55)'
                : `0 6px 16px ${bg.accent}55`,
              opacity: phase === 'pending' ? 0.88 : 1,
              transition: `background ${DUR_BASE}s ${EASE_OUT}, box-shadow ${DUR_BASE}s ${EASE_OUT}, opacity ${DUR_BASE}s ${EASE_OUT}`,
            }}
          >
            {phase === 'pending' ? (
              <><RefreshCw size={14} className="cp-phase-spin" /> 再試行中…</>
            ) : phase === 'success' ? (
              <><Check size={15} strokeWidth={2.8} /> 届きました</>
            ) : (
              <><RefreshCw size={14} /> {retryLabel}</>
            )}
          </button>
        )}

        {actions.map(a => (
          <button
            key={a.key}
            onClick={a.onClick}
            style={{
              ...TAP,
              background: 'rgba(255,255,255,0.9)',
              color: bg.ink,
              border: `1px solid ${bg.cardBorder}`,
            }}
          >
            {a.icon} {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
