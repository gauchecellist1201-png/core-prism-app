// ============================================================
// useSupportChat — グローバルAIサポートチャット (Wix「アリア」相当)
// アプリ全体で使えるオフトピックも歓迎するヘルパーAI
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { enqueueClaudeCall } from '../lib/apiQueue';

export type SupportBrand = 'prism' | 'iris';

export interface SupportMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

export interface SupportContext {
  brand: SupportBrand;
  page?: string;
  personaName?: string;
  taskCount?: number;
  knowledgeCount?: number;
  dealCount?: number;
}

const KEY_MESSAGES = 'core_support_chat_v1';
const KEY_OPEN = 'core_support_open_v1';

function loadMessages(): SupportMessage[] {
  try {
    const raw = localStorage.getItem(KEY_MESSAGES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMessages(msgs: SupportMessage[]) {
  try {
    // 直近 50 件だけ保存 (容量対策)
    const trimmed = msgs.slice(-50);
    localStorage.setItem(KEY_MESSAGES, JSON.stringify(trimmed));
  } catch {
    /* noop */
  }
}

function loadOpen(): boolean {
  return localStorage.getItem(KEY_OPEN) === 'true';
}
function saveOpen(open: boolean) {
  localStorage.setItem(KEY_OPEN, open ? 'true' : 'false');
}

function buildSystemPrompt(ctx: SupportContext): string {
  const brandName = ctx.brand === 'iris' ? 'CORE Iris (アイリス)' : 'CORE Prism (プリズム)';
  const aiName = ctx.brand === 'iris' ? 'アイリス' : 'プリズム';
  const targetUser =
    ctx.brand === 'iris'
      ? 'インフルエンサー (案件・投稿・コミュニティ運営)'
      : '事業家 (経営・営業・財務・人材)';

  const ctxLines: string[] = [];
  if (ctx.page) ctxLines.push(`- 現在のページ: ${ctx.page}`);
  if (ctx.personaName) ctxLines.push(`- 有効なペルソナ: ${ctx.personaName}`);
  if (typeof ctx.taskCount === 'number') ctxLines.push(`- 今日のタスク: ${ctx.taskCount}件`);
  if (typeof ctx.knowledgeCount === 'number') ctxLines.push(`- ナレッジ: ${ctx.knowledgeCount}件`);
  if (typeof ctx.dealCount === 'number') ctxLines.push(`- CRM案件: ${ctx.dealCount}件`);

  return `あなたは「${aiName}」。${brandName} のサポートAI。
ユーザー (${targetUser}) がアプリを使う中で困ったとき・機能を探したいとき・戦略相談したいときに気軽に質問できる相棒です。

## 現在のコンテキスト
${ctxLines.join('\n') || '- 特になし'}
- 今日: ${new Date().toLocaleDateString('ja-JP')}

## 回答スタイル
- 短く具体的に (基本 200 字以内)。長文が必要なときだけ段落分け
- 機能の場所を聞かれたら「右上の◯◯ボタン」「Cmd+K で横断検索」のように UI 上の位置を含めて案内
- ステップ手順は番号付き
- AI機能で詰まったら「設定 → マスターモードを ON」を案内 (オーナー限定キーで Claude API に切替わる)
- 専門用語は噛み砕く
- 絵文字は控えめ (1メッセージ 0〜1個)
- 不明なときは推測せず「ちょっと分かりませんが、設定から問い合わせ可能です」と返す

## やってはいけないこと
- 投資・税務・法律の確定的助言 (一般論まではOK)
- ユーザーの個人情報を要求する
- 過度に長い回答 (要約して)`;
}

export function useSupportChat(ctx: SupportContext) {
  const [messages, setMessages] = useState<SupportMessage[]>(() => loadMessages());
  const [open, setOpenState] = useState<boolean>(() => loadOpen());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  const setOpen = useCallback((v: boolean) => {
    setOpenState(v);
    saveOpen(v);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;
      setError(null);

      const userMsg: SupportMessage = {
        id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        role: 'user',
        content: trimmed,
        ts: Date.now(),
      };
      const next = [...messages, userMsg];
      setMessages(next);
      setIsLoading(true);

      try {
        const reply = await enqueueClaudeCall(async () => {
          // 直近 12 メッセージだけ送る (コスト対策)
          const history = next.slice(-12).map(m => ({ role: m.role, content: m.content }));
          const res = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              model: 'claude-haiku-4-5',
              max_tokens: 800,
              system: buildSystemPrompt(ctx),
              messages: history,
            }),
          });
          if (!res.ok) {
            let msg = `HTTP ${res.status}`;
            try {
              const data = await res.json();
              msg = data.userMessage || data.error || data.message || msg;
            } catch {
              /* ignore */
            }
            throw new Error(msg);
          }
          const data = await res.json();
          const text = data?.content?.[0]?.text || data?.message || '';
          return text || 'すみません、応答を取得できませんでした。';
        });

        setMessages(prev => [
          ...prev,
          {
            id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            role: 'assistant',
            content: reply,
            ts: Date.now(),
          },
        ]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : '不明なエラー';
        setError(msg);
        setMessages(prev => [
          ...prev,
          {
            id: `a_err_${Date.now()}`,
            role: 'assistant',
            content: `⚠️ 応答できませんでした\n${msg}\n\n少し待ってから再送するか、設定 → マスターモードを ON にしてください。`,
            ts: Date.now(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, ctx],
  );

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, open, setOpen, isLoading, error, send, clear };
}
