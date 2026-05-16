// ============================================================
// ContentEngineStudio — CORE で CORE のマーケを自動化する
// 1 つのテーマから note 記事 + X スレッド を 1 クリックで同時生成
// 「分かりやすさ」優先のシンプルな 3 ステップ UI
// ============================================================
import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { Persona, AppSettings, KnowledgeItem } from '../types/identity';
import { generateNoteArticle, generateXPost, TONE_OPTIONS, type SocialTone } from '../lib/socialDraft';

interface Props {
  persona: Persona;
  settings: AppSettings;
  knowledge: KnowledgeItem[];
  onClose: () => void;
}

interface History {
  id: string;
  topic: string;
  noteTitle: string;
  noteBody: string;
  xThread: string[];
  hashtags: string[];
  generatedAt: number;
}

const KEY_HISTORY = 'core_content_engine_history_v1';

function loadHistory(): History[] {
  try {
    const raw = localStorage.getItem(KEY_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveHistory(items: History[]) {
  try { localStorage.setItem(KEY_HISTORY, JSON.stringify(items.slice(0, 30))); } catch { /* */ }
}

const SAMPLE_TOPICS = [
  '昨日学んだ顧客の本音と気づき',
  'AI で自動化したらビジネスが変わった瞬間',
  '今週の決断とその理由',
  '人を採用するときに見るたった 1 つのこと',
  'ローンチ前夜に思ったこと',
  '失敗から学んだお金の使い方',
];

export default function ContentEngineStudio({ persona, settings, knowledge, onClose }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState<SocialTone>('storytelling');
  const [history, setHistory] = useState<History[]>(() => loadHistory());

  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [xThread, setXThread] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);

  const [progress, setProgress] = useState<'note' | 'x' | 'done' | null>(null);
  const [isGen, setIsGen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const personaKnowledge = knowledge.filter(k => k.personaId === persona.id);

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) {
      setError('テーマを入力してください');
      return;
    }
    setIsGen(true);
    setError(null);
    setStep(2);
    try {
      // 1) note 記事生成
      setProgress('note');
      const noteDraft = await generateNoteArticle({
        topic, tone,
        persona, settings,
        knowledge: personaKnowledge.slice(0, 6),
        targetWords: 1500,
      });
      setNoteTitle(noteDraft.title || topic);
      setNoteBody(noteDraft.body);

      // 2) X スレッド生成
      setProgress('x');
      const xDraft = await generateXPost({
        topic, tone,
        customInstruction: '同じテーマの note 記事と連動するスレッド形式で',
        persona, settings,
        knowledge: personaKnowledge.slice(0, 4),
        threadCount: 5,
      });
      const thread = xDraft.posts && xDraft.posts.length > 0 ? xDraft.posts : [xDraft.body];
      setXThread(thread);
      setHashtags(noteDraft.tags || []);

      // 3) 履歴に保存
      const item: History = {
        id: `h_${Date.now()}`,
        topic,
        noteTitle: noteDraft.title || topic,
        noteBody: noteDraft.body,
        xThread: thread,
        hashtags: noteDraft.tags || [],
        generatedAt: Date.now(),
      };
      const next = [item, ...history];
      setHistory(next);
      saveHistory(next);

      setProgress('done');
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep(1);
    } finally {
      setIsGen(false);
    }
  }, [topic, tone, persona, settings, personaKnowledge, history]);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch { /* */ }
  };

  const accent = persona.accentColor;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-2 md:p-6"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        className="cp-modal w-full max-w-3xl overflow-y-auto"
        style={{
          background: 'var(--surface-1, #0e0e15)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 18,
          color: 'var(--fg)',
          maxHeight: 'calc(100dvh - 1.5rem)',
        }}
      >
        {/* ヘッダ */}
        <header style={{
          padding: 'max(1rem, calc(env(safe-area-inset-top, 0px) + 0.5rem)) max(1rem, calc(env(safe-area-inset-right, 0px) + 0.75rem)) 1rem 1.25rem',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: `linear-gradient(135deg, ${accent}18, transparent 60%)`,
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          position: 'sticky', top: 0, zIndex: 5, backdropFilter: 'blur(12px)',
        }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', background: `linear-gradient(135deg, ${accent}, ${accent}99)`, boxShadow: `0 6px 18px ${accent}55`, flexShrink: 0 }}>
            📡
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--fg-muted)', fontWeight: 600 }}>CONTENT ENGINE</p>
            <h2 style={{ fontSize: '0.98rem', fontWeight: 700, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>note × X 同時生成</h2>
          </div>
          <button onClick={onClose} aria-label="閉じる" className="hover:text-fg" style={{ width: 40, height: 40, minWidth: 40, borderRadius: 999, color: 'var(--fg)', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', fontSize: 20, lineHeight: 1, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </header>

        {/* ステップインジケータ */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {(['テーマを入力', '生成', 'コピー&投稿'] as const).map((label, i) => {
              const num = (i + 1) as 1 | 2 | 3;
              const active = step === num;
              const done = step > num;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: done ? '#22c55e' : active ? accent : 'rgba(255,255,255,0.08)',
                    color: done || active ? '#fff' : 'var(--fg-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', fontWeight: 800, flexShrink: 0,
                  }}>{done ? '✓' : num}</div>
                  <span style={{ fontSize: '0.78rem', color: active ? 'var(--fg)' : 'var(--fg-muted)', fontWeight: active ? 700 : 500 }}>{label}</span>
                  {i < 2 && <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── STEP 1: テーマ入力 ─── */}
        {step === 1 && (
          <div style={{ padding: '1.5rem' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: '1rem', lineHeight: 1.7 }}>
              テーマを 1 つ入れるだけ。AI が <strong style={{ color: 'var(--fg)' }}>note 記事</strong>と
              <strong style={{ color: 'var(--fg)' }}> X スレッド</strong>を同時に作ります。
            </p>

            <label style={{ fontSize: 11, letterSpacing: '0.15em', color: 'var(--fg-muted)', fontWeight: 700 }}>テーマ</label>
            <textarea
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="例: 昨日の商談で気づいた、刺さる提案の共通点"
              rows={3}
              style={{
                width: '100%', marginTop: 6, padding: '0.85rem 1rem',
                borderRadius: 10, background: 'var(--surface-3)', border: '1px solid var(--border)',
                color: 'var(--fg)', resize: 'none', fontSize: '16px',
              }}
            />

            {/* サンプル */}
            <p style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 14, marginBottom: 6 }}>↓ ここから選んでもいいです</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SAMPLE_TOPICS.map((s, i) => (
                <button key={i} onClick={() => setTopic(s)} style={{
                  fontSize: '0.78rem', padding: '0.45rem 0.75rem', borderRadius: 999,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--fg)', cursor: 'pointer',
                }}>{s}</button>
              ))}
            </div>

            <label style={{ fontSize: 11, letterSpacing: '0.15em', color: 'var(--fg-muted)', fontWeight: 700, display: 'block', marginTop: 18 }}>トーン</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {TONE_OPTIONS.map(t => (
                <button key={t.value} onClick={() => setTone(t.value)} style={{
                  fontSize: '0.82rem', padding: '0.5rem 0.9rem', borderRadius: 8,
                  background: tone === t.value ? accent : 'rgba(255,255,255,0.04)',
                  border: tone === t.value ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  color: tone === t.value ? '#fff' : 'var(--fg)',
                  cursor: 'pointer', fontWeight: 600,
                }}>{t.emoji} {t.label}</button>
              ))}
            </div>

            {error && (
              <p style={{ marginTop: 12, padding: '0.6rem 0.85rem', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, color: '#fca5a5', fontSize: '0.82rem' }}>
                ⚠ {error}
              </p>
            )}

            <button
              onClick={handleGenerate}
              disabled={isGen || !topic.trim()}
              style={{
                width: '100%', marginTop: 22, padding: '0.95rem',
                background: topic.trim() ? `linear-gradient(135deg, ${accent}, ${accent}cc)` : 'var(--surface-3)',
                color: topic.trim() ? '#fff' : 'var(--fg-muted)',
                border: 'none', borderRadius: 12,
                fontSize: '0.95rem', fontWeight: 800, letterSpacing: '0.08em',
                cursor: topic.trim() ? 'pointer' : 'not-allowed',
                boxShadow: topic.trim() ? `0 8px 24px ${accent}55` : 'none',
              }}
            >
              ✨ note と X を同時に生成する
            </button>
          </div>
        )}

        {/* ─── STEP 2: 生成中 ─── */}
        {step === 2 && (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
            <motion.div
              animate={{ scale: [1, 1.1, 1], rotate: [0, 4, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                width: 90, height: 90, borderRadius: '50%',
                background: `radial-gradient(circle, ${accent} 0%, ${accent}66 60%, transparent 100%)`,
                margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36,
              }}
            >📡</motion.div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 8 }}>
              {progress === 'note' ? '📝 note 記事を執筆中…'
                : progress === 'x' ? '🐦 X スレッドを構成中…'
                : '✓ 生成完了'}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', lineHeight: 1.9 }}>
              人格「{persona.name}」の口調で、ナレッジを参照しています。
              <br />30 秒〜 1 分ほどお待ちください。
            </p>
          </div>
        )}

        {/* ─── STEP 3: 結果 + コピー&投稿 ─── */}
        {step === 3 && (
          <div style={{ padding: '1.5rem' }}>
            {/* note セクション */}
            <section style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '1.2rem' }}>📝</span> note 記事
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>{noteBody.length} 字</span>
              </div>
              <input
                value={noteTitle}
                onChange={e => setNoteTitle(e.target.value)}
                style={{ width: '100%', padding: '0.7rem 0.95rem', borderRadius: 10, background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: '0.95rem', fontWeight: 700, marginBottom: 8 }}
              />
              <textarea
                value={noteBody}
                onChange={e => setNoteBody(e.target.value)}
                rows={8}
                style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: 10, background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: '0.88rem', lineHeight: 1.85, resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  onClick={() => copy(`# ${noteTitle}\n\n${noteBody}\n\n${hashtags.map(h => '#' + h).join(' ')}`, 'note')}
                  style={{ flex: 1, padding: '0.7rem', background: accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  {copiedKey === 'note' ? '✓ コピーしました' : '📋 全文をコピー'}
                </button>
                <a
                  href="https://note.com/notes/new"
                  target="_blank"
                  rel="noopener"
                  style={{ flex: 1, padding: '0.7rem', textAlign: 'center', background: 'rgba(255,255,255,0.06)', color: 'var(--fg)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none' }}
                >
                  ↗ note を開いて貼付け
                </a>
              </div>
            </section>

            {/* X スレッド セクション */}
            <section style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '1.2rem' }}>🐦</span> X スレッド ({xThread.length}本)
                </h3>
                <button
                  onClick={() => copy(xThread.map((t, i) => `${i + 1}/${xThread.length}\n${t}`).join('\n\n---\n\n'), 'x-all')}
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', background: accent, color: '#fff', border: 'none', borderRadius: 999, cursor: 'pointer', fontWeight: 700 }}
                >
                  {copiedKey === 'x-all' ? '✓' : '📋 全部コピー'}
                </button>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {xThread.map((t, i) => (
                  <div key={i} style={{ padding: '0.85rem 1rem', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--fg-muted)', fontFamily: 'monospace' }}>{i + 1}/{xThread.length}</span>
                      <span style={{ fontSize: '0.7rem', color: t.length > 140 ? '#fca5a5' : 'var(--fg-muted)' }}>{t.length}/140</span>
                    </div>
                    <p style={{ fontSize: '0.88rem', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{t}</p>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button
                        onClick={() => copy(t, `x-${i}`)}
                        style={{ fontSize: '0.72rem', padding: '0.35rem 0.7rem', background: 'rgba(255,255,255,0.08)', color: 'var(--fg)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, cursor: 'pointer' }}
                      >{copiedKey === `x-${i}` ? '✓' : 'コピー'}</button>
                      <a
                        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}`}
                        target="_blank"
                        rel="noopener"
                        style={{ fontSize: '0.72rem', padding: '0.35rem 0.7rem', background: 'rgba(255,255,255,0.04)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 6, textDecoration: 'none' }}
                      >↗ X で開く</a>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ハッシュタグ */}
            {hashtags.length > 0 && (
              <section style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, letterSpacing: '0.15em', color: 'var(--fg-muted)', fontWeight: 700, marginBottom: 6 }}>ハッシュタグ</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {hashtags.map((h, i) => (
                    <span key={i} style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', background: `${accent}22`, border: `1px solid ${accent}44`, borderRadius: 999, color: accent, fontWeight: 600 }}>#{h}</span>
                  ))}
                  <button
                    onClick={() => copy(hashtags.map(h => '#' + h).join(' '), 'tags')}
                    style={{ fontSize: '0.72rem', padding: '0.35rem 0.7rem', background: 'rgba(255,255,255,0.06)', color: 'var(--fg)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, cursor: 'pointer' }}
                  >{copiedKey === 'tags' ? '✓' : 'まとめてコピー'}</button>
                </div>
              </section>
            )}

            {/* リセットボタン */}
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button
                onClick={() => { setStep(1); setTopic(''); setNoteTitle(''); setNoteBody(''); setXThread([]); setHashtags([]); }}
                style={{ flex: 1, padding: '0.7rem', background: 'rgba(255,255,255,0.04)', color: 'var(--fg)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
              >🔄 別のテーマでもう一度</button>
              <button
                onClick={onClose}
                style={{ flex: 1, padding: '0.7rem', background: accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
              >完了</button>
            </div>
          </div>
        )}

        {/* 履歴 */}
        {history.length > 0 && step === 1 && (
          <div style={{ padding: '0 1.5rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 0 }}>
            <p style={{ fontSize: 11, letterSpacing: '0.15em', color: 'var(--fg-muted)', fontWeight: 700, padding: '1rem 0 6px' }}>過去の生成履歴</p>
            <div style={{ display: 'grid', gap: 6 }}>
              {history.slice(0, 5).map(h => (
                <button key={h.id} onClick={() => {
                  setTopic(h.topic);
                  setNoteTitle(h.noteTitle);
                  setNoteBody(h.noteBody);
                  setXThread(h.xThread);
                  setHashtags(h.hashtags);
                  setStep(3);
                }} style={{
                  textAlign: 'left', padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, cursor: 'pointer', color: 'var(--fg)',
                }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{h.noteTitle || h.topic}</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--fg-muted)', marginTop: 2 }}>
                    {new Date(h.generatedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · X {h.xThread.length}本
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
