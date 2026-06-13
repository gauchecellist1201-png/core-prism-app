// ============================================================
// ViralStudioCard — X / Threads バイラル投稿 自動作成スタジオ
//   テーマ → トレンド分析 → similar 投稿生成 → コピー/キュー/X投稿
// ============================================================
import { useState } from 'react';
import { Sparkles, Copy, Check, Send, Loader2, TrendingUp, Clock } from 'lucide-react';
import { runViral, type GeneratedPost, type TrendAnalysis, saveToQueue } from '../lib/viralEngine';
import { isXConfigured, isXConnected, startXAuth, postTweet } from '../lib/xPost';
import { BrandIcon } from './BrandIcons';

export default function ViralStudioCard() {
  const [theme, setTheme] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<TrendAnalysis | null>(null);
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [posted, setPosted] = useState<Record<string, boolean>>({});

  const run = async () => {
    if (!theme.trim() || loading) return;
    setLoading(true); setErr(''); setAnalysis(null); setPosts([]);
    try {
      const r = await runViral(theme.trim(), 3);
      setAnalysis(r.analysis); setPosts(r.posts);
      saveToQueue(r.posts);
    } catch (e: any) { setErr(e?.message || '生成に失敗しました。もう一度お試しください。'); }
    finally { setLoading(false); }
  };

  const copy = (p: GeneratedPost) => {
    const text = `${p.body}\n\n${p.hashtags.join(' ')}`.trim();
    navigator.clipboard?.writeText(text);
    setCopied(p.id); setTimeout(() => setCopied(null), 1500);
  };

  const postX = async (p: GeneratedPost) => {
    try {
      if (!isXConnected()) { await startXAuth(); return; }
      await postTweet(`${p.body}\n${p.hashtags.join(' ')}`.trim().slice(0, 280));
      setPosted(s => ({ ...s, [p.id]: true }));
    } catch (e: any) { setErr(e?.message || 'X投稿に失敗しました'); }
  };

  const xPosts = posts.filter(p => p.platform === 'x');
  const thPosts = posts.filter(p => p.platform === 'threads');

  return (
    <div style={{
      padding: '16px 16px 14px', borderRadius: 14, background: 'var(--surface)',
      border: '1px solid rgba(167,139,250,0.35)', marginBottom: 14, color: 'var(--fg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg,#A78BFA,#E879F9)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Sparkles size={20} strokeWidth={2.2} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 900, color: 'var(--fg-strong)', margin: 0 }}>
            バイラル投稿スタジオ（X / Threads）
          </h3>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
            テーマを入れるだけ → 伸びてる型を分析 → 似た投稿を自動作成
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <input value={theme} onChange={e => setTheme(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()}
          placeholder="テーマ（例: 経営者の時短術 / カフェ集客 / AI活用）"
          style={{ flex: 1, minWidth: 180, padding: '10px 12px', borderRadius: 9, border: '1px solid var(--border, rgba(0,0,0,0.12))', background: 'var(--surface)', color: 'var(--fg)', fontSize: 16 }} />
        <button onClick={run} disabled={loading || !theme.trim()} style={{
          padding: '10px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800, minHeight: 44,
          background: 'linear-gradient(90deg,#A78BFA,#E879F9)', color: '#fff', opacity: (loading || !theme.trim()) ? 0.55 : 1,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          {loading ? <><Loader2 size={15} className="spin" /> 生成中…</> : <><TrendingUp size={15} /> リサーチして生成</>}
        </button>
      </div>

      {err && <div style={{ fontSize: 11.5, color: '#F87171', marginBottom: 8, lineHeight: 1.5 }}>{err}</div>}

      {analysis && (
        <div style={{ background: 'var(--surface-3)', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 11.5, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 800, color: 'var(--fg-strong)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}><TrendingUp size={13} /> 伸びている型</div>
          <div style={{ color: 'var(--fg-muted)' }}>{analysis.patterns.join(' ・ ')}</div>
          <div style={{ fontWeight: 800, color: 'var(--fg-strong)', margin: '6px 0 4px' }}>攻める切り口</div>
          <div style={{ color: 'var(--fg-muted)' }}>{analysis.angles.join(' ・ ')}</div>
        </div>
      )}

      {posts.length > 0 && (
        <>
          <PostGroup brand="x" label="X (旧Twitter)" posts={xPosts} copied={copied} posted={posted} onCopy={copy} onPost={postX} canPostX />
          <PostGroup brand="threads" label="Threads" posts={thPosts} copied={copied} posted={posted} onCopy={copy} onPost={postX} canPostX={false} />
          {!isXConfigured() && (
            <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)', marginTop: 6, lineHeight: 1.5 }}>
              ※ いまは「コピー」して投稿できます。X Developer アプリを作って Client ID を設定すると、ここから<b>ワンタップ投稿</b>に切り替わります（Threads は連携実装後に対応）。
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PostGroup({ brand, label, posts, copied, posted, onCopy, onPost, canPostX }: {
  brand: 'x' | 'threads'; label: string; posts: GeneratedPost[];
  copied: string | null; posted: Record<string, boolean>;
  onCopy: (p: GeneratedPost) => void; onPost: (p: GeneratedPost) => void; canPostX: boolean;
}) {
  if (posts.length === 0) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <BrandIcon name={brand} size={20} />
        <strong style={{ fontSize: 12.5, color: 'var(--fg-strong)' }}>{label}</strong>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {posts.map(p => (
          <div key={p.id} style={{ background: 'var(--surface-3)', border: '1px solid var(--border, rgba(0,0,0,0.08))', borderRadius: 10, padding: 11 }}>
            <div style={{ fontSize: 12.5, color: 'var(--fg)', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{p.body}</div>
            {p.hashtags.length > 0 && <div style={{ fontSize: 11.5, color: '#A78BFA', marginTop: 4, fontWeight: 700 }}>{p.hashtags.join(' ')}</div>}
            <div style={{ fontSize: 10, color: 'var(--fg-subtle)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> {p.bestTime} ・ {p.rationale}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button onClick={() => onCopy(p)} style={miniBtn('var(--surface)')}>
                {copied === p.id ? <><Check size={13} /> コピー済</> : <><Copy size={13} /> コピー</>}
              </button>
              {canPostX && (
                <button onClick={() => onPost(p)} style={miniBtn('#1d9bf0', '#fff')}>
                  {posted[p.id] ? <><Check size={13} /> 投稿済</> : <><Send size={13} /> {isXConnected() ? 'Xに投稿' : 'Xを連携して投稿'}</>}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const miniBtn = (bg: string, color = 'var(--fg)'): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8,
  border: bg === 'var(--surface)' ? '1px solid var(--border, rgba(0,0,0,0.12))' : 'none',
  background: bg, color, fontSize: 11.5, fontWeight: 800, cursor: 'pointer', minHeight: 34,
});
