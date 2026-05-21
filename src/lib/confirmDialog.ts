// ============================================================
// confirmDialog — window.confirm の置換
// OS のグレーの箱（ブラウザ標準ダイアログ）を追放し、
// 画面の世界観をそのままに、上質なカードで「OK?」を尋ねる。
// 使い方:
//   const ok = await confirmAction({ title: '削除しますか?', tone: 'danger' });
//   if (!ok) return;
// ============================================================

export type ConfirmTone = 'normal' | 'danger';

export interface ConfirmDetail {
  title: string;
  body?: string;
  /** 既定: 'OK' */
  okLabel?: string;
  /** 既定: 'キャンセル' */
  cancelLabel?: string;
  /** 'danger' を渡すと OK ボタンが赤＋強めの触感に */
  tone?: ConfirmTone;
}

interface InternalDetail extends ConfirmDetail {
  __id: number;
  __resolve: (ok: boolean) => void;
}

const EVENT_NAME = 'core:confirm';
let counter = 0;
let mountCount = 0;

/** ConfirmDialog コンポーネントがマウントされたとき呼ぶ。Unmount 時は -1。 */
export function notifyConfirmDialogMount(delta: 1 | -1): void {
  mountCount = Math.max(0, mountCount + delta);
}

/**
 * window.confirm の代替。Promise<boolean> を返す。
 * SSR や ConfirmDialog 未マウント時のみ OS の confirm にフォールバック。
 */
export function confirmAction(detail: ConfirmDetail): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (mountCount === 0) {
    // ConfirmDialog が画面に居ない（テスト環境など）。OS にフォールバック
    const text = detail.body ? `${detail.title}\n\n${detail.body}` : detail.title;
    return Promise.resolve(window.confirm(text));
  }
  return new Promise<boolean>(resolve => {
    const id = ++counter;
    const ev = new CustomEvent<InternalDetail>(EVENT_NAME, {
      detail: { ...detail, __id: id, __resolve: resolve },
    });
    window.dispatchEvent(ev);
  });
}

export const CONFIRM_EVENT = EVENT_NAME;
export type { InternalDetail as ConfirmInternalDetail };
