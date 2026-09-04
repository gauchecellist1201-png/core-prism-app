// ============================================================
// CORE Studio — タブの定義 (StudioSite と下層ページが共有する)
// 2026-09-04: 下層5ページを別ファイルに分けた際、TabId を両側から参照するために切り出した。
// ============================================================
export type TabId = 'home' | 'film' | 'plans' | 'dev' | 'care' | 'works' | 'about' | 'contact';

export const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'home', label: 'ホーム' },
  { id: 'film', label: '映像制作' },
  { id: 'plans', label: 'サイト制作' },
  { id: 'dev', label: '受託開発' },
  { id: 'care', label: '運用' },
  { id: 'works', label: '実績' },
  { id: 'about', label: '会社案内' },
  { id: 'contact', label: 'お問い合わせ' },
];

export const isTabId = (v: string): v is TabId => TABS.some(t => t.id === v);

export const pathOf = (t: TabId) => (t === 'home' ? '/studio' : `/studio/${t}`);

/** タブ移動 (StudioSite の go)。下層ページはこれを受け取って導線を張る */
export type Go = (t: TabId) => void;
