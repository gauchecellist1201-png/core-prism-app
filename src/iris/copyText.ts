// ============================================================
// copyText — Iris 共通の「必ず成功に近づける」コピー処理
//
// navigator.clipboard は https + 対応ブラウザ限定。古い iPhone や
// アプリ内ブラウザ (Instagram 内蔵ブラウザ等) では失敗するため、
// 非対応/失敗時は textarea + execCommand のフォールバックで救済する。
// 戻り値 true = ユーザーの端末に本当にコピーできた (数字嘘禁止と同じ精神)。
// ============================================================
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* フォールバックへ */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
