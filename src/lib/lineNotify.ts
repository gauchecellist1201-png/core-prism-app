// ============================================================
// lineNotify — Prism がやったことを、公式LINEへ届ける
//
// オーナー要望 2026-07-26:
//   「prismのタスクや実行内容をLINEと連携してLINEに飛ばすようにしたい」
//
// ★設計の要点
//   ・連携センターで保存した公式LINEのトークンをそのまま使う
//     （保存形式は "token" もしくは "token|userId"）
//   ・LINEの無料メッセージ数を無駄打ちしないため、既定はOFF。
//     オーナーが明示的にONにしたときだけ送る。
//   ・同じ内容を二重に送らない（タスクIDで送信済みを記録）
//   ・失敗しても画面の動作は絶対に止めない（通知はベストエフォート）
// ============================================================

const LINE_TOKEN_KEY = 'core_integration_line';
const ENABLED_KEY = 'core_line_notify_enabled_v1';
const SENT_KEY = 'core_line_notify_sent_v1';

export interface LineCreds {
  token: string;
  /** 任意。無ければ broadcast（友だち全員）で届く。 */
  userId?: string;
}

/** 連携センターが保存した値から、トークンと（あれば）userIdを取り出す。 */
export function loadLineCreds(): LineCreds | null {
  try {
    const raw = localStorage.getItem(LINE_TOKEN_KEY) || '';
    if (!raw || raw === '__done__') return null;
    const [token, userId] = raw.split('|');
    if (!token || token.length < 50) return null;
    return { token, userId: userId || undefined };
  } catch {
    return null;
  }
}

/** LINEにつながっているか（通知を出せる状態か）。 */
export function isLineConnected(): boolean {
  return loadLineCreds() !== null;
}

/** 通知を送る設定になっているか（既定はOFF＝勝手に無料枠を使わない）。 */
export function isLineNotifyEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setLineNotifyEnabled(on: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
  } catch {
    /* noop */
  }
}

/** 同じ知らせを二度送らないための記録（最新100件だけ持つ）。 */
function alreadySent(key: string): boolean {
  try {
    const arr: string[] = JSON.parse(localStorage.getItem(SENT_KEY) || '[]');
    return Array.isArray(arr) && arr.includes(key);
  } catch {
    return false;
  }
}
function markSent(key: string): void {
  try {
    const arr: string[] = JSON.parse(localStorage.getItem(SENT_KEY) || '[]');
    const next = [key, ...(Array.isArray(arr) ? arr : [])].slice(0, 100);
    localStorage.setItem(SENT_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
}

export interface NotifyResult {
  ok: boolean;
  /** 送らなかった理由（未接続 / OFF / 送信済み）。エラーとは区別する。 */
  skipped?: 'not-connected' | 'disabled' | 'duplicate';
  message?: string;
}

/**
 * LINEへ1通送る。
 * @param text  送る本文
 * @param dedupeKey 同じ知らせを二度送らないためのキー（タスクID等）。省略時は重複判定しない。
 * @param force 設定OFFでも送る（「テスト送信」ボタン用）
 */
export async function notifyLine(
  text: string,
  dedupeKey?: string,
  force = false,
): Promise<NotifyResult> {
  const creds = loadLineCreds();
  if (!creds) return { ok: false, skipped: 'not-connected' };
  if (!force && !isLineNotifyEnabled()) return { ok: false, skipped: 'disabled' };
  if (dedupeKey && alreadySent(dedupeKey)) return { ok: false, skipped: 'duplicate' };

  try {
    const res = await fetch('/api/integrations/line-notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-line-token': creds.token,
        ...(creds.userId ? { 'x-line-userid': creds.userId } : {}),
      },
      body: JSON.stringify({ text }),
    });
    const j = await res.json().catch(() => ({}) as { ok?: boolean; message?: string });
    if (res.ok && j?.ok) {
      if (dedupeKey) markSent(dedupeKey);
      return { ok: true };
    }
    return { ok: false, message: j?.message || `LINEへ送れませんでした (HTTP ${res.status})` };
  } catch {
    return { ok: false, message: 'ネットワークエラーでLINEへ送れませんでした。' };
  }
}

/** AI役員のタスクが終わったときの文面を作る。 */
export function formatTaskDone(task: {
  id: string;
  title: string;
  summary?: string;
  steps?: Array<{ cxo?: string; output?: string }>;
}): string {
  const lines: string[] = [];
  lines.push('CORE Prism — AI役員が仕事を終えました');
  lines.push('');
  lines.push(`【${task.title}】`);
  if (task.summary) lines.push(task.summary);

  const done = (task.steps || []).filter((s) => s.output);
  if (done.length > 0) {
    lines.push('');
    lines.push('担当した役員:');
    for (const s of done.slice(0, 6)) {
      const who = s.cxo || '担当';
      // 長い成果物はここでは要約せず、頭だけ見せてアプリで読ませる
      const head = String(s.output || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      lines.push(`・${who}：${head}${head.length >= 60 ? '…' : ''}`);
    }
  }
  lines.push('');
  lines.push('続きはPrismで確認できます。');
  return lines.join('\n');
}
