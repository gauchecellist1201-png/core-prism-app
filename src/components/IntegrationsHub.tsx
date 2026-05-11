import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  listIntegrations,
  saveIntegration,
  removeIntegration,
  sendBrief,
  type IntegrationConfig,
} from '../lib/integrations';
import AccountingIntegration from './AccountingIntegration';

const SAMPLE_BRIEF = {
  title: 'テスト送信 — CORE Prism',
  message: 'Webhook が正しく設定されています。デイリーブリーフがこの形式で届きます。',
  actions: ['Webhook の動作確認', 'デイリーブリーフを有効化する'],
  generatedAt: new Date().toISOString(),
};

type TestStatus = 'idle' | 'sending' | 'ok' | 'error';

export default function IntegrationsHub() {
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>(() => listIntegrations());
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Omit<IntegrationConfig, 'id'>>({
    kind: 'slack',
    webhookUrl: '',
    channelName: '',
    enabled: true,
    brand: '',
    autoSend: false,
  });
  const [testStatus, setTestStatus] = useState<Record<string, TestStatus>>({});
  const [testError, setTestError] = useState<Record<string, string>>({});

  const refresh = () => setIntegrations(listIntegrations());

  const handleSave = () => {
    if (!form.webhookUrl.trim() || !form.channelName.trim()) return;
    saveIntegration({ ...form, id: crypto.randomUUID() });
    refresh();
    setAdding(false);
    setForm({ kind: 'slack', webhookUrl: '', channelName: '', enabled: true, brand: '', autoSend: false });
  };

  const handleTest = async (cfg: IntegrationConfig) => {
    setTestStatus(s => ({ ...s, [cfg.id]: 'sending' }));
    const result = await sendBrief(cfg, SAMPLE_BRIEF);
    if (!result.ok) setTestError(e => ({ ...e, [cfg.id]: result.error || 'Unknown error' }));
    setTestStatus(s => ({ ...s, [cfg.id]: result.ok ? 'ok' : 'error' }));
    setTimeout(() => setTestStatus(s => ({ ...s, [cfg.id]: 'idle' })), 3000);
  };

  const handleRemove = (id: string) => {
    removeIntegration(id);
    refresh();
  };

  const handleToggle = (cfg: IntegrationConfig, key: 'enabled' | 'autoSend') => {
    saveIntegration({ ...cfg, [key]: !cfg[key] });
    refresh();
  };

  return (
    <div className="space-y-6">
      {/* 会計サービス連携 (freee / マネーフォワード / 弥生) */}
      <section className="space-y-3">
        <h4 className="text-fg text-sm font-medium">💰 会計サービス連携</h4>
        <AccountingIntegration />
      </section>

      <div className="h-px" style={{ background: 'var(--border)' }} />

      {/* Slack / Discord Webhook */}
      <section className="space-y-3">
        <h4 className="text-fg text-sm font-medium">🔔 通知 Webhook</h4>
      <div className="flex items-center justify-between">
        <p className="text-fg-muted text-xs">Slack / Discord Webhook でブリーフを送信します</p>
        {!adding && (
          <motion.button
            onClick={() => setAdding(true)}
            className="text-xs px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(201,169,110,0.12)', color: '#c9a96e', border: '1px solid rgba(201,169,110,0.3)' }}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            + 追加
          </motion.button>
        )}
      </div>

      {adding && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl space-y-3"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex gap-2">
            {(['slack', 'discord'] as const).map(k => (
              <button key={k}
                onClick={() => setForm(f => ({ ...f, kind: k }))}
                className="flex-1 py-1.5 rounded-lg text-xs transition-all"
                style={{
                  background: form.kind === k ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${form.kind === k ? 'rgba(201,169,110,0.5)' : 'rgba(255,255,255,0.06)'}`,
                  color: form.kind === k ? '#c9a96e' : '#4a4a6a',
                }}>
                {k === 'slack' ? 'Slack' : 'Discord'}
              </button>
            ))}
          </div>
          <input
            type="url"
            placeholder={form.kind === 'slack'
              ? 'https://hooks.slack.com/services/...'
              : 'https://discord.com/api/webhooks/...'}
            value={form.webhookUrl}
            onChange={e => setForm(f => ({ ...f, webhookUrl: e.target.value }))}
            className="w-full bg-transparent text-fg text-sm font-light outline-none border-b py-1.5"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
          <input
            type="text"
            placeholder="チャンネル名 (例: #general)"
            value={form.channelName}
            onChange={e => setForm(f => ({ ...f, channelName: e.target.value }))}
            className="w-full bg-transparent text-fg text-sm font-light outline-none border-b py-1.5"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.autoSend ?? false}
              onChange={e => setForm(f => ({ ...f, autoSend: e.target.checked }))} />
            <span className="text-fg-muted text-xs">デイリーブリーフを自動送信する</span>
          </label>
          <div className="flex gap-2 pt-1">
            <motion.button
              onClick={handleSave}
              disabled={!form.webhookUrl.trim() || !form.channelName.trim()}
              className="text-xs px-4 py-1.5 rounded-full disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #c9a96e, #a07840)', color: '#0a0a0f' }}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              保存
            </motion.button>
            <button
              onClick={() => { setAdding(false); setForm({ kind: 'slack', webhookUrl: '', channelName: '', enabled: true, brand: '', autoSend: false }); }}
              className="text-xs text-neutral-600 hover:text-fg-subtle">
              キャンセル
            </button>
          </div>
        </motion.div>
      )}

      {integrations.length === 0 && !adding && (
        <p className="text-neutral-700 text-xs text-center py-4">
          まだ連携がありません。「+ 追加」から Webhook を登録してください。
        </p>
      )}

      {integrations.map(cfg => {
        const st: TestStatus = testStatus[cfg.id] || 'idle';
        return (
          <motion.div
            key={cfg.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 rounded-xl"
            style={{
              background: cfg.enabled ? 'rgba(201,169,110,0.05)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${cfg.enabled ? 'rgba(201,169,110,0.2)' : 'rgba(255,255,255,0.05)'}`,
            }}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-fg text-sm font-light">
                  {cfg.kind === 'slack' ? '🟢' : '🟣'} {cfg.channelName}
                  {!cfg.enabled && <span className="text-neutral-600 text-xs ml-2">(無効)</span>}
                </p>
                <p className="text-neutral-600 text-xs truncate mt-0.5">
                  {cfg.webhookUrl.length > 50 ? cfg.webhookUrl.slice(0, 50) + '…' : cfg.webhookUrl}
                </p>
                {st === 'error' && testError[cfg.id] && (
                  <p className="text-red-400 text-xs mt-1">{testError[cfg.id]}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleToggle(cfg, 'enabled')}
                  className="text-xs px-2 py-1 rounded-full transition-all"
                  style={{
                    background: cfg.enabled ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${cfg.enabled ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.07)'}`,
                    color: cfg.enabled ? '#4ade80' : '#4a4a6a',
                  }}>
                  {cfg.enabled ? 'ON' : 'OFF'}
                </button>
                <button
                  onClick={() => handleTest(cfg)}
                  disabled={st === 'sending'}
                  className="text-xs px-2 py-1 rounded-full transition-all disabled:opacity-50"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    color: st === 'ok' ? '#4ade80' : '#a0a0c0',
                  }}>
                  {st === 'sending' ? '送信中…' : st === 'ok' ? '送信完了' : 'テスト'}
                </button>
                <button
                  onClick={() => handleRemove(cfg.id)}
                  className="text-xs text-neutral-700 hover:text-red-400 transition-colors">
                  削除
                </button>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfg.autoSend ?? false}
                  onChange={() => handleToggle(cfg, 'autoSend')} />
                <span className="text-neutral-600 text-xs">デイリーブリーフを自動送信</span>
              </label>
            </div>
          </motion.div>
        );
      })}
      </section>
    </div>
  );
}
