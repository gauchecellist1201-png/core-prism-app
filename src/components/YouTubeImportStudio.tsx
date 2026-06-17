import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Persona, AppSettings } from '../types/identity';
import {
  fetchOEmbed,
  fetchTranscript,
  fetchDescriptionFallback,
  summarizeWithClaude,
  extractUrlList,
  recordSeriesEntry,
  groupSeriesByAuthor,
  type VideoMeta,
  type YouTubeSummary,
  type SeriesEntry,
} from '../lib/youtubeImport';
import { useAgentTaskQueue } from '../hooks/useAgentTaskQueue';
import { notifyInApp } from '../lib/inAppNotify';
import ApiErrorCard from './ApiErrorCard';
import SafeImg from './SafeImg';
import { StudioIntro } from './StudioIntro';
import ThinkingIndicator from './ThinkingIndicator';

interface Props {
  persona: Persona;
  settings: AppSettings;
  onClose: () => void;
  onSaveAsKnowledge: (title: string, content: string) => void;
}

type Phase = 'input' | 'meta' | 'transcript' | 'summarizing' | 'result' | 'saved' | 'bulk-running' | 'series';

type TranscriptSource = 'transcript' | 'description' | 'manual' | 'meta-only';

interface BulkRow {
  url: string;
  status: 'queued' | 'fetching' | 'summarizing' | 'done' | 'error';
  meta?: VideoMeta;
  source?: TranscriptSource;
  summary?: YouTubeSummary;
  error?: string;
}

export default function YouTubeImportStudio({ persona, settings, onClose, onSaveAsKnowledge }: Props) {
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [transcript, setTranscript] = useState('');
  const [transcriptSource, setTranscriptSource] = useState<TranscriptSource>('manual');
  const [summary, setSummary] = useState<YouTubeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);

  const queue = useAgentTaskQueue();

  // シリーズビュー (同チャンネル束ね)
  const [seriesGroups, setSeriesGroups] = useState(() => groupSeriesByAuthor());
  const refreshSeries = useCallback(() => setSeriesGroups(groupSeriesByAuthor()), []);

  useEffect(() => { refreshSeries(); }, [refreshSeries]);

  const isBulk = useMemo(() => {
    const list = extractUrlList(url);
    return list.length > 1;
  }, [url]);

  // ─── 単一動画: メタ + 字幕 fallback ───────────────────────
  const handleFetchMeta = useCallback(async () => {
    if (!url.trim()) return;
    // 複数 URL なら bulk へ
    const list = extractUrlList(url);
    if (list.length > 1) {
      handleBulk(list);
      return;
    }

    setLoadingMeta(true);
    setError(null);
    try {
      const m = await fetchOEmbed(url.trim());
      setMeta(m);
      setPhase('transcript');

      // ① 字幕
      const auto = await fetchTranscript(m.videoId);
      if (auto) {
        setTranscript(auto);
        setTranscriptSource('transcript');
        return;
      }
      // ② description フォールバック
      const desc = await fetchDescriptionFallback(m.videoId);
      if (desc) {
        setTranscript(desc);
        setTranscriptSource('description');
        return;
      }
      // ③ 手動
      setTranscript('');
      setTranscriptSource('manual');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'メタデータ取得に失敗しました');
    } finally {
      setLoadingMeta(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // ─── 複数動画: 一括取込 ────────────────────────────────────
  const handleBulk = useCallback(async (urls: string[]) => {
    setPhase('bulk-running');
    setError(null);
    const initial: BulkRow[] = urls.map(u => ({ url: u, status: 'queued' }));
    setBulkRows(initial);

    // 並列処理 (最大 3 並列で API レート保護)
    const updateRow = (idx: number, patch: Partial<BulkRow>) => {
      setBulkRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
    };

    const processOne = async (idx: number, u: string) => {
      try {
        updateRow(idx, { status: 'fetching' });
        const m = await fetchOEmbed(u);
        updateRow(idx, { meta: m });

        let text: string | null = await fetchTranscript(m.videoId);
        let src: TranscriptSource = 'transcript';
        if (!text) {
          text = await fetchDescriptionFallback(m.videoId);
          src = text ? 'description' : 'meta-only';
        }
        if (!text) {
          text = `タイトル: ${m.title}\nチャンネル: ${m.author}\n(字幕も説明文も無いため、タイトル等から推測)`;
        }
        updateRow(idx, { status: 'summarizing', source: src });

        const sum = await summarizeWithClaude(settings, text, m);
        // シリーズに記録
        recordSeriesEntry({
          videoId: m.videoId,
          url: m.url,
          title: m.title,
          author: m.author,
          authorUrl: m.authorUrl,
          thumbnailUrl: m.thumbnailUrl,
          importedAt: new Date().toISOString(),
          summaryLine: (sum.summary || '').split(/\n|。/)[0]?.slice(0, 80),
        });
        updateRow(idx, { status: 'done', summary: sum });
      } catch (e) {
        updateRow(idx, { status: 'error', error: e instanceof Error ? e.message : 'failed' });
      }
    };

    const concurrency = 3;
    let cursor = 0;
    const runners = Array.from({ length: Math.min(concurrency, urls.length) }, async () => {
      while (cursor < urls.length) {
        const idx = cursor++;
        await processOne(idx, urls[idx]);
      }
    });
    await Promise.all(runners);
    refreshSeries();
  }, [settings, refreshSeries]);

  // ─── 単一: AI 要約 ─────────────────────────────────────────
  const handleSummarize = useCallback(async () => {
    if (!meta) return;
    const text = transcript.trim() || `タイトル: ${meta.title}\nチャンネル: ${meta.author}\n(字幕も説明文も取得できなかったため、タイトルとチャンネル名のみから推測)`;
    setPhase('summarizing');
    setError(null);
    try {
      const result = await summarizeWithClaude(settings, text, meta);
      setSummary(result);
      setPhase('result');
      // シリーズに記録
      recordSeriesEntry({
        videoId: meta.videoId,
        url: meta.url,
        title: meta.title,
        author: meta.author,
        authorUrl: meta.authorUrl,
        thumbnailUrl: meta.thumbnailUrl,
        importedAt: new Date().toISOString(),
        summaryLine: (result.summary || '').split(/\n|。/)[0]?.slice(0, 80),
      });
      refreshSeries();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 要約に失敗しました');
      setPhase('transcript');
    }
  }, [meta, transcript, settings, refreshSeries]);

  // ─── 単一: ナレッジに保存 ──────────────────────────────────
  const buildKnowledgeContent = useCallback((m: VideoMeta, s: YouTubeSummary, srcText: string, src: TranscriptSource): string => {
    const lines: string[] = [
      `# ${m.title}`,
      `チャンネル: ${m.author}`,
      `URL: ${m.url}`,
      `情報源: ${src === 'transcript' ? '字幕' : src === 'description' ? '動画説明文' : src === 'manual' ? '手動入力' : 'タイトルのみ'}`,
      '',
      '## 要約',
      s.summary,
      '',
    ];
    if (s.chapters.length > 0) {
      lines.push('## 章立て');
      for (const ch of s.chapters) {
        lines.push(`### ${ch.title}`);
        lines.push(ch.content);
        lines.push('');
      }
    }
    if (s.quotes.length > 0) {
      lines.push('## 印象的なフレーズ');
      for (const q of s.quotes) lines.push(`- ${q}`);
      lines.push('');
    }
    if (s.actions.length > 0) {
      lines.push('## アクション');
      for (const a of s.actions) lines.push(`- ${a}`);
      lines.push('');
    }
    if (srcText) {
      lines.push('## 元テキスト (字幕 / 説明文)');
      lines.push(srcText.slice(0, 8000));
    }
    return lines.join('\n');
  }, []);

  const handleSave = useCallback(() => {
    if (!meta || !summary) return;
    const content = buildKnowledgeContent(meta, summary, transcript, transcriptSource);
    onSaveAsKnowledge(`🎬 ${meta.title}`, content);
    setPhase('saved');
    setTimeout(onClose, 1600);
  }, [meta, summary, transcript, transcriptSource, onSaveAsKnowledge, onClose, buildKnowledgeContent]);

  // ─── 単一: アクションを AgentTaskQueue に委任 ──────────────
  const handleDelegateActions = useCallback(() => {
    if (!meta || !summary) return;
    const actions = summary.actions.filter(a => a.trim());
    if (actions.length === 0) {
      notifyInApp({ kind: 'warn', title: 'アクションが抽出されていません', body: '要約に actions が含まれていません' });
      return;
    }
    queue.propose({
      title: `動画「${meta.title.slice(0, 30)}」のアクションを実行`,
      summary: `YouTube 動画から抽出した ${actions.length} 件のアクションを AI 会社で分業実行:\n${actions.map(a => `- ${a}`).join('\n')}`,
      why: `${meta.author} の動画ナレッジを学びから行動に変換`,
      expected: `${actions.length} 件のアクションの実行報告`,
      dueDays: 3,
      steps: [
        { cxo: 'CEO', label: 'アクションに優先順位、各担当を決定' },
        { cxo: 'COO', label: '各アクションを実行可能な小タスクに分解' },
        { cxo: 'CMO', label: 'コピー / 文章系のアクションは下書きを生成' },
        { cxo: 'CDS', label: '実行結果を集計、効果測定' },
      ],
    });
    notifyInApp({
      kind: 'success',
      title: 'AI 会社に依頼しました',
      body: `${actions.length} 件のアクションを承認後に実行`,
      duration: 4000,
    });
  }, [meta, summary, queue]);

  // ─── Bulk: 全件をまとめてナレッジに保存 ────────────────────
  const handleSaveBulk = useCallback(() => {
    const done = bulkRows.filter(r => r.status === 'done' && r.meta && r.summary);
    if (done.length === 0) return;
    for (const r of done) {
      const content = buildKnowledgeContent(r.meta!, r.summary!, '', r.source || 'transcript');
      onSaveAsKnowledge(`🎬 ${r.meta!.title}`, content);
    }
    notifyInApp({
      kind: 'success',
      title: `${done.length} 件をナレッジに保存`,
      body: 'シリーズビューからいつでも参照できます',
      duration: 3500,
    });
    setPhase('saved');
    setTimeout(onClose, 1600);
  }, [bulkRows, buildKnowledgeContent, onSaveAsKnowledge, onClose]);

  // ─── シリーズ: 動画を選んで開く ────────────────────────────
  const openFromSeries = useCallback((entry: SeriesEntry) => {
    setUrl(entry.url);
    setPhase('input');
    setTimeout(() => handleFetchMeta(), 50);
  }, [handleFetchMeta]);

  const bulkProgress = useMemo(() => {
    if (bulkRows.length === 0) return { done: 0, total: 0, allFinished: false };
    const done = bulkRows.filter(r => r.status === 'done' || r.status === 'error').length;
    return { done, total: bulkRows.length, allFinished: done === bulkRows.length };
  }, [bulkRows]);

  const sourceLabel = (s: TranscriptSource) =>
    s === 'transcript' ? '✓ 字幕' : s === 'description' ? '✓ 説明文' : s === 'manual' ? '✎ 手動' : '⚠ タイトルのみ';

  return (
    <motion.div
      className="cp-modal-bg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="cp-modal"
        style={{ maxWidth: '640px' }}
        initial={{ scale: 0.96, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 16 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      >
        {/* Header */}
        <div className="cp-modal-header">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎬</span>
            <div>
              <p className="text-fg font-semibold text-sm">YouTube 取込</p>
              <p className="text-fg-muted text-xs">AI 要約 → ナレッジ化</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {seriesGroups.length > 0 && phase === 'input' && (
              <button
                onClick={() => setPhase('series')}
                className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg)' }}
              >
                📚 シリーズ ({seriesGroups.reduce((s, g) => s + g.videos.length, 0)})
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-fg-muted hover:text-fg text-lg leading-none transition-colors"
              aria-label="閉じる"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="cp-modal-body cp-stack" style={{ gap: '16px' }}>

          {phase === 'input' && (
            <StudioIntro
              id="youtube-import"
              accent={persona.accentColor}
              iconKey="youtube"
              what="YouTube の URL を貼るだけで、AI が要約してナレッジに保存します。複数行で一括取込も。"
              tryThis="URL を 1 本貼って「取得」、または改行で複数貼って「一括取込」。"
              example="講義動画 5 本 → 各 3 行要約 + 同じチャンネルでシリーズ化 → 他の Studio から参照可能。"
              sampleLabel="出来上がる要約"
              samplePreview={
                <div
                  style={{
                    width: 160,
                    background: 'var(--surface-1)',
                    borderRadius: 6,
                    padding: '6px 7px',
                    fontSize: 7,
                    lineHeight: 1.4,
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    boxShadow: 'var(--cp-elev-3)',
                    border: `1px solid ${persona.accentColor}30`,
                  }}
                  aria-label="YouTube 要約のサンプル"
                >
                  <div
                    style={{
                      aspectRatio: '16/9',
                      background: 'linear-gradient(135deg, #FF0000 0%, #CC0000 100%)',
                      borderRadius: 3,
                      marginBottom: 4,
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.92)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 6,
                        color: '#FF0000',
                      }}
                    >
                      ▶
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 6.5, marginBottom: 3, lineHeight: 1.3, color: 'var(--fg)' }}>
                    AI 時代に伸びる事業の作り方
                  </div>
                  <div
                    style={{
                      background: `${persona.accentColor}14`,
                      borderLeft: `2px solid ${persona.accentColor}`,
                      padding: '3px 4px',
                      marginBottom: 3,
                      color: 'var(--fg)',
                      fontSize: 6,
                    }}
                  >
                    <div style={{ fontSize: 5, opacity: 0.7, marginBottom: 1 }}>📌 結論</div>
                    <div>顧客の「困った」を AI で 10 倍速で解く事業が勝つ</div>
                  </div>
                </div>
              }
            />
          )}

          <AnimatePresence mode="wait">

            {/* ─── Phase: input ─── */}
            {phase === 'input' && (
              <motion.div key="input" className="flex flex-col gap-4"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="cp-h3">YouTube URL</p>
                    <span className="text-fg-subtle text-xs">{isBulk ? `${extractUrlList(url).length} 本まとめて` : '1 本貼って Enter'}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey && !isBulk) {
                          e.preventDefault();
                          handleFetchMeta();
                        }
                      }}
                      placeholder="https://www.youtube.com/watch?v=...&#10;改行で複数貼ると一括取込"
                      rows={isBulk ? 4 : 2}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                      style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                      autoFocus
                    />
                    <motion.button
                      onClick={handleFetchMeta}
                      disabled={!url.trim() || loadingMeta}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                      style={{ background: persona.accentColor, color: '#1F1D26' }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {loadingMeta ? '取得中…' : isBulk ? `🎬 ${extractUrlList(url).length} 本を一括取込` : '取得'}
                    </motion.button>
                  </div>
                </div>
                <ApiErrorCard error={error} onRetry={handleFetchMeta} variant="auto" />
                <p className="text-fg-subtle text-xs">対応: youtube.com/watch?v=… / youtu.be/… / /shorts/… ・字幕なしも説明文で要約</p>
              </motion.div>
            )}

            {/* ─── Phase: transcript (字幕入力) ─── */}
            {phase === 'transcript' && meta && (
              <motion.div key="transcript" className="flex flex-col gap-4"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

                {/* サムネ + メタ */}
                <div className="cp-card-section flex gap-3 items-start">
                  <SafeImg
                    src={meta.thumbnailUrl}
                    alt={meta.title}
                    className="w-28 rounded-lg flex-shrink-0"
                    aspectRatio="16/9"
                    errorLabel="サムネ取得失敗"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-fg text-sm font-semibold leading-snug line-clamp-2">{meta.title}</p>
                    <p className="text-fg-muted text-xs mt-0.5">{meta.author}</p>
                    <a
                      href={meta.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs mt-1 inline-block"
                      style={{ color: persona.accentColor }}
                    >
                      ↗ 動画を開く
                    </a>
                  </div>
                </div>

                {/* 字幕エリア */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="cp-h3">字幕 / テキスト</p>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: transcriptSource === 'manual' ? 'var(--surface-3)' : `${persona.accentColor}20`,
                        color: transcriptSource === 'manual' ? 'var(--fg-muted)' : persona.accentColor,
                        border: '1px solid var(--border)',
                      }}>
                      {sourceLabel(transcriptSource)}
                    </span>
                  </div>
                  {transcriptSource === 'manual' && (
                    <p className="text-fg-muted text-xs mb-2">
                      字幕も説明文も取得できませんでした。動画の概要を貼り付けるか、空のまま「AI 要約」でタイトル・著者から推測させることもできます。
                    </p>
                  )}
                  {transcriptSource === 'description' && (
                    <p className="text-fg-muted text-xs mb-2">
                      字幕がなかったので動画の説明文を使います。手で編集することもできます。
                    </p>
                  )}
                  <textarea
                    value={transcript}
                    onChange={e => { setTranscript(e.target.value); setTranscriptSource('manual'); }}
                    placeholder="字幕テキストをここに貼り付け、または空のまま「AI 要約」で推測…"
                    rows={7}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                  />
                  <p className="text-fg-subtle text-xs mt-1">{transcript.length.toLocaleString()} 文字</p>
                </div>

                <ApiErrorCard error={error} onRetry={handleSummarize} variant="auto" />

                <div className="flex gap-2">
                  <button
                    onClick={() => { setPhase('input'); setMeta(null); setTranscript(''); }}
                    className="px-4 py-2.5 rounded-xl text-sm"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg-muted)' }}
                  >
                    戻る
                  </button>
                  <motion.button
                    onClick={handleSummarize}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: persona.accentColor, color: '#1F1D26' }}
                    whileTap={{ scale: 0.97 }}
                  >
                    🤖 AI 要約{!transcript.trim() && ' (タイトル推測)'}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ─── Phase: summarizing ─── */}
            {phase === 'summarizing' && (
              <motion.div key="summarizing"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ThinkingIndicator
                  accent={persona.accentColor}
                  variant="full"
                  messages={[
                    '動画の中身を読み込んでいます…',
                    '話している内容を理解しています…',
                    '大事なところを章ごとに分けています…',
                    '要点を 5 行にまとめています…',
                    'そのまま使える引用を選んでいます…',
                  ]}
                  subtitle="動画を見なくても要点が分かるように、AI がまとめています"
                  onRetry={handleSummarize}
                />
              </motion.div>
            )}

            {/* ─── Phase: result ─── */}
            {phase === 'result' && summary && meta && (
              <motion.div key="result" className="flex flex-col gap-4"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

                {/* サムネ + タイトル */}
                <div className="cp-card-section flex gap-3 items-center">
                  <SafeImg src={meta.thumbnailUrl} alt={meta.title}
                    className="w-16 rounded-lg flex-shrink-0" aspectRatio="16/9" errorLabel="読み込み失敗" silent />
                  <div className="min-w-0 flex-1">
                    <p className="text-fg text-sm font-semibold truncate">{meta.title}</p>
                    <p className="text-fg-muted text-xs">{meta.author} · {sourceLabel(transcriptSource)}</p>
                  </div>
                </div>

                {/* 要約 */}
                <div className="cp-card-section">
                  <p className="cp-h3 mb-2">📋 要約</p>
                  <p className="text-fg text-sm leading-relaxed whitespace-pre-wrap">{summary.summary}</p>
                </div>

                {/* 章立て */}
                {summary.chapters.length > 0 && (
                  <div className="cp-card-section">
                    <p className="cp-h3 mb-2">📑 章立て</p>
                    <div className="space-y-3">
                      {summary.chapters.map((ch, i) => (
                        <motion.div key={i}
                          initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}>
                          <p className="text-fg text-sm font-semibold">{ch.title}</p>
                          <p className="text-fg-muted text-xs mt-0.5 leading-relaxed">{ch.content}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 引用 */}
                {summary.quotes.length > 0 && (
                  <div className="cp-card-section">
                    <p className="cp-h3 mb-2">💬 印象的なフレーズ</p>
                    <div className="space-y-1.5">
                      {summary.quotes.map((q, i) => (
                        <p key={i} className="text-fg-muted text-xs pl-3"
                          style={{ borderLeft: `2px solid ${persona.accentColor}60` }}>
                          {q}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* アクション */}
                {summary.actions.length > 0 && (
                  <div className="cp-card-section">
                    <div className="flex items-center justify-between mb-2">
                      <p className="cp-h3">⚡ アクション</p>
                      <button
                        onClick={handleDelegateActions}
                        className="text-xs px-2.5 py-1 rounded-full"
                        style={{ background: 'var(--surface-3)', border: `1px solid ${persona.accentColor}60`, color: persona.accentColor }}
                      >
                        🏢 AI 会社に委任
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {summary.actions.map((a, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-xs mt-0.5" style={{ color: persona.accentColor }}>→</span>
                          <p className="text-fg text-xs">{a}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setPhase('transcript')}
                    className="px-4 py-2.5 rounded-xl text-sm"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg-muted)' }}
                  >
                    戻る
                  </button>
                  <motion.button
                    onClick={handleSave}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: persona.accentColor, color: '#1F1D26' }}
                    whileTap={{ scale: 0.97 }}
                  >
                    📚 ナレッジに保存
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ─── Phase: bulk-running ─── */}
            {phase === 'bulk-running' && (
              <motion.div key="bulk" className="flex flex-col gap-4"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex items-center justify-between">
                  <p className="cp-h3">🎬 一括取込 ({bulkProgress.done}/{bulkProgress.total})</p>
                  {bulkProgress.allFinished && (
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: `${persona.accentColor}20`, color: persona.accentColor }}>
                      ✓ 完了
                    </span>
                  )}
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {bulkRows.map((row, i) => (
                    <div key={i} className="rounded-lg p-2.5 text-xs flex gap-2 items-start"
                      style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
                    >
                      {row.meta?.thumbnailUrl ? (
                        <SafeImg src={row.meta.thumbnailUrl} alt="" className="w-14 rounded flex-shrink-0"
                          aspectRatio="16/9" silent />
                      ) : (
                        <div className="w-14 rounded flex-shrink-0"
                          style={{ aspectRatio: '16/9', background: 'var(--surface)' }} />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-fg text-xs font-semibold line-clamp-1">
                          {row.meta?.title || row.url}
                        </p>
                        <p className="text-fg-muted text-[10px] mt-0.5">
                          {row.meta?.author}
                          {row.source && <> · {sourceLabel(row.source)}</>}
                        </p>
                        <div className="mt-1">
                          {row.status === 'queued' && <span className="text-fg-subtle">⏳ 待機中</span>}
                          {row.status === 'fetching' && <span style={{ color: persona.accentColor }}>📥 取得中…</span>}
                          {row.status === 'summarizing' && <span style={{ color: persona.accentColor }}>🤖 要約中…</span>}
                          {row.status === 'done' && row.summary && (
                            <span className="text-fg-muted line-clamp-1">{row.summary.summary.slice(0, 60)}</span>
                          )}
                          {row.status === 'error' && <span style={{ color: '#f87171' }}>⚠ {row.error}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setPhase('input'); setBulkRows([]); }}
                    className="px-4 py-2.5 rounded-xl text-sm"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg-muted)' }}
                  >
                    戻る
                  </button>
                  <motion.button
                    onClick={handleSaveBulk}
                    disabled={!bulkProgress.allFinished || bulkRows.filter(r => r.status === 'done').length === 0}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                    style={{ background: persona.accentColor, color: '#1F1D26' }}
                    whileTap={{ scale: 0.97 }}
                  >
                    📚 完了分をまとめて保存 ({bulkRows.filter(r => r.status === 'done').length})
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ─── Phase: series ─── */}
            {phase === 'series' && (
              <motion.div key="series" className="flex flex-col gap-4"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex items-center justify-between">
                  <p className="cp-h3">📚 同じ著者の動画</p>
                  <button
                    onClick={() => setPhase('input')}
                    className="text-xs px-2.5 py-1 rounded-full"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                  >
                    ← 取込画面
                  </button>
                </div>
                {seriesGroups.length === 0 ? (
                  <div className="rounded-xl p-5 text-center"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                    <div className="text-3xl mb-2">📚</div>
                    <p className="text-fg-muted text-xs">動画を取込むと、ここに著者ごとのシリーズが溜まります。</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                    {seriesGroups.map(g => (
                      <div key={g.author + (g.authorUrl || '')}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-fg text-sm font-semibold">{g.author}</p>
                          <span className="text-fg-subtle text-xs">{g.videos.length} 本</span>
                        </div>
                        <div className="space-y-1.5">
                          {g.videos.map(v => (
                            <button
                              key={v.videoId}
                              onClick={() => openFromSeries(v)}
                              className="w-full flex gap-2 items-start text-left rounded-lg p-2 transition-colors"
                              style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
                            >
                              <SafeImg src={v.thumbnailUrl} alt="" className="w-16 rounded flex-shrink-0"
                                aspectRatio="16/9" silent />
                              <div className="flex-1 min-w-0">
                                <p className="text-fg text-xs font-semibold line-clamp-2">{v.title}</p>
                                {v.summaryLine && (
                                  <p className="text-fg-muted text-[10px] mt-0.5 line-clamp-1">{v.summaryLine}</p>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ─── Phase: saved ─── */}
            {phase === 'saved' && (
              <motion.div key="saved" className="flex flex-col items-center gap-4 py-10"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <motion.div className="text-5xl"
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300 }}>
                  ✅
                </motion.div>
                <p className="text-fg text-sm font-medium">ナレッジに保存しました</p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
