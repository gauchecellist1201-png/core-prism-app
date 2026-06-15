// ============================================================
// CxoWelcomeCard — 新規ユーザーが Dashboard を初めて開いた瞬間に出る
//                   「AI 会社 (13 CXO) があなたの代わりに働く」ことを
//                  実物の動きで体感させる初期演出カード
//
// 目的: 「月 1 万円払う価値」を最初の 30 秒で感じてもらう
//
// 表示条件:
//  - localStorage に core_cxo_welcome_seen_v1 が無い
//  - 一度閉じたら二度と出ない
//
// 中で起きること:
//  1. CEO「イーロン」の自己紹介 (3 行)
//  2. 「いま 13 CXO が会社全体を回しています」アバター並び (パルスアニメ)
//  3. 「最初の 1 件を AI 会社に試させる」CTA → 動く AI 会社が見える
// ============================================================
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ArrowRight, Building2 } from 'lucide-react';
import { CXO_META, type CxoRole, useAgentTaskQueue } from '../hooks/useAgentTaskQueue';
import { MetaIcon } from './ExecIcon';

const SEEN_KEY = 'core_cxo_welcome_seen_v1';

interface Props {
  brand?: 'prism' | 'iris';
  /** 強制表示 (デバッグ用) */
  force?: boolean;
}

export default function CxoWelcomeCard({ brand = 'prism', force = false }: Props) {
  const { propose, approve } = useAgentTaskQueue();
  const [open, setOpen] = useState<boolean>(() => {
    if (force) return true;
    try { return !localStorage.getItem(SEEN_KEY); } catch { return false; }
  });
  const [demoStarted, setDemoStarted] = useState(false);
  const accent = brand === 'iris' ? '#E1306C' : '#A78BFA';

  // WowOnboarding と同じ鍵。初回オンボ（チュートリアル→Wow）が終わるまで
  // Cxo ウェルカムは出さない＝モーダル重なりを防ぐ。Wow 完了で WOW_KEY がセットされる。
  const WOW_KEY = brand === 'iris' ? 'core_wow_seen_iris_v1' : 'core_wow_seen_prism_v1';
  const onboardingPending = () => {
    if (force) return false;
    try { return !localStorage.getItem(WOW_KEY); } catch { return false; }
  };

  // 起動から少し遅らせる (他の overlay とぶつからないように)
  const [readyToShow, setReadyToShow] = useState(false);
  useEffect(() => {
    if (!open) return;
    let done = false;
    const reveal = () => { if (!done) { done = true; setReadyToShow(true); } };
    // Wow フローが既に完了済み（or force）なら従来どおり 600ms 後に表示
    if (!onboardingPending()) {
      const t = setTimeout(reveal, 600);
      return () => { done = true; clearTimeout(t); };
    }
    // まだ初回オンボ中：Wow 完了イベント＋ポーリングで待ってから表示
    const onWow = () => { if (!onboardingPending()) setTimeout(reveal, 350); };
    window.addEventListener('core:wow-finished', onWow);
    const poll = setInterval(() => {
      if (!onboardingPending()) { clearInterval(poll); setTimeout(reveal, 350); }
    }, 600);
    // 不測の事態でも永久に隠れないよう最終フォールバック
    const fallback = setTimeout(reveal, 15000);
    return () => {
      done = true;
      window.removeEventListener('core:wow-finished', onWow);
      clearInterval(poll);
      clearTimeout(fallback);
    };
  }, [open]);

  if (!open || !readyToShow) return null;

  const dismiss = () => {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* */ }
    setOpen(false);
  };

  const startDemo = () => {
    setDemoStarted(true);
    // ブランドごとに「最初の 1 件」プリセットを変える
    const demoTask = brand === 'iris'
      ? {
          title: '最近 30 日の Instagram 戦略を分析する',
          steps: [
            { cxo: 'CDS' as CxoRole, label: '直近の投稿パフォーマンスを分析' },
            { cxo: 'CMO' as CxoRole, label: 'リーチ拡大の戦術を 3 つ提案' },
            { cxo: 'CSO' as CxoRole, label: '案件単価を上げる交渉ポイントを抽出' },
            { cxo: 'UXE' as CxoRole, label: 'プロフィールの改善案を提示' },
          ],
        }
      : {
          title: '来週のミーティング準備 — 3 件を一気に整理',
          steps: [
            { cxo: 'CDS' as CxoRole, label: '過去の議事録から重要論点を抽出' },
            { cxo: 'CPO' as CxoRole, label: 'アジェンダを 30 分単位で組み立て' },
            { cxo: 'CFO' as CxoRole, label: '財務影響を試算' },
            { cxo: 'CLO' as CxoRole, label: 'リスクとフォロー事項をチェック' },
          ],
        };
    const task = propose({
      ...demoTask,
      summary: 'AI 会社 の動き方を体験するためのデモタスクです',
    });
    // 自動承認 → AgentTeamMonitor で動きが見える
    setTimeout(() => approve(task.id), 250);
    // 体験用 → 5 秒後にカードは閉じる (右下のモニタで続きが見える)
    setTimeout(() => dismiss(), 5000);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'fixed', inset: 0,
          zIndex: 80,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 18,
        }}
        onClick={dismiss}
      >
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 30, opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          onClick={e => e.stopPropagation()}
          style={{
            width: 'min(500px, calc(100vw - 36px))',
            maxHeight: 'calc(100vh - 100px)',
            overflowY: 'auto',
            background: 'linear-gradient(180deg, rgba(18,18,30,0.98) 0%, rgba(10,10,20,1) 100%)',
            border: `1px solid ${accent}55`,
            borderRadius: 20,
            boxShadow: `0 24px 64px rgba(0,0,0,0.55), 0 0 50px ${accent}22`,
            color: '#fff',
            padding: 24,
          }}
        >
          {/* ヘッダ */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: `0 0 20px ${accent}66`,
            }}>
              <Building2 size={22} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', color: accent, textTransform: 'uppercase' }}>
                AI 代表「イーロン」より
              </div>
              <div style={{ fontSize: 19, fontWeight: 800, marginTop: 2, lineHeight: 1.35 }}>
                ようこそ。今日からあなたの会社に 13 人の CXO が常駐します。
              </div>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="閉じる"
              style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'rgba(255,255,255,0.06)',
                border: 'none',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            ><X size={14} /></button>
          </div>

          {/* メッセージ */}
          <p style={{
            fontSize: 13.5,
            lineHeight: 1.7,
            color: 'rgba(255,255,255,0.82)',
            marginBottom: 18,
          }}>
            私が CEO の<strong style={{ color: '#fff' }}>イーロン</strong>です。
            CTO、CFO、CMO ……13 名の役員が、あなたが寝ている間も働きます。
            あなたの仕事は <strong style={{ color: accent }}>「これやって」と承認するだけ</strong>。
          </p>

          {/* 13 CXO アバター列 */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6,
            padding: '12px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
            marginBottom: 16,
          }}>
            {(Object.keys(CXO_META) as CxoRole[]).map((role, i) => {
              const meta = CXO_META[role];
              return (
                <motion.div
                  key={role}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.1 + i * 0.04 }}
                  title={`${meta.name} — ${meta.tagline}`}
                  style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: `${meta.color}22`,
                    border: `1px solid ${meta.color}55`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14,
                  }}
                >
                  <MetaIcon meta={meta} size={16} color={meta.color} strokeWidth={2.2} />
                </motion.div>
              );
            })}
          </div>

          {/* デモ実行ステータス or CTA */}
          {!demoStarted ? (
            <>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 10, lineHeight: 1.7 }}>
                体感が一番速いです。サンプル 1 件を AI 会社に投げてみますか? 画面右下の <strong style={{ color: accent }}>「作戦本部」</strong> で動きが見えます。
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={startDemo}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                    border: 'none', borderRadius: 12,
                    color: '#fff', fontSize: 13.5, fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    boxShadow: `0 6px 20px ${accent}55`,
                  }}
                >
                  <Sparkles size={14} />
                  AI 会社にサンプル 1 件を任せてみる
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  style={{
                    padding: '12px 14px',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >あとで</button>
              </div>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{
                padding: 14,
                background: `${accent}11`,
                border: `1px solid ${accent}33`,
                borderRadius: 12,
                fontSize: 13.5,
                color: '#fff',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <span style={{ color: accent, fontWeight: 800, display: 'inline-flex', alignItems: 'center' }}><Sparkles size={15} strokeWidth={2.2} /></span>
              <div style={{ flex: 1 }}>
                AI 会社が動き始めました。<br />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                  右下の作戦本部 <ArrowRight size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> でリアルタイムに見えます。
                </span>
              </div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
