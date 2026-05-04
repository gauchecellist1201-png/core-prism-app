// ============================================================
// IRIS — Strategist View (戦略スタジオ)
// 投稿履歴 / 分析 / 次の提案 / 30日プラン
// ============================================================
import { useState } from 'react';
import type { AppSettings } from '../types/identity';
import type { MediaKit, Platform, ContentType } from '../types/influencerDeal';
import { PLATFORM_META, CONTENT_TYPE_META } from '../types/influencerDeal';
import {
  usePostHistory, analyzePerformance, feedbackPost, suggestNextPosts, generateStoryArc,
  type PostHistoryItem, type PerformanceAnalysis, type NextPostSuggestion, type StoryArc,
} from './strategist';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';

interface Props {
  bg: IrisBackgroundDef;
  settings: AppSettings;
  mediaKit?: MediaKit;
}

type SubTab = 'history' | 'analyze' | 'suggest' | 'arc';

export default function IrisStrategistView({ bg, settings, mediaKit }: Props) {
  const history = usePostHistory();
  const [sub, setSub] = useState<SubTab>('history');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const inp: React.CSSProperties = {
    background: 'rgba(255,255,255,0.94)',
    border: `1px solid ${bg.cardBorder}`,
    color: '#1F1A2E',
    padding: '0.7rem 1rem',
    borderRadius: 12,
    fontSize: '0.92rem',
    fontFamily: IRIS_FONTS.body,
    outline: 'none',
  };
  const card: React.CSSProperties = {
    background: bg.card,
    backdropFilter: 'blur(10px)',
    border: `1px solid ${bg.cardBorder}`,
    borderRadius: 22,
    padding: '1.4rem',
  };
  const btnPrimary: React.CSSProperties = {
    background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
    color: '#fff',
    border: 'none',
    borderRadius: 999,
    padding: '0.75rem 1.6rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.88rem',
    fontFamily: IRIS_FONTS.body,
    boxShadow: `0 8px 22px ${bg.accent}55`,
  };
  const btnSecondary: React.CSSProperties = {
    background: 'rgba(255,255,255,0.6)',
    color: bg.ink,
    border: `1px solid ${bg.cardBorder}`,
    borderRadius: 999,
    padding: '0.65rem 1.4rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontFamily: IRIS_FONTS.body,
  };

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      {/* 見出し */}
      <div>
        <p style={{
          fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
          fontSize: '0.78rem', letterSpacing: '0.3em',
          textTransform: 'uppercase', color: bg.accent, marginBottom: '0.4rem',
        }}>
          The Strategist
        </p>
        <h2 style={{
          fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
          fontSize: 'clamp(2rem, 4vw, 2.6rem)', color: bg.ink,
          margin: 0, fontWeight: 500, letterSpacing: '-0.01em',
        }}>
          戦略スタジオ
        </h2>
        <p style={{ color: bg.inkSoft, fontSize: '0.92rem', marginTop: '0.4rem' }}>
          投稿履歴を入れると、伸びた要因/苦戦要因/次の一本/30日プランを AI が出力します。
        </p>
      </div>

      {/* サブタブ */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {[
          { id: 'history' as SubTab,  e: '📚', l: '投稿履歴' },
          { id: 'analyze' as SubTab,  e: '📊', l: '分析' },
          { id: 'suggest' as SubTab,  e: '✨', l: '次の提案' },
          { id: 'arc' as SubTab,      e: '🌙', l: '30日プラン' },
        ].map(t => (
          <button key={t.id} onClick={() => setSub(t.id)} style={{
            background: sub === t.id ? `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)` : 'rgba(255,255,255,0.92)',
            color: sub === t.id ? '#FFFFFF' : '#1F1A2E',
            border: sub === t.id ? 'none' : '1px solid rgba(31,26,46,0.08)',
            borderRadius: 999, padding: '0.5rem 1.1rem',
            fontSize: '0.85rem', fontWeight: sub === t.id ? 700 : 600,
            cursor: 'pointer',
            fontFamily: IRIS_FONTS.body,
            boxShadow: sub === t.id ? `0 6px 18px ${bg.accent}55` : '0 1px 3px rgba(31,26,46,0.06)',
          }}>
            <span style={{ marginRight: 6 }}>{t.e}</span>{t.l}
          </button>
        ))}
      </div>

      {err && (
        <div style={{ ...card, borderColor: '#C8102E' }}>
          <p style={{ color: '#C8102E' }}>⚠ {err}</p>
        </div>
      )}

      {sub === 'history' && (
        <HistoryTab bg={bg} history={history} inp={inp} card={card} btnPrimary={btnPrimary} />
      )}
      {sub === 'analyze' && (
        <AnalyzeTab bg={bg} settings={settings} history={history} mediaKit={mediaKit}
          card={card} btnPrimary={btnPrimary} btnSecondary={btnSecondary}
          busy={busy} setBusy={setBusy} setErr={setErr} />
      )}
      {sub === 'suggest' && (
        <SuggestTab bg={bg} settings={settings} history={history} mediaKit={mediaKit}
          card={card} btnPrimary={btnPrimary}
          busy={busy} setBusy={setBusy} setErr={setErr} />
      )}
      {sub === 'arc' && (
        <ArcTab bg={bg} settings={settings} history={history} mediaKit={mediaKit}
          card={card} btnPrimary={btnPrimary} inp={inp}
          busy={busy} setBusy={setBusy} setErr={setErr} />
      )}
    </div>
  );
}

// ─── 投稿履歴タブ ─────────────────────────
function HistoryTab({ bg, history, inp, card, btnPrimary }: any) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<PostHistoryItem>>({
    postedAt: new Date().toISOString().slice(0, 16),
    platform: 'instagram', contentType: 'reel',
    title: '', metrics: {},
  });

  const add = () => {
    if (!draft.title?.trim()) return;
    history.add({
      postedAt: new Date(draft.postedAt || Date.now()).toISOString(),
      platform: (draft.platform || 'instagram') as Platform,
      contentType: (draft.contentType || 'post') as ContentType,
      title: draft.title!,
      caption: draft.caption,
      tags: draft.tags,
      topic: draft.topic,
      brand: draft.brand,
      url: draft.url,
      notes: draft.notes,
      metrics: draft.metrics || {},
    });
    setDraft({
      postedAt: new Date().toISOString().slice(0, 16),
      platform: 'instagram', contentType: 'reel',
      title: '', metrics: {},
    });
    setOpen(false);
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: '0.95rem', color: bg.inkSoft }}>
          {history.posts.length} 件の投稿
        </p>
        <button onClick={() => setOpen(!open)} style={btnPrimary}>
          {open ? '閉じる' : '+ 投稿実績を追加'}
        </button>
      </div>

      {open && (
        <div style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
            <input style={inp} placeholder="タイトル *" value={draft.title || ''} onChange={e => setDraft({ ...draft, title: e.target.value })} />
            <input style={inp} type="datetime-local" value={draft.postedAt || ''} onChange={e => setDraft({ ...draft, postedAt: e.target.value })} />
            <select style={inp} value={draft.platform} onChange={e => setDraft({ ...draft, platform: e.target.value as Platform })}>
              {Object.entries(PLATFORM_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
            </select>
            <select style={inp} value={draft.contentType} onChange={e => setDraft({ ...draft, contentType: e.target.value as ContentType })}>
              {Object.entries(CONTENT_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input style={inp} placeholder="トピック (例: コスメ)" value={draft.topic || ''} onChange={e => setDraft({ ...draft, topic: e.target.value })} />
            <input style={inp} placeholder="ブランド (PR の場合)" value={draft.brand || ''} onChange={e => setDraft({ ...draft, brand: e.target.value })} />
            <input style={inp} placeholder="URL" value={draft.url || ''} onChange={e => setDraft({ ...draft, url: e.target.value })} />
            <input style={inp} placeholder="ハッシュタグ" onChange={e => setDraft({ ...draft, tags: e.target.value.split(/\s+/).filter(Boolean) })} />
          </div>
          <p style={{ fontSize: '0.78rem', color: bg.inkSoft, marginTop: '0.75rem', marginBottom: '0.4rem' }}>数字</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem' }}>
            {[
              ['reach', 'リーチ'],
              ['impressions', 'インプ'],
              ['engagementRate', 'ER (%)'],
              ['likes', 'いいね'],
              ['comments', 'コメント'],
              ['saves', '保存'],
              ['shares', 'シェア'],
              ['views', '再生'],
            ].map(([k, label]) => (
              <input key={k} style={inp} type="number" placeholder={label}
                value={(draft.metrics as any)?.[k] || ''}
                onChange={e => setDraft({ ...draft, metrics: { ...(draft.metrics || {}), [k]: Number(e.target.value) || undefined } })} />
            ))}
          </div>
          <button onClick={add} style={{ ...btnPrimary, marginTop: '0.75rem' }}>保存</button>
        </div>
      )}

      {history.posts.length === 0 && (
        <div style={card}>
          <p style={{ textAlign: 'center', color: bg.inkSoft, padding: '2rem 0', lineHeight: 1.8 }}>
            📚 まだ投稿実績がありません。<br />
            過去 5-10 本の投稿を入れると、AI が伸びパターンを分析してくれます。
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
        {history.posts.map((p: PostHistoryItem) => {
          const m = p.metrics;
          return (
            <div key={p.id} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '1.1rem' }}>{PLATFORM_META[p.platform].emoji}</span>
                <span style={{ fontSize: '0.78rem', color: bg.inkSoft }}>
                  {new Date(p.postedAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                {p.brand && <span style={{ background: bg.accent + '22', color: bg.accent, padding: '0.15rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600 }}>PR: {p.brand}</span>}
              </div>
              <p style={{ fontWeight: 700, color: bg.ink, marginBottom: '0.3rem', fontSize: '1rem' }}>{p.title}</p>
              <p style={{ fontSize: '0.78rem', color: bg.inkSoft, marginBottom: '0.5rem' }}>
                {CONTENT_TYPE_META[p.contentType]}{p.topic ? ` · ${p.topic}` : ''}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.3rem 0.6rem', fontSize: '0.78rem', marginTop: '0.4rem' }}>
                {m.reach !== undefined && <span style={{ color: bg.inkSoft }}>👁 {m.reach.toLocaleString()}</span>}
                {m.engagementRate !== undefined && <span style={{ color: bg.accent, fontWeight: 700 }}>ER {m.engagementRate}%</span>}
                {m.likes !== undefined && <span style={{ color: bg.inkSoft }}>❤ {m.likes.toLocaleString()}</span>}
                {m.comments !== undefined && <span style={{ color: bg.inkSoft }}>💬 {m.comments.toLocaleString()}</span>}
                {m.saves !== undefined && <span style={{ color: bg.inkSoft }}>🔖 {m.saves.toLocaleString()}</span>}
                {m.shares !== undefined && <span style={{ color: bg.inkSoft }}>📤 {m.shares.toLocaleString()}</span>}
              </div>
              <button onClick={() => { if (confirm('削除しますか?')) history.remove(p.id); }} style={{
                background: 'transparent', border: 'none', color: bg.inkSoft,
                cursor: 'pointer', fontSize: '0.78rem', marginTop: '0.5rem', padding: 0,
              }}>削除</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 分析タブ ────────────────────────────
function AnalyzeTab({ bg, settings, history, mediaKit, card, btnPrimary, btnSecondary, busy, setBusy, setErr }: any) {
  const [result, setResult] = useState<PerformanceAnalysis | null>(null);
  const [singleFb, setSingleFb] = useState<{ pid: string; r: any } | null>(null);

  const run = async () => {
    if (history.posts.length === 0) { setErr('まず投稿実績を追加してください'); return; }
    setBusy(true); setErr(null);
    try {
      setResult(await analyzePerformance({ settings, posts: history.posts, mediaKit }));
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const fbOne = async (p: PostHistoryItem) => {
    setBusy(true); setErr(null);
    try {
      const r = await feedbackPost({ settings, post: p, mediaKit });
      setSingleFb({ pid: p.id, r });
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={card}>
        <p style={{ color: bg.ink, marginBottom: '0.75rem' }}>
          投稿履歴 {history.posts.length} 件を AI が分析します。
        </p>
        <button onClick={run} disabled={busy || history.posts.length === 0} style={btnPrimary}>
          {busy ? '分析中…' : '✨ 全体パフォーマンスを分析'}
        </button>
      </div>

      {result && (
        <>
          <div style={card}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.5rem' }}>
              Summary
            </p>
            <p style={{ color: bg.ink, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{result.summary}</p>
          </div>

          {result.topPosts.length > 0 && (
            <div style={card}>
              <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#10B981', marginBottom: '0.75rem' }}>
                ✨ 伸びた投稿
              </p>
              {result.topPosts.map((p, i) => (
                <div key={i} style={{ paddingBottom: '0.6rem', marginBottom: '0.6rem', borderBottom: `1px solid ${bg.cardBorder}` }}>
                  <p style={{ fontWeight: 700, color: bg.ink }}>{p.title}</p>
                  <p style={{ fontSize: '0.85rem', color: bg.inkSoft, marginTop: '0.25rem', lineHeight: 1.7 }}>{p.whyItWorked}</p>
                </div>
              ))}
            </div>
          )}

          {result.underPosts.length > 0 && (
            <div style={card}>
              <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#FFA94D', marginBottom: '0.75rem' }}>
                🤔 苦戦した投稿
              </p>
              {result.underPosts.map((p, i) => (
                <div key={i} style={{ paddingBottom: '0.6rem', marginBottom: '0.6rem', borderBottom: `1px solid ${bg.cardBorder}` }}>
                  <p style={{ fontWeight: 700, color: bg.ink }}>{p.title}</p>
                  <p style={{ fontSize: '0.85rem', color: bg.inkSoft, marginTop: '0.25rem', lineHeight: 1.7 }}>{p.whyItStruggled}</p>
                </div>
              ))}
            </div>
          )}

          {result.patterns.length > 0 && (
            <div style={card}>
              <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.75rem' }}>
                Patterns
              </p>
              {result.patterns.map((p, i) => (
                <div key={i} style={{ marginBottom: '0.6rem' }}>
                  <p style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{
                      background: p.impact === 'high' ? '#10B981' : p.impact === 'medium' ? '#FFA94D' : '#9CA3AF',
                      color: '#fff', padding: '0.15rem 0.5rem', borderRadius: 999,
                      fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                    }}>{p.impact}</span>
                    <span style={{ fontWeight: 700, color: bg.ink }}>{p.factor}</span>
                  </p>
                  <p style={{ fontSize: '0.85rem', color: bg.inkSoft, marginTop: '0.25rem', lineHeight: 1.7 }}>{p.insight}</p>
                </div>
              ))}
            </div>
          )}

          {result.quickWins.length > 0 && (
            <div style={card}>
              <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.75rem' }}>
                💡 Quick Wins (今すぐやれる)
              </p>
              <ol style={{ paddingLeft: '1.2rem', color: bg.ink, lineHeight: 1.9 }}>
                {result.quickWins.map((q, i) => <li key={i}>{q}</li>)}
              </ol>
            </div>
          )}

          {result.growthForecast && (
            <div style={card}>
              <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.5rem' }}>
                30日後の予測
              </p>
              <p style={{ color: bg.ink, lineHeight: 1.8 }}>{result.growthForecast}</p>
            </div>
          )}
        </>
      )}

      {/* 個別投稿フィードバック */}
      <div style={card}>
        <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.75rem' }}>
          単発フィードバック
        </p>
        <p style={{ color: bg.inkSoft, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
          1 投稿だけ深掘りしたいときに使います。
        </p>
        {history.posts.slice(0, 5).map((p: PostHistoryItem) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.5rem 0', borderBottom: `1px solid ${bg.cardBorder}` }}>
            <span style={{ fontSize: '0.9rem', color: bg.ink, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {PLATFORM_META[p.platform].emoji} {p.title}
            </span>
            <button onClick={() => fbOne(p)} disabled={busy} style={{ ...btnSecondary, padding: '0.3rem 0.9rem', fontSize: '0.78rem' }}>
              FB
            </button>
          </div>
        ))}
        {singleFb && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: 12, background: 'rgba(255,255,255,0.5)' }}>
            <p style={{ fontWeight: 700, color: bg.ink }}>{singleFb.r.verdict}</p>
            {singleFb.r.goodPoints?.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <p style={{ fontSize: '0.78rem', color: '#10B981', fontWeight: 700 }}>👍 良い</p>
                <ul style={{ paddingLeft: '1.2rem', color: bg.inkSoft, fontSize: '0.85rem' }}>
                  {singleFb.r.goodPoints.map((g: string, i: number) => <li key={i}>{g}</li>)}
                </ul>
              </div>
            )}
            {singleFb.r.improvements?.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <p style={{ fontSize: '0.78rem', color: '#FFA94D', fontWeight: 700 }}>🔧 改善</p>
                <ul style={{ paddingLeft: '1.2rem', color: bg.inkSoft, fontSize: '0.85rem' }}>
                  {singleFb.r.improvements.map((g: string, i: number) => <li key={i}>{g}</li>)}
                </ul>
              </div>
            )}
            {singleFb.r.nextVariation && (
              <p style={{ marginTop: '0.5rem', color: bg.accent, fontStyle: 'italic' }}>
                → {singleFb.r.nextVariation}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 次の提案タブ ────────────────────────
function SuggestTab({ bg, settings, history, mediaKit, card, btnPrimary, busy, setBusy, setErr }: any) {
  const [count, setCount] = useState(3);
  const [result, setResult] = useState<NextPostSuggestion[] | null>(null);

  const run = async () => {
    if (history.posts.length === 0) { setErr('まず投稿実績を追加してください'); return; }
    setBusy(true); setErr(null);
    try {
      setResult(await suggestNextPosts({ settings, posts: history.posts, mediaKit, count }));
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={card}>
        <p style={{ color: bg.ink, marginBottom: '0.75rem' }}>
          実績ベースで、次に出すべき投稿を AI が提案します。
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={count} onChange={e => setCount(Number(e.target.value))}
            style={{ background: 'rgba(255,255,255,0.94)', border: `1px solid ${bg.cardBorder}`, color: '#1F1A2E', padding: '0.5rem 0.9rem', borderRadius: 12, fontFamily: IRIS_FONTS.body }}>
            <option value={3}>3 本</option>
            <option value={5}>5 本</option>
            <option value={7}>7 本</option>
          </select>
          <button onClick={run} disabled={busy || history.posts.length === 0} style={btnPrimary}>
            {busy ? '提案中…' : '✨ 次の投稿を提案'}
          </button>
        </div>
      </div>

      {result && result.map((s, i) => (
        <div key={i} style={{ ...card, borderLeft: `4px solid ${bg.accent}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <p style={{
              fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
              fontSize: '0.78rem', letterSpacing: '0.25em', textTransform: 'uppercase',
              color: bg.accent,
            }}>
              No. {String(i + 1).padStart(2, '0')}
            </p>
            <span style={{ fontSize: '0.75rem', color: bg.inkSoft }}>
              {PLATFORM_META[s.platform].emoji} {PLATFORM_META[s.platform].label} / {CONTENT_TYPE_META[s.contentType]}
            </span>
          </div>
          <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '1.5rem', fontWeight: 600, color: bg.ink, lineHeight: 1.2, marginBottom: '0.5rem' }}>
            {s.title}
          </p>
          <p style={{ color: bg.accent, fontWeight: 600, marginBottom: '0.5rem' }}>
            HOOK: {s.hook}
          </p>
          <p style={{ color: bg.inkSoft, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            <strong>📅 おすすめ投稿日時:</strong> {s.bestTimeJST}
          </p>
          <p style={{ color: bg.inkSoft, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            <strong>📍 トピック:</strong> {s.topic}
          </p>
          <p style={{ color: bg.inkSoft, fontSize: '0.85rem', marginBottom: '0.5rem', lineHeight: 1.7 }}>
            <strong>なぜ今これ?</strong> {s.rationale}
          </p>
          <div style={{ background: 'rgba(255,255,255,0.5)', padding: '0.75rem', borderRadius: 12, marginTop: '0.5rem' }}>
            <p style={{ fontSize: '0.78rem', color: bg.inkSoft, fontWeight: 700, marginBottom: '0.3rem' }}>📝 撮影ブリーフ</p>
            <p style={{ color: bg.ink, fontSize: '0.88rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{s.brief}</p>
          </div>
          {s.hashtagsHint?.length > 0 && (
            <p style={{ marginTop: '0.5rem', color: bg.accent, fontSize: '0.85rem' }}>
              {s.hashtagsHint.join(' ')}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── 30日プランタブ ──────────────────────
function ArcTab({ bg, settings, history, mediaKit, card, btnPrimary, inp, busy, setBusy, setErr }: any) {
  const [goal, setGoal] = useState('フォロワー +5,000 / コラボ案件 3 件獲得');
  const [result, setResult] = useState<StoryArc | null>(null);

  const run = async () => {
    if (!goal.trim()) return;
    setBusy(true); setErr(null);
    try {
      setResult(await generateStoryArc({ settings, goal, posts: history.posts, mediaKit }));
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={card}>
        <p style={{ color: bg.ink, marginBottom: '0.5rem', fontSize: '0.95rem' }}>
          30日 = 4週で展開する「ストーリーアーク」を AI が脚本します。
        </p>
        <textarea style={{ ...inp, width: '100%', minHeight: 60, marginBottom: '0.5rem' }}
          placeholder="30日でやり遂げたいゴール"
          value={goal} onChange={e => setGoal(e.target.value)} />
        <button onClick={run} disabled={busy} style={btnPrimary}>
          {busy ? '脚本中…' : '✨ 30日プランを設計'}
        </button>
      </div>

      {result && (
        <>
          <div style={card}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.5rem' }}>
              Concept
            </p>
            <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '1.6rem', fontWeight: 600, color: bg.ink, lineHeight: 1.2 }}>
              {result.conceptName}
            </p>
            <p style={{ color: bg.inkSoft, marginTop: '0.5rem', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {result.conceptDescription}
            </p>
          </div>

          {result.weeks?.map((w, wi) => (
            <div key={wi} style={card}>
              <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.4rem' }}>
                Week {w.weekNum}
              </p>
              <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '1.3rem', fontWeight: 600, color: bg.ink, marginBottom: '0.75rem' }}>
                {w.theme}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {w.posts?.map((p, pi) => (
                  <div key={pi} style={{
                    display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                    padding: '0.6rem 0.75rem', borderRadius: 12,
                    background: 'rgba(255,255,255,0.5)',
                  }}>
                    <span style={{
                      minWidth: 50, fontSize: '0.78rem', fontWeight: 700,
                      color: bg.accent, fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
                    }}>
                      {p.day}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: bg.inkSoft, minWidth: 50 }}>
                      {CONTENT_TYPE_META[p.type as ContentType] || p.type}
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, color: bg.ink, fontSize: '0.92rem' }}>{p.title}</p>
                      <p style={{ color: bg.inkSoft, fontSize: '0.78rem', marginTop: '0.2rem' }}>{p.purpose}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ ...card, background: bg.accent + '11', borderColor: bg.accent + '44' }}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.5rem' }}>
              Culmination
            </p>
            <p style={{ color: bg.ink, fontSize: '1rem', lineHeight: 1.8 }}>
              {result.culmination}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
