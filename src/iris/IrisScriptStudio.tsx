// ============================================================
// IRIS — 企画・台本スタジオ (運用代行モード)
// クライアント登録 → ネタ量産(企画) → 撮影者・編集者がそのまま動ける本格台本
// ============================================================
import React, { useState } from 'react';
import { Lock, Scissors } from 'lucide-react';
import type { AppSettings } from '../types/identity';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { notifyInApp } from '../lib/inAppNotify';
import ThinkingIndicator from '../components/ThinkingIndicator';
import { loadIgProfile } from './instagramConnect';
import { usePostHistory } from './strategist';
import {
  loadClients, saveClients, clientUid,
  generateIdeaPool, type IdeaItem,
  generateProductionScript, type ProductionScript,
  scriptToMarkdown, ideaPoolToMarkdown, type IrisClient,
} from './scriptStudio';

interface Props {
  bg: IrisBackgroundDef;
  settings: AppSettings;
  /** 最上位プラン (Pro) 未満ならロック表示にする */
  locked?: boolean;
}

const EFFORT_COLOR: Record<string, string> = { '低': '#34D399', '中': '#FBBF24', '高': '#F472B6' };
const PLATFORM_LABEL: Record<IrisClient['platform'], string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' };

const emptyClient = (): IrisClient => ({
  id: clientUid(), name: '', niche: '', target: '', platform: 'instagram',
  goal: '', tone: '', ngWords: '', updatedAt: new Date().toISOString(),
});

export default function IrisScriptStudio({ bg, settings, locked }: Props) {
  if (locked) return <ScriptStudioLock bg={bg} />;
  return <ScriptStudioInner bg={bg} settings={settings} />;
}

// ─── 最上位プラン (Pro) 限定ロック画面 ───
function ScriptStudioLock({ bg }: { bg: IrisBackgroundDef }) {
  const card: React.CSSProperties = {
    background: bg.card, backdropFilter: 'blur(10px)',
    border: `1px solid ${bg.cardBorder}`, borderRadius: 22, padding: '1.6rem',
  };
  const openPlans = () => {
    window.dispatchEvent(new CustomEvent('iris:open-plan', { detail: { planId: 'pro' } }));
  };
  const FEATURES = [
    'クライアント(代行先)を登録 → 文脈をAIが毎回踏まえる',
    'ネタを 5〜20 本まとめて企画(ネタ出し)',
    '撮影者・編集者がそのまま動ける本格台本(カット割り/画角/セリフ/テロップ/編集指示)',
    '撮影台本をワンタップで書き出し → 担当へそのまま共有',
  ];
  return (
    <div style={{ display: 'grid', gap: '1.1rem' }}>
      <div>
        <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '0.76rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.3rem' }}>
          Plan & Script — 運用代行モード
        </p>
        <h2 style={{ fontFamily: IRIS_FONTS.display, fontSize: '2rem', color: bg.ink, margin: 0, fontWeight: 700 }}>企画・台本</h2>
      </div>
      <div style={{ ...card, textAlign: 'center', background: `linear-gradient(160deg, ${bg.accent}14, ${bg.card})` }}>
        <div style={{ width: 64, height: 64, margin: '0 auto 0.9rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${bg.accent}1f`, border: `1px solid ${bg.accent}55` }}>
          <Lock size={28} color={bg.accent} strokeWidth={2.2} />
        </div>
        <p style={{ display: 'inline-block', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.1em', color: '#fff', background: bg.accent, padding: '0.2rem 0.7rem', borderRadius: 999, marginBottom: '0.8rem' }}>
          最上位プラン Pro 限定
        </p>
        <h3 style={{ fontFamily: IRIS_FONTS.display, fontSize: '1.4rem', color: bg.ink, fontWeight: 700, lineHeight: 1.35, margin: '0 0 0.5rem' }}>
          企画者・台本ライターの工数を、ゼロに。
        </h3>
        <p style={{ color: bg.inkSoft, fontSize: '0.9rem', lineHeight: 1.7, maxWidth: 460, margin: '0 auto 1.1rem' }}>
          運用代行に必要な「企画 → 本格台本」を Iris が丸ごと担当。撮影者・編集者がそのまま動ける台本まで一気に。
        </p>
        <div style={{ display: 'grid', gap: 8, textAlign: 'left', maxWidth: 460, margin: '0 auto 1.3rem' }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.86rem', color: bg.ink, lineHeight: 1.5 }}>
              <span style={{ color: bg.accent, fontWeight: 800, flexShrink: 0 }}>✓</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
        <button onClick={openPlans} style={{
          background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`, color: '#fff', border: 'none',
          borderRadius: 999, padding: '0.85rem 2rem', fontWeight: 700, cursor: 'pointer',
          fontSize: '0.95rem', fontFamily: IRIS_FONTS.body, boxShadow: `0 10px 26px ${bg.accent}55`,
        }}>
          Pro にアップグレード
        </button>
      </div>
    </div>
  );
}

function ScriptStudioInner({ bg, settings }: { bg: IrisBackgroundDef; settings: AppSettings }) {
  const [clients, setClients] = useState<IrisClient[]>(() => loadClients());
  const [activeId, setActiveId] = useState<string>(() => loadClients()[0]?.id || '');
  const [editing, setEditing] = useState<IrisClient | null>(null);

  // 連携アカウント本人の実データ — 企画/台本を本人のジャンルに固定する核心。
  // クライアント未登録でも、連携プロフィール＋実際の過去投稿があればそれに沿って生成する。
  const [igProfile] = useState(() => loadIgProfile());
  const { posts: pastPosts } = usePostHistory();

  // 企画
  const [focus, setFocus] = useState('');
  const [count, setCount] = useState(10);
  const [ideas, setIdeas] = useState<IdeaItem[]>([]);
  const [ideaBusy, setIdeaBusy] = useState(false);

  // 台本
  const [freeTopic, setFreeTopic] = useState('');
  const [script, setScript] = useState<ProductionScript | null>(null);
  const [scriptBusy, setScriptBusy] = useState(false);
  const [scriptTopic, setScriptTopic] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const activeClient = clients.find(c => c.id === activeId) || null;

  // ─── styles ───
  const card: React.CSSProperties = {
    background: bg.card, backdropFilter: 'blur(10px)',
    border: `1px solid ${bg.cardBorder}`, borderRadius: 20, padding: '1.2rem',
  };
  const inp: React.CSSProperties = {
    background: 'rgba(255,255,255,0.94)', border: `1px solid ${bg.cardBorder}`,
    color: '#1F1A2E', padding: '0.65rem 0.9rem', borderRadius: 12,
    fontSize: '0.95rem', fontFamily: IRIS_FONTS.body, outline: 'none', width: '100%',
  };
  const label: React.CSSProperties = { fontSize: '0.72rem', color: bg.inkSoft, fontWeight: 700, marginBottom: 4, display: 'block' };
  const btnPrimary: React.CSSProperties = {
    background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`, color: '#fff',
    border: 'none', borderRadius: 999, padding: '0.7rem 1.4rem', fontWeight: 700,
    cursor: 'pointer', fontSize: '0.88rem', fontFamily: IRIS_FONTS.body, boxShadow: `0 8px 22px ${bg.accent}44`,
  };
  const btnGhost: React.CSSProperties = {
    background: 'rgba(255,255,255,0.6)', color: bg.ink, border: `1px solid ${bg.cardBorder}`,
    borderRadius: 999, padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer',
    fontSize: '0.8rem', fontFamily: IRIS_FONTS.body,
  };
  const sectionLabel: React.CSSProperties = {
    fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '0.76rem',
    letterSpacing: '0.22em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.5rem',
  };

  // ─── client CRUD ───
  const persist = (list: IrisClient[]) => { setClients(list); saveClients(list); };
  const startNew = () => setEditing(emptyClient());
  const startEdit = () => { if (activeClient) setEditing({ ...activeClient }); };
  const saveEditing = () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.niche.trim()) { setErr('クライアント名とジャンルは必須です'); return; }
    const next = { ...editing, updatedAt: new Date().toISOString() };
    const exists = clients.some(c => c.id === next.id);
    const list = exists ? clients.map(c => c.id === next.id ? next : c) : [next, ...clients];
    persist(list);
    setActiveId(next.id);
    setEditing(null);
    setErr(null);
  };
  const removeClient = (id: string) => {
    const list = clients.filter(c => c.id !== id);
    persist(list);
    if (activeId === id) setActiveId(list[0]?.id || '');
  };

  // ─── AI ───
  const runIdeas = async () => {
    setIdeaBusy(true); setErr(null);
    try {
      const list = await generateIdeaPool({ settings, client: activeClient, igProfile, pastPosts, focus: focus || undefined, count });
      setIdeas(list);
      if (!list.length) setErr('ネタを取得できませんでした。もう一度お試しください。');
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setIdeaBusy(false); }
  };

  const runScript = async (topic: string) => {
    if (!topic.trim()) { setErr('台本にするネタ・テーマを入れてください'); return; }
    setScriptBusy(true); setErr(null); setScript(null); setScriptTopic(topic);
    try {
      const s = await generateProductionScript({ settings, client: activeClient, igProfile, pastPosts, topic });
      setScript(s);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setScriptBusy(false); }
  };

  const copyScript = () => {
    if (!script) return;
    const md = scriptToMarkdown(script, activeClient?.name);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(md)
        .then(() => notifyInApp({ kind: 'success', title: '撮影台本をコピーしました', body: '撮影担当・編集担当にそのまま渡せます (Markdown)' }))
        .catch(() => notifyInApp({ kind: 'warn', title: 'コピーできませんでした', body: 'ブラウザのコピー権限をご確認ください' }));
    } else {
      notifyInApp({ kind: 'info', title: 'コピー未対応のブラウザ', body: 'テキストを手動で選択してください' });
    }
  };

  // 企画リストを丸ごと「投稿プラン」としてコピー (クライアント・チームにそのまま渡せる)
  const copyIdeaPool = () => {
    if (!ideas.length) return;
    const md = ideaPoolToMarkdown(ideas, activeClient, focus || undefined);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(md)
        .then(() => notifyInApp({ kind: 'success', title: `投稿プラン ${ideas.length}本をコピーしました`, body: 'クライアント・チームにそのまま渡せます (Markdown)' }))
        .catch(() => notifyInApp({ kind: 'warn', title: 'コピーできませんでした', body: 'ブラウザのコピー権限をご確認ください' }));
    } else {
      notifyInApp({ kind: 'info', title: 'コピー未対応のブラウザ', body: 'テキストを手動で選択してください' });
    }
  };

  // 投稿本文だけをそのまま Instagram などに貼れる形でコピー (本文 + ハッシュタグ)
  const copyCaption = () => {
    if (!script) return;
    const text = [script.caption, script.hashtags.length ? '\n' + script.hashtags.join(' ') : '']
      .filter(Boolean).join('\n').trim();
    if (!text) { notifyInApp({ kind: 'info', title: 'コピーする本文がありません', body: '台本を作り直してください' }); return; }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => notifyInApp({ kind: 'success', title: '投稿本文をコピーしました', body: 'Instagram などにそのまま貼り付けられます' }))
        .catch(() => notifyInApp({ kind: 'warn', title: 'コピーできませんでした', body: 'ブラウザのコピー権限をご確認ください' }));
    } else {
      notifyInApp({ kind: 'info', title: 'コピー未対応のブラウザ', body: 'テキストを手動で選択してください' });
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1.1rem' }}>
      {/* ヘッダ */}
      <div>
        <p style={{ ...sectionLabel, marginBottom: '0.3rem' }}>Plan & Script — 運用代行モード</p>
        <h2 style={{ fontFamily: IRIS_FONTS.display, fontSize: '2rem', color: bg.ink, margin: 0, fontWeight: 700, letterSpacing: '-0.01em' }}>
          企画・台本
        </h2>
        <p style={{ color: bg.inkSoft, fontSize: '0.9rem', marginTop: '0.4rem', lineHeight: 1.6 }}>
          クライアントを登録 → ネタを量産 → <strong style={{ color: bg.ink }}>撮影者・編集者がそのまま動ける本格台本</strong>に。
          企画者・台本ライターの工数をゼロに。
        </p>
      </div>

      {/* 3 秒でわかる説明 + サンプル出力 — 初見の人に「まず何を押す → こうなる」を触らず見せる */}
      {!script && ideas.length === 0 && (
        <div style={{
          padding: '0.95rem 1.05rem',
          background: `linear-gradient(135deg, ${bg.accent}16 0%, ${bg.accent}07 100%)`,
          border: `1px solid ${bg.accent}33`,
          borderRadius: 16,
        }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: bg.ink, lineHeight: 1.5 }}>
            クライアントを 1 人だけ登録すれば、<span style={{ color: bg.accent }}>あとは AI が企画も台本も書きます。</span>
          </p>
          {/* 3 ステップ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '10px 0 8px', flexWrap: 'wrap' }}>
            {['クライアントを登録', '「ネタを10本出す」を押す', '気に入った1本を本格台本に'].map((t, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: bg.ink,
                  background: 'rgba(255,255,255,0.7)', border: `1px solid ${bg.cardBorder}`,
                  borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap',
                }}>
                  <span style={{ color: bg.accent, fontWeight: 800 }}>{i + 1}.</span> {t}
                </span>
                {i < 2 && <span style={{ color: bg.accent, fontSize: 12, fontWeight: 800 }}>→</span>}
              </span>
            ))}
          </div>
          {/* サンプル出力 1 枚 */}
          <p style={{ margin: 0, fontSize: 11.5, color: bg.inkSoft, lineHeight: 1.5 }}>
            例:「スキンケア」のクライアント → <span style={{ color: bg.ink, fontWeight: 700 }}>〈朝の5分ルーティン〉</span>など 10 本のネタ → 1 本選ぶと
            <span style={{ color: bg.ink, fontWeight: 700 }}>カット割り・画角・セリフ・テロップ・編集指示</span>まで入った撮影台本が完成。
          </p>
        </div>
      )}

      {/* ── クライアント ── */}
      <div style={card}>
        <p style={sectionLabel}>クライアント (代行先アカウント)</p>
        {clients.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {clients.map(c => (
              <button key={c.id} onClick={() => setActiveId(c.id)} style={{
                ...btnGhost,
                background: activeId === c.id ? `${bg.accent}22` : 'rgba(255,255,255,0.6)',
                borderColor: activeId === c.id ? bg.accent : bg.cardBorder,
                fontWeight: activeId === c.id ? 700 : 600,
              }}>{c.name}</button>
            ))}
          </div>
        )}

        {!editing && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={startNew} style={btnPrimary}>＋ クライアントを登録</button>
            {activeClient && <button onClick={startEdit} style={btnGhost}>「{activeClient.name}」を編集</button>}
            {activeClient && <button onClick={() => removeClient(activeClient.id)} style={{ ...btnGhost, color: '#9F1239' }}>削除</button>}
          </div>
        )}

        {activeClient && !editing && (
          <p style={{ marginTop: 10, fontSize: '0.8rem', color: bg.inkSoft, lineHeight: 1.6 }}>
            {PLATFORM_LABEL[activeClient.platform]} / {activeClient.niche} / {activeClient.target}
            {activeClient.goal ? ` / ゴール: ${activeClient.goal}` : ''}
          </p>
        )}

        {editing && (
          <div style={{ display: 'grid', gap: 10, marginTop: 6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
              <div><label style={label}>クライアント名 *</label><input style={inp} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="例: 渋谷美容クリニック" /></div>
              <div><label style={label}>ジャンル *</label><input style={inp} value={editing.niche} onChange={e => setEditing({ ...editing, niche: e.target.value })} placeholder="例: 美容医療 / カフェ" /></div>
              <div><label style={label}>ターゲット</label><input style={inp} value={editing.target} onChange={e => setEditing({ ...editing, target: e.target.value })} placeholder="例: 20-30代女性" /></div>
              <div>
                <label style={label}>プラットフォーム</label>
                <select style={inp} value={editing.platform} onChange={e => setEditing({ ...editing, platform: e.target.value as IrisClient['platform'] })}>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="youtube">YouTube</option>
                </select>
              </div>
              <div><label style={label}>運用ゴール</label><input style={inp} value={editing.goal} onChange={e => setEditing({ ...editing, goal: e.target.value })} placeholder="例: 来店予約を増やす" /></div>
              <div><label style={label}>トーン</label><input style={inp} value={editing.tone} onChange={e => setEditing({ ...editing, tone: e.target.value })} placeholder="例: 親しみやすく専門性も" /></div>
            </div>
            <div><label style={label}>言ってはいけない言葉 (NG)</label><input style={inp} value={editing.ngWords} onChange={e => setEditing({ ...editing, ngWords: e.target.value })} placeholder="例: 完治, 必ず痩せる" /></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveEditing} style={btnPrimary}>保存</button>
              <button onClick={() => { setEditing(null); setErr(null); }} style={btnGhost}>キャンセル</button>
            </div>
          </div>
        )}
      </div>

      {/* ── ① 企画: ネタ量産 ── */}
      <div style={card}>
        <p style={sectionLabel}>① 企画 — ネタを量産</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <input style={{ ...inp, flex: 1, minWidth: 200 }} placeholder="今回のフォーカス (例: 新メニュー告知 / 任意)" value={focus} onChange={e => setFocus(e.target.value)} />
          <select style={{ ...inp, width: 120 }} value={count} onChange={e => setCount(Number(e.target.value))}>
            {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n} 本</option>)}
          </select>
          <button onClick={runIdeas} disabled={ideaBusy} style={btnPrimary}>{ideaBusy ? '企画中…' : 'ネタを出す'}</button>
        </div>

        {ideaBusy && (
          <ThinkingIndicator accent={bg.accent} variant="compact" messages={['アカウントの強みを見ています…', '伸びる切り口をさがしています…', '撮りやすさも考えています…']} />
        )}

        {!ideaBusy && ideas.length > 0 && (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <p style={{ fontSize: '0.78rem', color: bg.inkSoft, fontWeight: 700, margin: 0 }}>
                {ideas.length} 本の企画ができました
              </p>
              <button onClick={copyIdeaPool} style={{ ...btnGhost, background: `${bg.accent}18`, borderColor: bg.accent, color: bg.accent, fontWeight: 700 }}>
                投稿プランを丸ごとコピー
              </button>
            </div>
            {ideas.map((it, i) => (
              <div key={i} style={{ padding: '0.7rem 0.9rem', background: 'rgba(255,255,255,0.62)', borderRadius: 12, borderLeft: `3px solid ${bg.accent}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <p style={{ fontWeight: 700, color: bg.ink, lineHeight: 1.4 }}>{it.hook}</p>
                  <span style={{ flexShrink: 0, fontSize: '0.66rem', fontWeight: 800, color: '#1c1c24', background: EFFORT_COLOR[it.effort], padding: '0.1rem 0.5rem', borderRadius: 999 }}>{it.format}・手間{it.effort}</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: bg.inkSoft, marginTop: 3 }}>{it.angle}</p>
                <p style={{ fontSize: '0.74rem', color: bg.accent, marginTop: 2, fontStyle: 'italic' }}>狙い: {it.why}</p>
                <button onClick={() => runScript(it.hook + ' — ' + it.angle)} disabled={scriptBusy} style={{ ...btnGhost, marginTop: 8, background: `${bg.accent}18`, borderColor: bg.accent, color: bg.accent, fontWeight: 700 }}>
                  この案で台本を作る →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ② 台本: 自由入力 ── */}
      <div style={card}>
        <p style={sectionLabel}>② 台本 — 自分でテーマを入れて作る</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input style={{ ...inp, flex: 1, minWidth: 200 }} placeholder="例: 毛穴ケアの正しい順番を3ステップで" value={freeTopic} onChange={e => setFreeTopic(e.target.value)} />
          <button onClick={() => runScript(freeTopic)} disabled={scriptBusy} style={btnPrimary}>{scriptBusy ? '台本作成中…' : '台本を作る'}</button>
        </div>
      </div>

      {/* エラー */}
      {err && (
        <div style={{ ...card, background: '#FFF1F3', border: '1px solid #FECDD3' }}>
          <p style={{ color: '#9F1239', fontWeight: 700, marginBottom: 6, fontSize: '0.9rem' }}>うまくいきませんでした</p>
          <p style={{ color: '#7F1D1D', fontSize: '0.84rem', lineHeight: 1.6, marginBottom: 10 }}>{err}</p>
          <button onClick={() => setErr(null)} style={btnGhost}>閉じる</button>
        </div>
      )}

      {/* 台本生成中 */}
      {scriptBusy && (
        <div style={card}>
          <ThinkingIndicator accent={bg.accent} variant="full"
            messages={['ネタを構成に落としています…', 'カット割りを考えています…', 'テロップと編集指示を書いています…', '撮影者・編集者向けに整えています…']}
            subtitle={activeClient ? `${activeClient.name} の台本を作成中` : undefined}
            onRetry={() => runScript(scriptTopic)} />
        </div>
      )}

      {/* ── 台本シート ── */}
      {!scriptBusy && script && (
        <>
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <p style={sectionLabel}>撮影台本</p>
                <p style={{ fontFamily: IRIS_FONTS.display, fontSize: '1.5rem', fontWeight: 700, color: bg.ink, lineHeight: 1.2 }}>{script.title}</p>
                <p style={{ fontSize: '0.8rem', color: bg.inkSoft, marginTop: 3 }}>{script.format} / 約{script.durationSec}秒{script.bgmMood ? ` / BGM: ${script.bgmMood}` : ''}</p>
              </div>
              <button onClick={copyScript} style={btnPrimary}>撮影台本をコピー</button>
            </div>
            {script.thumbnailText && (
              <p style={{ marginTop: 10, padding: '0.5rem 0.8rem', background: `${bg.accent}14`, borderRadius: 10, color: bg.ink, fontSize: '0.85rem' }}>
                <strong>表紙テキスト:</strong> {script.thumbnailText}
              </p>
            )}
            {script.hooks.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: '0.72rem', color: bg.inkSoft, fontWeight: 700, marginBottom: 4 }}>冒頭フック案 (A/B でためす)</p>
                {script.hooks.map((h, i) => (
                  <p key={i} style={{ fontSize: '0.85rem', color: bg.ink, lineHeight: 1.5 }}>・{h}</p>
                ))}
              </div>
            )}
          </div>

          {/* カット割り */}
          <div style={card}>
            <p style={sectionLabel}>カット割り (撮影者用)</p>
            <div style={{ display: 'grid', gap: 8 }}>
              {script.shots.map((sh) => (
                <div key={sh.no} style={{ padding: '0.7rem 0.9rem', background: 'rgba(255,255,255,0.6)', borderRadius: 12, borderLeft: `3px solid ${bg.accent}` }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, color: bg.accent }}>#{sh.no}</span>
                    <span style={{ fontSize: '0.72rem', color: bg.inkSoft }}>{sh.time}</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: bg.ink }}>{sh.shot}</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: bg.ink, marginTop: 4 }}><strong>撮る:</strong> {sh.action}</p>
                  {sh.line && <p style={{ fontSize: '0.85rem', color: bg.ink, marginTop: 2, fontStyle: 'italic' }}>セリフ:「{sh.line}」</p>}
                  {sh.onScreenText && <p style={{ fontSize: '0.8rem', color: bg.accent, marginTop: 2 }}>テロップ: {sh.onScreenText}</p>}
                  {sh.editNote && <p style={{ fontSize: '0.78rem', color: bg.inkSoft, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><Scissors size={12} style={{ flexShrink: 0 }} /> 編集: {sh.editNote}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* 素材・準備 */}
          {(script.broll.length > 0 || script.prep.length > 0 || script.shootingTips.length > 0) && (
            <div style={card}>
              {script.broll.length > 0 && (<><p style={sectionLabel}>差し込み素材 (B-roll)</p><ul style={{ paddingLeft: '1.2rem', color: bg.ink, lineHeight: 1.8, marginBottom: 12 }}>{script.broll.map((b, i) => <li key={i} style={{ fontSize: '0.85rem' }}>{b}</li>)}</ul></>)}
              {script.prep.length > 0 && (<><p style={sectionLabel}>撮影前の準備</p><ul style={{ paddingLeft: '1.2rem', color: bg.ink, lineHeight: 1.8, marginBottom: 12 }}>{script.prep.map((p, i) => <li key={i} style={{ fontSize: '0.85rem' }}>{p}</li>)}</ul></>)}
              {script.shootingTips.length > 0 && (<><p style={sectionLabel}>撮影のコツ</p><ul style={{ paddingLeft: '1.2rem', color: bg.ink, lineHeight: 1.8 }}>{script.shootingTips.map((t, i) => <li key={i} style={{ fontSize: '0.85rem' }}>{t}</li>)}</ul></>)}
            </div>
          )}

          {/* 投稿本文 */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <p style={{ ...sectionLabel, marginBottom: 0 }}>投稿本文</p>
              <button onClick={copyCaption} style={{ ...btnGhost, background: `${bg.accent}18`, borderColor: bg.accent, color: bg.accent, fontWeight: 700 }}>
                投稿本文をコピー
              </button>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: bg.ink, lineHeight: 1.7, fontSize: '0.88rem', margin: 0 }}>{script.caption}</pre>
            {script.hashtags.length > 0 && <p style={{ color: bg.accent, lineHeight: 1.7, marginTop: 10, fontSize: '0.84rem' }}>{script.hashtags.join(' ')}</p>}
          </div>
        </>
      )}
    </div>
  );
}
