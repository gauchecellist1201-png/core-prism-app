// ============================================================
// IRIS — 企画・台本スタジオ (運用代行モード)
// クライアント登録 → ネタ量産(企画) → 撮影者・編集者がそのまま動ける本格台本
// ============================================================
import React, { useState } from 'react';
import { Lock, Check } from 'lucide-react';
import type { AppSettings } from '../types/identity';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { notifyInApp } from '../lib/inAppNotify';
import { copyText } from './copyText';
import ThinkingIndicator from '../components/ThinkingIndicator';
import { loadIgProfile } from './instagramConnect';
import { usePostHistory } from './strategist';
import IrisReelDirector from './IrisReelDirector';
import {
  loadClients, saveClients, clientUid,
  generateIdeaPool, type IdeaItem,
  generateProductionScript, type ProductionScript,
  scriptToMarkdown, scriptToSrt, ideaPoolToMarkdown, type IrisClient,
  buildMonthlySchedule, monthlyPlanToMarkdown, monthlyPlanToHtml, type ScheduledIdea,
  captionBlock, shootingListMarkdown,
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
  goal: '', tone: '', ngWords: '', referenceNotes: '', lastMonthLearnings: '', updatedAt: new Date().toISOString(),
});

// ★テンプレ起点（白紙を見せない）：どのジャンルでも効く“切り口”の雛形。タップでフォーカス欄を埋め、
//   AIがクライアントのジャンル・人物像に合わせて具体ネタへ展開する。打鍵ゼロで企画を始められる。
const IDEA_TEMPLATES: { label: string; focus: string }[] = [
  { label: '悩み解決', focus: 'よくある悩みを1つ取り上げ、解決のステップで見せる' },
  { label: 'ビフォーアフター', focus: '導入前→導入後の変化をビフォーアフターで見せる' },
  { label: '◯選まとめ', focus: 'テーマを「◯選」でまとめ、保存したくなる形にする' },
  { label: 'よくある誤解', focus: 'よくある誤解・勘違いを正す切り口' },
  { label: '失敗談', focus: '自分の失敗談から学びを伝える共感系' },
  { label: '初心者向け基本', focus: '初心者向けに基本を一から丁寧に解説する' },
  { label: '比較で選び方', focus: 'A と B を比較して、迷っている人に選び方を示す' },
  { label: '1日ルーティン', focus: '1日の流れ・ルーティンで世界観を見せる' },
  { label: 'Q&A', focus: 'よくある質問にまとめて答えるQ&A形式' },
  { label: '保存版チェックリスト', focus: '保存版のチェックリストにまとめる' },
];

// ★台本の型（白紙を見せない・第2弾＝②台本）：どのジャンルでも効く台本の構成パターン。
//   タップで自由入力欄を埋め、AIがクライアントに合わせて本格台本へ展開する。
const SCRIPT_TEMPLATES: { label: string; topic: string }[] = [
  { label: '結論先出し3ステップ', topic: '結論を先に言い、理由を3ステップで解説する台本' },
  { label: 'ビフォーアフター', topic: '導入前→導入後の変化を見せるビフォーアフター台本' },
  { label: 'ストーリー仕立て', topic: '自分の体験談をストーリーで見せる台本' },
  { label: 'よくある誤解を正す', topic: 'よくある誤解を取り上げて正す台本' },
  { label: '比較で選び方', topic: 'A と B を比較して、迷っている人に選び方を示す台本' },
  { label: 'Q&A', topic: 'よくある質問にまとめて答えるQ&A形式の台本' },
  { label: '保存版チェックリスト', topic: '保存版のチェックリストにまとめる台本' },
  { label: '失敗談から学び', topic: '自分の失敗談から学びを伝える共感系の台本' },
];

export default function IrisScriptStudio({ bg, settings, locked }: Props) {
  if (locked) return <ScriptStudioLock bg={bg} />;
  return <ScriptStudioInner bg={bg} settings={settings} />;
}

// ─── 最上位プラン (Pro) 限定ロック画面 ───
function ScriptStudioLock({ bg }: { bg: IrisBackgroundDef }) {
  const card: React.CSSProperties = {
    background: bg.card, backdropFilter: 'blur(10px)',
    border: `1px solid ${bg.cardBorder}`, borderRadius: 20, padding: '1.6rem',
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
    <div style={{ display: 'grid', gap: '1.1rem', gridTemplateColumns: 'minmax(0, 1fr)', maxWidth: '100%' }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '0.76rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.3rem' }}>
          Plan & Script — 運用代行モード
        </p>
        <h2 style={{ fontFamily: IRIS_FONTS.display, fontSize: 'clamp(1.5rem, 7vw, 2rem)', color: bg.ink, margin: 0, fontWeight: 700 }}>企画・台本</h2>
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
              <Check size={16} color={bg.accent} strokeWidth={2.6} style={{ flexShrink: 0, marginTop: 2 }} />
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

  // 月次カレンダー (代行→クライアント承認用)
  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [perWeek, setPerWeek] = useState(3);
  const [startISO, setStartISO] = useState(todayISO);
  const [monthly, setMonthly] = useState<ScheduledIdea[]>([]);
  const [monthlyBusy, setMonthlyBusy] = useState(false);

  // 台本
  const [freeTopic, setFreeTopic] = useState('');
  const [dur, setDur] = useState(30); // 台本の尺（秒）：15/30/60 から選ぶ＝媒体に合わせた“尺違い”を即生成
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
    // 16px 未満だと iOS Safari がフォーカス時に自動ズームして画面が飛ぶため 16px 固定
    fontSize: 16, fontFamily: IRIS_FONTS.body, outline: 'none', width: '100%',
  };
  const label: React.CSSProperties = { fontSize: '0.72rem', color: bg.inkSoft, fontWeight: 700, marginBottom: 4, display: 'block' };
  const btnPrimary: React.CSSProperties = {
    background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`, color: '#fff',
    border: 'none', borderRadius: 999, padding: '0.7rem 1.4rem', fontWeight: 700, minHeight: 44,
    cursor: 'pointer', fontSize: '0.88rem', fontFamily: IRIS_FONTS.body, boxShadow: `0 8px 22px ${bg.accent}44`,
    transition: 'background 0.15s, box-shadow 0.15s, opacity 0.15s',
  };
  const btnGhost: React.CSSProperties = {
    background: 'rgba(255,255,255,0.6)', color: bg.ink, border: `1px solid ${bg.cardBorder}`,
    borderRadius: 999, padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer', minHeight: 44,
    fontSize: '0.8rem', fontFamily: IRIS_FONTS.body,
    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
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

  // コピー共通処理：古い iPhone / Instagram 内蔵ブラウザ等でも copyText の
  // フォールバック (execCommand) で救済し、成否を必ず通知する (silent fail 禁止)
  const copyWithNotify = (text: string, success: { title: string; body?: string }) => {
    void copyText(text).then((ok) => {
      if (ok) notifyInApp({ kind: 'success', ...success });
      else notifyInApp({ kind: 'warn', title: 'コピーできませんでした', body: '本文を長押しして選択→コピーしてください' });
    });
  };

  // 1案の「投稿文(キャプション＋ハッシュタグ)」をそのままコピー
  const copyIdeaCaption = (it: IdeaItem) => {
    const block = captionBlock(it);
    if (!block) { notifyInApp({ kind: 'info', title: '投稿文がまだありません', body: 'もう一度生成すると投稿文つきで出ます' }); return; }
    copyWithNotify(block, { title: '投稿文をコピーしました', body: 'Instagram の投稿欄にそのまま貼れます' });
  };

  // 1ヶ月分の投稿カレンダーを一括生成 (週 perWeek 本 × 4週)
  const runMonthly = async () => {
    setMonthlyBusy(true); setErr(null);
    try {
      const total = Math.min(20, Math.max(4, perWeek * 4));
      const list = await generateIdeaPool({ settings, client: activeClient, igProfile, pastPosts, focus: focus || undefined, count: total });
      if (!list.length) { setErr('カレンダーを作れませんでした。もう一度お試しください。'); return; }
      setMonthly(buildMonthlySchedule(list, { startISO, perWeek, igProfile }));
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setMonthlyBusy(false); }
  };

  const copyMonthly = () => {
    if (!monthly.length) return;
    const md = monthlyPlanToMarkdown(monthly, activeClient);
    copyWithNotify(md, { title: `今月の投稿カレンダー ${monthly.length}本をコピーしました`, body: 'チーム共有・履歴にそのまま使えます (Markdown)' });
  };

  // クライアント承認用の「美しい1枚もの」を新規タブで開く (そのまま印刷→PDF保存)
  const copyShootingList = () => {
    if (!monthly.length) return;
    const md = shootingListMarkdown(monthly, activeClient);
    copyWithNotify(md, { title: '今月の撮影リストをコピーしました', body: '形式ごとにまとめ撮りできる形です' });
  };

  const openMonthlyOnePager = () => {
    if (!monthly.length) return;
    const html = monthlyPlanToHtml(monthly, activeClient, { periodLabel: `${startISO} 起点・週${perWeek}本` });
    const w = window.open('', '_blank');
    if (!w) {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `投稿カレンダー-${(activeClient?.name || 'iris').replace(/[^\w぀-ヿ一-龯-]/g, '')}.html`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      notifyInApp({ kind: 'success', title: 'カレンダーを書き出しました', body: '保存したファイルを開くと、PDFで保存できます。' });
      return;
    }
    w.document.open(); w.document.write(html); w.document.close();
  };

  const runScript = async (topic: string) => {
    if (!topic.trim()) { setErr('台本にするネタ・テーマを入れてください'); return; }
    setScriptBusy(true); setErr(null); setScript(null); setScriptTopic(topic);
    try {
      const s = await generateProductionScript({ settings, client: activeClient, igProfile, pastPosts, topic, durationSec: dur });
      setScript(s);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setScriptBusy(false); }
  };

  const copyScript = () => {
    if (!script) return;
    const md = scriptToMarkdown(script, activeClient?.name);
    copyWithNotify(md, { title: '撮影台本をコピーしました', body: '撮影担当・編集担当にそのまま渡せます (Markdown)' });
  };

  // ★ワンタップ自動字幕：台本のテロップ/セリフから SRT を生成してコピー（CapCut/Edits 等にそのまま読み込める）。
  const copySubtitles = () => {
    if (!script) return;
    const srt = scriptToSrt(script);
    if (!srt.trim()) { notifyInApp({ kind: 'info', title: '字幕の元になる文言がありません', body: 'テロップ・セリフのある台本で使えます' }); return; }
    copyWithNotify(srt, { title: '字幕(SRT)をコピーしました', body: 'CapCut / CapCut Web / Edits で「字幕を読み込む」に貼れます' });
  };

  // 企画リストを丸ごと「投稿プラン」としてコピー (クライアント・チームにそのまま渡せる)
  const copyIdeaPool = () => {
    if (!ideas.length) return;
    const md = ideaPoolToMarkdown(ideas, activeClient, focus || undefined);
    copyWithNotify(md, { title: `投稿プラン ${ideas.length}本をコピーしました`, body: 'クライアント・チームにそのまま渡せます (Markdown)' });
  };

  // 投稿本文だけをそのまま Instagram などに貼れる形でコピー (本文 + ハッシュタグ)
  const copyCaption = () => {
    if (!script) return;
    const text = [script.caption, script.hashtags.length ? '\n' + script.hashtags.join(' ') : '']
      .filter(Boolean).join('\n').trim();
    if (!text) { notifyInApp({ kind: 'info', title: 'コピーする本文がありません', body: '台本を作り直してください' }); return; }
    copyWithNotify(text, { title: '投稿本文をコピーしました', body: 'Instagram などにそのまま貼り付けられます' });
  };

  return (
    // minmax(0,1fr): 中身(nowrapピル等)の max-content で grid が画面幅を超えて膨らみ、
    // 右側が丸ごと見切れるのを封じ込め (2026-07-22 機械巡回で検出)
    <div style={{ display: 'grid', gap: '1.1rem', gridTemplateColumns: 'minmax(0, 1fr)', maxWidth: '100%' }}>
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

        {activeClient && !editing && (() => {
          const grounded = !!(activeClient.referenceNotes || '').trim();
          return (
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: bg.inkSoft, lineHeight: 1.6 }}>
                {PLATFORM_LABEL[activeClient.platform]} / {activeClient.niche} / {activeClient.target}
                {activeClient.goal ? ` / ゴール: ${activeClient.goal}` : ''}
              </p>
              <span style={{
                fontSize: '0.7rem', fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                color: grounded ? '#047857' : '#B45309',
                background: grounded ? 'rgba(16,185,129,0.14)' : 'rgba(245,158,11,0.14)',
                border: `1px solid ${grounded ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.35)'}`,
              }}>
                {grounded ? '世界観 登録済み — このクライアントらしい企画が出ます' : '世界観 未登録 — 「編集」で実際の投稿例を入れると精度が上がります'}
              </span>
            </div>
          );
        })()}

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
            <div>
              <label style={label}>実際の投稿例・世界観（強く推奨）</label>
              <textarea
                style={{ ...inp, minHeight: 96, resize: 'vertical', lineHeight: 1.5 }}
                value={editing.referenceNotes || ''}
                onChange={e => setEditing({ ...editing, referenceNotes: e.target.value })}
                placeholder={'このクライアントの実際の投稿キャプションを2〜3本貼るか、定番ネタ・口調・登場人物・撮影トーンをメモ。\n例) 毎週「#○○の日常」で店内の手仕事を接写。語尾は丁寧でやわらかい。家族経営の温度感を大事に。伸びた投稿=新作の仕込み風景。'}
              />
              <p style={{ fontSize: '0.72rem', color: bg.inkSoft, marginTop: 4, lineHeight: 1.5 }}>
                これを入れると、AI が「このクライアントらしい」企画だけを出します（無関係な汎用ネタを防ぐ核心）。連携が無くてもOK。
              </p>
            </div>
            <div>
              <label style={label}>前月の手応え・今月の方針（任意）</label>
              <textarea
                style={{ ...inp, minHeight: 72, resize: 'vertical', lineHeight: 1.5 }}
                value={editing.lastMonthLearnings || ''}
                onChange={e => setEditing({ ...editing, lastMonthLearnings: e.target.value })}
                placeholder={'前月に伸びた/伸びなかった傾向や、今月強化したい方向をメモ。\n例) 「裏側・仕込み風景」の保存が伸びた。逆に商品紹介だけの投稿は反応薄。今月は職人の手元アップを増やす。'}
              />
              <p style={{ fontSize: '0.72rem', color: bg.inkSoft, marginTop: 4, lineHeight: 1.5 }}>
                次に出す企画・カレンダーに必ず反映します（伸びた傾向を増やし、薄かった切り口は減らす）。
              </p>
            </div>
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
        {/* ★テンプレ起点：白紙でこまったら、タップで切り口を入れて始められる（打鍵ゼロ）。 */}
        <div style={{ marginBottom: 10 }}>
          <p style={{ fontSize: '0.72rem', color: bg.inkSoft, fontFamily: IRIS_FONTS.body, margin: '0 0 6px' }}>白紙でこまったら、今日のテンプレから：</p>
          <div className="iris-tpl-row" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            {IDEA_TEMPLATES.map(t => {
              const on = focus === t.focus;
              return (
                <button key={t.label} type="button" onClick={() => setFocus(on ? '' : t.focus)} style={{
                  flexShrink: 0, minHeight: 36, padding: '7px 13px', borderRadius: 999,
                  border: `1px solid ${on ? bg.accent : bg.cardBorder}`,
                  background: on ? bg.accent : 'transparent',
                  color: on ? '#fff' : bg.ink,
                  fontSize: '0.8rem', fontFamily: IRIS_FONTS.body, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                }}>{t.label}</button>
              );
            })}
          </div>
          <style>{`.iris-tpl-row::-webkit-scrollbar{display:none}`}</style>
        </div>
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
                {it.caption && (
                  <div style={{ marginTop: 8, padding: '0.55rem 0.7rem', background: `${bg.accent}0E`, border: `1px solid ${bg.accent}33`, borderRadius: 10 }}>
                    <p style={{ fontSize: '0.78rem', color: bg.ink, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{it.caption}</p>
                    {it.hashtags && it.hashtags.length > 0 && (
                      <p style={{ fontSize: '0.74rem', color: bg.accent, marginTop: 4, fontWeight: 600 }}>{it.hashtags.join(' ')}</p>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  <button onClick={() => runScript(it.hook + ' — ' + it.angle)} disabled={scriptBusy} style={{ ...btnGhost, background: `${bg.accent}18`, borderColor: bg.accent, color: bg.accent, fontWeight: 700 }}>
                    この案で台本を作る →
                  </button>
                  {it.caption && (
                    <button onClick={() => copyIdeaCaption(it)} style={{ ...btnGhost, fontWeight: 700 }}>投稿文をコピー</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ①' 今月の投稿カレンダー (代行→クライアント承認用) ── */}
      <div style={card}>
        <p style={sectionLabel}>① ＋ 今月の投稿カレンダー</p>
        <p style={{ fontSize: '0.82rem', color: bg.inkSoft, lineHeight: 1.6, marginBottom: 10 }}>
          1ヶ月分の投稿を<strong style={{ color: bg.ink }}>投稿日つき</strong>で一括生成。クライアント承認用の<strong style={{ color: bg.ink }}>美しい1枚もの</strong>でそのまま書き出せます。
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
          <div>
            <label style={label}>投稿頻度</label>
            <select style={{ ...inp, width: 150 }} value={perWeek} onChange={e => setPerWeek(Number(e.target.value))}>
              <option value={2}>週2回（計8本）</option>
              <option value={3}>週3回（計12本）</option>
              <option value={5}>週5回（計20本）</option>
            </select>
          </div>
          <div>
            <label style={label}>開始日</label>
            <input type="date" style={{ ...inp, width: 160 }} value={startISO} onChange={e => setStartISO(e.target.value || todayISO)} />
          </div>
          <button onClick={runMonthly} disabled={monthlyBusy} style={{ ...btnPrimary, opacity: monthlyBusy ? 0.6 : 1 }}>
            {monthlyBusy ? '生成中…' : '1ヶ月分を一括生成'}
          </button>
        </div>
        {monthlyBusy && (
          <ThinkingIndicator accent={bg.accent} variant="compact" messages={['今月の投稿カレンダーを組んでいます…', 'ネタを量産しています…', '投稿日を割り当てています…', '形式と撮影の手間を整えています…']} />
        )}
        {!monthlyBusy && monthly.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={openMonthlyOnePager} style={btnPrimary}>承認用ページを開く（PDF保存）</button>
              <button onClick={copyMonthly} style={{ ...btnGhost, background: `${bg.accent}18`, borderColor: bg.accent, color: bg.accent, fontWeight: 700 }}>カレンダーをコピー</button>
              <button onClick={copyShootingList} style={{ ...btnGhost, fontWeight: 700 }}>今月の撮影リストをコピー</button>
            </div>
            {Array.from(new Set(monthly.map(m => m.week))).sort((a, b) => a - b).map(w => (
              <div key={w}>
                <p style={{ fontSize: '0.74rem', fontWeight: 800, color: bg.accent, margin: '4px 0' }}>第{w + 1}週</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {monthly.filter(m => m.week === w).map((it, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '0.55rem 0.8rem', background: 'rgba(255,255,255,0.62)', borderRadius: 12, borderLeft: `3px solid ${bg.accent}` }}>
                      <div style={{ flexShrink: 0, width: 70, textAlign: 'center' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.82rem', color: bg.ink }}>{it.label}</div>
                        <div style={{ fontSize: '0.7rem', color: bg.inkSoft }}>{it.time}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '0.64rem', fontWeight: 800, color: '#1c1c24', background: EFFORT_COLOR[it.effort], padding: '0.08rem 0.45rem', borderRadius: 999 }}>{it.format}・手間{it.effort}</span>
                        <p style={{ fontWeight: 700, color: bg.ink, lineHeight: 1.4, marginTop: 4 }}>{it.hook}</p>
                        <p style={{ fontSize: '0.76rem', color: bg.inkSoft, marginTop: 2 }}>{it.angle}</p>
                        {it.caption && (
                          <div style={{ marginTop: 6, padding: '0.45rem 0.6rem', background: `${bg.accent}0E`, border: `1px solid ${bg.accent}33`, borderRadius: 9 }}>
                            <p style={{ fontSize: '0.76rem', color: bg.ink, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{it.caption}</p>
                            {it.hashtags && it.hashtags.length > 0 && (
                              <p style={{ fontSize: '0.72rem', color: bg.accent, marginTop: 3, fontWeight: 600 }}>{it.hashtags.join(' ')}</p>
                            )}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                          <button onClick={() => runScript(it.hook + ' — ' + it.angle)} disabled={scriptBusy} style={{ ...btnGhost, fontSize: '0.74rem', padding: '0.35rem 0.8rem', background: `${bg.accent}18`, borderColor: bg.accent, color: bg.accent, fontWeight: 700 }}>
                            この案で台本を作る →
                          </button>
                          {it.caption && (
                            <button onClick={() => copyIdeaCaption(it)} style={{ ...btnGhost, fontSize: '0.74rem', padding: '0.35rem 0.8rem', fontWeight: 700 }}>投稿文をコピー</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ② 台本: 自由入力 ── */}
      <div style={card}>
        <p style={sectionLabel}>② 台本 — 自分でテーマを入れて作る</p>
        {/* ★台本の型：白紙でこまったら、タップで型を入れて始められる（AIがクライアントに合わせて展開）。 */}
        <div style={{ marginBottom: 10 }}>
          <p style={{ fontSize: '0.72rem', color: bg.inkSoft, fontFamily: IRIS_FONTS.body, margin: '0 0 6px' }}>白紙でこまったら、台本の型から：</p>
          <div className="iris-tpl-row" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            {SCRIPT_TEMPLATES.map(t => {
              const on = freeTopic === t.topic;
              return (
                <button key={t.label} type="button" onClick={() => setFreeTopic(on ? '' : t.topic)} style={{
                  flexShrink: 0, minHeight: 36, padding: '7px 13px', borderRadius: 999,
                  border: `1px solid ${on ? bg.accent : bg.cardBorder}`,
                  background: on ? bg.accent : 'transparent',
                  color: on ? '#fff' : bg.ink,
                  fontSize: '0.8rem', fontFamily: IRIS_FONTS.body, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                }}>{t.label}</button>
              );
            })}
          </div>
        </div>
        {/* ★尺（秒数）を選んで台本を作る＝媒体に合わせた“尺違い”をその場で生成（Bufferの複数バリエの一部）。 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', color: bg.inkSoft, fontFamily: IRIS_FONTS.body }}>尺：</span>
          {[15, 30, 60].map(d => {
            const on = dur === d;
            return (
              <button key={d} type="button" onClick={() => setDur(d)} style={{
                minHeight: 34, padding: '6px 13px', borderRadius: 999, cursor: 'pointer',
                border: `1px solid ${on ? bg.accent : bg.cardBorder}`,
                background: on ? bg.accent : 'transparent', color: on ? '#fff' : bg.ink,
                fontSize: '0.8rem', fontWeight: 700, fontFamily: IRIS_FONTS.body,
              }}>{d}秒</button>
            );
          })}
          <span style={{ fontSize: '0.7rem', color: bg.inkSoft, fontFamily: IRIS_FONTS.body }}>（リール=15〜30秒 / 解説=60秒 が目安）</span>
        </div>
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
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={copySubtitles} style={{ ...btnGhost, borderColor: bg.accent, color: bg.accent, fontWeight: 700 }} title="テロップ/セリフから字幕(SRT)を作り、CapCut/Editsに読み込めます">字幕を作る（CapCut/Edits用）</button>
                <button onClick={copyScript} style={btnPrimary}>撮影台本をコピー</button>
              </div>
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

          {/* ★リール監督モード: カット単位のタイムライン編集 + テロップの見え方プレビュー
              + 構成テンプレ + 仕上げチェック + CapCut/Edits 書き出しハブ。
              編集内容は onShotsChange で script.shots に書き戻されるため、
              上の「撮影台本をコピー」「字幕を作る」も常に編集後の最新版になる。 */}
          <IrisReelDirector
            key={script.generatedAt}
            bg={bg}
            script={script}
            clientName={activeClient?.name}
            onShotsChange={(shots, durationSec) =>
              setScript(prev => prev ? { ...prev, shots, durationSec } : prev)}
          />

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
