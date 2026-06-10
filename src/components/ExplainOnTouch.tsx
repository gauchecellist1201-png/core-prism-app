// ============================================================
// ExplainOnTouch — 「触った 場所 に 説明 が 浮かぶ」 学習 モード
//
// オーナー指示 (2026-06-05):
//   「このページ に なってから、 それぞれ の 説明 を 書く 場所 を クリック
//    して いき ながら、 それぞれ の 説明 が 入る 感じ。
//    使い ながら 体験 して 価値 を 感じて いける 様 に。」
//
// 動き:
//   1. UI 要素 に data-explain-id / -title / -body 属性 を 付ける
//   2. ダッシュ 起動 時 に 学習 モード ON (初回 のみ 自動)
//   3. 学習 モード 中: 各 要素 が ✨ パルス + クリック で 説明 ポップオーバー
//   4. 「✓ わかった、 実行する」 で 説明 を 既読 化 + 元 の クリック 動作 実行
//   5. 全 説明 を 見たら 「✓ 全部 完了」 トースト
//   6. 右下 に 進捗 バッジ + ON/OFF トグル
//
// 既読 は localStorage で 永続。 一度 見たら 二度 と 邪魔 しない。
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// 学習 すべき 要素 の カタログ (data-explain-id ごと)
export const EXPLAIN_CATALOG: Record<string, { title: string; body: string; emoji: string }> = {
  'orbit-ceo':     { emoji: '🧭', title: 'CEO エージェント — 戦略 監督', body: '売上 / 案件 / 経費 / 資料 を 全部 読んで、 いま の 経営 状態 と 90 日 の 重点 + 今週 やる 3 つ を 提案 します。 「現状 分析 + 方針 を 出す」 ボタン と 同じ 動き。 タップ で 開始。' },
  'orbit-sales':   { emoji: '🤝', title: '営業 エージェント', body: '商談 メモ / 提案書 / 督促 メール を 一気 に 下書き します。 案件 を 1 件 登録 すれば、 翌朝 まで に 返信 文 が 並びます。 タップ で Sales Studio へ。' },
  'orbit-cfo':     { emoji: '💴', title: '財務 エージェント', body: '月別 売上 を 読み解いて 強い 月 / 弱い 月、 来月 の 一手 を 提案。 Stripe を 繋げば 自動 で 数字 が 入ります。 タップ で 損益 Studio。' },
  'orbit-creative':{ emoji: '✨', title: '創造 エージェント', body: '原稿 / 文書 / 画像 / 動画 を AI が 作成。 「ブログ 1 本」 「広告 文 5 案」 「資料 PDF 1 枚」 等、 1 タップ で 完成 形 が 出ます。' },
  'orbit-learn':   { emoji: '📖', title: '学び エージェント', body: 'ナレッジ ベース から 関連 資料 を 横断 で 探して 要約。 「先月 の 商談 で 何 話した?」 にも 出典 付き で 答えます。' },
  'orbit-hr':      { emoji: '👥', title: '人材 エージェント', body: '採用 票 / 評価 / 1 on 1 質問 集 を 自動 生成。 候補 者 検索 や 採用 計画 も タップ で 任せられる。' },
  'orbit-health':  { emoji: '❤️', title: '生活 エージェント', body: 'iPhone ショートカット で 睡眠 / 心拍 を 連携 すれば、 集中 時間 帯 を 教えて くれる。 経営 に 直結 する 「体調」 を 守る 担当。' },
  'company-title': { emoji: '🏢', title: 'あなた の デジタル 会社', body: 'ペルソナ 名 が 会社 名 に なります。 14 名 の 役員 (CXO) が 在籍 して、 仕事 を タップ で 任せられる 「役員 会議室」 です。' },
  'kpi-month':     { emoji: '💰', title: '今月 の 利益 (売上 − 経費)', body: 'Stripe を 繋ぐ と リアル タイム で 入ります。 連携 前 は 「—」 表示 (嘘 数字 出さない ルール)。 タップ で 詳細 ダッシュ。' },
  'today-priority':{ emoji: '🎯', title: '今日 の 最 優先 1 件', body: '昨日 の 数字 + ナレッジ から AI が 「今 やる べき 1 件」 を 抽出。 タップ で 役員 に 任せる か、 自分 で 動く か 選べる。' },
  'demo-banner':   { emoji: '🛟', title: 'サンプル モード', body: '架空 の カフェ 経営者 「田中 健一」 で 全機能 を 体験 中。 右上 の 「自分 の アカウント に 切替」 で 本番 ペルソナ へ 戻れます。' },
  'persona-switch':{ emoji: '🎭', title: 'ペルソナ 切替', body: '本業 / 副業 / 趣味 で ペルソナ を 分けると、 役員 / ナレッジ / 案件 が 完全 隔離 されます。 文脈 漏洩 ゼロ 設計。' },
};

const STORAGE_KEY = 'core_explain_seen_v1';
const MODE_KEY = 'core_explain_mode_v1';

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr);
  } catch { return new Set(); }
}
function saveSeen(s: Set<string>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(s))); } catch { /* */ }
}

export default function ExplainOnTouch({ brand = 'prism' }: { brand?: 'prism' | 'iris' }) {
  const accent = brand === 'iris' ? '#F472B6' : '#A78BFA';
  // モード ON/OFF (初回 は ON、 全 説明 見た 後 は OFF)
  const [mode, setMode] = useState<boolean>(() => {
    try {
      const s = localStorage.getItem(MODE_KEY);
      if (s === '0') return false;
      if (s === '1') return true;
    } catch { /* */ }
    return true; // default ON
  });
  const [seen, setSeen] = useState<Set<string>>(() => loadSeen());
  const [active, setActive] = useState<{
    id: string; rect: DOMRect; clickedEl: HTMLElement | null;
  } | null>(null);
  const [toast, setToast] = useState<string>('');
  const recentlyExplainedRef = useRef<string | null>(null);

  // 進捗
  const total = Object.keys(EXPLAIN_CATALOG).length;
  const seenCount = useMemo(() => {
    let c = 0;
    for (const k of Object.keys(EXPLAIN_CATALOG)) if (seen.has(k)) c++;
    return c;
  }, [seen]);
  const allDone = seenCount >= total;

  // mode 永続
  useEffect(() => {
    try { localStorage.setItem(MODE_KEY, mode ? '1' : '0'); } catch { /* */ }
  }, [mode]);

  // 全 説明 完了 で 自動 OFF + 祝い
  useEffect(() => {
    if (allDone && mode) {
      setToast('✓ 全部 の 説明 を 見ました! 学習 モード を OFF に します');
      setMode(false);
      window.setTimeout(() => setToast(''), 4000);
    }
  }, [allDone, mode]);

  // 学習 中 の パルス クラス を 全 [data-explain-id] に 注入
  useEffect(() => {
    if (!mode) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-explain-id]'));
    const undecided: HTMLElement[] = [];
    for (const el of els) {
      const id = el.dataset.explainId || '';
      if (!seen.has(id) && EXPLAIN_CATALOG[id]) {
        el.classList.add('explain-pulse');
        undecided.push(el);
      } else {
        el.classList.remove('explain-pulse');
      }
    }
    return () => {
      for (const el of undecided) el.classList.remove('explain-pulse');
    };
  }, [mode, seen, active]);

  // クリック キャプチャ
  // ⚠ 重要 (2026-06-05 オーナー報告):
  //   ネスト した × / 閉じる / その他 ボタン まで 横取り して しまう バグ を 修正。
  //   ルール:
  //     - 内側 の <button> / <a> / <input> 等 が data-explain-id を 持って いる → 横取り
  //     - 持って いない (= 通常 の 内部 ボタン) → スルー して 通常 動作
  useEffect(() => {
    if (!mode) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      // 1. 最も 近い interactive 要素 を 探す
      const interactive = t.closest('button, a, input, textarea, select, [role="button"], [data-no-explain]') as HTMLElement | null;
      if (interactive) {
        // interactive 自身 が data-explain-id を 持つ なら 横取り 対象 (例: AgentsOrbit の オーブ ボタン)
        if (interactive.hasAttribute('data-explain-id')) {
          const id = interactive.getAttribute('data-explain-id') || '';
          if (!EXPLAIN_CATALOG[id] || seen.has(id) || recentlyExplainedRef.current === id) {
            if (recentlyExplainedRef.current === id) recentlyExplainedRef.current = null;
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          setActive({ id, rect: interactive.getBoundingClientRect(), clickedEl: interactive });
        }
        // 内部 ボタン (× / アクション 等) は スルー → 通常 動作 が 走る
        return;
      }
      // 2. 非 interactive 領域 の クリック: 最寄り の data-explain-id を 探す
      const wrap = t.closest('[data-explain-id]') as HTMLElement | null;
      if (!wrap) return;
      const id = wrap.dataset.explainId || '';
      if (!EXPLAIN_CATALOG[id]) return;
      if (seen.has(id)) return;
      if (recentlyExplainedRef.current === id) {
        recentlyExplainedRef.current = null;
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setActive({ id, rect: wrap.getBoundingClientRect(), clickedEl: wrap });
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [mode, seen]);

  const dismiss = (executeOriginal: boolean) => {
    if (!active) return;
    const id = active.id;
    const el = active.clickedEl;
    const next = new Set(seen); next.add(id); setSeen(next); saveSeen(next);
    setActive(null);
    if (executeOriginal && el) {
      recentlyExplainedRef.current = id;
      window.setTimeout(() => {
        try { (el as HTMLElement).click(); } catch { /* */ }
      }, 80);
    }
  };

  // 進捗 バッジ の 位置 (右下、 AgentTeamMonitor の 真上)
  return (
    <>
      {/* CSS: パルス アニメ */}
      <style>{`
        @keyframes explainPulse {
          0%, 100% { box-shadow: 0 0 0 0 ${accent}00; }
          50%      { box-shadow: 0 0 0 6px ${accent}33; }
        }
        .explain-pulse {
          animation: explainPulse 2.2s ease-in-out infinite;
          border-radius: inherit;
        }
      `}</style>

      {/* 説明 ポップオーバー */}
      <AnimatePresence>
        {active && (() => {
          const item = EXPLAIN_CATALOG[active.id];
          const r = active.rect;
          const TIP_W = Math.min(340, window.innerWidth - 28);
          const TIP_H = 220;
          // 自動 位置: 下優先 → 上 → 中央
          const tryDown = r.bottom + TIP_H + 14 < window.innerHeight;
          const tryUp = r.top - TIP_H - 14 > 0;
          const pos = tryDown ? 'bottom' : tryUp ? 'top' : 'center';
          const left = pos === 'center'
            ? window.innerWidth / 2 - TIP_W / 2
            : Math.max(12, Math.min(window.innerWidth - TIP_W - 12, r.left + r.width / 2 - TIP_W / 2));
          const top = pos === 'bottom' ? r.bottom + 14
                    : pos === 'top'    ? r.top - TIP_H - 14
                    : window.innerHeight / 2 - TIP_H / 2;
          return (
            <>
              {/* 背景 (タップ で 閉じる) */}
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => dismiss(false)}
                style={{
                  position: 'fixed', inset: 0, zIndex: 9000,
                  background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
                  cursor: 'pointer',
                }}
              />
              {/* 対象 要素 を ハイライト */}
              <div style={{
                position: 'fixed',
                left: r.left - 6, top: r.top - 6,
                width: r.width + 12, height: r.height + 12,
                borderRadius: 14,
                border: `2px solid ${accent}`,
                boxShadow: `0 0 0 4px ${accent}33, 0 0 30px ${accent}88`,
                pointerEvents: 'none', zIndex: 9001,
              }} />
              {/* ポップオーバー カード */}
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.22 }}
                style={{
                  position: 'fixed', left, top, width: TIP_W, zIndex: 9002,
                  background: 'linear-gradient(180deg, rgba(28,28,40,0.98), rgba(18,18,30,0.98))',
                  borderRadius: 16,
                  border: `1px solid ${accent}66`,
                  boxShadow: `0 24px 60px rgba(0,0,0,0.55), 0 0 32px ${accent}33`,
                  padding: '16px 16px 14px', color: '#fff',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
                }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `linear-gradient(135deg, ${accent}, ${accent}aa)`,
                    color: '#0a0a0f',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, flexShrink: 0,
                    boxShadow: `0 4px 14px ${accent}55`,
                  }}>{item.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 9, letterSpacing: '0.16em', fontWeight: 900,
                      color: accent, marginBottom: 2,
                    }}>💡 触って 学ぶ — {seenCount + 1} / {total}</div>
                    <div style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.3 }}>{item.title}</div>
                  </div>
                </div>
                <div style={{
                  fontSize: 12, lineHeight: 1.7, color: 'rgba(255,255,255,0.86)',
                  marginBottom: 14,
                }}>{item.body}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => dismiss(false)}
                    style={{
                      flex: 1, fontSize: 12, padding: '9px 12px', borderRadius: 8, fontWeight: 700,
                      background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.75)',
                      border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer',
                    }}
                  >✓ わかった</button>
                  <button
                    onClick={() => dismiss(true)}
                    style={{
                      flex: 1.4, fontSize: 12, padding: '9px 12px', borderRadius: 8, fontWeight: 900,
                      background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                      color: '#0a0a0f', border: 'none', cursor: 'pointer',
                      boxShadow: `0 4px 14px ${accent}55`,
                    }}
                  >わかった、 実行 する →</button>
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>

      {/* 進捗 バッジ (常時 表示、 学習 モード OFF/ON 切替) */}
      {/* PC では左サイドバー(幅52=208px)に被らないよう左オフセットをずらす */}
      <style>{`
        .explain-progress-badge { left: calc(env(safe-area-inset-left, 0px) + 14px); }
        @media (min-width: 768px) { .explain-progress-badge { left: calc(208px + 16px) !important; } }
        /* モバイルは下部 FAB が混み合うため学習バッジは非表示 (2026-06-10) */
        @media (max-width: 767px) { .explain-progress-badge { display: none !important; } }
      `}</style>
      {!allDone && (
        <button
          onClick={() => setMode((m) => !m)}
          className="explain-progress-badge"
          style={{
            position: 'fixed',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)',
            zIndex: 35,
            padding: '8px 12px', borderRadius: 999,
            background: mode
              ? `linear-gradient(135deg, ${accent}, ${accent}cc)`
              : 'rgba(255,255,255,0.08)',
            color: mode ? '#0a0a0f' : 'rgba(255,255,255,0.7)',
            border: `1px solid ${mode ? accent : 'rgba(255,255,255,0.15)'}`,
            fontSize: 11, fontWeight: 800, cursor: 'pointer',
            boxShadow: mode ? `0 6px 18px ${accent}55` : '0 4px 12px rgba(0,0,0,0.3)',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
          }}
          title={mode ? '学習 モード ON (押し て OFF)' : '学習 モード OFF (押し て ON)'}
        >
          {mode ? '💡' : '💤'}
          <span>触って 学ぶ {seenCount}/{total}</span>
        </button>
      )}

      {/* 完了 トースト */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 20, x: '-50%' }}
            style={{
              position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)', left: '50%',
              padding: '10px 18px', borderRadius: 12, zIndex: 9999,
              background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
              color: '#0a0a0f', fontSize: 13, fontWeight: 900,
              border: 'none', boxShadow: `0 12px 28px ${accent}88`,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
            }}
          >{toast}</motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
