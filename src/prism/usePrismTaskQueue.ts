// ============================================================
// CORE Prism ▸ 音声タスク予約 + 自動実行
// 「今夜8時にチラシ作って」→ AI が時刻と内容をパース→ 予約 →
// 時刻到達で自動実行 → 完了で通知
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'prism_task_queue_v1';

export type TaskKind =
  | 'flyer'        // チラシ / フライヤー
  | 'post'         // SNS 投稿文
  | 'email'        // メール文
  | 'document'     // 文書 / 報告書
  | 'analysis'     // 分析 / レポート
  | 'image_brief'  // 画像生成プロンプト
  | 'reminder'     // 単なるリマインダー
  | 'general';     // 汎用

export type TaskStatus = 'scheduled' | 'running' | 'done' | 'failed' | 'cancelled';

export interface PrismTask {
  id: string;
  createdAt: string;
  scheduledAt: string;       // ISO
  status: TaskStatus;
  kind: TaskKind;
  /** ユーザーが言った原文 (音声 or 手動) */
  rawInput: string;
  /** AI が抽出した内容 */
  title: string;
  description: string;
  /** AI 実行プロンプト */
  prompt: string;
  /** 実行結果 */
  result?: string;
  resultGeneratedAt?: string;
  error?: string;
  /** 通知済か */
  notified?: boolean;
}

function load(): PrismTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PrismTask[];
  } catch { return []; }
}

function persist(list: PrismTask[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {/* */}
}

function makeId() {
  return 't_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// ─── 自然言語 → 時刻パース (AI 経由) ─────
const PARSE_SYSTEM = `あなたは音声入力から「いつ・何をするか」を抽出してJSONで返すパーサーです。
返答は JSON のみ、説明文・コードブロック禁止。

スキーマ:
{
  "scheduledAt": "ISO 8601 文字列 (YYYY-MM-DDTHH:mm:ss+09:00)",
  "kind": "flyer" | "post" | "email" | "document" | "analysis" | "image_brief" | "reminder" | "general",
  "title": "30字以内のタスク名",
  "description": "実行内容の詳細 (60-150字)",
  "prompt": "AI が実行時に使うプロンプト (具体的かつ実行可能、必要な背景情報を含む)"
}

時刻パース規則:
- 「今夜8時」「夜8時」「20時」 → 今日の 20:00 (もし過去なら明日)
- 「明日朝」 → 翌日 8:00
- 「1時間後」「30分後」 → 現在時刻 + その差分
- 「今すぐ」「すぐに」 → 現在時刻 + 1分
- 時刻が明示されない場合 → 現在時刻 + 30分
- タイムゾーンは Asia/Tokyo (+09:00) 固定

kind 推定:
- 「チラシ」「フライヤー」「ポスター」 → flyer
- 「投稿」「SNS」「Instagram」「X」 → post
- 「メール」「返信」 → email
- 「報告書」「議事録」「資料」 → document
- 「分析」「レポート」「調査」 → analysis
- 「画像生成」「イラスト」「絵」 → image_brief
- 「思い出させて」「リマインド」 → reminder
- それ以外 → general`;

// ─── ローカル時刻パーサー (AI 失敗時のフォールバック) ─────
export function parseLocalTime(text: string, now = new Date()): Date {
  const t = text.replace(/\s+/g, ' ');

  // N時間後 / N分後 / N秒後
  let m: RegExpMatchArray | null;
  if ((m = t.match(/(\d+)\s*時間後/))) {
    return new Date(now.getTime() + Number(m[1]) * 3_600_000);
  }
  if ((m = t.match(/(\d+)\s*分後/))) {
    return new Date(now.getTime() + Number(m[1]) * 60_000);
  }
  if ((m = t.match(/(\d+)\s*秒後/))) {
    return new Date(now.getTime() + Number(m[1]) * 1000);
  }
  // 今すぐ / すぐに
  if (/今すぐ|すぐに/.test(t)) {
    return new Date(now.getTime() + 60_000);
  }

  // 「明日朝」「明後日朝」
  const day = /明後日/.test(t) ? 2 : /明日/.test(t) ? 1 : 0;
  // 時:分
  let h: number | null = null;
  let mi = 0;
  if ((m = t.match(/(\d{1,2})\s*時\s*(\d{1,2})\s*分/))) {
    h = Number(m[1]); mi = Number(m[2]);
  } else if ((m = t.match(/(\d{1,2})[:時](\d{2})/))) {
    h = Number(m[1]); mi = Number(m[2]);
  } else if ((m = t.match(/(\d{1,2})\s*時/))) {
    h = Number(m[1]);
  } else if (/朝/.test(t)) {
    h = 8;
  } else if (/昼|お昼/.test(t)) {
    h = 12;
  } else if (/午後|昼過ぎ/.test(t)) {
    h = 14;
  } else if (/夕方/.test(t)) {
    h = 17;
  } else if (/夜/.test(t)) {
    h = 20;
  } else if (/深夜/.test(t)) {
    h = 23;
  }

  if (h !== null) {
    const d = new Date(now);
    d.setDate(d.getDate() + day);
    d.setHours(h, mi, 0, 0);
    // 今日の時刻が既に過去で、明日指定がなければ翌日に
    if (day === 0 && d.getTime() <= now.getTime()) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  }

  // 何もマッチしなければ 30 分後
  return new Date(now.getTime() + 30 * 60_000);
}

// ─── kind 推定 (ローカル) ─────
function guessKindLocal(text: string): TaskKind {
  if (/チラシ|フライヤー|ポスター|ビラ/.test(text)) return 'flyer';
  if (/投稿|SNS|Instagram|インスタ|X|ツイート|TikTok|tiktok/.test(text)) return 'post';
  if (/メール|返信|連絡/.test(text)) return 'email';
  if (/報告書|議事録|資料|文書|レジュメ|ピッチ|スライド|講演|プレゼン|セミナー/.test(text)) return 'document';
  if (/分析|レポート|調査|サマリ/.test(text)) return 'analysis';
  if (/画像|イラスト|絵|ロゴ|バナー|サムネ/.test(text)) return 'image_brief';
  if (/思い出させ|リマインド|アラーム|教えて/.test(text)) return 'reminder';
  return 'general';
}

export async function parseVoiceCommand(rawInput: string, now = new Date()): Promise<{
  scheduledAt: string;
  kind: TaskKind;
  title: string;
  description: string;
  prompt: string;
}> {
  // 1. AI パースを試す
  const userMsg = `現在時刻: ${now.toISOString()} (JST)
入力: ${rawInput}

JSON で返答してください。`;
  let aiErr = '';
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-opus-4-5',  // 互換ハンドル — 実際は Gemini にマップされる
        messages: [{ role: 'user', content: userMsg }],
        system: PARSE_SYSTEM,
        max_tokens: 800,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const text: string =
        (data?.content && Array.isArray(data.content) ? data.content[0]?.text : '') ||
        data?.text || data?.message || '';
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const j = JSON.parse(m[0]);
        return {
          scheduledAt: String(j.scheduledAt),
          kind: (j.kind || guessKindLocal(rawInput)) as TaskKind,
          title: String(j.title || rawInput.slice(0, 30)),
          description: String(j.description || rawInput),
          prompt: String(j.prompt || rawInput),
        };
      }
      aiErr = 'AI 応答に JSON が含まれていません';
    } else {
      const errJson = await res.json().catch(() => null);
      aiErr = errJson?.error?.message || `AI API error: ${res.status}`;
    }
  } catch (e: any) {
    aiErr = e?.message || 'ネットワークエラー';
  }

  // 2. AI が失敗 → ローカルパースでフォールバック (タスクは必ず作成できる)
  console.warn('[Prism Task] AI parse failed, using local parser:', aiErr);
  const scheduled = parseLocalTime(rawInput, now);
  const kind = guessKindLocal(rawInput);
  const title = rawInput.length > 30 ? rawInput.slice(0, 28) + '…' : rawInput;
  return {
    scheduledAt: scheduled.toISOString(),
    kind,
    title,
    description: rawInput,
    prompt: rawInput,
  };
}

// ─── タスク実行 (AI で結果生成) ─────
const EXECUTE_SYSTEMS: Record<TaskKind, string> = {
  flyer: `あなたは敏腕デザイナー兼コピーライター。
チラシ/フライヤーの内容を以下の形式で作成し、最後に Canva / Figma で組むための具体的指示を添える:

# [チラシのキャッチコピー]

## メインビジュアル提案
(具体的なシーン描写、Midjourney/DALL-E プロンプトとして使える形式で1行)

## 本文 (3-5 段落)
...

## 構成案
- 上部 30%: メインビジュアル + キャッチ
- 中央 50%: 本文 + 特典
- 下部 20%: 連絡先 + QR

## 配色 / フォント
- ベース: ...
- アクセント: ...
- 見出し: ...
- 本文: ...`,
  post: `あなたは SNS マーケのプロ。指定の文脈で投稿テキストを作成:
- フックは1行で
- 絵文字 2-5 個
- 改行を活かす
- 末尾にハッシュタグ 5-10 個
- 必要なら CTA`,
  email: `プロフェッショナルなビジネスメール本文を作成:
件名: (具体的)
本文: 適切な敬語 + 改行 + 結びまで`,
  document: `指定の文書を作成。マークダウンで構造化、見出し・箇条書き活用。`,
  analysis: `分析レポートを作成: ## 概要 / ## 主要発見 / ## 詳細分析 / ## 提言 の構成で。`,
  image_brief: `画像生成プロンプトを作成 (英語、Midjourney/DALL-E 向け、cinematic, --ar 16:9 等パラメータ含む)。
日本語訳も併記。`,
  reminder: `リマインダーなので、丁寧に再掲する。`,
  general: `タスクを実行し、結果を Markdown で返却。`,
};

export async function executeTask(task: PrismTask): Promise<string> {
  const system = EXECUTE_SYSTEMS[task.kind] || EXECUTE_SYSTEMS.general;
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      messages: [{ role: 'user', content: task.prompt }],
      system,
      max_tokens: 2500,
    }),
  });
  if (!res.ok) {
    const errJson = await res.json().catch(() => null);
    const msg = errJson?.error?.message || `AI API error: ${res.status}`;
    throw new Error(msg);
  }
  const data = await res.json();
  // Anthropic compatible: { content: [{ type: 'text', text: '...' }] }
  if (Array.isArray(data.content) && data.content[0]?.text) return String(data.content[0].text);
  return String(data.text || data.message || '');
}

// ─── 通知 ─────
async function ensureNotifyPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const p = await Notification.requestPermission();
  return p === 'granted';
}

function fireBrowserNotification(task: PrismTask) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification('Prism タスク完了', {
      body: `${task.title}\n\n` + (task.result?.slice(0, 120) || ''),
      tag: `prism-task-${task.id}`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      requireInteraction: false,
    });
    n.onclick = () => { window.focus(); n.close(); };
  } catch {/* */}
}

function playChime() {
  try {
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    o.start();
    o.stop(ctx.currentTime + 0.6);
    // 2nd tone
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.connect(g2); g2.connect(ctx.destination);
    o2.type = 'sine';
    o2.frequency.value = 1320;
    g2.gain.setValueAtTime(0.0001, ctx.currentTime + 0.25);
    g2.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.27);
    g2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.85);
    o2.start(ctx.currentTime + 0.25);
    o2.stop(ctx.currentTime + 0.85);
  } catch {/* */}
}

// ─── メインフック ─────
export function usePrismTaskQueue() {
  const [tasks, setTasks] = useState<PrismTask[]>(() => load());
  const runningRef = useRef<Set<string>>(new Set());

  // 他タブ更新を反映
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setTasks(load());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // 通知許可は初回 add で要求
  const requestPermission = useCallback(() => ensureNotifyPermission(), []);

  // 期限到来のタスクを自動実行
  useEffect(() => {
    const tick = async () => {
      const now = Date.now();
      const due = tasks.filter(t => t.status === 'scheduled' && new Date(t.scheduledAt).getTime() <= now);
      for (const t of due) {
        if (runningRef.current.has(t.id)) continue;
        runningRef.current.add(t.id);
        // ステータス: running
        setTasks(prev => {
          const next = prev.map(p => p.id === t.id ? { ...p, status: 'running' as TaskStatus } : p);
          persist(next);
          return next;
        });
        executeTask(t).then(result => {
          setTasks(prev => {
            const next = prev.map(p => p.id === t.id ? {
              ...p,
              status: 'done' as TaskStatus,
              result,
              resultGeneratedAt: new Date().toISOString(),
            } : p);
            persist(next);
            // 通知 (まだなら)
            const finished = next.find(p => p.id === t.id);
            if (finished && !finished.notified) {
              fireBrowserNotification(finished);
              playChime();
              const after = next.map(p => p.id === t.id ? { ...p, notified: true } : p);
              persist(after);
              return after;
            }
            return next;
          });
        }).catch(err => {
          setTasks(prev => {
            const next = prev.map(p => p.id === t.id ? {
              ...p,
              status: 'failed' as TaskStatus,
              error: err?.message || '実行エラー',
            } : p);
            persist(next);
            return next;
          });
        }).finally(() => {
          runningRef.current.delete(t.id);
        });
      }
    };
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, [tasks]);

  const add = useCallback((t: Omit<PrismTask, 'id' | 'createdAt' | 'status'>) => {
    void ensureNotifyPermission();
    const item: PrismTask = {
      id: makeId(),
      createdAt: new Date().toISOString(),
      status: 'scheduled',
      ...t,
    };
    setTasks(prev => {
      const next = [item, ...prev];
      persist(next);
      return next;
    });
    return item;
  }, []);

  const update = useCallback((id: string, patch: Partial<PrismTask>) => {
    setTasks(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...patch } : p);
      persist(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setTasks(prev => {
      const next = prev.filter(p => p.id !== id);
      persist(next);
      return next;
    });
  }, []);

  const cancel = useCallback((id: string) => {
    update(id, { status: 'cancelled' });
  }, [update]);

  // 失敗 / 完了 / キャンセル を「もう一度試す」
  const retry = useCallback((id: string, delaySec = 5) => {
    const when = new Date(Date.now() + delaySec * 1000).toISOString();
    setTasks(prev => {
      const next = prev.map(p => p.id === id ? {
        ...p,
        status: 'scheduled' as TaskStatus,
        scheduledAt: when,
        error: undefined,
        result: undefined,
        resultGeneratedAt: undefined,
        notified: false,
      } : p);
      persist(next);
      return next;
    });
  }, []);

  // 完了通知バッジを全て既読化
  const markAllSeen = useCallback(() => {
    setTasks(prev => {
      const next = prev.map(p => p.notified ? p : { ...p, notified: true });
      persist(next);
      return next;
    });
  }, []);

  return { tasks, add, update, remove, cancel, retry, markAllSeen, requestPermission };
}
