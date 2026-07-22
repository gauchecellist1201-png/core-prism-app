// ============================================================
// masterTap — オーナー限定の隠しログイン (2026-07-22)
//
// 背景: iOS でホーム画面に追加した PWA は Safari と localStorage が別。
// Safari でマスターキーを入れていても PWA 側は「通常ユーザーの1から」に
// なってしまう。そこで LP のロゴを 5 回連続タップ → 鍵入力 → 正解なら
// マスター状態+オンボ済みを一括セットしてリロードする隠し導線を用意する。
// 一般ユーザーには存在が見えず、誤入力しても何も起きない。
// ============================================================
import { useRef, useCallback } from 'react';
import { markOwnerLocal } from './billing';

const TAP_COUNT = 5;
const TAP_WINDOW_MS = 2200;

/** マスター状態 + 初期化スキップ系フラグを一括セット (PWAで「1から」にならないように) */
export function activateMasterEverywhere(): void {
  markOwnerLocal();
  try {
    localStorage.setItem('core_app_entered_v1', 'true');
    localStorage.setItem('core_onboarded_v2', 'true');
    localStorage.setItem('core_wow_seen_prism_v1', '1');
    localStorage.setItem('core_cxo_welcome_seen_v1', '1');
  } catch { /* */ }
}

/**
 * ロゴ等に付ける連打ハンドラを返す。
 *   const tapMaster = useMasterTap();
 *   <span onClick={tapMaster}>…logo…</span>
 */
export function useMasterTap(): () => void {
  const tapsRef = useRef<number[]>([]);
  return useCallback(() => {
    const now = Date.now();
    tapsRef.current = [...tapsRef.current.filter(t => now - t < TAP_WINDOW_MS), now];
    if (tapsRef.current.length < TAP_COUNT) return;
    tapsRef.current = [];
    // prompt はオーナー専用の隠し口。キャンセル/誤入力は無反応 (存在を悟らせない)
    const input = window.prompt('key');
    if (input === 'GAUCHE2026') {
      activateMasterEverywhere();
      window.location.reload();
    }
  }, []);
}
