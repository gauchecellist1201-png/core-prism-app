import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Persona, AppSettings } from '../types/identity';
import {
  runSaasTask,
  TARGET_LABELS,
  type SaasTarget,
  type SaasAction,
  type SaasTaskResult,
} from '../lib/saasAgent';
import ApiErrorCard from './ApiErrorCard';

interface Props {
  persona: Persona;
  settings: AppSettings;
  onClose: () => void;
}

// ─── 3 デモシナリオ ──────────────────────────────────────────────────────────
const DEMO_SCENARIOS: {
  id: string;
  emoji: string;
  label: string;
  desc: string;
  target: SaasTarget;
  action: SaasAction;
  payload: string;
}[] = [
  {
    id: 'notion-postmortem',
    emoji: '📝',
    label: 'Notion: 今週のポストモーテムをデータベースに追加',
    desc: '障害・失敗の振り返りを Notion に自動記録',
    target: 'notion',
    action: 'append',
    payload:
      '今週 (2026-05-11～2026-05-17) のポストモーテムを Notion の「振り返り」データベースに追加してください。\n' +
      'タイトル: API レイテンシ増大\n' +
      '原因: DB インデックス欠落によるフルスキャン\n' +
      '対策: 複合インデックス追加 + P99 レイテンシ監視アラート設定\n' +
      '重大度: Medium\n' +
      '担当者: エンジニアチーム',
  },
  {
    id: 'hubspot-contacts',
    emoji: '🤝',
    label: 'HubSpot: 議事録から contact を作成',
    desc: 'ミーティング出席者を CRM に自動登録し Deal を紐付け',
    target: 'hubspot',
    action: 'create',
    payload:
      '先日の商談ミーティングの議事録をもとに HubSpot の Contact を作成してください。\n' +
      '出席者:\n' +
      '  - 田中 太郎 (tanaka@acme.co.jp、ACME 株式会社、営業部長)\n' +
      '  - 佐藤 花子 (sato@acme.co.jp、ACME 株式会社、CTO)\n' +
      'Contact 登録後、関連 Deal「ACME 導入提案 ¥5,000,000」を作成し、\n' +
      'ステージ「提案中」で紐付けてください。',
  },
  {
    id: 'gmail-summary',
    emoji: '📬',
    label: 'Gmail: 未読をサマリして 5 件返信下書き',
    desc: '重要メールを AI が分析し返信下書きを Gmail に保存',
    target: 'gmail',
    action: 'send',
    payload:
      '今週の未読メールを検索し、重要度の高い上位 5 件に返信下書きを作成してください。\n' +
      '優先キーワード: 「提案」「見積」「契約」「急ぎ」\n' +
      '下書きは丁寧なビジネス文体で作成し、Gmail の下書きフォルダに保存してください。\n' +
      'サマリとして「今週の要対応メール一覧」も合わせて出力してください。',
  },
];

const TARGET_OPTIONS: { value: SaasTarget; label: string; emoji: string }[] = [
  { value: 'notion',  label: 'Notion',       emoji: '📝' },
  { value: 'hubspot', label: 'HubSpot CRM',  emoji: '🤝' },
  { value: 'gmail',   label: 'Gmail',        emoji: '📬' },
  { value: 'gdrive',  label: 'Google Drive', emoji: '💾' },
  { value: 'wix',     label: 'Wix',          emoji: '🌐' },
];

const ACTION_OPTIONS: { value: SaasAction; label: string }[] = [
  { value: 'create', label: '作成 (create)' },
  { value: 'update', label: '更新 (update)' },
  { value: 'append', label: '追記 (append)' },
  { value: 'search', label: '検索 (search)' },
  { value: 'send',   label: '送信 / 下書き (send)' },
];

const MCP_CONNECTOR_URLS: Record<SaasTarget, string> = {
  notion:  'https://claude.ai/settings/integrations (Notion MCP)',
  hubspot: 'https://claude.ai/settings/integrations (HubSpot MCP)',
  gmail:   'https://claude.ai/settings/integrations (Gmail MCP)',
  gdrive:  'https://claude.ai/settings/integrations (Google Drive MCP)',
  wix:     'https://claude.ai/settings/integrations (Wix MCP)',
};

export default function SaasAgentStudio({ persona, settings, onClose }: Props) {
  // ステップ: 'input' | 'plan' | 'guide'
  const [step, setStep]         = useState<'input' | 'plan' | 'guide'>('input');
  const [target, setTarget]     = useState<SaasTarget>('notion');
  const [action, setAction]     = useState<SaasAction>('create');
  const [payload, setPayload]   = useState('');
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [result, setResult]     = useState<SaasTaskResult | null>(null);
  const [copied, setCopied]     = useState<'plan' | 'script' | null>(null);

  const handleDemoSelect = useCallback((s: typeof DEMO_SCENARIOS[number]) => {
    setTarget(s.target);
    setAction(s.action);
    setPayload(s.payload);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!payload.trim()) { setError('やりたいことを入力してください'); return; }
    setBusy(true); setError(null);
    try {
      const r = await runSaasTask(target, action, payload, settings);
      setResult(r);
      setStep('plan');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [target, action, payload, settings]);

  const copyText = useCallback(async (text: string, kind: 'plan' | 'script') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* clipboard unavailable */ }
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-2xl flex flex-col rounded-2xl overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', maxHeight: 'calc(100dvh - 2rem)' }}
        initial={{ scale: 0.96, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 16 }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <p className="text-fg text-base font-semibold">🤖 SaaS エージェント</p>
            <p className="text-fg-muted text-xs mt-0.5">
              AI が Notion / HubSpot / Gmail などを代理操作する実行プランを生成
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-surface-3 text-fg-muted hover:text-fg"
          >
            ✕
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          {(['input', 'plan', 'guide'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  background: step === s ? persona.accentColor : (
                    (['input', 'plan', 'guide'] as const).indexOf(step) > i
                      ? persona.accentColor + '60'
                      : 'var(--surface-3)'
                  ),
                  color: step === s ? '#fff' : 'var(--fg-muted)',
                }}
              >
                {i + 1}
              </div>
              <span className="text-xs" style={{ color: step === s ? persona.accentColor : 'var(--fg-muted)' }}>
                {s === 'input' ? '依頼入力' : s === 'plan' ? '実行プラン' : 'Claude で実行'}
              </span>
              {i < 2 && <span className="text-fg-subtle text-xs">→</span>}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          <AnimatePresence mode="wait">

            {/* ── STEP 1: INPUT ── */}
            {step === 'input' && (
              <motion.div
                key="input"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                {/* Demo scenarios */}
                <div>
                  <p className="text-fg text-sm font-medium mb-2">💡 デモシナリオから選ぶ</p>
                  <div className="space-y-2">
                    {DEMO_SCENARIOS.map(s => (
                      <motion.button
                        key={s.id}
                        onClick={() => handleDemoSelect(s)}
                        className="w-full text-left p-3 rounded-xl transition-all"
                        style={{
                          background: payload === s.payload ? persona.accentColorLight : 'var(--surface-3)',
                          border: `1px solid ${payload === s.payload ? persona.accentColor + '60' : 'var(--border)'}`,
                        }}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <p className="text-fg text-sm font-medium">{s.emoji} {s.label}</p>
                        <p className="text-fg-muted text-xs mt-0.5">{s.desc}</p>
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
                  <span className="text-fg-muted text-xs">または自由入力</span>
                  <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
                </div>

                {/* Target + Action selectors */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-fg-muted text-xs mb-1">対象 SaaS</p>
                    <select
                      value={target}
                      onChange={e => setTarget(e.target.value as SaasTarget)}
                      className="w-full px-3 py-2 rounded-lg text-sm text-fg"
                      style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
                    >
                      {TARGET_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.emoji} {o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-fg-muted text-xs mb-1">操作</p>
                    <select
                      value={action}
                      onChange={e => setAction(e.target.value as SaasAction)}
                      className="w-full px-3 py-2 rounded-lg text-sm text-fg"
                      style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
                    >
                      {ACTION_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Payload textarea */}
                <div>
                  <p className="text-fg-muted text-xs mb-1">やりたいことを自然語で入力</p>
                  <textarea
                    value={payload}
                    onChange={e => setPayload(e.target.value)}
                    placeholder={`例: 今週の商談を HubSpot に 5 件作って、それぞれ「提案中」ステージに設定してください。`}
                    rows={6}
                    className="w-full px-3 py-2 rounded-lg text-sm text-fg resize-none"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
                  />
                </div>

                <ApiErrorCard error={error} onRetry={handleGenerate} variant="auto" />


                <motion.button
                  onClick={handleGenerate}
                  disabled={busy || !payload.trim()}
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all"
                  style={{
                    background: busy || !payload.trim()
                      ? 'var(--surface-3)'
                      : `linear-gradient(135deg, ${persona.accentColor}, ${persona.accentColor}cc)`,
                    color: busy || !payload.trim() ? 'var(--fg-muted)' : '#fff',
                  }}
                  whileHover={!busy && payload.trim() ? { scale: 1.01 } : {}}
                  whileTap={!busy && payload.trim() ? { scale: 0.99 } : {}}
                >
                  {busy ? '🧠 プランを生成中…' : '✨ 実行プランを生成'}
                </motion.button>
              </motion.div>
            )}

            {/* ── STEP 2: PLAN ── */}
            {step === 'plan' && result && (
              <motion.div
                key="plan"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-fg text-sm font-medium">
                    {TARGET_OPTIONS.find(o => o.value === result.target)?.emoji}{' '}
                    {TARGET_LABELS[result.target]} — {result.estimatedSteps} ステップ
                  </p>
                  <button
                    onClick={() => setStep('input')}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-surface-3 text-fg-muted"
                  >
                    ← 戻る
                  </button>
                </div>

                {/* Execution Plan */}
                <div
                  className="p-4 rounded-xl"
                  style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-fg text-sm font-medium">📋 実行プラン</p>
                    <button
                      onClick={() => copyText(result.planMarkdown, 'plan')}
                      className="text-xs px-2.5 py-1 rounded-lg transition-all"
                      style={{
                        background: copied === 'plan' ? persona.accentColorLight : 'var(--surface)',
                        border: `1px solid ${copied === 'plan' ? persona.accentColor + '60' : 'var(--border)'}`,
                        color: copied === 'plan' ? persona.accentColor : 'var(--fg-muted)',
                      }}
                    >
                      {copied === 'plan' ? '✓ コピー済み' : '📋 コピー'}
                    </button>
                  </div>
                  <pre
                    className="text-fg-muted text-xs whitespace-pre-wrap font-mono leading-relaxed"
                    style={{ maxHeight: '200px', overflowY: 'auto' }}
                  >
                    {result.planMarkdown}
                  </pre>
                </div>

                {/* MCP Script */}
                <div
                  className="p-4 rounded-xl"
                  style={{
                    background: `${persona.accentColor}0a`,
                    border: `1px solid ${persona.accentColor}30`,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-fg text-sm font-medium">🤖 Claude チャット用スクリプト</p>
                    <button
                      onClick={() => copyText(result.mcpScript, 'script')}
                      className="text-xs px-2.5 py-1 rounded-lg font-medium transition-all"
                      style={{
                        background: copied === 'script' ? persona.accentColor : persona.accentColorLight,
                        border: `1px solid ${persona.accentColor}60`,
                        color: copied === 'script' ? '#fff' : persona.accentColor,
                      }}
                    >
                      {copied === 'script' ? '✓ コピー済み！' : '📋 スクリプトをコピー'}
                    </button>
                  </div>
                  <pre
                    className="text-xs whitespace-pre-wrap font-mono leading-relaxed"
                    style={{ color: persona.accentColor, maxHeight: '180px', overflowY: 'auto' }}
                  >
                    {result.mcpScript}
                  </pre>
                </div>

                <motion.button
                  onClick={() => setStep('guide')}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white"
                  style={{ background: `linear-gradient(135deg, ${persona.accentColor}, ${persona.accentColor}cc)` }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  Claude チャットで実行する方法を見る →
                </motion.button>
              </motion.div>
            )}

            {/* ── STEP 3: GUIDE ── */}
            {step === 'guide' && result && (
              <motion.div
                key="guide"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-fg text-sm font-medium">🚀 Claude チャットで実行する手順</p>
                  <button
                    onClick={() => setStep('plan')}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-surface-3 text-fg-muted"
                  >
                    ← プランに戻る
                  </button>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      step: 1,
                      title: 'MCP コネクターを有効化',
                      desc: `claude.ai の設定 → 統合 (Integrations) から「${TARGET_LABELS[result.target]}」コネクターを ON にしてください。`,
                      emoji: '🔌',
                    },
                    {
                      step: 2,
                      title: 'Claude チャットを開く',
                      desc: 'claude.ai/new で新しいチャットを開いてください。',
                      emoji: '💬',
                    },
                    {
                      step: 3,
                      title: 'スクリプトを貼り付けて送信',
                      desc: '「スクリプトをコピー」ボタンでコピーしたテキストをチャットに貼り付けて送信すると、AI が MCP ツールを呼び出して自動実行します。',
                      emoji: '📋',
                    },
                  ].map(item => (
                    <div
                      key={item.step}
                      className="flex gap-3 p-3 rounded-xl"
                      style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: persona.accentColorLight, color: persona.accentColor }}
                      >
                        {item.step}
                      </div>
                      <div>
                        <p className="text-fg text-sm font-medium">{item.emoji} {item.title}</p>
                        <p className="text-fg-muted text-xs mt-0.5 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Connector URL hint */}
                <div
                  className="p-3 rounded-xl text-xs"
                  style={{
                    background: `${persona.accentColor}08`,
                    border: `1px solid ${persona.accentColor}20`,
                    color: 'var(--fg-muted)',
                  }}
                >
                  <span style={{ color: persona.accentColor }}>💡 MCP コネクター:</span>{' '}
                  {MCP_CONNECTOR_URLS[result.target]}
                </div>

                <div
                  className="p-3 rounded-xl text-xs"
                  style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg-muted)' }}
                >
                  <p className="font-medium text-fg mb-1">⚡ Phase 7 ロードマップ</p>
                  <p>将来バージョンでは Vercel プロキシ経由で MCP-over-HTTP を直接呼び出し、このアプリ内で SaaS 操作が完結する予定です。</p>
                </div>

                {/* Re-copy button */}
                <motion.button
                  onClick={() => copyText(result.mcpScript, 'script')}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
                  style={{
                    background: copied === 'script' ? persona.accentColor : persona.accentColorLight,
                    color: copied === 'script' ? '#fff' : persona.accentColor,
                    border: `1px solid ${persona.accentColor}40`,
                  }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  {copied === 'script' ? '✓ コピー済み！' : '📋 スクリプトをもう一度コピー'}
                </motion.button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
