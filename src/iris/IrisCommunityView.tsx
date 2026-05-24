// ============================================================
// IRIS — Community Board (案件シェア / コラボ募集 / 雑談)
// ============================================================
import { useState } from 'react';
import { MessagesSquare, Plus } from 'lucide-react';
import { useCommunity, POST_TYPE_META, type CommunityPostType } from './community';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { confirmAction } from '../lib/confirmDialog';
import EmptyInvite from './EmptyInvite';
import InviteShareCard from '../components/InviteShareCard';

interface Props {
  bg: IrisBackgroundDef;
  myHandle?: string; // メディアキットの handleName 等
}

export default function IrisCommunityView({ bg, myHandle }: Props) {
  const c = useCommunity();
  const [filter, setFilter] = useState<CommunityPostType | 'all'>('all');
  const [open, setOpen] = useState(false);
  const [newPost, setNewPost] = useState({ type: 'collab-call' as CommunityPostType, title: '', body: '', tags: '' });
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  const handle = myHandle || '@you';
  const filtered = c.filterByType(filter);

  const inp = {
    background: 'rgba(255,255,255,0.94)',
    border: `1px solid ${bg.cardBorder}`,
    color: '#1F1A2E',
    padding: '0.7rem 1rem',
    borderRadius: 12,
    fontSize: '0.95rem',
    fontFamily: IRIS_FONTS.body,
    outline: 'none',
  } as React.CSSProperties;

  const card = {
    background: bg.card,
    backdropFilter: 'blur(10px)',
    border: `1px solid ${bg.cardBorder}`,
    borderRadius: 22,
    padding: '1.4rem',
  } as React.CSSProperties;

  const btnPrimary = {
    background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
    color: '#fff', border: 'none', borderRadius: 999,
    padding: '0.6rem 1.4rem', fontWeight: 600, cursor: 'pointer',
    fontSize: '0.85rem', fontFamily: IRIS_FONTS.body,
  } as React.CSSProperties;

  const submit = () => {
    if (!newPost.title.trim() || !newPost.body.trim()) return;
    c.addPost({
      authorHandle: handle,
      type: newPost.type,
      title: newPost.title,
      body: newPost.body,
      tags: newPost.tags.split(/[,、 ]/).map(s => s.trim()).filter(Boolean),
    });
    setNewPost({ type: 'collab-call', title: '', body: '', tags: '' });
    setOpen(false);
  };

  const submitComment = (postId: string) => {
    if (!commentText.trim()) return;
    c.addComment(postId, handle, commentText);
    setCommentText('');
    setActiveCommentId(null);
  };

  const reactions = ['', '', '', '', '', '', ''];

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <div>
        <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '0.78rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.4rem' }}>
          The House
        </p>
        <h2 style={{ fontFamily: IRIS_FONTS.display, fontSize: '2.4rem', color: bg.ink, margin: 0, fontWeight: 700, letterSpacing: '-0.01em' }}>
          コミュニティ
        </h2>
        <p style={{ color: bg.inkSoft, fontSize: '0.92rem', marginTop: '0.4rem' }}>
          案件シェア、コラボ募集、相場アンケ、警告。同じ立場の女性たちで支え合う場所。
        </p>
      </div>

      {/* ─── 友達招待カード (コミュニティ拡大導線) ─── */}
      <InviteShareCard
        brand="iris"
        compact
        palette={{
          accent: '#E1306C', // Iris ブランド (Instagram pink)
          ink: bg.ink,
          inkSoft: bg.inkSoft,
          card: bg.card,
          border: bg.cardBorder,
        }}
      />

      {/* タイプフィルタ */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setFilter('all')} style={{
          background: filter === 'all' ? bg.accent : 'rgba(255,255,255,0.5)',
          color: filter === 'all' ? '#fff' : bg.ink,
          border: `1px solid ${bg.cardBorder}`,
          borderRadius: 999, padding: '0.4rem 1rem',
          fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
        }}>
          すべて
        </button>
        {Object.entries(POST_TYPE_META).map(([k, v]) => (
          <button key={k} onClick={() => setFilter(k as CommunityPostType)} style={{
            background: filter === k ? v.color : 'rgba(255,255,255,0.5)',
            color: filter === k ? '#fff' : bg.ink,
            border: `1px solid ${bg.cardBorder}`,
            borderRadius: 999, padding: '0.4rem 1rem',
            fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
          }}>
            {v.emoji} {v.label}
          </button>
        ))}
        <button onClick={() => setOpen(!open)} style={{ ...btnPrimary, marginLeft: 'auto' }}>
          {open ? '閉じる' : '+ 投稿する'}
        </button>
      </div>

      {/* 新規投稿フォーム */}
      {open && (
        <div style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <select style={inp} value={newPost.type} onChange={e => setNewPost({ ...newPost, type: e.target.value as CommunityPostType })}>
              {Object.entries(POST_TYPE_META).map(([k, v]) => (
                <option key={k} value={k}>{v.emoji} {v.label}</option>
              ))}
            </select>
            <input style={inp} placeholder="タイトル *" value={newPost.title} onChange={e => setNewPost({ ...newPost, title: e.target.value })} />
            <input style={inp} placeholder="タグ (#旅 #コラボ募集)" value={newPost.tags} onChange={e => setNewPost({ ...newPost, tags: e.target.value })} />
          </div>
          <p style={{ fontSize: '0.78rem', color: bg.inkSoft, marginBottom: '0.4rem', fontStyle: 'italic' }}>
            ヒント: {POST_TYPE_META[newPost.type].hint}
          </p>
          <textarea style={{ ...inp, width: '100%', minHeight: 120, marginBottom: '0.5rem' }}
            placeholder="本文" value={newPost.body} onChange={e => setNewPost({ ...newPost, body: e.target.value })} />
          <button onClick={submit} style={btnPrimary}>投稿</button>
        </div>
      )}

      {/* 投稿一覧 */}
      {filtered.length === 0 && (
        <EmptyInvite
          bg={bg}
          icon={MessagesSquare}
          title="コミュニティはまだ静かです"
          description={
            <>
              ここは案件シェア・コラボ募集・雑談の広場。<br />
              最初のひと言が、誰かの背中を押すかもしれません。
            </>
          }
          primaryAction={{
            label: '最初の投稿をする',
            onClick: () => setOpen(true),
            icon: Plus,
          }}
          hint="気軽な「今日のひとこと」だけでも大丈夫"
        />
      )}

      {filtered.map(p => {
        const meta = POST_TYPE_META[p.type];
        const isMine = p.authorHandle === handle;
        return (
          <div key={p.id} style={{ ...card, borderLeft: `4px solid ${meta.color}` }}>
            {/* ヘッダ */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  background: meta.color + '22', color: meta.color,
                  padding: '0.2rem 0.7rem', borderRadius: 999,
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em',
                }}>
                  {meta.emoji} {meta.label}
                </span>
                <span style={{ fontSize: '0.85rem', color: bg.inkSoft, fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>
                  {p.authorHandle}
                </span>
                <span style={{ fontSize: '0.75rem', color: bg.inkSoft }}>
                  · {new Date(p.createdAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {isMine && (
                <button onClick={async () => { if (await confirmAction({ title: 'この投稿を削除しますか?', tone: 'danger' })) c.removePost(p.id); }} style={{
                  background: 'transparent', border: 'none', cursor: 'pointer', color: bg.inkSoft, fontSize: '0.85rem',
                }}>削除</button>
              )}
            </div>

            <h3 style={{ fontFamily: IRIS_FONTS.display, fontSize: '1.4rem', color: bg.ink, fontWeight: 700, lineHeight: 1.3, marginBottom: '0.5rem' }}>
              {p.title}
            </h3>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: bg.ink, lineHeight: 1.7, marginBottom: '0.75rem' }}>
              {p.body}
            </pre>

            {/* タグ */}
            {p.tags && p.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                {p.tags.map(t => (
                  <span key={t} style={{ fontSize: '0.78rem', color: bg.accent, fontStyle: 'italic' }}>
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* リアクション */}
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              {reactions.map(emo => (
                <button key={emo} onClick={() => c.react(p.id, emo)} style={{
                  background: 'rgba(255,255,255,0.6)',
                  border: `1px solid ${bg.cardBorder}`,
                  borderRadius: 999, padding: '0.3rem 0.7rem',
                  cursor: 'pointer', fontSize: '0.85rem',
                }}>
                  {emo} {p.reactions[emo] || 0}
                </button>
              ))}
            </div>

            {/* コメント */}
            {p.comments.length > 0 && (
              <div style={{ paddingTop: '0.5rem', borderTop: `1px solid ${bg.cardBorder}`, marginTop: '0.5rem' }}>
                {p.comments.map(cm => (
                  <div key={cm.id} style={{
                    padding: '0.5rem 0.75rem', borderRadius: 12,
                    background: 'rgba(255,255,255,0.4)',
                    marginBottom: '0.35rem',
                  }}>
                    <span style={{ fontSize: '0.78rem', color: bg.accent, fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', marginRight: '0.5rem' }}>
                      {cm.authorHandle}
                    </span>
                    <span style={{ color: bg.ink, fontSize: '0.88rem' }}>{cm.body}</span>
                  </div>
                ))}
              </div>
            )}

            {activeCommentId === p.id ? (
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                <input
                  style={{ ...inp, flex: 1 }}
                  placeholder="コメント"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitComment(p.id); } }}
                />
                <button onClick={() => submitComment(p.id)} style={btnPrimary}>送信</button>
              </div>
            ) : (
              <button onClick={() => setActiveCommentId(p.id)} style={{
                background: 'transparent', border: 'none',
                color: bg.accent, fontStyle: 'italic',
                fontFamily: IRIS_FONTS.serif, fontSize: '0.88rem',
                cursor: 'pointer', padding: 0, marginTop: '0.4rem',
              }}>
                返信を書く →
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
