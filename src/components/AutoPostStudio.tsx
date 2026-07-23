// ============================================================
// AutoPostStudio — 6 SNS 同時生成 + ハッシュタグ AI + 投稿予約
// 旧 note 長文 / X 単独生成は残し、新しい「⚡ 6 SNS 同時」タブを追加
// ============================================================
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Calendar, History, Zap, FileText, MessageCircle, Hash, Copy,
  RefreshCw, Download, BookOpen, Globe, Check,
  AlertTriangle, Clock, Inbox, Shuffle, Sparkles, Loader2, Palette, ExternalLink,
  Circle,
} from 'lucide-react';
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
  fetchXStatus, startXConnect, postXThread, disconnectX,
  readXCallbackResult, translateXError,
  createXSchedule, listXSchedule, deleteXSchedule, type ScheduledXPost,
} from '../lib/xConnect';
import { generateImage, type GenerateImageResult } from '../lib/imageGen';
import ShareArtifactButton from './ShareArtifactButton';
import { StudioIntro } from './StudioIntro';
import DelegateToAgentTeamBanner from './DelegateToAgentTeamBanner';
import StudioBackButton from './StudioBackButton';

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
  // note記事と同時に作る X / Threads 告知文（オーナー要望: 記事・画像・SNS文がワンセットで完成）
  const [noteSns, setNoteSns] = useState<{ x?: string; threads?: string } | null>(null);
  const [noteSnsBusy, setNoteSnsBusy] = useState(false);
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
  const [useCustomWords, setUseCustomWords] = useState(false);
  const [customWords] = useState(2000);
  const [threadCount, setThreadCount] = useState(1);
  const [draft, setDraft] = useState<SocialDraft | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [editedThread, setEditedThread] = useState<string[]>([]);

  // note: 生成内容に基づく見出し画像 (自動生成・トップに表示)
  const [noteImage, setNoteImage] = useState<GenerateImageResult | null>(null);
  const [noteImageBusy, setNoteImageBusy] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // X 連携（サーバー側 OAuth・トークンはサーバーに保存 = 予約の自動投稿にはこちらが必須）
  const [xUsername, setXUsername] = useState<string | undefined>(undefined);
  const [xConnected, setXConnected] = useState(false);
  const [xReady, setXReady] = useState(false);
  const [xPosting, setXPosting] = useState(false);
  const [xPostResult, setXPostResult] = useState<{ ids: string[]; urls?: string[] } | null>(null);
  const [xSchedules, setXSchedules] = useState<ScheduledXPost[]>([]);
  const [xScheduling, setXScheduling] = useState(false);

  const personaKnowledge = useMemo(
    () => knowledge.filter(k => k.personaId === persona.id),
    [knowledge, persona.id]
  );

  // X 連携状態の読み込み + OAuth コールバック結果の反映
  useEffect(() => {
    const cb = readXCallbackResult();
    if (cb?.error) setError(translateXError(cb.error));
    fetchXStatus().then(s => {
      setXReady(s.configured);
      setXConnected(s.connected);
      setXUsername(s.username);
      if (s.connected) listXSchedule().then(setXSchedules);
    });
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

  // ─── X 自動投稿の予約 (サーバー保存・ブラウザを閉じても実行される) ───
  const handleXAutoSchedule = useCallback(async (tweets: string[]) => {
    if (!scheduleAt) { setError('予約日時を選んでください'); return; }
    if (!xConnected) { setError('先にXアカウントと連携してください'); return; }
    setXScheduling(true); setError(null);
    try {
      const iso = new Date(scheduleAt).toISOString();
      const r = await createXSchedule(iso, tweets);
      if (!r.ok || !r.item) { setError(r.message || '予約に失敗しました'); return; }
      const next = [...xSchedules, r.item].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
      setXSchedules(next);
      setShowSchedule(true);
      notifyInApp({
        kind: 'success',
        title: 'Xへの自動投稿を予約しました',
        body: `${new Date(iso).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} に自動で投稿されます`,
        duration: 3000,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setXScheduling(false);
    }
  }, [scheduleAt, xConnected, xSchedules]);

  const handleDeleteXSchedule = useCallback(async (id: string) => {
    setXSchedules(prev => prev.filter(s => s.id !== id));
    await deleteXSchedule(id);
  }, []);

  // ─── 予約 ───
  // X は自動投稿(サーバー予約)が可能。それ以外の SNS は投稿APIが無い/未連携のため、
  // 「予約リスト」はローカルに残してリマインダーとして使う(自動では送信されない)。
  const handleSchedulePost = useCallback((platform: SocialPlatform) => {
    if (!scheduleAt) { setError('予約日時を選んでください'); return; }
    const body = multiPosts[platform] || '';
    if (!body.trim()) { setError('本文がありません'); return; }
    const tags = multiHashtags.length > 0 ? '\n\n' + multiHashtags.slice(0, 3).map(t => '#' + t).join(' ') : '';
    if (platform === 'x' && xConnected) {
      handleXAutoSchedule([body + tags]);
      return;
    }
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
      title: `${PLATFORM_META[platform].label} を予約しました（リマインダー・手動投稿用）`,
      body: new Date(scheduleAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      duration: 2500,
    });
  }, [scheduleAt, multiPosts, multiHashtags, topic, schedule, xConnected, handleXAutoSchedule]);

  const handleScheduleAll = useCallback(() => {
    if (!scheduleAt) { setError('予約日時を選んでください'); return; }
    if (Object.keys(multiPosts).length === 0) { setError('まず投稿を生成してください'); return; }
    // X 分は自動投稿を予約(接続時)。それ以外はローカルにリマインダーとして残す。
    if (multiPosts.x && xConnected) {
      const tags = multiHashtags.length > 0 ? '\n\n' + multiHashtags.slice(0, 2).map(t => '#' + t).join(' ') : '';
      handleXAutoSchedule([multiPosts.x + tags]);
    }
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
      title: `全 ${Object.keys(multiPosts).length} SNS を予約しました${multiPosts.x && xConnected ? '（Xは自動投稿されます）' : ''}`,
      body: new Date(scheduleAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      duration: 2800,
    });
  }, [scheduleAt, multiPosts, multiHashtags, topic, schedule, xConnected, handleXAutoSchedule]);

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

  // ─── note 記事の見出し画像を生成内容から自動生成 (トップに載せる) ───
  const generateNoteHeaderImage = useCallback(async (title: string, hookLine: string) => {
    setNoteImageBusy(true);
    setNoteImage(null);
    try {
      const seedText = [title, hookLine].filter(Boolean).join(' — ');
      const img = await generateImage({
        prompt: seedText || topic,
        aspect: 'note-hero',
        style: 'editorial',
      });
      setNoteImage(img);
    } catch (e) {
      // 画像生成の失敗は記事生成自体を止めない (silent failにせずログのみ)
      console.warn('[AutoPostStudio] note見出し画像の生成に失敗', e);
    } finally {
      setNoteImageBusy(false);
    }
  }, [topic]);

  // ─── note記事の告知文 (X / Threads) を記事内容から同時生成 ───
  const generateNoteSnsTexts = useCallback(async (title: string, hookLine: string, body: string) => {
    setNoteSnsBusy(true);
    setNoteSns(null);
    try {
      const excerpt = (body || '').replace(/[#>*`]/g, '').slice(0, 400);
      const md = await generateMultiPlatformPost({
        settings, persona, tone,
        topic: `note記事を公開する告知投稿。記事タイトル「${title}」／リード「${hookLine}」／要点: ${excerpt}`,
        platforms: ['x', 'threads'],
        customInstruction: '記事の一番おいしい学びを1つだけ切り出し、続きはnoteで読みたくなる引きを作る。宣伝臭は出さない。',
      });
      setNoteSns({ x: md.posts?.x || '', threads: md.posts?.threads || '' });
    } catch (e) {
      console.warn('[AutoPostStudio] X/Threads告知文の生成に失敗', e);
    } finally {
      setNoteSnsBusy(false);
    }
  }, [settings, persona, tone]);

  // ─── 旧 note / X 生成 ───
  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) { setError('テーマを入力してください'); return; }
    setIsGenerating(true);
    setError(null);
    setDraft(null);
    setNoteImage(null);
    setNoteSns(null);
    try {
      const ks = personaKnowledge.filter(k => selectedKnowledge.has(k.id));
      let result: SocialDraft;
      if (tab === 'note') {
        const effectiveWords = useCustomWords ? customWords : targetWords;
        result = await generateNoteArticle({
          settings, persona, topic, tone, knowledge: ks,
          targetWords: effectiveWords, customInstruction: customInstr,
        });
        setEditedTitle(result.title || '');
        setEditedBody('');
        animateInto(result.body || '', setEditedBody);
        // 記事の内容(タイトル+リード文)に基づく見出し画像を裏で自動生成
        generateNoteHeaderImage(result.title || topic, result.hookLine || '');
        // X / Threads の告知文も同時に用意（記事→画像→SNS文がワンセットで完成する体験）
        void generateNoteSnsTexts(result.title || topic, result.hookLine || '', result.body || '');
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
  }, [tab, topic, tone, customInstr, settings, persona, personaKnowledge, selectedKnowledge, targetWords, useCustomWords, customWords, threadCount, generateNoteHeaderImage, generateNoteSnsTexts]);

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

  // X 投稿 (サーバー側連携 = 予約の自動投稿もこの connect が有効な間ずっと使える)
  const handleXConnect = useCallback(() => {
    setError(null);
    startXConnect();
  }, []);
  const handleXDisconnect = useCallback(async () => {
    await disconnectX();
    setXConnected(false); setXUsername(undefined); setXSchedules([]);
  }, []);

  const handleXPost = useCallback(async () => {
    setXPosting(true); setError(null); setXPostResult(null);
    try {
      const tweets = editedThread.length > 1 ? editedThread.filter(t => t.trim().length > 0) : [editedBody];
      const r = await postXThread(tweets);
      if (!r.ok) { setError(r.message || 'Xへの投稿に失敗しました'); return; }
      setXPostResult({ ids: r.ids || [], urls: r.urls });
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
      const text = body + (multiHashtags.length > 0 ? '\n\n' + multiHashtags.slice(0, 2).map(t => '#' + t).join(' ') : '');
      const r = await postXThread([text]);
      if (!r.ok) { setError(r.message || 'Xへの投稿に失敗しました'); return; }
      setXPostResult({ ids: r.ids || [], urls: r.urls });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setXPosting(false);
    }
  }, [multiPosts, multiHashtags]);

  // 履歴の状態別件数
  const pendingSchedules = schedule.filter(s => s.status === 'pending').length + xSchedules.filter(s => s.status === 'pending').length;

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
            <StudioBackButton onClick={onClose} />
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: persona.accentColorLight, color: persona.accentColor }}
            ><Send size={20} strokeWidth={2.2} /></div>
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
            ><Calendar size={13} strokeWidth={2.2} />予約{pendingSchedules > 0 && ` ${pendingSchedules}`}</button>
            <button
              onClick={() => setShowHistory(s => !s)}
              className="text-xs px-3 rounded-full font-semibold inline-flex items-center gap-1"
              style={{
                height: 40, minHeight: 40,
                background: 'var(--surface-3)', color: 'var(--fg-muted)',
                border: '1px solid var(--border)',
              }}
            ><History size={13} strokeWidth={2.2} />履歴{history.length > 0 && ` ${history.length}`}</button>
            <button
              onClick={onClose}
              className="rounded-full flex items-center justify-center text-fg-muted hover:text-fg text-xl leading-none"
              style={{ width: 40, height: 40, minWidth: 40 }}
              aria-label="閉じる"
            >×</button>
          </div>
        </div>

        <DelegateToAgentTeamBanner
          taskTitle="今週の投稿 7 本を CMO が一括生成"
          suggestedCxos={['CMO', 'CDO']}
          why="毎日ネタを考える時間を消すため、AI 会社が 1 週間分を先回りで書きます"
          expected="6 SNS 別に最適化された 7 日分の投稿ドラフト"
        />

        {/* Platform Tabs */}
        <div className="flex gap-1 px-5 pt-3 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)' }}>
          {([
            { id: 'multi' as Tab, label: '6 SNS 同時', Icon: Zap },
            { id: 'note' as Tab, label: 'note 記事 (長文)', Icon: FileText },
            { id: 'x' as Tab, label: 'X 単独 / スレッド', Icon: MessageCircle },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setDraft(null); setError(null); }}
              className="text-sm px-4 rounded-t-md font-medium whitespace-nowrap inline-flex items-center gap-1.5"
              style={{
                minHeight: 44,
                background: tab === t.id ? persona.accentColorLight : 'transparent',
                color: tab === t.id ? persona.accentColor : 'var(--fg-muted)',
                borderBottom: tab === t.id ? `2px solid ${persona.accentColor}` : '2px solid transparent',
              }}
            ><t.Icon size={15} strokeWidth={2.2} />{t.label}</button>
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
                {/* X: サーバー側で実際に自動投稿される予約 */}
                {xSchedules.length > 0 && (
                  <div style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="px-4 py-2.5" style={{ background: `${persona.accentColor}12` }}>
                      <p className="text-fg font-semibold text-sm">𝕏 自動投稿される予約 ({xSchedules.length}件)</p>
                      <p className="text-fg-muted text-[11px]">時刻になると、ブラウザを閉じていても自動でXに投稿されます</p>
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
                      {xSchedules.map(s => {
                        const dt = new Date(s.scheduledAt);
                        return (
                          <div key={s.id} className="px-4 py-2.5 flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-mono" style={{ color: persona.accentColor }}>
                                  {dt.toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {s.status === 'pending' && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface)', color: 'var(--fg-muted)' }}>予約中</span>}
                                {s.status === 'sent' && <span className="text-[10px] inline-flex items-center gap-0.5" style={{ color: '#4ADE80' }}><Check size={11} strokeWidth={2.6} />自動投稿済み</span>}
                                {s.status === 'failed' && <span className="text-[10px] text-red-400 inline-flex items-center gap-0.5"><AlertTriangle size={11} strokeWidth={2.4} />投稿失敗: {s.error}</span>}
                              </div>
                              <p className="text-fg-muted text-[11px] truncate">{s.tweets[0]}</p>
                              {s.status === 'sent' && s.urls?.[0] && (
                                <a href={s.urls[0]} target="_blank" rel="noopener noreferrer" className="text-[11px] underline" style={{ color: persona.accentColor }}>投稿を確認する →</a>
                              )}
                            </div>
                            {s.status === 'pending' && (
                              <button
                                onClick={() => handleDeleteXSchedule(s.id)}
                                className="text-fg-muted hover:text-fg text-xs px-2 py-1 rounded flex-shrink-0"
                                style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 32 }}
                              >削除</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                  <p className="text-fg font-semibold text-sm inline-flex items-center gap-1.5"><Calendar size={14} strokeWidth={2.2} />その他 SNS の予約リマインダー ({schedule.length}件)</p>
                  <p className="text-fg-muted text-[11px]">※ ローカル保存。X以外は投稿APIが無いため手動投稿の目安です</p>
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
                              {s.status === 'missed' && <span className="text-[10px] text-red-400 inline-flex items-center gap-0.5"><Clock size={11} strokeWidth={2.4} />未送信のまま期限切れ</span>}
                              {past && s.status === 'pending' && <span className="text-[10px] text-red-400 inline-flex items-center gap-0.5"><AlertTriangle size={11} strokeWidth={2.4} />過去日時</span>}
                              {s.status === 'sent' && <span className="text-[10px] inline-flex items-center gap-0.5" style={{ color: persona.accentColor }}><Check size={11} strokeWidth={2.6} />送信済</span>}
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
                  <p className="text-fg font-semibold text-sm inline-flex items-center gap-1.5"><History size={14} strokeWidth={2.2} />過去の生成 ({history.length}件、最大 {MAX_HISTORY} 件)</p>
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
                            className="text-xs px-3 rounded font-semibold inline-flex items-center gap-1"
                            style={{ background: 'var(--surface)', color: 'var(--fg)', border: '1px solid var(--border)', minHeight: 36 }}
                          ><Inbox size={13} strokeWidth={2.2} />読み込む</button>
                          <button
                            onClick={() => handleRemix(h)}
                            className="text-xs px-3 rounded font-semibold inline-flex items-center gap-1"
                            style={{ background: persona.accentColor, color: '#0a0a0f', minHeight: 36 }}
                          ><Shuffle size={13} strokeWidth={2.2} />再アレンジ</button>
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
              iconKey="autopost"
              what="1 つのテーマから X / Threads / Instagram / LinkedIn / note / Facebook 6 SNS 分の最適化された投稿文を同時生成します。"
              tryThis="テーマを入力 → 「6 SNS 同時生成」を押す → 各カードでコピー or 投稿予約。"
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
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg" style={{ background: persona.accentColorLight }}>𝕏</div>
                <div className="min-w-0">
                  <p className="text-fg text-sm font-semibold leading-tight">
                    X 連携 {xConnected && <span className="text-xs ml-1" style={{ color: persona.accentColor }}>● 接続中</span>}
                  </p>
                  {xConnected ? (
                    <p className="text-fg-muted text-xs truncate">{xUsername ? `@${xUsername} · ` : ''}今すぐ投稿・予約した自動投稿の両方に使えます</p>
                  ) : (
                    <p className="text-fg-muted text-xs">{xReady ? '連携すると、生成 → ワンクリック投稿・日時指定の自動投稿が可能に' : 'X連携の設定が未完了です'}</p>
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
                placeholder={tab === 'multi' ? '投稿テーマを入れてください (例: 新サービスのお知らせ、25-34 歳女性向け)' : tab === 'note' ? '投稿テーマを入れてください (例: 起業 1 年目で学んだ顧客インタビューの本質)' : '投稿テーマを入れてください (例: 今日の経営判断の裏側を 1 ツイートで)'}
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
                  <div className="col-span-2">
                    <div className="flex items-baseline justify-between mb-1.5">
                      <label className="block text-fg-muted text-xs tracking-wider uppercase">文字量</label>
                      <span className="text-sm font-semibold tabular-nums" style={{ color: persona.accentColor }}>約 {targetWords.toLocaleString()} 字</span>
                    </div>
                    {/* ワンタップのチップ + 微調整スライダー（直感的に多く/少なく） */}
                    <div className="flex gap-1.5 mb-2">
                      {[
                        { w: 800, label: '短め' },
                        { w: 1500, label: '標準' },
                        { w: 2500, label: '長め' },
                        { w: 3500, label: '超詳細' },
                      ].map(c => (
                        <button
                          key={c.w}
                          onClick={() => { setTargetWords(c.w); setUseCustomWords(false); }}
                          className="flex-1 rounded-lg text-xs font-medium transition-all"
                          style={{
                            minHeight: 40,
                            background: targetWords === c.w ? persona.accentColorLight : 'var(--surface-3)',
                            border: `1px solid ${targetWords === c.w ? persona.accentColor : 'var(--border)'}`,
                            color: targetWords === c.w ? persona.accentColor : 'var(--fg-muted, #999)',
                          }}
                        >{c.label}</button>
                      ))}
                    </div>
                    <input
                      type="range"
                      min={300} max={6000} step={100}
                      value={targetWords}
                      onChange={e => { setTargetWords(Number(e.target.value)); setUseCustomWords(false); }}
                      className="w-full"
                      style={{ accentColor: persona.accentColor, minHeight: 32 }}
                      aria-label="目標字数"
                    />
                    <div className="flex justify-between text-[10px] text-fg-muted">
                      <span>300字（サクッと）</span>
                      <span>6,000字（がっつり）</span>
                    </div>
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
                            <span className="inline-flex flex-shrink-0">{sel ? <Check size={14} strokeWidth={2.6} /> : <Circle size={14} strokeWidth={2} />}</span>
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
                  <label className="text-fg-muted text-xs tracking-wider uppercase mb-1.5 inline-flex items-center gap-1"><Calendar size={12} strokeWidth={2.2} />予約日時 (任意)</label>
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
                    disabled={!scheduleAt || Object.keys(multiPosts).length === 0 || xScheduling}
                    className="w-full rounded font-semibold disabled:opacity-40"
                    style={{
                      minHeight: 48,
                      background: 'var(--surface)', color: 'var(--fg)',
                      border: `1px solid ${persona.accentColor}50`, fontSize: 14,
                    }}
                  ><span className="inline-flex items-center justify-center gap-1">{xScheduling ? '予約中…' : <><Calendar size={14} strokeWidth={2.2} />全 SNS をこの日時に予約</>}</span></button>
                </div>
              </div>
            )}

            <motion.button
              onClick={tab === 'multi' ? handleGenerateMulti : handleGenerate}
              disabled={!topic.trim() || isGenerating || (tab === 'multi' && enabledPlatforms.size === 0)}
              className="w-full rounded-lg font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
              style={{ background: persona.accentColor, color: '#0a0a0f', minHeight: 56, fontSize: 16 }}
              whileTap={!isGenerating ? { scale: 0.99 } : {}}
            >
              {isGenerating
                ? <><Loader2 size={17} strokeWidth={2.4} className="animate-spin" />生成中…</>
                : tab === 'multi'
                  ? <><Sparkles size={17} strokeWidth={2.2} />{`${enabledPlatforms.size} SNS 同時生成`}</>
                  : <><Sparkles size={17} strokeWidth={2.2} />{`${tab === 'note' ? 'note 記事' : threadCount > 1 ? 'X スレッド' : 'X ツイート'}を生成`}</>
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
              ><span className="inline-flex items-center justify-center gap-1.5"><Hash size={14} strokeWidth={2.4} />{hashtagBusy ? '提案中…' : 'ハッシュタグだけ AI に提案させる (10 個)'}</span></button>
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
                    <p className="text-fg-muted text-xs tracking-wider uppercase inline-flex items-center gap-1.5"><Hash size={13} strokeWidth={2.4} />提案ハッシュタグ ({multiHashtags.length})</p>
                    <button
                      onClick={() => copyToClipboard(multiHashtags.map(t => '#' + t).join(' '), 'ハッシュタグ')}
                      className="text-[11px] px-2 py-1 rounded text-fg-muted hover:text-fg inline-flex items-center gap-1"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                    ><Copy size={12} strokeWidth={2.2} />まとめてコピー</button>
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
                          <p className="text-[10px] inline-flex items-center gap-0.5" style={{ color: over ? '#f87171' : 'var(--fg-muted)' }}>
                            {body.length} / {m.charBudget} 字 {over && <><AlertTriangle size={10} strokeWidth={2.4} />超過</>}
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
                        className="text-xs px-3 rounded text-fg hover:text-fg font-medium inline-flex items-center gap-1"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 40 }}
                      ><Copy size={13} strokeWidth={2.2} />タグごとコピー</button>
                      <button
                        onClick={() => handleOpenImageStudio(p)}
                        className="text-xs px-3 rounded font-medium inline-flex items-center gap-1"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--fg)', minHeight: 40 }}
                      ><Palette size={13} strokeWidth={2.2} />画像生成</button>
                      {scheduleAt && (
                        <button
                          onClick={() => handleSchedulePost(p)}
                          className="text-xs px-3 rounded font-semibold inline-flex items-center gap-1"
                          style={{ background: persona.accentColorLight, color: persona.accentColor, minHeight: 40 }}
                        ><Calendar size={13} strokeWidth={2.2} />この SNS だけ予約</button>
                      )}
                      {m.postUrl && (
                        <a
                          href={m.postUrl(body + (multiHashtags.length > 0 ? '\n\n' + multiHashtags.slice(0, 3).map(t => '#' + t).join(' ') : ''))}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs px-3 rounded font-semibold inline-flex items-center gap-1"
                          style={{ background: m.color, color: '#fff', minHeight: 40 }}
                        ><ExternalLink size={13} strokeWidth={2.2} />{m.label.split(' ')[0]} で開く</a>
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
                <div className="rounded-xl px-4 py-2 text-xs inline-flex items-center gap-1" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ADE80' }}>
                  <Check size={12} strokeWidth={2.6} />投稿完了 ·{' '}
                  {xPostResult.urls?.[0] && (
                    <a href={xPostResult.urls[0]} target="_blank" rel="noopener noreferrer" className="underline">
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

              {/* 見出し画像 (記事内容に基づき自動生成・note のトップに載せる用) */}
              <div className="p-4 pb-0">
                {noteImageBusy ? (
                  <div
                    className="w-full rounded-lg flex items-center justify-center gap-1.5 text-fg-muted text-xs animate-pulse"
                    style={{ aspectRatio: '16/9', background: 'var(--surface)', border: '1px solid var(--border)' }}
                  ><Palette size={14} strokeWidth={2.2} />見出し画像を生成中…</div>
                ) : noteImage ? (
                  <div className="relative rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    <img src={noteImage.url} alt="見出し画像" className="w-full block" style={{ aspectRatio: '16/9', objectFit: 'cover' }} />
                    <div className="absolute bottom-2 right-2 flex gap-1.5">
                      <button
                        onClick={() => generateNoteHeaderImage(editedTitle, draft?.hookLine || '')}
                        className="text-[11px] px-2.5 py-1.5 rounded-md font-medium inline-flex items-center gap-1"
                        style={{ background: 'rgba(0,0,0,0.65)', color: '#fff', backdropFilter: 'blur(6px)' }}
                      ><RefreshCw size={12} strokeWidth={2.2} />画像を変える</button>
                      <a
                        href={noteImage.url} download={`${(editedTitle || 'note-hero').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40)}.jpg`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-[11px] px-2.5 py-1.5 rounded-md font-medium inline-flex items-center gap-1"
                        style={{ background: 'rgba(0,0,0,0.65)', color: '#fff', backdropFilter: 'blur(6px)' }}
                      ><Download size={12} strokeWidth={2.2} />ダウンロード</a>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => generateNoteHeaderImage(editedTitle, draft?.hookLine || '')}
                    className="w-full rounded-lg flex items-center justify-center gap-1.5 text-fg-muted text-xs"
                    style={{ aspectRatio: '16/9', background: 'var(--surface)', border: '1px dashed var(--border)' }}
                  ><Palette size={14} strokeWidth={2.2} />見出し画像を生成する</button>
                )}
                <p className="text-fg-muted text-[11px] mt-1.5">この画像をダウンロードして、note編集画面の「見出し画像」に設定してください（note公式APIが無いため自動では貼り付けられません）</p>
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
                  className="text-xs px-3 rounded text-fg-muted hover:text-fg inline-flex items-center gap-1"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 40 }}
                ><Copy size={13} strokeWidth={2.2} />Markdown コピー</button>
                <button
                  onClick={handleNoteDownload}
                  className="text-xs px-3 rounded text-fg-muted hover:text-fg inline-flex items-center gap-1"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 40 }}
                ><Download size={13} strokeWidth={2.2} />.md ダウンロード</button>
                <button
                  onClick={() => handleOpenImageStudio()}
                  className="text-xs px-3 rounded text-fg hover:text-fg inline-flex items-center gap-1"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 40 }}
                ><Palette size={13} strokeWidth={2.2} />アイキャッチ生成</button>
                {onSaveAsKnowledge && (
                  <button
                    onClick={handleSaveKb}
                    className="text-xs px-3 rounded text-fg-muted hover:text-fg inline-flex items-center gap-1"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 40 }}
                  ><BookOpen size={13} strokeWidth={2.2} />ナレッジに保存</button>
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
                  className="text-xs px-4 rounded font-semibold inline-flex items-center gap-1"
                  style={{ background: '#41C9B4', color: '#000000', minHeight: 40 }}
                ><FileText size={13} strokeWidth={2.2} />note を開いて貼り付け →</button>
              </div>

              {/* ★記事とセットで完成する X / Threads 告知文（同時生成） */}
              <div className="px-4 py-3 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between">
                  <p className="text-fg-muted text-xs tracking-wider uppercase">X・Threads 告知文（記事から同時生成）</p>
                  {!noteSnsBusy && (
                    <button
                      onClick={() => generateNoteSnsTexts(editedTitle, draft?.hookLine || '', editedBody)}
                      className="text-[11px] px-2.5 rounded text-fg-muted hover:text-fg inline-flex items-center gap-1"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 32 }}
                    ><RefreshCw size={11} strokeWidth={2.2} />{noteSns ? '作り直す' : '生成する'}</button>
                  )}
                </div>
                {noteSnsBusy ? (
                  <div className="flex items-center gap-2 text-fg-muted text-xs py-3 animate-pulse">
                    <Loader2 size={14} className="animate-spin" strokeWidth={2.2} />記事の内容から X と Threads の告知文を書いています…
                  </div>
                ) : noteSns ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {([['x', 'X (旧Twitter)'], ['threads', 'Threads']] as const).map(([pk, plabel]) => {
                      const body = pk === 'x' ? noteSns.x : noteSns.threads;
                      if (!body) return null;
                      return (
                        <div key={pk} className="rounded-lg p-3 space-y-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                          <p className="text-[11px] font-semibold text-fg-muted">{plabel}</p>
                          <p className="text-[13px] text-fg leading-relaxed whitespace-pre-wrap">{body}</p>
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => copyToClipboard(body, plabel)}
                              className="text-[11px] px-2.5 rounded text-fg-muted hover:text-fg inline-flex items-center gap-1"
                              style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', minHeight: 32 }}
                            ><Copy size={11} strokeWidth={2.2} />コピー</button>
                            <a
                              href={PLATFORM_META[pk].postUrl ? PLATFORM_META[pk].postUrl!(body) : '#'}
                              target="_blank" rel="noopener noreferrer"
                              className="text-[11px] px-2.5 rounded font-medium inline-flex items-center gap-1"
                              style={{ background: persona.accentColorLight, color: persona.accentColor, minHeight: 32 }}
                            ><ExternalLink size={11} strokeWidth={2.2} />投稿画面を開く</a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-fg-muted text-[11px]">記事を生成すると、Xと Threads の告知文もここに自動で並びます。</p>
                )}
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
                  className="text-xs px-3 rounded text-fg-muted hover:text-fg inline-flex items-center gap-1"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 40 }}
                ><Copy size={13} strokeWidth={2.2} />コピー</button>
                <button
                  onClick={() => handleOpenImageStudio()}
                  className="text-xs px-3 rounded text-fg hover:text-fg inline-flex items-center gap-1"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 40 }}
                ><Palette size={13} strokeWidth={2.2} />画像生成</button>
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
                    className="text-xs px-3 rounded text-fg-muted hover:text-fg inline-flex items-center gap-1"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 40 }}
                  ><BookOpen size={13} strokeWidth={2.2} />ナレッジに保存</button>
                )}
                {!xConnected && (
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(editedBody)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs px-3 rounded text-fg-muted hover:text-fg inline-flex items-center gap-1"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 40 }}
                  ><Globe size={13} strokeWidth={2.2} />X で開く</a>
                )}
                <button
                  onClick={handleXPost}
                  disabled={!xConnected || xPosting}
                  className="text-xs px-4 rounded font-semibold disabled:opacity-40"
                  style={{ background: '#000000', color: '#FFFFFF', minHeight: 40 }}
                >{xPosting ? '送信中…' : `𝕏 ${editedThread.length > 1 ? 'スレッド投稿' : '今すぐ投稿'} →`}</button>
              </div>
              {xPostResult && (
                <div className="px-4 py-2 text-xs inline-flex items-center gap-1" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ADE80', borderTop: '1px solid var(--border)' }}>
                  <Check size={12} strokeWidth={2.6} />投稿完了 ({xPostResult.ids.length}本) ·{' '}
                  {xPostResult.urls?.[0] && (
                    <a href={xPostResult.urls[0]} target="_blank" rel="noopener noreferrer" className="underline">
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
