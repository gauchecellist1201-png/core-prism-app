// ============================================================
// SaaS エージェント — AI が外部 SaaS を代理操作する実行プラン生成
// Phase 6: クライアントは「実行プラン + MCP スクリプト」を生成し
//          ユーザーが Claude チャットにコピーして実行する設計。
// TODO Phase 7: Vercel プロキシ経由で MCP-over-HTTP を直接呼び出し
// ============================================================
import type { AppSettings } from '../types/identity';
import { enqueueClaudeCall } from './apiQueue';

export type SaasTarget = 'notion' | 'hubspot' | 'gmail' | 'gdrive' | 'wix';
export type SaasAction = 'create' | 'update' | 'append' | 'search' | 'send';

export interface SaasTaskResult {
  target: SaasTarget;
  action: SaasAction;
  planMarkdown: string;
  mcpScript: string;
  estimatedSteps: number;
  generatedAt: string;
}

export const TARGET_LABELS: Record<SaasTarget, string> = {
  notion: 'Notion',
  hubspot: 'HubSpot',
  gmail: 'Gmail',
  gdrive: 'Google Drive',
  wix: 'Wix',
};

// 各 SaaS × アクションに対応する MCP ツール名
const MCP_TOOL_MAP: Record<SaasTarget, Record<SaasAction, string>> = {
  notion: {
    create: 'notion-create-pages',
    update: 'notion-update-page',
    append: 'notion-create-pages (parent_page_id 指定)',
    search: 'notion-search',
    send:   'notion-create-comment',
  },
  hubspot: {
    create: 'mcp__HubSpot__manage_crm_objects { action: "create" }',
    update: 'mcp__HubSpot__manage_crm_objects { action: "update" }',
    append: 'mcp__HubSpot__manage_crm_objects { action: "create" }',
    search: 'mcp__HubSpot__search_crm_objects',
    send:   'mcp__HubSpot__submit_feedback',
  },
  gmail: {
    create: 'mcp__Gmail__create_draft',
    update: 'mcp__Gmail__label_message',
    append: 'mcp__Gmail__create_draft',
    search: 'mcp__Gmail__search_threads',
    send:   'mcp__Gmail__create_draft (複数件)',
  },
  gdrive: {
    create: 'mcp__Google_Drive__create_file',
    update: 'mcp__Google_Drive__create_file (上書き)',
    append: 'mcp__Google_Drive__create_file',
    search: 'mcp__Google_Drive__search_files',
    send:   'mcp__Google_Drive__copy_file',
  },
  wix: {
    create: 'mcp__Wix__ManageWixSite',
    update: 'mcp__Wix__ManageWixSite',
    append: 'mcp__Wix__ExecuteWixAPI',
    search: 'mcp__Wix__SearchWixRESTDocumentation',
    send:   'mcp__Wix__CallWixSiteAPI',
  },
};

const SYSTEM_PROMPT = `あなたは SaaS 操作エージェントの設計者です。ユーザーの依頼を受け、MCP コネクター経由で Claude チャットから実行できる「実行プラン」と「コピー用スクリプト」を生成します。

# 出力形式 (JSONのみ、コードブロック不要)
{
  "planMarkdown": "## 実行プラン\\n\\n### ステップ 1: ...\\n説明文\\n\\n### ステップ 2: ...\\n説明文\\n",
  "mcpScript": "Claude チャットにそのまま貼り付けられる指示文 (ツール名・パラメータを明記した自然語)",
  "estimatedSteps": ステップ数 (number, 1-10)
}

# ルール
- planMarkdown: ユーザーが理解しやすいマークダウン手順書。各ステップに使用 MCP ツール名を明記。
- mcpScript: 「以下のタスクを MCP ツールを使って実行してください:」で始め、各操作を箇条書きで記述。ツール名を \`コードスパン\` で記載。
- 両方とも日本語で回答。
- 実現不可な操作は警告として planMarkdown に追記 (⚠ マーク)。`;

export async function runSaasTask(
  target: SaasTarget,
  action: SaasAction,
  payload: string,
  settings: AppSettings,
): Promise<SaasTaskResult> {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY || settings.claudeApiKey || '';
  if (!apiKey) {
    throw new Error('Claude API キーが設定されていません。設定 → 一般 → Claude API Key を入力してください。');
  }

  const tool = MCP_TOOL_MAP[target]?.[action] ?? 'unknown';
  const targetLabel = TARGET_LABELS[target];

  const userPrompt = `対象 SaaS: ${targetLabel}
操作種別: ${action}
使用する主要 MCP ツール: ${tool}

ユーザーの依頼:
${payload}

上記を実行するための実行プランと、Claude チャットへのコピー用スクリプトを JSON で生成してください。`;

  const parsed = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: settings.preferredModel || 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(err.error?.message ?? `SaaS エージェント エラー: ${res.status}`);
    }

    const data = await res.json() as { content?: { text?: string }[] };
    const text = data.content?.[0]?.text ?? '';

    let result: { planMarkdown: string; mcpScript: string; estimatedSteps: number } = {
      planMarkdown: `## 実行プラン\n\n${text}`,
      mcpScript: text,
      estimatedSteps: 3,
    };
    try {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) result = JSON.parse(m[0]);
    } catch { /* fallback to raw text */ }

    return result;
  });

  return {
    target,
    action,
    planMarkdown: parsed.planMarkdown,
    mcpScript: parsed.mcpScript,
    estimatedSteps: parsed.estimatedSteps,
    generatedAt: new Date().toISOString(),
  };
}
