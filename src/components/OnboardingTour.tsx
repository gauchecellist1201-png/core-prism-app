// ============================================================
// OnboardingTour — オンボ完了直後の Welcome 60 秒ツアー
//
// オーナー指示 (2026-06-04 第 17 波 NNN):
//   初回 dashboard 到達時のみ 4 ステップの軽いツアー。
//   skip / 完了で localStorage `core_onboarding_tour_done` を立てる。
//
// 4 ステップ:
//   1. CXO ピル (作戦本部) の場所
//   2. 朝のブリーフ — 自動で出てくるよ
//   3. 機能シート — もっと深い機能はここから
//   4. FAB — 右下から AI に質問 / 左下で改善提案
//
// 設計:
//   - AnimatePresence でステップ間をフェード
//   - 半透明オーバーレイ + 中央カード
//   - 各ステップに「次へ」「skip」
//   - 60 秒の自動進行は無し (ユーザーペース)
// ============================================================

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, X, Sparkles } from 'lucide-react';

const KEY = 'core_onboarding_tour_done';

type Step = {
  emoji: string;
  title: string;
  body: string;
  tip?: string;
};

const STEPS: Step[] = [
  {
    emoji: '👔',
    title: 'AI 役員 14 名が、ここにいます',
    body: '画面下の「14 セル グリッド」が CXO 役員の作戦本部です。タップすると「いま任せられる 3 件」が開きます。',
    tip: 'お気に入りの役員は色 + 絵文字で覚えられます',
  },
  {
    emoji: '🌅',
    title: '朝のブリーフは 1 日 1 回 自動で',
    body: '初回ログインの時、いまの数字とおすすめの「最初の一手」を AI が短くまとめます。すぐ動けるように。',
    tip: '見落としても、後でいつでもチャット欄から呼べます',
  },
  {
    emoji: '✨',
    title: 'もっと深い機能は「機能シート」から',
    body: 'CXO 軍団以外にも、Studio (各機能の専門画面)、CRM、コンテンツ、設定、請求 などのフル機能が揃っています。',
    tip: 'モバイルでは ヘッダーの「機能」 / デスクトップでは Cmd+K',
  },
  {
    emoji: '💬',
    title: '困った時の 4 箇所',
    body: '右下: いま AI に質問 (QuickAsk) / 左下: 改善提案 (Suggestion) / 設定 → 環境 / /contact ページ',
    tip: 'まずは「右下」を覚えてください。何でも気軽に',
  },
];

import { useCelebrate } from '../hooks/useCelebrate';

export default function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  // NNNNNN (2026-06-04): ツアー終了時に 14 役員 拍手 + 紙吹雪
  const { celebrate, CelebratePortal } = useCelebrate();

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === '1') return;
      // 少し遅延して表示 (ダッシュボードの描画が落ち着くまで)
      const t = window.setTimeout(() => setOpen(true), 1200);
      return () => window.clearTimeout(t);
    } catch { /* */ }
  }, []);

  const close = (completed: boolean) => {
    setOpen(false);
    try { localStorage.setItem(KEY, completed ? '1' : '1'); } catch { /* skip も同じ扱い (再表示しない) */ }
    if (completed) {
      // NNNNNN: 14 役員 拍手 epic
      setTimeout(() => {
        celebrate({ message: 'ようこそ — 14 役員 が お迎えします!', level: 'epic' });
      }, 200);
    }
  };

  const next = () => {
    if (step >= STEPS.length - 1) {
      close(true);
    } else {
      setStep(step + 1);
    }
  };

  if (!open) return <>{CelebratePortal}</>;  // 閉じても celebrate のポータルは残す
  const s = STEPS[step];

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 95,
          background: 'rgba(0, 0, 10, 0.65)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px 16px',
        }}
        onClick={() => close(false)}
      >
        <motion.div
          key={`card-${step}`}
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ duration: 0.25 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 'min(440px, 100%)',
            background: 'rgba(15, 14, 27, 0.96)',
            border: '1px solid rgba(167,139,250,0.4)',
            borderRadius: 22,
            padding: '1.5rem 1.5rem 1.25rem',
            color: '#fff',
            boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
            position: 'relative',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <button
            onClick={() => close(false)}
            aria-label="ツアーをスキップ"
            style={{
              position: 'absolute', top: 12, right: 12,
              width: 30, height: 30, borderRadius: 15,
              background: 'rgba(255,255,255,0.08)', border: 'none',
              color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={14} />
          </button>

          {/* Step バッジ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <Sparkles size={12} color="#a78bfa" />
            <div style={{
              fontSize: '0.6rem', letterSpacing: '0.3em',
              fontWeight: 800, color: '#a78bfa',
              textTransform: 'uppercase',
            }}>
              60 秒ツアー · {step + 1} / {STEPS.length}
            </div>
          </div>

          <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: 8 }}>{s.emoji}</div>
          <h2 style={{
            margin: '0 0 10px', fontSize: '1.15rem', fontWeight: 900,
            textAlign: 'center', lineHeight: 1.4,
          }}>
            {s.title}
          </h2>
          <p style={{
            margin: 0, fontSize: '0.88rem', color: 'rgba(255,255,255,0.78)',
            lineHeight: 1.75, textAlign: 'center',
          }}>
            {s.body}
          </p>

          {s.tip && (
            <div style={{
              marginTop: 12,
              padding: '8px 12px',
              background: 'rgba(251,191,36,0.08)',
              border: '1px solid rgba(251,191,36,0.2)',
              borderRadius: 10,
              fontSize: '0.75rem',
              color: 'rgba(254,243,199,0.92)',
              lineHeight: 1.6,
              textAlign: 'center',
            }}>
              💡 {s.tip}
            </div>
          )}

          {/* 進捗バー */}
          <div style={{
            marginTop: 16,
            display: 'flex', gap: 4,
          }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 3,
                background: i <= step ? 'linear-gradient(90deg, #a78bfa, #f472b6)' : 'rgba(255,255,255,0.1)',
                borderRadius: 999,
              }} />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
            <button
              onClick={() => close(false)}
              style={{
                flex: 1, padding: '10px 0',
                borderRadius: 12,
                background: 'transparent',
                color: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(255,255,255,0.15)',
                fontSize: '0.82rem', fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              スキップ
            </button>
            <button
              onClick={next}
              style={{
                flex: 2, padding: '10px 0',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #a78bfa, #f472b6)',
                color: '#fff', border: 'none',
                fontSize: '0.9rem', fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: '0 8px 18px rgba(167,139,250,0.35)',
              }}
            >
              {step >= STEPS.length - 1 ? '始めます' : '次へ'}
              <ArrowRight size={14} />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
