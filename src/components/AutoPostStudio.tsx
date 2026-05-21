import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ApiErrorCard from './ApiErrorCard';
import { copyText } from '../lib/clipboard';
import type { Persona, AppSettings, KnowledgeItem } from '../types/identity';
import {
  generateNoteArticle, generateXPost, TONE_OPTIONS,
  type SocialDraft, type SocialTone,
} from '../lib/socialDraft';
import {
  isXConfigured, isXConnected, startXAuth, handleXCallbackIfPresent,
  postTweet, postThread, loadXUser, clearXAuth, type XUser,
} from '../lib/xPost';
import {
  generateImage, generateImagePrompt, downloadImage,
  STYLE_OPTIONS, type VisualStyle, type GenerateImageResult, isOpenAIConfigured,
} from '../lib/imageGen';
import ShareArtifactButton from './ShareArtifactButton';

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
  // 長すぎる本文は即時で渡す (体感が遅くなりすぎないように)
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

type Tab = 'note' | 'x';

export default function AutoPostStudio({ persona, settings, knowledge, onClose, onSaveAsKnowledge }: Props) {
  const [tab, setTab] = useState<Tab>('note');
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState<SocialTone>('professional');
  const [customInstr, setCustomInstr] = useState('');
  const [selectedKnowledge, setSelectedKnowledge] = useState<Set<string>>(new Set());
  const [showKbPicker, setShowKbPicker] = useState(false);

  // note 設定
  const [targetWords, setTargetWords] = useState(1500);
  // X 設定
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

  // 画像生成
  const [imgStyle, setImgStyle] = useState<VisualStyle>('editorial');
  const [imgPrompt, setImgPrompt] = useState('');
  const [imgBusy, setImgBusy] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<GenerateImageResult | null>(null);
  const [imgError, setImgError] = useState<string | null>(null);
  const dalleAvailable = isOpenAIConfigured();

  const personaKnowledge = useMemo(
    () => knowledge.filter(k => k.personaId === persona.id),
    [knowledge, persona.id]
  );

  // X コールバック処理 (?code= 付きでこのコンポーネント表示時)
  useEffect(() => {
    handleXCallbackIfPresent().then(user => {
      if (user) {
        setXUser(user);
        setXConnected(true);
      }
    }).catch(e => {
      setError(e instanceof Error ? e.message : String(e));
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) {
      setError('テーマを入力してください');
      return;
    }
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

  const copyToClipboard = useCallback((text: string) => {
    copyText(text, '本文');
  }, []);

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

  // ─── 画像生成 ─────────────────────────────
  const handleGenerateImage = useCallback(async (regenerate = false) => {
    setImgError(null);
    setImgBusy(true);
    try {
      let prompt = imgPrompt.trim();
      if (!prompt) {
        // テキストから自動生成 (note: タイトル+本文先頭, X: 投稿本文)
        const seed = tab === 'note' ? `${editedTitle}\n${editedBody.slice(0, 600)}` : (editedThread[0] || editedBody);
        if (!seed) {
          setImgError('先に下書きを生成するか、画像のテーマを入力してください');
          setImgBusy(false);
          return;
        }
        prompt = await generateImagePrompt({
          settings,
          topic: seed,
          context: `投稿者: ${persona.name} (${persona.subtitle})`,
        });
        setImgPrompt(prompt);
      }
      const result = await generateImage({
        prompt,
        aspect: tab === 'note' ? 'note-hero' : 'x-post',
        style: imgStyle,
        seed: regenerate ? Math.floor(Math.random() * 1_000_000) : undefined,
      });
      setGeneratedImage(result);
    } catch (e) {
      setImgError(e instanceof Error ? e.message : String(e));
    } finally {
      setImgBusy(false);
    }
  }, [imgPrompt, imgStyle, tab, editedTitle, editedBody, editedThread, settings, persona]);

  const handleInsertImageToNote = useCallback(() => {
    if (!generatedImage) return;
    const md = `![${editedTitle || '見出し画像'}](${generatedImage.url})\n\n${editedBody}`;
    setEditedBody(md);
  }, [generatedImage, editedTitle, editedBody]);

  const handleDownloadImage = useCallback(async () => {
    if (!generatedImage) return;
    const ext = generatedImage.url.includes('.png') ? 'png' : 'jpg';
    const name = `${(editedTitle || 'core-prism-image').replace(/[\\/:*?"<>|]/g, '_').slice(0, 50)}-${Date.now()}.${ext}`;
    await downloadImage(generatedImage.url, name);
  }, [generatedImage, editedTitle]);

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
    try {
      await startXAuth();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  const handleXDisconnect = useCallback(() => {
    clearXAuth();
    setXConnected(false);
    setXUser(null);
  }, []);

  const handleXPost = useCallback(async () => {
    setXPosting(true);
    setError(null);
    setXPostResult(null);
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

  const xReady = isXConfigured();

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
              <p className="text-fg-muted text-xs truncate">{persona.name} の口調で note / X の下書きを AI 生成</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface text-xl leading-none"
          >×</button>
        </div>

        {/* Platform Tabs */}
        <div className="flex gap-1 px-5 pt-3" style={{ borderBottom: '1px solid var(--border)' }}>
          {([
            { id: 'note' as Tab, label: '📝 note 記事' },
            { id: 'x' as Tab, label: '🐦 X 投稿' },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setDraft(null); setError(null); }}
              className="text-sm px-4 py-2 rounded-t-md font-medium"
              style={{
                background: tab === t.id ? persona.accentColorLight : 'transparent',
                color: tab === t.id ? persona.accentColor : 'var(--fg-muted)',
                borderBottom: tab === t.id ? `2px solid ${persona.accentColor}` : '2px solid transparent',
              }}
            >{t.label}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* X 認証バー (X タブの時のみ) */}
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
                    className="text-xs px-3 py-1.5 rounded-md font-semibold disabled:opacity-40"
                    style={{ background: '#000000', color: '#FFFFFF' }}
                  >𝕏 で続行</button>
                ) : (
                  <button onClick={handleXDisconnect} className="text-xs px-2 py-1.5 rounded text-fg-muted hover:text-fg">解除</button>
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
                placeholder={tab === 'note' ? '例: 起業1年目で学んだ顧客インタビューの本質' : '例: 今日の経営判断の裏側を1ツイートで'}
                className="w-full text-sm px-3 py-2 rounded bg-surface-3 border-edge border text-fg placeholder:text-fg-subtle outline-none"
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
                    className="text-xs px-3 py-1.5 rounded-md font-medium"
                    style={{
                      background: tone === t.value ? persona.accentColorLight : 'var(--surface-3)',
                      color: tone === t.value ? persona.accentColor : 'var(--fg-muted)',
                      border: `1px solid ${tone === t.value ? persona.accentColor + '50' : 'var(--border)'}`,
                    }}
                  >{t.emoji} {t.label}</button>
                ))}
              </div>
            </div>

            {/* note 文字数 / X スレッド数 */}
            <div className="grid grid-cols-2 gap-2">
              {tab === 'note' ? (
                <div>
                  <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">目標字数</label>
                  <select
                    value={targetWords}
                    onChange={e => setTargetWords(Number(e.target.value))}
                    className="w-full text-sm px-3 py-2 rounded bg-surface-3 border-edge border text-fg"
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
                    className="w-full text-sm px-3 py-2 rounded bg-surface-3 border-edge border text-fg"
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
                  className="w-full text-sm px-3 py-2 rounded text-left flex items-center justify-between"
                  style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                >
                  <span>{selectedKnowledge.size > 0 ? `${selectedKnowledge.size}件選択中` : `選択 (${personaKnowledge.length}件中)`}</span>
                  <span className="text-fg-muted">▾</span>
                </button>
              </div>
            </div>

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
                            style={{ background: sel ? persona.accentColorLight : 'transparent', color: sel ? persona.accentColor : 'var(--fg)' }}
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
                className="w-full text-sm px-3 py-2 rounded bg-surface-3 border-edge border text-fg placeholder:text-fg-subtle outline-none resize-none"
              />
            </div>

            <motion.button
              onClick={handleGenerate}
              disabled={!topic.trim() || isGenerating}
              className="w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{ background: persona.accentColor, color: '#0a0a0f' }}
              whileTap={!isGenerating ? { scale: 0.99 } : {}}
            >
              {isGenerating ? '🧠 生成中…' : `✨ ${tab === 'note' ? 'note 記事' : threadCount > 1 ? 'X スレッド' : 'X ツイート'}を生成`}
            </motion.button>

            <ApiErrorCard
              error={error}
              onRetry={handleGenerate}
              onOpenSettings={() => { window.location.href = '/master'; }}
            />
          </div>

          {/* 画像生成パネル (draft 生成後に表示) */}
          <AnimatePresence>
            {draft && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-xl p-4 space-y-3"
                style={{ background: `${persona.accentColor}10`, border: `1px solid ${persona.accentColor}40` }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-fg text-sm font-semibold">🎨 アイキャッチ画像を生成</p>
                    <p className="text-fg-muted text-[11px] mt-0.5">
                      {tab === 'note' ? 'note 見出し画像 (1280×720)' : 'X 投稿画像 (1200×675)'} ·{' '}
                      <span style={{ color: persona.accentColor }}>{dalleAvailable ? 'DALL-E 3 利用可' : 'Pollinations Flux (無料)'}</span>
                    </p>
                  </div>
                </div>

                {/* スタイル選択 */}
                <div className="flex gap-1.5 flex-wrap">
                  {STYLE_OPTIONS.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setImgStyle(s.value)}
                      className="text-xs px-2.5 py-1.5 rounded-md font-medium"
                      style={{
                        background: imgStyle === s.value ? persona.accentColorLight : 'var(--surface-3)',
                        color: imgStyle === s.value ? persona.accentColor : 'var(--fg-muted)',
                        border: `1px solid ${imgStyle === s.value ? persona.accentColor + '50' : 'var(--border)'}`,
                      }}
                    >{s.emoji} {s.label}</button>
                  ))}
                </div>

                {/* プロンプト (任意。空ならテキストから AI 自動生成) */}
                <div>
                  <label className="block text-fg-muted text-[10px] tracking-wider uppercase mb-1">画像プロンプト (英語、空欄で AI 自動生成)</label>
                  <textarea
                    value={imgPrompt}
                    onChange={e => setImgPrompt(e.target.value)}
                    rows={2}
                    placeholder="A serene mountain landscape at golden hour..."
                    className="w-full text-xs px-2.5 py-1.5 rounded bg-surface-3 border-edge border text-fg placeholder:text-fg-subtle font-mono outline-none resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleGenerateImage(false)}
                    disabled={imgBusy}
                    className="text-sm px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
                    style={{ background: persona.accentColor, color: '#0a0a0f' }}
                  >{imgBusy ? '🎨 生成中…' : generatedImage ? '🔄 再生成' : '✨ 画像を生成'}</button>
                  {generatedImage && (
                    <button
                      onClick={() => handleGenerateImage(true)}
                      disabled={imgBusy}
                      className="text-sm px-3 py-2 rounded-lg text-fg-muted hover:text-fg"
                      style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
                    >🎲 別シード</button>
                  )}
                </div>

                {imgError && (
                  <div className="rounded p-2 text-xs" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>{imgError}</div>
                )}

                <AnimatePresence>
                  {generatedImage && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      className="rounded-lg overflow-hidden"
                      style={{ border: `1px solid ${persona.accentColor}40` }}
                    >
                      <img
                        src={generatedImage.url}
                        alt=""
                        loading="lazy"
                        className="w-full h-auto block"
                        style={{ aspectRatio: `${generatedImage.width}/${generatedImage.height}`, background: '#0a0a0f' }}
                      />
                      <div className="flex flex-wrap gap-2 p-2 justify-end" style={{ background: 'var(--surface-3)' }}>
                        <span className="text-[10px] text-fg-muted mr-auto self-center">
                          {generatedImage.width}×{generatedImage.height} · {generatedImage.provider === 'dalle3' ? 'DALL-E 3' : 'Flux'}
                        </span>
                        <button
                          onClick={handleDownloadImage}
                          className="text-xs px-3 py-1.5 rounded text-fg-muted hover:text-fg"
                          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                        >⬇ ダウンロード</button>
                        {tab === 'note' && (
                          <button
                            onClick={handleInsertImageToNote}
                            className="text-xs px-3 py-1.5 rounded font-semibold"
                            style={{ background: persona.accentColor, color: '#0a0a0f' }}
                          >📝 本文の冒頭に挿入</button>
                        )}
                        {tab === 'x' && (
                          <span className="text-[11px] text-fg-muted self-center">
                            ※ X 投稿時はダウンロードして添付してください
                          </span>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* プレビュー & 編集 */}
          <AnimatePresence>
            {draft && tab === 'note' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--surface-3)', border: `1px solid ${persona.accentColor}40` }}
              >
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <p className="text-fg-muted text-xs tracking-wider uppercase">下書きプレビュー (編集可)</p>
                </div>
                <div className="p-4 space-y-3">
                  <input
                    value={editedTitle}
                    onChange={e => setEditedTitle(e.target.value)}
                    className="w-full text-base font-semibold px-3 py-2 rounded bg-surface-3 border-edge border text-fg outline-none"
                    placeholder="タイトル"
                  />
                  <textarea
                    value={editedBody}
                    onChange={e => setEditedBody(e.target.value)}
                    rows={14}
                    className="w-full text-sm px-3 py-2 rounded bg-surface-3 border-edge border text-fg outline-none font-mono leading-relaxed resize-y"
                    style={{ minHeight: '320px' }}
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
                    className="text-xs px-3 py-1.5 rounded text-fg-muted hover:text-fg"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  >📋 Markdown コピー</button>
                  <button
                    onClick={handleNoteDownload}
                    className="text-xs px-3 py-1.5 rounded text-fg-muted hover:text-fg"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  >⬇ .md ダウンロード</button>
                  {onSaveAsKnowledge && (
                    <button
                      onClick={handleSaveKb}
                      className="text-xs px-3 py-1.5 rounded text-fg-muted hover:text-fg"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
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
                      imageUrl: generatedImage?.url,
                      createdBy: persona.name,
                      source: 'prism',
                      createdAt: new Date().toISOString(),
                    }}
                  />
                  <button
                    onClick={handleNoteOpen}
                    className="text-xs px-4 py-1.5 rounded font-semibold"
                    style={{ background: '#41C9B4', color: '#000000' }}
                  >📝 note を開いて貼り付け →</button>
                </div>
                <div className="px-4 py-2 text-[11px] text-fg-muted" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
                  💡 note は公式 API を提供していないため、自動でクリップボードにコピー → 新規記事ページを新タブで開きます。Cmd/Ctrl+V で貼り付けてください。
                </div>
              </motion.div>
            )}

            {draft && tab === 'x' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--surface-3)', border: `1px solid ${persona.accentColor}40` }}
              >
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
                          className="w-full text-sm px-2 py-1.5 rounded bg-surface-3 border-edge border text-fg outline-none resize-none leading-relaxed"
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
                        className="w-full text-sm px-3 py-2 rounded bg-surface-3 border-edge border text-fg outline-none resize-y leading-relaxed"
                        style={{ minHeight: '120px' }}
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
                    className="text-xs px-3 py-1.5 rounded text-fg-muted hover:text-fg"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  >📋 コピー</button>
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
                      imageUrl: generatedImage?.url,
                      createdBy: persona.name,
                      source: 'prism',
                      createdAt: new Date().toISOString(),
                    }}
                  />
                  {onSaveAsKnowledge && (
                    <button
                      onClick={handleSaveKb}
                      className="text-xs px-3 py-1.5 rounded text-fg-muted hover:text-fg"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                    >📚 ナレッジに保存</button>
                  )}
                  {!xConnected && (
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(editedBody)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs px-3 py-1.5 rounded text-fg-muted hover:text-fg"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                    >🌐 X で開く</a>
                  )}
                  <button
                    onClick={handleXPost}
                    disabled={!xConnected || xPosting}
                    className="text-xs px-4 py-1.5 rounded font-semibold disabled:opacity-40"
                    style={{ background: '#000000', color: '#FFFFFF' }}
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
                {!xConnected && (
                  <div className="px-4 py-2 text-[11px] text-fg-muted" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
                    💡 X に接続するとこのアプリから直接投稿できます。未接続の場合は「X で開く」で投稿画面を起動してください。
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
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
