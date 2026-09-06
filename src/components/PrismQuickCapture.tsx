// ============================================================
// PrismQuickCapture — どこからでも一瞬で知識に放り込む（Raycast「Quick Capture」相当）
//
// 画面左下に常設のミニ入力。開いている作業を止めず、思いついたことを1〜2タップで
// 知識に保存→あとで仕分け。「あとで書こう」で消える気づきをゼロ摩擦で貯める＝
// Prism の「貯める→効く」ループの入口を太くする。保存は即・楽観的に“もう入った”を返す。
//
// 2026-09-05 追加: さっきコピーしたものを候補チップで出す (Raycast「クリップボード履歴」)。
// 貼り直す手間を消す。ブラウザは他アプリの履歴を読めないので、拾えるのは
// 「この画面でコピーしたもの」だけ — 読めるふりはしない (copyStash.ts)。
//
// 2026-09-06 追加: 書いている最中に「それ、前にも書いています」を1件だけ出す (Mem「関連ノート」)。
// ここまで Prism の知識は **引く (質問された時だけ返す) 一方通行** で、同じことを
// 3回書いても3件並ぶだけだった。貯めた意味が次の質問まで一度も返ってこない。
// **AI 呼び出しゼロ・往復ゼロ・保存ゼロ** (knowledgeMatch.ts の物差しはナレッジ脳と同じ)。
// 守っていること: 打鍵ごとに走らせない (止まって 0.4 秒) / 点が低ければ何も出さない /
// 勝手に統合も上書きもしない (出すのは「見に行く」だけ) / 候補の中身をどこにも保存しない。
// ============================================================
import React, { useEffect, useRef, useState } from 'react';
import { NotebookPen, X, Check, ClipboardList, Link2 } from 'lucide-react';
import {
  chipLabel, getRecentCopies, startCopyCapture, subscribeCopies,
  type CopyStashEntry,
} from '../lib/copyStash';
import { findSimilarKnowledge } from '../prism/knowledgeMatch';
import type { KnowledgeItem } from '../types/identity';

interface Props {
  // 既存の onAddKnowledgeNote(title, content) をそのまま受ける（同期・即時）。
  onAddNote: (title: string, content: string) => unknown;
  accentColor?: string;
  /** 「前にも書いています」を照らし合わせる相手。渡されない時はこの行を1pxも出さない。 */
  knowledge?: KnowledgeItem[];
  /** 近いメモを開く。渡されない時はボタンにしない（押しても何も起きない口を作らない）。 */
  onOpenKnowledge?: (id: string) => void;
}

/** 「8月12日」。日付が壊れている古いデータでは何も出さない（嘘の日付を出さない）。 */
function noteDate(item: KnowledgeItem): string {
  const t = Date.parse(item.updatedAt || item.createdAt);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 入力が止まってから照合するまで。打鍵ごとの再計算は重いし、書いている最中にちらつく。 */
const SIMILAR_DEBOUNCE_MS = 400;

export default function PrismQuickCapture({
  onAddNote, accentColor = '#8b5cf6', knowledge, onOpenKnowledge,
}: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [recent, setRecent] = useState<CopyStashEntry[]>([]);
  const [similar, setSimilar] = useState<KnowledgeItem | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // 「前にも書いています」— 入力が止まって 0.4 秒たった時だけ 1 回。
  // AI は呼ばない・保存もしない (候補は画面に出すだけ・copyStash と同じ作法)。
  //
  // ★親は personaKnowledge を毎回 filter で作り直すので、配列を依存に入れると
  //   **親が再描画するたびにタイマーが振り出しに戻り、いつまでも照合されない**
  //   （画面には何も出ないので、壊れていることに気づけない形の事故）。
  //   中身は ref で読み、依存は「件数」だけにする。
  const knowledgeRef = useRef(knowledge);
  useEffect(() => { knowledgeRef.current = knowledge; }, [knowledge]);
  const knowledgeCount = knowledge?.length ?? 0;
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const items = knowledgeRef.current;
      setSimilar(items && items.length ? findSimilarKnowledge(items, text)?.item ?? null : null);
    }, SIMILAR_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text, open, knowledgeCount]);

  // 選んで ⌘C した分も拾う。控えるのはメモリだけ (保存しない・30分で消える)
  useEffect(() => {
    const stopCapture = startCopyCapture();
    const sync = () => setRecent(getRecentCopies());
    sync();
    const unsubscribe = subscribeCopies(sync);
    return () => { unsubscribe(); stopCapture(); };
  }, []);

  /** 候補チップを1タップで入力欄へ。すでに書いていれば下に足す (打ったものを消さない) */
  function insertCopy(entry: CopyStashEntry) {
    setText(prev => (prev.trim() ? prev.replace(/\s+$/, '') + '\n' + entry.text : entry.text));
    setJustSaved(false);
    setTimeout(() => taRef.current?.focus(), 0);
  }

  function expand() {
    setRecent(getRecentCopies());   // 開いた瞬間に期限切れを落とす (30分前のものを見せない)
    setOpen(true);
    setJustSaved(false);
    setTimeout(() => taRef.current?.focus(), 60);
  }
  function save() {
    const content = text.trim();
    if (!content) return;
    const firstLine = content.split('\n')[0].trim();
    const title = (firstLine.length > 24 ? firstLine.slice(0, 24) + '…' : firstLine) || 'メモ';
    try { onAddNote(title, content); } catch { /* 失敗しても入力は残す */ }
    setText('');
    setSimilar(null);
    setJustSaved(true);
    // “入った”を見せてから畳む（楽観的フィードバック）。
    setTimeout(() => { setJustSaved(false); setOpen(false); }, 1100);
  }

  // 左下・既存コマンドバーFABの上に重ねて置く（両端の SupportChat / コマンドFAB と被らない）。
  const wrapStyle: React.CSSProperties = {
    position: 'fixed',
    // 左下の Core オーブ (52px @left14) と被らないよう右へ — 重なりゼロ規約 2026-07-19
    left: 'calc(env(safe-area-inset-left, 0px) + 80px)',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--prism-lane-2, 76px))',
    zIndex: 30,
  };

  if (!open) {
    return (
      <button
        onClick={expand}
        aria-label="ひらめきを知識に放り込む"
        className="cp-quickcapture"
        style={{
          ...wrapStyle,
          display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 48, padding: '0 16px',
          borderRadius: 999, cursor: 'pointer',
          background: 'rgba(20, 20, 30, 0.82)', backdropFilter: 'blur(20px)',
          color: 'rgba(255,255,255,0.92)', border: '1px solid rgba(255,255,255,0.18)',
          fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 10px 30px rgba(0,0,0,0.38)',
        }}
      >
        <NotebookPen size={16} strokeWidth={2.1} style={{ color: accentColor }} />
        メモを放り込む
      </button>
    );
  }

  return (
    <div
      className="cp-quickcapture"
      style={{
        ...wrapStyle, width: 'min(340px, calc(100vw - 32px))',
        background: 'rgba(22, 22, 32, 0.96)', backdropFilter: 'blur(22px)',
        border: '1px solid rgba(255,255,255,0.16)', borderRadius: 18, padding: 12,
        boxShadow: '0 18px 50px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <NotebookPen size={15} strokeWidth={2.1} style={{ color: accentColor }} />
        <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.82rem', fontWeight: 700 }}>知識に放り込む</span>
        <button onClick={() => setOpen(false)} aria-label="閉じる" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex' }}>
          <X size={16} />
        </button>
      </div>
      {recent.length > 0 && (
        <div style={{ marginBottom: 9 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6, color: 'rgba(255,255,255,0.45)', fontSize: '0.68rem' }}>
            <ClipboardList size={12} strokeWidth={2.2} />
            さっきコピーしたもの（この端末の中だけ・30分で消えます）
          </div>
          <div className="no-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {recent.map(e => (
              <button
                key={e.id}
                onClick={() => insertCopy(e)}
                title={e.text}
                style={{
                  flexShrink: 0, minHeight: 44, maxWidth: 200, padding: '0 13px', borderRadius: 12, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.88)', fontSize: '0.78rem', fontWeight: 600,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {chipLabel(e)}
              </button>
            ))}
          </div>
        </div>
      )}
      <textarea
        ref={taRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); save(); } }}
        rows={3}
        placeholder="いま思いついたこと・メモ・URL を書いて保存（⌘+Enter）"
        style={{
          width: '100%', resize: 'vertical', minHeight: 64, boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12,
          color: '#fff', fontSize: 16, lineHeight: 1.55, padding: '10px 12px', outline: 'none',
        }}
      />
      {/* 「それ、前にも書いています」— 止めない・確認ダイアログにしない・押さなければそのまま保存できる。
          出すのは1件だけ（外れが3倍見えるのを避ける）。押すとその知識をひらく＝統合も上書きもしない。 */}
      {similar && !justSaved && (
        <button
          onClick={() => onOpenKnowledge?.(similar.id)}
          disabled={!onOpenKnowledge}
          title={similar.title}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, width: '100%', marginTop: 8,
            minHeight: 44, padding: '0 11px', borderRadius: 12, textAlign: 'left',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.13)',
            color: 'rgba(255,255,255,0.82)', fontSize: '0.76rem',
            cursor: onOpenKnowledge ? 'pointer' : 'default',
          }}
        >
          <Link2 size={13} strokeWidth={2.2} style={{ color: accentColor, flexShrink: 0 }} />
          <span style={{ flexShrink: 0, color: 'rgba(255,255,255,0.45)' }}>近いメモ</span>
          {/* minWidth:0 が無いと flex の中で縮まず、右端の日付を押し出して見出しが切れない */}
          <span style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {similar.title}
          </span>
          <span style={{ marginLeft: 'auto', flexShrink: 0, color: 'rgba(255,255,255,0.4)' }}>
            {noteDate(similar)}{onOpenKnowledge ? ' ・開く' : ''}
          </span>
        </button>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9 }}>
        {justSaved ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#34d399', fontSize: '0.82rem', fontWeight: 700 }}>
            <Check size={15} strokeWidth={2.6} /> 知識に入りました
          </span>
        ) : (
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem' }}>あとで仕分けできます</span>
        )}
        <button
          onClick={save}
          disabled={!text.trim()}
          style={{
            marginLeft: 'auto', minHeight: 40, padding: '0 18px', borderRadius: 11, border: 'none', cursor: text.trim() ? 'pointer' : 'default',
            background: text.trim() ? accentColor : 'rgba(255,255,255,0.12)', color: '#fff', fontWeight: 700, fontSize: '0.85rem',
            opacity: text.trim() ? 1 : 0.6,
          }}
        >
          保存
        </button>
      </div>
    </div>
  );
}
