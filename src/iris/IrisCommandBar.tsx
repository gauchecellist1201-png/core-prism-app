// ============================================================
// Iris Command Bar — Cmd+K で「Iris に頼む」テキスト入力
// キーワード ルータ (無料/即時) + 必要時のみ Claude フォールバック
// ============================================================
import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, CornerDownLeft, Loader2 } from 'lucide-react';
import type { IrisBackgroundDef } from './irisStyle';
import type { CustomIrisBackground } from './irisStyle';
import type { AppSettings } from '../types/identity';
import { chatWithIris } from './irisAssistant';

interface Props {
  bg: IrisBackgroundDef | CustomIrisBackground;
  settings: AppSettings;
  onRoute: (tab: string, intent?: string) => void;
}

interface RouteHit {
  tab: string;
  intent?: string;
  matched: string;
}

// ─── キーワード ルート定義 ────────────────────────────────
// 順番が重要 — 上から順にマッチを試みる
const KEYWORD_ROUTES: { tab: string; keywords: string[]; intent?: string }[] = [
  // Today
  { tab: 'home',     keywords: ['ホーム', 'home', '今日', '最初', 'ダッシュボード'] },
  { tab: 'schedule', keywords: ['予約', 'スケジュール', '投稿予定', '来週の投稿', '今週の投稿', '明日の投稿', 'queue', 'schedule'] },

  // Create
  { tab: 'reel',     keywords: ['リール', 'reel', '動画作', 'バズ', 'tiktok', 'ショート'] },
  { tab: 'draft',    keywords: ['下書き', 'キャプション', 'caption', '投稿文', '文章を書'] },
  { tab: 'director', keywords: ['丸投げ', '編集して', 'ディレクター', 'director', '動画編集'] },
  { tab: 'image',    keywords: ['画像加工', '写真加工', 'image', 'フィルタ', 'レタッチ'] },

  // Earn
  { tab: 'triage',   keywords: ['精査', 'triage', '案件を見て', '怪しい案件', '案件チェック', '案件精査', 'DM'] },
  { tab: 'deals',    keywords: ['案件', 'deal', '依頼', 'タイアップ', '進行中の案件', 'PR案件'] },
  { tab: 'negotiate', keywords: ['交渉', 'negotiate', '返信', 'メール', '値段交渉', 'カウンター'] },
  { tab: 'brands',   keywords: ['ブランド探し', 'ブランド', 'brand', '打診', '売り込み', 'pitch'] },
  { tab: 'kit',      keywords: ['メディアキット', 'media kit', 'kit', 'プロフィール送'] },

  // Grow
  { tab: 'strategy', keywords: ['戦略', 'strategy', '分析', 'インサイト', 'kpi', '伸ばす', 'グロース'] },
  { tab: 'invite',   keywords: ['招待', 'invite', '紹介', '友達'] },
  { tab: 'community', keywords: ['コミュニティ', 'community', '仲間', 'ガールズ', 'クリエイター仲間'] },
  { tab: 'team',     keywords: ['チーム', 'team', 'マネージャー', 'スタッフ'] },

  // Care
  { tab: 'beauty',   keywords: ['美容', 'beauty', 'スキンケア', '肌', '化粧', 'PMS', 'メンタル', '相談', '料理', 'フィットネス', '健康相談'] },
  { tab: 'health',   keywords: ['ヘルス', 'health', '健康', '睡眠', '心拍', 'apple health', 'ヘルスケア', '歩数'] },
  { tab: 'guideline', keywords: ['ガイドライン', 'ブランド観', 'トーン', 'voice', '世界観', '表記', 'guideline'] },
];

function tryKeywordMatch(q: string): RouteHit | null {
  const lower = q.toLowerCase();
  for (const r of KEYWORD_ROUTES) {
    for (const kw of r.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return { tab: r.tab, intent: r.intent, matched: kw };
      }
    }
  }
  return null;
}

export default function IrisCommandBar({ bg, settings, onRoute }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K / Ctrl+K でフォーカス
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // ライブ サジェスト (キーワード マッチ)
  const suggestion = useMemo<RouteHit | null>(() => {
    const q = query.trim();
    if (!q) return null;
    return tryKeywordMatch(q);
  }, [query]);

  async function submit() {
    const q = query.trim();
    if (!q) return;

    // 1. キーワード ルータで即座に処理
    const hit = tryKeywordMatch(q);
    if (hit) {
      onRoute(hit.tab, hit.intent);
      reset();
      return;
    }

    // 2. AI フォールバック (Claude — 後述で Gemini 切替候補)
    setBusy(true);
    setError(null);
    try {
      const res = await chatWithIris({
        settings,
        history: [],
        userMessage: q,
      });
      // intent → tab マッピング
      const intentTab: Record<string, string> = {
        'add-deal': 'deals',
        'check-offer': 'triage',
        'write-pitch': 'negotiate',
        'plan-content': 'draft',
        'analyze-account': 'strategy',
        'beauty-advice': 'beauty',
        'general-strategy': 'strategy',
        'small-talk': 'home',
        'unclear': 'home',
      };
      const target = res.actions?.[0]?.tab || intentTab[res.intent] || 'home';
      onRoute(target, res.intent);
      reset();
    } catch (err: any) {
      setError(err?.message || 'うまく解釈できなかった。タブから直接探してね');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setQuery('');
    setOpen(false);
    setError(null);
  }

  return (
    <>
      {/* ヘッダ右の小さなトリガ — Cmd+K ヒント付き */}
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        title="Iris に頼む (Cmd+K)"
        aria-label="Iris に頼む"
        className="iris-command-trigger"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.7)',
          border: `1px solid ${bg.cardBorder}`,
          borderRadius: 999,
          padding: '0.4rem 0.85rem',
          fontSize: '0.78rem',
          color: bg.inkSoft,
          cursor: 'pointer',
          fontFamily: 'inherit',
          minHeight: 36,
        }}
      >
        <Sparkles size={14} color={bg.accent} strokeWidth={2.4} />
        <span style={{ fontWeight: 600 }}>Iris に頼む</span>
        <span style={{
          fontSize: '0.65rem', fontWeight: 700,
          padding: '0.1rem 0.4rem',
          background: 'rgba(31,26,46,0.06)',
          borderRadius: 6, color: bg.inkSoft,
        }}>⌘K</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: 'rgba(20,15,30,0.55)', backdropFilter: 'blur(10px)',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
              paddingTop: '14vh', padding: '14vh 1rem 1rem',
            }}
          >
            <motion.div
              initial={{ scale: 0.95, y: -10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#fff', borderRadius: 20,
                width: '100%', maxWidth: 600,
                boxShadow: '0 24px 70px rgba(20,15,30,0.4)',
                overflow: 'hidden',
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '1rem 1.25rem',
                borderBottom: `1px solid ${bg.cardBorder}`,
              }}>
                {busy
                  ? <Loader2 size={20} color={bg.accent} className="iris-spin" />
                  : <Sparkles size={20} color={bg.accent} strokeWidth={2.2} />
                }
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !busy) submit(); }}
                  placeholder="例: 今夜のリール作って / Apple 案件返信 / 来週の投稿予定"
                  style={{
                    flex: 1, border: 'none', outline: 'none',
                    fontSize: '1rem', fontWeight: 500, color: bg.ink,
                    background: 'transparent',
                  }}
                />
                <button
                  onClick={() => submit()}
                  disabled={busy || !query.trim()}
                  style={{
                    background: bg.accent, color: '#fff',
                    border: 'none', borderRadius: 10,
                    padding: '0.45rem 0.8rem',
                    fontSize: '0.78rem', fontWeight: 700,
                    cursor: 'pointer', opacity: busy || !query.trim() ? 0.4 : 1,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}
                >
                  実行 <CornerDownLeft size={12} strokeWidth={3} />
                </button>
              </div>

              {/* ライブ サジェスト */}
              {suggestion && (
                <div style={{
                  padding: '0.6rem 1.25rem',
                  background: `${bg.accent}08`,
                  borderBottom: `1px solid ${bg.cardBorder}`,
                  fontSize: '0.78rem', color: bg.inkSoft,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <Sparkles size={12} color={bg.accent} />
                  <span>「<strong style={{ color: bg.accent }}>{suggestion.matched}</strong>」を検知 → <strong style={{ color: bg.ink }}>{TAB_NAME[suggestion.tab] || suggestion.tab}</strong> に飛びます (Enter)</span>
                </div>
              )}

              {error && (
                <div style={{
                  padding: '0.6rem 1.25rem',
                  background: '#FFF1F0',
                  borderBottom: `1px solid ${bg.cardBorder}`,
                  fontSize: '0.78rem', color: '#C8102E',
                }}>{error}</div>
              )}

              {/* ヒント */}
              <div style={{ padding: '0.85rem 1.25rem 1.1rem' }}>
                <p style={{
                  fontSize: '0.68rem', letterSpacing: '0.2em',
                  color: bg.accent, fontWeight: 700, margin: '0 0 0.55rem',
                }}>TRY</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    '今夜のリール作って',
                    '案件を精査して',
                    'Apple 案件の返信を書いて',
                    '来週の投稿予定',
                    '美容相談したい',
                    '戦略ダッシュボード',
                  ].map(s => (
                    <button key={s}
                      onClick={() => { setQuery(s); setTimeout(() => submit(), 0); }}
                      style={{
                        background: 'transparent', border: `1px solid ${bg.cardBorder}`,
                        borderRadius: 10, padding: '0.5rem 0.8rem',
                        fontSize: '0.82rem', color: bg.ink, textAlign: 'left',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = `${bg.accent}10`}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >{s}</button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const TAB_NAME: Record<string, string> = {
  home: 'ホーム', schedule: '投稿予約',
  reel: 'リール作成', draft: '投稿下書き', director: '丸投げ編集', image: '画像加工',
  triage: '案件精査', deals: '案件', negotiate: '交渉', brands: 'ブランド探し', kit: 'メディアキット',
  strategy: '戦略', invite: '招待', community: 'コミュニティ', team: 'チーム',
  beauty: '美容相談', health: 'ヘルス', guideline: 'ガイドライン',
};
