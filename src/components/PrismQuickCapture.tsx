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
// ============================================================
import React, { useEffect, useRef, useState } from 'react';
import { NotebookPen, X, Check, ClipboardList } from 'lucide-react';
import {
  chipLabel, getRecentCopies, startCopyCapture, subscribeCopies,
  type CopyStashEntry,
} from '../lib/copyStash';

interface Props {
  // 既存の onAddKnowledgeNote(title, content) をそのまま受ける（同期・即時）。
  onAddNote: (title: string, content: string) => unknown;
  accentColor?: string;
}

export default function PrismQuickCapture({ onAddNote, accentColor = '#8b5cf6' }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [recent, setRecent] = useState<CopyStashEntry[]>([]);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

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
