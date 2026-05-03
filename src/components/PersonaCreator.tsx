import { useState } from 'react';
import { motion } from 'framer-motion';
import { ICON_OPTIONS, getNextAccentColor } from '../hooks/usePersonas';
import type { Persona } from '../types/identity';

const ACCENT_COLORS = [
  { color: '#4a9eff', light: 'rgba(74, 158, 255, 0.15)', label: '青' },
  { color: '#c9a96e', light: 'rgba(201, 169, 110, 0.15)', label: '金' },
  { color: '#a78bfa', light: 'rgba(167, 139, 250, 0.15)', label: '紫' },
  { color: '#34d399', light: 'rgba(52, 211, 153, 0.15)', label: '緑' },
  { color: '#f87171', light: 'rgba(248, 113, 113, 0.15)', label: '赤' },
  { color: '#fb923c', light: 'rgba(251, 146, 60, 0.15)', label: '橙' },
  { color: '#e879f9', light: 'rgba(232, 121, 249, 0.15)', label: '桃' },
  { color: '#2dd4bf', light: 'rgba(45, 212, 191, 0.15)', label: '水' },
];

type Preset = {
  name: string;
  subtitle: string;
  icon: string;
  description: string;
  colorIndex: number;
};

const PRESETS: Preset[] = [
  {
    name: '不動産COO',
    subtitle: 'Real Estate Operations',
    icon: '◈',
    description: '不動産投資のプロとして、数字とデータに基づいた戦略的な提案を行う。利回り・キャッシュフロー・法的リスクを考慮した実践的なアドバイスを提供する。',
    colorIndex: 0,
  },
  {
    name: '医師',
    subtitle: 'Medical Advisor',
    icon: '⚕',
    description: '医学的知見に基づき、症状・原因・対処法を客観的に説明する。エビデンスを重視し、必要に応じて受診を促す慎重なアドバイザー。',
    colorIndex: 4,
  },
  {
    name: 'CTO',
    subtitle: 'Chief Technology Officer',
    icon: '⬡',
    description: 'エンジニアリング全体を統括する立場で、アーキテクチャ・技術選定・チーム生産性の観点から戦略的に判断する。',
    colorIndex: 2,
  },
  {
    name: 'クリエイター',
    subtitle: 'Creative Director',
    icon: '✦',
    description: 'ブランド・世界観・ストーリーを軸に、感情に訴えるアウトプットを作る。デザインとコピーの両方に強い。',
    colorIndex: 6,
  },
  {
    name: '起業家',
    subtitle: 'Entrepreneur',
    icon: '★',
    description: 'ゼロイチで事業を立ち上げる視点で、市場・顧客・実行可能性をシビアに見極める。仮説検証とスピードを重視。',
    colorIndex: 5,
  },
  {
    name: '投資家',
    subtitle: 'Investor',
    icon: '◆',
    description: '財務・市場・経営チームを冷静に分析し、長期的なリターンとリスクの観点から判断する。',
    colorIndex: 1,
  },
];

interface Props {
  existingPersonas: Persona[];
  onSave: (name: string, subtitle: string, icon: string, description: string, accentColor: string, accentColorLight: string) => void;
  onCancel: () => void;
}

export default function PersonaCreator({ existingPersonas, onSave, onCancel }: Props) {
  const defaultColor = getNextAccentColor(existingPersonas);
  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [icon, setIcon] = useState(ICON_OPTIONS[existingPersonas.length % ICON_OPTIONS.length]);
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(defaultColor);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const canSave = name.trim().length > 0;

  const applyPreset = (p: Preset) => {
    setName(p.name);
    setSubtitle(p.subtitle);
    setIcon(p.icon);
    setDescription(p.description);
    setSelectedColor(ACCENT_COLORS[p.colorIndex]);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: '#15151c',
          border: '1px solid rgba(255,255,255,0.1)',
          maxHeight: 'calc(100dvh - 2rem)',
          color: '#ffffff',
        }}
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div>
            <h3 className="text-white text-lg font-medium tracking-wide">新しい人格を作成</h3>
            <p className="text-white/50 text-xs mt-0.5">プリセットから選ぶか、自分でカスタマイズ</p>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all text-xl leading-none"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        {/* スクロール領域 */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-5">
          {/* ライブプレビュー */}
          <div
            className="flex items-center gap-3 p-4 rounded-xl"
            style={{
              background: selectedColor.light,
              border: `1px solid ${selectedColor.color}40`,
            }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: `${selectedColor.color}25`, color: selectedColor.color }}
            >
              {icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-base font-medium truncate">
                {name || '人格名'}
              </p>
              <p className="text-sm truncate" style={{ color: selectedColor.color }}>
                {subtitle || 'サブタイトル'}
              </p>
            </div>
          </div>

          {/* プリセット */}
          <div>
            <p className="text-white/70 text-xs tracking-wider uppercase mb-2">クイック選択</p>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map(p => {
                const c = ACCENT_COLORS[p.colorIndex];
                const active = name === p.name && subtitle === p.subtitle;
                return (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(p)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all"
                    style={{
                      background: active ? c.light : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${active ? c.color : 'rgba(255,255,255,0.08)'}`,
                    }}
                  >
                    <span
                      className="w-7 h-7 rounded-md flex items-center justify-center text-sm flex-shrink-0"
                      style={{ background: `${c.color}25`, color: c.color }}
                    >
                      {p.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-white text-sm leading-tight truncate">{p.name}</span>
                      <span className="block text-white/50 text-[10px] truncate">{p.subtitle}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 名前 + サブタイトル */}
          <div className="space-y-3">
            <div>
              <label className="block text-white/70 text-xs tracking-wider uppercase mb-1.5">人格名 *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="例：不動産COO、医師、起業家..."
                className="w-full bg-white/5 text-white text-sm font-light outline-none rounded-lg px-3 py-2.5 placeholder:text-white/30 transition-all"
                style={{ border: `1px solid ${name ? selectedColor.color + '80' : 'rgba(255,255,255,0.08)'}` }}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-white/70 text-xs tracking-wider uppercase mb-1.5">サブタイトル</label>
              <input
                type="text"
                value={subtitle}
                onChange={e => setSubtitle(e.target.value)}
                placeholder="例：Real Estate Operations"
                className="w-full bg-white/5 text-white text-sm font-light outline-none rounded-lg px-3 py-2.5 placeholder:text-white/30 transition-all"
                style={{ border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </div>
          </div>

          {/* カラー */}
          <div>
            <p className="text-white/70 text-xs tracking-wider uppercase mb-2">カラー</p>
            <div className="flex gap-2 flex-wrap">
              {ACCENT_COLORS.map(c => (
                <button
                  key={c.color}
                  onClick={() => setSelectedColor(c)}
                  aria-label={c.label}
                  className="w-8 h-8 rounded-full transition-all relative"
                  style={{
                    background: c.color,
                    boxShadow: selectedColor.color === c.color ? `0 0 0 2px #15151c, 0 0 0 4px ${c.color}` : 'none',
                  }}
                />
              ))}
            </div>
          </div>

          {/* アイコン */}
          <div>
            <p className="text-white/70 text-xs tracking-wider uppercase mb-2">アイコン</p>
            <div className="grid grid-cols-7 gap-2">
              {ICON_OPTIONS.map(ic => {
                const active = icon === ic;
                return (
                  <button
                    key={ic}
                    onClick={() => setIcon(ic)}
                    className="aspect-square rounded-lg text-base flex items-center justify-center transition-all"
                    style={{
                      background: active ? selectedColor.light : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${active ? selectedColor.color : 'rgba(255,255,255,0.08)'}`,
                      color: active ? selectedColor.color : 'rgba(255,255,255,0.7)',
                    }}
                  >
                    {ic}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 詳細(任意) */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="flex items-center gap-1 text-white/60 hover:text-white text-xs tracking-wider uppercase transition-colors"
            >
              <span>{showAdvanced ? '▾' : '▸'}</span>
              AIへの人格説明 (任意)
            </button>
            {showAdvanced && (
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="例：不動産投資のプロとして、数字とデータに基づいた戦略的な提案を行う。利回り・キャッシュフロー・法的リスクを考慮した実践的なアドバイスを提供する。"
                className="mt-2 w-full bg-white/5 text-white text-sm font-light outline-none rounded-lg px-3 py-2.5 placeholder:text-white/30 resize-none"
                style={{ border: '1px solid rgba(255,255,255,0.08)', minHeight: '90px' }}
                rows={4}
              />
            )}
          </div>
        </div>

        {/* フッター */}
        <div
          className="flex justify-end gap-3 px-6 py-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}
        >
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
          >
            キャンセル
          </button>
          <motion.button
            onClick={() => canSave && onSave(name, subtitle, icon, description, selectedColor.color, selectedColor.light)}
            disabled={!canSave}
            className="px-6 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: canSave ? `linear-gradient(135deg, ${selectedColor.color}, ${selectedColor.color}cc)` : 'rgba(255,255,255,0.08)',
              color: canSave ? '#0a0a0f' : 'rgba(255,255,255,0.4)',
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}
            whileHover={canSave ? { scale: 1.02 } : {}}
            whileTap={canSave ? { scale: 0.98 } : {}}
          >
            作成する
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
