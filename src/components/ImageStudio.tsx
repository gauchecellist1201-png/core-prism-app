import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import ApiErrorCard from './ApiErrorCard';
import AILoadingState from './AILoadingState';
import EmptyState from './EmptyState';
import { StudioIntro } from './StudioIntro';
import { copyText } from '../lib/clipboard';
import type { Persona, AppSettings } from '../types/identity';
import {
  generateImage, generateImagePrompt, downloadImage, urlToDataUrl,
  STYLE_OPTIONS, ASPECTS, isOpenAIConfigured,
  type VisualStyle, type ImageAspect, type ImageProvider, type GenerateImageResult,
} from '../lib/imageGen';
import { confirmAction } from '../lib/confirmDialog';
import ShareArtifactButton from './ShareArtifactButton';

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
const POST_QUEUE_KEY = 'iris_post_queue_v1';
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

// ─── 履歴サムネ — 個別 loading / error / 再読込 (2026-06-04) ──────────
//   原因: Pollinations が レート制限 / 瞬断 で 500 を返した時、
//   <img> に onError 無く 黒いまま で 画像 が 出ない 様 に 見える。
//   修正: 状態 管理 + 🔄 再読込 (cache-bust) で 必ず 復旧できる 様 に。
interface HistoryThumbProps {
  url: string;
  width: number;
  height: number;
  reloadKey: number; // 親 からの 全再読込 トリガ
  onClick: () => void;
}
function HistoryThumb({ url, width, height, reloadKey, onClick }: HistoryThumbProps) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [bust, setBust] = useState(0);
  // 親 reloadKey が 変わる たび に 再 fetch (cache-bust)
  useEffect(() => { setBust(reloadKey); setState('loading'); }, [reloadKey]);
  const finalUrl = bust ? `${url}${url.includes('?') ? '&' : '?'}_=${bust}` : url;
  return (
    <div
      style={{ position: 'relative', width: '100%', aspectRatio: `${width}/${height}`, background: '#0a0a0f', cursor: state === 'ok' ? 'zoom-in' : 'default' }}
      onClick={state === 'ok' ? onClick : undefined}
    >
      <img
        src={finalUrl}
        alt=""
        loading="lazy"
        onLoad={() => setState('ok')}
        onError={() => setState('error')}
        style={{
          width: '100%', height: '100%', objectFit: 'cover', display: 'block',
          opacity: state === 'ok' ? 1 : 0, transition: 'opacity 0.3s',
        }}
      />
      {state === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,0.55)', fontSize: 11, gap: 6, flexDirection: 'column',
        }}>
          <span style={{ fontSize: 24, animation: 'iris-spin 1.4s linear infinite', display: 'inline-block' }}>🎨</span>
          <span>読み込み中…</span>
        </div>
      )}
      {state === 'error' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 8, padding: 12,
          background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.85)',
        }}>
          <span style={{ fontSize: 22 }}>⚠️</span>
          <span style={{ fontSize: 11, textAlign: 'center' }}>画像を読み込めません</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setBust(Date.now()); setState('loading'); }}
            style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 6,
              background: 'rgba(251,191,36,0.18)', color: '#FBBF24',
              border: '1px solid rgba(251,191,36,0.4)', cursor: 'pointer', fontWeight: 700,
            }}
          >🔄 再読込</button>
        </div>
      )}
    </div>
  );
}

const ASPECT_GROUPS: { id: 'social' | 'free' | 'doc'; label: string; emoji: string }[] = [
  { id: 'social', label: 'SNS / Web', emoji: '🌐' },
  { id: 'free',   label: '汎用',     emoji: '⬜' },
  { id: 'doc',    label: '印刷',     emoji: '📄' },
];

// ─── プリセット 6 種 ───────────────────────────────────────
// 1 タップでテーマ・サイズ・スタイル・枚数を「使われやすい組合せ」にする
interface Preset {
  id: string;
  emoji: string;
  label: string;
  hint: string;         // 入力欄プレースホルダー
  aspect: ImageAspect;
  aspectGroup: 'social' | 'free' | 'doc';
  style: VisualStyle;
  batch: 1 | 2 | 4;
  /** 自動で頭に付けるテーマプレフィックス */
  prefix?: string;
}
const PRESETS: Preset[] = [
  {
    id: 'ig-feed', emoji: '📷', label: 'Instagram 投稿サムネ',
    hint: '例: ブランドの新商品 / カフェの新メニュー',
    aspect: 'ig-square', aspectGroup: 'social', style: 'editorial', batch: 4,
    prefix: 'Instagram feed post thumbnail, modern, brand-friendly:',
  },
  {
    id: 'reel-cover', emoji: '🎬', label: 'リール表紙',
    hint: '例: 朝のルーティン / 新作リール「3分で分かる…」',
    aspect: 'ig-story', aspectGroup: 'social', style: 'cinematic', batch: 4,
    prefix: 'Instagram reel cover image, bold large title space at top, vertical 9:16, eye-catching:',
  },
  {
    id: 'blog-hero', emoji: '📰', label: 'ブログヘッダー',
    hint: '例: AI 時代の働き方 / 副業で月10万円までのロードマップ',
    aspect: 'note-hero', aspectGroup: 'social', style: 'photo', batch: 2,
    prefix: 'Blog article hero header, photorealistic, editorial:',
  },
  {
    id: 'icon', emoji: '⚫', label: 'アイコン',
    hint: '例: AI アシスタント / 音楽ブランド「GAUCHE」',
    aspect: 'square', aspectGroup: 'free', style: 'minimal', batch: 4,
    prefix: 'Simple round profile icon, minimal flat design, centered subject, neutral background:',
  },
  {
    id: 'og', emoji: '🔗', label: 'OG 画像',
    hint: '例: ランディングページのタイトル / プロダクト名',
    aspect: 'x-post', aspectGroup: 'social', style: 'editorial', batch: 2,
    prefix: 'Open Graph share card, centered visual focus with title space, 16:9, professional:',
  },
  {
    id: 'infographic', emoji: '📊', label: 'インフォグラフィック',
    hint: '例: 3 ステップで分かる / 比較表 / プロセス図',
    aspect: 'portrait', aspectGroup: 'free', style: 'pop', batch: 2,
    prefix: 'Infographic-style illustration, clean visual diagram with abstract shapes representing data, modern:',
  },
];

// ─── Iris 投稿キュー連携 ────────────────────────────────
// usePostQueue は React hook なのでここからは呼べない。
// localStorage 'iris_post_queue_v1' に直接 append して storage event を撃つ。
function pushImageToIrisPostQueue(opts: {
  imageDataUrl: string;
  caption: string;
  width: number;
  height: number;
}): boolean {
  try {
    const raw = localStorage.getItem(POST_QUEUE_KEY);
    const list: any[] = raw ? JSON.parse(raw) : [];
    const post = {
      id: 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4),
      createdAt: new Date().toISOString(),
      // 1時間後ぐらいに ready (1時間以内なので即 ready 扱い)
      scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      status: 'draft',
      // Instagram フィードに最適化されたサイズなら feed、それ以外は story
      platform: opts.width === opts.height || Math.abs(opts.width - opts.height) < 100
        ? 'instagram_feed'
        : (opts.height > opts.width ? 'instagram_story' : 'instagram_feed'),
      source: 'image',
      caption: opts.caption,
      hashtags: [],
      mediaDataUrl: opts.imageDataUrl,
      mediaKind: 'image',
      thumbDataUrl: opts.imageDataUrl,
      note: 'ImageStudio から送信',
    };
    const next = [post, ...list];
    const json = JSON.stringify(next);
    // 4.5MB を超えるなら新しい1件だけにする (古い投稿落とす)
    if (json.length > 4_500_000) {
      localStorage.setItem(POST_QUEUE_KEY, JSON.stringify([post]));
    } else {
      localStorage.setItem(POST_QUEUE_KEY, json);
    }
    // 他コンポーネントへ通知 (usePostQueue は storage event を購読)
    try {
      window.dispatchEvent(new StorageEvent('storage', { key: POST_QUEUE_KEY }));
    } catch {/* legacy browsers */}
    return true;
  } catch (e) {
    console.warn('[ImageStudio] iris post queue push failed', e);
    return false;
  }
}

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
  const [batchCount, setBatchCount] = useState<1 | 2 | 4>(4);
  const [batchResults, setBatchResults] = useState<GenerateImageResult[]>([]);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [topicHint, setTopicHint] = useState<string>('例: 朝の山の頂上から見渡す雲海、神々しい光、静謐な感覚');
  const [lightbox, setLightbox] = useState<{ url: string; w: number; h: number } | null>(null);
  const [toast, setToast] = useState<string>('');
  const [pendingPromptPrefix, setPendingPromptPrefix] = useState<string>('');
  // ★用途別・同時生成（オーナー要望 2026-07-14）: 1つのテーマから YouTube/Instagram/X/note 等の
  //   各サイズを一括で作る。選んだ用途ごとに1枚ずつ並列生成。
  const [multiTargets, setMultiTargets] = useState<Set<ImageAspect>>(new Set());
  const [multiResults, setMultiResults] = useState<{ aspect: ImageAspect; result: GenerateImageResult }[]>([]);
  // 履歴 全再読込 トリガ (Date.now() を カウンタ 代わりに)
  const [historyReloadKey, setHistoryReloadKey] = useState<number>(0);

  useEffect(() => { saveHistory(history); }, [history]);

  // toast 自動消去
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const dalleAvailable = isOpenAIConfigured();
  const aspectOptions = (Object.entries(ASPECTS) as [ImageAspect, typeof ASPECTS[ImageAspect]][])
    .filter(([, info]) => info.group === aspectGroup);

  const handlePresetClick = useCallback((p: Preset) => {
    setActivePreset(p.id);
    setAspect(p.aspect);
    setAspectGroup(p.aspectGroup);
    setStyle(p.style);
    setBatchCount(p.batch);
    setTopicHint(p.hint);
    setPendingPromptPrefix(p.prefix || '');
    // 詳細プロンプトをクリア (preset を変えたなら作り直す)
    setAdvancedPrompt('');
  }, []);

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
        // preset prefix があれば前に足す
        if (pendingPromptPrefix) {
          prompt = `${pendingPromptPrefix} ${prompt}`;
        }
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
  }, [topic, advancedPrompt, aspect, style, provider, settings, persona, batchCount, pendingPromptPrefix]);

  // ★用途別・同時生成: 同じテーマ/プロンプトで、選んだ各プラットフォームのサイズを一括生成
  const handleMultiGenerate = useCallback(async () => {
    if (multiTargets.size === 0) return;
    setError(null);
    setBusy(true);
    setMultiResults([]);
    try {
      let prompt = advancedPrompt.trim();
      if (!prompt) {
        if (!topic.trim()) {
          setError('テーマを日本語で入力してください');
          setBusy(false);
          return;
        }
        setPhase('prompt');
        prompt = await generateImagePrompt({
          settings, topic,
          context: `生成元人格: ${persona.name} (${persona.subtitle})`,
        });
        if (pendingPromptPrefix) prompt = `${pendingPromptPrefix} ${prompt}`;
        setAdvancedPrompt(prompt);
      }
      setPhase('render');
      const targets = Array.from(multiTargets);
      const results = await Promise.all(targets.map(a =>
        generateImage({ prompt, aspect: a, style, provider }).then(result => ({ aspect: a, result }))
      ));
      setMultiResults(results);
      // 履歴にも残す
      const newItems: HistoryItem[] = results.map(({ aspect: a, result: r }) => ({
        id: uuidv4(), url: r.url, prompt: r.prompt, aspect: a, style,
        width: r.width, height: r.height, provider: r.provider, generatedAt: r.generatedAt,
      }));
      setHistory(prev => [...newItems, ...prev].slice(0, MAX_HISTORY));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setPhase(null);
    }
  }, [multiTargets, topic, advancedPrompt, style, provider, settings, persona, pendingPromptPrefix]);

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
    setToast('ナレッジに保存しました');
  }, [topic, style, onSaveAsKnowledge]);

  const handleSendToInstagram = useCallback(async (img: HistoryItem | GenerateImageResult) => {
    try {
      setToast('Instagram 用にアップロード中…');
      // data URL に変換 (localStorage に直接埋める)
      const dataUrl = await urlToDataUrl(img.url).catch(() => img.url);
      const ok = pushImageToIrisPostQueue({
        imageDataUrl: dataUrl,
        caption: topic || '',
        width: img.width,
        height: img.height,
      });
      setToast(ok ? '✅ Iris の投稿キューに追加しました' : '❌ 投稿キューへの追加に失敗しました');
    } catch (e) {
      console.warn('[ImageStudio] send to Instagram failed', e);
      setToast('❌ 画像取得に失敗しました');
    }
  }, [topic]);

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

  // ローディングのステージ表示 (AILoadingState に渡す)
  const loadingStages = phase === 'prompt'
    ? [
        'あなたが入力した言葉を読み取っています…',
        '絵にするための指示文に翻訳しています…',
        '画風・色・構図のヒントを足しています…',
      ]
    : [
        `${batchCount}枚の下絵を起こしています…`,
        '光と影を入れています…',
        '色を重ねて仕上げています…',
        'もうすぐ完成です…',
      ];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3"
      style={{
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(20px)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)',
        paddingTop: 'max(env(safe-area-inset-top), 0.5rem)',
      }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-[1400px] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg, #15151c)', border: '1px solid var(--border)', maxHeight: 'calc(100dvh - 1rem)' }}
        initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4" style={{ borderBottom: '1px solid var(--border)' }}>
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
            className="flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface text-xl leading-none rounded-full"
            style={{ width: 44, height: 44, minWidth: 44, fontSize: 22 }}
            aria-label="閉じる"
          >×</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 sm:px-5 pt-3" style={{ borderBottom: '1px solid var(--border)' }}>
          {([
            { id: 'create' as const, label: '✨ 生成' },
            { id: 'history' as const, label: `🗂 履歴 (${history.length})` },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="text-sm px-4 rounded-t-md font-medium"
              style={{
                minHeight: 44,
                background: tab === t.id ? persona.accentColorLight : 'transparent',
                color: tab === t.id ? persona.accentColor : 'var(--fg-muted)',
                borderBottom: tab === t.id ? `2px solid ${persona.accentColor}` : '2px solid transparent',
              }}
            >{t.label}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {tab === 'create' && (
            <>
              <StudioIntro
                id="image"
                accent={persona.accentColor}
                iconKey="image"
                what="テーマを日本語で 1 行書くだけで、AI が SNS や記事向けの画像を作る画面です。"
                tryThis="まず下の「プリセット」を 1 つ選び、「画像のテーマ」に作りたい絵を書いて「✨ 生成」を押します。"
                example="「秋のカフェのスペシャルティコーヒー」 → note のヘッダー画像が 1 枚完成。"
                sampleLabel="出来上がりイメージ"
                samplePreview={
                  <div
                    style={{
                      width: 140,
                      height: 90,
                      borderRadius: 8,
                      overflow: 'hidden',
                      position: 'relative',
                      background:
                        'radial-gradient(circle at 25% 30%, #fde68a 0%, #f59e0b 22%, transparent 45%), ' +
                        'radial-gradient(circle at 75% 70%, #fb7185 0%, #be185d 25%, transparent 50%), ' +
                        'linear-gradient(135deg, #1e1b4b 0%, #312e81 55%, #0f172a 100%)',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                          'linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.55) 100%)',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        left: 8,
                        bottom: 6,
                        fontSize: 8,
                        color: '#fff',
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                        textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                      }}
                    >
                      秋のカフェ ☕
                    </span>
                  </div>
                }
              />

              {/* ─── プリセット 6 種 ───── 1 タップで構成済 */}
              <div className="rounded-xl p-3 sm:p-4" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                <label className="block text-fg-muted text-xs tracking-wider uppercase mb-2">⚡ プリセット (1 タップで構成)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                  {PRESETS.map(p => {
                    const active = activePreset === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => handlePresetClick(p)}
                        className="text-left rounded-lg px-3 py-2.5 transition-colors"
                        style={{
                          minHeight: 56,
                          background: active ? persona.accentColorLight : 'var(--surface)',
                          border: `1px solid ${active ? persona.accentColor : 'var(--border)'}`,
                          color: active ? persona.accentColor : 'var(--fg)',
                        }}
                      >
                        <div className="text-base leading-none mb-1">{p.emoji}</div>
                        <div className="text-[12px] font-semibold leading-tight">{p.label}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: active ? persona.accentColor : 'var(--fg-muted)', opacity: 0.7 }}>
                          {ASPECTS[p.aspect].width}×{ASPECTS[p.aspect].height} · {p.batch}枚
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* テーマ入力 */}
              <div className="rounded-xl p-3 sm:p-4 space-y-3" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                <div>
                  <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">画像のテーマ (日本語)</label>
                  <textarea
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder={topicHint}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded bg-surface-3 border-edge border text-fg placeholder:text-fg-subtle outline-none resize-none"
                    style={{ fontSize: 16 /* iOS auto-zoom prevention */ }}
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
                        className="w-full px-3 py-2 rounded bg-surface-3 border-edge border text-fg placeholder:text-fg-subtle font-mono outline-none resize-none"
                        style={{ fontSize: 16 }}
                      />
                      <p className="text-fg-subtle text-[11px] mt-1">
                        手動入力した場合は AI 自動変換をスキップします
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* スタイル */}
              <div className="rounded-xl p-3 sm:p-4" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                <label className="block text-fg-muted text-xs tracking-wider uppercase mb-2">ビジュアルスタイル</label>
                <div className="flex gap-1.5 flex-wrap">
                  {STYLE_OPTIONS.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setStyle(s.value)}
                      className="text-xs px-3 rounded-md font-medium"
                      style={{
                        minHeight: 40,
                        background: style === s.value ? persona.accentColorLight : 'var(--surface-3)',
                        color: style === s.value ? persona.accentColor : 'var(--fg-muted)',
                        border: `1px solid ${style === s.value ? persona.accentColor + '50' : 'var(--border)'}`,
                      }}
                    >{s.emoji} {s.label}</button>
                  ))}
                </div>
              </div>

              {/* アスペクト比 */}
              <div className="rounded-xl p-3 sm:p-4" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
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
                      className="text-xs px-3 rounded-md font-medium"
                      style={{
                        minHeight: 36,
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
                        minHeight: 44,
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
                <div className="rounded-xl p-3 sm:p-4" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                  <label className="block text-fg-muted text-xs tracking-wider uppercase mb-2">エンジン</label>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setProvider('pollinations')}
                      className="flex-1 text-xs px-2 py-2 rounded-md font-medium"
                      style={{
                        minHeight: 48,
                        background: provider === 'pollinations' ? persona.accentColorLight : 'var(--surface)',
                        color: provider === 'pollinations' ? persona.accentColor : 'var(--fg-muted)',
                        border: `1px solid ${provider === 'pollinations' ? persona.accentColor + '50' : 'var(--border)'}`,
                      }}
                    >⚡ Flux<br /><span className="text-[10px] opacity-70">無料 / 高速</span></button>
                    <button
                      onClick={() => setProvider('dalle3')}
                      disabled={!dalleAvailable}
                      className="flex-1 text-xs px-2 py-2 rounded-md font-medium disabled:opacity-40"
                      style={{
                        minHeight: 48,
                        background: provider === 'dalle3' ? persona.accentColorLight : 'var(--surface)',
                        color: provider === 'dalle3' ? persona.accentColor : 'var(--fg-muted)',
                        border: `1px solid ${provider === 'dalle3' ? persona.accentColor + '50' : 'var(--border)'}`,
                      }}
                    >✨ DALL-E 3{!dalleAvailable && '🔒'}<br /><span className="text-[10px] opacity-70">{dalleAvailable ? '高品質' : '要API設定'}</span></button>
                  </div>
                </div>
                <div className="rounded-xl p-3 sm:p-4" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                  <label className="block text-fg-muted text-xs tracking-wider uppercase mb-2">同時生成数</label>
                  <div className="flex gap-1.5">
                    {([1, 2, 4] as const).map(n => (
                      <button
                        key={n}
                        onClick={() => setBatchCount(n)}
                        className="flex-1 text-xs px-3 rounded-md font-medium"
                        style={{
                          minHeight: 48,
                          background: batchCount === n ? persona.accentColor : 'var(--surface)',
                          color: batchCount === n ? '#0a0a0f' : 'var(--fg-muted)',
                          border: `1px solid ${batchCount === n ? persona.accentColor : 'var(--border)'}`,
                        }}
                      >{n}枚</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ★用途別・同時生成: YouTube/インスタ/X/note を1テーマから一括で */}
              <div className="rounded-xl p-3.5" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-xs font-semibold text-fg">用途別に、まとめて生成</p>
                  <p className="text-[11px] text-fg-muted">同じテーマで各サイズを一括制作</p>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {([
                    ['youtube-thumb', 'YouTube サムネ'],
                    ['ig-square', 'インスタ投稿'],
                    ['ig-story', 'ストーリー/リール'],
                    ['x-post', 'X 投稿'],
                    ['note-hero', 'note 見出し'],
                    ['banner-wide', 'バナー'],
                  ] as [ImageAspect, string][]).map(([a, label]) => {
                    const on = multiTargets.has(a);
                    return (
                      <button
                        key={a}
                        onClick={() => {
                          const next = new Set(multiTargets);
                          if (on) next.delete(a); else next.add(a);
                          setMultiTargets(next);
                        }}
                        className="rounded-full px-3 text-xs font-medium transition-all"
                        style={{
                          minHeight: 40,
                          background: on ? persona.accentColorLight : 'var(--surface)',
                          border: `1px solid ${on ? persona.accentColor : 'var(--border)'}`,
                          color: on ? persona.accentColor : 'var(--fg-muted)',
                        }}
                      >{on ? '✓ ' : ''}{label}</button>
                    );
                  })}
                </div>
                <button
                  onClick={handleMultiGenerate}
                  disabled={busy || multiTargets.size === 0 || (!topic.trim() && !advancedPrompt.trim())}
                  className="w-full rounded-xl text-sm font-semibold disabled:opacity-40"
                  style={{ minHeight: 48, background: multiTargets.size > 0 ? persona.accentColor : 'var(--surface)', color: multiTargets.size > 0 ? '#0a0a0f' : 'var(--fg-muted)', border: multiTargets.size > 0 ? 'none' : '1px solid var(--border)' }}
                >
                  {busy ? '🎨 一括生成中…' : multiTargets.size > 0 ? `✨ 選んだ ${multiTargets.size} 用途を同時生成` : '上のチップから用途を選んでください'}
                </button>
              </div>

              {/* 用途別の結果（プラットフォーム名つき） */}
              {multiResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-fg">用途別の仕上がり</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {multiResults.map(({ aspect: a, result: r }) => (
                      <div key={a} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${persona.accentColor}40`, background: 'var(--surface-3)' }}>
                        <div
                          style={{ position: 'relative', width: '100%', aspectRatio: `${r.width}/${r.height}`, background: '#0a0a0f', cursor: 'zoom-in' }}
                          onClick={() => setLightbox({ url: r.url, w: r.width, h: r.height })}
                        >
                          <img src={r.url} alt={ASPECTS[a].label} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div className="flex items-center justify-between px-3 py-2">
                          <span className="text-[11px] font-medium text-fg-muted">{ASPECTS[a].label}</span>
                          <button
                            onClick={() => handleDownload(r)}
                            className="text-[11px] px-2.5 rounded font-medium"
                            style={{ minHeight: 32, background: persona.accentColorLight, color: persona.accentColor }}
                          >保存</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 生成ボタン — 56px+ で親指タップしやすく */}
              <div className="flex gap-2 sticky bottom-0" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}>
                <motion.button
                  onClick={() => handleGenerate(false)}
                  disabled={busy || (!topic.trim() && !advancedPrompt.trim())}
                  className="flex-1 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{
                    minHeight: 56,
                    background: persona.accentColor,
                    color: '#0a0a0f',
                    boxShadow: `0 8px 24px ${persona.accentColor}50`,
                  }}
                  whileTap={!busy ? { scale: 0.99 } : {}}
                >
                  {busy ? '🎨 生成中…' : `✨ ${batchCount}枚 生成 (${ASPECTS[aspect].width}×${ASPECTS[aspect].height})`}
                </motion.button>
                {batchResults.length > 0 && (
                  <button
                    onClick={() => handleGenerate(true)}
                    disabled={busy}
                    className="px-4 rounded-xl text-sm font-medium disabled:opacity-50"
                    style={{ minHeight: 56, background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                  >🎲 別シードで</button>
                )}
              </div>

              {/* AILoadingState 統一 (旧 GeneratingPanel から差替) */}
              <AILoadingState
                active={busy}
                label={phase === 'prompt' ? '言葉を整えています' : `${batchCount}枚の画像を描いています`}
                stages={loadingStages}
                brand="prism"
                skeletonLines={batchCount === 1 ? 3 : 5}
                hint="長くて 30 秒くらい。"
              />

              <ApiErrorCard error={error} onRetry={() => handleGenerate(false)} />

              {/* 結果表示 */}
              <AnimatePresence>
                {batchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="space-y-3"
                  >
                    <div className={batchResults.length === 1 ? '' : 'grid grid-cols-1 sm:grid-cols-2 gap-3'}>
                      {batchResults.map((r, i) => (
                        <div
                          key={i}
                          className="rounded-xl overflow-hidden"
                          style={{ border: `1px solid ${persona.accentColor}40`, background: 'var(--surface-3)' }}
                        >
                          <HistoryThumb
                            url={r.url}
                            width={r.width}
                            height={r.height}
                            reloadKey={0}
                            onClick={() => { setCurrent(r); setLightbox({ url: r.url, w: r.width, h: r.height }); }}
                          />
                          <div className="flex flex-wrap gap-1.5 p-2 justify-end items-center">
                            <span className="text-[10px] text-fg-muted mr-auto self-center">
                              #{i + 1} · {r.width}×{r.height}
                            </span>
                            <button
                              onClick={() => handleDownload(r, i)}
                              className="text-[11px] px-3 rounded text-fg-muted hover:text-fg"
                              style={{ minHeight: 36, background: 'var(--surface)', border: '1px solid var(--border)' }}
                            >⬇ DL</button>
                            <button
                              onClick={() => handleSendToInstagram(r)}
                              className="text-[11px] px-3 rounded font-semibold"
                              style={{
                                minHeight: 36,
                                background: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
                                color: '#fff',
                              }}
                              title="Iris の投稿キューに追加して Instagram 投稿に使う"
                            >📷 Instagram 投稿に使う</button>
                            {onSaveAsKnowledge && (
                              <button
                                onClick={() => handleSaveToKb(r)}
                                className="text-[11px] px-3 rounded text-fg-muted hover:text-fg"
                                style={{ minHeight: 36, background: 'var(--surface)', border: '1px solid var(--border)' }}
                              >📚 ナレッジ</button>
                            )}
                            <button
                              onClick={() => handleCopyPrompt(r.prompt)}
                              className="text-[11px] px-3 rounded text-fg-muted hover:text-fg"
                              style={{ minHeight: 36, background: 'var(--surface)', border: '1px solid var(--border)' }}
                            >📋 プロンプト</button>
                            <ShareArtifactButton
                              variant="pill"
                              size="sm"
                              accent={persona.accentColor || '#A78BFA'}
                              label="送る"
                              shareText={`「${r.prompt.slice(0, 60)}」で作った画像です`}
                              artifact={{
                                kind: 'image',
                                title: `${persona.name} の AI 画像`,
                                imageUrl: r.url,
                                body: r.prompt,
                                createdBy: persona.name,
                                source: 'prism',
                                createdAt: new Date().toISOString(),
                              }}
                            />
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
                <EmptyState
                  iconKey="image"
                  title="まだ生成した画像はありません"
                  description={'ロゴ・サムネ・人物・風景、思いついたものを 1 枚作ってみてください。\nスタイルとアスペクト比は左のタブで選べます。最大 ' + MAX_HISTORY + ' 件まで履歴に残ります。'}
                  ctaLabel="最初の 1 枚を生成する"
                  onCta={() => setTab('create')}
                  accent={persona.accentColor}
                  preview="ロゴ案 1024×1024 / 商品サムネ 1792×1024 / SNS アイコン 1024×1024"
                  showSample={false}
                />
              ) : (
                <>
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <p className="text-fg-muted text-xs">最大 {MAX_HISTORY} 件まで自動保存</p>
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => { setHistoryReloadKey(Date.now()); setToast('🔄 全サムネを再読込しています…'); }}
                        className="text-xs hover:text-fg"
                        style={{ minHeight: 36, padding: '0 12px', color: '#FBBF24', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 6 }}
                        title="表示が崩れた / 黒くなった 時に 押す"
                      >🔄 全再読込</button>
                      <button
                        onClick={async () => { if (await confirmAction({ title: '画像生成の履歴をすべて削除しますか?', body: '保存した画像のサムネイル一覧が空になります。', tone: 'danger', okLabel: '全消去' })) setHistory([]); }}
                        className="text-xs text-fg-muted hover:text-red-400"
                        style={{ minHeight: 36, padding: '0 12px' }}
                      >全消去</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {history.map(h => (
                      <div
                        key={h.id}
                        className="rounded-xl overflow-hidden"
                        style={{ border: '1px solid var(--border)', background: 'var(--surface-3)' }}
                      >
                        <HistoryThumb
                          url={h.url}
                          width={h.width}
                          height={h.height}
                          reloadKey={historyReloadKey}
                          onClick={() => setLightbox({ url: h.url, w: h.width, h: h.height })}
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
                              className="text-[10px] px-2 rounded text-fg-muted hover:text-fg"
                              style={{ minHeight: 32, background: 'var(--surface)' }}
                            >再利用</button>
                            <button
                              onClick={() => handleDownload(h)}
                              className="text-[10px] px-2 rounded text-fg-muted hover:text-fg"
                              style={{ minHeight: 32, background: 'var(--surface)' }}
                            >⬇</button>
                            <button
                              onClick={() => handleSendToInstagram(h)}
                              className="text-[10px] px-2 rounded font-semibold"
                              style={{
                                minHeight: 32,
                                background: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
                                color: '#fff',
                              }}
                              title="Instagram 投稿に使う"
                            >📷 IG</button>
                            {onSaveAsKnowledge && (
                              <button
                                onClick={() => handleSaveToKb(h)}
                                className="text-[10px] px-2 rounded text-fg-muted hover:text-fg"
                                style={{ minHeight: 32, background: 'var(--surface)' }}
                              >📚</button>
                            )}
                            <button
                              onClick={() => setHistory(prev => prev.filter(x => x.id !== h.id))}
                              className="text-[10px] px-2 rounded text-fg-muted hover:text-red-400"
                              style={{ minHeight: 32, background: 'var(--surface)' }}
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

      {/* フルスクリーン ライトボックス — タップで原寸表示 */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center"
            style={{
              background: 'rgba(0,0,0,0.96)',
              padding: 'max(env(safe-area-inset-top), 8px) 8px max(env(safe-area-inset-bottom), 8px)',
            }}
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
          >
            <img
              src={lightbox.url}
              alt=""
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                touchAction: 'pinch-zoom',
              }}
              onClick={e => e.stopPropagation()}
              onError={(e) => {
                // 一度だけ cache-bust で再試行
                const el = e.currentTarget as HTMLImageElement;
                if (!el.dataset.retried) {
                  el.dataset.retried = '1';
                  el.src = `${lightbox.url}${lightbox.url.includes('?') ? '&' : '?'}_=${Date.now()}`;
                }
              }}
            />
            <button
              onClick={() => setLightbox(null)}
              aria-label="閉じる"
              style={{
                position: 'absolute',
                top: 'max(env(safe-area-inset-top), 12px)',
                right: 12,
                width: 44, height: 44,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
                fontSize: 22,
                lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >×</button>
            <p style={{
              position: 'absolute',
              bottom: 'max(env(safe-area-inset-bottom), 12px)',
              left: 0, right: 0, textAlign: 'center',
              color: 'rgba(255,255,255,0.6)', fontSize: 11,
            }}>
              タップで閉じる · ピンチで拡大
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* トースト */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
            className="fixed z-[70] left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-full text-sm font-medium"
            style={{
              bottom: 'calc(max(env(safe-area-inset-bottom), 16px) + 16px)',
              background: '#0a0a0f',
              color: '#fff',
              border: `1px solid ${persona.accentColor}66`,
              boxShadow: `0 6px 20px ${persona.accentColor}40`,
              maxWidth: 'calc(100vw - 32px)',
            }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
