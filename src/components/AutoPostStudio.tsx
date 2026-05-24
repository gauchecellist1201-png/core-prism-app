// ============================================================
// AutoPostStudio — 6 SNS 同時生成 + ハッシュタグ AI + 投稿予約
// 旧 note 長文 / X 単独生成は残し、新しい「⚡ 6 SNS 同時」タブを追加
// ============================================================
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ApiErrorCard from './ApiErrorCard';
import { copyText } from '../lib/clipboard';
import { notifyInApp } from '../lib/inAppNotify';
import type { Persona, AppSettings, KnowledgeItem } from '../types/identity';
import {
  generateNoteArticle, generateXPost, generateMultiPlatformPost,
  suggestHashtags, PLATFORM_META, ALL_PLATFORMS, TONE_OPTIONS,
  type SocialDraft, type SocialTone, type SocialPlatform, type MultiPlatformDraft,
} from '../lib/socialDraft';
import {
  isXConfigured, isXConnected, startXAuth, handleXCallbackIfPresent,
  postTweet, postThread, loadXUser, clearXAuth, type XUser,
} from '../lib/xPost';
import ShareArtifactButton from './ShareArtifactButton';
import { StudioIntro } from './StudioIntro';

interface Props {
  persona: Persona;
  settings: AppSettings;
  knowledge: KnowledgeItem[];
  onClose: () => void;
  onSaveAsKnowledge?: (title: string, content: string) => void;
}

// 生成結果を 1 文字ずつ流し込んで、待ち時間の体感を短くする
function animateInto(full: string, setter: (s: string) => void) {
  if (!full) { setter(''); return; }
  if (full.length > 3000) { setter(full); return; }
  let i = 0;
  const step = full.length > 800 ? 6 : full.length > 300 ? 3 : 2;
  const interval = full.length > 800 ? 10 : 16;
  const id = window.setInterval(() => {
    i = Math.min(i + step, full.length);
    setter(full.slice(0, i));
    if (i >= full.length) window.clearInterval(id);
  }, interval);
}

type Tab = 'multi' | 'note' | 'x';

// ─── localStorage キー ───
const HISTORY_KEY = 'core_autopost_history_v2';
const SCHEDULE_KEY = 'core_autopost_schedule_v1';
const MAX_HISTORY = 30;

interface PostHistory {
  id: string;
  topic: string;
  tone: SocialTone;
  platforms: SocialPlatform[];
  posts: Record<SocialPlatform, string>;
  hashtags: string[];
  createdAt: number;
}

interface ScheduledPost {
  id: string;
  scheduledAt: string;  // ISO datetime
  platform: SocialPlatform | 'all';
  topic: string;
  body: string;          // 投稿本文 (multi の場合は代表 1 platform)
  posts?: Record<SocialPlatform, string>;
  hashtags: string[];
  createdAt: number;
  status: 'pending' | 'sent' | 'missed';
}

function loadHistory(): PostHistory[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(items: PostHistory[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY))); } catch { /* */ }
}
function loadSchedule(): ScheduledPost[] {
  try { return JSON.parse(localStorage.getItem(SCHEDULE_KEY) || '[]'); } catch { return []; }
}
function saveSchedule(items: ScheduledPost[]) {
  try { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(items)); } catch { /* */ }
}

export default function AutoPostStudio({ persona, settings, knowledge, onClose, onSaveAsKnowledge }: Props) {
  const [tab, setTab] = useState<Tab>('multi');
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState<SocialTone>('storytelling');
  const [customInstr, setCustomInstr] = useState('');
  const [selectedKnowledge, setSelectedKnowledge] = useState<Set<string>>(new Set());
  const [showKbPicker, setShowKbPicker] = useState(false);

  // ─── 6 SNS 同時 ───
  const [enabledPlatforms, setEnabledPlatforms] = useState<Set<SocialPlatform>>(new Set(ALL_PLATFORMS));
  const [multiDraft, setMultiDraft] = useState<MultiPlatformDraft | null>(null);
  const [multiPosts, setMultiPosts] = useState<Record<SocialPlatform, string>>({} as any);
  const [multiHashtags, setMultiHashtags] = useState<string[]>([]);
  const [hashtagBusy, setHashtagBusy] = useState(false);

  // ─── 予約投稿 ───
  const [scheduleAt, setScheduleAt] = useState<string>('');
  const [schedule, setSchedule] = useState<ScheduledPost[]>(() => {
    const items = loadSchedule();
    const now = Date.now();
    let changed = false;
    const next = items.map(s => {
      if (s.status === 'pending' && new Date(s.scheduledAt).getTime() < now - 5 * 60 * 1000) {
        changed = true;
        return { ...s, status: 'missed' as const };
      }
      return s;
    });
    if (changed) saveSchedule(next);
    return next;
  });
  const [showSchedule, setShowSchedule] = useState(false);

  // ─── 履歴 ───
  const [history, setHistory] = useState<PostHistory[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);

  // 旧来 (note 長文 / X 単独)
  const [targetWords, setTargetWords] = useState(1500);
  const [threadCount, setThreadCount] = useState(1);
  const [draft, setDraft] = useState<SocialDraft | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [editedThread, setEditedThread] = useState<string[]>([]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // X 認証
  const [xUser, setXUser] = useState<XUser | null>(loadXUser());
  const [xConnected, setXConnected] = useState(isXConnected());
  const [xPosting, setXPosting] = useState(false);
  const [xPostResult, setXPostResult] = useState<{ ids: string[] } | null>(null);

  const personaKnowledge = useMemo(
    () => knowledge.filter(k => k.personaId === persona.id),
    [knowledge, persona.id]
  );

  // X コールバック
  useEffect(() => {
    handleXCallbackIfPresent().then(user => {
      if (user) { setXUser(user); setXConnected(true); }
    }).catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // ─── 6 SNS 同時生成 ───
  const handleGenerateMulti = useCallback(async () => {
    if (!topic.trim()) { setError('テーマを入力してください'); return; }
    if (enabledPlatforms.size === 0) { setError('プラットフォームを 1 つ以上選んでください'); return; }
    setIsGenerating(true);
    setError(null);
    setMultiDraft(null);
    try {
      const ks = personaKnowledge.filter(k => selectedKnowledge.has(k.id));
      const result = await generateMultiPlatformPost({
        settings, persona, topic, tone, knowledge: ks,
        platforms: Array.from(enabledPlatforms),
        customInstruction: customInstr,
      });
      setMultiDraft(result);
      setMultiPosts(result.posts);
      setMultiHashtags(result.hashtags);

      // 履歴に保存
      const item: PostHistory = {
        id: `h_${Date.now()}`,
        topic, tone,
        platforms: Array.from(enabledPlatforms),
        posts: result.posts,
        hashtags: result.hashtags,
        createdAt: Date.now(),
      };
      const next = [item, ...history];
      setHistory(next);
      saveHistory(next);
      notifyInApp({
        kind: 'success',
        title: `${enabledPlatforms.size} SNS 分の下書きができました`,
        body: result.hashtags.length > 0 ? `ハッシュタグも ${result.hashtags.length} 個提案済み` : undefined,
        duration: 2500,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsGenerating(false);
    }
  }, [topic, tone, enabledPlatforms, customInstr, settings, persona, personaKnowledge, selectedKnowledge, history]);

  // ─── ハッシュタグだけ AI 提案 ───
  const handleSuggestHashtags = useCallback(async () => {
    if (!topic.trim()) { setError('テーマを入力してください'); return; }
    setHashtagBusy(true);
    setError(null);
    try {
      const tags = await suggestHashtags({ settings, persona, topic, count: 10 });
      setMultiHashtags(tags);
      notifyInApp({
        kind: 'success',
        title: `ハッシュタグを ${tags.length} 個提案しました`,
        duration: 2200,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setHashtagBusy(false);
    }
  }, [topic, settings, persona]);

  // ─── 過去投稿を再アレンジ ───
  const handleRemix = useCallback(async (h: PostHistory) => {
    setTopic(h.topic);
    setTone(h.tone);
    setEnabledPlatforms(new Set(h.platforms));
    setTab('multi');
    setShowHistory(false);
    // 即生成
    setTimeout(() => {
      handleGenerateMulti();
    }, 100);
  }, [handleGenerateMulti]);

  const handleLoadFromHistory = useCallback((h: PostHistory) => {
    setTopic(h.topic);
    setTone(h.tone);
    setEnabledPlatforms(new Set(h.platforms));
    setMultiPosts(h.posts);
    setMultiHashtags(h.hashtags);
    setMultiDraft({
      topic: h.topic, tone: h.tone, hashtags: h.hashtags,
      posts: h.posts, generatedAt: new Date(h.createdAt).toISOString(),
    });
    setTab('multi');
    setShowHistory(false);
  }, []);

  // ─── 予約 ───
  const handleSchedulePost = useCallback((platform: SocialPlatform) => {
    if (!scheduleAt) { setError('予約日時を選んでください'); return; }
    const body = multiPosts[platform] || '';
    if (!body.trim()) { setError('本文がありません'); return; }
    const item: ScheduledPost = {
      id: `s_${Date.now()}_${platform}`,
      scheduledAt: new Date(scheduleAt).toISOString(),
      platform,
      topic,
      body,
      hashtags: multiHashtags,
      createdAt: Date.now(),
      status: 'pending',
    };
    const next = [...schedule, item].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    setSchedule(next);
    saveSchedule(next);
    setError(null);
    setShowSchedule(true);
    notifyInApp({
      kind: 'success',
      title: `${PLATFORM_META[platform].label} を予約しました`,
      body: new Date(scheduleAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      duration: 2500,
    });
  }, [scheduleAt, multiPosts, multiHashtags, topic, schedule]);

  const handleScheduleAll = useCallback(() => {
    if (!scheduleAt) { setError('予約日時を選んでください'); return; }
    if (Object.keys(multiPosts).length === 0) { setError('まず投稿を生成してください'); return; }
    const item: ScheduledPost = {
      id: `s_${Date.now()}_all`,
      scheduledAt: new Date(scheduleAt).toISOString(),
      platform: 'all',
      topic,
      body: multiPosts.x || multiPosts.threads || Object.values(multiPosts)[0] || '',
      posts: multiPosts,
      hashtags: multiHashtags,
      createdAt: Date.now(),
      status: 'pending',
    };
    const next = [...schedule, item].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    setSchedule(next);
    saveSchedule(next);
    setError(null);
    setShowSchedule(true);
    notifyInApp({
      kind: 'success',
      title: `全 ${Object.keys(multiPosts).length} SNS を予約しました`,
      body: new Date(scheduleAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      duration: 2800,
    });
  }, [scheduleAt, multiPosts, multiHashtags, topic, schedule]);

  const handleDeleteSchedule = useCallback((id: string) => {
    const next = schedule.filter(s => s.id !== id);
    setSchedule(next);
    saveSchedule(next);
  }, [schedule]);

  // ─── 画像生成連携 (ImageStudio を window event で起動) ───
  const handleOpenImageStudio = useCallback((platform?: SocialPlatform) => {
    const seed = platform ? multiPosts[platform] : topic;
    window.dispatchEvent(new CustomEvent('core-prism:open-image-studio', {
      detail: {
        prompt: seed || topic,
        topic,
        aspect: platform === 'instagram' ? 'square' : platform === 'note' ? 'note-hero' : 'x-post',
        source: 'AutoPostStudio',
      },
    }));
  }, [multiPosts, topic]);

  // ─── 旧 note / X 生成 ───
  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) { setError('テーマを入力してください'); return; }
    setIsGenerating(true);
    setError(null);
    setDraft(null);
    try {
      const ks = personaKnowledge.filter(k => selectedKnowledge.has(k.id));
      let result: SocialDraft;
      if (tab === 'note') {
        result = await generateNoteArticle({
          settings, persona, topic, tone, knowledge: ks,
          targetWords, customInstruction: customInstr,
        });
        setEditedTitle(result.title || '');
        setEditedBody('');
        animateInto(result.body || '', setEditedBody);
      } else {
        result = await generateXPost({
          settings, persona, topic, tone, knowledge: ks,
          threadCount, customInstruction: customInstr,
        });
        setEditedBody('');
        animateInto(result.body, setEditedBody);
        setEditedThread(result.posts || [result.body]);
      }
      setDraft(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsGenerating(false);
    }
  }, [tab, topic, tone, customInstr, settings, persona, personaKnowledge, selectedKnowledge, targetWords, threadCount]);

  const copyToClipboard = useCallback((text: string, label = '本文') => copyText(text, label), []);

  const handleCopyPlatform = useCallback((p: SocialPlatform) => {
    const body = multiPosts[p] || '';
    const tags = multiHashtags.length > 0 ? '\n\n' + multiHashtags.map(t => '#' + t).join(' ') : '';
    copyText(body + tags, PLATFORM_META[p].label);
  }, [multiPosts, multiHashtags]);

  // note: 本文をコピーしてから新規記事ページを開く
  const handleNoteOpen = useCallback(() => {
    const md = `# ${editedTitle}\n\n${editedBody}`;
    copyText(md, '記事');
    window.open('https://note.com/notes/new', '_blank', 'noopener');
  }, [editedTitle, editedBody]);

  const handleNoteCopy = useCallback(() => {
    const md = `# ${editedTitle}\n\n${editedBody}`;
    copyText(md, '記事');
  }, [editedTitle, editedBody]);

  const handleNoteDownload = useCallback(() => {
    const md = `# ${editedTitle}\n\n${editedBody}`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safe = (editedTitle || 'note-draft').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
    a.download = `${safe}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [editedTitle, editedBody]);

  const handleSaveKb = useCallback(() => {
    if (!onSaveAsKnowledge) return;
    const title = `[投稿草稿] ${editedTitle || 'X 投稿'}`;
    const content = tab === 'note'
      ? `# ${editedTitle}\n\n${editedBody}`
      : editedThread.length > 1 ? editedThread.join('\n\n---\n\n') : editedBody;
    onSaveAsKnowledge(title, content);
  }, [tab, editedTitle, editedBody, editedThread, onSaveAsKnowledge]);

  // X 投稿
  const handleXConnect = useCallback(async () => {
    setError(null);
    try { await startXAuth(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, []);
  const handleXDisconnect = useCallback(() => {
    clearXAuth(); setXConnected(false); setXUser(null);
  }, []);

  const handleXPost = useCallback(async () => {
    setXPosting(true); setError(null); setXPostResult(null);
    try {
      if (editedThread.length > 1) {
        const r = await postThread(editedThread.filter(t => t.trim().length > 0));
        setXPostResult(r);
      } else {
        const r = await postTweet(editedBody);
        setXPostResult({ ids: [r.id] });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setXPosting(false);
    }
  }, [editedBody, editedThread]);

  const handleXPostMulti = useCallback(async () => {
    const body = multiPosts.x;
    if (!body) return;
    setXPosting(true); setError(null); setXPostResult(null);
    try {
      const r = await postTweet(body + (multiHashtags.length > 0 ? '\n\n' + multiHashtags.slice(0, 2).map(t => '#' + t).join(' ') : ''));
      setXPostResult({ ids: [r.id] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setXPosting(false);
    }
  }, [multiPosts, multiHashtags]);

  const xReady = isXConfigured();

  // 履歴の状態別件数
  const pendingSchedules = schedule.filter(s => s.status === 'pending').length;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-[1400px] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg, #15151c)', border: '1px solid var(--border)', maxHeight: 'calc(100dvh - 1.5rem)' }}
        initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: persona.accentColorLight, color: persona.accentColor }}
            >📢</div>
            <div className="min-w-0">
              <p className="text-fg text-base font-semibold leading-tight truncate">投稿スタジオ</p>
              <p className="text-fg-muted text-xs truncate">6 SNS に最適化して同時生成 / 予約 / 履歴再利用</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSchedule(s => !s)}
              className="text-xs px-3 rounded-full font-semibold flex items-center gap-1"
              style={{
                height: 40, minHeight: 40,
                background: pendingSchedules > 0 ? persona.accentColor : 'var(--surface-3)',
                color: pendingSchedules > 0 ? '#0a0a0f' : 'var(--fg-muted)',
                border: '1px solid var(--border)',
              }}
            >📅 予約{pendingSchedules > 0 && ` ${pendingSchedules}`}</button>
            <button
              onClick={() => setShowHistory(s => !s)}
              className="text-xs px-3 rounded-full font-semibold"
              style={{
                height: 40, minHeight: 40,
                background: 'var(--surface-3)', color: 'var(--fg-muted)',
                border: '1px solid var(--border)',
              }}
            >🕰 履歴{history.length > 0 && ` ${history.length}`}</button>
            <button
              onClick={onClose}
              className="rounded-full flex items-center justify-center text-fg-muted hover:text-fg text-xl leading-none"
              style={{ width: 40, height: 40, minWidth: 40 }}
              aria-label="閉じる"
            >×</button>
          </div>
        </div>

        {/* Platform Tabs */}
        <div className="flex gap-1 px-5 pt-3 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)' }}>
          {([
            { id: 'multi' as Tab, label: '⚡ 6 SNS 同時' },
            { id: 'note' as Tab, label: '📝 note 記事 (長文)' },
            { id: 'x' as Tab, label: '🐦 X 単独 / スレッド' },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setDraft(null); setError(null); }}
              className="text-sm px-4 rounded-t-md font-medium whitespace-nowrap"
              style={{
                minHeight: 44,
                background: tab === t.id ? persona.accentColorLight : 'transparent',
                color: tab === t.id ? persona.accentColor : 'var(--fg-muted)',
                borderBottom: tab === t.id ? `2px solid ${persona.accentColor}` : '2px solid transparent',
              }}
            >{t.label}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ─── 予約パネル ─── */}
          <AnimatePresence>
            {showSchedule && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--surface-3)', border: `1px solid ${persona.accentColor}40` }}
              >
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                  <p className="text-fg font-semibold text-sm">📅 予約済み投稿 ({schedule.length}件)</p>
                  <p className="text-fg-muted text-[11px]">※ ローカル保存。自動投稿は今後のアップデートで対応</p>
                </div>
                {schedule.length === 0 ? (
                  <p className="text-fg-muted text-sm text-center py-6">まだ予約はありません</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
                    {schedule.map(s => {
                      const dt = new Date(s.scheduledAt);
                      const past = dt.getTime() < Date.now();
                      const meta = s.platform === 'all' ? '全 SNS' : PLATFORM_META[s.platform as SocialPlatform]?.label || s.platform;
                      return (
                        <div key={s.id} className="px-4 py-2.5 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-mono" style={{ color: past ? '#f87171' : persona.accentColor }}>
                                {dt.toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface)', color: 'var(--fg-muted)' }}>
                                {meta}
                              </span>
                              {s.status === 'missed' && <span className="text-[10px] text-red-400">⏰ 未送信のまま期限切れ</span>}
                              {past && s.status === 'pending' && <span className="text-[10px] text-red-400">⚠ 過去日時</span>}
                              {s.status === 'sent' && <span className="text-[10px]" style={{ color: persona.accentColor }}>✓ 送信済</span>}
                            </div>
                            <p className="text-fg text-xs truncate">{s.topic}</p>
                            <p className="text-fg-muted text-[11px] truncate">{s.body.slice(0, 80)}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteSchedule(s.id)}
                            className="text-fg-muted hover:text-fg text-xs px-2 py-1 rounded flex-shrink-0"
                            style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 32 }}
                          >削除</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── 履歴パネル ─── */}
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--surface-3)', border: `1px solid ${persona.accentColor}40` }}
              >
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <p className="text-fg font-semibold text-sm">🕰 過去の生成 ({history.length}件、最大 {MAX_HISTORY} 件)</p>
                </div>
                {history.length === 0 ? (
                  <p className="text-fg-muted text-sm text-center py-6">まだ履歴はありません</p>
                ) : (
                  <div className="max-h-72 overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
                    {history.map(h => (
                      <div key={h.id} className="px-4 py-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-fg text-sm font-medium truncate flex-1 mr-2">{h.topic}</p>
                          <span className="text-fg-muted text-[11px] flex-shrink-0">
                            {new Date(h.createdAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {h.platforms.map(p => (
                            <span key={p} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface)', color: 'var(--fg-muted)' }}>
                              {PLATFORM_META[p].emoji} {PLATFORM_META[p].label}
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleLoadFromHistory(h)}
                            className="text-xs px-3 rounded font-semibold"
                            style={{ background: 'var(--surface)', color: 'var(--fg)', border: '1px solid var(--border)', minHeight: 36 }}
                          >📥 読み込む</button>
                          <button
                            onClick={() => handleRemix(h)}
                            className="text-xs px-3 rounded font-semibold"
                            style={{ background: persona.accentColor, color: '#0a0a0f', minHeight: 36 }}
                          >🔄 再アレンジ</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {tab === 'multi' && (
            <StudioIntro
              id="auto-post-multi"
              accent={persona.accentColor}
              emoji="⚡"
              what="1 つのテーマから X / Threads / Instagram / LinkedIn / note / Facebook 6 SNS 分の最適化された投稿文を同時生成します。"
              tryThis="テーマを入力 → ✨ 6 SNS 同時生成 → 各カードでコピー or 投稿予約。"
              example="「今月のミニ起業ジャーニー」→ 各 SNS の長さ・口調に合わせて 6 本同時に並ぶ。"
              sampleLabel="同時に出来る 6 本"
              samplePreview={
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 3, width: 150 }}>
                  {ALL_PLATFORMS.map(p => (
                    <div
                      key={p}
                      style={{
                        background: PLATFORM_META[p].color, color: '#fff',
                        borderRadius: 4, padding: '4px 5px',
                        fontSize: 6, lineHeight: 1.3, textAlign: 'center', fontWeight: 700,
                      }}
                    >
                      <div style={{ fontSize: 8 }}>{PLATFORM_META[p].emoji}</div>
                      <div style={{ marginTop: 2 }}>{PLATFORM_META[p].label.split(' ')[0]}</div>
                    </div>
                  ))}
                </div>
              }
            />
          )}

          {/* X 認証バー (X タブのみ) */}
          {tab === 'x' && (
            <div
              className="rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap"
              style={{
                background: xConnected ? `${persona.accentColor}15` : 'var(--surface-3)',
                border: `1px solid ${xConnected ? persona.accentColor + '50' : 'var(--border)'}`,
              }}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {xConnected && xUser?.profileImageUrl ? (
                  <img src={xUser.profileImageUrl} alt="" className="w-9 h-9 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg" style={{ background: persona.accentColorLight }}>𝕏</div>
                )}
                <div className="min-w-0">
                  <p className="text-fg text-sm font-semibold leading-tight">
                    X 連携 {xConnected && <span className="text-xs ml-1" style={{ color: persona.accentColor }}>● 接続中</span>}
                  </p>
                  {xConnected && xUser ? (
                    <p className="text-fg-muted text-xs truncate">@{xUser.username} · このアカウントから直接投稿できます</p>
                  ) : (
                    <p className="text-fg-muted text-xs">{xReady ? 'OAuth 認証で X に接続すると、生成 → ワンクリック投稿が可能に' : 'VITE_X_CLIENT_ID 未設定'}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {!xConnected ? (
                  <button
                    onClick={handleXConnect}
                    disabled={!xReady}
                    className="text-xs px-3 rounded-md font-semibold disabled:opacity-40"
                    style={{ background: '#000000', color: '#FFFFFF', minHeight: 40 }}
                  >𝕏 で続行</button>
                ) : (
                  <button onClick={handleXDisconnect} className="text-xs px-2 rounded text-fg-muted hover:text-fg" style={{ minHeight: 40 }}>解除</button>
                )}
              </div>
            </div>
          )}

          {/* 入力フォーム */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
            <div>
              <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">テーマ / 主題</label>
              <input
                type="text" value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder={tab === 'multi' ? '例: 起業 1 年目で学んだ顧客インタビューの本質' : tab === 'note' ? '例: 起業1年目で学んだ顧客インタビューの本質' : '例: 今日の経営判断の裏側を1ツイートで'}
                className="w-full px-3 rounded bg-surface-3 border-edge border text-fg placeholder:text-fg-subtle outline-none"
                style={{ fontSize: 16, minHeight: 48 }}
              />
            </div>

            {/* トーン */}
            <div>
              <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">トーン</label>
              <div className="flex gap-1.5 flex-wrap">
                {TONE_OPTIONS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTone(t.value)}
                    className="text-xs px-3 rounded-md font-medium"
                    style={{
                      minHeight: 40,
                      background: tone === t.value ? persona.accentColorLight : 'var(--surface-3)',
                      color: tone === t.value ? persona.accentColor : 'var(--fg-muted)',
                      border: `1px solid ${tone === t.value ? persona.accentColor + '50' : 'var(--border)'}`,
                    }}
                  >{t.emoji} {t.label}</button>
                ))}
              </div>
            </div>

            {/* タブ別オプション */}
            {tab === 'multi' && (
              <div>
                <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">
                  生成する SNS ({enabledPlatforms.size}/6 個 選択中)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALL_PLATFORMS.map(p => {
                    const m = PLATFORM_META[p];
                    const on = enabledPlatforms.has(p);
                    return (
                      <button
                        key={p}
                        onClick={() => {
                          const next = new Set(enabledPlatforms);
                          if (on) next.delete(p); else next.add(p);
                          setEnabledPlatforms(next);
                        }}
                        className="flex items-center gap-2 px-3 rounded-md text-left"
                        style={{
                          minHeight: 48,
                          background: on ? `${m.color}25` : 'var(--surface)',
                          border: `2px solid ${on ? m.color : 'var(--border)'}`,
                          color: on ? 'var(--fg)' : 'var(--fg-muted)',
                        }}
                      >
                        <span style={{ fontSize: 22, color: on ? m.color : undefined }}>{m.emoji}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{m.label}</p>
                          <p className="text-[10px] text-fg-muted">~{m.charBudget}字</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {tab !== 'multi' && (
              <div className="grid grid-cols-2 gap-2">
                {tab === 'note' ? (
                  <div>
                    <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">目標字数</label>
                    <select
                      value={targetWords}
                      onChange={e => setTargetWords(Number(e.target.value))}
                      className="w-full px-3 rounded bg-surface-3 border-edge border text-fg"
                      style={{ fontSize: 16, minHeight: 48 }}
                    >
                      <option value={800}>短め (800字)</option>
                      <option value={1500}>標準 (1,500字)</option>
                      <option value={2500}>長め (2,500字)</option>
                      <option value={3500}>超詳細 (3,500字)</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">投稿数</label>
                    <select
                      value={threadCount}
                      onChange={e => setThreadCount(Number(e.target.value))}
                      className="w-full px-3 rounded bg-surface-3 border-edge border text-fg"
                      style={{ fontSize: 16, minHeight: 48 }}
                    >
                      <option value={1}>単発 (1ツイート)</option>
                      <option value={3}>ミニスレ (3本)</option>
                      <option value={5}>スレ (5本)</option>
                      <option value={7}>ロング (7本)</option>
                      <option value={10}>マラソン (10本)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">参照ナレッジ</label>
                  <button
                    onClick={() => setShowKbPicker(v => !v)}
                    className="w-full px-3 rounded text-left flex items-center justify-between"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg)', minHeight: 48, fontSize: 14 }}
                  >
                    <span>{selectedKnowledge.size > 0 ? `${selectedKnowledge.size}件選択中` : `選択 (${personaKnowledge.length}件中)`}</span>
                    <span className="text-fg-muted">▾</span>
                  </button>
                </div>
              </div>
            )}

            {tab === 'multi' && (
              <div>
                <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">参照ナレッジ</label>
                <button
                  onClick={() => setShowKbPicker(v => !v)}
                  className="w-full px-3 rounded text-left flex items-center justify-between"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--fg)', minHeight: 48, fontSize: 14 }}
                >
                  <span>{selectedKnowledge.size > 0 ? `${selectedKnowledge.size}件選択中` : `選択 (${personaKnowledge.length}件中)`}</span>
                  <span className="text-fg-muted">▾</span>
                </button>
              </div>
            )}

            <AnimatePresence>
              {showKbPicker && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-lg p-2 max-h-40 overflow-y-auto" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    {personaKnowledge.length === 0 ? (
                      <p className="text-fg-muted text-xs text-center py-4">この人格にはまだナレッジがありません</p>
                    ) : (
                      personaKnowledge.slice(0, 30).map(k => {
                        const sel = selectedKnowledge.has(k.id);
                        return (
                          <button
                            key={k.id}
                            onClick={() => {
                              const next = new Set(selectedKnowledge);
                              if (sel) next.delete(k.id); else next.add(k.id);
                              setSelectedKnowledge(next);
                            }}
                            className="w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2"
                            style={{ background: sel ? persona.accentColorLight : 'transparent', color: sel ? persona.accentColor : 'var(--fg)', minHeight: 36 }}
                          >
                            <span>{sel ? '✓' : '○'}</span>
                            <span className="truncate">{k.title}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">追加指示 (任意)</label>
              <textarea
                value={customInstr}
                onChange={e => setCustomInstr(e.target.value)}
                placeholder="例: 結論を冒頭に / 数字を必ず3つ含める / 起業家の同志に向けて"
                rows={2}
                className="w-full px-3 py-2 rounded bg-surface-3 border-edge border text-fg placeholder:text-fg-subtle outline-none resize-none"
                style={{ fontSize: 16 }}
              />
            </div>

            {/* 予約日時 (multi タブのみ) */}
            {tab === 'multi' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">📅 予約日時 (任意)</label>
                  <input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={e => setScheduleAt(e.target.value)}
                    className="w-full px-3 rounded bg-surface-3 border-edge border text-fg"
                    style={{ fontSize: 16, minHeight: 48 }}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleScheduleAll}
                    disabled={!scheduleAt || Object.keys(multiPosts).length === 0}
                    className="w-full rounded font-semibold disabled:opacity-40"
                    style={{
                      minHeight: 48,
                      background: 'var(--surface)', color: 'var(--fg)',
                      border: `1px solid ${persona.accentColor}50`, fontSize: 14,
                    }}
                  >📅 全 SNS をこの日時に予約</button>
                </div>
              </div>
            )}

            <motion.button
              onClick={tab === 'multi' ? handleGenerateMulti : handleGenerate}
              disabled={!topic.trim() || isGenerating || (tab === 'multi' && enabledPlatforms.size === 0)}
              className="w-full rounded-lg font-semibold disabled:opacity-50"
              style={{ background: persona.accentColor, color: '#0a0a0f', minHeight: 56, fontSize: 16 }}
              whileTap={!isGenerating ? { scale: 0.99 } : {}}
            >
              {isGenerating
                ? '🧠 生成中…'
                : tab === 'multi'
                  ? `✨ ${enabledPlatforms.size} SNS 同時生成`
                  : `✨ ${tab === 'note' ? 'note 記事' : threadCount > 1 ? 'X スレッド' : 'X ツイート'}を生成`
              }
            </motion.button>

            {tab === 'multi' && (
              <button
                onClick={handleSuggestHashtags}
                disabled={!topic.trim() || hashtagBusy}
                className="w-full rounded-lg font-semibold disabled:opacity-50"
                style={{
                  minHeight: 48, fontSize: 14,
                  background: 'var(--surface)', color: persona.accentColor,
                  border: `1px solid ${persona.accentColor}50`,
                }}
              >{hashtagBusy ? '🏷 提案中…' : '🏷 ハッシュタグだけ AI に提案させる (10 個)'}</button>
            )}

            <ApiErrorCard
              error={error}
              onRetry={tab === 'multi' ? handleGenerateMulti : handleGenerate}
              onOpenSettings={() => { window.location.href = '/master'; }}
            />
          </div>

          {/* ─── 6 SNS 同時生成結果 ─── */}
          {tab === 'multi' && (multiDraft || multiHashtags.length > 0) && (
            <div className="space-y-3">
              {/* ハッシュタグ */}
              {multiHashtags.length > 0 && (
                <div className="rounded-xl p-3" style={{ background: 'var(--surface-3)', border: `1px solid ${persona.accentColor}40` }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-fg-muted text-xs tracking-wider uppercase">🏷 提案ハッシュタグ ({multiHashtags.length})</p>
                    <button
                      onClick={() => copyToClipboard(multiHashtags.map(t => '#' + t).join(' '), 'ハッシュタグ')}
                      className="text-[11px] px-2 py-1 rounded text-fg-muted hover:text-fg"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                    >📋 まとめてコピー</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {multiHashtags.map((t, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded" style={{ background: persona.accentColorLight, color: persona.accentColor }}>#{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* プラットフォームごとのカード */}
              {ALL_PLATFORMS.filter(p => multiPosts[p] && multiPosts[p].length > 0).map(p => {
                const m = PLATFORM_META[p];
                const body = multiPosts[p] || '';
                const over = body.length > m.charBudget;
                return (
                  <div key={p} className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-3)', border: `2px solid ${m.color}55` }}>
                    <div className="px-4 py-2.5 flex items-center justify-between gap-2" style={{ background: `${m.color}18`, borderBottom: `1px solid ${m.color}30` }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex items-center justify-center rounded-lg flex-shrink-0"
                          style={{ width: 32, height: 32, background: m.color, color: '#fff', fontSize: 16 }}>
                          {m.emoji}
                        </span>
                        <div className="min-w-0">
                          <p className="text-fg text-sm font-semibold truncate">{m.label}</p>
                          <p className="text-[10px]" style={{ color: over ? '#f87171' : 'var(--fg-muted)' }}>
                            {body.length} / {m.charBudget} 字 {over && '⚠ 超過'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <textarea
                      value={body}
                      onChange={e => setMultiPosts(prev => ({ ...prev, [p]: e.target.value }))}
                      rows={Math.min(8, Math.max(3, Math.ceil(body.length / 60)))}
                      className="w-full px-3 py-2.5 bg-transparent text-fg outline-none resize-y leading-relaxed"
                      style={{ fontSize: 14, minHeight: 100 }}
                    />
                    <div className="px-3 py-2.5 flex flex-wrap gap-1.5 justify-end" style={{ borderTop: '1px solid var(--border)' }}>
                      <button
                        onClick={() => handleCopyPlatform(p)}
                        className="text-xs px-3 rounded text-fg hover:text-fg font-medium"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 40 }}
                      >📋 タグごとコピー</button>
                      <button
                        onClick={() => handleOpenImageStudio(p)}
                        className="text-xs px-3 rounded font-medium"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--fg)', minHeight: 40 }}
                      >🎨 画像生成</button>
                      {scheduleAt && (
                        <button
                          onClick={() => handleSchedulePost(p)}
                          className="text-xs px-3 rounded font-semibold"
                          style={{ background: persona.accentColorLight, color: persona.accentColor, minHeight: 40 }}
                        >📅 この SNS だけ予約</button>
                      )}
                      {m.postUrl && (
                        <a
                          href={m.postUrl(body + (multiHashtags.length > 0 ? '\n\n' + multiHashtags.slice(0, 3).map(t => '#' + t).join(' ') : ''))}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs px-3 rounded font-semibold inline-flex items-center"
                          style={{ background: m.color, color: '#fff', minHeight: 40 }}
                        >↗ {m.label.split(' ')[0]} で開く</a>
                      )}
                      {p === 'x' && xConnected && (
                        <button
                          onClick={handleXPostMulti}
                          disabled={xPosting}
                          className="text-xs px-3 rounded font-semibold disabled:opacity-40"
                          style={{ background: '#000', color: '#fff', minHeight: 40 }}
                        >{xPosting ? '送信中…' : '𝕏 直接投稿'}</button>
                      )}
                    </div>
                  </div>
                );
              })}

              {xPostResult && (
                <div className="rounded-xl px-4 py-2 text-xs" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ADE80' }}>
                  ✓ 投稿完了 ·{' '}
                  {xUser && (
                    <a href={`https://twitter.com/${xUser.username}/status/${xPostResult.ids[0]}`} target="_blank" rel="noopener noreferrer" className="underline">
                      投稿を確認する →
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* note タブ: 旧 UI */}
          {tab === 'note' && draft && (
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-3)', border: `1px solid ${persona.accentColor}40` }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <p className="text-fg-muted text-xs tracking-wider uppercase">下書きプレビュー (編集可)</p>
              </div>
              <div className="p-4 space-y-3">
                <input
                  value={editedTitle}
                  onChange={e => setEditedTitle(e.target.value)}
                  className="w-full text-base font-semibold px-3 py-2 rounded bg-surface-3 border-edge border text-fg outline-none"
                  placeholder="タイトル"
                  style={{ minHeight: 48, fontSize: 16 }}
                />
                <textarea
                  value={editedBody}
                  onChange={e => setEditedBody(e.target.value)}
                  rows={14}
                  className="w-full px-3 py-2 rounded bg-surface-3 border-edge border text-fg outline-none font-mono leading-relaxed resize-y"
                  style={{ minHeight: 320, fontSize: 14 }}
                />
                <div className="flex gap-2 flex-wrap">
                  {(draft.tags || []).map(t => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded" style={{ background: persona.accentColorLight, color: persona.accentColor }}>#{t}</span>
                  ))}
                  {draft.estimatedReadMin && (
                    <span className="text-xs text-fg-muted ml-auto">推定読了 {draft.estimatedReadMin} 分</span>
                  )}
                </div>
              </div>
              <div className="px-4 py-3 flex flex-wrap gap-2 justify-end" style={{ borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={handleNoteCopy}
                  className="text-xs px-3 rounded text-fg-muted hover:text-fg"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 40 }}
                >📋 Markdown コピー</button>
                <button
                  onClick={handleNoteDownload}
                  className="text-xs px-3 rounded text-fg-muted hover:text-fg"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 40 }}
                >⬇ .md ダウンロード</button>
                <button
                  onClick={() => handleOpenImageStudio()}
                  className="text-xs px-3 rounded text-fg hover:text-fg"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 40 }}
                >🎨 アイキャッチ生成</button>
                {onSaveAsKnowledge && (
                  <button
                    onClick={handleSaveKb}
                    className="text-xs px-3 rounded text-fg-muted hover:text-fg"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 40 }}
                  >📚 ナレッジに保存</button>
                )}
                <ShareArtifactButton
                  variant="pill"
                  size="sm"
                  accent={persona.accentColor || '#A78BFA'}
                  label="お友達に送る"
                  shareText={editedTitle || editedBody.slice(0, 80)}
                  artifact={{
                    kind: 'text',
                    title: editedTitle || '記事の下書き',
                    body: editedBody,
                    createdBy: persona.name,
                    source: 'prism',
                    createdAt: new Date().toISOString(),
                  }}
                />
                <button
                  onClick={handleNoteOpen}
                  className="text-xs px-4 rounded font-semibold"
                  style={{ background: '#41C9B4', color: '#000000', minHeight: 40 }}
                >📝 note を開いて貼り付け →</button>
              </div>
            </div>
          )}

          {/* X タブ: 旧 UI */}
          {tab === 'x' && draft && (
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-3)', border: `1px solid ${persona.accentColor}40` }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <p className="text-fg-muted text-xs tracking-wider uppercase">
                  {editedThread.length > 1 ? `スレッド プレビュー (${editedThread.length}本)` : 'ツイート プレビュー'} (編集可)
                </p>
              </div>
              <div className="p-4 space-y-2">
                {editedThread.length > 1 ? (
                  editedThread.map((p, i) => (
                    <div key={i} className="rounded-lg p-2.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-xs font-mono" style={{ color: persona.accentColor }}>{i + 1}/{editedThread.length}</span>
                        <CharCounter text={p} />
                      </div>
                      <textarea
                        value={p}
                        onChange={e => {
                          const next = [...editedThread];
                          next[i] = e.target.value;
                          setEditedThread(next);
                        }}
                        rows={3}
                        className="w-full px-2 py-1.5 rounded bg-surface-3 border-edge border text-fg outline-none resize-none leading-relaxed"
                        style={{ fontSize: 14 }}
                      />
                    </div>
                  ))
                ) : (
                  <div>
                    <div className="flex justify-end mb-1"><CharCounter text={editedBody} /></div>
                    <textarea
                      value={editedBody}
                      onChange={e => setEditedBody(e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 rounded bg-surface-3 border-edge border text-fg outline-none resize-y leading-relaxed"
                      style={{ minHeight: 120, fontSize: 14 }}
                    />
                  </div>
                )}

                {(draft.tags || []).length > 0 && (
                  <div className="flex gap-2 flex-wrap pt-1">
                    {draft.tags.map(t => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded" style={{ background: persona.accentColorLight, color: persona.accentColor }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-4 py-3 flex flex-wrap gap-2 justify-end" style={{ borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={() => copyToClipboard(editedThread.length > 1 ? editedThread.join('\n\n---\n\n') : editedBody)}
                  className="text-xs px-3 rounded text-fg-muted hover:text-fg"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 40 }}
                >📋 コピー</button>
                <button
                  onClick={() => handleOpenImageStudio()}
                  className="text-xs px-3 rounded text-fg hover:text-fg"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 40 }}
                >🎨 画像生成</button>
                <ShareArtifactButton
                  variant="pill"
                  size="sm"
                  accent={persona.accentColor || '#A78BFA'}
                  label="お友達に送る"
                  shareText={editedBody.slice(0, 80)}
                  artifact={{
                    kind: 'post',
                    title: 'X 投稿の下書き',
                    body: editedThread.length > 1 ? editedThread.join('\n\n---\n\n') : editedBody,
                    createdBy: persona.name,
                    source: 'prism',
                    createdAt: new Date().toISOString(),
                  }}
                />
                {onSaveAsKnowledge && (
                  <button
                    onClick={handleSaveKb}
                    className="text-xs px-3 rounded text-fg-muted hover:text-fg"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 40 }}
                  >📚 ナレッジに保存</button>
                )}
                {!xConnected && (
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(editedBody)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs px-3 rounded text-fg-muted hover:text-fg inline-flex items-center"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 40 }}
                  >🌐 X で開く</a>
                )}
                <button
                  onClick={handleXPost}
                  disabled={!xConnected || xPosting}
                  className="text-xs px-4 rounded font-semibold disabled:opacity-40"
                  style={{ background: '#000000', color: '#FFFFFF', minHeight: 40 }}
                >{xPosting ? '送信中…' : `𝕏 ${editedThread.length > 1 ? 'スレッド投稿' : '今すぐ投稿'} →`}</button>
              </div>
              {xPostResult && (
                <div className="px-4 py-2 text-xs" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ADE80', borderTop: '1px solid var(--border)' }}>
                  ✓ 投稿完了 ({xPostResult.ids.length}本) ·{' '}
                  {xUser && (
                    <a href={`https://twitter.com/${xUser.username}/status/${xPostResult.ids[0]}`} target="_blank" rel="noopener noreferrer" className="underline">
                      投稿を確認する →
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function CharCounter({ text }: { text: string }) {
  const len = [...text].length;
  const over = len > 280;
  return (
    <span className="text-[10px] font-mono" style={{ color: over ? '#f87171' : '#9088A8' }}>
      {len} / 280
    </span>
  );
}
