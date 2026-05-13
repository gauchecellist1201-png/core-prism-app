// ============================================================
// CORE Iris — コラボ募集ボード
// クリエイター同士のコラボ企画マッチング
// ============================================================
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { IrisBackgroundDef } from './irisStyle';
import type { CustomIrisBackground } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';

// ─── 型 ───────────────────────────────────────────────────────
export type CollabCategory =
  | 'cosme'      // コスメレビュー
  | 'travel'     // 旅企画
  | 'food'       // グルメ
  | 'fashion'    // ファッション
  | 'fitness'    // フィットネス
  | 'lifestyle'  // ライフスタイル
  | 'other';

export interface CollabPost {
  id: string;
  authorHandle: string;
  authorAvatar?: string;
  category: CollabCategory;
  title: string;
  body: string;
  tags: string[];
  location?: string;
  dateRange?: string;
  followerRange?: string;
  reactions: Record<string, number>;
  chats: { id: string; author: string; text: string; at: string }[];
  createdAt: string;
  aiMatchScore?: number;
  aiMatchReason?: string;
}

const CATEGORY_META: Record<CollabCategory, { label: string; emoji: string; color: string }> = {
  cosme:     { label: 'コスメ',         emoji: '💄', color: '#E1306C' },
  travel:    { label: '旅企画',         emoji: '✈️', color: '#F77737' },
  food:      { label: 'グルメ',         emoji: '🍽️', color: '#FCB045' },
  fashion:   { label: 'ファッション',   emoji: '👗', color: '#833AB4' },
  fitness:   { label: 'フィットネス',   emoji: '🏃‍♀️', color: '#2D9CDB' },
  lifestyle: { label: 'ライフスタイル', emoji: '🌿', color: '#27AE60' },
  other:     { label: 'その他',         emoji: '✨', color: '#8A7AA0' },
};

const STORAGE_KEY = 'core_iris_collab_posts_v1';
const MY_HANDLE_KEY = 'core_iris_my_collab_handle_v1';

function loadPosts(): CollabPost[] {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r) return JSON.parse(r);
  } catch { /* */ }
  // シードデータ
  const seeds: CollabPost[] = [
    {
      id: 'seed-1',
      authorHandle: '@hana_cosme',
      category: 'cosme',
      title: '一緒にコスメレビューしたい！韓国コスメ特集',
      body: '韓国コスメの最新アイテムをダブルレビューしませんか？各自が購入して同日投稿、お互いをタグ付けする形で。フォロワー1万前後の方歓迎✨',
      tags: ['#コスメ', '#韓国コスメ', '#コラボ'],
      followerRange: '5K〜20K',
      reactions: { '💄': 5, '✨': 3 },
      chats: [],
      createdAt: new Date(Date.now() - 1000 * 3600 * 3).toISOString(),
      aiMatchScore: 92,
      aiMatchReason: 'コスメカテゴリが一致。フォロワー規模も近い。',
    },
    {
      id: 'seed-2',
      authorHandle: '@tabi_noa',
      category: 'travel',
      title: 'ダブルで旅企画！沖縄リゾートホテルタイアップ',
      body: '7月に沖縄のリゾートホテルとタイアップ交渉中。2名以上だと条件が良くなりそう。旅・ライフスタイル系の方と組みたいです。',
      tags: ['#旅', '#沖縄', '#タイアップ'],
      location: '沖縄',
      dateRange: '2026年7月',
      followerRange: '10K〜50K',
      reactions: { '✈️': 7, '🌊': 4 },
      chats: [],
      createdAt: new Date(Date.now() - 1000 * 3600 * 8).toISOString(),
      aiMatchScore: 78,
      aiMatchReason: '旅カテゴリ。規模感が合えばよいマッチ。',
    },
    {
      id: 'seed-3',
      authorHandle: '@mika_fashion',
      category: 'fashion',
      title: 'ファッション × コスメ コラボ動画',
      body: 'コーデ紹介とメイクを組み合わせたリール動画を一緒に作りたい！コスメ系クリエイターとコラボ企画を立てたいです。',
      tags: ['#ファッション', '#コスメ', '#リール'],
      followerRange: '3K〜15K',
      reactions: { '👗': 3, '💄': 2 },
      chats: [],
      createdAt: new Date(Date.now() - 1000 * 3600 * 24).toISOString(),
      aiMatchScore: 85,
      aiMatchReason: 'コスメ×ファッションのクロスジャンル。エンゲージメント向上が期待できる。',
    },
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds));
  return seeds;
}

function savePosts(posts: CollabPost[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(posts)); } catch { /* */ }
}

// ─── AI マッチング (ローカル簡易版) ────────────────────────────
function computeAiMatch(post: CollabPost, myCategory: CollabCategory | ''): { score: number; reason: string } {
  if (!myCategory) return { score: Math.floor(60 + Math.random() * 30), reason: 'プロフィール未設定' };
  if (post.category === myCategory) return { score: 88 + Math.floor(Math.random() * 12), reason: `同じ「${CATEGORY_META[myCategory].label}」カテゴリです！` };
  const crossMap: Partial<Record<CollabCategory, CollabCategory[]>> = {
    cosme: ['fashion', 'lifestyle'],
    fashion: ['cosme', 'lifestyle'],
    travel: ['food', 'lifestyle'],
    food: ['travel', 'lifestyle'],
    fitness: ['lifestyle'],
    lifestyle: ['cosme', 'travel', 'fashion', 'food', 'fitness'],
  };
  if (crossMap[myCategory]?.includes(post.category)) {
    return { score: 70 + Math.floor(Math.random() * 15), reason: 'クロスジャンルでエンゲージメント向上が狙えます。' };
  }
  return { score: 40 + Math.floor(Math.random() * 25), reason: '異なるジャンルですが意外なコラボも話題を呼ぶことがあります。' };
}

// ─── コンポーネント ─────────────────────────────────────────────
interface Props {
  bg: IrisBackgroundDef | CustomIrisBackground;
  myHandle?: string;
}

export default function IrisCollabBoard({ bg, myHandle }: Props) {
  const [posts, setPosts] = useState<CollabPost[]>(loadPosts);
  const [filterCat, setFilterCat] = useState<CollabCategory | 'all'>('all');
  const [showNew, setShowNew] = useState(false);
  const [openChat, setOpenChat] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [myCategory, setMyCategory] = useState<CollabCategory | ''>('');

  // 新規投稿フォーム
  const [form, setForm] = useState({
    title: '', body: '', category: 'cosme' as CollabCategory,
    tags: '', location: '', dateRange: '', followerRange: '',
  });

  const handle = myHandle || localStorage.getItem(MY_HANDLE_KEY) || '@you';

  const displayed = useMemo(() => {
    const base = filterCat === 'all' ? posts : posts.filter(p => p.category === filterCat);
    return base.map(p => {
      const m = computeAiMatch(p, myCategory);
      return { ...p, aiMatchScore: p.aiMatchScore ?? m.score, aiMatchReason: p.aiMatchReason ?? m.reason };
    }).sort((a, b) => (b.aiMatchScore ?? 0) - (a.aiMatchScore ?? 0));
  }, [posts, filterCat, myCategory]);

  function addReaction(id: string, emoji: string) {
    const updated = posts.map(p =>
      p.id === id ? { ...p, reactions: { ...p.reactions, [emoji]: (p.reactions[emoji] || 0) + 1 } } : p,
    );
    setPosts(updated); savePosts(updated);
  }

  function sendChat(postId: string) {
    if (!chatInput.trim()) return;
    const updated = posts.map(p =>
      p.id === postId ? {
        ...p,
        chats: [...p.chats, { id: Date.now().toString(), author: handle, text: chatInput.trim(), at: new Date().toISOString() }],
      } : p,
    );
    setPosts(updated); savePosts(updated); setChatInput('');
  }

  function submitPost() {
    if (!form.title.trim() || !form.body.trim()) return;
    const post: CollabPost = {
      id: Date.now().toString(),
      authorHandle: handle,
      category: form.category,
      title: form.title.trim(),
      body: form.body.trim(),
      tags: form.tags.split(/[\s,]+/).filter(Boolean),
      location: form.location || undefined,
      dateRange: form.dateRange || undefined,
      followerRange: form.followerRange || undefined,
      reactions: {},
      chats: [],
      createdAt: new Date().toISOString(),
    };
    const updated = [post, ...posts];
    setPosts(updated); savePosts(updated);
    setForm({ title: '', body: '', category: 'cosme', tags: '', location: '', dateRange: '', followerRange: '' });
    setShowNew(false);
  }

  const card: React.CSSProperties = {
    background: bg.card, border: `1px solid ${bg.cardBorder}`,
    borderRadius: 20, padding: '1.25rem',
    boxShadow: '0 4px 20px rgba(31,26,46,0.07)',
  };

  return (
    <div style={{ maxWidth: 840, margin: '0 auto' }}>
      {/* ヘッダ */}
      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.28em', color: bg.accent, fontWeight: 700, marginBottom: 4 }}>
          COLLAB BOARD
        </p>
        <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '2rem', color: bg.ink, margin: 0 }}>
          一緒に、つくろう。
        </h2>
        <p style={{ color: bg.inkSoft, fontSize: '0.85rem', marginTop: 4 }}>
          コラボしたいクリエイターを見つけて、一緒に企画を立てよう。AI が「もしかして合うかも」を教えてくれます。
        </p>
      </div>

      {/* 自分のカテゴリ設定 → AI マッチ精度アップ */}
      <div style={{ ...card, marginBottom: '1rem', padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', color: bg.inkSoft, whiteSpace: 'nowrap' }}>🤖 AIマッチ精度を上げる: 自分のジャンル</span>
        {(['cosme', 'travel', 'food', 'fashion', 'fitness', 'lifestyle', 'other'] as CollabCategory[]).map(c => (
          <button key={c} onClick={() => setMyCategory(c === myCategory ? '' : c)}
            style={{
              padding: '0.3rem 0.75rem', borderRadius: 999, fontSize: '0.75rem',
              background: myCategory === c ? bg.accent : 'rgba(255,255,255,0.8)',
              color: myCategory === c ? '#fff' : bg.ink,
              border: `1px solid ${bg.cardBorder}`, cursor: 'pointer', fontWeight: 600,
            }}>
            {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
          </button>
        ))}
      </div>

      {/* フィルタ + 投稿ボタン */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {(['all', 'cosme', 'travel', 'food', 'fashion', 'fitness', 'lifestyle', 'other'] as const).map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            style={{
              padding: '0.4rem 0.9rem', borderRadius: 999, fontSize: '0.8rem',
              background: filterCat === c ? bg.accent : 'rgba(255,255,255,0.85)',
              color: filterCat === c ? '#fff' : bg.ink,
              border: `1px solid ${bg.cardBorder}`, cursor: 'pointer', fontWeight: 600,
              boxShadow: filterCat === c ? `0 4px 12px ${bg.accent}44` : 'none',
            }}>
            {c === 'all' ? '🔗 すべて' : `${CATEGORY_META[c].emoji} ${CATEGORY_META[c].label}`}
          </button>
        ))}
        <button onClick={() => setShowNew(true)}
          style={{
            marginLeft: 'auto', padding: '0.5rem 1.2rem', borderRadius: 999,
            background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
            color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
            boxShadow: `0 4px 14px ${bg.accent}55`,
          }}>
          + 募集を出す
        </button>
      </div>

      {/* AI マッチ上位バッジ */}
      {myCategory && (
        <div style={{ ...card, marginBottom: '1rem', padding: '0.75rem 1rem', background: `${bg.accent}12`, border: `1px solid ${bg.accent}33` }}>
          <span style={{ fontSize: '0.8rem', color: bg.accent, fontWeight: 700 }}>
            ✨ AIが「もしかして合うかも」と判断した順に並んでいます
          </span>
        </div>
      )}

      {/* 投稿リスト */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {displayed.map(post => {
          const meta = CATEGORY_META[post.category];
          const isOpen = openChat === post.id;
          return (
            <motion.div key={post.id} layout
              style={{ ...card, position: 'relative' }}>
              {/* AI マッチスコア */}
              {post.aiMatchScore != null && (
                <div style={{
                  position: 'absolute', top: '1rem', right: '1rem',
                  background: post.aiMatchScore >= 80 ? `${bg.accent}22` : 'rgba(255,255,255,0.7)',
                  border: `1px solid ${post.aiMatchScore >= 80 ? bg.accent : bg.cardBorder}`,
                  borderRadius: 999, padding: '0.2rem 0.6rem',
                  fontSize: '0.72rem', fontWeight: 700,
                  color: post.aiMatchScore >= 80 ? bg.accent : bg.inkSoft,
                }}>
                  🤖 {post.aiMatchScore}% マッチ
                </div>
              )}

              {/* カテゴリバッジ + 著者 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{
                  background: `${meta.color}18`, color: meta.color,
                  border: `1px solid ${meta.color}33`, borderRadius: 999,
                  padding: '0.2rem 0.7rem', fontSize: '0.75rem', fontWeight: 700,
                }}>
                  {meta.emoji} {meta.label}
                </span>
                <span style={{ fontSize: '0.8rem', color: bg.inkSoft }}>{post.authorHandle}</span>
                {post.location && <span style={{ fontSize: '0.75rem', color: bg.inkSoft }}>📍{post.location}</span>}
                {post.dateRange && <span style={{ fontSize: '0.75rem', color: bg.inkSoft }}>🗓 {post.dateRange}</span>}
                {post.followerRange && <span style={{ fontSize: '0.75rem', color: bg.inkSoft }}>👥 {post.followerRange}</span>}
              </div>

              <h3 style={{ fontFamily: IRIS_FONTS.serif, fontSize: '1.1rem', color: bg.ink, margin: '0 0 0.4rem', paddingRight: '5.5rem' }}>
                {post.title}
              </h3>
              <p style={{ fontSize: '0.85rem', color: bg.inkSoft, lineHeight: 1.65, margin: '0 0 0.65rem', whiteSpace: 'pre-wrap' }}>
                {post.body}
              </p>

              {/* タグ */}
              {post.tags.length > 0 && (
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
                  {post.tags.map(t => (
                    <span key={t} style={{ fontSize: '0.72rem', color: bg.accent, background: `${bg.accent}10`, borderRadius: 999, padding: '0.15rem 0.55rem' }}>{t}</span>
                  ))}
                </div>
              )}

              {/* AI マッチ理由 */}
              {post.aiMatchReason && post.aiMatchScore && post.aiMatchScore >= 70 && (
                <p style={{ fontSize: '0.75rem', color: bg.accent, background: `${bg.accent}0d`, borderRadius: 10, padding: '0.35rem 0.65rem', marginBottom: '0.65rem' }}>
                  💡 {post.aiMatchReason}
                </p>
              )}

              {/* アクション */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {['💄', '✨', '🌸', '👍'].map(e => (
                  <button key={e} onClick={() => addReaction(post.id, e)}
                    style={{ background: 'rgba(255,255,255,0.7)', border: `1px solid ${bg.cardBorder}`, borderRadius: 999, padding: '0.3rem 0.7rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                    {e} {post.reactions[e] || ''}
                  </button>
                ))}
                <button onClick={() => setOpenChat(isOpen ? null : post.id)}
                  style={{
                    marginLeft: 'auto', padding: '0.35rem 1rem', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700,
                    background: isOpen ? bg.accent : 'rgba(255,255,255,0.85)',
                    color: isOpen ? '#fff' : bg.ink,
                    border: `1px solid ${isOpen ? bg.accent : bg.cardBorder}`, cursor: 'pointer',
                  }}>
                  💬 チャット開始 {post.chats.length > 0 ? `(${post.chats.length})` : ''}
                </button>
              </div>

              {/* チャット */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden' }}>
                    <div style={{ marginTop: '0.85rem', borderTop: `1px solid ${bg.cardBorder}`, paddingTop: '0.85rem' }}>
                      {post.chats.length === 0 && (
                        <p style={{ fontSize: '0.8rem', color: bg.inkSoft, textAlign: 'center', padding: '0.5rem 0' }}>まだメッセージはありません</p>
                      )}
                      {post.chats.map(c => (
                        <div key={c.id} style={{ marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: bg.accent }}>{c.author} </span>
                          <span style={{ fontSize: '0.8rem', color: bg.ink }}>{c.text}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && sendChat(post.id)}
                          placeholder="メッセージを送る…"
                          style={{
                            flex: 1, padding: '0.5rem 0.85rem', borderRadius: 999, fontSize: '0.85rem',
                            border: `1px solid ${bg.cardBorder}`, background: 'rgba(255,255,255,0.9)',
                            color: bg.ink, outline: 'none',
                          }} />
                        <button onClick={() => sendChat(post.id)}
                          style={{ padding: '0.5rem 1rem', borderRadius: 999, background: bg.accent, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                          送信
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* 新規投稿モーダル */}
      <AnimatePresence>
        {showNew && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowNew(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(20,15,30,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <motion.div initial={{ scale: 0.92, y: 24 }} animate={{ scale: 1, y: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 24, padding: '1.5rem', maxWidth: 560, width: '100%', maxHeight: 'calc(100dvh - 2rem)', overflow: 'auto' }}>
              <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.5rem', color: '#1F1A2E', margin: '0 0 1.25rem' }}>
                コラボ募集を出す
              </h3>
              {[
                { label: 'タイトル *', key: 'title', placeholder: '一緒にコスメレビューしたい！', type: 'text' },
                { label: '詳細 *', key: 'body', placeholder: '企画内容・希望する相手のジャンルなど', type: 'textarea' },
                { label: 'タグ (スペース区切り)', key: 'tags', placeholder: '#コスメ #旅 #コラボ', type: 'text' },
                { label: '場所 (任意)', key: 'location', placeholder: '東京・沖縄 etc.', type: 'text' },
                { label: '時期 (任意)', key: 'dateRange', placeholder: '2026年7月', type: 'text' },
                { label: 'フォロワー規模 (任意)', key: 'followerRange', placeholder: '5K〜30K', type: 'text' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: '0.85rem' }}>
                  <label style={{ fontSize: '0.75rem', color: '#5A4570', fontWeight: 700, display: 'block', marginBottom: 4 }}>{f.label}</label>
                  {f.type === 'textarea'
                    ? <textarea value={form[f.key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder} rows={4}
                        style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: 12, border: '1px solid #E0D4EC', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: IRIS_FONTS.body }} />
                    : <input value={form[f.key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: 999, border: '1px solid #E0D4EC', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                  }
                </div>
              ))}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.75rem', color: '#5A4570', fontWeight: 700, display: 'block', marginBottom: 4 }}>カテゴリ</label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {(Object.keys(CATEGORY_META) as CollabCategory[]).map(c => (
                    <button key={c} onClick={() => setForm(p => ({ ...p, category: c }))}
                      style={{
                        padding: '0.35rem 0.85rem', borderRadius: 999, fontSize: '0.78rem',
                        background: form.category === c ? '#E1306C' : 'rgba(0,0,0,0.04)',
                        color: form.category === c ? '#fff' : '#1F1A2E',
                        border: `1px solid ${form.category === c ? '#E1306C' : '#E0D4EC'}`,
                        cursor: 'pointer', fontWeight: 600,
                      }}>
                      {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={submitPost}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: 999, background: 'linear-gradient(135deg, #E1306C, #F77737)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem' }}>
                  投稿する
                </button>
                <button onClick={() => setShowNew(false)}
                  style={{ padding: '0.75rem 1.25rem', borderRadius: 999, background: 'rgba(0,0,0,0.05)', color: '#1F1A2E', border: '1px solid #E0D4EC', cursor: 'pointer' }}>
                  キャンセル
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
