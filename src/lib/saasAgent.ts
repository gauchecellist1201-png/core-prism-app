// ============================================================
// SaaS エージェント — AI が外部 SaaS を代理操作する実行プラン生成
// Phase 6: クライアントは「実行プラン + MCP スクリプト」を生成し
//          ユーザーが Claude チャットにコピーして実行する設計。
// Phase 6.5: 自然言語入力から target/action/payload を AI 推定
// TODO Phase 7: Vercel プロキシ経由で MCP-over-HTTP を直接呼び出し
// ============================================================
import type { AppSettings } from '../types/identity';
import { enqueueClaudeCall } from './apiQueue';
import { aiFetch } from './aiFetch';

export type SaasTarget =
  | 'notion'
  | 'slack'
  | 'linear'
  | 'asana'
  | 'trello'
  | 'jira'
  | 'airtable'
  | 'gdocs'
  | 'discord'
  | 'calendly'
  | 'hubspot'
  | 'gmail'
  | 'gdrive'
  | 'wix';

export type SaasAction = 'create' | 'update' | 'append' | 'search' | 'send';

export interface SaasTaskResult {
  target: SaasTarget;
  action: SaasAction;
  planMarkdown: string;
  mcpScript: string;
  estimatedSteps: number;
  generatedAt: string;
}

/** 自然言語から推定された SaaS 操作の意図 */
export interface SaasIntent {
  target: SaasTarget;
  action: SaasAction;
  payload: string;
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
}

export const TARGET_LABELS: Record<SaasTarget, string> = {
  notion:   'Notion',
  slack:    'Slack',
  linear:   'Linear',
  asana:    'Asana',
  trello:   'Trello',
  jira:     'Jira',
  airtable: 'Airtable',
  gdocs:    'Google Docs',
  discord:  'Discord',
  calendly: 'Calendly',
  hubspot:  'HubSpot',
  gmail:    'Gmail',
  gdrive:   'Google Drive',
  wix:      'Wix',
};

export const TARGET_EMOJI: Record<SaasTarget, string> = {
  notion: '📝', slack: '💬', linear: '📐', asana: '✅', trello: '📋',
  jira: '🐞', airtable: '🗂️', gdocs: '📄', discord: '🎮', calendly: '📅',
  hubspot: '🤝', gmail: '📬', gdrive: '💾', wix: '🌐',
};

/** 各 SaaS で「できること / 取得しないこと」を 1 行で */
export const TARGET_PERMISSIONS: Record<SaasTarget, { does: string; doesNot: string }> = {
  notion:   { does: 'ページ作成・更新・検索・コメント追記', doesNot: 'ワークスペース削除や請求情報の閲覧は行いません' },
  slack:    { does: 'Webhook 経由でメッセージ送信', doesNot: 'DM 履歴の読取りや他人投稿の削除は行いません' },
  linear:   { does: 'Issue 作成・更新・コメント', doesNot: 'チーム削除や課金変更は行いません' },
  asana:    { does: 'タスク作成・更新・コメント', doesNot: 'ワークスペース管理や請求変更は行いません' },
  trello:   { does: 'カード作成・移動・コメント', doesNot: 'ボード削除や権限変更は行いません' },
  jira:     { does: 'Issue 作成・遷移・コメント', doesNot: 'プロジェクト削除や管理権限変更は行いません' },
  airtable: { does: 'レコード作成・更新・検索', doesNot: 'ベース削除や課金変更は行いません' },
  gdocs:    { does: '指定フォルダ内のドキュメント作成・更新', doesNot: '他フォルダのファイル閲覧や削除は行いません' },
  discord:  { does: 'Webhook 経由でメッセージ送信', doesNot: 'サーバー設定変更やメンバー削除は行いません' },
  calendly: { does: 'イベントタイプの参照・予約 URL 生成', doesNot: '既存予約のキャンセルや料金変更は行いません' },
  hubspot:  { does: 'Contact / Deal / Note の作成・更新・検索', doesNot: 'アカウント削除や課金変更は行いません' },
  gmail:    { does: 'ラベル付与・下書き作成・スレッド検索', doesNot: '送信済みメールの削除や全文の外部送信は行いません' },
  gdrive:   { does: '指定フォルダ内のファイル一覧・読み取り', doesNot: '他フォルダのアクセスや削除は行いません' },
  wix:      { does: 'サイト管理 API 経由でコンテンツ更新', doesNot: 'ドメイン解約や課金プラン変更は行いません' },
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
  slack: {
    create: 'slack-post-message',
    update: 'slack-update-message',
    append: 'slack-post-thread-reply',
    search: 'slack-search-messages',
    send:   'slack-post-message',
  },
  linear: {
    create: 'linear-create-issue',
    update: 'linear-update-issue',
    append: 'linear-create-comment',
    search: 'linear-search-issues',
    send:   'linear-create-comment',
  },
  asana: {
    create: 'asana-create-task',
    update: 'asana-update-task',
    append: 'asana-add-comment',
    search: 'asana-search-tasks',
    send:   'asana-add-comment',
  },
  trello: {
    create: 'trello-create-card',
    update: 'trello-update-card',
    append: 'trello-add-comment',
    search: 'trello-search-cards',
    send:   'trello-add-comment',
  },
  jira: {
    create: 'jira-create-issue',
    update: 'jira-transition-issue',
    append: 'jira-add-comment',
    search: 'jira-jql-search',
    send:   'jira-add-comment',
  },
  airtable: {
    create: 'airtable-create-record',
    update: 'airtable-update-record',
    append: 'airtable-create-record',
    search: 'airtable-list-records',
    send:   'airtable-create-record',
  },
  gdocs: {
    create: 'gdocs-create-document',
    update: 'gdocs-update-document',
    append: 'gdocs-append-text',
    search: 'gdrive-search-files (mimeType=document)',
    send:   'gdocs-create-document',
  },
  discord: {
    create: 'discord-webhook-post',
    update: 'discord-webhook-edit',
    append: 'discord-webhook-post (thread)',
    search: 'discord-search-messages',
    send:   'discord-webhook-post',
  },
  calendly: {
    create: 'calendly-create-invite-link',
    update: 'calendly-update-event-type',
    append: 'calendly-create-invite-link',
    search: 'calendly-list-event-types',
    send:   'calendly-create-invite-link',
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

const INTENT_SYSTEM_PROMPT = `あなたは「ユーザーの自然言語の依頼」を読み、どの SaaS で何をしたいかを推定するアシスタントです。

# 使える target (どれか 1 つ)
notion, slack, linear, asana, trello, jira, airtable, gdocs, discord, calendly, hubspot, gmail, gdrive, wix

# 使える action (どれか 1 つ)
create (作成), update (更新), append (追記), search (検索), send (送信/下書き)

# 出力形式 (JSON のみ、コードブロック不要)
{
  "target": "notion",
  "action": "append",
  "payload": "依頼を実行プラン生成に渡すための整形済み日本語テキスト (元の依頼を残しつつ、必要なパラメータを箇条書きで補完)",
  "confidence": "high|medium|low",
  "rationale": "なぜこの target/action と判断したかを 30 字以内で"
}

# 判断ルール
- 「Notion / ページ / DB」→ notion、「Slack / チャンネル」→ slack、「Linear / Issue」→ linear、「Asana / タスク」→ asana
- 「Trello / カード / ボード」→ trello、「Jira / バグ / sprint」→ jira、「Airtable / レコード」→ airtable
- 「Google Docs / ドキュメント」→ gdocs、「Discord」→ discord、「Calendly / 予約 / 日程調整」→ calendly
- 「HubSpot / CRM / Contact / Deal」→ hubspot、「Gmail / メール / 下書き」→ gmail、「Drive / ファイル」→ gdrive、「Wix / サイト」→ wix
- 「追加 / 末尾」→ append、「新規 / 作る」→ create、「変える / 修正」→ update、「探す / 一覧」→ search、「送る / 下書き」→ send
- 候補が複数ある場合は最も自然なものを選び confidence を medium 以下に。`;

export async function inferSaasIntent(
  userText: string,
  settings: AppSettings,
): Promise<SaasIntent> {
  const parsed = await enqueueClaudeCall(async () => {
    const res = await aiFetch({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.preferredModel || 'claude-haiku-4-5',
        max_tokens: 512,
        system: INTENT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userText }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(err.error?.message ?? `意図推定エラー: ${res.status}`);
    }
    const data = await res.json() as { content?: { text?: string }[] };
    const text = data.content?.[0]?.text ?? '';
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('意図を解析できませんでした');
    return JSON.parse(m[0]) as SaasIntent;
  });
  // 防衛: 不正な値は notion/create にフォールバック
  if (!(parsed.target in TARGET_LABELS)) parsed.target = 'notion';
  if (!['create', 'update', 'append', 'search', 'send'].includes(parsed.action)) parsed.action = 'create';
  if (!parsed.payload?.trim()) parsed.payload = userText;
  if (!parsed.confidence) parsed.confidence = 'medium';
  return parsed;
}

export async function runSaasTask(
  target: SaasTarget,
  action: SaasAction,
  payload: string,
  settings: AppSettings,
): Promise<SaasTaskResult> {
  const tool = MCP_TOOL_MAP[target]?.[action] ?? 'unknown';
  const targetLabel = TARGET_LABELS[target];

  const userPrompt = `対象 SaaS: ${targetLabel}
操作種別: ${action}
使用する主要 MCP ツール: ${tool}

ユーザーの依頼:
${payload}

上記を実行するための実行プランと、Claude チャットへのコピー用スクリプトを JSON で生成してください。`;

  const parsed = await enqueueClaudeCall(async () => {
    const res = await aiFetch({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
