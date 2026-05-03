import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { Persona, AppSettings, KnowledgeItem } from '../types/identity';
import type { DeckSpec } from '../lib/slideGenerator';
import { generateDeckSpec, renderDeck } from '../lib/slideGenerator';
import { parseFile } from '../lib/fileParser';

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
      setSpec(deck);
      setPhase('render');
      await renderDeck(deck);
      setPhase(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase(null);
    } finally {
      setIsGenerating(false);
    }
  }, [source, audience, goal, slideCount, persona, settings]);

  const handleRedownload = useCallback(async () => {
    if (!spec) return;
    setIsGenerating(true);
    try {
      await renderDeck(spec);
    } finally {
      setIsGenerating(false);
    }
  }, [spec]);

  const personaKnowledge = knowledge.filter(k => k.personaId === persona.id);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col"
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
                    style={{ minHeight: '180px' }}
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
                  />
                </div>
                <div>
                  <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">プレゼンのゴール</label>
                  <input
                    type="text" value={goal} onChange={e => setGoal(e.target.value)}
                    placeholder="例: 投資判断 / 商品理解"
                    className="w-full text-sm rounded-lg px-3 py-2 outline-none bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg"
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

              {error && (
                <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
                  {error}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderTop: '1px solid var(--border)' }}>
              <p className="text-fg-muted text-xs">{persona.name} アクセントカラーで自動デザイン</p>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 text-sm text-fg-muted hover:text-fg">キャンセル</button>
                <motion.button
                  onClick={handleGenerate}
                  disabled={!source.trim()}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                  style={{ background: persona.accentColor, color: '#0a0a0f' }}
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
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <div className="text-center mb-3">
              <p className="text-5xl mb-2">✅</p>
              <p className="text-fg text-xl font-bold">デッキを生成しました</p>
              <p className="text-fg-muted text-sm">{spec.slides.length} 枚のスライドが PPTX としてダウンロードされました</p>
            </div>

            <div
              className="rounded-xl p-4"
              style={{ background: `${persona.accentColor}15`, border: `1px solid ${persona.accentColor}50` }}
            >
              <p className="text-fg text-base font-semibold">{spec.title}</p>
              <p className="text-fg-muted text-sm">{spec.subtitle}</p>
            </div>

            {/* Outline */}
            <div>
              <p className="text-fg-muted text-xs tracking-wider uppercase mb-2">構成プレビュー</p>
              <div className="space-y-1.5">
                {spec.slides.map((sl, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-2.5 rounded-lg"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
                  >
                    <span
                      className="text-xs px-2 py-0.5 rounded font-mono flex-shrink-0"
                      style={{ background: persona.accentColorLight, color: persona.accentColor }}
                    >{String(i + 1).padStart(2, '0')}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-fg text-sm truncate">{sl.title}</p>
                      <p className="text-fg-muted text-xs">
                        {sl.layout}
                        {sl.subtitle && ` · ${sl.subtitle.slice(0, 30)}`}
                        {sl.bullets && ` · ${sl.bullets.length}項目`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => { setSpec(null); }}
                className="px-4 py-2 rounded-lg text-sm bg-surface-3 border-edge border text-fg hover:bg-surface"
              >🔄 別の素材で生成</button>
              <button
                onClick={handleRedownload}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{ background: persona.accentColor, color: '#0a0a0f' }}
              >📥 再ダウンロード</button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
