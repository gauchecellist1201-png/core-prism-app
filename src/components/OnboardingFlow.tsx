import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AppSettings } from '../types/identity';
import { INDUSTRY_LIST, type IndustryId } from '../prism/industryPacks';

interface Props {
  onComplete: (settings: Partial<AppSettings>) => void;
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

// 環境変数にAPIキーが設定されていれば入力不要
const HAS_ENV_API_KEY = !!import.meta.env.VITE_CLAUDE_API_KEY;

export default function OnboardingFlow({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState<string>('claude-haiku-4-5');
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [industry, setIndustry] = useState<IndustryId | ''>('');

  // ENV有: 0=welcome, 1=name, 2=industry, 3=model
  // ENV無: 0=welcome, 1=name, 2=industry, 3=apikey, 4=model
  const steps = HAS_ENV_API_KEY
    ? [
        { title: 'ようこそ', subtitle: 'CORE Identity OS へ' },
        { title: 'あなたのお名前', subtitle: '最初の一歩' },
        { title: '業種を選ぶ', subtitle: 'AIをあなたの業界に最適化' },
        { title: 'AIモデル選択', subtitle: '予算と性能のバランス' },
      ]
    : [
        { title: 'ようこそ', subtitle: 'CORE Identity OS へ' },
        { title: 'あなたのお名前', subtitle: '最初の一歩' },
        { title: '業種を選ぶ', subtitle: 'AIをあなたの業界に最適化' },
        { title: 'Claude APIキー', subtitle: 'AIを接続する' },
        { title: 'AIモデル選択', subtitle: '予算と性能のバランス' },
      ];

  const handleComplete = () => {
    onComplete({
      userName: name,
      claudeApiKey: apiKey,
      preferredModel: model as AppSettings['preferredModel'],
      industry: (industry || undefined) as AppSettings['industry'],
      onboardingComplete: true,
    });
  };

  const logicalStep = step;
  const isNameStep = logicalStep === 1;
  const isIndustryStep = logicalStep === 2;
  const isApiKeyStep = !HAS_ENV_API_KEY && logicalStep === 3;
  const isModelStep = HAS_ENV_API_KEY ? logicalStep === 3 : logicalStep === 4;

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
            <p className="text-neutral-500 text-sm tracking-widest uppercase mb-8">Prism OS</p>
            <h2 className="text-fg text-2xl font-extralight mb-4 leading-relaxed">
              あなたの複数の人格を、<br />ひとつのOSで統合する。
            </h2>
            <p className="text-neutral-600 text-sm font-light leading-relaxed mb-12">
              事業ごとに人格を作り、<br />
              それぞれに専用のAI・ナレッジ・カレンダーを持つ。<br />
              「今日は誰として在るか」を、システムが支える。
            </p>
            <div className="grid grid-cols-3 gap-3 mb-12 text-center">
              {['AIアシスタント', 'ナレッジRAG', 'カレンダー連携'].map((f, i) => (
                <div key={i} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-xs text-neutral-500 font-light">{f}</p>
                </div>
              ))}
            </div>
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
            <p className="text-neutral-600 text-xs mb-8">AIがあなたに合わせた対話を行います</p>
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
            <p className="text-neutral-700 text-xs">Enterでも次へ進めます</p>
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
            <p className="text-neutral-600 text-xs mb-6 leading-relaxed">
              業界に合わせて AI が「その業界の人がわかる言葉」で提案します。<br />
              KPI・悩み・施策・専門用語をあらかじめ AI に教えておくため、
              いきなり実用レベルの相談相手になります。
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
                    <p className="text-neutral-500 text-[11px] leading-snug mb-2">
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
              <p className="text-neutral-500 text-xs mt-4">
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
            <p className="text-neutral-600 text-xs mb-6 leading-relaxed">
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
                className="text-neutral-600 text-xs hover:text-fg-subtle"
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
              <p className="text-xs text-neutral-500 font-light leading-relaxed">
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
            <p className="text-neutral-600 text-xs mb-6">あとから設定で変更できます</p>
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
                  <p className="text-neutral-500 text-xs mb-1">{m.description}</p>
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
            className="text-neutral-600 text-sm hover:text-fg-subtle transition-colors"
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
