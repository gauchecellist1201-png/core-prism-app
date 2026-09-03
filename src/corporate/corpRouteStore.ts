// ============================================================
// corpRouteStore — /corp でいま開いているタブを、CoreSite の外（App.tsx 側の追従CTA）へ伝える小箱。
// finderStore と同じ理由（Context で木を包むと他ルートに影響する）。
// ============================================================
import { useSyncExternalStore } from 'react';
import type { CoreTabKey } from './CoreSite';

let current: CoreTabKey = 'home';
const subs = new Set<() => void>();

export function setCorpTab(next: CoreTabKey) {
  if (current === next) return;
  current = next;
  subs.forEach(fn => fn());
}
function subscribe(fn: () => void) { subs.add(fn); return () => { subs.delete(fn); }; }
export function useCorpTab(): CoreTabKey {
  return useSyncExternalStore(subscribe, () => current, () => 'home');
}
