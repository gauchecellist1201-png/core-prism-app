// ============================================================
// CORE Iris — ナレッジ管理ビュー
// 自分の資料 (AI 生成物 + 手書きメモ) の一覧 / 編集 / 削除
// ============================================================
import React, { useState, useMemo } from 'react';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import {
  IRIS_KNOWLEDGE_KIND_META, type IrisKnowledgeItem, type IrisKnowledgeKind,
  useIrisKnowledge,
} from './irisKnowledge';
import { BookmarkPlus, Trash2, Save, X, Search, Brain } from 'lucide-react';

interface Props {
  bg: IrisBackgroundDef;
  knowledge: ReturnType<typeof useIrisKnowledge>;
}

const inp = (bg: IrisBackgroundDef): React.CSSProperties => ({
  background: 'rgba(255,255,255,0.94)',
  border: `1px solid ${bg.cardBorder}`,
  color: '#1F1A2E',
  padding: '0.55rem 0.85rem',
  borderRadius: 12,
  fontFamily: IRIS_FONTS.body,
  fontSize: '0.9rem',
});

const card = (bg: IrisBackgroundDef): React.CSSProperties => ({
  background: bg.card,
  border: `1px solid ${bg.cardBorder}`,
  borderRadius: 18,
  padding: '1rem 1.1rem',
});

export default function IrisKnowledgeView({ bg, knowledge }: Props) {
  const [filterKind, setFilterKind] = useState<IrisKnowledgeKind | 'all'>('all');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  const filtered = useMemo(() => {
    return knowledge.items.filter(i => {
      if (filterKind !== 'all' && i.kind !== filterKind) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return i.title.toLowerCase().includes(q)
          || i.content.toLowerCase().includes(q)
          || i.tags.some(t => t.toLowerCase().includes(q));
      }
      return true;
    });
  }, [knowledge.items, filterKind, search]);

  const startEdit = (item: IrisKnowledgeItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditContent(item.content);
  };

  const saveEdit = () => {
    if (!editingId) return;
    knowledge.update(editingId, { title: editTitle, content: editContent });
    setEditingId(null);
  };

  const addManualNote = () => {
    const t = newTitle.trim();
    const c = newContent.trim();
    if (!t || !c) return;
    knowledge.add({ kind: 'note', title: t, content: c, tags: ['手書き'] });
    setNewTitle(''); setNewContent(''); setAddOpen(false);
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div>
        <p style={{ fontSize: '0.72rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 700 }}>KNOWLEDGE</p>
        <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '2rem', color: bg.ink, margin: '0.25rem 0 0' }}>
          あなたの資料、{knowledge.count} 件。
        </h2>
        <p style={{ color: bg.inkSoft, fontSize: '0.92rem', marginTop: '0.4rem', lineHeight: 1.7 }}>
          <Brain size={13} style={{ display: 'inline', marginRight: 4 }} />
          ここに保存した資料は、次回 AI 提案を作るときに自動で参考にされます。書けば書くほど、あなた専用の提案になります。
        </p>
      </div>

      <div style={card(bg)}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.6)', borderRadius: 12, padding: '0.3rem 0.6rem', flex: '1 1 220px' }}>
            <Search size={14} color={bg.inkSoft} />
            <input
              style={{ ...inp(bg), background: 'transparent', border: 'none', flex: 1, padding: '0.3rem 0.2rem' }}
              placeholder="タイトル・本文・タグで検索"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button onClick={() => setAddOpen(v => !v)} style={{
            background: bg.accent, color: '#fff', border: 'none',
            borderRadius: 12, padding: '0.55rem 0.95rem',
            fontFamily: IRIS_FONTS.body, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <BookmarkPlus size={14} /> メモを追加
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          <button onClick={() => setFilterKind('all')} style={chip(bg, filterKind === 'all')}>
            すべて ({knowledge.items.length})
          </button>
          {(Object.keys(IRIS_KNOWLEDGE_KIND_META) as IrisKnowledgeKind[]).map(k => {
            const n = knowledge.items.filter(i => i.kind === k).length;
            if (n === 0) return null;
            const m = IRIS_KNOWLEDGE_KIND_META[k];
            return (
              <button key={k} onClick={() => setFilterKind(k)} style={chip(bg, filterKind === k, m.color)}>
                {m.emoji} {m.label} ({n})
              </button>
            );
          })}
        </div>
      </div>

      {addOpen && (
        <div style={card(bg)}>
          <p style={{ fontWeight: 700, color: bg.ink, marginBottom: '0.5rem' }}>新しいメモを追加</p>
          <input
            style={{ ...inp(bg), width: '100%', marginBottom: '0.5rem' }}
            placeholder="タイトル (例: ブランドへの想い)"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
          />
          <textarea
            style={{ ...inp(bg), width: '100%', minHeight: 100, fontFamily: 'inherit' }}
            placeholder="本文 (好きな言い回し・自分らしさ・絶対譲れない価値観 など)"
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button onClick={addManualNote} disabled={!newTitle.trim() || !newContent.trim()} style={{
              background: bg.accent, color: '#fff', border: 'none',
              borderRadius: 12, padding: '0.55rem 1rem', fontWeight: 700, fontSize: '0.85rem',
              cursor: 'pointer', opacity: (!newTitle.trim() || !newContent.trim()) ? 0.4 : 1,
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Save size={14} /> 保存
              </span>
            </button>
            <button onClick={() => { setAddOpen(false); setNewTitle(''); setNewContent(''); }} style={{
              background: 'rgba(255,255,255,0.6)', color: bg.ink,
              border: `1px solid ${bg.cardBorder}`, borderRadius: 12, padding: '0.55rem 1rem',
              fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
            }}>キャンセル</button>
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{ ...card(bg), textAlign: 'center', padding: '2.5rem 1rem' }}>
          <p style={{ fontSize: '0.95rem', color: bg.inkSoft, lineHeight: 1.8 }}>
            まだ資料がありません。<br/>
            AI が作ったリール案 / キャプション / 応募文 / 30 日プランに付いている「ナレッジに追加」を押すと、ここに溜まっていきます。
          </p>
        </div>
      )}

      {filtered.map(item => {
        const meta = IRIS_KNOWLEDGE_KIND_META[item.kind];
        const isEditing = editingId === item.id;
        return (
          <div key={item.id} style={{ ...card(bg), borderLeft: `4px solid ${meta.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: '0.7rem', letterSpacing: '0.15em', color: meta.color, fontWeight: 700,
                  textTransform: 'uppercase', marginBottom: 2,
                }}>
                  {meta.emoji} {meta.label}
                  {item.source && <span style={{ color: bg.inkSoft, marginLeft: 6 }}>· {item.source}</span>}
                </p>
                {isEditing ? (
                  <input
                    style={{ ...inp(bg), width: '100%', fontSize: '1rem', fontWeight: 700 }}
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                  />
                ) : (
                  <p style={{ fontWeight: 700, color: bg.ink, fontSize: '1rem', lineHeight: 1.4 }}>{item.title}</p>
                )}
                <p style={{ fontSize: '0.72rem', color: bg.inkSoft, marginTop: 2 }}>
                  {new Date(item.createdAt).toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                {isEditing ? (
                  <>
                    <button onClick={saveEdit} title="保存" style={btnIcon(bg, bg.accent)}><Save size={14} /></button>
                    <button onClick={() => setEditingId(null)} title="やめる" style={btnIcon(bg)}><X size={14} /></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(item)} title="編集" style={btnIcon(bg)}>編集</button>
                    <button
                      onClick={() => { if (confirm(`「${item.title}」を削除しますか?`)) knowledge.remove(item.id); }}
                      title="削除"
                      style={btnIcon(bg, '#EF4444')}
                    ><Trash2 size={14} /></button>
                  </>
                )}
              </div>
            </div>
            {isEditing ? (
              <textarea
                style={{ ...inp(bg), width: '100%', minHeight: 140, fontFamily: 'inherit', fontSize: '0.9rem', lineHeight: 1.7 }}
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
              />
            ) : (
              <pre style={{
                whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.9rem',
                color: bg.ink, lineHeight: 1.7, margin: 0,
              }}>{item.content}</pre>
            )}
            {item.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.55rem' }}>
                {item.tags.map(t => (
                  <span key={t} style={{
                    background: meta.color + '18', color: meta.color,
                    padding: '0.15rem 0.55rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600,
                  }}>#{t}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function chip(bg: IrisBackgroundDef, active: boolean, color?: string): React.CSSProperties {
  const c = color ?? bg.accent;
  return {
    background: active ? c : 'rgba(255,255,255,0.6)',
    color: active ? '#fff' : bg.ink,
    border: `1px solid ${active ? c : bg.cardBorder}`,
    borderRadius: 999,
    padding: '0.35rem 0.8rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: IRIS_FONTS.body,
  };
}

function btnIcon(bg: IrisBackgroundDef, color?: string): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.6)',
    color: color ?? bg.ink,
    border: `1px solid ${bg.cardBorder}`,
    borderRadius: 10,
    padding: '0.35rem 0.55rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: IRIS_FONTS.body,
    display: 'inline-flex', alignItems: 'center', gap: 4,
  };
}
