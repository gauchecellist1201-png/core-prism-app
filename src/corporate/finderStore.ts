// ============================================================
// finderStore — 3問診断がいま「どのサービスを薦めているか」を、
// ページ下の追従CTA（LpStickyCta）へ伝えるためだけの、小さな共有箱。
//
// なぜ要るか（2026-08-08 夜間アップグレードで実測）:
//   診断の結果を見ている人の画面でも、追従バーは「3問で選ぶ」のままだった。
//   もう終わった作業への案内が、決断にいちばん近い67pxを占有し、
//   さらに結果カードの「◯◯ も見てみる →」ボタンを物理的に覆っていた。
//
//   ServiceFinder は CoreSite の中、追従CTAは App.tsx 側にいるため props では渡せない。
//   Context を通すには /corp の木を丸ごと包む必要があり、他ルートにも影響するので、
//   「今の一手だけを持つ」極小の外部ストアにした。
// ============================================================
import { useSyncExternalStore } from 'react';

export type FinderPick = { name: string; url: string } | null;

let current: FinderPick = null;
const subscribers = new Set<() => void>();

export function setFinderPick(next: FinderPick) {
  if (current?.name === next?.name && current?.url === next?.url) return;
  current = next;
  subscribers.forEach(fn => fn());
}

function subscribe(fn: () => void) {
  subscribers.add(fn);
  return () => { subscribers.delete(fn); };
}

export function useFinderPick(): FinderPick {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
