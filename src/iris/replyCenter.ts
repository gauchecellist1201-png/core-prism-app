// ============================================================
// CORE Iris — 返信センター クライアントロジック
//
// - /api/instagram/comments からコメント一覧を取得
// - /api/instagram/comment-reply で返信を実送信 (必ず人間の確認後)
// - AI 返信下書きは /api/ai 経由。「あなたの核」を憑依させる。
// - プラン配置: 一覧閲覧=全プラン / AI 下書き=ai-chat 枠を消費
//   (Lite 月 30 回 / Standard 以上 無制限 — 既存慣行と同じ)
// ============================================================
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { readCreatorCoreContextSync } from './irisCore';

// ── 型 ──────────────────────────────────────────────────────
export interface ReplyComment {
  id: string;
  text: string;
  username: string;
  timestamp: string;
  likeCount: number;
  repliedByMe: boolean;
}

export interface ReplyMediaItem {
  mediaId: string;
  caption: string;
  mediaType: string;
  permalink: string;
  thumbnailUrl: string;
  timestamp: string;
  comments: ReplyComment[];
}

export type FetchCommentsResult =
  | { ok: true; username: string; items: ReplyMediaItem[]; checkedMediaCount: number }
  | { ok: false; reason: 'not_connected' | 'graph_failed' | 'network' | 'unknown'; message: string };

export type SendReplyResult =
  | { ok: true; replyId: string }
  | { ok: false; message: string };

// ── コメント一覧取得 ────────────────────────────────────────
export async function fetchRecentComments(): Promise<FetchCommentsResult> {
  try {
    const res = await fetchWithTimeout('/api/instagram/comments', { method: 'GET' }, 30000);
    if (res.status === 401) {
      return { ok: false, reason: 'not_connected', message: 'Instagram が未連携です。OAuth 連携するとコメントを読み込めます。' };
    }
    if (!res.ok) {
      return { ok: false, reason: 'graph_failed', message: `Instagram からの取得に失敗しました (HTTP ${res.status})。少し待ってから再読み込みしてください。` };
    }
    const data = await res.json() as { username?: string; items?: ReplyMediaItem[]; checkedMediaCount?: number };
    return {
      ok: true,
      username: data.username || '',
      items: Array.isArray(data.items) ? data.items : [],
      checkedMediaCount: data.checkedMediaCount || 0,
    };
  } catch {
    return { ok: false, reason: 'network', message: '通信できませんでした。電波の良いところで再読み込みしてください。' };
  }
}

// ── 返信の実送信 (自動送信はしない — UI 側で必ず確認後に呼ぶ) ──
export async function sendCommentReply(commentId: string, message: string): Promise<SendReplyResult> {
  const body = (message || '').trim();
  if (!body) return { ok: false, message: '返信が空です。ひとこと書いてから送信してください。' };
  try {
    const res = await fetchWithTimeout('/api/instagram/comment-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId, message: body }),
    }, 30000);
    if (res.status === 401) {
      return { ok: false, message: 'Instagram の連携が切れています。再連携してから送信してください。' };
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({} as { detail?: string }));
      return { ok: false, message: `送信に失敗しました (HTTP ${res.status})。${err?.detail ? '' : '数秒おいて再試行してください。'}` };
    }
    const data = await res.json() as { ok?: boolean; replyId?: string };
    if (!data.ok) return { ok: false, message: '送信結果を確認できませんでした。Instagram アプリでも確認してください。' };
    return { ok: true, replyId: data.replyId || '' };
  } catch {
    return { ok: false, message: '通信エラーで送信できませんでした。電波を確認して再試行してください。' };
  }
}

// ── AI 返信下書き (/api/ai 経由・サーバ鍵) ─────────────────
export async function generateReplyDraft(input: {
  commentText: string;
  commenterName: string;
  postCaption?: string;
  myHandle?: string;
}): Promise<{ ok: true; draft: string } | { ok: false; message: string }> {
  const core = readCreatorCoreContextSync();
  const system = `あなたは Instagram クリエイター本人としてコメントに返信する専属アシスタント。
${core ? core + '\n' : ''}ルール:
- 1〜3 文の短い返信。絵文字は 1 つまで。
- コメントの内容に具体的に触れる (テンプレ感を出さない)。
- 営業っぽくしない。ファンとの距離を縮める温度感で。
- 返答は返信本文のみ (前置き・カギ括弧・説明を付けない)。`;
  const user = `# 投稿キャプション (抜粋)
${(input.postCaption || '').slice(0, 300) || '(なし)'}

# ${input.commenterName || 'ファン'} さんからのコメント
${(input.commentText || '').slice(0, 500)}

このコメントへの返信を 1 案ください。`;
  try {
    const res = await fetchWithTimeout('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 300,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    }, 35000);
    if (!res.ok) {
      return { ok: false, message: `AI が応答できませんでした (HTTP ${res.status})。数秒おいてもう一度お試しください。` };
    }
    const data = await res.json();
    const raw: string = data?.content?.[0]?.text ?? '';
    const draft = raw.trim().replace(/^["「『]|["」』]$/g, '');
    if (!draft) return { ok: false, message: 'AI の下書きが空でした。もう一度生成してください。' };
    return { ok: true, draft };
  } catch {
    return { ok: false, message: '通信エラーで下書きを作れませんでした。電波を確認して再試行してください。' };
  }
}

// ── アカウント別「返信済み」ローカル記録 ────────────────────
// (Graph の replies 判定に加え、送信直後の即時反映用。アカウント別に分離)
const DONE_KEY_PREFIX = 'core_iris_reply_done_v1:';

function doneKey(accountId: string): string {
  return DONE_KEY_PREFIX + (accountId || 'default');
}

export function loadRepliedIds(accountId: string): Set<string> {
  try {
    const raw = localStorage.getItem(doneKey(accountId));
    const arr = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr)) return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch { /* */ }
  return new Set();
}

export function markReplied(accountId: string, commentId: string) {
  try {
    const set = loadRepliedIds(accountId);
    set.add(commentId);
    // 直近 300 件だけ保持 (肥大防止)
    localStorage.setItem(doneKey(accountId), JSON.stringify(Array.from(set).slice(-300)));
  } catch { /* quota */ }
}
