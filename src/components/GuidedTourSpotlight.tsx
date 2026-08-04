// ============================================================
// GuidedTourSpotlight — 「ここをタップ」で使い方を案内するガイド
//
// オーナー指示 (2026-06-05):
//   「『ここをタップ』を次々表示して機能の使い方を自然に教える体験。
//    ただし自動で始まるのはうざい → 呼ばれた時だけ出す。」
//
// 動き:
//   1. ステップごとに target 要素を querySelector で探す
//   2. その要素の周りに「穴」を開けて暗背景で周りを隠す (SVG mask)
//   3. 要素をパルスで強調 +「ここをタップ」バッジ
//   4. 近くに説明を出す (位置は実寸を測って計算)
//   5. target を触る or「次へ」で次のステップ
//   6.「やめる」で終了 (確認を1回はさむ)
//
// 設計 (2026-08-04 磨き直し):
//   - 退場アニメを使わない (AnimatePresence mode="wait" は退場完了を待つため、
//     rAF が止まる環境で中身が前のステップのまま固まり、
//     進捗バーと番号だけが進む「嘘の進行」になる。同じ罠がこのリポで4回目)
//   - 説明パネルの高さは ResizeObserver で実測する
//     (旧: TIP_H = 200 の決め打ち → 375px で画面外にはみ出す/ハイライトを覆う)
//   - 暗い背景をタップしても勝手に終わらない (誤タップで案内が消える事故を止める)
//   - 探索中に黙って3秒待たない (1秒で「とばす」を出す)
//   - タップ対象はすべて 44px 以上
// ============================================================
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Hand, Info, ChevronLeft, ChevronRight, Check, SkipForward } from 'lucide-react';
import { markTourDone } from '../lib/freshUserDemo';

export interface TourStep {
  id: string;
  title: string;
  body: string;
  /** CSS セレクタ (data-tour-id="xxx" を推奨) — 省略時は画面中央で普通のカード */
  target?: string;
  /** 説明パネルの配置 — auto は自動計算 */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  /** ステップ開始時にやること (タブ切替 / モーダルを開く 等) */
  preAction?: () => void | Promise<void>;
  /** 「ここをタップ」ラベルを変える */
  tapLabel?: string;
  /** ターゲット周りの余白 (px) — 既定 8 */
  spotlightPad?: number;
  /** target が出てくるまでの最大待機 (ms) — 既定 3000 */
  waitMs?: number;
}

interface Props {
  steps: TourStep[];
  brand: 'prism' | 'iris';
  onClose: () => void;
  onComplete: () => void;
}

type Phase = 'searching' | 'ready' | 'fallback';

/** 探索がこの時間を超えたら「とばす」を出す (黙って待たせない) */
const SLOW_SEARCH_MS = 1000;
/** 説明パネルの高さの初期値。すぐ実測値に置き換わる */
const TIP_H_FALLBACK = 200;

export default function GuidedTourSpotlight({ steps, brand, onClose, onComplete }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('searching');
  const [slowSearch, setSlowSearch] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [tipH, setTipH] = useState(TIP_H_FALLBACK);
  const targetRef = useRef<HTMLElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const step = steps[stepIdx];
  const isLast = stepIdx >= steps.length - 1;

  const accent = brand === 'iris' ? '#F472B6' : '#A78BFA';

  // ── ステップ切替時に target を探す ─────────────────────
  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    setPhase('searching');
    setSlowSearch(false);
    setConfirmExit(false);
    setRect(null);
    targetRef.current = null;

    // 1秒たっても見つからなければ「とばす」を出す (沈黙させない)
    const slowTimer = window.setTimeout(() => { if (!cancelled) setSlowSearch(true); }, SLOW_SEARCH_MS);

    const doSearch = async () => {
      // preAction を走らせる (タブ切替 / モーダルを開く 等)
      try { await step.preAction?.(); } catch { /* */ }
      if (cancelled) return;

      if (!step.target) {
        // 中央カードモード
        setPhase('fallback');
        return;
      }
      const start = Date.now();
      const maxWait = step.waitMs ?? 3000;
      while (!cancelled) {
        const el = document.querySelector(step.target) as HTMLElement | null;
        if (el && el.offsetParent !== null) {
          // 要素が見つかって表示中
          targetRef.current = el;
          // スクロールして画面内に
          try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch { /* */ }
          await new Promise((r) => setTimeout(r, 350));
          if (cancelled) return;
          setRect(el.getBoundingClientRect());
          setPhase('ready');
          return;
        }
        if (Date.now() - start > maxWait) {
          // 見つからない → 中央カードで説明だけ
          setPhase('fallback');
          return;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
    };
    doSearch();
    return () => { cancelled = true; window.clearTimeout(slowTimer); };
  }, [stepIdx, step]);

  // ── 画面サイズの追従 (どのフェーズでも。回転で位置が壊れないように) ──
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  // ── ターゲットの位置を追従 (スクロール / 動的 UI) ────────
  useEffect(() => {
    if (phase !== 'ready' || !targetRef.current) return;
    const update = () => {
      if (!targetRef.current) return;
      setRect(targetRef.current.getBoundingClientRect());
    };
    window.addEventListener('scroll', update, true);
    const t = window.setInterval(update, 250); // 動的 UI 用のポーリング
    return () => {
      window.removeEventListener('scroll', update, true);
      window.clearInterval(t);
    };
  }, [phase]);

  // ── 説明パネルの高さを実測する ────────────────────────
  //    決め打ち (200px) だと、文が長いステップで画面の外にはみ出したり
  //    ハイライトそのものを覆い隠したりする。実測なら必ず画面内に収まる。
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el) return;
    const measure = () => setTipH(el.getBoundingClientRect().height || TIP_H_FALLBACK);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stepIdx, phase, confirmExit, slowSearch, viewport.w]);

  // ── ユーザーが target をタップしたら次へ進む ───────────
  useEffect(() => {
    if (phase !== 'ready' || !targetRef.current) return;
    const el = targetRef.current;
    const handler = () => {
      // 少し遅らせて次のステップへ (タップ本来の動作を邪魔しない)
      window.setTimeout(() => advance(), 400);
    };
    el.addEventListener('click', handler, { once: true });
    return () => el.removeEventListener('click', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stepIdx]);

  const advance = () => {
    if (isLast) {
      markTourDone();
      onComplete();
    } else {
      setStepIdx((i) => i + 1);
    }
  };

  const stopTour = () => {
    markTourDone();
    onClose();
  };

  // ── 説明パネルの位置計算 (実測した高さを使う) ───────────
  const tooltipPos = useMemo(() => {
    const TIP_W = Math.min(320, viewport.w - 24);
    const H = Math.min(tipH, viewport.h - 24);
    if (phase !== 'ready' || !rect) {
      return { left: Math.max(12, viewport.w / 2 - TIP_W / 2), top: Math.max(12, viewport.h / 2 - H / 2), w: TIP_W };
    }
    const placement = step.placement || 'auto';
    const pad = 16;
    // 自動: 下 → 上 → 右 → 左 の優先
    const fitsDown = rect.bottom + H + pad < viewport.h;
    const fitsUp = rect.top - H - pad > 0;
    const fitsRight = rect.right + TIP_W + pad < viewport.w;
    const fitsLeft = rect.left - TIP_W - pad > 0;
    let pos: 'top' | 'bottom' | 'left' | 'right';
    if (placement === 'auto') {
      pos = fitsDown ? 'bottom' : fitsUp ? 'top' : fitsRight ? 'right' : fitsLeft ? 'left' : 'bottom';
    } else {
      // 指定された向きに入らないときは自動に落とす (画面外に出すより優先)
      const fitsSpecified =
        placement === 'bottom' ? fitsDown : placement === 'top' ? fitsUp : placement === 'right' ? fitsRight : fitsLeft;
      pos = fitsSpecified ? placement : fitsDown ? 'bottom' : fitsUp ? 'top' : fitsRight ? 'right' : fitsLeft ? 'left' : 'bottom';
    }
    let left = rect.left + rect.width / 2 - TIP_W / 2;
    let top = rect.bottom + pad;
    if (pos === 'top') { top = rect.top - H - pad; }
    if (pos === 'right') { left = rect.right + pad; top = rect.top + rect.height / 2 - H / 2; }
    if (pos === 'left') { left = rect.left - TIP_W - pad; top = rect.top + rect.height / 2 - H / 2; }
    left = Math.max(12, Math.min(viewport.w - TIP_W - 12, left));
    // 進捗バー (上端 56px 前後) の下に来るようにする
    top = Math.max(64, Math.min(viewport.h - H - 12, top));
    return { left, top, w: TIP_W };
  }, [phase, rect, viewport, tipH, step?.placement]);

  if (!step) return null;
  const pad = step.spotlightPad ?? 8;
  // 「ここをタップ」バッジが画面の外に出ないように左右を止める
  const badgeLeft = Math.max(12, Math.min(viewport.w - 140, (rect?.left ?? 0) + (rect?.width ?? 0) / 2 - 60));

  const btnBase: React.CSSProperties = {
    minHeight: 44, minWidth: 44, borderRadius: 10, fontWeight: 800, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
      }}
    >
      {/* 進捗バー (上端・ノッチを避ける) */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10001,
        pointerEvents: 'auto',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        background: 'linear-gradient(180deg, rgba(10,10,18,0.94), rgba(10,10,18,0.0))',
      }}>
        <div style={{
          padding: '8px 12px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.15)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${((stepIdx + 1) / steps.length) * 100}%`,
              background: `linear-gradient(90deg, ${accent}, ${brand === 'iris' ? '#A855F7' : '#6366F1'})`,
              transition: 'width 0.35s ease',
            }} />
          </div>
          <span style={{ color: '#fff', fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', minWidth: 46, textAlign: 'right' }}>
            {stepIdx + 1} / {steps.length}
          </span>
          <button
            onClick={() => setConfirmExit(true)}
            style={{
              ...btnBase, fontSize: 13, padding: '0 14px',
              background: 'rgba(255,255,255,0.14)', color: '#fff',
              border: '1px solid rgba(255,255,255,0.22)',
            }}
          >やめる</button>
        </div>
      </div>

      {/* スポットライト (SVG mask で穴を開ける) */}
      {phase === 'ready' && rect ? (
        <svg
          width={viewport.w} height={viewport.h}
          style={{ position: 'fixed', inset: 0, pointerEvents: 'auto' }}
          onClick={() => setConfirmExit(true)}
        >
          <defs>
            <mask id={`spotlight-mask-${stepIdx}`}>
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={rect.left - pad} y={rect.top - pad}
                width={rect.width + pad * 2} height={rect.height + pad * 2}
                rx={Math.min(14, rect.height / 2)}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%" height="100%" fill="rgba(0,0,0,0.72)"
            mask={`url(#spotlight-mask-${stepIdx})`}
          />
        </svg>
      ) : (
        // 見つからない時 / 探索中: 全画面の暗背景
        <div
          onClick={() => setConfirmExit(true)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(2px)',
            pointerEvents: 'auto',
          }}
        />
      )}

      {/* パルスリング (target が居る時だけ) */}
      {phase === 'ready' && rect && (
        <>
          <motion.div
            initial={{ scale: 0.9, opacity: 0.85 }}
            animate={{ scale: 1.15, opacity: 0 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              left: rect.left - pad,
              top: rect.top - pad,
              width: rect.width + pad * 2,
              height: rect.height + pad * 2,
              borderRadius: Math.min(14, rect.height / 2),
              border: `3px solid ${accent}`,
              boxShadow: `0 0 30px ${accent}88`,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'fixed',
              left: rect.left - pad,
              top: rect.top - pad,
              width: rect.width + pad * 2,
              height: rect.height + pad * 2,
              borderRadius: Math.min(14, rect.height / 2),
              border: `2px solid ${accent}`,
              pointerEvents: 'none',
            }}
          />
          {/* 「ここをタップ」バッジ */}
          <div
            style={{
              position: 'fixed',
              left: badgeLeft,
              top: Math.max(4, rect.top - 38),
              padding: '6px 11px',
              borderRadius: 999,
              background: accent, color: '#fff',
              fontSize: 12, fontWeight: 900,
              boxShadow: `0 6px 18px ${accent}66`,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
          >
            <Hand size={13} strokeWidth={2.4} />
            {step.tapLabel || 'ここをタップ'}
          </div>
        </>
      )}

      {/* 説明パネル
          退場アニメは付けない (AnimatePresence mode="wait" を使わない)。
          退場の完了を待つ作りだと、rAF が止まる環境で中身が前のステップのまま固まり、
          上の進捗バーと「◯ / ◯」だけが進む = 嘘の進行になる。 */}
      <motion.div
        ref={tipRef}
        key={stepIdx}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        style={{
          position: 'fixed',
          left: tooltipPos.left,
          top: tooltipPos.top,
          width: tooltipPos.w,
          padding: '14px 16px',
          borderRadius: 14,
          background: 'rgba(20, 20, 30, 0.97)',
          backdropFilter: 'blur(10px)',
          color: '#fff',
          border: `1px solid ${accent}66`,
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          pointerEvents: 'auto',
          zIndex: 10002,
        }}
      >
        {confirmExit ? (
          /* 誤タップで案内が消えないように、終わる前に1回だけ聞く */
          <>
            <div style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.4, marginBottom: 6 }}>
              案内を終わりますか？
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.7, color: 'rgba(255,255,255,0.85)', marginBottom: 12 }}>
              あとで見たくなったら、検索窓（画面下の入力欄）で「使い方」と打つと、いつでもここから始められます。
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setConfirmExit(false)}
                style={{
                  ...btnBase, flex: 1, fontSize: 13, padding: '0 12px',
                  background: accent, color: '#fff', border: 'none',
                  boxShadow: `0 4px 14px ${accent}55`,
                }}
              >案内を続ける</button>
              <button
                onClick={stopTour}
                style={{
                  ...btnBase, flex: 1, fontSize: 13, padding: '0 12px',
                  background: 'transparent', color: 'rgba(255,255,255,0.8)',
                  border: '1px solid rgba(255,255,255,0.25)',
                }}
              >終わる</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{
                fontSize: 10, padding: '3px 8px', borderRadius: 999, fontWeight: 800, letterSpacing: '0.06em',
                background: accent, color: '#fff',
              }}>{brand === 'iris' ? 'IRIS' : 'PRISM'}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>
                {stepIdx + 1} / {steps.length}
              </span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.4, marginBottom: 8 }}>
              {step.title}
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.75, color: 'rgba(255,255,255,0.86)', marginBottom: 12 }}>
              {step.body}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                disabled={stepIdx === 0}
                style={{
                  ...btnBase, fontSize: 13, padding: '0 12px',
                  background: 'transparent',
                  color: stepIdx === 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  cursor: stepIdx === 0 ? 'default' : 'pointer',
                }}
              ><ChevronLeft size={15} strokeWidth={2.4} />前へ</button>
              <button
                onClick={advance}
                style={{
                  ...btnBase, fontSize: 14, padding: '0 18px',
                  background: accent, color: '#fff', border: 'none',
                  boxShadow: `0 4px 14px ${accent}55`,
                }}
              >
                {isLast ? <><Check size={16} strokeWidth={2.6} />終わる</> : <>次へ<ChevronRight size={16} strokeWidth={2.6} /></>}
              </button>
            </div>

            {/* 探索中: 1秒を超えたら「とばす」を出す (黙って3秒待たせない) */}
            {phase === 'searching' && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Search size={13} strokeWidth={2.2} />
                  この画面のどこにあるか探しています…
                </div>
                {slowSearch && (
                  <button
                    onClick={advance}
                    style={{
                      ...btnBase, width: '100%', marginTop: 8, fontSize: 13, padding: '0 12px',
                      background: 'rgba(255,255,255,0.1)', color: '#fff',
                      border: '1px solid rgba(255,255,255,0.22)',
                    }}
                  ><SkipForward size={14} strokeWidth={2.4} />この手順をとばす</button>
                )}
              </div>
            )}

            {/* 見つからなかった: 何が起きたかと、次にできることを必ず出す */}
            {phase === 'fallback' && step.target && (
              <div style={{
                fontSize: 11.5, lineHeight: 1.7, color: '#FBBF24', marginTop: 10, padding: '8px 10px',
                background: 'rgba(251,191,36,0.1)', borderRadius: 8,
                display: 'flex', alignItems: 'flex-start', gap: 6,
              }}>
                <Info size={14} strokeWidth={2.2} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>この機能はいまの画面には出ていません。説明だけ読んで「次へ」で進めます。</span>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
