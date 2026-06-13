// ============================================================
// Iris Studio — Canva(デザイン) × CapCut(動画) 統合ハブ
//
// オーナー指示 (2026-06-13):
//   「Canva と CapCut が統合されるイメージで機能作って。
//    これがインフルエンサーに受けるはず。この不統一な UI も統一したい。」
//
// 従来バラバラだった つくる 系タブ (リール / 動画おまかせ / 写真を直す /
// 投稿を書く) を 1 つの Studio に統合。2 モード:
//   ・デザイン (Canva)  … 画像・サムネ・投稿ビジュアル
//   ・動画   (CapCut) … リール・字幕・テンポ編集
// 既存の高機能エディタへは onOpen(tabId) でシームレスに遷移。
// ============================================================
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Image as ImageIcon, Film, Type, Clapperboard, Camera,
  Sparkles, Wand2, ArrowRight, LayoutTemplate,
} from 'lucide-react';
import { IRIS_FONTS } from './irisStyle';

interface StudioBg {
  accent: string; ink: string; inkSoft: string; card: string; cardBorder: string;
}

type Mode = 'design' | 'video';

interface StudioTool {
  tab: string;
  title: string;
  desc: string;
  icon: typeof ImageIcon;
  badge?: string;
}

const DESIGN_TOOLS: StudioTool[] = [
  { tab: 'image',  title: '写真を直す',     desc: '明るさ・色・背景をワンタップで。投稿が映える1枚に。', icon: Camera,    badge: 'Canva風' },
  { tab: 'draft',  title: '投稿を書く',     desc: 'AI がキャプション・ハッシュタグ・文字入れ案を作成。',  icon: Type },
];

const VIDEO_TOOLS: StudioTool[] = [
  { tab: 'reel',     title: 'リールを作る',   desc: '素材を並べる→字幕→BGMでテンポ良く。縦型に最適化。', icon: Film,         badge: 'CapCut風' },
  { tab: 'director', title: '動画おまかせ',   desc: 'テーマを言うだけ。AI が構成・台本・字幕まで設計。',   icon: Clapperboard, badge: 'AI' },
];

export default function IrisStudioHub({ bg, onOpen }: { bg: StudioBg; onOpen: (tab: string) => void }) {
  const [mode, setMode] = useState<Mode>('design');
  const tools = mode === 'design' ? DESIGN_TOOLS : VIDEO_TOOLS;
  const accent = bg.accent;

  return (
    <div style={{ display: 'grid', gap: '1.1rem', maxWidth: 920, margin: '0 auto' }}>
      {/* ── ヒーロー ── */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        borderRadius: 20, padding: '1.5rem 1.4rem',
        background: 'linear-gradient(135deg, #E1306C 0%, #833AB4 55%, #F77737 100%)',
        color: '#fff', boxShadow: '0 18px 40px rgba(225,48,108,0.28)',
      }}>
        <div style={{ position: 'absolute', right: -30, top: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={20} />
          </div>
          <span style={{ fontSize: 11, letterSpacing: '0.28em', fontWeight: 700, opacity: 0.92 }}>IRIS STUDIO</span>
        </div>
        <h2 style={{ position: 'relative', fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.85rem', margin: '0 0 6px', lineHeight: 1.15 }}>
          つくるを、ひとつに。
        </h2>
        <p style={{ position: 'relative', fontSize: '0.88rem', lineHeight: 1.6, margin: 0, opacity: 0.95, maxWidth: 520 }}>
          デザイン（画像）も動画（リール）も、ここから。素材・文字・BGM をまたいで一気通貫で仕上げます。
        </p>
      </div>

      {/* ── モード切替 (Canva / CapCut) ── */}
      <div style={{
        display: 'flex', gap: 6, padding: 5, borderRadius: 14,
        background: bg.card, border: `1px solid ${bg.cardBorder}`,
      }}>
        {([
          { id: 'design' as Mode, label: 'デザイン', sub: 'Canva 風', icon: ImageIcon },
          { id: 'video'  as Mode, label: '動画',     sub: 'CapCut 風', icon: Film },
        ]).map(m => {
          const on = mode === m.id;
          return (
            <button key={m.id} onClick={() => setMode(m.id)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '0.7rem 0.5rem', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: on ? `linear-gradient(135deg, ${accent}, #833AB4)` : 'transparent',
              color: on ? '#fff' : bg.inkSoft, transition: 'all .2s',
              boxShadow: on ? '0 6px 16px rgba(225,48,108,0.3)' : 'none',
            }}>
              <m.icon size={17} />
              <span style={{ fontWeight: 800, fontSize: 14 }}>{m.label}</span>
              <span style={{ fontSize: 10, fontWeight: 700, opacity: on ? 0.85 : 0.6 }}>{m.sub}</span>
            </button>
          );
        })}
      </div>

      {/* ── ツールカード ── */}
      <motion.div
        key={mode}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.8rem' }}
      >
        {tools.map(t => (
          <button key={t.tab} onClick={() => onOpen(t.tab)} style={{
            textAlign: 'left', cursor: 'pointer',
            background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 16,
            padding: '1.1rem 1.1rem', display: 'grid', gap: 8,
            transition: 'transform .15s, box-shadow .15s, border-color .15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 14px 30px rgba(225,48,108,0.16)'; e.currentTarget.style.borderColor = accent; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = bg.cardBorder; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 13, flexShrink: 0,
                background: `linear-gradient(135deg, ${accent}22, #833AB422)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent,
              }}>
                <t.icon size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <strong style={{ fontSize: 15, color: bg.ink }}>{t.title}</strong>
                  {t.badge && (
                    <span style={{ fontSize: 9.5, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: `${accent}1A`, color: accent }}>{t.badge}</span>
                  )}
                </div>
              </div>
              <ArrowRight size={18} color={bg.inkSoft} />
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: bg.inkSoft, lineHeight: 1.6 }}>{t.desc}</p>
          </button>
        ))}
      </motion.div>

      {/* ── ワンタップ作成 (横断) ── */}
      <div style={{
        background: bg.card, border: `1px dashed ${bg.cardBorder}`, borderRadius: 16,
        padding: '1rem 1.1rem', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1, minWidth: 200 }}>
          <Wand2 size={20} color={accent} />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: bg.ink }}>迷ったら、おまかせ</div>
            <div style={{ fontSize: 11.5, color: bg.inkSoft }}>テーマを言うだけで画像も動画も AI が一式つくります。</div>
          </div>
        </div>
        <button onClick={() => onOpen(mode === 'design' ? 'image' : 'director')} style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: `linear-gradient(135deg, ${accent}, #F77737)`, color: '#fff',
          border: 'none', borderRadius: 999, padding: '0.65rem 1.3rem',
          fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 20px rgba(225,48,108,0.3)',
        }}>
          <LayoutTemplate size={16} /> はじめる
        </button>
      </div>
    </div>
  );
}
