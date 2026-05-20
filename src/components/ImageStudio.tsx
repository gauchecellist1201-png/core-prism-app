import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import ApiErrorCard from './ApiErrorCard';
import { StudioIntro } from './StudioIntro';
import { copyText } from '../lib/clipboard';
import type { Persona, AppSettings } from '../types/identity';
import {
  generateImage, generateImagePrompt, downloadImage,
  STYLE_OPTIONS, ASPECTS, isOpenAIConfigured,
  type VisualStyle, type ImageAspect, type ImageProvider, type GenerateImageResult,
} from '../lib/imageGen';

interface Props {
  persona: Persona;
  settings: AppSettings;
  onClose: () => void;
  onSaveAsKnowledge?: (title: string, content: string) => void;
}

interface HistoryItem {
  id: string;
  url: string;
  prompt: string;
  aspect: ImageAspect;
  style: VisualStyle;
  width: number;
  height: number;
  provider: ImageProvider;
  generatedAt: string;
}

const HISTORY_KEY = 'core_image_history_v1';
const MAX_HISTORY = 30;

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveHistory(items: HistoryItem[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY))); } catch { /* quota */ }
}

const ASPECT_GROUPS: { id: 'social' | 'free' | 'doc'; label: string; emoji: string }[] = [
  { id: 'social', label: 'SNS / Web', emoji: '🌐' },
  { id: 'free',   label: '汎用',     emoji: '⬜' },
  { id: 'doc',    label: '印刷',     emoji: '📄' },
];

export default function ImageStudio({ persona, settings, onClose, onSaveAsKnowledge }: Props) {
  const [tab, setTab] = useState<'create' | 'history'>('create');
  const [topic, setTopic] = useState('');                       // 日本語の自然なテーマ
  const [advancedPrompt, setAdvancedPrompt] = useState('');     // 英語の詳細プロンプト
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [aspect, setAspect] = useState<ImageAspect>('note-hero');
  const [aspectGroup, setAspectGroup] = useState<'social' | 'free' | 'doc'>('social');
  const [style, setStyle] = useState<VisualStyle>('editorial');
  const [provider, setProvider] = useState<ImageProvider>(isOpenAIConfigured() ? 'dalle3' : 'pollinations');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'prompt' | 'render' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<GenerateImageResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory());
  const [batchCount, setBatchCount] = useState<1 | 2 | 4>(1);
  const [batchResults, setBatchResults] = useState<GenerateImageResult[]>([]);

  useEffect(() => { saveHistory(history); }, [history]);

  const dalleAvailable = isOpenAIConfigured();
  const aspectOptions = (Object.entries(ASPECTS) as [ImageAspect, typeof ASPECTS[ImageAspect]][])
    .filter(([, info]) => info.group === aspectGroup);

  const handleGenerate = useCallback(async (regenerate = false) => {
    setError(null);
    setBusy(true);
    setBatchResults([]);
    try {
      let prompt = advancedPrompt.trim();
      if (!prompt) {
        if (!topic.trim()) {
          setError('テーマを日本語で入力するか、英語の詳細プロンプトを入力してください');
          setBusy(false);
          return;
        }
        setPhase('prompt');
        prompt = await generateImagePrompt({
          settings, topic,
          context: `生成元人格: ${persona.name} (${persona.subtitle})`,
        });
        setAdvancedPrompt(prompt);
      }
      setPhase('render');

      // バッチ生成
      const targetCount = batchCount;
      const tasks: Promise<GenerateImageResult>[] = [];
      for (let i = 0; i < targetCount; i++) {
        tasks.push(generateImage({
          prompt, aspect, style, provider,
          seed: regenerate || i > 0 ? Math.floor(Math.random() * 1_000_000) : undefined,
        }));
      }
      const results = await Promise.all(tasks);
      setCurrent(results[0]);
      setBatchResults(results);

      // 履歴へ保存
      const newItems: HistoryItem[] = results.map(r => ({
        id: uuidv4(),
        url: r.url,
        prompt: r.prompt,
        aspect,
        style,
        width: r.width,
        height: r.height,
        provider: r.provider,
        generatedAt: r.generatedAt,
      }));
      setHistory(prev => [...newItems, ...prev].slice(0, MAX_HISTORY));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setPhase(null);
    }
  }, [topic, advancedPrompt, aspect, style, provider, settings, persona, batchCount]);

  const handleDownload = useCallback(async (img: HistoryItem | GenerateImageResult, idx?: number) => {
    const ext = img.url.includes('.png') ? 'png' : 'jpg';
    const baseName = (topic || 'core-prism-image').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
    const name = `${baseName}${idx != null ? `-${idx + 1}` : ''}-${Date.now()}.${ext}`;
    await downloadImage(img.url, name);
  }, [topic]);

  const handleSaveToKb = useCallback((img: HistoryItem | GenerateImageResult) => {
    if (!onSaveAsKnowledge) return;
    const title = `[画像] ${topic.slice(0, 60) || '生成画像'}`;
    const content = `# ${title}\n\n![${topic}](${img.url})\n\n**プロンプト**: ${img.prompt}\n\n**サイズ**: ${img.width}×${img.height}\n**スタイル**: ${style}\n**生成日時**: ${img.generatedAt}`;
    onSaveAsKnowledge(title, content);
  }, [topic, style, onSaveAsKnowledge]);

  const handleReuseFromHistory = (h: HistoryItem) => {
    setAdvancedPrompt(h.prompt);
    setAspect(h.aspect);
    setStyle(h.style);
    setAspectGroup(ASPECTS[h.aspect].group);
    setTab('create');
  };

  const handleCopyPrompt = (prompt: string) => {
    copyText(prompt, '指示文');
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-5xl rounded-2xl overflow-hidden flex flex-col"
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
            >🎨</div>
            <div className="min-w-0">
              <p className="text-fg text-base font-semibold leading-tight truncate">画像生成スタジオ</p>
              <p className="text-fg-muted text-xs truncate">
                日本語のテーマから AI が画像プロンプトを構成 ·{' '}
                <span style={{ color: persona.accentColor }}>{provider === 'dalle3' ? 'DALL-E 3' : 'Pollinations Flux'}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface text-xl leading-none"
          >×</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3" style={{ borderBottom: '1px solid var(--border)' }}>
          {([
            { id: 'create' as const, label: '✨ 生成' },
            { id: 'history' as const, label: `🗂 履歴 (${history.length})` },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
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
          {tab === 'create' && (
            <>
              <StudioIntro
                id="image"
                accent={persona.accentColor}
                emoji="🎨"
                what="テーマを日本語で 1 行書くだけで、AI が SNS や記事向けの画像を作る画面です。"
                tryThis="下の「画像のテーマ」に作りたい絵を 1 行で書いて「✨ 生成」を押します。"
                example="「秋のカフェのスペシャルティコーヒー」 → note のヘッダー画像が 1 枚完成。"
              />
              {/* テーマ入力 */}
              <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                <div>
                  <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">画像のテーマ (日本語)</label>
                  <textarea
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="例: 朝の山の頂上から見渡す雲海、神々しい光、静謐な感覚"
                    rows={2}
                    className="w-full text-sm px-3 py-2 rounded bg-surface-3 border-edge border text-fg placeholder:text-fg-subtle outline-none resize-none"
                  />
                  <p className="text-fg-subtle text-[11px] mt-1">
                    AI が自動で英語の視覚プロンプトに変換します。詳細にこだわるなら下の「詳細プロンプト」を直接編集
                  </p>
                </div>

                <button
                  onClick={() => setShowAdvanced(v => !v)}
                  className="text-xs text-fg-muted hover:text-fg flex items-center gap-1"
                >{showAdvanced ? '▾' : '▸'} 詳細プロンプト (英語、任意)</button>

                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <textarea
                        value={advancedPrompt}
                        onChange={e => setAdvancedPrompt(e.target.value)}
                        placeholder="A serene mountain peak at sunrise, sea of clouds, ethereal golden light..."
                        rows={3}
                        className="w-full text-xs px-3 py-2 rounded bg-surface-3 border-edge border text-fg placeholder:text-fg-subtle font-mono outline-none resize-none"
                      />
                      <p className="text-fg-subtle text-[11px] mt-1">
                        手動入力した場合は AI 自動変換をスキップします
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* スタイル */}
              <div className="rounded-xl p-4" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                <label className="block text-fg-muted text-xs tracking-wider uppercase mb-2">ビジュアルスタイル</label>
                <div className="flex gap-1.5 flex-wrap">
                  {STYLE_OPTIONS.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setStyle(s.value)}
                      className="text-xs px-3 py-2 rounded-md font-medium"
                      style={{
                        background: style === s.value ? persona.accentColorLight : 'var(--surface-3)',
                        color: style === s.value ? persona.accentColor : 'var(--fg-muted)',
                        border: `1px solid ${style === s.value ? persona.accentColor + '50' : 'var(--border)'}`,
                      }}
                    >{s.emoji} {s.label}</button>
                  ))}
                </div>
              </div>

              {/* アスペクト比 */}
              <div className="rounded-xl p-4" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                <label className="block text-fg-muted text-xs tracking-wider uppercase mb-2">サイズ・用途</label>
                <div className="flex gap-1.5 mb-2">
                  {ASPECT_GROUPS.map(g => (
                    <button
                      key={g.id}
                      onClick={() => {
                        setAspectGroup(g.id);
                        // 現在の aspect が別グループならグループ先頭に切替
                        const first = (Object.entries(ASPECTS) as [ImageAspect, typeof ASPECTS[ImageAspect]][])
                          .find(([, v]) => v.group === g.id);
                        if (first && ASPECTS[aspect].group !== g.id) setAspect(first[0]);
                      }}
                      className="text-xs px-2.5 py-1 rounded-md font-medium"
                      style={{
                        background: aspectGroup === g.id ? persona.accentColor : 'var(--surface-3)',
                        color: aspectGroup === g.id ? '#0a0a0f' : 'var(--fg-muted)',
                        border: `1px solid ${aspectGroup === g.id ? persona.accentColor : 'var(--border)'}`,
                      }}
                    >{g.emoji} {g.label}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                  {aspectOptions.map(([key, info]) => (
                    <button
                      key={key}
                      onClick={() => setAspect(key)}
                      className="text-left text-xs px-3 py-2 rounded"
                      style={{
                        background: aspect === key ? persona.accentColorLight : 'var(--surface)',
                        color: aspect === key ? persona.accentColor : 'var(--fg)',
                        border: `1px solid ${aspect === key ? persona.accentColor + '50' : 'var(--border)'}`,
                      }}
                    >
                      <div className="font-medium">{info.label.split(' (')[0]}</div>
                      <div className="text-fg-muted text-[10px] mt-0.5">{info.width}×{info.height}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* プロバイダ + バッチ数 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-4" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                  <label className="block text-fg-muted text-xs tracking-wider uppercase mb-2">エンジン</label>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setProvider('pollinations')}
                      className="flex-1 text-xs px-3 py-2 rounded-md font-medium"
                      style={{
                        background: provider === 'pollinations' ? persona.accentColorLight : 'var(--surface)',
                        color: provider === 'pollinations' ? persona.accentColor : 'var(--fg-muted)',
                        border: `1px solid ${provider === 'pollinations' ? persona.accentColor + '50' : 'var(--border)'}`,
                      }}
                    >⚡ Flux<br /><span className="text-[10px] opacity-70">無料 / 高速</span></button>
                    <button
                      onClick={() => setProvider('dalle3')}
                      disabled={!dalleAvailable}
                      className="flex-1 text-xs px-3 py-2 rounded-md font-medium disabled:opacity-40"
                      style={{
                        background: provider === 'dalle3' ? persona.accentColorLight : 'var(--surface)',
                        color: provider === 'dalle3' ? persona.accentColor : 'var(--fg-muted)',
                        border: `1px solid ${provider === 'dalle3' ? persona.accentColor + '50' : 'var(--border)'}`,
                      }}
                    >✨ DALL-E 3{!dalleAvailable && '🔒'}<br /><span className="text-[10px] opacity-70">{dalleAvailable ? '高品質' : '要API設定'}</span></button>
                  </div>
                </div>
                <div className="rounded-xl p-4" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                  <label className="block text-fg-muted text-xs tracking-wider uppercase mb-2">同時生成数</label>
                  <div className="flex gap-1.5">
                    {([1, 2, 4] as const).map(n => (
                      <button
                        key={n}
                        onClick={() => setBatchCount(n)}
                        className="flex-1 text-xs px-3 py-2 rounded-md font-medium"
                        style={{
                          background: batchCount === n ? persona.accentColor : 'var(--surface)',
                          color: batchCount === n ? '#0a0a0f' : 'var(--fg-muted)',
                          border: `1px solid ${batchCount === n ? persona.accentColor : 'var(--border)'}`,
                        }}
                      >{n}枚</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 生成ボタン */}
              <div className="flex gap-2">
                <motion.button
                  onClick={() => handleGenerate(false)}
                  disabled={busy || (!topic.trim() && !advancedPrompt.trim())}
                  className="flex-1 py-3 rounded-lg text-sm font-semibold disabled:opacity-50"
                  style={{ background: persona.accentColor, color: '#0a0a0f' }}
                  whileTap={!busy ? { scale: 0.99 } : {}}
                >
                  {busy ? '🎨 生成中…' : `✨ ${batchCount}枚 生成 (${ASPECTS[aspect].width}×${ASPECTS[aspect].height})`}
                </motion.button>
                {batchResults.length > 0 && (
                  <button
                    onClick={() => handleGenerate(true)}
                    disabled={busy}
                    className="px-4 py-3 rounded-lg text-sm font-medium disabled:opacity-50"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                  >🎲 別シードで</button>
                )}
              </div>

              {busy && phase && (
                <GeneratingPanel phase={phase} count={batchCount} accent={persona.accentColor} />
              )}

              <ApiErrorCard error={error} onRetry={() => handleGenerate(false)} />

              {/* 結果表示 */}
              <AnimatePresence>
                {batchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="space-y-3"
                  >
                    <div className={batchResults.length === 1 ? '' : 'grid grid-cols-2 gap-3'}>
                      {batchResults.map((r, i) => (
                        <div
                          key={i}
                          className="rounded-xl overflow-hidden"
                          style={{ border: `1px solid ${persona.accentColor}40`, background: 'var(--surface-3)' }}
                        >
                          <img
                            src={r.url}
                            alt=""
                            loading="lazy"
                            className="w-full h-auto block cursor-pointer"
                            onClick={() => setCurrent(r)}
                            style={{ aspectRatio: `${r.width}/${r.height}`, background: '#0a0a0f' }}
                          />
                          <div className="flex flex-wrap gap-1.5 p-2 justify-end">
                            <span className="text-[10px] text-fg-muted mr-auto self-center">
                              #{i + 1} · {r.width}×{r.height}
                            </span>
                            <button
                              onClick={() => handleDownload(r, i)}
                              className="text-[11px] px-2.5 py-1 rounded text-fg-muted hover:text-fg"
                              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                            >⬇</button>
                            {onSaveAsKnowledge && (
                              <button
                                onClick={() => handleSaveToKb(r)}
                                className="text-[11px] px-2.5 py-1 rounded text-fg-muted hover:text-fg"
                                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                              >📚</button>
                            )}
                            <button
                              onClick={() => handleCopyPrompt(r.prompt)}
                              className="text-[11px] px-2.5 py-1 rounded text-fg-muted hover:text-fg"
                              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                            >📋 プロンプト</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {current && (
                      <div className="rounded-lg p-3 text-[11px] font-mono" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--fg-muted)' }}>
                        <span className="text-fg-subtle">prompt:</span> {current.prompt}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {tab === 'history' && (
            <>
              {history.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-3xl mb-2">🖼</p>
                  <p className="text-fg-muted text-sm">生成履歴はまだありません</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <p className="text-fg-muted text-xs">最大 {MAX_HISTORY} 件まで自動保存</p>
                    <button
                      onClick={() => { if (confirm('履歴をすべて削除しますか?')) setHistory([]); }}
                      className="text-xs text-fg-muted hover:text-red-400"
                    >全消去</button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {history.map(h => (
                      <div
                        key={h.id}
                        className="rounded-xl overflow-hidden"
                        style={{ border: '1px solid var(--border)', background: 'var(--surface-3)' }}
                      >
                        <img
                          src={h.url}
                          alt=""
                          loading="lazy"
                          className="w-full h-auto block"
                          style={{ aspectRatio: `${h.width}/${h.height}`, background: '#0a0a0f' }}
                        />
                        <div className="p-2 space-y-1">
                          <div className="flex items-center gap-1 text-[10px] text-fg-muted">
                            <span>{h.width}×{h.height}</span>
                            <span>·</span>
                            <span>{STYLE_OPTIONS.find(s => s.value === h.style)?.label}</span>
                            <span>·</span>
                            <span>{h.provider === 'dalle3' ? 'DALL-E' : 'Flux'}</span>
                          </div>
                          <p className="text-[10px] text-fg-subtle line-clamp-2 font-mono">{h.prompt}</p>
                          <div className="flex gap-1 pt-1 flex-wrap">
                            <button
                              onClick={() => handleReuseFromHistory(h)}
                              className="text-[10px] px-2 py-0.5 rounded text-fg-muted hover:text-fg"
                              style={{ background: 'var(--surface)' }}
                            >再利用</button>
                            <button
                              onClick={() => handleDownload(h)}
                              className="text-[10px] px-2 py-0.5 rounded text-fg-muted hover:text-fg"
                              style={{ background: 'var(--surface)' }}
                            >⬇</button>
                            {onSaveAsKnowledge && (
                              <button
                                onClick={() => handleSaveToKb(h)}
                                className="text-[10px] px-2 py-0.5 rounded text-fg-muted hover:text-fg"
                                style={{ background: 'var(--surface)' }}
                              >📚</button>
                            )}
                            <button
                              onClick={() => setHistory(prev => prev.filter(x => x.id !== h.id))}
                              className="text-[10px] px-2 py-0.5 rounded text-fg-muted hover:text-red-400"
                              style={{ background: 'var(--surface)' }}
                            >×</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// 生成を待つ十数秒を「無音の不安」にしないための実況パネル。
// いま AI が何をしているかを、やさしい日本語でその場で言葉にする。
function GeneratingPanel({
  phase, count, accent,
}: {
  phase: 'prompt' | 'render';
  count: 1 | 2 | 4;
  accent: string;
}) {
  const steps = phase === 'prompt'
    ? [
        'あなたが入力した言葉を読み取っています…',
        '絵にするための指示文に翻訳しています…',
        '画風・色・構図のヒントを足しています…',
      ]
    : [
        `${count}枚の下絵を起こしています…`,
        '光と影を入れています…',
        '色を重ねて仕上げています…',
        'もうすぐ完成です…',
      ];
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
    const t = setInterval(() => {
      setStep(s => Math.min(s + 1, steps.length - 1));
    }, 2400);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl p-4 flex items-center gap-3.5"
      style={{ background: 'var(--surface-3)', border: `1px solid ${accent}40` }}
    >
      {/* 呼吸するオーブ — 「いま手を動かしている」感 */}
      <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
        {[0, 1].map(ring => (
          <motion.div
            key={ring}
            animate={{ scale: [1, 1.7], opacity: [0.4, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: ring * 0.6 }}
            style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px solid ${accent}` }}
          />
        ))}
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: `radial-gradient(circle, ${accent} 0%, ${accent}66 60%, transparent 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}
        >
          {phase === 'prompt' ? '🧠' : '🎨'}
        </motion.div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="text-[11px] font-semibold" style={{ color: accent, letterSpacing: '0.08em' }}>
          {phase === 'prompt' ? 'STEP 1 / 2 ・ 言葉を整える' : 'STEP 2 / 2 ・ 絵を描く'}
        </p>
        <AnimatePresence mode="wait">
          <motion.p
            key={step}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.3 }}
            className="text-fg text-sm font-semibold mt-0.5"
          >
            {steps[step]}
          </motion.p>
        </AnimatePresence>
        <p className="text-fg-muted text-[11px] mt-0.5">
          このまま少しお待ちください。完成すると下に画像が出ます。
        </p>
      </div>
    </motion.div>
  );
}
