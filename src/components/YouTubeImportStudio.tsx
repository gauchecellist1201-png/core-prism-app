import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Persona, AppSettings } from '../types/identity';
import { fetchOEmbed, fetchTranscript, summarizeWithClaude, type VideoMeta, type YouTubeSummary } from '../lib/youtubeImport';

interface Props {
  persona: Persona;
  settings: AppSettings;
  onClose: () => void;
  onSaveAsKnowledge: (title: string, content: string) => void;
}

type Phase = 'input' | 'meta' | 'transcript' | 'summarizing' | 'result' | 'saved';

export default function YouTubeImportStudio({ persona, settings, onClose, onSaveAsKnowledge }: Props) {
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [transcript, setTranscript] = useState('');
  const [transcriptAuto, setTranscriptAuto] = useState(false);
  const [summary, setSummary] = useState<YouTubeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);

  // Step 1: URLからメタデータ取得
  const handleFetchMeta = useCallback(async () => {
    if (!url.trim()) return;
    setLoadingMeta(true);
    setError(null);
    try {
      const m = await fetchOEmbed(url.trim());
      setMeta(m);
      setPhase('transcript');
      // 字幕自動取得を試みる
      const auto = await fetchTranscript(m.videoId);
      if (auto) {
        setTranscript(auto);
        setTranscriptAuto(true);
      } else {
        setTranscriptAuto(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'メタデータ取得に失敗しました');
    } finally {
      setLoadingMeta(false);
    }
  }, [url]);

  // Step 2: Claude で要約
  const handleSummarize = useCallback(async () => {
    if (!meta || !transcript.trim()) {
      setError('字幕・テキストを入力してください');
      return;
    }
    setPhase('summarizing');
    setError(null);
    try {
      const result = await summarizeWithClaude(settings, transcript, meta);
      setSummary(result);
      setPhase('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 要約に失敗しました');
      setPhase('transcript');
    }
  }, [meta, transcript, settings]);

  // Step 3: ナレッジに保存
  const handleSave = useCallback(() => {
    if (!meta || !summary) return;
    const lines: string[] = [
      `# ${meta.title}`,
      `チャンネル: ${meta.author}`,
      `URL: ${meta.url}`,
      '',
      '## 要約',
      summary.summary,
      '',
    ];
    if (summary.chapters.length > 0) {
      lines.push('## 章立て');
      for (const ch of summary.chapters) {
        lines.push(`### ${ch.title}`);
        lines.push(ch.content);
        lines.push('');
      }
    }
    if (summary.quotes.length > 0) {
      lines.push('## 印象的なフレーズ');
      for (const q of summary.quotes) lines.push(`- ${q}`);
      lines.push('');
    }
    if (summary.actions.length > 0) {
      lines.push('## アクション');
      for (const a of summary.actions) lines.push(`- ${a}`);
      lines.push('');
    }
    if (transcript) {
      lines.push('## 字幕 / 原文テキスト');
      lines.push(transcript.slice(0, 8000));
    }
    onSaveAsKnowledge(`🎬 ${meta.title}`, lines.join('\n'));
    setPhase('saved');
    setTimeout(onClose, 1600);
  }, [meta, summary, transcript, onSaveAsKnowledge, onClose]);

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
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-fg-muted hover:text-fg text-lg leading-none transition-colors"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="cp-modal-body cp-stack" style={{ gap: '16px' }}>

          <AnimatePresence mode="wait">

            {/* ─── Phase: input ─── */}
            {phase === 'input' && (
              <motion.div key="input" className="flex flex-col gap-4"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div>
                  <p className="cp-h3 mb-2">YouTube URL</p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleFetchMeta()}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
                      style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                      autoFocus
                    />
                    <motion.button
                      onClick={handleFetchMeta}
                      disabled={!url.trim() || loadingMeta}
                      className="px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 whitespace-nowrap"
                      style={{ background: persona.accentColor, color: '#1F1D26' }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {loadingMeta ? '取得中…' : '取得'}
                    </motion.button>
                  </div>
                </div>
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <p className="text-fg-subtle text-xs">対応: youtube.com/watch?v=… / youtu.be/… / /shorts/…</p>
              </motion.div>
            )}

            {/* ─── Phase: transcript (字幕入力) ─── */}
            {phase === 'transcript' && meta && (
              <motion.div key="transcript" className="flex flex-col gap-4"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

                {/* サムネ + メタ */}
                <div className="cp-card-section flex gap-3 items-start">
                  <img
                    src={meta.thumbnailUrl}
                    alt={meta.title}
                    className="w-28 rounded-lg flex-shrink-0 object-cover"
                    style={{ aspectRatio: '16/9' }}
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
                    {transcriptAuto && (
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: `${persona.accentColor}20`, color: persona.accentColor }}>
                        ✓ 自動取得
                      </span>
                    )}
                  </div>
                  {!transcriptAuto && (
                    <p className="text-fg-muted text-xs mb-2">
                      字幕の自動取得ができませんでした。動画の字幕をコピーして貼り付けてください。
                    </p>
                  )}
                  <textarea
                    value={transcript}
                    onChange={e => setTranscript(e.target.value)}
                    placeholder="字幕テキストをここに貼り付けてください…"
                    rows={7}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                  />
                  <p className="text-fg-subtle text-xs mt-1">{transcript.length.toLocaleString()} 文字</p>
                </div>

                {error && <p className="text-red-400 text-xs">{error}</p>}

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
                    disabled={!transcript.trim()}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                    style={{ background: persona.accentColor, color: '#1F1D26' }}
                    whileTap={{ scale: 0.97 }}
                  >
                    🤖 AI 要約
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ─── Phase: summarizing ─── */}
            {phase === 'summarizing' && (
              <motion.div key="summarizing" className="flex flex-col items-center gap-4 py-10"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.div className="text-5xl"
                  animate={{ rotate: [0, 8, -8, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}>
                  🤖
                </motion.div>
                <p className="text-fg-muted text-sm">AI が要約・章立て・引用を生成中…</p>
              </motion.div>
            )}

            {/* ─── Phase: result ─── */}
            {phase === 'result' && summary && meta && (
              <motion.div key="result" className="flex flex-col gap-4"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

                {/* サムネ + タイトル */}
                <div className="cp-card-section flex gap-3 items-center">
                  <img src={meta.thumbnailUrl} alt={meta.title}
                    className="w-16 rounded-lg flex-shrink-0 object-cover" style={{ aspectRatio: '16/9' }} />
                  <div className="min-w-0">
                    <p className="text-fg text-sm font-semibold truncate">{meta.title}</p>
                    <p className="text-fg-muted text-xs">{meta.author}</p>
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
                    <p className="cp-h3 mb-2">⚡ アクション</p>
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
