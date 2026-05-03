import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AppSettings } from '../types/identity';
import { estimateMonthlyCost } from '../hooks/useClaude';

interface Props {
  settings: AppSettings;
  onSave: (s: Partial<AppSettings>) => void;
  onClose: () => void;
  onResetStats: () => void;
}

const MODELS = [
  { id: 'claude-haiku-4-5', name: 'Haiku 4.5', note: '高速・低コスト', input: 1.0, output: 5.0 },
  { id: 'claude-sonnet-4-5', name: 'Sonnet 4.5', note: 'バランス型', input: 3.0, output: 15.0 },
  { id: 'claude-opus-4-5', name: 'Opus 4.5', note: '最高性能', input: 5.0, output: 25.0 },
];

export default function SettingsModal({ settings, onSave, onClose, onResetStats }: Props) {
  const [apiKey, setApiKey] = useState(settings.claudeApiKey);
  const [model, setModel] = useState(settings.preferredModel);
  const [userName, setUserName] = useState(settings.userName);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [tab, setTab] = useState<'general' | 'ai' | 'usage'>('general');

  const monthlyEst = estimateMonthlyCost(20, 800, 400, model);
  const jpy150 = (n: number) => Math.round(n * 150);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-lg m-4 rounded-2xl overflow-hidden"
        style={{ background: '#12121a', border: '1px solid rgba(255,255,255,0.08)' }}
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-fg text-sm font-light tracking-wide">環境設定</p>
          <button onClick={onClose} className="text-neutral-600 hover:text-fg-subtle text-xl">×</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 pb-0">
          {[['general', '一般'], ['ai', 'AIモデル'], ['usage', '使用状況']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id as typeof tab)}
              className="px-3 py-1.5 rounded-lg text-xs transition-all"
              style={{
                background: tab === id ? 'rgba(201,169,110,0.12)' : 'transparent',
                color: tab === id ? '#c9a96e' : '#4a4a6a',
              }}>
              {label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4" style={{ minHeight: '320px' }}>
          <AnimatePresence mode="wait">
            {tab === 'general' && (
              <motion.div key="g" className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div>
                  <p className="text-neutral-600 text-xs tracking-wider uppercase mb-2">お名前</p>
                  <input type="text" value={userName} onChange={e => setUserName(e.target.value)}
                    placeholder="あなたのお名前"
                    className="w-full bg-transparent text-fg text-sm font-light outline-none border-b py-2"
                    style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                </div>
                <div>
                  <p className="text-neutral-600 text-xs tracking-wider uppercase mb-2">Claude APIキー</p>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <input type={apiKeyVisible ? 'text' : 'password'} value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder="sk-ant-..."
                      className="flex-1 bg-transparent text-fg text-sm font-mono outline-none" />
                    <button onClick={() => setApiKeyVisible(!apiKeyVisible)}
                      className="text-neutral-600 text-xs hover:text-fg-subtle">{apiKeyVisible ? '隠す' : '表示'}</button>
                  </div>
                  {apiKey && apiKey.startsWith('sk-ant-') && (
                    <p className="text-xs mt-1" style={{ color: '#34d399' }}>✓ 有効な形式</p>
                  )}
                  <p className="text-neutral-700 text-xs mt-1">
                    <a href="https://console.anthropic.com" target="_blank" className="underline" style={{ color: '#c9a96e' }}>
                      console.anthropic.com
                    </a>{' '}で取得できます
                  </p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    🔒 APIキーはあなたのブラウザ（localStorage）にのみ保存されます。<br />
                    外部サーバーには一切送信されません。
                  </p>
                </div>
              </motion.div>
            )}

            {tab === 'ai' && (
              <motion.div key="ai" className="space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="text-neutral-600 text-xs">20通/日の使用量で試算</p>
                {MODELS.map(m => {
                  const est = estimateMonthlyCost(20, 800, 400, m.id);
                  return (
                    <motion.button key={m.id} onClick={() => setModel(m.id as typeof model)}
                      className="w-full text-left p-3 rounded-xl transition-all"
                      style={{
                        background: model === m.id ? 'rgba(201,169,110,0.08)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${model === m.id ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.05)'}`,
                      }}
                      whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-fg text-sm font-light">{m.name}</p>
                          <p className="text-neutral-500 text-xs">{m.note}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-light" style={{ color: '#c9a96e' }}>
                            ¥{jpy150(est.usd)}/月
                          </p>
                          <p className="text-neutral-700 text-xs">${m.input}/${m.output} per MTok</p>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
                <div className="p-3 rounded-xl" style={{ background: 'rgba(201,169,110,0.05)', border: '1px solid rgba(201,169,110,0.1)' }}>
                  <p className="text-xs" style={{ color: '#c9a96e' }}>
                    選択中: {MODELS.find(m => m.id === model)?.name} —
                    月額API費用 約¥{jpy150(monthlyEst.usd)}
                    （サブスク収入¥1,000との差額 ¥{1000 - jpy150(monthlyEst.usd)} が運営利益）
                  </p>
                </div>
              </motion.div>
            )}

            {tab === 'usage' && (
              <motion.div key="usage" className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: '総メッセージ数', value: `${settings.usageStats.totalMessages}通` },
                    { label: '総トークン数', value: `${(settings.usageStats.totalTokensUsed / 1000).toFixed(1)}K` },
                    { label: 'API使用コスト', value: `$${settings.usageStats.estimatedCostUsd.toFixed(4)}` },
                    { label: '円換算', value: `¥${Math.round(settings.usageStats.estimatedCostUsd * 150)}` },
                  ].map(item => (
                    <div key={item.label} className="p-3 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <p className="text-neutral-600 text-xs mb-1">{item.label}</p>
                      <p className="text-fg text-base font-extralight">{item.value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-neutral-700 text-xs">
                  集計開始: {new Date(settings.usageStats.lastReset).toLocaleDateString('ja-JP')}
                </p>

                {/* Pricing reference */}
                <div className="p-3 rounded-xl space-y-2"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <p className="text-neutral-500 text-xs font-light">モデル別料金（2025年4月現在）</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-neutral-700">
                        <td>モデル</td><td className="text-right">Input</td><td className="text-right">Output</td>
                      </tr>
                    </thead>
                    <tbody className="text-fg-subtle">
                      {MODELS.map(m => (
                        <tr key={m.id}>
                          <td className="py-0.5">{m.name}</td>
                          <td className="text-right">${m.input}/MTok</td>
                          <td className="text-right">${m.output}/MTok</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-neutral-700 text-xs">キャッシュ読込: 90%引き</p>
                </div>

                <button onClick={onResetStats}
                  className="text-xs text-neutral-700 hover:text-red-400 transition-colors">
                  使用統計をリセット
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Save */}
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-600 hover:text-fg-subtle transition-colors">
            キャンセル
          </button>
          <motion.button
            onClick={() => { onSave({ claudeApiKey: apiKey, preferredModel: model as AppSettings['preferredModel'], userName }); onClose(); }}
            className="px-6 py-2 rounded-lg text-sm font-light"
            style={{ background: 'linear-gradient(135deg, #c9a96e, #a07840)', color: '#0a0a0f' }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            保存
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
