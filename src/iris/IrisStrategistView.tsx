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
import { extractInstagramHandle, analyzeInstagramProfile, type IGAnalysisResult } from './instagramAnalyzer';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import VoiceInputButton from '../components/VoiceInputButton';

interface Props {
  bg: IrisBackgroundDef;
  settings: AppSettings;
  mediaKit?: MediaKit;
}

type SubTab = 'ig' | 'history' | 'analyze' | 'suggest' | 'arc';

export default function IrisStrategistView({ bg, settings, mediaKit }: Props) {
  const history = usePostHistory();
  const [sub, setSub] = useState<SubTab>('ig');
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
          { id: 'ig' as SubTab,       e: '📸', l: 'Instagram解析' },
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

      {sub === 'ig' && (
        <IGAnalyzeTab bg={bg} settings={settings} card={card} btnPrimary={btnPrimary} inp={inp}
          busy={busy} setBusy={setBusy} setErr={setErr} />
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


// ─── Instagram 解析タブ (本気版) ──────────────────
function IGAnalyzeTab({ bg, settings, card, btnPrimary, inp, busy, setBusy, setErr }: any) {
  // モード切替: self (自分) / other (他者)
  const [mode, setMode] = useState<'self' | 'other'>('self');

  // 入力
  const [handle, setHandle] = useState('');
  const [pasted, setPasted] = useState('');
  const [note, setNote] = useState('');
  const [niche, setNiche] = useState('');
  const [goal, setGoal] = useState('');

  // 数値 (自分モードでは特に重要)
  const [followers, setFollowers] = useState('');
  const [following, setFollowing] = useState('');
  const [avgER, setAvgER] = useState('');
  const [monthlyReach, setMonthlyReach] = useState('');
  const [avgLikes, setAvgLikes] = useState('');
  const [avgComments, setAvgComments] = useState('');

  // 投稿サンプル (個別 5 件まで)
  const [samples, setSamples] = useState<{ url: string; caption: string; metrics: string }[]>([
    { url: '', caption: '', metrics: '' },
  ]);

  // 画像アップロード
  const [images, setImages] = useState<{ data: string; mediaType: string; preview: string }[]>([]);

  const [result, setResult] = useState<IGAnalysisResult | null>(null);

  // 画像追加
  const onAddImages = async (files: FileList | null) => {
    if (!files) return;
    const next: typeof images = [];
    for (let i = 0; i < files.length && images.length + next.length < 8; i++) {
      const f = files[i];
      if (!f.type.startsWith('image/')) continue;
      const reader = new FileReader();
      const dataUrl: string = await new Promise(res => {
        reader.onload = () => res(reader.result as string);
        reader.readAsDataURL(f);
      });
      // base64 部分だけ取り出し
      const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (m) {
        next.push({ mediaType: m[1], data: m[2], preview: dataUrl });
      }
    }
    setImages([...images, ...next]);
  };

  const run = async () => {
    const h = extractInstagramHandle(handle);
    if (!h) { setErr('Instagram の URL または @handle を入れてください'); return; }
    // 自分モードでは画像 or 数値 or ペーストのいずれかが必須
    if (mode === 'self' && images.length === 0 && !pasted.trim() && !followers) {
      setErr('スクリーンショット 1 枚以上、または数値・プロフィール文を入れてください');
      return;
    }
    if (mode === 'other' && !pasted.trim() && images.length === 0) {
      setErr('プロフィール文か、スクリーンショットを 1 枚以上添付してください');
      return;
    }
    setBusy(true); setErr(null);
    try {
      const knownMetrics = (followers || avgER || monthlyReach || avgLikes || avgComments || following) ? {
        followers: followers ? Number(followers) : undefined,
        following: following ? Number(following) : undefined,
        avgER: avgER ? Number(avgER) : undefined,
        monthlyReach: monthlyReach ? Number(monthlyReach) : undefined,
        avgLikes: avgLikes ? Number(avgLikes) : undefined,
        avgComments: avgComments ? Number(avgComments) : undefined,
      } : undefined;

      const postSamples = samples.filter(s => s.url || s.caption || s.metrics).map(s => ({
        url: s.url || undefined,
        caption: s.caption || undefined,
        metrics: s.metrics || undefined,
      }));

      const r = await analyzeInstagramProfile({
        settings,
        handle: h,
        pasted,
        selfNote: (mode === 'self' ? `[自分のアカウント詳細解析モード] ${note}` : note) || undefined,
        images: images.length > 0 ? images.map(({ data, mediaType }) => ({ data, mediaType })) : undefined,
        postSamples: postSamples.length > 0 ? postSamples : undefined,
        knownMetrics,
        niche: niche || undefined,
        goal: goal || undefined,
      });
      setResult(r);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* モード切替 */}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        {[
          { id: 'self' as const,  e: '🪞', l: '自分のアカウントを精密解析' },
          { id: 'other' as const, e: '🔍', l: '他のアカウントをリサーチ' },
        ].map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} style={{
            background: mode === m.id ? `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)` : 'rgba(255,255,255,0.92)',
            color: mode === m.id ? '#FFFFFF' : '#1F1A2E',
            border: mode === m.id ? 'none' : '1px solid rgba(31,26,46,0.08)',
            borderRadius: 999, padding: '0.65rem 1.4rem',
            fontSize: '0.92rem', fontWeight: mode === m.id ? 700 : 600,
            cursor: 'pointer', fontFamily: IRIS_FONTS.body,
            boxShadow: mode === m.id ? `0 6px 18px ${bg.accent}55` : 'none',
          }}>
            {m.e} {m.l}
          </button>
        ))}
      </div>

      {/* 自分モード: 連携バナー (Coming Soon) */}
      {mode === 'self' && (
        <div style={{
          ...card,
          background: `linear-gradient(135deg, ${bg.accent}11, ${bg.accent}22)`,
          borderColor: bg.accent + '44',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: `linear-gradient(135deg, #833AB4, #E1306C 50%, #F77737)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.6rem', flexShrink: 0,
            }}>📸</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '1.2rem', color: bg.ink, fontWeight: 600 }}>
                Instagram と連携 (Coming Soon)
              </p>
              <p style={{ color: bg.inkSoft, fontSize: '0.85rem', marginTop: '0.2rem', lineHeight: 1.6 }}>
                Meta 公式 API 連携で、ログインだけで全データを自動分析する機能を準備中。当面は<strong>スクショ + 数値</strong>でフル精度の解析が可能です。
              </p>
            </div>
            <button disabled style={{
              background: 'rgba(0,0,0,0.06)', color: bg.inkSoft,
              border: `1px solid ${bg.cardBorder}`, borderRadius: 999,
              padding: '0.6rem 1.2rem', fontWeight: 600, cursor: 'not-allowed',
              fontSize: '0.85rem', flexShrink: 0,
            }}>
              準備中
            </button>
          </div>
        </div>
      )}

      {/* Step 1: 基本情報 */}
      <div style={card}>
        <SectionHead bg={bg} step="01" title="基本情報" />
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.5rem' }}>
          <input style={{ ...inp, flex: 1 }}
            placeholder='https://instagram.com/your_handle  または  @your_handle'
            value={handle} onChange={e => setHandle(e.target.value)} />
          <VoiceInputButton onText={t => setHandle(t)} currentValue={handle} accentColor={bg.accent} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
          <input style={inp} placeholder='ジャンル (例: コスメ, 旅, ライフスタイル)' value={niche} onChange={e => setNiche(e.target.value)} />
          <input style={inp} placeholder='3 ヶ月のゴール' value={goal} onChange={e => setGoal(e.target.value)} />
        </div>
      </div>

      {/* Step 2: 数値 (大事) */}
      <div style={card}>
        <SectionHead bg={bg} step="02" title="数字 (Insights から確認)" optional />
        <p style={{ color: bg.inkSoft, fontSize: '0.82rem', marginBottom: '0.75rem' }}>
          Instagram → プロフィール → ☰ → インサイト で見られる数値です。多いほど分析が深くなります。
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
          {[
            { v: followers, set: setFollowers, ph: 'フォロワー数' },
            { v: following, set: setFollowing, ph: 'フォロー中' },
            { v: avgER,     set: setAvgER,     ph: '平均ER (%)' },
            { v: monthlyReach, set: setMonthlyReach, ph: '月間リーチ' },
            { v: avgLikes,  set: setAvgLikes,  ph: '平均いいね' },
            { v: avgComments, set: setAvgComments, ph: '平均コメント' },
          ].map((f, i) => (
            <input key={i} style={inp} type="number" placeholder={f.ph}
              value={f.v} onChange={e => f.set(e.target.value)} />
          ))}
        </div>
      </div>

      {/* Step 3: スクリーンショット */}
      <div style={card}>
        <SectionHead bg={bg} step="03" title="スクリーンショット (Vision で読み取り)" optional={mode === 'other'} />
        <p style={{ color: bg.inkSoft, fontSize: '0.82rem', marginBottom: '0.75rem', lineHeight: 1.7 }}>
          {mode === 'self'
            ? '🪞 プロフィール画面、フィード 9 マス、インサイト、リール一覧、ストーリーズハイライト、過去の伸びた投稿などを <strong>5-8 枚</strong>添付すると、AI が画像を見て深く分析します。'
            : 'プロフィール画面、フィード、過去投稿を 1-3 枚添付すると精度が大幅アップ。'}
        </p>

        <label style={{
          display: 'block', textAlign: 'center', cursor: 'pointer',
          padding: '1.5rem', border: `2px dashed ${bg.cardBorder}`,
          borderRadius: 16, color: bg.inkSoft,
          background: 'rgba(255,255,255,0.4)',
          marginBottom: '0.75rem',
        }}>
          <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>📷</div>
          <div style={{ color: bg.ink, fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.2rem' }}>
            画像をアップロード ({images.length}/8)
          </div>
          <div style={{ fontSize: '0.78rem' }}>JPG / PNG / WebP · 複数選択 OK</div>
          <input type="file" accept="image/*" multiple style={{ display: 'none' }}
            onChange={e => onAddImages(e.target.files)} />
        </label>

        {images.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.5rem' }}>
            {images.map((img, i) => (
              <div key={i} style={{
                position: 'relative', borderRadius: 10, overflow: 'hidden',
                border: `1px solid ${bg.cardBorder}`, aspectRatio: '1 / 1',
              }}>
                <img src={img.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button onClick={() => setImages(images.filter((_, idx) => idx !== i))} style={{
                  position: 'absolute', top: 4, right: 4,
                  background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none',
                  borderRadius: '50%', width: 24, height: 24, cursor: 'pointer',
                  fontSize: '0.85rem',
                }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step 4: テキスト情報 */}
      <div style={card}>
        <SectionHead bg={bg} step="04" title="プロフィール文 / 投稿サンプル" optional={images.length > 0} />
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
          <textarea style={{ ...inp, flex: 1, minHeight: 120 }}
            placeholder={'プロフィール文 + 過去 5-10 投稿のキャプションをペースト\n(画像をアップ済みなら任意)'}
            value={pasted} onChange={e => setPasted(e.target.value)} />
          <VoiceInputButton onText={t => setPasted(t)} currentValue={pasted} accentColor={bg.accent} continuous />
        </div>

        {/* 投稿サンプル個別 */}
        <p style={{ fontSize: '0.78rem', color: bg.inkSoft, marginTop: '0.5rem', marginBottom: '0.4rem' }}>
          代表投稿を個別に添えると分析が鋭くなります (任意)
        </p>
        {samples.map((s, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr auto', gap: '0.4rem', marginBottom: '0.4rem' }}>
            <input style={inp} placeholder='URL' value={s.url}
              onChange={e => setSamples(samples.map((x, idx) => idx === i ? { ...x, url: e.target.value } : x))} />
            <input style={inp} placeholder='キャプション抜粋'
              value={s.caption}
              onChange={e => setSamples(samples.map((x, idx) => idx === i ? { ...x, caption: e.target.value } : x))} />
            <input style={inp} placeholder='例: いいね 250'
              value={s.metrics}
              onChange={e => setSamples(samples.map((x, idx) => idx === i ? { ...x, metrics: e.target.value } : x))} />
            <button onClick={() => setSamples(samples.filter((_, idx) => idx !== i))} style={{
              background: 'transparent', border: 'none', color: bg.inkSoft, cursor: 'pointer',
            }}>✕</button>
          </div>
        ))}
        {samples.length < 5 && (
          <button onClick={() => setSamples([...samples, { url: '', caption: '', metrics: '' }])} style={{
            background: 'transparent', color: bg.accent, border: `1px dashed ${bg.cardBorder}`,
            borderRadius: 10, padding: '0.4rem 0.9rem', fontSize: '0.85rem', cursor: 'pointer',
            fontFamily: IRIS_FONTS.body,
          }}>
            + 投稿を追加
          </button>
        )}

        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.75rem' }}>
          <input style={{ ...inp, flex: 1 }}
            placeholder='補足メモ (例: 30 代女性, コスメ系, 月3-4 投稿, 直近の悩み)'
            value={note} onChange={e => setNote(e.target.value)} />
          <VoiceInputButton onText={t => setNote(t)} currentValue={note} accentColor={bg.accent} />
        </div>
      </div>

      {/* 実行 */}
      <button onClick={run} disabled={busy} style={{
        ...btnPrimary,
        padding: '1rem 2rem', fontSize: '1rem',
      }}>
        {busy ? '🔮 分析中… (画像を含む場合は 30-60 秒)' : `✨ ${mode === 'self' ? '自分のアカウントを精密解析' : 'アカウントをリサーチ'}`}
      </button>

      {/* 結果表示 */}
      {result && <ResultView bg={bg} card={card} result={result} />}
    </div>
  );
}

function SectionHead({ bg, step, title, optional }: { bg: any; step: string; title: string; optional?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.6rem' }}>
      <span style={{
        fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
        fontSize: '0.78rem', letterSpacing: '0.2em', color: bg.accent, fontWeight: 700,
      }}>
        Step {step}
      </span>
      <span style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '1.15rem', fontWeight: 600, color: bg.ink }}>
        {title}
      </span>
      {optional && (
        <span style={{ fontSize: '0.7rem', color: bg.inkSoft, fontStyle: 'italic' }}>(任意)</span>
      )}
    </div>
  );
}

function ResultView({ bg, card, result }: { bg: any; card: any; result: IGAnalysisResult }) {
  return (
    <>
      {/* 総合スコア + 一行サマリ */}
      <div style={{ ...card, background: `linear-gradient(135deg, ${bg.accent}11, ${bg.accent}22)`, borderColor: bg.accent + '55' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <ScoreCircle value={result.totalScore} color={bg.accent} size={120} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: bg.accent, fontWeight: 700, marginBottom: '0.4rem' }}>
              TOTAL SCORE
            </p>
            <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '1.5rem', color: bg.ink, fontWeight: 600, lineHeight: 1.4 }}>
              {result.oneLiner}
            </p>
          </div>
        </div>
      </div>

      {/* レーダー (5 軸) */}
      <div style={card}>
        <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.75rem' }}>
          5 軸スコア
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', gap: '1.5rem', alignItems: 'center' }}>
          <RadarChart scores={result.scores} color={bg.accent} />
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {([
              ['bio', 'バイオの強さ'],
              ['visualConsistency', 'ビジュアル統一'],
              ['contentUniqueness', 'コンテンツ独自性'],
              ['engagement', 'エンゲージメント'],
              ['commercialFit', '商業性'],
            ] as const).map(([k, label]) => (
              <div key={k}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: bg.ink }}>{label}</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: bg.accent, fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>
                    {result.scores[k].value}
                  </span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.06)', height: 4, borderRadius: 2, marginTop: '0.2rem' }}>
                  <div style={{
                    background: `linear-gradient(90deg, ${bg.accent}, ${bg.accent}aa)`,
                    width: `${result.scores[k].value}%`, height: '100%', borderRadius: 2,
                    transition: 'width 0.6s',
                  }} />
                </div>
                <p style={{ fontSize: '0.78rem', color: bg.inkSoft, marginTop: '0.25rem', lineHeight: 1.6 }}>{result.scores[k].reason}</p>
                {result.scores[k].toLevelUp && (
                  <p style={{ fontSize: '0.78rem', color: bg.accent, marginTop: '0.15rem', fontStyle: 'italic' }}>
                    → {result.scores[k].toLevelUp}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ブランド観 */}
      <div style={card}>
        <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.5rem' }}>
          Brand Identity
        </p>
        <p style={{ color: bg.ink, lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{result.brandIdentity}</p>
      </div>

      {/* オーディエンス + 業界 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        <div style={card}>
          <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.5rem' }}>
            推定オーディエンス
          </p>
          <p style={{ color: bg.ink, fontWeight: 600, lineHeight: 1.7 }}>{result.estimatedAudience.primary}</p>
          {result.estimatedAudience.secondary && (
            <p style={{ color: bg.inkSoft, fontSize: '0.85rem', marginTop: '0.4rem', lineHeight: 1.7 }}>
              二次層: {result.estimatedAudience.secondary}
            </p>
          )}
          {result.estimatedAudience.estimatedSize && (
            <p style={{ color: bg.accent, fontSize: '0.88rem', marginTop: '0.4rem', fontStyle: 'italic' }}>
              推定リーチ: {result.estimatedAudience.estimatedSize}
            </p>
          )}
        </div>
        {result.targetableBrands?.length > 0 && (
          <div style={card}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.5rem' }}>
              狙えるブランド業界
            </p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {result.targetableBrands.map((b, i) => (
                <span key={i} style={{ background: bg.accent + '22', color: bg.accent, padding: '0.3rem 0.85rem', borderRadius: 999, fontSize: '0.85rem', fontWeight: 600 }}>{b}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 強み / 弱み */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {result.strengths?.length > 0 && (
          <div style={card}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#10B981', marginBottom: '0.5rem' }}>✨ 強み</p>
            <ul style={{ paddingLeft: '1.2rem', color: bg.ink, lineHeight: 1.9, fontSize: '0.92rem' }}>
              {result.strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}
        {result.weaknesses?.length > 0 && (
          <div style={card}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#FFA94D', marginBottom: '0.5rem' }}>🔧 改善点</p>
            <ul style={{ paddingLeft: '1.2rem', color: bg.ink, lineHeight: 1.9, fontSize: '0.92rem' }}>
              {result.weaknesses.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* 競合 */}
      {result.competitors?.length > 0 && (
        <div style={card}>
          <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.75rem' }}>
            参考にすべきアカウント
          </p>
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            {result.competitors.map((c, i) => (
              <div key={i} style={{ padding: '0.65rem 0.85rem', borderRadius: 12, background: 'rgba(255,255,255,0.5)' }}>
                <p style={{ fontWeight: 700, color: bg.ink, marginBottom: '0.2rem' }}>{c.handle}</p>
                <p style={{ fontSize: '0.85rem', color: bg.inkSoft, lineHeight: 1.7 }}>{c.whyRefer}</p>
                <p style={{ fontSize: '0.85rem', color: bg.accent, lineHeight: 1.7, fontStyle: 'italic', marginTop: '0.2rem' }}>
                  → {c.learnFrom}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 想定報酬 (3 種別) */}
      {result.estimatedFee && (
        <div style={card}>
          <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.75rem' }}>
            想定報酬レンジ
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
            {([
              ['feedPost', 'フィード 1 本'],
              ['reel', 'Reel 1 本'],
              ['story', 'Story 1 本'],
            ] as const).map(([k, label]) => {
              const f = (result.estimatedFee as any)[k];
              if (!f) return null;
              return (
                <div key={k} style={{ padding: '0.85rem', borderRadius: 12, background: 'rgba(255,255,255,0.5)' }}>
                  <p style={{ fontSize: '0.78rem', color: bg.inkSoft, marginBottom: '0.2rem' }}>{label}</p>
                  <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '1.3rem', fontWeight: 700, color: bg.ink, lineHeight: 1 }}>
                    ¥{f.min.toLocaleString()} 〜 ¥{f.max.toLocaleString()}
                  </p>
                </div>
              );
            })}
          </div>
          {result.estimatedFee.note && (
            <p style={{ color: bg.inkSoft, fontSize: '0.82rem', marginTop: '0.6rem', lineHeight: 1.7 }}>
              {result.estimatedFee.note}
            </p>
          )}
        </div>
      )}

      {/* 30 日プラン */}
      {result.next30Days && (
        <div style={card}>
          <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.75rem' }}>
            30 日アクションプラン
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem' }}>
            {(['week1', 'week2', 'week3', 'week4'] as const).map((wk, i) => {
              const w = result.next30Days[wk];
              if (!w) return null;
              return (
                <div key={wk} style={{ padding: '0.85rem', borderRadius: 12, background: 'rgba(255,255,255,0.5)', borderLeft: `3px solid ${bg.accent}` }}>
                  <p style={{ fontSize: '0.7rem', letterSpacing: '0.2em', color: bg.accent, fontWeight: 700, marginBottom: '0.25rem' }}>
                    Week {i + 1}
                  </p>
                  <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '1.05rem', fontWeight: 600, color: bg.ink, marginBottom: '0.4rem' }}>
                    {w.theme}
                  </p>
                  <ul style={{ paddingLeft: '1.1rem', color: bg.inkSoft, fontSize: '0.85rem', lineHeight: 1.7 }}>
                    {w.tasks?.map((t, ti) => <li key={ti}>{t}</li>)}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 投稿アイデア 5 つ */}
      {result.quickPostIdeas?.length > 0 && (
        <div style={card}>
          <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.75rem' }}>
            すぐ撮れる投稿アイデア
          </p>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {result.quickPostIdeas.map((idea, i) => (
              <div key={i} style={{ padding: '0.65rem 0.85rem', borderRadius: 12, background: 'rgba(255,255,255,0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <p style={{ fontWeight: 700, color: bg.ink }}>{idea.title}</p>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <span style={{ background: bg.accent + '22', color: bg.accent, padding: '0.15rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700 }}>{idea.format}</span>
                    <span style={{
                      background: idea.expectedReachLevel === 'high' ? '#10B98122' : idea.expectedReachLevel === 'medium' ? '#FFA94D22' : '#9CA3AF22',
                      color: idea.expectedReachLevel === 'high' ? '#10B981' : idea.expectedReachLevel === 'medium' ? '#FFA94D' : '#9CA3AF',
                      padding: '0.15rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700,
                    }}>
                      {idea.expectedReachLevel}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: '0.85rem', color: bg.accent, fontStyle: 'italic', marginTop: '0.2rem' }}>
                  HOOK: {idea.hook}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* バイオ提案 */}
      {result.bioSuggestion && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent }}>
              バイオ書き直し案
            </p>
            <button onClick={() => navigator.clipboard?.writeText(result.bioSuggestion)} style={{
              background: 'transparent', color: bg.accent, border: `1px solid ${bg.accent}55`,
              borderRadius: 999, padding: '0.3rem 0.8rem', fontSize: '0.78rem', cursor: 'pointer',
            }}>📋 コピー</button>
          </div>
          <pre style={{
            whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: bg.ink,
            background: 'rgba(255,255,255,0.5)', padding: '0.85rem', borderRadius: 12,
            lineHeight: 1.7,
          }}>{result.bioSuggestion}</pre>
        </div>
      )}

      {/* ハッシュタグ */}
      {result.hashtagStrategy && (
        <div style={card}>
          <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.5rem' }}>
            ハッシュタグ戦略
          </p>
          {result.hashtagStrategy.advice && (
            <p style={{ color: bg.inkSoft, fontSize: '0.85rem', marginBottom: '0.5rem', lineHeight: 1.7 }}>
              {result.hashtagStrategy.advice}
            </p>
          )}
          {result.hashtagStrategy.mainSet?.length > 0 && (
            <p style={{ marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', color: bg.accent, fontWeight: 700, marginRight: '0.5rem' }}>MAIN:</span>
              <span style={{ color: bg.ink }}>{result.hashtagStrategy.mainSet.join(' ')}</span>
            </p>
          )}
          {result.hashtagStrategy.nicheSet?.length > 0 && (
            <p>
              <span style={{ fontSize: '0.78rem', color: bg.accent, fontWeight: 700, marginRight: '0.5rem' }}>NICHE:</span>
              <span style={{ color: bg.ink }}>{result.hashtagStrategy.nicheSet.join(' ')}</span>
            </p>
          )}
        </div>
      )}

      {/* 投稿時間帯 */}
      {result.postingSchedule?.length > 0 && (
        <div style={card}>
          <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.5rem' }}>
            おすすめ投稿時間
          </p>
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            {result.postingSchedule.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: 10, background: 'rgba(255,255,255,0.5)' }}>
                <span style={{ fontWeight: 700, color: bg.accent, minWidth: 60 }}>{p.day}</span>
                <span style={{ fontWeight: 700, color: bg.ink, minWidth: 70 }}>{p.time}</span>
                <span style={{ color: bg.inkSoft, fontSize: '0.85rem', flex: 1 }}>{p.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 注意 */}
      {result.cautions?.length > 0 && (
        <div style={{ ...card, borderColor: '#C8102E44' }}>
          <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C8102E', marginBottom: '0.5rem' }}>⚠ 注意</p>
          <ul style={{ paddingLeft: '1.2rem', color: bg.ink, lineHeight: 1.9, fontSize: '0.9rem' }}>
            {result.cautions.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
    </>
  );
}

function ScoreCircle({ value, color, size = 100 }: { value: number; color: string; size?: number }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={6} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 1.2s ease-out' }} />
      <text x={size / 2} y={size / 2 + 8} textAnchor="middle" fontSize={size * 0.32} fontWeight="800" fill={color}
        style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic' }}>
        {value}
      </text>
    </svg>
  );
}

function RadarChart({ scores, color }: { scores: IGAnalysisResult['scores']; color: string }) {
  const labels = [
    { key: 'bio',                label: 'バイオ' },
    { key: 'visualConsistency',  label: 'ビジュアル' },
    { key: 'contentUniqueness',  label: '独自性' },
    { key: 'engagement',         label: 'ER' },
    { key: 'commercialFit',      label: '商業性' },
  ] as const;

  const size = 220;
  const cx = size / 2, cy = size / 2;
  const radius = 80;

  // 5 軸の頂点座標
  const points = labels.map((l, i) => {
    const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
    const v = scores[l.key].value / 100;
    return {
      x: cx + Math.cos(angle) * radius * v,
      y: cy + Math.sin(angle) * radius * v,
      labelX: cx + Math.cos(angle) * (radius + 18),
      labelY: cy + Math.sin(angle) * (radius + 18),
      label: l.label,
    };
  });

  // グリッド (4 段階)
  const gridLevels = [0.25, 0.5, 0.75, 1].map(level =>
    labels.map((_, i) => {
      const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
      return `${cx + Math.cos(angle) * radius * level},${cy + Math.sin(angle) * radius * level}`;
    }).join(' ')
  );

  const polygon = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* グリッド */}
      {gridLevels.map((g, i) => (
        <polygon key={i} points={g} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={i === 3 ? 1 : 0.5} />
      ))}
      {/* 軸線 */}
      {labels.map((_, i) => {
        const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
        return (
          <line key={i}
            x1={cx} y1={cy}
            x2={cx + Math.cos(angle) * radius}
            y2={cy + Math.sin(angle) * radius}
            stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" />
        );
      })}
      {/* スコア多角形 */}
      <polygon points={polygon}
        fill={color} fillOpacity="0.18"
        stroke={color} strokeWidth="2"
        style={{ transition: 'all 0.6s' }}
      />
      {/* 頂点ドット */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
      ))}
      {/* ラベル */}
      {points.map((p, i) => (
        <text key={i} x={p.labelX} y={p.labelY}
          textAnchor="middle" alignmentBaseline="middle"
          fontSize="11" fontWeight="600" fill="#1F1A2E">
          {p.label}
        </text>
      ))}
    </svg>
  );
}
