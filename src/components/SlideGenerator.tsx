import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { Persona, AppSettings, KnowledgeItem } from '../types/identity';
import type { DeckSpec, DeckTheme } from '../lib/slideGenerator';
import { generateDeckSpec, renderDeck, DECK_THEMES, getPreviewPalette, deckToMarkdown } from '../lib/slideGenerator';
import { parseFile } from '../lib/fileParser';
import { copyText } from '../lib/clipboard';
import ApiErrorCard from './ApiErrorCard';
import { StudioIntro } from './StudioIntro';

interface Props {
  persona: Persona;
  settings: AppSettings;
  knowledge: KnowledgeItem[];
  onClose: () => void;
}

type SourceMode = 'paste' | 'file' | 'knowledge';

export default function SlideGeneratorModal({ persona, settings, knowledge, onClose }: Props) {
  const [mode, setMode] = useState<SourceMode>('paste');
  const [source, setSource] = useState('');
  const [selectedKnowledge, setSelectedKnowledge] = useState<string | null>(null);
  const [audience, setAudience] = useState('');
  const [goal, setGoal] = useState('');
  const [slideCount, setSlideCount] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [phase, setPhase] = useState<'design' | 'render' | null>(null);
  const [spec, setSpec] = useState<DeckSpec | null>(null);
  const [theme, setTheme] = useState<DeckTheme>('dark');
  const [previewIdx, setPreviewIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    try {
      const r = await parseFile(file);
      setSource(r.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleKnowledgeSelect = useCallback((id: string) => {
    setSelectedKnowledge(id);
    const item = knowledge.find(k => k.id === id);
    if (item) {
      const analysisText = item.analysis
        ? `\n\n## 分析結果\n要約: ${item.analysis.summary}\n戦略: ${item.analysis.strategy.join(' / ')}\n洞察: ${item.analysis.insights.join(' / ')}\nアクション: ${item.analysis.actions.join(' / ')}`
        : '';
      setSource(`# ${item.title}\n\n${item.content}${analysisText}`);
    }
  }, [knowledge]);

  const handleGenerate = useCallback(async () => {
    if (!source.trim()) {
      setError('ソース素材を入力してください');
      return;
    }
    setError(null);
    setIsGenerating(true);
    setPhase('design');
    try {
      const deck = await generateDeckSpec(settings, persona, {
        source,
        audience: audience || undefined,
        goal: goal || undefined,
        slideCount,
      });
      const themed: DeckSpec = { ...deck, theme };
      setSpec(themed);
      setPreviewIdx(0);
      setPhase(null);   // 自動 PPTX ダウンロードはやめ、プレビューを先に出す
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase(null);
    } finally {
      setIsGenerating(false);
    }
  }, [source, audience, goal, slideCount, persona, settings, theme]);

  const handleDownloadPptx = useCallback(async () => {
    if (!spec) return;
    setIsGenerating(true);
    setPhase('render');
    try {
      await renderDeck({ ...spec, theme });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
      setPhase(null);
    }
  }, [spec, theme]);

  const handleDownloadJson = useCallback(() => {
    if (!spec) return;
    const blob = new Blob([JSON.stringify({ ...spec, theme }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${spec.title.replace(/[\\/:*?"<>|]/g, '_')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, [spec, theme]);

  const handleDownloadMarkdown = useCallback(() => {
    if (!spec) return;
    const md = deckToMarkdown({ ...spec, theme });
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${spec.title.replace(/[\\/:*?"<>|]/g, '_')}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, [spec, theme]);

  const handleCopyMarkdown = useCallback(() => {
    if (!spec) return;
    copyText(deckToMarkdown({ ...spec, theme }), 'スライド構成 (Markdown)');
  }, [spec, theme]);

  const personaKnowledge = knowledge.filter(k => k.personaId === persona.id);

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
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: persona.accentColorLight, color: persona.accentColor }}
            >🎨</div>
            <div className="min-w-0">
              <p className="text-fg text-lg font-semibold leading-tight truncate">スライド生成 AI</p>
              <p className="text-fg-muted text-xs">{persona.name} 視点でデッキを自動設計</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface text-xl leading-none"
          >×</button>
        </div>

        {!spec && !isGenerating && (
          <div className="flex-1 overflow-y-auto">
            {/* Source mode */}
            <div className="flex gap-1.5 p-3" style={{ borderBottom: '1px solid var(--border)' }}>
              {([
                ['paste',     '📝 テキスト'],
                ['file',      '📂 ファイル'],
                ['knowledge', `📚 ナレッジ (${personaKnowledge.length})`],
              ] as [SourceMode, string][]).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => { setMode(id); setSource(''); setSelectedKnowledge(null); }}
                  className="text-sm px-4 py-2 rounded-lg font-medium transition-all"
                  style={{
                    background: mode === id ? persona.accentColorLight : 'var(--surface-3)',
                    color: mode === id ? persona.accentColor : 'var(--fg-muted)',
                    border: `1px solid ${mode === id ? persona.accentColor + '50' : 'var(--border)'}`,
                  }}
                >{label}</button>
              ))}
            </div>

            <div className="p-5 space-y-4">
              <StudioIntro
                id="slide"
                accent={persona.accentColor}
                emoji="🪄"
                what="メモや議事録を貼り付けるだけで、AI がプレゼン用のスライド構成を一気に作る画面です。"
                tryThis="下の枠にスライド化したい文章を貼って「✨ スライド生成」を押します。"
                example="5 行の事業メモ → タイトル・章立て付きで 8 枚のスライド構成が完成。"
                sampleLabel="こんなスライドが出ます"
                samplePreview={
                  <div style={{ position: 'relative', width: 150, height: 92 }} aria-label="スライドのサンプル">
                    {/* 後ろに重なる束 */}
                    <div style={{ position: 'absolute', left: 10, top: 8, width: 130, height: 74, background: '#1e293b', borderRadius: 4, opacity: 0.35 }} />
                    <div style={{ position: 'absolute', left: 5, top: 4, width: 130, height: 74, background: '#334155', borderRadius: 4, opacity: 0.55 }} />
                    {/* 一番上の表紙スライド */}
                    <div
                      style={{
                        position: 'absolute', left: 0, top: 0, width: 130, height: 74,
                        background: `linear-gradient(135deg, #0f172a 60%, ${persona.accentColor})`,
                        color: '#fff', borderRadius: 4, padding: '9px 10px',
                        boxShadow: 'var(--cp-elev-3)', overflow: 'hidden',
                      }}
                    >
                      <div style={{ width: 18, height: 3, background: persona.accentColor, borderRadius: 2, marginBottom: 6 }} />
                      <div style={{ fontSize: 10, fontWeight: 800, lineHeight: 1.2 }}>新規事業<br />提案</div>
                      <div style={{ fontSize: 6, opacity: 0.7, marginTop: 5 }}>市場 / 戦略 / 数字</div>
                      <div style={{ position: 'absolute', right: 7, bottom: 6, fontSize: 5.5, opacity: 0.6 }}>1 / 8</div>
                    </div>
                  </div>
                }
              />
              {/* Source UI */}
              {mode === 'paste' && (
                <div>
                  <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">
                    ソース素材 {source && `(${source.length}文字)`}
                  </label>
                  <textarea
                    value={source}
                    onChange={e => setSource(e.target.value)}
                    placeholder="プレゼン化したい内容・メモ・記事・議事録などを貼り付け..."
                    className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-y bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg"
                    style={{ minHeight: '180px', fontSize: 16 }}
                  />
                </div>
              )}

              {mode === 'file' && (
                <div
                  className="rounded-xl p-6 text-center cursor-pointer"
                  style={{ background: 'var(--surface-3)', border: '2px dashed var(--border)' }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                >
                  <p className="text-3xl mb-2">📂</p>
                  <p className="text-fg text-base mb-1">ドロップ or クリックでアップロード</p>
                  <p className="text-fg-muted text-xs">PDF / Word / PowerPoint / Excel / テキスト系 / 画像</p>
                  {source && (
                    <p className="text-xs mt-3" style={{ color: persona.accentColor }}>
                      ✓ {source.length}文字を読み込み済み
                    </p>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.pptx,.xlsx,.csv,.txt,.md,.html,.json"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                </div>
              )}

              {mode === 'knowledge' && (
                <div>
                  <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">
                    ナレッジから選択
                  </label>
                  {personaKnowledge.length === 0 ? (
                    <p className="text-fg-muted text-sm py-4 text-center">この人格にはまだ資料がありません</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {personaKnowledge.map(k => (
                        <button
                          key={k.id}
                          onClick={() => handleKnowledgeSelect(k.id)}
                          className="w-full text-left p-2.5 rounded-lg transition-all flex items-start gap-2"
                          style={{
                            background: selectedKnowledge === k.id ? persona.accentColorLight : 'var(--surface-3)',
                            border: `1px solid ${selectedKnowledge === k.id ? persona.accentColor : 'var(--border)'}`,
                          }}
                        >
                          <span className="text-sm flex-shrink-0">{k.fileKind === 'pdf' ? '📕' : k.fileKind === 'pptx' ? '📊' : k.fileKind === 'docx' ? '📝' : '📄'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-fg text-sm truncate">{k.title}</p>
                            <p className="text-fg-muted text-xs truncate">{k.chunks.length}チャンク · {k.tags.join(', ')}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Audience + Goal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">想定オーディエンス</label>
                  <input
                    type="text" value={audience} onChange={e => setAudience(e.target.value)}
                    placeholder="例: VC / 経営層 / 一般顧客"
                    className="w-full text-sm rounded-lg px-3 py-2 outline-none bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg"
                    style={{ fontSize: 16 }}
                  />
                </div>
                <div>
                  <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">プレゼンのゴール</label>
                  <input
                    type="text" value={goal} onChange={e => setGoal(e.target.value)}
                    placeholder="例: 投資判断 / 商品理解"
                    className="w-full text-sm rounded-lg px-3 py-2 outline-none bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg"
                    style={{ fontSize: 16 }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">
                  スライド枚数: {slideCount} 枚
                </label>
                <input
                  type="range" min={6} max={16} value={slideCount}
                  onChange={e => setSlideCount(Number(e.target.value))}
                  className="w-full" style={{ accentColor: persona.accentColor }}
                />
              </div>

              <div>
                <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">
                  テーマ (見た目)
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(Object.keys(DECK_THEMES) as DeckTheme[]).map(t => {
                    const meta = DECK_THEMES[t];
                    const active = theme === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTheme(t)}
                        className="rounded-lg p-2 text-center transition-all"
                        style={{
                          background: active ? persona.accentColorLight : 'var(--surface-3)',
                          border: `2px solid ${active ? persona.accentColor : 'var(--border)'}`,
                          minHeight: 56,
                        }}
                      >
                        <div
                          className="w-full rounded mb-1"
                          style={{ background: meta.preview, height: 14, border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                        <p className="text-[11px] font-medium" style={{ color: active ? persona.accentColor : 'var(--fg-muted)' }}>
                          {meta.emoji} {meta.label}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <ApiErrorCard error={error} onRetry={handleGenerate} />
            </div>

            <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderTop: '1px solid var(--border)' }}>
              <p className="text-fg-muted text-xs">{persona.name} アクセントカラーで自動デザイン</p>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 text-sm text-fg-muted hover:text-fg">キャンセル</button>
                <motion.button
                  onClick={handleGenerate}
                  disabled={!source.trim()}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                  style={{ background: persona.accentColor, color: '#0a0a0f', minHeight: 48 }}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                >✨ デッキを生成</motion.button>
              </div>
            </div>
          </div>
        )}

        {isGenerating && (
          <div className="flex-1 flex items-center justify-center p-10">
            <div className="text-center">
              <motion.div
                className="text-5xl mb-4"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >{phase === 'design' ? '🧠' : '🎨'}</motion.div>
              <p className="text-fg text-lg font-semibold mb-1">
                {phase === 'design' ? 'AI が構成を設計中...' : 'スライドをレンダリング中...'}
              </p>
              <p className="text-fg-muted text-sm">
                {phase === 'design' ? 'タイトル・流れ・各スライドのレイアウトを最適化' : 'PPTX ファイルを生成しています'}
              </p>
            </div>
          </div>
        )}

        {spec && !isGenerating && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <p className="text-fg text-lg font-bold truncate">{spec.title}</p>
                <p className="text-fg-muted text-xs">{spec.subtitle} · {spec.slides.length} 枚</p>
              </div>
              {/* テーマ切替 (生成後にも変更可) */}
              <div className="flex gap-1 flex-wrap">
                {(Object.keys(DECK_THEMES) as DeckTheme[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className="text-xs px-2.5 py-1.5 rounded-md transition-all"
                    style={{
                      background: theme === t ? persona.accentColorLight : 'var(--surface-3)',
                      color: theme === t ? persona.accentColor : 'var(--fg-muted)',
                      border: `1px solid ${theme === t ? persona.accentColor : 'var(--border)'}`,
                      minHeight: 32,
                    }}
                  >{DECK_THEMES[t].emoji} {DECK_THEMES[t].label}</button>
                ))}
              </div>
            </div>

            {/* React プレビュー (1 枚の拡大) */}
            <SlidePreviewLarge spec={{ ...spec, theme }} idx={previewIdx} />

            {/* サムネ一覧 (横スクロール) */}
            <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollSnapType: 'x mandatory' }}>
              {spec.slides.map((sl, i) => (
                <SlideThumb
                  key={i}
                  spec={{ ...spec, theme }}
                  slide={sl}
                  idx={i}
                  active={previewIdx === i}
                  onClick={() => setPreviewIdx(i)}
                />
              ))}
            </div>

            {/* 4 種エクスポート + 再生成 */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <button
                onClick={handleDownloadPptx}
                className="px-3 py-3 rounded-lg text-sm font-semibold transition-all col-span-2 sm:col-span-1"
                style={{ background: persona.accentColor, color: '#0a0a0f', minHeight: 56 }}
              >📥 .pptx</button>
              <button
                onClick={handleDownloadMarkdown}
                className="px-3 py-3 rounded-lg text-sm transition-all bg-surface-3 border-edge border text-fg hover:bg-surface"
                style={{ minHeight: 56 }}
              >📝 .md</button>
              <button
                onClick={handleCopyMarkdown}
                className="px-3 py-3 rounded-lg text-sm transition-all bg-surface-3 border-edge border text-fg hover:bg-surface"
                style={{ minHeight: 56 }}
              >📋 MD コピー</button>
              <button
                onClick={handleDownloadJson}
                className="px-3 py-3 rounded-lg text-sm transition-all bg-surface-3 border-edge border text-fg hover:bg-surface"
                style={{ minHeight: 56 }}
              >🧬 JSON</button>
              <button
                onClick={() => { setSpec(null); setPreviewIdx(0); }}
                className="px-3 py-3 rounded-lg text-sm transition-all bg-surface-3 border-edge border text-fg-muted hover:bg-surface"
                style={{ minHeight: 56 }}
              >🔄 別の素材</button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── スライドの React プレビュー (テキストのみ、画像なし) ──
function SlidePreviewLarge({ spec, idx }: { spec: DeckSpec; idx: number }) {
  const sl = spec.slides[idx];
  if (!sl) return null;
  const p = getPreviewPalette(spec.theme || 'dark', spec.accentColor);
  const isLight = ['light', 'minimal'].includes(spec.theme || 'dark');

  return (
    <div
      className="w-full rounded-xl overflow-hidden relative"
      style={{
        background: p.bg,
        aspectRatio: '16 / 9',
        border: `1px solid ${p.border}`,
        boxShadow: isLight ? '0 2px 12px rgba(0,0,0,0.08)' : '0 4px 24px rgba(0,0,0,0.4)',
      }}
    >
      {sl.layout === 'cover' && (
        <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-center">
          <p className="text-[10px] sm:text-xs font-bold tracking-[0.3em] mb-2" style={{ color: p.primary }}>
            {spec.author.toUpperCase()}
          </p>
          <h2 className="font-bold leading-tight" style={{ color: p.fg, fontSize: 'clamp(20px, 4vw, 40px)' }}>
            {sl.title}
          </h2>
          {sl.subtitle && (
            <p className="mt-3 text-sm sm:text-base" style={{ color: p.primary2 }}>{sl.subtitle}</p>
          )}
          {sl.body && (
            <p className="mt-2 text-xs sm:text-sm" style={{ color: p.muted }}>{sl.body}</p>
          )}
        </div>
      )}

      {sl.layout === 'section' && (
        <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-center" style={{ background: p.bg2 }}>
          {sl.emoji && <p style={{ fontSize: 'clamp(40px, 8vw, 72px)', color: p.primary }}>{sl.emoji}</p>}
          <div className="w-16 h-0.5 my-3" style={{ background: p.primary }} />
          <p className="text-xs font-bold tracking-[0.2em] mb-1" style={{ color: p.primary }}>
            {sl.subtitle || 'SECTION'}
          </p>
          <h2 className="font-bold leading-tight" style={{ color: p.fg, fontSize: 'clamp(20px, 4vw, 36px)' }}>
            {sl.title}
          </h2>
        </div>
      )}

      {sl.layout === 'quote' && (
        <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-center">
          <p style={{ color: p.primary, fontFamily: 'Georgia, serif', fontSize: 'clamp(48px, 9vw, 96px)', lineHeight: 1, opacity: 0.6 }}>"</p>
          <p className="italic" style={{ color: p.fg, fontSize: 'clamp(16px, 2.8vw, 24px)' }}>{sl.title}</p>
          {sl.subtitle && <p className="mt-3 text-xs sm:text-sm" style={{ color: p.muted }}>— {sl.subtitle}</p>}
        </div>
      )}

      {sl.layout === 'closing' && (
        <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-center">
          <p className="text-[10px] sm:text-xs font-bold tracking-[0.3em] mb-2" style={{ color: p.primary }}>
            {sl.subtitle || 'THANK YOU'}
          </p>
          <h2 className="font-bold leading-tight" style={{ color: p.fg, fontSize: 'clamp(22px, 4.5vw, 44px)' }}>
            {sl.title}
          </h2>
          {sl.body && <p className="mt-3 text-xs sm:text-sm" style={{ color: p.fg2 }}>{sl.body}</p>}
          <p className="mt-6 text-[10px] tracking-[0.2em]" style={{ color: p.subtle }}>{spec.author}</p>
        </div>
      )}

      {(sl.layout === 'agenda' || sl.layout === 'bullets') && (
        <SlideContent spec={spec} sl={sl} idx={idx} p={p} kind={sl.layout === 'agenda' ? 'agenda' : 'bullets'} />
      )}

      {sl.layout === 'twoColumn' && (
        <SlideContent spec={spec} sl={sl} idx={idx} p={p} kind="cols2" />
      )}
      {sl.layout === 'three' && (
        <SlideContent spec={spec} sl={sl} idx={idx} p={p} kind="cols3" />
      )}

      {/* ページ番号 (cover/section/closing/quote は非表示) */}
      {sl.layout !== 'cover' && sl.layout !== 'section' && sl.layout !== 'closing' && sl.layout !== 'quote' && (
        <p
          className="absolute bottom-2 right-3 text-[10px] font-mono"
          style={{ color: p.subtle }}
        >
          {String(idx + 1).padStart(2, '0')} / {String(spec.slides.length).padStart(2, '0')}
        </p>
      )}
    </div>
  );
}

function SlideContent({ spec, sl, idx, p, kind }: {
  spec: DeckSpec; sl: import('../lib/slideGenerator').SlideSpec; idx: number; p: Record<string, string>;
  kind: 'bullets' | 'agenda' | 'cols2' | 'cols3';
}) {
  return (
    <div className="absolute inset-0 p-4 sm:p-6 flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-start gap-2 mb-2">
        <div
          className="flex items-center justify-center font-bold text-[11px] sm:text-sm rounded-sm flex-shrink-0"
          style={{ width: 28, height: 28, background: p.primary, color: p.bg }}
        >{String(idx + 1).padStart(2, '0')}</div>
        <div className="min-w-0 flex-1">
          {sl.subtitle && (
            <p className="text-[9px] sm:text-[11px] tracking-[0.2em] uppercase" style={{ color: p.primary2 }}>{sl.subtitle}</p>
          )}
          <h3 className="font-bold leading-tight truncate" style={{ color: p.fg, fontSize: 'clamp(14px, 2.4vw, 22px)' }}>{sl.title}</h3>
        </div>
      </div>
      {sl.body && (
        <p className="text-[10px] sm:text-xs mb-2" style={{ color: p.fg2 }}>{sl.body}</p>
      )}

      {/* 中身 */}
      {(kind === 'bullets' || kind === 'agenda') && sl.bullets && (
        <div className="flex-1 overflow-hidden space-y-1">
          {sl.bullets.slice(0, 7).map((b, i) => (
            <div key={i} className="flex items-start gap-1.5">
              {kind === 'agenda' ? (
                <span className="font-bold flex-shrink-0" style={{ color: p.primary, fontSize: 'clamp(10px, 1.6vw, 14px)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
              ) : (
                <span className="flex-shrink-0 mt-1" style={{ width: 3, height: 14, background: p.primary }} />
              )}
              <p style={{ color: p.fg, fontSize: 'clamp(10px, 1.6vw, 14px)', lineHeight: 1.5 }}>{b}</p>
            </div>
          ))}
        </div>
      )}

      {kind === 'cols2' && sl.columns && (
        <div className="grid grid-cols-2 gap-2 flex-1 overflow-hidden">
          {sl.columns.slice(0, 2).map((c, i) => (
            <div key={i} className="p-2 rounded relative" style={{ background: p.card, border: `1px solid ${p.border}` }}>
              <span className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: p.primary }} />
              <p className="font-bold text-[11px] sm:text-sm mb-1" style={{ color: p.fg }}>{c.heading}</p>
              <p className="text-[9px] sm:text-xs leading-relaxed" style={{ color: p.fg2 }}>{c.body.slice(0, 200)}</p>
            </div>
          ))}
        </div>
      )}

      {kind === 'cols3' && sl.columns && (
        <div className="grid grid-cols-3 gap-1.5 flex-1 overflow-hidden">
          {sl.columns.slice(0, 3).map((c, i) => (
            <div key={i} className="p-1.5 rounded relative" style={{ background: p.card, border: `1px solid ${p.border}` }}>
              <span className="absolute top-0 left-0 right-0 h-0.5" style={{ background: p.primary }} />
              <p className="font-bold text-[10px] sm:text-xs mb-0.5" style={{ color: p.fg }}>{c.heading}</p>
              <p className="text-[8px] sm:text-[10px] leading-snug" style={{ color: p.fg2 }}>{c.body.slice(0, 150)}</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-[8px] sm:text-[9px] mt-1" style={{ color: p.subtle }}>
        {String(idx + 1).padStart(2, '0')} / {String(spec.slides.length).padStart(2, '0')}
      </p>
    </div>
  );
}

function SlideThumb({ spec, slide, idx, active, onClick }: {
  spec: DeckSpec; slide: import('../lib/slideGenerator').SlideSpec; idx: number;
  active: boolean; onClick: () => void;
}) {
  const p = getPreviewPalette(spec.theme || 'dark', spec.accentColor);
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 rounded-md overflow-hidden relative transition-all"
      style={{
        width: 120,
        aspectRatio: '16 / 9',
        background: p.bg,
        border: `2px solid ${active ? p.primary : p.border}`,
        scrollSnapAlign: 'start',
      }}
    >
      <div className="absolute inset-0 p-1.5 flex flex-col justify-between">
        <p
          className="font-bold leading-tight text-left"
          style={{ color: p.fg, fontSize: 9 }}
        >{slide.title.slice(0, 24)}</p>
        <div className="flex items-center justify-between">
          <span className="text-[8px]" style={{ color: p.muted }}>{slide.layout}</span>
          <span className="text-[8px] font-mono" style={{ color: p.primary }}>{String(idx + 1).padStart(2, '0')}</span>
        </div>
      </div>
    </button>
  );
}
