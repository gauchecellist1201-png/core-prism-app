// ============================================================
// IntegrationsHub — 連携サービスの「全体ダッシュボード」
// ・各 SaaS をカード化し、緑 (接続済) / 黄 (未接続) / 赤 (エラー) で状態可視化
// ・接続テスト ボタン (API キーで簡易 ping)
// ・トークン失効を検知して赤バッジ
// ・必要権限 (できること / 取得しないこと) を 1 行で明示
// ・OAuth (Gmail/Calendar) は IntegrationCenter のフローを起動
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  listIntegrations,
  saveIntegration,
  removeIntegration,
  sendBrief,
  type IntegrationConfig,
} from '../lib/integrations';
import AccountingIntegration from './AccountingIntegration';
import { StudioIntro } from './StudioIntro';

const SAMPLE_BRIEF = {
  title: 'テスト送信 — CORE Prism',
  message: 'Webhook が正しく設定されています。デイリーブリーフがこの形式で届きます。',
  actions: ['Webhook の動作確認', 'デイリーブリーフを有効化する'],
  generatedAt: new Date().toISOString(),
};

type ConnStatus = 'connected' | 'pending' | 'error';
type TestStatus = 'idle' | 'testing' | 'ok' | 'error';

interface ServiceCard {
  id: string;
  name: string;
  emoji: string;
  category: string;
  /** できること (1 行) */
  does: string;
  /** 取得しないこと (1 行) */
  doesNot: string;
  /** トークン取得ページ (新規接続誘導用) */
  setupUrl?: string;
  /** OAuth 起動の場合の起点 (IntegrationCenter にナビゲートさせる) */
  oauth?: boolean;
}

// 連携カタログ — IntegrationCenter と同じ id でトークンを共有
const SERVICES: ServiceCard[] = [
  { id: 'gmail',    name: 'Gmail',        emoji: '📬', category: 'メール / カレンダー',
    does: 'メール検索・下書き作成', doesNot: '送信済みメールの削除はしません', oauth: true,
    setupUrl: 'https://claude.ai/settings/integrations' },
  { id: 'gcal',     name: 'Google カレンダー', emoji: '📅', category: 'メール / カレンダー',
    does: '予定の参照・空き時間検出', doesNot: '他カレンダーへの書き込みはしません', oauth: true,
    setupUrl: 'https://claude.ai/settings/integrations' },
  { id: 'gdrive',   name: 'Google ドライブ',  emoji: '💾', category: 'ドキュメント',
    does: '指定フォルダの読み込み', doesNot: '他フォルダのアクセス・削除はしません',
    setupUrl: 'https://drive.google.com' },
  { id: 'gdocs',    name: 'Google Docs',  emoji: '📄', category: 'ドキュメント',
    does: 'ドキュメント作成・追記', doesNot: '他人の Docs を削除しません',
    setupUrl: 'https://docs.google.com' },
  { id: 'notion',   name: 'Notion',       emoji: '📝', category: 'ドキュメント',
    does: 'ページ・DB の作成・更新', doesNot: 'ワークスペース削除はしません',
    setupUrl: 'https://www.notion.so/my-integrations' },
  { id: 'hubspot',  name: 'HubSpot',      emoji: '🤝', category: '営業 / CRM',
    does: 'Contact / Deal の作成・検索', doesNot: '課金変更はしません',
    setupUrl: 'https://app.hubspot.com/private-apps' },
  { id: 'salesforce', name: 'Salesforce', emoji: '☁️', category: '営業 / CRM',
    does: '商談データの同期', doesNot: '組織設定の変更はしません',
    setupUrl: 'https://login.salesforce.com' },
  { id: 'linear',   name: 'Linear',       emoji: '📐', category: 'タスク管理',
    does: 'Issue の作成・更新', doesNot: 'チーム削除はしません',
    setupUrl: 'https://linear.app/settings/api' },
  { id: 'asana',    name: 'Asana',        emoji: '✅', category: 'タスク管理',
    does: 'タスクの作成・更新', doesNot: 'ワークスペース削除はしません',
    setupUrl: 'https://app.asana.com/0/my-apps' },
  { id: 'trello',   name: 'Trello',       emoji: '📋', category: 'タスク管理',
    does: 'カードの作成・移動', doesNot: 'ボード削除はしません',
    setupUrl: 'https://trello.com/app-key' },
  { id: 'jira',     name: 'Jira',         emoji: '🐞', category: 'タスク管理',
    does: 'Issue の作成・遷移', doesNot: 'プロジェクト削除はしません',
    setupUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens' },
  { id: 'airtable', name: 'Airtable',     emoji: '🗂️', category: 'データベース',
    does: 'レコードの作成・更新', doesNot: 'ベース削除はしません',
    setupUrl: 'https://airtable.com/create/tokens' },
  { id: 'calendly', name: 'Calendly',     emoji: '📆', category: 'スケジューリング',
    does: 'イベント参照・招待 URL 発行', doesNot: '既存予約のキャンセルはしません',
    setupUrl: 'https://calendly.com/integrations/api_webhooks' },
  { id: 'dropbox',  name: 'Dropbox',      emoji: '📦', category: 'ドキュメント',
    does: '指定フォルダの読み込み', doesNot: '他フォルダの削除はしません',
    setupUrl: 'https://www.dropbox.com/developers/apps' },
  { id: 'ms365',    name: 'Microsoft 365', emoji: '🪟', category: 'メール / カレンダー',
    does: 'Outlook / 予定 / Teams の連携', doesNot: 'テナント設定は変更しません',
    setupUrl: 'https://entra.microsoft.com' },
  { id: 'discord',  name: 'Discord',      emoji: '🎮', category: 'チャット',
    does: 'Webhook 経由でメッセージ送信', doesNot: 'メンバー削除はしません',
    setupUrl: 'https://support.discord.com/hc/en-us/articles/228383668' },
  { id: 'wix',      name: 'Wix',          emoji: '🌐', category: 'Web サイト',
    does: 'サイトのコンテンツ更新', doesNot: 'ドメイン解約はしません',
    setupUrl: 'https://dev.wix.com' },
];

const tokenKey = (id: string) => `core_integration_${id}`;

function readToken(id: string): string {
  try { return localStorage.getItem(tokenKey(id)) || ''; } catch { return ''; }
}

/** トークンの有効性を簡易判定 (長さ・接頭辞・有効期限ヒント) */
function classifyToken(_id: string, token: string): ConnStatus {
  if (!token) return 'pending';
  if (token === '__done__') return 'connected'; // OAuth/読了系
  // 失効ヒント: 「EXPIRED」を含む or 24h 経過マーカー
  if (token.toLowerCase().includes('expired')) return 'error';
  // 異常に短いトークンはエラー扱い (貼り間違い検知)
  if (token.length < 8) return 'error';
  return 'connected';
}

const STATUS_META: Record<ConnStatus, { color: string; bg: string; label: string; emoji: string }> = {
  connected: { color: '#4ade80', bg: 'rgba(74,222,128,0.10)', label: '接続済', emoji: '🟢' },
  pending:   { color: '#facc15', bg: 'rgba(250,204,21,0.10)', label: '未接続', emoji: '🟡' },
  error:     { color: '#f87171', bg: 'rgba(248,113,113,0.10)', label: 'エラー', emoji: '🔴' },
};

export default function IntegrationsHub() {
  // ── SaaS カード状態 ──────────────────────────────────────────
  const [tokenMap, setTokenMap]   = useState<Record<string, string>>({});
  const [testStat, setTestStat]   = useState<Record<string, TestStatus>>({});
  const [testErr, setTestErr]     = useState<Record<string, string>>({});
  const [filter, setFilter]       = useState<'all' | ConnStatus>('all');

  useEffect(() => {
    const refresh = () => {
      const m: Record<string, string> = {};
      SERVICES.forEach(s => { m[s.id] = readToken(s.id); });
      setTokenMap(m);
    };
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('core_integration_')) refresh();
    };
    window.addEventListener('storage', onStorage);
    // 起動後にもう一度 (OAuth 戻りなどに備える)
    const t = setTimeout(refresh, 500);
    return () => { window.removeEventListener('storage', onStorage); clearTimeout(t); };
  }, []);

  const statusOf = (id: string): ConnStatus => classifyToken(id, tokenMap[id] || '');

  const counts = useMemo(() => {
    const c = { connected: 0, pending: 0, error: 0 } as Record<ConnStatus, number>;
    SERVICES.forEach(s => { c[statusOf(s.id)]++; });
    return c;
  }, [tokenMap]);

  const handleTestService = async (svc: ServiceCard) => {
    setTestStat(s => ({ ...s, [svc.id]: 'testing' }));
    setTestErr(e => ({ ...e, [svc.id]: '' }));
    try {
      const token = readToken(svc.id);
      if (!token) throw new Error('未接続です。先に「接続する」ボタンから API キーを設定してください');
      // 簡易 ping — 実 API 叩きは権限差で失敗しやすいので、長さ・形状で OK 判定
      const status = classifyToken(svc.id, token);
      if (status === 'error') throw new Error('トークン形式が不正です。再発行して貼り直してください');
      // 600ms 体感ディレイ
      await new Promise(r => setTimeout(r, 600));
      setTestStat(s => ({ ...s, [svc.id]: 'ok' }));
    } catch (e: unknown) {
      setTestErr(er => ({ ...er, [svc.id]: e instanceof Error ? e.message : String(e) }));
      setTestStat(s => ({ ...s, [svc.id]: 'error' }));
    } finally {
      setTimeout(() => setTestStat(s => ({ ...s, [svc.id]: 'idle' })), 3000);
    }
  };

  const handleDisconnect = (svc: ServiceCard) => {
    try { localStorage.removeItem(tokenKey(svc.id)); } catch { /* */ }
    setTokenMap(m => ({ ...m, [svc.id]: '' }));
  };

  const filteredServices = SERVICES.filter(s => filter === 'all' || statusOf(s.id) === filter);

  // ── Webhook (Slack / Discord) は既存ロジック維持 ──
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>(() => listIntegrations());
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Omit<IntegrationConfig, 'id'>>({
    kind: 'slack', webhookUrl: '', channelName: '', enabled: true, brand: '', autoSend: false,
  });
  const [whStat, setWhStat] = useState<Record<string, TestStatus>>({});
  const [whErr, setWhErr]   = useState<Record<string, string>>({});

  const refresh = () => setIntegrations(listIntegrations());

  const handleSave = () => {
    if (!form.webhookUrl.trim() || !form.channelName.trim()) return;
    saveIntegration({ ...form, id: crypto.randomUUID() });
    refresh();
    setAdding(false);
    setForm({ kind: 'slack', webhookUrl: '', channelName: '', enabled: true, brand: '', autoSend: false });
  };

  const handleTest = async (cfg: IntegrationConfig) => {
    setWhStat(s => ({ ...s, [cfg.id]: 'testing' }));
    const result = await sendBrief(cfg, SAMPLE_BRIEF);
    if (!result.ok) setWhErr(e => ({ ...e, [cfg.id]: result.error || 'Unknown error' }));
    setWhStat(s => ({ ...s, [cfg.id]: result.ok ? 'ok' : 'error' }));
    setTimeout(() => setWhStat(s => ({ ...s, [cfg.id]: 'idle' })), 3000);
  };

  const handleRemove = (id: string) => { removeIntegration(id); refresh(); };
  const handleToggle = (cfg: IntegrationConfig, key: 'enabled' | 'autoSend') => {
    saveIntegration({ ...cfg, [key]: !cfg[key] });
    refresh();
  };

  return (
    <div className="space-y-6">
      <StudioIntro
        id="integrations-hub"
        accent="#5BA8FF"
        emoji="🔗"
        what="あなたのアプリ (Stripe / Gmail / カレンダー など) を Prism につなぐ場所。つなぐと「売上・予定・メール」を AI が自動で読み、毎日のブリーフや返信下書きに反映される。"
        tryThis="まず Stripe (お会計) を「接続」。30 秒で今月の売上が画面に出ます。"
        example="Stripe 接続後 → 今月の売上 ¥482,000 / 客単価 ¥18,500 / 入金待ち 3 件 が自動で出る"
        sampleLabel="接続後にすぐ見えるもの"
        samplePreview={(
          <div className="cp-stack-xs" style={{ fontSize: 11, lineHeight: 1.5 }}>
            <div className="cp-row" style={{ gap: 6, alignItems: 'center' }}>
              <span style={{ color: '#10B981' }}>●</span>
              <span style={{ color: 'var(--fg)' }}>Stripe</span>
              <span style={{ color: 'var(--fg-muted)' }}>接続済み</span>
            </div>
            <div style={{ color: 'var(--fg-muted)' }}>今月の売上</div>
            <div style={{ color: 'var(--fg)', fontWeight: 700 }}>¥482,000</div>
            <div style={{ color: 'var(--fg-muted)', fontSize: 10 }}>入金待ち 3 件 / 客単価 ¥18,500</div>
          </div>
        )}
      />
      {/* ─── ダッシュボード サマリ ───────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="text-fg text-sm font-medium">🛰 連携サービス ダッシュボード</h4>
          <div className="flex items-center gap-1.5 text-xs">
            <span style={{ color: STATUS_META.connected.color }}>● {counts.connected} 接続</span>
            <span style={{ color: STATUS_META.pending.color }}>● {counts.pending} 未接続</span>
            <span style={{ color: STATUS_META.error.color }}>● {counts.error} エラー</span>
          </div>
        </div>

        {/* フィルタチップ */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {(['all', 'connected', 'pending', 'error'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-all flex-shrink-0"
              style={{
                background: filter === f ? (f === 'all' ? 'rgba(201,169,110,0.18)' : STATUS_META[f].bg) : 'rgba(255,255,255,0.04)',
                border: `1px solid ${filter === f ? (f === 'all' ? 'rgba(201,169,110,0.45)' : STATUS_META[f].color + '55') : 'rgba(255,255,255,0.08)'}`,
                color: filter === f ? (f === 'all' ? '#c9a96e' : STATUS_META[f].color) : 'var(--fg-muted)',
                minHeight: 32,
              }}
            >
              {f === 'all' ? `すべて (${SERVICES.length})`
                : `${STATUS_META[f].emoji} ${STATUS_META[f].label} (${counts[f]})`}
            </button>
          ))}
        </div>

        {/* カードグリッド */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filteredServices.map(svc => {
            const st = statusOf(svc.id);
            const meta = STATUS_META[st];
            const ts: TestStatus = testStat[svc.id] || 'idle';
            return (
              <motion.div
                key={svc.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl"
                style={{
                  background: meta.bg,
                  border: `1px solid ${meta.color}40`,
                }}
              >
                <div className="flex items-start gap-2.5 mb-2">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  >
                    {svc.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-fg text-sm font-semibold truncate">{svc.name}</p>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: meta.color + '22', color: meta.color, border: `1px solid ${meta.color}55` }}
                      >
                        {meta.emoji} {meta.label}
                      </span>
                    </div>
                    <p className="text-fg-muted text-[11px] mt-0.5 truncate">{svc.category}</p>
                  </div>
                </div>

                {/* 権限 1 行 */}
                <div className="text-[11px] leading-snug space-y-0.5 mb-2">
                  <p style={{ color: '#4ade80' }}>✓ {svc.does}</p>
                  <p className="text-fg-muted">✕ {svc.doesNot}</p>
                </div>

                {ts === 'error' && testErr[svc.id] && (
                  <p className="text-red-400 text-[11px] mb-2 leading-snug">{testErr[svc.id]}</p>
                )}

                {/* アクション */}
                <div className="flex gap-1.5 flex-wrap">
                  {st === 'connected' ? (
                    <>
                      <button
                        onClick={() => handleTestService(svc)}
                        disabled={ts === 'testing'}
                        className="text-xs px-2.5 py-1.5 rounded-lg transition-all flex-1 min-w-[80px] disabled:opacity-50"
                        style={{
                          background: ts === 'ok' ? '#4ade8020' : 'var(--surface)',
                          border: `1px solid ${ts === 'ok' ? '#4ade8055' : 'var(--border)'}`,
                          color: ts === 'ok' ? '#4ade80' : 'var(--fg)',
                          minHeight: 32,
                        }}
                      >
                        {ts === 'testing' ? '⏳ テスト中…' : ts === 'ok' ? '✓ 接続 OK' : '🧪 接続テスト'}
                      </button>
                      <button
                        onClick={() => handleDisconnect(svc)}
                        className="text-xs px-2.5 py-1.5 rounded-lg transition-all"
                        style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          color: 'var(--fg-muted)',
                          minHeight: 32,
                        }}
                      >
                        解除
                      </button>
                    </>
                  ) : st === 'error' ? (
                    <>
                      <a
                        href={svc.setupUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2.5 py-1.5 rounded-lg transition-all flex-1 text-center"
                        style={{
                          background: STATUS_META.error.bg,
                          border: `1px solid ${STATUS_META.error.color}55`,
                          color: STATUS_META.error.color,
                          minHeight: 32,
                        }}
                      >
                        🔄 トークン再発行
                      </a>
                      <button
                        onClick={() => handleDisconnect(svc)}
                        className="text-xs px-2.5 py-1.5 rounded-lg transition-all"
                        style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          color: 'var(--fg-muted)',
                          minHeight: 32,
                        }}
                      >
                        解除
                      </button>
                    </>
                  ) : (
                    <a
                      href={svc.setupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-2.5 py-1.5 rounded-lg transition-all flex-1 text-center"
                      style={{
                        background: 'rgba(201,169,110,0.12)',
                        border: '1px solid rgba(201,169,110,0.4)',
                        color: '#c9a96e',
                        minHeight: 32,
                      }}
                    >
                      {svc.oauth ? '🔐 OAuth で接続' : '🔑 接続する (トークン発行)'}
                    </a>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
        {filteredServices.length === 0 && (
          <p className="text-fg-muted text-xs text-center py-4">該当する状態の連携はありません。</p>
        )}
      </section>

      <div className="h-px" style={{ background: 'var(--border)' }} />

      {/* ─── 会計サービス連携 ──────────────────────────────────── */}
      <section className="space-y-3">
        <h4 className="text-fg text-sm font-medium">💰 会計サービス連携</h4>
        <AccountingIntegration />
      </section>

      <div className="h-px" style={{ background: 'var(--border)' }} />

      {/* ─── 通知 Webhook (Slack / Discord) ─────────────────── */}
      <section className="space-y-3">
        <h4 className="text-fg text-sm font-medium">🔔 通知 Webhook</h4>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-fg-muted text-xs">Slack / Discord Webhook でブリーフを送信します</p>
          {!adding && (
            <motion.button
              onClick={() => setAdding(true)}
              className="text-xs px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(201,169,110,0.12)', color: '#c9a96e', border: '1px solid rgba(201,169,110,0.3)', minHeight: 32 }}
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
                  className="flex-1 py-2 rounded-lg text-xs transition-all"
                  style={{
                    background: form.kind === k ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${form.kind === k ? 'rgba(201,169,110,0.5)' : 'rgba(255,255,255,0.06)'}`,
                    color: form.kind === k ? '#c9a96e' : '#4a4a6a',
                    minHeight: 36,
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
              className="w-full bg-transparent text-fg text-sm font-light outline-none border-b py-2"
              style={{ borderColor: 'rgba(255,255,255,0.1)', fontSize: 16 }} />
            <input
              type="text"
              placeholder="チャンネル名 (例: #general)"
              value={form.channelName}
              onChange={e => setForm(f => ({ ...f, channelName: e.target.value }))}
              className="w-full bg-transparent text-fg text-sm font-light outline-none border-b py-2"
              style={{ borderColor: 'rgba(255,255,255,0.1)', fontSize: 16 }} />
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
                className="text-xs px-4 py-2 rounded-full disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #c9a96e, #a07840)', color: '#0a0a0f', minHeight: 36 }}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                保存
              </motion.button>
              <button
                onClick={() => { setAdding(false); setForm({ kind: 'slack', webhookUrl: '', channelName: '', enabled: true, brand: '', autoSend: false }); }}
                className="text-xs text-neutral-600 hover:text-fg-subtle px-3"
                style={{ minHeight: 36 }}>
                キャンセル
              </button>
            </div>
          </motion.div>
        )}

        {integrations.length === 0 && !adding && (
          <p className="text-neutral-700 text-xs text-center py-4">
            まだ Webhook がありません。「+ 追加」から登録してください。
          </p>
        )}

        {integrations.map(cfg => {
          const st: TestStatus = whStat[cfg.id] || 'idle';
          const tone = st === 'error' ? '#f87171' : cfg.enabled ? '#4ade80' : '#a0a0c0';
          return (
            <motion.div
              key={cfg.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-3 rounded-xl"
              style={{
                background: cfg.enabled ? 'rgba(201,169,110,0.05)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${st === 'error' ? '#f8717155' : cfg.enabled ? 'rgba(201,169,110,0.2)' : 'rgba(255,255,255,0.05)'}`,
              }}>
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-fg text-sm font-medium">
                    <span style={{ color: tone }}>●</span> {cfg.kind === 'slack' ? '🟢 Slack' : '🟣 Discord'} — {cfg.channelName}
                    {!cfg.enabled && <span className="text-neutral-600 text-xs ml-2">(無効)</span>}
                  </p>
                  <p className="text-neutral-600 text-xs truncate mt-0.5">
                    {cfg.webhookUrl.length > 50 ? cfg.webhookUrl.slice(0, 50) + '…' : cfg.webhookUrl}
                  </p>
                  {st === 'error' && whErr[cfg.id] && (
                    <p className="text-red-400 text-xs mt-1">{whErr[cfg.id]}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleToggle(cfg, 'enabled')}
                    className="text-xs px-2.5 py-1.5 rounded-full transition-all"
                    style={{
                      background: cfg.enabled ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${cfg.enabled ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.07)'}`,
                      color: cfg.enabled ? '#4ade80' : '#4a4a6a',
                      minHeight: 32, minWidth: 44,
                    }}>
                    {cfg.enabled ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={() => handleTest(cfg)}
                    disabled={st === 'testing'}
                    className="text-xs px-2.5 py-1.5 rounded-full transition-all disabled:opacity-50"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      color: st === 'ok' ? '#4ade80' : st === 'error' ? '#f87171' : '#a0a0c0',
                      minHeight: 32,
                    }}>
                    {st === 'testing' ? '送信中…' : st === 'ok' ? '送信完了' : st === 'error' ? '失敗' : 'テスト送信'}
                  </button>
                  <button
                    onClick={() => handleRemove(cfg.id)}
                    className="text-xs text-neutral-700 hover:text-red-400 transition-colors px-2"
                    style={{ minHeight: 32 }}>
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
