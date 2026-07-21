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
    name: '美容サロン経営',
    subtitle: 'Salon Owner',
    icon: '❖',
    oneLiner: '予約・リピート・スタッフを管理',
    description: '美容室・エステ・ネイル等のサロン経営者として、予約管理・リピート率・スタッフのシフト・客単価を最適化する。SNS集客からカルテ管理まで現場を回す。',
    colorIndex: 6,
  },
  {
    name: '教室・スクール講師',
    subtitle: 'Teacher / School',
    icon: '✎',
    oneLiner: '生徒募集・レッスン・月謝を管理',
    description: '音楽教室・学習塾・習い事などのスクール運営者・講師として、生徒募集・体験申込・レッスン管理・月謝の回収を行う。保護者対応と教材づくりも担う。',
    colorIndex: 3,
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
  onSave: (name: string, subtitle: string, icon: string, description: string, accentColor: string, accentColorLight: string, instructions: string) => void;
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
  const [instructions, setInstructions] = useState(editing?.instructions ?? '');
  const [selectedColor, setSelectedColor] = useState(defaultColor);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const isEdit = !!editing;
  // 見た目(肩書き・色・アイコン)は初回作成では畳んでおく — 最初の一歩を軽くする
  const [showAppearance, setShowAppearance] = useState(isEdit);

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
            <h3 className="text-white text-lg font-medium tracking-wide">{isEdit ? `「${editing!.name}」を編集` : 'はじめまして'}</h3>
            <p className="text-white/50 text-xs mt-0.5">{isEdit ? '名前・アイコン・色を変更できます' : 'あなたのお仕事を教えてください。1分で始められます。'}</p>
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
          {/* ① まず、お仕事を一言 — ここが主役 */}
          <div>
            <label className="block text-white text-[15px] font-medium mb-1">
              {isEdit ? '人格名' : 'あなたのお仕事は？'}
            </label>
            {!isEdit && (
              <p className="text-white/45 text-xs mb-2.5 leading-relaxed">
                そのまま一言で書くだけでOK。ぴったりの言葉でなくても大丈夫です。
              </p>
            )}
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={isEdit ? '人格名' : '例：整体院オーナー、英会話教室の先生、美容サロン経営…'}
              className="w-full bg-white/5 text-white text-base font-light outline-none rounded-xl px-4 py-3.5 placeholder:text-white/30 transition-all"
              style={{ border: `1.5px solid ${name ? selectedColor.color + '99' : 'rgba(255,255,255,0.12)'}`, minHeight: 52 }}
              autoFocus
            />
            {!isEdit && (
              <p className="text-white/30 text-[11px] mt-1.5">名前はあとからいつでも変えられます</p>
            )}
          </div>

          {/* ② よくある例 — 補助。「近いものでOK」と明言して選択の圧を消す */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <p className="text-white/75 text-xs font-medium">
                {isEdit ? 'よくある例から置き換える' : 'よくある例（近いものでOK）'}
              </p>
              <p className="text-white/35 text-[11px]">タップで入力</p>
            </div>
            {!isEdit && (
              <p className="text-white/35 text-[11px] mb-2.5 leading-relaxed">
                ぴったりが無くても大丈夫。近いものを選んで、上の欄で自由に書き換えられます。
              </p>
            )}
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

          {/* ③ 見た目（肩書き・色・アイコン）— 任意。初回は畳んで負担を減らす */}
          <div>
            <button
              type="button"
              onClick={() => setShowAppearance(v => !v)}
              className="w-full flex items-center justify-between text-white/60 hover:text-white text-xs tracking-wide transition-colors py-1"
            >
              <span className="flex items-center gap-2">
                {/* 現在の見た目を小さくプレビュー */}
                <span
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background: `${selectedColor.color}25`, color: selectedColor.color }}
                >
                  {icon}
                </span>
                見た目（肩書き・色・アイコン）
                <span className="text-white/30">任意</span>
              </span>
              <span>{showAppearance ? '▾' : '▸'}</span>
            </button>

            {showAppearance && (
              <div className="mt-3 space-y-4">
                {/* 肩書き（旧サブタイトル） */}
                <div>
                  <label className="block text-white/70 text-xs tracking-wider uppercase mb-1.5">肩書き（任意）</label>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={e => setSubtitle(e.target.value)}
                    placeholder="例：Tech Startup CEO"
                    className="w-full bg-white/5 text-white text-sm font-light outline-none rounded-lg px-3 py-2.5 placeholder:text-white/30 transition-all"
                    style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                  />
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
              </div>
            )}
          </div>

          {/* ④ 指示書 — この人格のAIに常時守らせるルール (児玉さんFB 2026-07-21 公式機能化) */}
          <div>
            <label className="block text-white text-[13px] font-medium mb-1">
              指示書 <span className="text-white/40 text-[11px] font-normal">任意・いつでも編集可</span>
            </label>
            <p className="text-white/45 text-xs mb-2 leading-relaxed">
              この人格のAIに、いつも守ってほしいこと（例: 文体・ルール・前提・目標）。
              保存すると、この人格でのAI会話・提案すべてに毎回反映されます。
            </p>
            <textarea
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              placeholder={'例：\n・敬語は使わず、フランクに短く話す\n・提案は必ず費用の目安つきで\n・今期の目標は月商100万円。逆算して助言する'}
              className="w-full bg-white/5 text-white text-sm font-light outline-none rounded-lg px-3 py-2.5 placeholder:text-white/30 resize-none leading-relaxed"
              style={{ border: `1px solid ${instructions ? selectedColor.color + '66' : 'rgba(255,255,255,0.08)'}`, minHeight: '110px', fontSize: 16 }}
              rows={5}
            />
          </div>

          {/* ⑤ AIへの人格説明（任意） */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="flex items-center gap-1 text-white/60 hover:text-white text-xs tracking-wide transition-colors py-1"
            >
              <span>{showAdvanced ? '▾' : '▸'}</span>
              AIへの人格説明 <span className="text-white/30">任意</span>
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
            onClick={() => canSave && onSave(name, subtitle, icon, description, selectedColor.color, selectedColor.light, instructions)}
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
            {isEdit ? '保存する' : 'これで始める'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
