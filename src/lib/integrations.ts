// ============================================================
// Slack / Discord 統合ライブラリ
// Webhook ベースの送信 + localStorage 設定管理
// ============================================================

export interface IntegrationConfig {
  id: string;
  kind: 'slack' | 'discord';
  webhookUrl: string;
  channelName: string;
  enabled: boolean;
  brand: string;
  autoSend?: boolean;
}

export interface Brief {
  title: string;
  message: string;
  actions: string[];
  generatedAt: string;
}

const STORAGE_KEY = 'core_integrations_v1';

export function listIntegrations(): IntegrationConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveIntegration(config: IntegrationConfig): void {
  const list = listIntegrations();
  const idx = list.findIndex(i => i.id === config.id);
  if (idx >= 0) {
    list[idx] = config;
  } else {
    list.push(config);
  }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* */ }
}

export function removeIntegration(id: string): void {
  const list = listIntegrations().filter(i => i.id !== id);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* */ }
}

export async function sendBrief(
  integration: IntegrationConfig,
  brief: Brief,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const date = new Date(brief.generatedAt).toLocaleString('ja-JP');
    const actionsText = brief.actions.length > 0
      ? brief.actions.map((a, i) => `${i + 1}. ${a}`).join('\n')
      : 'なし';

    let body: string;

    if (integration.kind === 'slack') {
      body = JSON.stringify({
        text: brief.title,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: brief.title, emoji: true },
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: brief.message },
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*アクション提案*\n${actionsText}` },
          },
          {
            type: 'context',
            elements: [{ type: 'plain_text', text: `CORE Prism · ${date}`, emoji: false }],
          },
        ],
      });
    } else {
      body = JSON.stringify({
        content: `**${brief.title}**`,
        embeds: [
          {
            title: brief.title,
            description: brief.message,
            color: 0xc9a96e,
            fields: brief.actions.length > 0
              ? [{ name: 'アクション提案', value: actionsText }]
              : [],
            footer: { text: `CORE Prism · ${date}` },
          },
        ],
      });
    }

    const res = await fetch(integration.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 100)}` };
    }
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { ok: false, error: msg };
  }
}
