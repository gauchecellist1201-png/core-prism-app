import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AppSettings } from '../types/identity';
import { INDUSTRY_LIST, INDUSTRY_PACKS, type IndustryId } from '../prism/industryPacks';
import { recordStep, type OnboardStep } from '../lib/onboardingFunnel';

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

// オーナー指示 (2026-05-15): 現段階は Haiku のみ。
// Sonnet / Opus は Studio プラン (¥29,800/月以上) で個別解禁する設計に。
// ここでは Haiku のみを選択肢として提示。
const MODELS = [
  {
    id: 'claude-haiku-4-5',
    name: 'Haiku 4.5',
    description: '速くて軽い。すべてのプランで使えます',
    cost: '約 ¥15/月（1日 20 回想定）',
    badge: '今は全員これ',
    badgeColor: '#34d399',
  },
];

// /api/ai サーバが env キー + Gemini fallback で動くため、
// ユーザーが Claude API キーを入力するステップはオンボードから常に省く。
const HAS_ENV_API_KEY = true;

export default function OnboardingFlow({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState<string>('claude-haiku-4-5');
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [presetIndustry] = useState<IndustryId | ''>(() => readIndustryFromUrl());
  const [industry, setIndustry] = useState<IndustryId | ''>(presetIndustry);
  const presetPack = presetIndustry ? INDUSTRY_PACKS[presetIndustry] : null;

  // ENV有: 0=welcome, 1=name, 2=industry, 3=model
  // ENV無: 0=welcome, 1=name, 2=industry, 3=apikey, 4=model
  // presetIndustry がある時は「業種を選ぶ」ステップ自体を取り除く (ランディングで既に選んでくれた)
  const allSteps = HAS_ENV_API_KEY
    ? [
        { id: 'welcome',  title: 'ようこそ', subtitle: 'CORE Identity OS へ' },
        { id: 'name',     title: 'あなたのお名前', subtitle: '最初の一歩' },
        { id: 'industry', title: '業種を選ぶ', subtitle: 'AIをあなたの業界に最適化' },
        { id: 'model',    title: 'AIモデル選択', subtitle: '予算と性能のバランス' },
      ]
    : [
        { id: 'welcome',  title: 'ようこそ', subtitle: 'CORE Identity OS へ' },
        { id: 'name',     title: 'あなたのお名前', subtitle: '最初の一歩' },
        { id: 'industry', title: '業種を選ぶ', subtitle: 'AIをあなたの業界に最適化' },
        { id: 'apikey',   title: 'Claude APIキー', subtitle: 'AIを接続する' },
        { id: 'model',    title: 'AIモデル選択', subtitle: '予算と性能のバランス' },
      ];
  const steps = presetIndustry ? allSteps.filter(s => s.id !== 'industry') : allSteps;
  const currentStepId = steps[step]?.id ?? 'welcome';

  // II (2026-06-03): 各 step に到達したら funnel 計測
  useEffect(() => {
    try { recordStep(currentStepId as OnboardStep); } catch { /* */ }
  }, [currentStepId]);

  const handleComplete = () => {
    try { recordStep('completed'); } catch { /* */ }
    onComplete({
      userName: name,
      claudeApiKey: apiKey,
      preferredModel: model as AppSettings['preferredModel'],
      industry: (industry || undefined) as AppSettings['industry'],
      onboardingComplete: true,
    });
  };

  const isNameStep     = currentStepId === 'name';
  const isIndustryStep = currentStepId === 'industry';
  const isApiKeyStep   = currentStepId === 'apikey';
  const isModelStep    = currentStepId === 'model';

  const canNext = () => {
    if (isNameStep) return name.trim().length > 0;
    if (isIndustryStep) return industry !== '';
    if (isApiKeyStep) return apiKey.startsWith('sk-ant-');
    return true;
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
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
      <div className="flex gap-2 mb-12">
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
            <p className="text-sm tracking-widest uppercase mb-6" style={{ color: 'rgba(255,255,255,0.7)' }}>Prism</p>
            {presetPack && (
              <div className="inline-block px-3 py-1 rounded-full mb-6 text-xs" style={{ background:'rgba(201,169,110,0.10)', border:'1px solid rgba(201,169,110,0.25)', color:'#c9a96e' }}>
                {presetPack.label} 向けに準備中
              </div>
            )}
            <h2 className="text-fg text-2xl font-bold mb-3 leading-relaxed">
              AI 役員 13 名が、<br />あなたの右腕になります。
            </h2>
            <p className="text-sm font-light leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.7)' }}>
              経営判断 ・ 営業提案 ・ 月次 P/L<br />
              ひとりの社長が、ひとりで抱えなくていい時代へ。
            </p>
            {/* 3 つの数字ヒーロー */}
            <div className="grid grid-cols-3 gap-3 mb-8 text-center">
              {[
                { num: '13', sub: 'AI 役員', unit: '名' },
                { num: '5', sub: '初期設定', unit: '分' },
                { num: '7', sub: '無料', unit: '日間' },
              ].map((f, i) => (
                <div key={i} className="p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.06), rgba(232,75,151,0.06))', border: '1px solid rgba(251,191,36,0.20)' }}>
                  <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.55)' }}>{f.sub}</p>
                  <p className="font-bold" style={{ fontSize: '1.6rem', color: '#FBBF24', lineHeight: 1 }}>
                    {f.num}<span style={{ fontSize: '0.7rem', marginLeft: 2, color: 'rgba(255,255,255,0.6)' }}>{f.unit}</span>
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
              カード登録なし ・ いつでも解約できます
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
            <h2 className="text-fg text-xl font-extralight mb-2">あなたのお名前は？</h2>
            <p className="text-xs mb-8" style={{ color: 'rgba(255,255,255,0.65)' }}>AIがあなたに合わせた対話を行います</p>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例：田中 太郎"
              className="w-full bg-transparent text-fg text-lg font-extralight outline-none border-b pb-2 mb-2"
              style={{ borderColor: name ? '#c9a96e' : 'rgba(255,255,255,0.1)' }}
              onKeyDown={e => e.key === 'Enter' && canNext() && setStep(s => s + 1)}
              autoFocus
            />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>Enterでも次へ進めます</p>
          </motion.div>
        )}

        {isIndustryStep && (
          <motion.div
            key="step-industry"
            className="max-w-2xl w-full px-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <h2 className="text-fg text-xl font-extralight mb-2">あなたの業種は？</h2>
            <p className="text-xs mb-6 leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
              業種を選ぶと、AI がその業界の言葉で、すぐ使える提案をします。
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {INDUSTRY_LIST.map(ind => {
                const selected = industry === ind.id;
                return (
                  <motion.button
                    key={ind.id}
                    onClick={() => setIndustry(ind.id)}
                    className="text-left p-4 rounded-xl transition-all duration-200"
                    style={{
                      background: selected ? 'rgba(201,169,110,0.10)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${selected ? 'rgba(201,169,110,0.45)' : 'rgba(255,255,255,0.06)'}`,
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{ind.emoji}</span>
                      <span className="text-fg text-sm font-light">{ind.label}</span>
                    </div>
                    <p className="text-[11px] leading-snug mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      {ind.shortDescription}
                    </p>
                    <p className="text-[10px]" style={{ color: '#c9a96e' }}>
                      月商目安 (中規模): {ind.revenue.mid}
                    </p>
                  </motion.button>
                );
              })}
            </div>
            {industry && (
              <p className="text-xs mt-4" style={{ color: 'rgba(255,255,255,0.7)' }}>
                ✓ あとから設定で変更できます
              </p>
            )}
          </motion.div>
        )}

        {isApiKeyStep && (
          <motion.div
            key="step2"
            className="max-w-sm w-full px-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <h2 className="text-fg text-xl font-extralight mb-2">Claude APIキーを入力</h2>
            <p className="text-xs mb-6 leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
              <a
                href="https://console.anthropic.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: '#c9a96e' }}
              >
                console.anthropic.com
              </a>{' '}
              で取得できます（無料クレジットあり）
            </p>
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl mb-3"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <input
                type={apiKeyVisible ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="flex-1 bg-transparent text-fg text-sm font-mono outline-none"
              />
              <button
                onClick={() => setApiKeyVisible(!apiKeyVisible)}
                className="text-xs hover:text-fg"
                style={{ color: 'rgba(255,255,255,0.65)' }}
              >
                {apiKeyVisible ? '隠す' : '表示'}
              </button>
            </div>
            {apiKey && !apiKey.startsWith('sk-ant-') && (
              <p className="text-red-400 text-xs">有効なキーは「sk-ant-」で始まります</p>
            )}
            {apiKey.startsWith('sk-ant-') && (
              <p style={{ color: '#34d399' }} className="text-xs">✓ 有効な形式です</p>
            )}
            <div
              className="mt-4 p-3 rounded-xl"
              style={{ background: 'rgba(201,169,110,0.05)', border: '1px solid rgba(201,169,110,0.15)' }}
            >
              <p className="text-xs font-light leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                🔒 APIキーはあなたのブラウザのみに保存されます。<br />
                サーバーには送信・保存されません。
              </p>
            </div>
          </motion.div>
        )}

        {isModelStep && (
          <motion.div
            key="step3"
            className="max-w-md w-full px-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <h2 className="text-fg text-xl font-extralight mb-2">AIモデルを選択</h2>
            <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.65)' }}>あとから設定で変更できます</p>
            <div className="space-y-3">
              {MODELS.map(m => (
                <motion.button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className="w-full text-left p-4 rounded-xl transition-all duration-200"
                  style={{
                    background: model === m.id ? 'rgba(201,169,110,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${model === m.id ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.05)'}`,
                  }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-fg text-sm font-light">{m.name}</span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-light"
                      style={{ background: m.badgeColor + '20', color: m.badgeColor }}
                    >
                      {m.badge}
                    </span>
                  </div>
                  <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>{m.description}</p>
                  <p className="text-xs" style={{ color: '#c9a96e' }}>{m.cost}</p>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center gap-4 mt-12">
        {step > 0 && (
          <button
            onClick={() => setStep(s => s - 1)}
            className="text-sm transition-colors hover:text-fg"
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            ← 戻る
          </button>
        )}
        <motion.button
          onClick={() => step < steps.length - 1 ? setStep(s => s + 1) : handleComplete()}
          disabled={!canNext()}
          className="px-8 py-3 rounded-full text-sm font-light transition-all duration-200"
          style={{
            background: canNext() ? 'linear-gradient(135deg, #c9a96e, #a07840)' : 'rgba(255,255,255,0.05)',
            color: canNext() ? '#0a0a0f' : '#2a2a4a',
          }}
          whileHover={canNext() ? { scale: 1.02 } : {}}
          whileTap={canNext() ? { scale: 0.98 } : {}}
        >
          {step === steps.length - 1 ? '始める →' : '次へ →'}
        </motion.button>
      </div>
    </motion.div>
  );
}
