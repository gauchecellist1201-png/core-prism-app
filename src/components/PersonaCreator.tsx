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
  /** カード上に1行で見せる短い説明 */
  oneLiner: string;
};

const PRESETS: Preset[] = [
  {
    name: 'IT会社CEO',
    subtitle: 'Tech Startup CEO',
    icon: '⬡',
    oneLiner: 'プロダクト戦略・採用・資金調達を統括',
    description: 'IT企業の経営者として、プロダクト方針・採用・資金調達・組織開発を統括する。仮説検証のスピードと顧客解像度を重視し、エンジニアリングと事業の両面から判断する。',
    colorIndex: 0,
  },
  {
    name: '動画クリエイター',
    subtitle: 'Video Creator',
    icon: '✦',
    oneLiner: '企画・撮影・編集・収益化を一人で回す',
    description: 'YouTube / TikTok / Instagram で動画を発信するクリエイター。企画・撮影・編集・分析・案件交渉までを自己完結する。再生数とエンゲージメント、ブランドの世界観を数字で把握する。',
    colorIndex: 6,
  },
  {
    name: '不動産会社社長',
    subtitle: 'Real Estate CEO',
    icon: '◈',
    oneLiner: '物件取得・運営・資金繰りを判断',
    description: '不動産会社の経営者として、物件取得・賃貸運営・資金繰り・法務リスクを総合的に判断する。利回り・キャッシュフロー・市場動向を数字で押さえた実践的な助言を行う。',
    colorIndex: 1,
  },
  {
    name: '人材会社社長',
    subtitle: 'HR / Staffing CEO',
    icon: '★',
    oneLiner: '求職者・クライアント・マッチング率を管理',
    description: '人材紹介・派遣会社の経営者として、求職者プール・クライアント開拓・マッチング率・粗利率を最適化する。法令遵守と長期的な信頼関係を重視する。',
    colorIndex: 5,
  },
  {
    name: 'EC ショップ運営',
    subtitle: 'E-commerce Owner',
    icon: '◆',
    oneLiner: '商品開発・仕入れ・広告 ROI を最適化',
    description: 'Shopify / 楽天 / Amazon などで自社ブランドを展開するオーナー。商品開発・仕入れ・在庫・広告 ROAS・LTV を一人で意思決定する。',
    colorIndex: 7,
  },
  {
    name: 'インフルエンサー',
    subtitle: 'Influencer / Creator',
    icon: '★',
    oneLiner: 'SNS 発信 + PR 案件交渉まで自己完結',
    description: 'SNS で発信し、ブランドや代理店から PR 案件を受けるクリエイター。フォロワー・エンゲージメント率・自身のブランド観を数字で把握し、交渉から納品・レポートまで自己完結する。',
    colorIndex: 6,
  },
  {
    name: '飲食店オーナー',
    subtitle: 'Restaurant Owner',
    icon: '◆',
    oneLiner: '原価率・人件費・来客サイクルを管理',
    description: '飲食店の経営者として、メニュー設計・原価率・人件費・客単価・リピート率を管理する。仕込みからレビュー対応まで、現場とオフィスの両方を回す。',
    colorIndex: 4,
  },
  {
    name: 'コンサルタント',
    subtitle: 'Consultant',
    icon: '⬡',
    oneLiner: '仮説立案・PJ 管理・提案書作成を高速化',
    description: '経営・IT・マーケ等のコンサルタントとして、クライアント課題を構造化し、仮説・実行プラン・提案書を高速で作る。複数 PJ を並行管理する。',
    colorIndex: 2,
  },
];

interface Props {
  existingPersonas: Persona[];
  onSave: (name: string, subtitle: string, icon: string, description: string, accentColor: string, accentColorLight: string) => void;
  onCancel: () => void;
  /** 既存ペルソナ編集モード (省略時は新規作成) */
  editing?: Persona;
}

export default function PersonaCreator({ existingPersonas, onSave, onCancel, editing }: Props) {
  const defaultColor = editing
    ? (ACCENT_COLORS.find(c => c.color === editing.accentColor) || getNextAccentColor(existingPersonas))
    : getNextAccentColor(existingPersonas);
  const [name, setName] = useState(editing?.name ?? '');
  const [subtitle, setSubtitle] = useState(editing?.subtitle ?? '');
  const [icon, setIcon] = useState(editing?.icon ?? ICON_OPTIONS[existingPersonas.length % ICON_OPTIONS.length]);
  const [description, setDescription] = useState(editing?.description ?? '');
  const [selectedColor, setSelectedColor] = useState(defaultColor);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const isEdit = !!editing;

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
        className="w-full max-w-xl rounded-2xl overflow-hidden flex flex-col"
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
            <h3 className="text-white text-lg font-medium tracking-wide">{isEdit ? `「${editing!.name}」を編集` : '新しい人格を作成'}</h3>
            <p className="text-white/50 text-xs mt-0.5">{isEdit ? '名前・アイコン・色を変更できます' : 'プリセットから選ぶか、自分でカスタマイズ'}</p>
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
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-white/80 text-xs tracking-wider uppercase">クイック選択</p>
              <p className="text-white/40 text-[11px]">タップで自動入力</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PRESETS.map(p => {
                const c = ACCENT_COLORS[p.colorIndex];
                const active = name === p.name && subtitle === p.subtitle;
                return (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(p)}
                    className="flex items-start gap-2.5 px-3 py-3 rounded-xl text-left transition-all"
                    style={{
                      background: active ? c.light : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${active ? c.color : 'rgba(255,255,255,0.10)'}`,
                      minHeight: 64,
                    }}
                  >
                    <span
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                      style={{ background: `${c.color}25`, color: c.color }}
                    >
                      {p.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-white text-[13px] font-medium leading-tight truncate">{p.name}</span>
                      <span className="block text-white/55 text-[11px] mt-0.5 leading-snug line-clamp-2">{p.oneLiner}</span>
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
                placeholder="例：IT会社CEO、動画クリエイター、人材会社社長..."
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
                placeholder="例：Tech Startup CEO"
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
                placeholder="例：IT企業の経営者として、プロダクト・採用・資金調達を統括する。仮説検証のスピードを重視。"
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
