// ============================================================
// CORE Iris ▸ 投稿予約キュー
// リール / 静止画 / 案件下書きを横断する「Instagram に出すだけ」状態の保管庫
// ・localStorage 永続化 (端末内のみ。サーバーには送らない)
// ・data URL (max ~6MB) で MP4 / 画像を埋め込み可
// ・予定時刻に到達したら notifyDue() で通知
// ============================================================
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'iris_post_queue_v1';

export type PostSource = 'reel' | 'draft' | 'image' | 'story';
export type PostPlatform = 'instagram_feed' | 'instagram_reel' | 'instagram_story' | 'tiktok' | 'x';
export type PostStatus = 'draft' | 'scheduled' | 'ready' | 'posted' | 'skipped';

export interface ScheduledPost {
  id: string;
  createdAt: string;
  scheduledAt: string;       // ISO; "予約時刻"
  status: PostStatus;
  platform: PostPlatform;
  source: PostSource;
  /** 関連案件 ID (Influencer Deal) — 任意 */
  dealId?: string;
  brandName?: string;        // 表示用
  /** Instagram 投稿に貼り付ける本文 */
  caption: string;
  hashtags: string[];
  cta?: string;
  /** メディア (data URL or blob URL). 重い場合は null + 別キャッシュ */
  mediaDataUrl?: string | null;
  mediaKind?: 'video' | 'image';
  /** プレビュー用サムネ (image data URL) */
  thumbDataUrl?: string | null;
  /** リールテンプレ ID / 編集メタ */
  reelTemplateId?: string;
  reelPattern?: string;
  /** 自動メモ — 何を撮るか / 注意点 */
  note?: string;
}

function load(): ScheduledPost[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // スキーマ ガード: 配列で 各 要素 が 期待 形状 か
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is ScheduledPost =>
      p && typeof p === 'object' && typeof p.id === 'string' && typeof p.createdAt === 'string'
    );
  } catch { return []; }
}

const SAVE_FAIL_EVENT = 'iris:post-queue-save-failed';

function notifySaveFailed(message: string) {
  try {
    window.dispatchEvent(new CustomEvent(SAVE_FAIL_EVENT, { detail: { message } }));
  } catch {/* SSR or sandboxed */}
}

function save(list: ScheduledPost[]): boolean {
  try {
    // 各エントリのメディアが巨大すぎる場合は警告
    const json = JSON.stringify(list);
    if (json.length > 4_500_000) {
      // localStorage は通常 5MB 上限。古い済みを落とす
      const trimmed = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      while (JSON.stringify(trimmed).length > 4_500_000 && trimmed.length > 1) {
        trimmed.shift();
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      notifySaveFailed('予約が多すぎたため、古い投稿を一部削除しました。長持ちさせるには「投稿済み」の予約を消してください。');
      return false;
    }
    localStorage.setItem(STORAGE_KEY, json);
    return true;
  } catch (e: any) {
    console.warn('usePostQueue: save failed', e);
    notifySaveFailed(`予約の保存に失敗しました: ${e?.message || 'ストレージ容量'} — 古い投稿を削除して再試行してください。`);
    return false;
  }
}

function makeId() {
  return 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function usePostQueue() {
  const [posts, setPosts] = useState<ScheduledPost[]>(() => load());
  const [saveError, setSaveError] = useState<string>('');

  // 他タブの変更を反映
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setPosts(load());
    };
    window.addEventListener('storage', onStorage);
    const onSaveFail = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.message) setSaveError(detail.message);
    };
    window.addEventListener(SAVE_FAIL_EVENT, onSaveFail);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(SAVE_FAIL_EVENT, onSaveFail);
    };
  }, []);

  const dismissSaveError = useCallback(() => setSaveError(''), []);

  // ステータス自動更新 (scheduled → ready)
  useEffect(() => {
    const tick = () => {
      setPosts(prev => {
        let changed = false;
        const next = prev.map(p => {
          if (p.status === 'scheduled' && new Date(p.scheduledAt).getTime() <= Date.now()) {
            changed = true;
            return { ...p, status: 'ready' as PostStatus };
          }
          return p;
        });
        if (changed) save(next);
        return changed ? next : prev;
      });
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const add = useCallback((p: Omit<ScheduledPost, 'id' | 'createdAt' | 'status'> & Partial<Pick<ScheduledPost, 'status'>>) => {
    const item: ScheduledPost = {
      id: makeId(),
      createdAt: new Date().toISOString(),
      status: p.status || (new Date(p.scheduledAt).getTime() > Date.now() ? 'scheduled' : 'ready'),
      ...p,
    };
    setPosts(prev => {
      const next = [item, ...prev];
      save(next);
      return next;
    });
    return item;
  }, []);

  const update = useCallback((id: string, patch: Partial<ScheduledPost>) => {
    setPosts(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...patch } : p);
      save(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setPosts(prev => {
      const next = prev.filter(p => p.id !== id);
      save(next);
      return next;
    });
  }, []);

  const markPosted = useCallback((id: string) => {
    update(id, { status: 'posted' });
  }, [update]);

  // 「次にユーザーが気にすべき投稿」(ready → scheduled の最近 → draft の順)
  const upcoming = useCallback(() => {
    const sorted = [...posts].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    const ready = sorted.filter(p => p.status === 'ready');
    const scheduled = sorted.filter(p => p.status === 'scheduled');
    const drafts = sorted.filter(p => p.status === 'draft');
    return [...ready, ...scheduled, ...drafts];
  }, [posts]);

  return { posts, add, update, remove, markPosted, upcoming, saveError, dismissSaveError };
}

// ─── スマートタイミング推奨 ─────
// Instagram の一般的ピーク時間帯から、最も近い未来のスロットを返す
const PEAK_SLOTS = [
  { h: 7,  m: 0 },   // 朝活
  { h: 8,  m: 30 },  // 出勤中
  { h: 12, m: 15 },  // ランチ
  { h: 18, m: 0 },   // 帰宅
  { h: 20, m: 0 },   // 夜のゴールデン
  { h: 21, m: 30 },  // 寝る前
];

export function suggestNextSlot(now = new Date()): Date {
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    for (const slot of PEAK_SLOTS) {
      const d = new Date(now);
      d.setDate(d.getDate() + dayOffset);
      d.setHours(slot.h, slot.m, 0, 0);
      if (d.getTime() > now.getTime() + 10 * 60 * 1000) return d;
    }
  }
  // フォールバック: 1時間後
  return new Date(now.getTime() + 60 * 60 * 1000);
}

/** Instagram 投稿用にキャプション + ハッシュタグを 1 つの文字列にまとめる */
export function buildCaptionText(p: ScheduledPost): string {
  const parts = [p.caption.trim()];
  if (p.cta && !p.caption.includes(p.cta)) parts.push('', p.cta.trim());
  if (p.hashtags?.length) parts.push('', p.hashtags.join(' '));
  return parts.filter(Boolean).join('\n');
}
