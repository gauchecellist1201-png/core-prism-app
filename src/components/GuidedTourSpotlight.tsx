// ============================================================
// GuidedTourSpotlight — HubSpot 風 「ここを タップ」 ガイド ツアー
//
// オーナー指示 (2026-06-05):
//   「『ここを タップ』 『ここを タップ』 を 次々 表示 して 機能 の 使い方 を
//    自然に 教える、 HubSpot みたい な 体験。 マスター キー でも 同じ 動き で
//    全機能 を 一通り 触れる 状態 を 作る。」
//
// 動き:
//   1. ステップ ごと に target 要素 を querySelector で 探す
//   2. その 要素 周り に 「穴」 を 開けて 暗背景 で 周り を 隠す (SVG mask)
//   3. 要素 を ⚪ パルス で 強調 + 「ここを タップ」 バッジ
//   4. 近く に 説明 ツールチップ (位置 自動 計算)
//   5. ユーザー が target を 触る OR 「次へ」 で 次 ステップ
//   6. 「スキップ」 で いつでも 終了
//   7. 最後 まで で 完了 (markTourDone)
//
// 設計:
//   - target が 見つから ない 場合 は 一定 時間 ポーリング (動的 描画 待ち)
//   - 各 ステップ に preAction (前 処理) を 持てる (タブ 切替 等)
//   - 進捗 バー: top に 1/12 形式
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { markTourDone } from '../lib/freshUserDemo';

export interface TourStep {
  id: string;
  title: string;
  body: string;
  /** CSS セレクタ (data-tour-id="xxx" を 推奨) — 省略時 は 画面中央 で 普通 の カード */
  target?: string;
  /** ツールチップ の 配置 — auto は 自動 計算 */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  /** ステップ 開始 時 に やる 事 (タブ 切替 / モーダル 開く 等) */
  preAction?: () => void | Promise<void>;
  /** 「ここを タップ」 ラベル を 変える */
  tapLabel?: string;
  /** ターゲット 周り の パディング (px) — 既定 8 */
  spotlightPad?: number;
  /** target 出現 まで の 最大 待機 (ms) — 既定 3000 */
  waitMs?: number;
}

interface Props {
  steps: TourStep[];
  brand: 'prism' | 'iris';
  onClose: () => void;
  onComplete: () => void;
}

type Phase = 'searching' | 'ready' | 'fallback';

export default function GuidedTourSpotlight({ steps, brand, onClose, onComplete }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('searching');
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const targetRef = useRef<HTMLElement | null>(null);
  const step = steps[stepIdx];
  const isLast = stepIdx >= steps.length - 1;

  const accent = brand === 'iris' ? '#F472B6' : '#A78BFA';

  // ── ステップ 切替 時 に target を 探す ───────────────────
  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    setPhase('searching');
    setRect(null);
    targetRef.current = null;

    const doSearch = async () => {
      // preAction を 走らせる (タブ 切替 / モーダル 開く 等)
      try { await step.preAction?.(); } catch { /* */ }
      if (cancelled) return;

      if (!step.target) {
        // 中央 カード モード
        setPhase('fallback');
        return;
      }
      const start = Date.now();
      const maxWait = step.waitMs ?? 3000;
      while (!cancelled) {
        const el = document.querySelector(step.target) as HTMLElement | null;
        if (el && el.offsetParent !== null) {
          // 要素 が 見つかり 表示中
          targetRef.current = el;
          // スクロール して 画面内 に
          try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch { /* */ }
          await new Promise((r) => setTimeout(r, 350));
          if (cancelled) return;
          const r = el.getBoundingClientRect();
          setRect(r);
          setPhase('ready');
          return;
        }
        if (Date.now() - start > maxWait) {
          // 見つから ない → 中央 カード で 説明 だけ
          setPhase('fallback');
          return;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
    };
    doSearch();
    return () => { cancelled = true; };
  }, [stepIdx, step]);

  // ── ターゲット の 位置 を 追従 (リサイズ / スクロール) ─────
  useEffect(() => {
    if (phase !== 'ready' || !targetRef.current) return;
    const update = () => {
      if (!targetRef.current) return;
      setRect(targetRef.current.getBoundingClientRect());
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    const t = window.setInterval(update, 250); // 動的 UI 用 ポーリング
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      window.clearInterval(t);
    };
  }, [phase]);

  // ── ユーザー が target を タップ したら 次 へ 進む ─────
  useEffect(() => {
    if (phase !== 'ready' || !targetRef.current) return;
    const el = targetRef.current;
    const handler = () => {
      // 少し 遅延 して 次 ステップ (クリック の 動作 を 阻害 しない)
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

  const skip = () => {
    markTourDone();
    onClose();
  };

  // ── ツールチップ の 位置 計算 ─────────────────────────
  const tooltipPos = useMemo(() => {
    if (phase !== 'ready' || !rect) return { left: viewport.w / 2 - 160, top: viewport.h / 2, w: 320 };
    const TIP_W = Math.min(320, viewport.w - 32);
    const TIP_H = 200; // 概算
    const placement = step.placement || 'auto';
    const pad = 16;
    // 自動: 下 → 上 → 右 → 左 の 優先
    const tryDown = rect.bottom + TIP_H + pad < viewport.h;
    const tryUp   = rect.top - TIP_H - pad > 0;
    const tryRight = rect.right + TIP_W + pad < viewport.w;
    const tryLeft  = rect.left - TIP_W - pad > 0;
    let pos: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
    if (placement === 'auto') {
      pos = tryDown ? 'bottom' : tryUp ? 'top' : tryRight ? 'right' : tryLeft ? 'left' : 'bottom';
    } else pos = placement;
    let left = rect.left + rect.width / 2 - TIP_W / 2;
    let top = rect.bottom + pad;
    if (pos === 'top') { top = rect.top - TIP_H - pad; }
    if (pos === 'right') { left = rect.right + pad; top = rect.top + rect.height / 2 - TIP_H / 2; }
    if (pos === 'left') { left = rect.left - TIP_W - pad; top = rect.top + rect.height / 2 - TIP_H / 2; }
    left = Math.max(12, Math.min(viewport.w - TIP_W - 12, left));
    top = Math.max(12, Math.min(viewport.h - TIP_H - 12, top));
    return { left, top, w: TIP_W };
  }, [phase, rect, viewport, step?.placement]);

  if (!step) return null;
  const pad = step.spotlightPad ?? 8;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
      }}
    >
      {/* 進捗 バー (上端) */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10001,
        pointerEvents: 'auto',
      }}>
        <div style={{
          padding: '10px 16px',
          background: 'linear-gradient(180deg, rgba(10,10,18,0.92), rgba(10,10,18,0.0))',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.15)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${((stepIdx + 1) / steps.length) * 100}%`,
              background: `linear-gradient(90deg, ${accent}, ${brand === 'iris' ? '#A855F7' : '#6366F1'})`,
              transition: 'width 0.35s ease',
            }} />
          </div>
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', minWidth: 44, textAlign: 'right' }}>
            {stepIdx + 1} / {steps.length}
          </span>
          <button
            onClick={skip}
            style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 6, fontWeight: 700,
              background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer',
            }}
          >スキップ</button>
        </div>
      </div>

      {/* スポットライト (SVG mask で 穴 を 開ける) */}
      {phase === 'ready' && rect ? (
        <svg
          width={viewport.w} height={viewport.h}
          style={{ position: 'fixed', inset: 0, pointerEvents: 'auto' }}
          onClick={skip}
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
        // fallback: 全画面 暗背景
        <div
          onClick={skip}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(2px)',
            pointerEvents: 'auto',
          }}
        />
      )}

      {/* パルス リング (target が 居る 時 だけ) */}
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
          {/* 「ここを タップ」 バッジ */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              position: 'fixed',
              left: rect.left + rect.width / 2 - 50,
              top: rect.top - 38,
              padding: '5px 10px',
              borderRadius: 999,
              background: accent, color: '#fff',
              fontSize: 11, fontWeight: 900,
              boxShadow: `0 6px 18px ${accent}66`,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >👆 {step.tapLabel || 'ここを タップ'}</motion.div>
        </>
      )}

      {/* ツールチップ */}
      <AnimatePresence mode="wait">
        <motion.div
          key={stepIdx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 999, fontWeight: 800, letterSpacing: '0.06em',
              background: accent, color: '#fff',
            }}>{brand === 'iris' ? '✨ IRIS' : '🎯 PRISM'}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>
              ステップ {stepIdx + 1} / {steps.length}
            </span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.35, marginBottom: 8 }}>
            {step.title}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.65, color: 'rgba(255,255,255,0.85)', marginBottom: 12 }}>
            {step.body}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
              disabled={stepIdx === 0}
              style={{
                fontSize: 11, padding: '6px 10px', borderRadius: 6, fontWeight: 700,
                background: 'transparent', color: stepIdx === 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.65)',
                border: '1px solid rgba(255,255,255,0.15)',
                cursor: stepIdx === 0 ? 'default' : 'pointer',
              }}
            >← 戻る</button>
            <button
              onClick={advance}
              style={{
                fontSize: 12, padding: '8px 16px', borderRadius: 8, fontWeight: 800,
                background: accent, color: '#fff', border: 'none', cursor: 'pointer',
                boxShadow: `0 4px 14px ${accent}55`,
              }}
            >{isLast ? '🎉 完了' : '次へ →'}</button>
          </div>
          {phase === 'searching' && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 8, textAlign: 'center' }}>
              🔍 該当 ボタン を 探して います…
            </div>
          )}
          {phase === 'fallback' && step.target && (
            <div style={{
              fontSize: 10, color: '#FBBF24', marginTop: 8, padding: '6px 8px',
              background: 'rgba(251,191,36,0.1)', borderRadius: 6,
            }}>
              💡 該当 機能 が この 画面 に 無いみたい です。 「次へ」 で 進めます。
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
