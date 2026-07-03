import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AppSettings } from '../types/identity';
import { INDUSTRY_LIST, INDUSTRY_PACKS, type IndustryId } from '../prism/industryPacks';
import { recordStep, type OnboardStep } from '../lib/onboardingFunnel';
import { useCelebrate } from '../hooks/useCelebrate';

interface Props {
  onComplete: (settings: Partial<AppSettings>) => void;
}

// 業界ランディングページ (/industry/restaurant 等) から ?industry=food で来た時に
// その業界を最初から選択済みにしておく。ランディングの「飲食店向け」の文脈を切らさない。
function readIndustryFromUrl(): IndustryId | '' {
  if (typeof window === 'undefined') return '';
  try {
    const raw = new URLSearchParams(window.location.search).get('industry');
    if (raw && (INDUSTRY_PACKS as Record<string, unknown>)[raw]) {
      return raw as IndustryId;
    }
  } catch {
    // URLSearchParams が落ちる環境では何もしない
  }
  return '';
}

// 業種のイニシャル1文字チップ（OS絵文字は使わない）。
function industryInitial(label: string): string {
  return label.trim().charAt(0) || '業';
}

export default function OnboardingFlow({ onComplete }: Props) {
  const { celebrate, CelebratePortal } = useCelebrate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [presetIndustry] = useState<IndustryId | ''>(() => readIndustryFromUrl());
  const [industry, setIndustry] = useState<IndustryId | ''>(presetIndustry);
  const presetPack = presetIndustry ? INDUSTRY_PACKS[presetIndustry] : null;

  // 最短距離: welcome → name → industry。業種がURLで確定済みなら industry も省く。
  const allSteps = [
    { id: 'welcome' },
    { id: 'name' },
    { id: 'industry' },
  ];
  const steps = presetIndustry ? allSteps.filter(s => s.id !== 'industry') : allSteps;
  const currentStepId = steps[step]?.id ?? 'welcome';

  useEffect(() => {
    try { recordStep(currentStepId as OnboardStep); } catch { /* */ }
  }, [currentStepId]);

  const handleComplete = () => {
    try { recordStep('completed'); } catch { /* */ }
    // 業種別ペルソナ プリセットを保留し、ダッシュボード初回ロードで一括追加を提示する
    try {
      if (industry) {
        localStorage.setItem('core_persona_preset_suggest_v1', JSON.stringify({
          industry, ts: Date.now(),
        }));
      }
    } catch { /* */ }
    try { celebrate({ message: `${name || 'あなた'} さん、ようこそ — 14 役員 がお迎えします!`, level: 'epic' }); } catch { /* */ }
    setTimeout(() => {
      onComplete({
        userName: name,
        claudeApiKey: '',
        preferredModel: 'claude-haiku-4-5' as AppSettings['preferredModel'],
        industry: (industry || undefined) as AppSettings['industry'],
        onboardingComplete: true,
      });
    }, 600);
  };

  const isNameStep     = currentStepId === 'name';
  const isIndustryStep = currentStepId === 'industry';
  const isLast = step === steps.length - 1;

  const canNext = () => {
    if (isNameStep) return name.trim().length > 0;
    if (isIndustryStep) return industry !== '';
    return true;
  };

  const goNext = () => { if (canNext()) { isLast ? handleComplete() : setStep(s => s + 1); } };

  return (
    <>
    {CelebratePortal}
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Background orb */}
      <motion.div
        className="absolute w-96 h-96 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(201,169,110,0.05) 0%, transparent 70%)',
          top: '20%', left: '30%',
        }}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 8, repeat: Infinity }}
      />

      {/* Step indicator */}
      <div className="flex gap-2 mb-10">
        {steps.map((_, i) => (
          <motion.div
            key={i}
            className="h-0.5 rounded-full"
            style={{
              width: i === step ? '24px' : '8px',
              background: i <= step ? '#c9a96e' : 'rgba(255,255,255,0.1)',
            }}
            animate={{ width: i === step ? '24px' : '8px' }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="step0"
            className="text-center max-w-md px-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <p className="text-prism text-5xl font-extralight mb-2">CORE</p>
            <p className="text-sm tracking-widest uppercase mb-8" style={{ color: 'rgba(255,255,255,0.7)' }}>Prism</p>
            {presetPack && (
              <div className="inline-block px-3 py-1 rounded-full mb-6 text-xs" style={{ background:'rgba(201,169,110,0.10)', border:'1px solid rgba(201,169,110,0.25)', color:'#c9a96e' }}>
                {presetPack.label} 向けに準備中
              </div>
            )}
            <h2 className="text-fg text-2xl font-bold mb-4 leading-relaxed">
              AI 役員 13 名が、<br />あなたの右腕になります。
            </h2>
            <p className="text-sm font-light leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.7)' }}>
              ひとりの社長が、ひとりで抱えなくていい時代へ。
            </p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              7日間無料 ・ カード登録なし ・ いつでも解約できます
            </p>
          </motion.div>
        )}

        {isNameStep && (
          <motion.div
            key="step1"
            className="max-w-sm w-full px-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <h2 className="text-fg text-2xl font-extralight mb-2">あなたのお名前は？</h2>
            <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.65)' }}>AIがあなたに合わせた対話を行います</p>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例：田中 太郎"
              className="w-full bg-transparent text-fg outline-none border-b pb-3"
              style={{ borderColor: name ? '#c9a96e' : 'rgba(255,255,255,0.1)', fontSize: 18, minHeight: 44 }}
              onKeyDown={e => e.key === 'Enter' && goNext()}
              autoFocus
            />
          </motion.div>
        )}

        {isIndustryStep && (
          <motion.div
            key="step-industry"
            className="max-w-2xl w-full px-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <h2 className="text-fg text-2xl font-extralight mb-2 px-2">あなたの業種は？</h2>
            <p className="text-sm mb-6 leading-relaxed px-2" style={{ color: 'rgba(255,255,255,0.65)' }}>
              AI がその業界の言葉で提案します。あとから変更できます。
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[56vh] overflow-y-auto pr-1 pb-2">
              {INDUSTRY_LIST.map(ind => {
                const selected = industry === ind.id;
                return (
                  <motion.button
                    key={ind.id}
                    onClick={() => setIndustry(ind.id)}
                    className="text-left p-4 rounded-2xl transition-all duration-200"
                    style={{
                      background: selected ? 'rgba(201,169,110,0.12)' : 'rgba(255,255,255,0.035)',
                      boxShadow: selected ? '0 8px 24px -10px rgba(201,169,110,0.45)' : '0 2px 12px -6px rgba(0,0,0,0.4)',
                      minHeight: 76,
                    }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                        style={{
                          background: selected ? '#c9a96e' : 'rgba(201,169,110,0.14)',
                          color: selected ? '#0a0a0f' : '#c9a96e',
                        }}>
                        {selected ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                        ) : industryInitial(ind.label)}
                      </span>
                      <span className="text-fg text-sm font-medium">{ind.label}</span>
                    </div>
                    <p className="text-[11px] leading-snug" style={{ color: 'rgba(255,255,255,0.65)' }}>
                      {ind.shortDescription}
                    </p>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>

    {/* Fixed bottom bar — 親指が届く場所に、常に1つの主アクション */}
    <div
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        padding: '12px 20px calc(12px + env(safe-area-inset-bottom))',
        background: 'linear-gradient(180deg, rgba(10,10,15,0), rgba(10,10,15,0.88) 34%)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      <div className="mx-auto flex max-w-md items-center gap-3">
        {step > 0 && (
          <button
            onClick={() => setStep(s => s - 1)}
            className="flex items-center justify-center rounded-full text-sm transition-colors hover:text-fg"
            style={{ color: 'rgba(255,255,255,0.7)', minWidth: 44, minHeight: 52 }}
            aria-label="戻る"
          >
            ←
          </button>
        )}
        <motion.button
          onClick={goNext}
          disabled={!canNext()}
          className="flex-1 rounded-full text-base font-semibold transition-all duration-200"
          style={{
            minHeight: 52,
            background: canNext() ? 'linear-gradient(135deg, #c9a96e, #a07840)' : 'rgba(255,255,255,0.06)',
            color: canNext() ? '#0a0a0f' : 'rgba(255,255,255,0.35)',
          }}
          whileTap={canNext() ? { scale: 0.98 } : {}}
        >
          {isLast ? '始める' : '次へ'}
        </motion.button>
      </div>
    </div>
    </>
  );
}
