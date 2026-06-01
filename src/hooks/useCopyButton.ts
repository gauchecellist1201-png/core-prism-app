// ============================================================
// useCopyButton — 「📋 コピー」ボタンの中で完結するごほうび演出
//
// 既存の lib/clipboard.copyText() はトーストで「コピーしました」を出すが、
// ボタン自体は変化しないので、押した瞬間の手応えが弱い。
// このフックは、ボタンの中で
//   ・ラベルが「✓ コピーしました」に切り替わり
//   ・data-copied="true" が付き、緑のグロー + チェックの描き起こしが走る
//   ・1.6 秒後に元に戻る
// を 1 行で扱えるようにする。
//
// 使い方:
//   const { copied, copy } = useCopyButton();
//   <button onClick={() => copy(text, '本文')} data-copied={copied} className="cp-btn cp-copy-btn">
//     {copied ? <><Check size={14} /> コピーしました</> : <><Copy size={14} /> コピー</>}
//   </button>
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { copyText } from '../lib/clipboard';

const RESET_MS = 1600;

export function useCopyButton(): {
  copied: boolean;
  copy: (text: string, label?: string) => Promise<boolean>;
} {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
  }, []);

  const copy = useCallback(async (text: string, label = '内容'): Promise<boolean> => {
    // ボタン自身がフィードバックを出すので、グローバルトーストは出さない (二重通知の不快さを避ける)
    const ok = await copyText(text, label, { silentSuccess: true });
    if (ok) {
      setCopied(true);
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), RESET_MS);
    }
    return ok;
  }, []);

  return { copied, copy };
}
