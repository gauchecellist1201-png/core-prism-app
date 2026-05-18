// ============================================================
// clipboard — コピーは必ず「できた / できなかった」を画面に出す。
// 沈黙する失敗をなくし、失敗したときは次の手 (手でコピー) を案内する。
// ============================================================
import { notifyInApp } from './inAppNotify';
import { triggerHaptic } from './haptic';

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 下の execCommand にフォールバック
  }
  // 古い端末・非 HTTPS 環境ではこちら
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * テキストをコピーし、結果を必ずトーストで知らせる。
 * 失敗しても黙らない — 手でコピーする方法を案内する。
 * @param text コピーする中身
 * @param label 何をコピーしたか (例: 「本文」「リンク」)。トーストに出す
 * @param opts silentSuccess: 呼び出し側が独自の成功表示を持つときは成功トーストを出さない
 * @returns コピーできたら true
 */
export async function copyText(
  text: string,
  label = '内容',
  opts?: { silentSuccess?: boolean },
): Promise<boolean> {
  const ok = await writeClipboard(text);
  if (ok) {
    triggerHaptic('success');
    if (!opts?.silentSuccess) {
      notifyInApp({ kind: 'success', title: `${label}をコピーしました`, duration: 2500 });
    }
  } else {
    triggerHaptic('error');
    notifyInApp({
      kind: 'warn',
      title: 'コピーできませんでした',
      body: `${label}を長押しして選び、手でコピーしてください`,
      duration: 6000,
    });
  }
  return ok;
}
