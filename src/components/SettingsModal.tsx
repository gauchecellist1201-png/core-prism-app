import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AppSettings } from '../types/identity';
import { estimateMonthlyCost } from '../hooks/useClaude';
import { OPENAI_VOICE_OPTIONS, isOpenAITTSConfigured, type OpenAIVoice } from '../lib/ttsOpenAI';
import { resetOnboarding } from '../lib/onboarding';
import IntegrationsHub from './IntegrationsHub';

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
  const [aiTone, setAiTone] = useState<'gentle' | 'professional' | 'casual'>(settings.aiTone || 'gentle');
  const [voiceEnabled, setVoiceEnabled] = useState(settings.voiceEnabled !== false);
  const [openaiVoice, setOpenaiVoice] = useState<OpenAIVoice>((settings as any).openaiVoice || 'nova');
  const openaiAvailable = isOpenAITTSConfigured();
  const [tab, setTab] = useState<'general' | 'ai' | 'voice' | 'usage' | 'integrations'>('general');

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
        <div className="flex items-center justify-between p-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-fg text-sm font-light tracking-wide">環境設定</p>
          <button onClick={onClose} className="text-neutral-600 hover:text-fg-subtle text-xl">×</button>
        </div>

        <div className="flex gap-1 px-5 pt-3 pb-0">
          {[['general', '一般'], ['ai', 'AI設定'], ['voice', '音声'], ['usage', '使用状況'], ['integrations', '連携']].map(([id, label]) => (
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
                <MasterModeBox />
                <div className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <p className="text-fg text-sm">ガイドツアーを再表示</p>
                    <p className="text-neutral-600 text-xs mt-0.5">オンボーディングウィザードをリセットします</p>
                  </div>
                  <motion.button
                    onClick={() => { resetOnboarding(); window.location.reload(); }}
                    className="text-xs px-3 py-1.5 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(201,169,110,0.12)', color: '#c9a96e', border: '1px solid rgba(201,169,110,0.3)' }}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    再表示
                  </motion.button>
                </div>
                <div className="p-4 rounded-xl" style={{
                  background: 'linear-gradient(135deg, rgba(46,111,255,0.08), rgba(232,75,151,0.08))',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}>
                  <p className="text-fg text-sm font-medium mb-2">✨ AI は自動で動きます</p>
                  <p className="text-fg-muted text-xs leading-relaxed">
                    API キー不要。サーバー側の Gemini で自動処理されます。<br />
                    すぐに、戦略・交渉・分析・美容相談を始められます。
                  </p>
                </div>
                <details className="text-xs">
                  <summary className="cursor-pointer text-neutral-700 hover:text-fg-subtle">
                    Anthropic Claude キーを直接入力 (上級者向け)
                  </summary>
                  <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <input type={apiKeyVisible ? 'text' : 'password'} value={apiKey === 'proxy' ? '' : apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder="sk-ant-..."
                      className="flex-1 bg-transparent text-fg text-sm font-mono outline-none" />
                    <button onClick={() => setApiKeyVisible(!apiKeyVisible)}
                      className="text-neutral-600 text-xs hover:text-fg-subtle">{apiKeyVisible ? '隠す' : '表示'}</button>
                  </div>
                </details>
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
                <div className="pt-4">
                  <p className="text-neutral-600 text-xs tracking-wider uppercase mb-2">AI の文体</p>
                  <p className="text-fg-muted text-xs mb-3">提案・要約・返信ドラフトの語り口を選べます</p>
                  <div className="space-y-2">
                    {([
                      { v: 'gentle', t: '🌸 やさしく (推奨)', d: '一文短く、専門用語に必ず日本語補足、励ます語り口' },
                      { v: 'professional', t: '💼 プロ調', d: '簡潔・論理的、専門用語OK、断定的' },
                      { v: 'casual', t: '☕ カジュアル', d: 'フランクで親しみやすい、絵文字少しあり' },
                    ] as const).map(opt => (
                      <button key={opt.v} onClick={() => setAiTone(opt.v)}
                        className="w-full text-left p-3 rounded-xl transition-all"
                        style={{
                          background: aiTone === opt.v ? 'rgba(180,124,252,0.10)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${aiTone === opt.v ? 'rgba(180,124,252,0.50)' : 'rgba(255,255,255,0.06)'}`,
                        }}>
                        <p className="text-fg text-sm font-light">{opt.t}</p>
                        <p className="text-fg-muted text-xs mt-0.5">{opt.d}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {tab === 'voice' && (
              <motion.div key="voice" className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="p-3 rounded-xl" style={{ background: openaiAvailable ? 'rgba(180,124,252,0.10)' : 'rgba(255,255,255,0.02)', border: `1px solid ${openaiAvailable ? 'rgba(180,124,252,0.40)' : 'rgba(255,255,255,0.06)'}` }}>
                  <p className="text-fg text-sm font-medium mb-1">
                    {openaiAvailable ? '🎤 OpenAI TTS が有効です' : '🔒 OpenAI TTS 未設定 (ブラウザ標準音声で再生)'}
                  </p>
                  <p className="text-fg-muted text-xs leading-relaxed">
                    {openaiAvailable
                      ? 'ChatGPT クラスの自然な音声で読み上げます。プランや時間帯に応じて声色を選べます。'
                      : 'VITE_OPENAI_API_KEY を設定すると、ChatGPT 並みの自然な音声に切り替わります。未設定でもブラウザ標準音声で動作します。'}
                  </p>
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={voiceEnabled} onChange={e => setVoiceEnabled(e.target.checked)} />
                    <span className="text-fg text-sm">音声読み上げを有効にする</span>
                  </label>
                  <p className="text-fg-muted text-xs mt-1 ml-6">「読み上げ」ボタンで提案・議事録・チャット応答を音声化</p>
                </div>
                {openaiAvailable && voiceEnabled && (
                  <div>
                    <p className="text-neutral-600 text-xs tracking-wider uppercase mb-2">声を選ぶ</p>
                    <div className="grid grid-cols-2 gap-2">
                      {OPENAI_VOICE_OPTIONS.map(v => (
                        <button key={v.value} onClick={() => setOpenaiVoice(v.value)}
                          className="text-left p-2.5 rounded-lg transition-all"
                          style={{
                            background: openaiVoice === v.value ? 'rgba(180,124,252,0.10)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${openaiVoice === v.value ? 'rgba(180,124,252,0.50)' : 'rgba(255,255,255,0.06)'}`,
                          }}>
                          <p className="text-fg text-sm font-medium">{v.label}</p>
                          <p className="text-fg-muted text-xs mt-0.5">{v.tone}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {tab === 'integrations' && (
              <motion.div key="integrations" className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <IntegrationsHub />
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

        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-600 hover:text-fg-subtle transition-colors">
            キャンセル
          </button>
          <motion.button
            onClick={() => {
              onSave({
                claudeApiKey: apiKey,
                preferredModel: model as AppSettings['preferredModel'],
                userName,
                aiTone,
                voiceEnabled,
                ...({ openaiVoice } as any),
              });
              onClose();
            }}
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

function MasterModeBox() {
  const KEY = 'core_master_key_v1';
  const [code, setCode] = useState(() => localStorage.getItem(KEY) || '');
  const [edit, setEdit] = useState(false);
  const isMaster = code === 'GAUCHE2026';

  const apply = () => {
    localStorage.setItem(KEY, code);
    setEdit(false);
    setTimeout(() => window.location.reload(), 200);
  };
  const clear = () => {
    localStorage.removeItem(KEY);
    setCode('');
    setEdit(false);
    setTimeout(() => window.location.reload(), 200);
  };

  return (
    <div className="p-4 rounded-xl" style={{
      background: isMaster
        ? 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,107,53,0.10))'
        : 'rgba(255,255,255,0.03)',
      border: `1px solid ${isMaster ? 'rgba(255,215,0,0.35)' : 'rgba(255,255,255,0.08)'}`,
    }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-fg text-sm font-medium">
          {isMaster ? '👑 マスターモード ON (Claude API)' : '⚙ マスターモード'}
        </p>
        {isMaster && (
          <button onClick={clear}
            className="text-xs px-2 py-1 rounded-full"
            style={{ background: 'rgba(248,113,113,0.15)', color: '#F87171', border: '1px solid rgba(248,113,113,0.3)' }}>
            解除
          </button>
        )}
      </div>
      {isMaster ? (
        <p className="text-fg-muted text-xs leading-relaxed">
          オーナー専用モード。すべての AI が Anthropic Claude (高品質) で動作します。
        </p>
      ) : edit ? (
        <div className="space-y-2">
          <input
            type="text" value={code} onChange={e => setCode(e.target.value)}
            placeholder="マスターキーを入力"
            className="w-full bg-transparent text-fg text-sm font-mono outline-none border-b py-2"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          />
          <div className="flex gap-2">
            <button onClick={apply} disabled={!code.trim()}
              className="text-xs px-3 py-1.5 rounded-full disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #FFD60A, #FF8A1A)', color: '#1F1A2E', fontWeight: 700 }}>
              適用 (リロード)
            </button>
            <button onClick={() => { setCode(''); setEdit(false); }}
              className="text-xs px-3 py-1.5 rounded-full text-fg-muted">
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEdit(true)} className="text-xs text-fg-muted hover:text-fg-subtle underline">
          マスターキーを入力 →
        </button>
      )}
    </div>
  );
}
