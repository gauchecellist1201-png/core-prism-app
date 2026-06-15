// ============================================================
// ContentEngineStudio — CORE で CORE のマーケを自動化する
// 1 つのテーマから note 記事 + X スレッド を 1 クリックで同時生成
// 「分かりやすさ」優先のシンプルな 3 ステップ UI
// ============================================================
import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Persona, AppSettings, KnowledgeItem } from '../types/identity';
import {
  generateNoteArticle, generateXPost, proposeContentTopics, TONE_OPTIONS,
  type SocialTone, type ContentTopicProposal,
  generateWeeklyPlan, type WeeklyPlanDay,
  generateMultiPlatformPost, type MultiPlatformDraft,
  PLATFORM_META, type SocialPlatform,
} from '../lib/socialDraft';
import AgentProposalCard from './AgentProposalCard';
import EmptyState from './EmptyState';
import ThinkingIndicator from './ThinkingIndicator';
import GenerationReward from './GenerationReward';
import ApiErrorCard from './ApiErrorCard';
import ShareArtifactButton from './ShareArtifactButton';
import { StudioIntro } from './StudioIntro';
import { useAgentTaskQueue } from '../hooks/useAgentTaskQueue';
import { notifyInApp } from '../lib/inAppNotify';
import {
  fetchXStatus, startXConnect, postXThread, disconnectX,
  readXCallbackResult, translateXError, type XStatus,
} from '../lib/xConnect';

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
const KEY_WEEKLY = 'core_content_engine_weekly_v1';

interface WeeklyDayWithDrafts extends WeeklyPlanDay {
  /** AI が書いた本文 (生成済みの場合) */
  draft?: MultiPlatformDraft;
  /** その日の生成が進行中か */
  drafting?: boolean;
}

function loadWeeklyPlan(): WeeklyDayWithDrafts[] {
  try {
    const raw = localStorage.getItem(KEY_WEEKLY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveWeeklyPlan(days: WeeklyDayWithDrafts[]) {
  try { localStorage.setItem(KEY_WEEKLY, JSON.stringify(days)); } catch { /* */ }
}

function loadHistory(): History[] {
  try {
    const raw = localStorage.getItem(KEY_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveHistory(items: History[]) {
  try { localStorage.setItem(KEY_HISTORY, JSON.stringify(items.slice(0, 30))); } catch { /* */ }
}

// TTT (2026-06-04): SVG 生成デモ (Claude → SVG)
import SvgFromConceptDemo from './SvgFromConceptDemo';

export default function ContentEngineStudio({ persona, settings, knowledge, onClose }: Props) {
  const [mode, setMode] = useState<'single' | 'weekly'>('single');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  // TTT (2026-06-04): SVG デモ
  const [showSvgDemo, setShowSvgDemo] = useState(false);
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState<SocialTone>('storytelling');
  const [history, setHistory] = useState<History[]>(() => loadHistory());

  // ─── 週次計画 ───
  const [weeklyDays, setWeeklyDays] = useState<WeeklyDayWithDrafts[]>(() => loadWeeklyPlan());
  const [weeklyBusy, setWeeklyBusy] = useState(false);
  const [weeklyFocus, setWeeklyFocus] = useState('');
  const [delegating, setDelegating] = useState(false);

  const queue = useAgentTaskQueue();

  useEffect(() => { saveWeeklyPlan(weeklyDays); }, [weeklyDays]);

  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [xThread, setXThread] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);

  const [progress, setProgress] = useState<'note' | 'x' | 'done' | null>(null);
  const [isGen, setIsGen] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ─── X 自動投稿 連携 ─────────────────────────────
  const [xStatus, setXStatus] = useState<XStatus>({ configured: false, connected: false });
  const [xPosting, setXPosting] = useState(false);

  const refreshXStatus = useCallback(async () => {
    setXStatus(await fetchXStatus());
  }, []);

  // 起動時に連携状態を取得 + コールバック結果(?x_connected/?x_error)を拾う
  useEffect(() => {
    const cb = readXCallbackResult();
    if (cb) {
      if (cb.connected) {
        notifyInApp({ kind: 'success', title: 'Xと連携しました', body: 'これで「Xに投稿する」からワンタップ投稿できます。' });
      } else if (cb.error) {
        notifyInApp({ kind: 'warn', title: 'X連携でエラー', body: translateXError(cb.error) });
      }
    }
    refreshXStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleXPost = useCallback(async () => {
    if (xThread.length === 0) return;
    setXPosting(true);
    try {
      const r = await postXThread(xThread);
      if (r.ok && r.urls && r.urls.length > 0) {
        notifyInApp({
          kind: 'success',
          title: `Xに${r.urls.length}本のスレッドを投稿しました`,
          body: r.urls[0],
        });
      } else if (r.error === 'reauth') {
        notifyInApp({ kind: 'warn', title: '再連携が必要です', body: r.message || 'もう一度「Xアカウントと連携」してください。' });
        setXStatus((s) => ({ ...s, connected: false }));
      } else if (r.error === 'rate') {
        notifyInApp({ kind: 'warn', title: '投稿上限に達しました', body: r.message || 'Xの投稿上限に達しました（無料枠は月500件）。' });
      } else {
        notifyInApp({ kind: 'warn', title: 'X投稿に失敗', body: r.message || 'Xへの投稿に失敗しました。' });
      }
    } finally {
      setXPosting(false);
    }
  }, [xThread]);

  const handleXDisconnect = useCallback(async () => {
    const ok = await disconnectX();
    if (ok) {
      setXStatus((s) => ({ ...s, connected: false, username: undefined }));
      notifyInApp({ kind: 'info', title: 'Xの連携を解除しました', body: 'いつでも再連携できます。' });
    }
  }, []);

  // 先回り提案: AI が起動時にテーマ 3 案を先出し
  const [proposals, setProposals] = useState<ContentTopicProposal[]>([]);
  const [proposalsBusy, setProposalsBusy] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const personaKnowledge = knowledge.filter(k => k.personaId === persona.id);

  const loadProposals = useCallback(async () => {
    setProposalsBusy(true);
    setError(null);
    try {
      const list = await proposeContentTopics({
        settings, persona,
        knowledge: personaKnowledge.slice(0, 6),
      });
      setProposals(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProposalsBusy(false);
    }
  }, [settings, persona, personaKnowledge]);

  // 起動時に 1 回だけ自動で提案を取りに行く
  useEffect(() => {
    loadProposals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = useCallback(async (overrideTopic?: string, overrideTone?: SocialTone) => {
    const useTopic = (overrideTopic ?? topic).trim();
    const useTone = overrideTone ?? tone;
    if (!useTopic) {
      setError('テーマを入力してください');
      return;
    }
    setTopic(useTopic);
    setTone(useTone);
    setIsGen(true);
    setError(null);
    setStep(2);
    try {
      // 1) note 記事生成
      setProgress('note');
      const noteDraft = await generateNoteArticle({
        topic: useTopic, tone: useTone,
        persona, settings,
        knowledge: personaKnowledge.slice(0, 6),
        targetWords: 1500,
      });
      setNoteTitle(noteDraft.title || useTopic);
      setNoteBody(noteDraft.body);

      // 2) X スレッド生成
      setProgress('x');
      const xDraft = await generateXPost({
        topic: useTopic, tone: useTone,
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
        topic: useTopic,
        noteTitle: noteDraft.title || useTopic,
        noteBody: noteDraft.body,
        xThread: thread,
        hashtags: noteDraft.tags || [],
        generatedAt: Date.now(),
      };
      const next = [item, ...history];
      setHistory(next);
      saveHistory(next);

      setProgress('done');
      setShowReward(true);
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

  // ─── 週次計画ジェネレーター ───
  const buildWeeklyPlan = useCallback(async () => {
    setWeeklyBusy(true);
    setError(null);
    try {
      const days = await generateWeeklyPlan({
        settings, persona,
        knowledge: personaKnowledge.slice(0, 6),
        focus: weeklyFocus || undefined,
      });
      setWeeklyDays(days);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWeeklyBusy(false);
    }
  }, [settings, persona, personaKnowledge, weeklyFocus]);

  // ─── 各投稿カードの本文を AI に書いてもらう ───
  const draftDay = useCallback(async (dayIdx: number) => {
    setWeeklyDays(prev => prev.map((d, i) => i === dayIdx ? { ...d, drafting: true } : d));
    try {
      const day = weeklyDays[dayIdx];
      if (!day) return;
      const draft = await generateMultiPlatformPost({
        settings, persona,
        topic: day.title,
        tone: day.tone,
        knowledge: personaKnowledge.slice(0, 4),
        platforms: day.platforms,
        customInstruction: day.hook ? `切り口: ${day.hook}` : undefined,
      });
      setWeeklyDays(prev => prev.map((d, i) => i === dayIdx ? { ...d, draft, drafting: false } : d));
    } catch (e) {
      setWeeklyDays(prev => prev.map((d, i) => i === dayIdx ? { ...d, drafting: false } : d));
      notifyInApp({ kind: 'warn', title: 'AI 本文生成に失敗', body: e instanceof Error ? e.message : String(e) });
    }
  }, [weeklyDays, settings, persona, personaKnowledge]);

  // ─── 週次計画を CMO に委任 ───
  const delegateToCMO = useCallback(() => {
    if (weeklyDays.length === 0) {
      notifyInApp({ kind: 'info', title: '先に週次計画を作ってください', body: '「今週の 7 日計画を AI に」ボタンから' });
      return;
    }
    setDelegating(true);
    const summary = weeklyDays.map(d => `${d.weekday}: ${d.title}`).join(' / ');
    queue.propose({
      title: `今週の SNS 投稿 7 本を仕上げる`,
      summary: `${weeklyDays.length} 日分の投稿テーマ (${summary.slice(0, 120)}…) を CMO が本文化し、各プラットフォーム向けに最適化、ハッシュタグまで揃えます。`,
      why: '計画があっても本文と画像が無ければ投稿できない。今週の 7 本を「投稿ボタンを押すだけ」状態にする。',
      expected: `7 日分の投稿本文 (各プラットフォーム最適化) + ハッシュタグ + 投稿時刻 が 1 表に揃う`,
      dueDays: 2,
      steps: [
        { cxo: 'CMO', label: '各日のテーマから多プラットフォーム本文を生成 (X / IG / note / LinkedIn)' },
        { cxo: 'CDO', label: '各投稿のビジュアル指示 (画像 or 動画) を 1 枚に' },
        { cxo: 'CDS', label: '過去投稿のエンゲージメントから投稿時刻を最適化' },
        { cxo: 'CMO', label: '7 本を一覧表に整え、コピペで投稿可能な状態に' },
      ],
    });
    notifyInApp({ kind: 'success', title: '週次計画を CMO に委任しました', body: 'AgentTaskQueue で進捗が見えます' });
    setTimeout(() => setDelegating(false), 600);
  }, [weeklyDays, queue]);

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
        className="cp-modal w-full max-w-[1400px] overflow-y-auto"
        style={{
          position: 'relative',
          background: 'var(--surface-1, #0e0e15)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 18,
          color: 'var(--fg)',
          maxHeight: 'calc(100dvh - 1.5rem)',
        }}
      >
        {/* 生成が終わった瞬間のごほうび演出 (1.7 秒で自動的に消える) */}
        {showReward && (
          <GenerationReward
            accent={accent}
            label="できました！"
            detail="note と X、両方そろいました"
            onDone={() => setShowReward(false)}
          />
        )}
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
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>note × X 同時生成</h2>
          </div>
          {/* TTT (2026-06-04): SVG 概念お絵描き */}
          <button
            onClick={() => setShowSvgDemo(true)}
            title="概念 → SVG (AI お絵描き)"
            aria-label="SVG 概念お絵描き"
            style={{
              padding: '6px 12px', borderRadius: 999,
              background: 'rgba(167,139,250,0.18)',
              border: '1px solid rgba(167,139,250,0.4)',
              color: '#ddd6fe', cursor: 'pointer',
              fontSize: 11, fontWeight: 800,
              display: 'inline-flex', alignItems: 'center', gap: 4,
              flexShrink: 0,
            }}
          >✨ SVG</button>
          <button onClick={onClose} aria-label="閉じる" className="hover:text-fg" style={{ width: 40, height: 40, minWidth: 40, borderRadius: 999, color: 'var(--fg)', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', fontSize: 20, lineHeight: 1, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </header>

        {/* TTT (2026-06-04): SVG 生成 ダイアログ */}
        <SvgFromConceptDemo open={showSvgDemo} onClose={() => setShowSvgDemo(false)} />

        {/* モード切替: 単発 / 週次 */}
        <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 6 }}>
          <button onClick={() => setMode('single')} style={{
            flex: 1, padding: '0.55rem', borderRadius: 8,
            background: mode === 'single' ? accent : 'rgba(255,255,255,0.05)',
            color: mode === 'single' ? '#fff' : 'var(--fg-muted)',
            border: 'none', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
          }}>📝 単発投稿 (note × X)</button>
          <button onClick={() => setMode('weekly')} style={{
            flex: 1, padding: '0.55rem', borderRadius: 8,
            background: mode === 'weekly' ? accent : 'rgba(255,255,255,0.05)',
            color: mode === 'weekly' ? '#fff' : 'var(--fg-muted)',
            border: 'none', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
          }}>📅 週次計画 (7 日 grid)</button>
        </div>

        {/* ステップインジケータ (単発モードのみ) */}
        {mode === 'single' && <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
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
        </div>}

        {/* ─── 週次計画モード ─── */}
        {mode === 'weekly' && (
          <div style={{ padding: '1.25rem 1.5rem 1.5rem' }}>
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', lineHeight: 1.7 }}>
                来週 7 日分の SNS 投稿テーマを AI が一気に組み立てます。
                各カードの「✨ AI に書いてもらう」で本文も自動生成。
                出来た計画は <strong style={{ color: 'var(--fg)' }}>CMO に委任</strong>して仕上げまで任せられます。
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <input
                value={weeklyFocus}
                onChange={e => setWeeklyFocus(e.target.value)}
                placeholder="今週のフォーカス (任意 — 例: 新サービス告知)"
                style={{
                  flex: 1, minWidth: 200, padding: '0.7rem 0.95rem', borderRadius: 10,
                  background: 'var(--surface-3)', border: '1px solid var(--border)',
                  color: 'var(--fg)', fontSize: '0.88rem',
                }}
              />
              <button
                onClick={buildWeeklyPlan}
                disabled={weeklyBusy}
                style={{
                  padding: '0.7rem 1.2rem',
                  background: weeklyBusy ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                  color: '#fff', border: 'none', borderRadius: 10,
                  fontSize: '0.85rem', fontWeight: 800, cursor: weeklyBusy ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >{weeklyBusy ? '計画中…' : '✨ 今週の 7 日計画を AI に'}</button>
              <button
                onClick={delegateToCMO}
                disabled={delegating || weeklyDays.length === 0}
                style={{
                  padding: '0.7rem 1.1rem',
                  background: 'rgba(255,255,255,0.05)',
                  color: weeklyDays.length === 0 ? 'var(--fg-muted)' : 'var(--fg)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 10, fontSize: '0.82rem', fontWeight: 700,
                  cursor: delegating || weeklyDays.length === 0 ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >🤝 CMO に委任</button>
            </div>

            <ApiErrorCard error={error} onRetry={buildWeeklyPlan} />

            {weeklyBusy && (
              <ThinkingIndicator
                accent={accent}
                variant="compact"
                messages={[
                  '🗓 7 日間のリズムを設計しています…',
                  '🎭 トーンを散らしています…',
                  '📲 各日のプラットフォームを選んでいます…',
                ]}
              />
            )}

            {weeklyDays.length > 0 && !weeklyBusy && (
              <div style={{ overflowX: 'auto' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, minmax(180px, 1fr))',
                  gap: 8,
                  minWidth: 1260,
                }}>
                  {weeklyDays.map((d, i) => {
                    const toneMeta = TONE_OPTIONS.find(t => t.value === d.tone);
                    return (
                      <div key={d.date} style={{
                        background: 'var(--surface-3)',
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        padding: '0.7rem',
                        display: 'flex', flexDirection: 'column', gap: 6,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--fg-muted)', fontWeight: 700 }}>
                            {d.weekday} / {d.date.slice(5)}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: accent, fontWeight: 700 }}>{d.bestTime}</span>
                        </div>
                        <p style={{ fontSize: '0.85rem', fontWeight: 800, lineHeight: 1.35, color: 'var(--fg)' }}>
                          {d.title}
                        </p>
                        {d.hook && (
                          <p style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', fontStyle: 'italic', lineHeight: 1.5 }}>
                            {d.hook}
                          </p>
                        )}
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {toneMeta && (
                            <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', background: `${accent}22`, color: accent, borderRadius: 999, fontWeight: 700 }}>
                              {toneMeta.emoji} {toneMeta.label}
                            </span>
                          )}
                          {d.platforms.map(p => (
                            <span key={p} style={{
                              fontSize: '0.65rem', padding: '0.15rem 0.4rem',
                              background: 'rgba(255,255,255,0.05)', color: 'var(--fg)',
                              borderRadius: 999, fontWeight: 600,
                            }}>{PLATFORM_META[p as SocialPlatform]?.emoji ?? ''} {PLATFORM_META[p as SocialPlatform]?.label?.split(' ')[0] ?? p}</span>
                          ))}
                        </div>

                        <button
                          onClick={() => draftDay(i)}
                          disabled={d.drafting}
                          style={{
                            marginTop: 'auto',
                            padding: '0.5rem',
                            background: d.draft ? 'rgba(34, 197, 94, 0.15)' : accent,
                            color: d.draft ? '#22c55e' : '#fff',
                            border: d.draft ? '1px solid rgba(34, 197, 94, 0.4)' : 'none',
                            borderRadius: 8,
                            fontSize: '0.72rem', fontWeight: 800,
                            cursor: d.drafting ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {d.drafting ? '書いてます…' : d.draft ? '✓ 書き直す' : '✨ AI に書いてもらう'}
                        </button>

                        {d.draft && (
                          <div style={{ marginTop: 4, display: 'grid', gap: 4 }}>
                            {d.platforms.map(p => {
                              const body = d.draft?.posts?.[p as SocialPlatform];
                              if (!body) return null;
                              return (
                                <details key={p} style={{
                                  fontSize: '0.7rem',
                                  background: 'rgba(0,0,0,0.2)',
                                  borderRadius: 6, padding: '0.35rem 0.5rem',
                                }}>
                                  <summary style={{ cursor: 'pointer', color: 'var(--fg-muted)', fontWeight: 700 }}>
                                    {PLATFORM_META[p as SocialPlatform]?.emoji ?? ''} {PLATFORM_META[p as SocialPlatform]?.label?.split(' ')[0] ?? p}
                                  </summary>
                                  <p style={{ marginTop: 4, color: 'var(--fg)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                    {body}
                                  </p>
                                  <button
                                    onClick={() => copy(body, `wk-${i}-${p}`)}
                                    style={{
                                      marginTop: 4, padding: '0.2rem 0.5rem', fontSize: '0.65rem',
                                      background: 'rgba(255,255,255,0.08)', color: 'var(--fg)',
                                      border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, cursor: 'pointer',
                                    }}
                                  >{copiedKey === `wk-${i}-${p}` ? '✓' : 'コピー'}</button>
                                </details>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {weeklyDays.length === 0 && !weeklyBusy && (
              <EmptyState
                icon="📅"
                title="まだ 7 日計画はありません"
                description={'AI が「月: note 告知 → 火: X リール → 週末: ライブ」のように、来週 7 日分を一気に並べます。\n各日カードから本文と画像のドラフトまで AI に下書きしてもらえます。'}
                ctaLabel="今週の 7 日計画を AI に"
                onCta={buildWeeklyPlan}
                accent={accent}
                preview="月 note / 火 X / 水 Instagram / 木 LinkedIn / 金 YouTube / 土 ライブ / 日 まとめ"
                showSample={false}
              />
            )}
          </div>
        )}

        {mode === 'single' && step === 1 && (
          <div style={{ padding: '1.25rem 1.5rem 0' }}>
            <StudioIntro
              id="content-engine"
              accent={accent}
              emoji="📡"
              what="同じ話題から note 記事 (長文) と X 投稿 (140 字) を 同時に 作る場所です。"
              tryThis="✓ で AI 提案テーマを承認するだけ。あとは生成 → コピー → 投稿の 3 ステップ。"
              example="「来週イベント告知」を承認 → note 800 字 + X 投稿 1 本が一度に並ぶ。"
              sampleLabel="この 2 本が同時に出ます"
              samplePreview={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130 }}>
                  <div
                    style={{
                      background: '#ffffff',
                      color: '#0f172a',
                      borderRadius: 4,
                      padding: '5px 6px',
                      fontSize: 6,
                      lineHeight: 1.45,
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
                      borderLeft: `2px solid ${accent}`,
                    }}
                    aria-label="note 記事のサンプル"
                  >
                    <div style={{ fontSize: 5, letterSpacing: '0.14em', color: '#10b981', fontWeight: 800, marginBottom: 1 }}>note</div>
                    <div style={{ fontSize: 8, fontWeight: 800, marginBottom: 2, lineHeight: 1.3 }}>
                      AI 経営って「考えなくていい」のがズルい
                    </div>
                    <div style={{ opacity: 0.7, fontSize: 5.5 }}>こんにちは、◯◯です。今日は「判断疲れ」をテーマに —</div>
                    <div style={{ opacity: 0.45, fontSize: 5, marginTop: 2 }}>📖 約 4 分 / 826 字</div>
                  </div>
                  <div
                    style={{
                      background: '#000000',
                      color: '#ffffff',
                      borderRadius: 4,
                      padding: '5px 6px',
                      fontSize: 6,
                      lineHeight: 1.5,
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      boxShadow: '0 3px 10px rgba(0,0,0,0.35)',
                    }}
                    aria-label="X 投稿のサンプル"
                  >
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 2 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent }} />
                      <span style={{ fontWeight: 800, fontSize: 6 }}>あなた</span>
                      <span style={{ opacity: 0.5, fontSize: 5.5 }}>@you</span>
                    </div>
                    <div style={{ fontSize: 6.5, lineHeight: 1.5 }}>
                      「考えなくていい」が一番のごほうび。AI に任せて空いた頭で、もっと本質を選ぶ。
                    </div>
                    <div style={{ opacity: 0.5, fontSize: 5, marginTop: 2 }}>♥ 32 · 🔁 8 · 💬 4</div>
                  </div>
                </div>
              }
            />
          </div>
        )}

        {/* ─── STEP 1: AI が先回りでテーマを 3 案提案 ─── */}
        {mode === 'single' && step === 1 && (
          <div style={{ padding: '1.5rem' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: '1.1rem', lineHeight: 1.7 }}>
              入力はいりません。AI が今日の投稿テーマを <strong style={{ color: 'var(--fg)' }}>3 案</strong>先に考えました。
              気に入ったら <strong style={{ color: 'var(--fg)' }}>✓ 承認</strong>で note と X を同時に作ります。
            </p>

            {/* 提案を考え中 */}
            {proposalsBusy && (
              <ThinkingIndicator
                accent={accent}
                variant="compact"
                messages={[
                  '🧠 今日の話題をさがしています…',
                  '📚 あなたのナレッジを見ています…',
                  '💡 刺さるテーマを 3 案えらんでいます…',
                ]}
              />
            )}

            {/* 3 案の提案カード */}
            {!proposalsBusy && proposals.length > 0 && (
              <div style={{ display: 'grid', gap: 10 }}>
                <AnimatePresence>
                  {proposals.map((p, i) => (
                    <AgentProposalCard
                      key={p.title + i}
                      icon={['📝', '💡', '🎤'][i] || '✨'}
                      title={p.title}
                      reason={p.reason}
                      accentColor={accent}
                      draft={p.hook}
                      meta={`トーン: ${TONE_OPTIONS.find(t => t.value === p.tone)?.label || p.tone}`}
                      approveLabel="✓ これで note と X を作る"
                      busy={isGen}
                      onApprove={() => handleGenerate(p.title, p.tone)}
                      onRefine={(ins) => handleGenerate(`${p.title}（${ins}）`, p.tone)}
                      onDismiss={() => setProposals(prev => prev.filter((_, idx) => idx !== i))}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* 提案ゼロ */}
            {!proposalsBusy && proposals.length === 0 && (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: 10 }}>提案がまだありません</p>
                <button onClick={loadProposals} style={{
                  padding: '0.6rem 1.1rem', background: accent, color: '#fff', border: 'none',
                  borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                }}>🔄 AI に考えてもらう</button>
              </div>
            )}

            {/* 別の 3 案 */}
            {!proposalsBusy && proposals.length > 0 && (
              <button onClick={loadProposals} disabled={isGen} style={{
                width: '100%', marginTop: 12, padding: '0.65rem',
                background: 'rgba(255,255,255,0.04)', color: 'var(--fg)',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
                fontSize: '0.82rem', fontWeight: 700, cursor: isGen ? 'not-allowed' : 'pointer',
              }}>🔄 別の 3 案を出してもらう</button>
            )}

            <ApiErrorCard error={error} onRetry={() => handleGenerate()} />

            {/* 自分でテーマを書く (折りたたみ) */}
            <button onClick={() => setShowManual(s => !s)} style={{
              marginTop: 16, background: 'none', border: 'none', color: 'var(--fg-muted)',
              fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', padding: 0,
            }}>{showManual ? '▲ 閉じる' : '✍ 自分でテーマを書く'}</button>

            {showManual && (
              <div style={{ marginTop: 10 }}>
                <textarea
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="例: 昨日の商談で気づいた、刺さる提案の共通点"
                  rows={3}
                  style={{
                    width: '100%', padding: '0.85rem 1rem',
                    borderRadius: 10, background: 'var(--surface-3)', border: '1px solid var(--border)',
                    color: 'var(--fg)', resize: 'none', fontSize: '16px',
                  }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {TONE_OPTIONS.map(t => (
                    <button key={t.value} onClick={() => setTone(t.value)} style={{
                      fontSize: '0.82rem', padding: '0.5rem 0.9rem', borderRadius: 999,
                      background: tone === t.value ? accent : 'rgba(255,255,255,0.04)',
                      border: tone === t.value ? 'none' : '1px solid rgba(255,255,255,0.1)',
                      color: tone === t.value ? '#fff' : 'var(--fg)',
                      cursor: 'pointer', fontWeight: 600,
                    }}>{t.emoji} {t.label}</button>
                  ))}
                </div>
                <button
                  onClick={() => handleGenerate()}
                  disabled={isGen || !topic.trim()}
                  style={{
                    width: '100%', marginTop: 14, padding: '0.85rem',
                    background: topic.trim() ? `linear-gradient(135deg, ${accent}, ${accent}cc)` : 'var(--surface-3)',
                    color: topic.trim() ? '#fff' : 'var(--fg-muted)',
                    border: 'none', borderRadius: 12,
                    fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.06em',
                    cursor: topic.trim() ? 'pointer' : 'not-allowed',
                  }}
                >✨ note と X を同時に生成する</button>
              </div>
            )}
          </div>
        )}

        {/* ─── STEP 2: 生成中 ─── */}
        {mode === 'single' && step === 2 && (
          <ThinkingIndicator
            accent={accent}
            variant="full"
            messages={[
              '🧠 あなたのナレッジを読み込んでいます…',
              `🎭 人格「${persona.name}」の口調をなぞっています…`,
              '📝 本文の流れを組み立てています…',
              '🔍 言い回しをていねいに整えています…',
              '✨ 最後の仕上げをしています…',
            ]}
            subtitle={
              progress === 'note' ? 'いま note 記事を書いています'
                : progress === 'x' ? 'いま X スレッドに整えています'
                : '人格の口調で、ナレッジを参照しています'
            }
            onRetry={() => handleGenerate(topic, tone)}
          />
        )}

        {/* ─── STEP 3: 結果 + コピー&投稿 ─── */}
        {mode === 'single' && step === 3 && (
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
                  rel="noopener noreferrer"
                  style={{ flex: 1, padding: '0.7rem', textAlign: 'center', background: 'rgba(255,255,255,0.06)', color: 'var(--fg)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none' }}
                >
                  ↗ note を開いて貼付け
                </a>
              </div>
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-start' }}>
                <ShareArtifactButton
                  variant="pill"
                  size="sm"
                  accent={accent}
                  label="お友達に下書きを送る"
                  shareText={noteTitle || noteBody.slice(0, 80)}
                  artifact={{
                    kind: 'text',
                    title: noteTitle || '記事の下書き',
                    body: noteBody,
                    createdBy: persona.name,
                    source: 'prism',
                    createdAt: new Date().toISOString(),
                  }}
                />
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
                        rel="noopener noreferrer"
                        style={{ fontSize: '0.72rem', padding: '0.35rem 0.7rem', background: 'rgba(255,255,255,0.04)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 6, textDecoration: 'none' }}
                      >↗ X で開く</a>
                    </div>
                  </div>
                ))}
              </div>

              {/* X 自動投稿（CORE 経由の OAuth 連携） */}
              <div style={{ marginTop: 12, padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10 }}>
                {!xStatus.configured ? (
                  <p style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', margin: 0, lineHeight: 1.6 }}>
                    Xの自動投稿は準備中です（提供者が設定中）。上の「↗ X で開く」から手動で投稿できます。
                  </p>
                ) : xStatus.connected ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                        {xStatus.username ? `@${xStatus.username} に自動投稿` : 'Xに自動投稿'}
                      </span>
                      <button
                        onClick={handleXDisconnect}
                        style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem', background: 'transparent', color: 'var(--fg-muted)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, cursor: 'pointer' }}
                      >連携を解除</button>
                    </div>
                    <button
                      onClick={handleXPost}
                      disabled={xPosting || xThread.length === 0}
                      style={{ width: '100%', padding: '0.75rem', minHeight: 44, background: xPosting ? 'rgba(255,255,255,0.08)' : accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: '0.9rem', fontWeight: 800, cursor: xPosting ? 'default' : 'pointer', opacity: xPosting ? 0.7 : 1 }}
                    >
                      {xPosting ? '投稿中…' : `✕ Xに投稿する（${xThread.length}本を連続スレッド）`}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={startXConnect}
                    style={{ width: '100%', padding: '0.75rem', minHeight: 44, background: accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer' }}
                  >
                    ✕ Xアカウントと連携（初回だけ）
                  </button>
                )}
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
        {mode === 'single' && history.length > 0 && step === 1 && (
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
