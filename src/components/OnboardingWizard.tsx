import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PrismLogo } from './Logo';
import { markOnboarded, seedDemoData, setDemoActive } from '../lib/onboarding';
import { logEvent } from '../lib/onboardingAnalytics';

interface Props {
  onComplete: () => void;
  accentColor?: string;
}

const TOUR_HIGHLIGHTS = [
  {
    icon: '💡',
    title: '今日のブリーフ',
    desc: 'AIが毎朝あなたの状況を分析し、今日やるべき最優先アクションを提案します。人格ごとに最適化されています。',
  },
  {
    icon: '⚡',
    title: 'クイックアクション',
    desc: '請求書・CRM・議事録・スライド生成など、全機能にワンクリックでアクセス。何でもここから始められます。',
  },
  {
    icon: '🔮',
    title: 'Cmd+K 横断検索',
    desc: 'キーボードショートカット（⌘K）で人格もナレッジも機能も瞬時に横断検索。手を離さずに操作できます。',
  },
  {
    icon: '⚙',
    title: '環境設定',
    desc: 'AIモデルの選択・文体の調整・音声設定をカスタマイズ。左サイドバー下部の「環境設定」から。',
  },
  {
    icon: '👑',
    title: 'プレミアム機能',
    desc: '戦略分析・法務レビュー・交渉コーチなど高度なAI機能を解放。クイックアクションの「プレミアム」から。',
  },
];

const STEP_SLIDE = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
  transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
};

export default function OnboardingWizard({ onComplete, accentColor = '#c9a96e' }: Props) {
  const [step, setStep] = useState(0);
  const [tourIdx, setTourIdx] = useState(0);
  const [choice, setChoice] = useState<'demo' | 'empty' | null>(null);

  const accent = accentColor;
  const accentBg = `${accent}22`;
  const accentBorder = `${accent}55`;

  const handleComplete = () => {
    if (choice === 'demo') {
      const count = seedDemoData();
      setDemoActive(true);
      markOnboarded();
      logEvent('onboarding_completed', { choice: 'demo', seededItems: count });
      logEvent('demo_seeded', { count });
      window.location.reload();
    } else {
      markOnboarded();
      logEvent('onboarding_completed', { choice: 'empty' });
      onComplete();
    }
  };

  const handleSkip = () => {
    markOnboarded();
    logEvent('onboarding_skipped', { step });
    onComplete();
  };

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(16px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-md mx-4 rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: '#111118',
          border: '1px solid rgba(255,255,255,0.1)',
          maxHeight: '90dvh',
        }}
        initial={{ scale: 0.92, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 24 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="h-0.5 w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            className="h-full"
            style={{ background: accent }}
            animate={{ width: `${((step + 1) / 4) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-between px-5 pt-4 pb-0">
          <div className="flex gap-1.5">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === step ? '20px' : '6px',
                  height: '6px',
                  background: i <= step ? accent : 'rgba(255,255,255,0.12)',
                }}
              />
            ))}
          </div>
          <button
            onClick={handleSkip}
            className="text-xs transition-colors"
            style={{ color: 'rgba(255,255,255,0.3)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
          >
            スキップ
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">

            {/* Step 0: Welcome */}
            {step === 0 && (
              <motion.div key="s0" className="p-6 space-y-5" {...STEP_SLIDE}>
                <div className="flex flex-col items-center text-center space-y-3 py-2">
                  <PrismLogo size={48} withWordmark />
                  <div>
                    <h2 className="text-lg font-medium" style={{ color: 'var(--fg, #f0f0f0)' }}>
                      CORE Prism へようこそ
                    </h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--fg-muted, rgba(255,255,255,0.5))' }}>
                      複数の人格を持ち、それぞれに特化した AI と共に働く OS
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { icon: '🧠', label: 'AI 戦略提案' },
                    { icon: '📚', label: 'ナレッジ RAG' },
                    { icon: '🤝', label: 'CRM 案件管理' },
                    { icon: '🧾', label: '請求書・書類' },
                    { icon: '🎙', label: '議事録 AI' },
                    { icon: '📊', label: 'P&L レポート' },
                  ].map(f => (
                    <div
                      key={f.label}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{ background: accentBg, border: `1px solid ${accentBorder}` }}
                    >
                      <span className="text-base">{f.icon}</span>
                      <span className="text-xs font-medium" style={{ color: 'var(--fg, #f0f0f0)' }}>{f.label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  数分でセットアップ完了 — まずはデモを試しませんか？
                </p>
              </motion.div>
            )}

            {/* Step 1: Demo choice */}
            {step === 1 && (
              <motion.div key="s1" className="p-6 space-y-4" {...STEP_SLIDE}>
                <div className="text-center">
                  <h2 className="text-base font-medium" style={{ color: 'var(--fg, #f0f0f0)' }}>
                    どこから始めますか？
                  </h2>
                  <p className="text-xs mt-1" style={{ color: 'var(--fg-muted, rgba(255,255,255,0.5))' }}>
                    デモデータで全機能を体験するか、空の状態から始められます
                  </p>
                </div>
                <motion.button
                  onClick={() => setChoice('demo')}
                  className="w-full p-4 rounded-xl text-left transition-all"
                  style={{
                    background: choice === 'demo' ? accentBg : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${choice === 'demo' ? accentBorder : 'rgba(255,255,255,0.08)'}`,
                  }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">☕</span>
                    <div>
                      <p className="font-medium text-sm" style={{ color: 'var(--fg, #f0f0f0)' }}>
                        デモを試す（推奨）
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--fg-muted, rgba(255,255,255,0.5))' }}>
                        カフェ経営者・田中健一のデータで全機能を体験。
                        タスク5件・ナレッジ3件・CRM案件2件・見積書1枚を投入します。
                      </p>
                      <p className="text-xs mt-1.5" style={{ color: accent }}>
                        ✓ 後でワンクリックで削除できます
                      </p>
                    </div>
                  </div>
                </motion.button>
                <motion.button
                  onClick={() => setChoice('empty')}
                  className="w-full p-4 rounded-xl text-left transition-all"
                  style={{
                    background: choice === 'empty' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${choice === 'empty' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">✦</span>
                    <div>
                      <p className="font-medium text-sm" style={{ color: 'var(--fg, #f0f0f0)' }}>
                        空から始める
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--fg-muted, rgba(255,255,255,0.5))' }}>
                        自分のデータだけで使い始めます。
                      </p>
                    </div>
                  </div>
                </motion.button>
              </motion.div>
            )}

            {/* Step 2: Guide tour */}
            {step === 2 && (
              <motion.div key="s2" className="p-6 space-y-4" {...STEP_SLIDE}>
                <div className="text-center">
                  <h2 className="text-base font-medium" style={{ color: 'var(--fg, #f0f0f0)' }}>
                    主な機能をご紹介
                  </h2>
                  <p className="text-xs mt-1" style={{ color: 'var(--fg-muted, rgba(255,255,255,0.5))' }}>
                    {tourIdx + 1} / {TOUR_HIGHLIGHTS.length}
                  </p>
                </div>

                <div className="relative overflow-hidden" style={{ minHeight: '160px' }}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={tourIdx}
                      className="p-5 rounded-xl text-center space-y-3"
                      style={{ background: accentBg, border: `1px solid ${accentBorder}` }}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="text-4xl">{TOUR_HIGHLIGHTS[tourIdx].icon}</div>
                      <p className="font-semibold text-sm" style={{ color: 'var(--fg, #f0f0f0)' }}>
                        {TOUR_HIGHLIGHTS[tourIdx].title}
                      </p>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--fg-muted, rgba(255,255,255,0.6))' }}>
                        {TOUR_HIGHLIGHTS[tourIdx].desc}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="flex items-center justify-center gap-1.5">
                  {TOUR_HIGHLIGHTS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setTourIdx(i)}
                      className="rounded-full transition-all duration-200"
                      style={{
                        width: i === tourIdx ? '18px' : '6px',
                        height: '6px',
                        background: i === tourIdx ? accent : 'rgba(255,255,255,0.2)',
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 3: Complete */}
            {step === 3 && (
              <motion.div key="s3" className="p-6 space-y-4 text-center" {...STEP_SLIDE}>
                <div className="text-5xl py-2">🚀</div>
                <div>
                  <h2 className="text-base font-medium" style={{ color: 'var(--fg, #f0f0f0)' }}>
                    準備完了！
                  </h2>
                  <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--fg-muted, rgba(255,255,255,0.5))' }}>
                    {choice === 'demo'
                      ? 'デモデータを投入します。ページが更新され、ペルソナ選択画面で「カフェ経営者・田中健一」を選ぶと全機能を体験できます。'
                      : '実データで始めましょう。人格を作成してナレッジを追加するところからスタートです。'}
                  </p>
                </div>
                {choice === 'demo' && (
                  <div
                    className="p-3 rounded-lg text-left space-y-1"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <p className="text-xs font-medium" style={{ color: accent }}>📦 投入されるデモデータ</p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      ペルソナ × 1、タスク × 5、ナレッジ × 3、CRM案件 × 2、見積書 × 1
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            className="text-sm px-4 py-2 rounded-lg transition-colors"
            style={{ color: 'rgba(255,255,255,0.4)', visibility: step === 0 ? 'hidden' : 'visible' }}
          >
            ← 戻る
          </button>

          {step < 3 ? (
            <motion.button
              onClick={() => {
                if (step === 1 && choice === null) return;
                setStep(s => s + 1);
                if (step === 0) logEvent('onboarding_started');
              }}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: `linear-gradient(135deg, ${accent}, ${accent}bb)`,
                color: '#0a0a0f',
                opacity: step === 1 && choice === null ? 0.4 : 1,
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {step === 0 ? '始める →' : '次へ →'}
            </motion.button>
          ) : (
            <motion.button
              onClick={handleComplete}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              style={{
                background: `linear-gradient(135deg, ${accent}, ${accent}bb)`,
                color: '#0a0a0f',
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {choice === 'demo' ? '🚀 デモを開始！' : '✦ ダッシュボードへ'}
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
