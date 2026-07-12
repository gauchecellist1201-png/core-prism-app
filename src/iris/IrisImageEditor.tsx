// Canva 風 1 画面エディタ — Iris の画像加工
// 左: ライブプレビュー / 右: タブ式ツールバー (Crop / Filter / Adjust / Text / Effects)

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import {
  Upload, Download, Type, Sliders, Wand2, Crop as CropIcon,
  Undo2, Redo2, Plus, Trash2, Eye, EyeOff, ZoomIn, ZoomOut, Loader2,
  Sparkles, Send, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Grid3x3, Brain,
  RefreshCw, X,
} from 'lucide-react';
import type { IrisBackgroundDef } from './irisStyle';
import type { AppSettings } from '../types/identity';
import { shareToInstagram } from './instagramShare';
import { aiFetch } from '../lib/aiFetch';

type AspectId = '1:1' | '4:5' | '9:16' | '16:9' | 'free';
type FilterId = 'none' | 'vivid' | 'mono' | 'faded' | 'cinematic' | 'pastel' | 'noir' | 'warm' | 'cool';
type ToolTab = 'crop' | 'filter' | 'adjust' | 'text' | 'effects';

interface Adjust {
  brightness: number;   // 50-150 (%)
  contrast: number;     // 50-150 (%)
  saturate: number;     // 0-200 (%)
  exposure: number;     // -50 to 50
  shadows: number;      // -50 to 50 (+ で持ち上げ)
  highlights: number;   // -50 to 50 (- で抑える)
  warmth: number;       // -50 to 50
  blur: number;         // 0-10 (px)
  vignette: number;     // 0-100 (%)
}

interface TextLayer {
  id: string;
  text: string;
  xPct: number;        // 0-1
  yPct: number;        // 0-1
  fontSize: number;    // px (基準 1080 幅換算)
  fontFamily: string;
  color: string;
  weight: number;      // 400, 700
  italic: boolean;
  align: 'left' | 'center' | 'right';
  shadow: boolean;
  bg: 'none' | 'box';
  rotation: number;    // deg
}

interface Snapshot {
  adjust: Adjust;
  filter: FilterId;
  texts: TextLayer[];
  aspect: AspectId;
}

const DEFAULT_ADJUST: Adjust = {
  brightness: 100, contrast: 100, saturate: 100,
  exposure: 0, shadows: 0, highlights: 0,
  warmth: 0, blur: 0, vignette: 0,
};

const ASPECTS: { id: AspectId; label: string; sub: string; ratio: number | null }[] = [
  { id: '4:5',  label: '4:5',  sub: 'Insta Portrait', ratio: 4 / 5 },
  { id: '1:1',  label: '1:1',  sub: 'Insta Feed',     ratio: 1 },
  { id: '9:16', label: '9:16', sub: 'Story / Reel',   ratio: 9 / 16 },
  { id: '16:9', label: '16:9', sub: 'YouTube / Web',  ratio: 16 / 9 },
  { id: 'free', label: '自由', sub: '元のまま',       ratio: null },
];

const FILTERS: { id: FilterId; label: string; css: string }[] = [
  { id: 'none',      label: 'なし',       css: 'none' },
  { id: 'vivid',     label: 'Vivid',      css: 'contrast(1.18) saturate(1.4)' },
  { id: 'mono',      label: 'Mono',       css: 'grayscale(1) contrast(1.1)' },
  { id: 'faded',     label: 'Faded',      css: 'contrast(0.85) saturate(0.7) brightness(1.1)' },
  { id: 'cinematic', label: 'Cinematic',  css: 'contrast(1.3) saturate(0.95) brightness(0.96)' },
  { id: 'pastel',    label: 'Pastel',     css: 'saturate(0.8) brightness(1.1) hue-rotate(-6deg)' },
  { id: 'noir',      label: 'Noir',       css: 'grayscale(1) contrast(1.45) brightness(0.92)' },
  { id: 'warm',      label: 'Warm',       css: 'brightness(1.05) saturate(1.15) sepia(0.18)' },
  { id: 'cool',      label: 'Cool',       css: 'brightness(1.02) saturate(1.1) hue-rotate(15deg)' },
];

// Google Fonts 12 種以上 — 動的読込
const FONTS: { family: string; label: string; sample: string; weights: number[] }[] = [
  { family: 'Inter',                label: 'Inter',           sample: 'Aa あ', weights: [400, 700] },
  { family: 'Noto Sans JP',         label: 'Noto Sans JP',    sample: 'Aa あ', weights: [400, 700] },
  { family: 'Noto Serif JP',        label: 'Noto Serif JP',   sample: 'Aa あ', weights: [400, 700] },
  { family: 'Shippori Mincho',      label: 'しっぽり明朝',     sample: 'Aa あ', weights: [400, 700] },
  { family: 'Zen Kaku Gothic New',  label: 'Zen 角ゴ',        sample: 'Aa あ', weights: [400, 700] },
  { family: 'Klee One',             label: 'Klee 鉛筆',        sample: 'Aa あ', weights: [400] },
  { family: 'Zen Maru Gothic',      label: 'Zen 丸ゴ',         sample: 'Aa あ', weights: [400, 700] },
  { family: 'Kosugi Maru',          label: '小杉 丸ゴ',        sample: 'Aa あ', weights: [400] },
  { family: 'Yusei Magic',          label: '遊星 手書き',      sample: 'Aa あ', weights: [400] },
  { family: 'Yomogi',               label: 'よもぎ 手書き',    sample: 'Aa あ', weights: [400] },
  { family: 'Playfair Display',     label: 'Playfair',        sample: 'Aa',    weights: [400, 700] },
  { family: 'Cinzel',               label: 'Cinzel',          sample: 'Aa',    weights: [400, 700] },
  { family: 'Cormorant Garamond',   label: 'Cormorant',       sample: 'Aa',    weights: [400, 700] },
  { family: 'Bebas Neue',           label: 'Bebas Neue',      sample: 'Aa',    weights: [400] },
  { family: 'Montserrat',           label: 'Montserrat',      sample: 'Aa',    weights: [400, 700] },
  { family: 'Oswald',               label: 'Oswald',          sample: 'Aa',    weights: [400, 700] },
  { family: 'Caveat',               label: 'Caveat 手書き',    sample: 'Aa',    weights: [400] },
  { family: 'Dancing Script',       label: 'Dancing Script',  sample: 'Aa',    weights: [400] },
  { family: 'Pacifico',             label: 'Pacifico',        sample: 'Aa',    weights: [400] },
];

const TEXT_PRESET_COLORS = [
  '#ffffff', '#000000', '#1F1A2E',
  '#f9c0c0', '#f5a623', '#7ed957',
  '#5eb3ff', '#a78bfa', '#ff6f91',
];

function loadGoogleFonts() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('iris-editor-fonts')) return;
  const link = document.createElement('link');
  link.id = 'iris-editor-fonts';
  link.rel = 'stylesheet';
  const families = FONTS.map(f => {
    const ws = f.weights.join(';');
    return `family=${encodeURIComponent(f.family)}:wght@${ws}`;
  }).join('&');
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  document.head.appendChild(link);
}

function uid() { return 'tx-' + Math.random().toString(36).slice(2, 9); }

interface Props {
  bg: IrisBackgroundDef;
  settings?: AppSettings;
}

export default function IrisImageEditor({ bg }: Props) {
  // ─── 画像 ───
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);

  // ─── 状態 ───
  const [aspect, setAspect] = useState<AspectId>('4:5');
  const [adjust, setAdjust] = useState<Adjust>(DEFAULT_ADJUST);
  const [filter, setFilter] = useState<FilterId>('none');
  const [texts, setTexts] = useState<TextLayer[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ToolTab>('crop');
  const [zoom, setZoom] = useState(1);
  const [showThirds, setShowThirds] = useState(false);
  const [busy, setBusy] = useState<'omakase' | 'share' | null>(null);
  const [note, setNote] = useState('');
  // 失敗したアクション (もう一度ボタン用) — 沈黙する失敗をゼロに
  const [lastFail, setLastFail] = useState<'omakase' | 'share' | null>(null);

  // ─── 履歴 (Undo / Redo) ───
  const [history, setHistory] = useState<Snapshot[]>([
    { adjust: DEFAULT_ADJUST, filter: 'none', texts: [], aspect: '4:5' },
  ]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const skipNextHistory = useRef(false);

  // 画面要素
  const stageRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 1 画面に収める — エディタ高さを画面に合わせて固定 (ページスクロールで写真を見失わない)
  const [editorH, setEditorH] = useState(0);
  useLayoutEffect(() => {
    if (!imgUrl) { setEditorH(0); return; }
    const recalc = () => {
      const top = wrapRef.current?.getBoundingClientRect().top ?? 0;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      setEditorH(Math.max(440, vh - Math.max(0, top) - 8));
    };
    recalc();
    window.addEventListener('resize', recalc);
    window.visualViewport?.addEventListener('resize', recalc);
    return () => {
      window.removeEventListener('resize', recalc);
      window.visualViewport?.removeEventListener('resize', recalc);
    };
  }, [imgUrl]);

  useEffect(() => { loadGoogleFonts(); }, []);

  // 履歴スナップショット
  useEffect(() => {
    if (skipNextHistory.current) {
      skipNextHistory.current = false;
      return;
    }
    const snap: Snapshot = { adjust, filter, texts, aspect };
    setHistory(prev => {
      const next = prev.slice(0, historyIdx + 1);
      const last = next[next.length - 1];
      if (last && JSON.stringify(last) === JSON.stringify(snap)) return prev;
      next.push(snap);
      // 最大 50 ステップ
      if (next.length > 50) next.shift();
      return next;
    });
    setHistoryIdx(idx => Math.min(idx + 1, 49));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjust, filter, texts, aspect]);

  const undo = useCallback(() => {
    if (historyIdx <= 0) return;
    const target = history[historyIdx - 1];
    skipNextHistory.current = true;
    setAdjust(target.adjust);
    setFilter(target.filter);
    setTexts(target.texts);
    setAspect(target.aspect);
    setHistoryIdx(historyIdx - 1);
  }, [history, historyIdx]);

  const redo = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    const target = history[historyIdx + 1];
    skipNextHistory.current = true;
    setAdjust(target.adjust);
    setFilter(target.filter);
    setTexts(target.texts);
    setAspect(target.aspect);
    setHistoryIdx(historyIdx + 1);
  }, [history, historyIdx]);

  // キーボード Undo / Redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.metaKey || e.ctrlKey) && (k === 'y' || (k === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedTextId && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          setTexts(prev => prev.filter(t => t.id !== selectedTextId));
          setSelectedTextId(null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, selectedTextId]);

  // ─── アップロード ───
  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setImgUrl(url);
        setImgEl(img);
        setAdjust(DEFAULT_ADJUST);
        setFilter('none');
        setTexts([]);
        setZoom(1);
        // 履歴リセット
        const fresh: Snapshot = { adjust: DEFAULT_ADJUST, filter: 'none', texts: [], aspect };
        setHistory([fresh]);
        setHistoryIdx(0);
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  };

  // ─── ピンチ + ホイール ズーム ───
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = -e.deltaY * 0.002;
      setZoom(z => Math.max(0.3, Math.min(4, z + delta)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [imgEl]);

  // ピンチ (タッチ)
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    let initialDist = 0;
    let initialZoom = 1;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialDist = Math.hypot(dx, dy);
        initialZoom = zoom;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDist > 0) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        setZoom(Math.max(0.3, Math.min(4, initialZoom * (dist / initialDist))));
      }
    };
    el.addEventListener('touchstart', onTouchStart);
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [zoom]);

  // ─── プレビュー CSS フィルタ ───
  const previewFilterCss = useMemo(() => {
    const expoMul = 1 + adjust.exposure / 100;
    const brightness = (adjust.brightness / 100) * expoMul;
    const parts = [
      `brightness(${brightness.toFixed(3)})`,
      `contrast(${(adjust.contrast / 100).toFixed(3)})`,
      `saturate(${(adjust.saturate / 100).toFixed(3)})`,
    ];
    if (adjust.blur > 0) parts.push(`blur(${adjust.blur}px)`);
    const filterCss = FILTERS.find(f => f.id === filter)?.css || 'none';
    if (filterCss !== 'none') parts.push(filterCss);
    return parts.join(' ');
  }, [adjust, filter]);

  // ─── テキスト操作 ───
  const addText = () => {
    const t: TextLayer = {
      id: uid(),
      text: 'タイトル',
      xPct: 0.5, yPct: 0.5,
      fontSize: 64,
      fontFamily: 'Noto Serif JP',
      color: '#ffffff',
      weight: 700,
      italic: false,
      align: 'center',
      shadow: true,
      bg: 'none',
      rotation: 0,
    };
    setTexts(prev => [...prev, t]);
    setSelectedTextId(t.id);
    setActiveTab('text');
  };

  const updateText = (id: string, patch: Partial<TextLayer>) => {
    setTexts(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  };

  const removeText = (id: string) => {
    setTexts(prev => prev.filter(t => t.id !== id));
    if (selectedTextId === id) setSelectedTextId(null);
  };

  // テキストドラッグ
  const dragRef = useRef<{ id: string; offX: number; offY: number; rect: DOMRect } | null>(null);
  const onTextPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    setSelectedTextId(id);
    setActiveTab('text');
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const t = texts.find(x => x.id === id);
    if (!t) return;
    dragRef.current = {
      id,
      offX: e.clientX - (rect.left + t.xPct * rect.width),
      offY: e.clientY - (rect.top + t.yPct * rect.height),
      rect,
    };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onTextPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const xPct = Math.max(0, Math.min(1, (e.clientX - d.offX - d.rect.left) / d.rect.width));
    const yPct = Math.max(0, Math.min(1, (e.clientY - d.offY - d.rect.top) / d.rect.height));
    updateText(d.id, { xPct, yPct });
  };
  const onTextPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      try { (e.target as Element).releasePointerCapture(e.pointerId); } catch { /* */ }
    }
    dragRef.current = null;
  };

  // ─── 出力サイズ計算 ───
  const outputSize = useMemo(() => {
    if (!imgEl) return { w: 0, h: 0, cropX: 0, cropY: 0, cropW: 0, cropH: 0 };
    const w = imgEl.naturalWidth, h = imgEl.naturalHeight;
    const ratio = ASPECTS.find(a => a.id === aspect)?.ratio;
    let cropW = w, cropH = h, cropX = 0, cropY = 0;
    if (ratio) {
      const imgRatio = w / h;
      if (imgRatio > ratio) {
        cropW = h * ratio;
        cropX = (w - cropW) / 2;
      } else {
        cropH = w / ratio;
        cropY = (h - cropH) / 2;
      }
    }
    const outMax = 1440;
    const scale = Math.min(1, outMax / Math.max(cropW, cropH));
    return {
      w: Math.round(cropW * scale),
      h: Math.round(cropH * scale),
      cropX, cropY, cropW, cropH,
    };
  }, [imgEl, aspect]);

  // ─── 画像書き出し (Canvas) ───
  const renderToCanvas = useCallback((): HTMLCanvasElement | null => {
    if (!imgEl) return null;
    const { w, h, cropX, cropY, cropW, cropH } = outputSize;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.filter = previewFilterCss;
    ctx.drawImage(imgEl, cropX, cropY, cropW, cropH, 0, 0, w, h);
    ctx.filter = 'none';

    // 暖色 / 寒色 オーバーレイ
    if (adjust.warmth > 0) {
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = `rgba(255, 180, 130, ${adjust.warmth / 200})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    } else if (adjust.warmth < 0) {
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = `rgba(160, 200, 255, ${-adjust.warmth / 200})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }

    // シャドウ持ち上げ (+) / 抑え (-)
    if (adjust.shadows !== 0) {
      ctx.globalCompositeOperation = adjust.shadows > 0 ? 'screen' : 'multiply';
      const a = Math.abs(adjust.shadows) / 200;
      ctx.fillStyle = adjust.shadows > 0 ? `rgba(255,255,255,${a})` : `rgba(20,20,20,${a})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (adjust.highlights !== 0) {
      ctx.globalCompositeOperation = adjust.highlights > 0 ? 'lighten' : 'darken';
      const a = Math.abs(adjust.highlights) / 200;
      ctx.fillStyle = adjust.highlights > 0 ? `rgba(255,250,240,${a})` : `rgba(40,30,30,${a})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }

    // ビネット
    if (adjust.vignette > 0) {
      const r = Math.max(w, h);
      const grad = ctx.createRadialGradient(w / 2, h / 2, r * 0.4, w / 2, h / 2, r * 0.85);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(0,0,0,${(adjust.vignette / 100) * 0.7})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    // テキスト書き込み
    const stage = stageRef.current;
    const stageW = stage?.clientWidth || 600;
    const scaleFactor = w / stageW;
    for (const t of texts) {
      ctx.save();
      const x = t.xPct * w;
      const y = t.yPct * h;
      ctx.translate(x, y);
      if (t.rotation) ctx.rotate((t.rotation * Math.PI) / 180);
      const fontSizePx = Math.round(t.fontSize * scaleFactor);
      ctx.font = `${t.italic ? 'italic ' : ''}${t.weight} ${fontSizePx}px "${t.fontFamily}"`;
      ctx.textAlign = t.align as CanvasTextAlign;
      ctx.textBaseline = 'middle';
      if (t.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = fontSizePx * 0.18;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = fontSizePx * 0.06;
      }
      const lines = t.text.split('\n');
      const lineH = fontSizePx * 1.25;
      lines.forEach((line, i) => {
        const ly = (i - (lines.length - 1) / 2) * lineH;
        if (t.bg === 'box') {
          ctx.shadowColor = 'transparent';
          const metrics = ctx.measureText(line);
          const padX = fontSizePx * 0.4;
          const padY = fontSizePx * 0.18;
          const tw = metrics.width + padX * 2;
          const th = fontSizePx * 1.05 + padY * 2;
          let bx = -tw / 2;
          if (t.align === 'left') bx = -padX;
          else if (t.align === 'right') bx = -tw + padX;
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fillRect(bx, ly - th / 2, tw, th);
          if (t.shadow) {
            ctx.shadowColor = 'rgba(0,0,0,0.55)';
            ctx.shadowBlur = fontSizePx * 0.18;
            ctx.shadowOffsetY = fontSizePx * 0.06;
          }
        }
        ctx.fillStyle = t.color;
        ctx.fillText(line, 0, ly);
      });
      ctx.restore();
    }

    return canvas;
  }, [imgEl, outputSize, previewFilterCss, adjust, texts]);

  const downloadAs = (format: 'jpg' | 'png') => {
    const canvas = renderToCanvas();
    if (!canvas) return;
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `iris-${aspect.replace(':', 'x')}-${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    }, format === 'png' ? 'image/png' : 'image/jpeg', format === 'jpg' ? 0.95 : undefined);
    setNote(`${format.toUpperCase()} を保存しました`);
  };

  const shareToInsta = async () => {
    const canvas = renderToCanvas();
    if (!canvas || busy) return;
    setBusy('share');
    setNote('');
    setLastFail(null);
    try {
      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('blob 生成失敗')), 'image/jpeg', 0.95);
      });
      const r = await shareToInstagram({
        caption: '#iris で加工',
        image: blob,
        filename: `iris-${Date.now()}.jpg`,
      });
      setNote(r.message);
    } catch (e: any) {
      setNote(`シェアできませんでした（${e?.message || '通信エラー'}）`);
      setLastFail('share');
    } finally {
      setBusy(null);
    }
  };

  // AI おまかせ最適化 (Vision)
  const omakase = async () => {
    if (!imgEl || busy) return;
    setBusy('omakase');
    setNote('');
    setLastFail(null);
    try {
      const tmp = document.createElement('canvas');
      const maxSide = 384;
      const s = Math.min(1, maxSide / Math.max(imgEl.naturalWidth, imgEl.naturalHeight));
      tmp.width = Math.round(imgEl.naturalWidth * s);
      tmp.height = Math.round(imgEl.naturalHeight * s);
      const tctx = tmp.getContext('2d');
      if (!tctx) throw new Error('canvas ctx 取得失敗');
      tctx.drawImage(imgEl, 0, 0, tmp.width, tmp.height);
      const dataUrl = tmp.toDataURL('image/jpeg', 0.82);
      const b64 = dataUrl.split(',')[1] || '';

      const sys = `あなたは Instagram フォトレタッチの達人。送られた写真を見て、最も「映える」加工パラメータを JSON で返す。
返すキー (すべて必須):
{
  "brightness": number (50-150),
  "contrast": number (50-150),
  "saturate": number (0-200),
  "exposure": number (-50 to 50),
  "shadows": number (-50 to 50),
  "highlights": number (-50 to 50),
  "warmth": number (-50 to 50),
  "vignette": number (0-100),
  "filter": "none"|"vivid"|"mono"|"faded"|"cinematic"|"pastel"|"noir"|"warm"|"cool",
  "comment": "string (15-50字)"
}
JSON だけ返し、\`\`\`json は不要。`;

      const res = await aiFetch({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
              { type: 'text', text: 'この写真に最適な加工パラメータを返してください。' },
            ],
          }],
          system: sys,
          max_tokens: 400,
        }),
      });
      const data = await res.json();
      const text: string = data?.content?.[0]?.text || data?.text || data?.message || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('AI 応答に JSON が含まれていません');
      const j = JSON.parse(match[0]);

      const next: Adjust = {
        ...adjust,
        brightness: clamp(j.brightness, 50, 150) ?? adjust.brightness,
        contrast: clamp(j.contrast, 50, 150) ?? adjust.contrast,
        saturate: clamp(j.saturate, 0, 200) ?? adjust.saturate,
        exposure: clamp(j.exposure, -50, 50) ?? adjust.exposure,
        shadows: clamp(j.shadows, -50, 50) ?? adjust.shadows,
        highlights: clamp(j.highlights, -50, 50) ?? adjust.highlights,
        warmth: clamp(j.warmth, -50, 50) ?? adjust.warmth,
        vignette: clamp(j.vignette, 0, 100) ?? adjust.vignette,
      };
      setAdjust(next);
      const fid = ['none','vivid','mono','faded','cinematic','pastel','noir','warm','cool'].includes(j.filter) ? j.filter : 'none';
      setFilter(fid as FilterId);
      setNote(`おまかせ完了 — ${j.comment || '画像に合わせて最適化しました'}`);
    } catch (e: any) {
      setNote(`おまかせできませんでした（${e?.message || '通信エラー'}）`);
      setLastFail('omakase');
    } finally {
      setBusy(null);
    }
  };

  // 失敗したアクションをワンタップで再実行
  const retryLastFail = () => {
    const action = lastFail;
    setLastFail(null);
    setNote('');
    if (action === 'omakase') omakase();
    else if (action === 'share') shareToInsta();
  };

  const selectedText = texts.find(t => t.id === selectedTextId);
  const stageAspect = ASPECTS.find(a => a.id === aspect)?.ratio || (imgEl ? imgEl.naturalWidth / imgEl.naturalHeight : 1);

  // ─── レンダリング ───
  if (!imgUrl) {
    // 初見の人が触る前に「このツールで何が起きるか」を 3 秒で掴めるように
    const canDo = [
      { Icon: Brain, title: '明るさ・色を自動で', body: '「おまかせ」を押すだけ。AI が映える明るさ・色に補正します。' },
      { Icon: Type,  title: '写真に文字をのせる', body: 'フォント・色・位置を自由に。投稿の主役になる 1 枚に。' },
      { Icon: CropIcon, title: 'SNSの映えサイズに', body: '正方形 / 縦長 / ストーリーをワンタップで切り替え。' },
    ];
    return (
      <div style={wrap}>
        <Header bg={bg} title="画像エディタ" subtitle="写真を選ぶだけ。明るさも文字もサイズも、ここで仕上がる" />
        <label style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '3.4rem 2rem', textAlign: 'center', cursor: 'pointer',
          border: `2px dashed ${bg.cardBorder}`, borderRadius: 22,
          background: bg.card, color: bg.inkSoft, minHeight: 220,
        }}>
          <Upload size={48} color={bg.accent} />
          <div style={{ fontSize: '1.4rem', color: bg.ink, marginTop: '1rem', fontWeight: 600 }}>
            まず写真を選んでください
          </div>
          <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
            JPG / PNG / WebP / HEIC ・ クリックまたはドラッグ
          </div>
          <span style={{
            marginTop: '0.9rem', fontSize: '0.8rem', fontWeight: 700,
            color: bg.accent, padding: '0.3rem 0.85rem', borderRadius: 999,
            background: `${bg.accent}15`,
          }}>
            選んだあと「おまかせ」で AI が自動補正
          </span>
          <input type="file" accept="image/*" onChange={onUpload} style={{ display: 'none' }} />
        </label>

        {/* このツールでできること — 触る前に 3 秒で分かる */}
        <p style={{ color: bg.inkSoft, fontSize: '0.8rem', fontWeight: 700, margin: '1rem 0 0.5rem', letterSpacing: '0.04em' }}>
          このツールでできること
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
          {canDo.map(c => (
            <div key={c.title} style={{
              display: 'flex', gap: '0.65rem', alignItems: 'flex-start',
              padding: '0.85rem 0.9rem', borderRadius: 14,
              background: bg.card, border: `1px solid ${bg.cardBorder}`,
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${bg.accent}15`, color: bg.accent,
              }}>
                <c.Icon size={18} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: bg.ink, marginBottom: 2 }}>{c.title}</div>
                <div style={{ fontSize: '0.76rem', color: bg.inkSoft, lineHeight: 1.5 }}>{c.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} style={{ ...wrap, ...(editorH ? { height: editorH } : {}) }}>
      {/* トップバー — 1 行固定・横スクロール */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'nowrap',
        padding: '0.45rem 0.6rem', background: bg.card,
        border: `1px solid ${bg.cardBorder}`, borderRadius: 16,
        flex: 'none', overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        <label style={{ ...topBtn(bg), flex: 'none' }}>
          <Upload size={14} /> 別の写真
          <input type="file" accept="image/*" onChange={onUpload} style={{ display: 'none' }} />
        </label>

        <div style={{ display: 'inline-flex', gap: 4, marginLeft: '0.2rem', flex: 'none' }}>
          <button
            style={{ ...iconBtn(bg), opacity: historyIdx <= 0 ? 0.4 : 1 }}
            onClick={undo}
            disabled={historyIdx <= 0}
            aria-label="元に戻す"
            title="元に戻す (⌘Z)"
          ><Undo2 size={16} /></button>
          <button
            style={{ ...iconBtn(bg), opacity: historyIdx >= history.length - 1 ? 0.4 : 1 }}
            onClick={redo}
            disabled={historyIdx >= history.length - 1}
            aria-label="やり直す"
            title="やり直す (⌘⇧Z)"
          ><Redo2 size={16} /></button>
        </div>

        <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, flexWrap: 'nowrap', flex: 'none' }}>
          <button onClick={omakase} disabled={!!busy} style={{
            ...topBtn(bg), flex: 'none',
            background: busy === 'omakase' ? bg.accent + '90' : `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
            color: '#fff',
            border: 'none',
            opacity: busy ? 0.7 : 1,
          }}>
            {busy === 'omakase' ? <Loader2 size={14} className="iris-spin" /> : <Brain size={14} />}
            おまかせ
          </button>
          <button onClick={() => downloadAs('png')} style={{ ...topBtn(bg), flex: 'none' }}>
            <Download size={14} /> PNG
          </button>
          <button onClick={() => downloadAs('jpg')} style={{ ...topBtn(bg), flex: 'none' }}>
            <Download size={14} /> JPG
          </button>
          <button onClick={shareToInsta} disabled={!!busy} style={{
            ...topBtn(bg), flex: 'none',
            background: 'linear-gradient(135deg, #f58529 0%, #dd2a7b 50%, #8134af 100%)',
            color: '#fff',
            border: 'none',
            opacity: busy ? 0.7 : 1,
          }}>
            {busy === 'share' ? <Loader2 size={14} className="iris-spin" /> : <Send size={14} />}
            Insta
          </button>
        </div>
      </div>

      {/* メイン: プレビュー + ツールバー (モバイル=縦 / PC=横2カラム) */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        flex: 1,
        minHeight: 0,
      }}
      className="iris-canva-layout"
      >
        {/* プレビュー — 1 画面の上 約58%。スクロールしても写真は動かない */}
        <div
          ref={previewRef}
          className="iris-canva-preview"
          style={{
            position: 'relative',
            background: 'linear-gradient(135deg, #1a1422, #2a1f30)',
            borderRadius: 18,
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flex: '0 0 58%',
            minHeight: 0,
            touchAction: 'none',
          }}
          onClick={() => setSelectedTextId(null)}
        >
          {/* ステージ (アスペクト枠) */}
          <div
            ref={stageRef}
            style={{
              position: 'relative',
              transform: `scale(${zoom})`,
              transformOrigin: 'center',
              transition: 'transform 0.12s ease-out',
              maxWidth: '92%',
              maxHeight: '92%',
              aspectRatio: `${stageAspect}`,
              width: stageAspect >= 1 ? 'min(92%, calc(70dvh * ' + stageAspect + '))' : 'auto',
              height: stageAspect < 1 ? 'min(70dvh, 88%)' : 'auto',
              overflow: 'hidden',
              borderRadius: 6,
              boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
              background: '#000',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* 画像 (CSS フィルタで実時間プレビュー) */}
            <img
              src={imgUrl}
              alt=""
              draggable={false}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover',
                filter: previewFilterCss,
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            />

            {/* 暖色/寒色 オーバーレイ */}
            {adjust.warmth !== 0 && (
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                mixBlendMode: 'overlay',
                background: adjust.warmth > 0
                  ? `rgba(255,180,130,${adjust.warmth / 200})`
                  : `rgba(160,200,255,${-adjust.warmth / 200})`,
              }} />
            )}

            {/* シャドウ / ハイライト オーバーレイ */}
            {adjust.shadows !== 0 && (
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                mixBlendMode: adjust.shadows > 0 ? 'screen' : 'multiply',
                background: adjust.shadows > 0
                  ? `rgba(255,255,255,${Math.abs(adjust.shadows) / 200})`
                  : `rgba(20,20,20,${Math.abs(adjust.shadows) / 200})`,
              }} />
            )}
            {adjust.highlights !== 0 && (
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                mixBlendMode: adjust.highlights > 0 ? 'lighten' : 'darken',
                background: adjust.highlights > 0
                  ? `rgba(255,250,240,${Math.abs(adjust.highlights) / 200})`
                  : `rgba(40,30,30,${Math.abs(adjust.highlights) / 200})`,
              }} />
            )}

            {/* ビネット */}
            {adjust.vignette > 0 && (
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${(adjust.vignette / 100) * 0.7}) 100%)`,
              }} />
            )}

            {/* 3 分割ガイド */}
            {showThirds && (
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox="0 0 100 100" preserveAspectRatio="none">
                <line x1="33.3" y1="0" x2="33.3" y2="100" stroke="rgba(255,255,255,0.4)" strokeWidth="0.2" />
                <line x1="66.7" y1="0" x2="66.7" y2="100" stroke="rgba(255,255,255,0.4)" strokeWidth="0.2" />
                <line x1="0" y1="33.3" x2="100" y2="33.3" stroke="rgba(255,255,255,0.4)" strokeWidth="0.2" />
                <line x1="0" y1="66.7" x2="100" y2="66.7" stroke="rgba(255,255,255,0.4)" strokeWidth="0.2" />
              </svg>
            )}

            {/* テキストレイヤー */}
            {texts.map(t => {
              const stage = stageRef.current;
              const stageW = stage?.clientWidth || 1;
              const sizePx = (t.fontSize / 1080) * stageW * 1.5;
              const isSel = t.id === selectedTextId;
              return (
                <div
                  key={t.id}
                  onPointerDown={e => onTextPointerDown(e, t.id)}
                  onPointerMove={onTextPointerMove}
                  onPointerUp={onTextPointerUp}
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    left: `${t.xPct * 100}%`,
                    top: `${t.yPct * 100}%`,
                    transform: `translate(-50%, -50%) rotate(${t.rotation}deg)`,
                    fontFamily: `"${t.fontFamily}", sans-serif`,
                    fontSize: `${sizePx}px`,
                    fontWeight: t.weight,
                    fontStyle: t.italic ? 'italic' : 'normal',
                    color: t.color,
                    textAlign: t.align,
                    whiteSpace: 'pre',
                    lineHeight: 1.25,
                    cursor: dragRef.current?.id === t.id ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    touchAction: 'none',
                    padding: t.bg === 'box' ? `${sizePx * 0.18}px ${sizePx * 0.4}px` : 0,
                    background: t.bg === 'box' ? 'rgba(0,0,0,0.4)' : 'transparent',
                    textShadow: t.shadow ? `0 ${sizePx * 0.06}px ${sizePx * 0.18}px rgba(0,0,0,0.55)` : 'none',
                    outline: isSel ? '2px dashed #ff77c8' : 'none',
                    outlineOffset: '4px',
                    maxWidth: '88%',
                  }}
                >{t.text}</div>
              );
            })}
          </div>

          {/* プレビュー右上: ズームコントロール + ガイド */}
          <div style={{
            position: 'absolute', top: 10, right: 10,
            display: 'flex', gap: 4,
            background: 'rgba(0,0,0,0.5)', borderRadius: 999, padding: 4,
          }}>
            <button onClick={() => setZoom(z => Math.max(0.3, z - 0.2))} style={miniBtn} title="縮小"><ZoomOut size={14} /></button>
            <span style={{ color: '#fff', fontSize: 11, padding: '0 8px', alignSelf: 'center', minWidth: 36, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={() => setZoom(z => Math.min(4, z + 0.2))} style={miniBtn} title="拡大"><ZoomIn size={14} /></button>
            <button onClick={() => setZoom(1)} style={miniBtn} title="100%">1:1</button>
            <button
              onClick={() => setShowThirds(v => !v)}
              style={{ ...miniBtn, background: showThirds ? bg.accent : 'transparent' }}
              title="3 分割ガイド"
            ><Grid3x3 size={14} /></button>
          </div>

          {/* プレビュー左上: アスペクト名 */}
          <div style={{
            position: 'absolute', top: 10, left: 10,
            background: 'rgba(0,0,0,0.5)', color: '#fff',
            borderRadius: 999, padding: '4px 12px',
            fontSize: 12, fontWeight: 600,
          }}>
            {ASPECTS.find(a => a.id === aspect)?.label} · {outputSize.w}×{outputSize.h}
          </div>

          {/* 通知バッジ — 失敗時は「もう一度」復旧ボタン付き */}
          {note && (
            <div style={{
              position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
              background: lastFail ? 'rgba(190,40,55,0.92)' : 'rgba(0,0,0,0.7)', color: '#fff',
              padding: lastFail ? '8px 10px 8px 14px' : '6px 14px', borderRadius: 999, fontSize: 12,
              maxWidth: '92%', display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: lastFail ? '0 4px 16px rgba(190,40,55,0.35)' : 'none',
            }}>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note}</span>
              {lastFail && (
                <>
                  <button
                    onClick={retryLastFail}
                    disabled={!!busy}
                    style={{
                      flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: '#fff', color: '#be2837', border: 'none',
                      borderRadius: 999, padding: '5px 11px', fontSize: 12, fontWeight: 800,
                      cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
                    }}
                  >
                    <RefreshCw size={13} strokeWidth={2.6} /> もう一度
                  </button>
                  <button
                    onClick={() => { setNote(''); setLastFail(null); }}
                    aria-label="閉じる"
                    style={{
                      flex: 'none', display: 'inline-flex', background: 'transparent',
                      color: '#fff', border: 'none', cursor: 'pointer', opacity: 0.85, padding: 2,
                    }}
                  ><X size={14} /></button>
                </>
              )}
            </div>
          )}
        </div>

        {/* ツールバー — 1 画面の下。タブを切り替え、この中だけスクロール */}
        <div className="iris-canva-panel" style={{
          background: bg.card,
          border: `1px solid ${bg.cardBorder}`,
          borderRadius: 18,
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}>
          {/* タブ */}
          <div style={{
            display: 'flex', gap: 2, padding: 6,
            borderBottom: `1px solid ${bg.cardBorder}`,
            background: 'rgba(255,255,255,0.4)',
            overflowX: 'auto',
          }}>
            {([
              { id: 'crop'    as ToolTab, label: '比率', icon: <CropIcon size={14} /> },
              { id: 'filter'  as ToolTab, label: 'フィルター', icon: <Wand2 size={14} /> },
              { id: 'adjust'  as ToolTab, label: '明るさ', icon: <Sliders size={14} /> },
              { id: 'text'    as ToolTab, label: '文字', icon: <Type size={14} /> },
              { id: 'effects' as ToolTab, label: '効果', icon: <Sparkles size={14} /> },
            ]).map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  flex: '1 1 auto',
                  padding: '0.55rem 0.4rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 10,
                  background: activeTab === t.id ? bg.accent : 'transparent',
                  color: activeTab === t.id ? '#fff' : bg.ink,
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  whiteSpace: 'nowrap',
                  minHeight: 36,
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* タブコンテンツ (この内側だけスクロール) */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.8rem 0.9rem', minHeight: 0 }}>
            {activeTab === 'crop' && (
              <div style={{ display: 'grid', gap: 8 }}>
                <p style={tipText(bg)}>SNS の「映え」サイズを選んでください。</p>
                {ASPECTS.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setAspect(a.id)}
                    style={{
                      ...listItem(bg, aspect === a.id),
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <AspectThumb ratio={a.ratio} accent={bg.accent} active={aspect === a.id} />
                      <span style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{a.label}</span>
                        <span style={{ fontSize: 11, opacity: 0.75 }}>{a.sub}</span>
                      </span>
                    </span>
                    {a.ratio && (
                      <span style={{ fontSize: 11, opacity: 0.6 }}>
                        {a.id === '1:1' ? '1080×1080' : a.id === '4:5' ? '1080×1350' : a.id === '9:16' ? '1080×1920' : '1920×1080'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'filter' && (
              <div>
                <p style={tipText(bg)}>タップで即適用。リアルタイムで変わります。</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                  {FILTERS.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id)}
                      style={{
                        ...listItem(bg, filter === f.id),
                        padding: 0, overflow: 'hidden',
                      }}
                    >
                      <div style={{
                        position: 'relative', width: '100%', aspectRatio: '1',
                        background: `url(${imgUrl}) center/cover`,
                        filter: f.css,
                      }} />
                      <div style={{
                        padding: '6px 8px',
                        fontSize: 12,
                        fontWeight: 600,
                        textAlign: 'center',
                        background: filter === f.id ? bg.accent : 'rgba(255,255,255,0.6)',
                        color: filter === f.id ? '#fff' : bg.ink,
                      }}>{f.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'adjust' && (
              <div style={{ display: 'grid', gap: 14 }}>
                <Slider label="明るさ"        value={adjust.brightness} min={50} max={150}  onChange={v => setAdjust(a => ({ ...a, brightness: v }))}  bg={bg} suffix="%" />
                <Slider label="コントラスト"  value={adjust.contrast}   min={50} max={150}  onChange={v => setAdjust(a => ({ ...a, contrast: v }))}    bg={bg} suffix="%" />
                <Slider label="彩度"          value={adjust.saturate}   min={0}  max={200}  onChange={v => setAdjust(a => ({ ...a, saturate: v }))}    bg={bg} suffix="%" />
                <Slider label="露出"          value={adjust.exposure}   min={-50} max={50}  onChange={v => setAdjust(a => ({ ...a, exposure: v }))}    bg={bg} />
                <Slider label="シャドウ"      value={adjust.shadows}    min={-50} max={50}  onChange={v => setAdjust(a => ({ ...a, shadows: v }))}     bg={bg} />
                <Slider label="ハイライト"    value={adjust.highlights} min={-50} max={50}  onChange={v => setAdjust(a => ({ ...a, highlights: v }))}  bg={bg} />
                <button
                  onClick={() => setAdjust(DEFAULT_ADJUST)}
                  style={{ ...listItem(bg, false), justifyContent: 'center', fontWeight: 600, fontSize: 13 }}
                >すべてリセット</button>
              </div>
            )}

            {activeTab === 'text' && (
              <div style={{ display: 'grid', gap: 10 }}>
                <button onClick={addText} style={{
                  background: bg.accent, color: '#fff', border: 'none',
                  padding: '0.7rem', borderRadius: 12,
                  fontWeight: 700, cursor: 'pointer', fontSize: 14,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  <Plus size={16} /> 文字を追加
                </button>

                {texts.length === 0 ? (
                  <p style={{ ...tipText(bg), textAlign: 'center', padding: '1.5rem 0' }}>
                    まだ文字がありません。<br />「文字を追加」を押してください。
                  </p>
                ) : !selectedText ? (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <p style={tipText(bg)}>下から文字を選んで編集</p>
                    {texts.map(t => (
                      <div key={t.id} style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => setSelectedTextId(t.id)}
                          style={{ ...listItem(bg, false), flex: 1, justifyContent: 'flex-start' }}
                        >
                          <span style={{ fontFamily: `"${t.fontFamily}"`, fontSize: 13 }}>
                            {t.text || '(空)'}
                          </span>
                        </button>
                        <button onClick={() => removeText(t.id)} style={{ ...iconBtn(bg) }} aria-label="削除">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <textarea
                      value={selectedText.text}
                      onChange={e => updateText(selectedText.id, { text: e.target.value })}
                      placeholder="ここに文字を入れる"
                      rows={2}
                      style={{
                        width: '100%', padding: '0.6rem 0.8rem',
                        border: `1px solid ${bg.cardBorder}`, borderRadius: 10,
                        background: 'rgba(255,255,255,0.85)', color: bg.ink,
                        fontSize: 14, fontFamily: 'inherit', resize: 'vertical',
                      }}
                    />

                    {/* フォント選択 */}
                    <div>
                      <Label bg={bg}>フォント</Label>
                      <div style={{
                        maxHeight: 160, overflowY: 'auto',
                        border: `1px solid ${bg.cardBorder}`, borderRadius: 10,
                        background: 'rgba(255,255,255,0.55)',
                      }}>
                        {FONTS.map(f => (
                          <button
                            key={f.family}
                            onClick={() => updateText(selectedText.id, { fontFamily: f.family })}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              width: '100%', padding: '0.5rem 0.7rem',
                              background: selectedText.fontFamily === f.family ? bg.accent + '22' : 'transparent',
                              border: 'none', borderBottom: `1px solid ${bg.cardBorder}`,
                              cursor: 'pointer', textAlign: 'left',
                              color: bg.ink,
                            }}
                          >
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{f.label}</span>
                            <span style={{ fontFamily: `"${f.family}"`, fontSize: 17 }}>{f.sample}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* サイズ */}
                    <Slider label="サイズ" value={selectedText.fontSize} min={16} max={240} onChange={v => updateText(selectedText.id, { fontSize: v })} bg={bg} suffix="px" />

                    {/* 色 */}
                    <div>
                      <Label bg={bg}>色</Label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        {TEXT_PRESET_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => updateText(selectedText.id, { color: c })}
                            style={{
                              width: 28, height: 28, borderRadius: 8,
                              background: c, cursor: 'pointer',
                              border: selectedText.color === c ? `2px solid ${bg.accent}` : `1px solid ${bg.cardBorder}`,
                            }}
                            aria-label={`色 ${c}`}
                          />
                        ))}
                        <input
                          type="color"
                          value={selectedText.color}
                          onChange={e => updateText(selectedText.id, { color: e.target.value })}
                          style={{ width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                        />
                      </div>
                    </div>

                    {/* 配置 + 太字 / イタリック */}
                    <div>
                      <Label bg={bg}>装飾と配置</Label>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <ToggleBtn bg={bg} active={selectedText.weight === 700} onClick={() => updateText(selectedText.id, { weight: selectedText.weight === 700 ? 400 : 700 })} title="太字"><Bold size={14} /></ToggleBtn>
                        <ToggleBtn bg={bg} active={selectedText.italic} onClick={() => updateText(selectedText.id, { italic: !selectedText.italic })} title="斜体"><Italic size={14} /></ToggleBtn>
                        <ToggleBtn bg={bg} active={selectedText.shadow} onClick={() => updateText(selectedText.id, { shadow: !selectedText.shadow })} title="影">{selectedText.shadow ? <Eye size={14} /> : <EyeOff size={14} />}影</ToggleBtn>
                        <ToggleBtn bg={bg} active={selectedText.bg === 'box'} onClick={() => updateText(selectedText.id, { bg: selectedText.bg === 'box' ? 'none' : 'box' })} title="背景">背景</ToggleBtn>
                        <span style={{ width: 1, background: bg.cardBorder, margin: '0 4px' }} />
                        <ToggleBtn bg={bg} active={selectedText.align === 'left'}   onClick={() => updateText(selectedText.id, { align: 'left' })}   title="左揃え"><AlignLeft size={14} /></ToggleBtn>
                        <ToggleBtn bg={bg} active={selectedText.align === 'center'} onClick={() => updateText(selectedText.id, { align: 'center' })} title="中央"><AlignCenter size={14} /></ToggleBtn>
                        <ToggleBtn bg={bg} active={selectedText.align === 'right'}  onClick={() => updateText(selectedText.id, { align: 'right' })}  title="右揃え"><AlignRight size={14} /></ToggleBtn>
                      </div>
                    </div>

                    <Slider label="回転" value={selectedText.rotation} min={-180} max={180} onChange={v => updateText(selectedText.id, { rotation: v })} bg={bg} suffix="°" />

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setSelectedTextId(null)} style={{ ...listItem(bg, false), flex: 1, justifyContent: 'center', fontWeight: 600 }}>
                        一覧に戻る
                      </button>
                      <button onClick={() => removeText(selectedText.id)} style={{
                        ...listItem(bg, false), flex: 1, justifyContent: 'center',
                        color: '#c1473e', fontWeight: 600,
                      }}>
                        <Trash2 size={14} /> 削除
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'effects' && (
              <div style={{ display: 'grid', gap: 14 }}>
                <Slider label="暖色 / 寒色" value={adjust.warmth}   min={-50} max={50}  onChange={v => setAdjust(a => ({ ...a, warmth: v }))}   bg={bg} />
                <Slider label="ぼかし"      value={adjust.blur}     min={0}   max={10}  onChange={v => setAdjust(a => ({ ...a, blur: v }))}     bg={bg} suffix="px" />
                <Slider label="ビネット"    value={adjust.vignette} min={0}   max={100} onChange={v => setAdjust(a => ({ ...a, vignette: v }))} bg={bg} suffix="%" />
                <p style={tipText(bg)}>
                  「暖色」は夕陽風、「寒色」は朝の青み、「ビネット」は周辺を暗くしてポートレート風に。
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* レスポンシブ: PC 2 カラム / モバイル 縦 (上プレビュー固定 + 下ツールバー) */}
      <style>{`
        @media (min-width: 900px) {
          .iris-canva-layout {
            display: grid !important;
            grid-template-columns: minmax(0, 1.5fr) minmax(300px, 360px) !important;
            grid-auto-rows: minmax(0, 1fr);
          }
          .iris-canva-preview { flex: 1 1 auto !important; }
          .iris-canva-panel { flex: 1 1 auto !important; }
        }
        .iris-spin { animation: iris-spin 0.9s linear infinite; }
        @keyframes iris-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function clamp(n: any, lo: number, hi: number): number | undefined {
  if (typeof n !== 'number' || Number.isNaN(n)) return undefined;
  return Math.max(lo, Math.min(hi, n));
}

// ─── 共通スタイル ───
const wrap: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '0.7rem',
};

function topBtn(bg: IrisBackgroundDef): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '0.45rem 0.85rem',
    background: 'rgba(255,255,255,0.7)',
    border: `1px solid ${bg.cardBorder}`,
    borderRadius: 999,
    fontSize: 12, fontWeight: 600, color: bg.ink,
    cursor: 'pointer',
    minHeight: 36,
  };
}

function iconBtn(bg: IrisBackgroundDef): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 36, height: 36, minHeight: 36,
    background: 'rgba(255,255,255,0.7)',
    border: `1px solid ${bg.cardBorder}`,
    borderRadius: 10,
    color: bg.ink,
    cursor: 'pointer',
  };
}

const miniBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#fff',
  cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: '4px 8px',
  borderRadius: 999,
  fontSize: 11,
  minWidth: 36, minHeight: 36,
};

function listItem(bg: IrisBackgroundDef, active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '0.6rem 0.7rem',
    width: '100%',
    background: active ? bg.accent + '22' : 'rgba(255,255,255,0.55)',
    border: `1px solid ${active ? bg.accent : bg.cardBorder}`,
    borderRadius: 12,
    color: bg.ink,
    cursor: 'pointer',
    fontSize: 13,
    textAlign: 'left',
  };
}

function tipText(bg: IrisBackgroundDef): React.CSSProperties {
  return {
    color: bg.inkSoft, fontSize: 12, lineHeight: 1.6, margin: 0,
  };
}

function Header({ bg, title, subtitle }: { bg: IrisBackgroundDef; title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: '0.4rem' }}>
      <p style={{ fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: bg.accent, margin: 0 }}>
        {subtitle}
      </p>
      <h2 style={{ fontSize: '1.6rem', color: bg.ink, margin: 0, fontWeight: 700 }}>{title}</h2>
    </div>
  );
}

function Label({ bg, children }: { bg: IrisBackgroundDef; children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, color: bg.inkSoft, marginBottom: 6, fontWeight: 600, letterSpacing: '0.05em' }}>
      {children}
    </div>
  );
}

function ToggleBtn({ bg, active, onClick, children, title }: {
  bg: IrisBackgroundDef; active: boolean; onClick: () => void; children: React.ReactNode; title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '0.35rem 0.55rem',
        background: active ? bg.accent : 'rgba(255,255,255,0.7)',
        color: active ? '#fff' : bg.ink,
        border: `1px solid ${active ? bg.accent : bg.cardBorder}`,
        borderRadius: 8, cursor: 'pointer',
        fontSize: 12, fontWeight: 600,
        minHeight: 32,
      }}
    >{children}</button>
  );
}

function Slider({ label, value, min, max, onChange, suffix, bg }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string;
  bg: IrisBackgroundDef;
}) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: bg.inkSoft, marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color: bg.ink }}>{value}{suffix || ''}</span>
      </div>
      <input
        type="range"
        min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: bg.accent }}
      />
    </label>
  );
}

function AspectThumb({ ratio, accent, active }: { ratio: number | null; accent: string; active: boolean }) {
  if (!ratio) {
    return (
      <div style={{
        width: 28, height: 28, borderRadius: 4,
        border: `2px dashed ${active ? accent : '#999'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, color: active ? accent : '#888',
      }}>FREE</div>
    );
  }
  const maxSide = 28;
  const w = ratio >= 1 ? maxSide : maxSide * ratio;
  const h = ratio >= 1 ? maxSide / ratio : maxSide;
  return (
    <div style={{
      width: w, height: h, borderRadius: 3,
      border: `2px solid ${active ? accent : '#999'}`,
      background: active ? accent + '33' : 'transparent',
    }} />
  );
}
