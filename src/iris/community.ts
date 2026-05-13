// ============================================================
// IRIS — Community Board (案件シェア / コラボ募集 / 相場感共有)
// 「こんなん一緒いきません?」をボードで投げ合う場
// ローカル localStorage 完結 (将来サーバ同期予定)
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Platform } from '../types/influencerDeal';

const KEY_POSTS = 'core_iris_community_posts_v1';

export type CommunityPostType =
  | 'collab-call'      // コラボ募集 (こんなん一緒いきません?)
  | 'offer-share'      // 案件シェア (匿名化された案件情報)
  | 'rate-poll'        // 相場感アンケート (このブランド、いくら出すべき?)
  | 'recommendation'   // 推薦 (この案件、私には合わなかったけど誰か?)
  | 'warning'          // 警告 (この企業、ヤバい)
  | 'discussion';      // 雑談・相談

export interface CommunityPost {
  id: string;
  /** 投稿者の表示名 (ハンドル化、本名NG) */
  authorHandle: string;
  authorAvatar?: string;
  type: CommunityPostType;
  title: string;
  body: string;
  /** タグ (#コスメ #海外旅 等) */
  tags?: string[];
  /** プラットフォーム (関連あるなら) */
  platform?: Platform;
  /** 関連場所 (例: 沖縄、青山) */
  location?: string;
  /** 期間 (コラボ募集で「○月にハワイ行く」等) */
  date?: string;
  /** 関連報酬 (相場ポーリングなら) */
  feeContext?: { proposed?: number; bestGuess?: number };
  /** リアクション */
  reactions: Record<string, number>; // { '': 3, '': 1 }
  /** コメント */
  comments: { id: string; authorHandle: string; body: string; createdAt: string }[];
  createdAt: string;
}

function load<T>(k: string, fb: T): T {
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; }
}
function save<T>(k: string, v: T) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ }
}

export const POST_TYPE_META: Record<CommunityPostType, { label: string; emoji: string; color: string; hint: string }> = {
  'collab-call':    { label: 'コラボ募集',     emoji: '', color: '#A8324A', hint: 'こんなん一緒いきません?' },
  'offer-share':    { label: '案件シェア',     emoji: '', color: '#7B1F2B', hint: '受けた案件の情報を匿名で共有' },
  'rate-poll':      { label: '相場アンケ',     emoji: '', color: '#C8956D', hint: 'これ、いくらで受けるべき?' },
  'recommendation': { label: 'おすすめ案件',   emoji: '', color: '#E8C9B0', hint: '私には合わないけど、誰かに' },
  'warning':        { label: '注意喚起',       emoji: '',  color: '#5C0E1B', hint: 'この企業、ヤバいかも' },
  'discussion':     { label: '雑談・相談',     emoji: '', color: '#1A2540', hint: 'なんでも話せる場所' },
};

const SEED_HANDLES = ['rose_paris', 'mio_tokyo', 'aimi_aoyama', 'noa_okinawa', 'rena_milan'];

/** デモ用シードデータ (初回のみ) */
function seedIfEmpty(): CommunityPost[] {
  const seeds: CommunityPost[] = [
    {
      id: uuidv4(),
      authorHandle: '@aimi_aoyama',
      type: 'collab-call',
      title: '5月に京都行きます。一緒にコンテンツ撮りませんか?',
      body: '5/20-22 で京都に滞在予定。リール / 写真の撮影、宿のお泊まりタイアップを2人以上で受けると交渉しやすいので、コラボ相手を探しています。コスメ・ライフスタイル系の方歓迎。\n\nDM ください',
      tags: ['#京都', '#旅', '#コラボ募集'],
      location: '京都',
      date: '2026-05-20',
      reactions: { '': 4, '': 2 },
      comments: [],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    },
    {
      id: uuidv4(),
      authorHandle: '@noa_okinawa',
      type: 'warning',
      title: '「Beauty xxx (株)」名義の案件、要注意です',
      body: '法人ドメインがなくて Gmail から連絡。3 万円で「投稿+ストーリー+二次利用」を当日中に求めてきました。契約書はなしと。同じところから連絡来た方いますか? 一応こちらは断りました。',
      tags: ['#警告', '#詐欺注意'],
      reactions: { '': 8, '': 3 },
      comments: [
        { id: uuidv4(), authorHandle: '@rose_paris', body: '私もこの会社からきました!断り済みです。共有ありがとう。', createdAt: new Date().toISOString() },
      ],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
    {
      id: uuidv4(),
      authorHandle: '@rena_milan',
      type: 'rate-poll',
      title: '某スキンケアブランド (フォロワー 30K想定) でリール1本、相場いくらだと思います?',
      body: 'お声がかかってる某スキンケアブランド、リール1本 (二次利用なし)。私はフォロワー 30K で平均ER 5%。\n相場感、教えてくれる方いますか? 自分は 8 万円スタートかなと思ってます。',
      tags: ['#相場感'],
      feeContext: { bestGuess: 80000 },
      reactions: { '': 6, '': 1 },
      comments: [
        { id: uuidv4(), authorHandle: '@mio_tokyo', body: 'ER 5% なら 10 万スタートで全然いけると思う!', createdAt: new Date().toISOString() },
      ],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    },
  ];
  return seeds;
}

export function useCommunity() {
  const [posts, setPosts] = useState<CommunityPost[]>(() => {
    const existing = load<CommunityPost[]>(KEY_POSTS, []);
    if (existing.length === 0) {
      const seeds = seedIfEmpty();
      save(KEY_POSTS, seeds);
      return seeds;
    }
    return existing;
  });

  useEffect(() => save(KEY_POSTS, posts), [posts]);

  const addPost = useCallback((p: Omit<CommunityPost, 'id' | 'createdAt' | 'reactions' | 'comments'>) => {
    const created: CommunityPost = {
      ...p, id: uuidv4(),
      createdAt: new Date().toISOString(),
      reactions: {},
      comments: [],
    };
    setPosts(prev => [created, ...prev]);
    return created;
  }, []);

  const removePost = useCallback((id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
  }, []);

  const react = useCallback((id: string, emoji: string) => {
    setPosts(prev => prev.map(p => p.id === id ? {
      ...p,
      reactions: { ...p.reactions, [emoji]: (p.reactions[emoji] || 0) + 1 },
    } : p));
  }, []);

  const addComment = useCallback((postId: string, authorHandle: string, body: string) => {
    setPosts(prev => prev.map(p => p.id === postId ? {
      ...p,
      comments: [...p.comments, { id: uuidv4(), authorHandle, body, createdAt: new Date().toISOString() }],
    } : p));
  }, []);

  const filterByType = useCallback((type: CommunityPostType | 'all') => {
    return type === 'all' ? posts : posts.filter(p => p.type === type);
  }, [posts]);

  return { posts, addPost, removePost, react, addComment, filterByType };
}

export const SUGGESTED_HANDLES = SEED_HANDLES;
