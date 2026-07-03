// ============================================================
// IrisPlatformCards — 生成結果を「各SNSの実際の見た目」で並べる
//
//   X / Instagram / note の 3 カード。モバイルは横スクロール
//   (scroll-snap)、md+ は 3 カラム。各カードは「作品」に見える仕上げ。
//   共通アクション: 編集 (インライン textarea) / コピー / ベスト枠に予約 /
//   その媒体で直接投稿 (X=本文入りの投稿画面 / Instagram=共有シート /
//   note=コピーして note で書く)。「手入力ゼロ」で投稿まで運ぶ。
// ============================================================
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Check, Copy, CalendarClock, Film, ExternalLink, Send } from 'lucide-react';
import InstagramGlyph from './InstagramGlyph'; // lucide の Instagram は未export (実行時に落ちる罠)
import { suggestNextSlot } from './usePostQueue';
import { shareToInstagram } from './instagramShare';
import { notifyInApp } from '../lib/inAppNotify';
import { IRIS_FONTS, type IrisBackgroundDef } from './irisStyle';
import { EASE_OUT_FM } from './motion';
import type { ThoughtDropResult } from './IrisThoughtDrop';

type CardId = 'x' | 'ig' | 'note';

interface Props {
  bg: IrisBackgroundDef;
  result: ThoughtDropResult;
  /** usePostQueue() の戻り値 (add を使用)。無ければ予約ボタンを出さない */
  queue?: { add: (p: any) => any };
  /** 表示名 (mediaKit.handleName) */
  handle?: string;
}

// ─── note 本文の組み立て (コピー・編集用) ─────
function composeNote(n: ThoughtDropResult['note']): string {
  const parts: string[] = [];
  if (n.title) parts.push(n.title);
  if (n.lead) parts.push('', n.lead);
  if (n.headings.length) {
    parts.push('', '見出し構成:');
    n.headings.forEach((h, i) => parts.push(`${i + 1}. ${h}`));
  }
  return parts.join('\n');
}

// ─── クリップボード (フォールバック付き) ─────
async function copyText(t: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = t;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function fmtSlot(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

export default function IrisPlatformCards({ bg, result, queue, handle }: Props) {
  const [xBody, setXBody] = useState(result.x.body);
  const [igCaption, setIgCaption] = useState(result.instagram.caption);
  const [noteText, setNoteText] = useState(() => composeNote(result.note));
  const [noteEdited, setNoteEdited] = useState(false);
  const [editing, setEditing] = useState<CardId | null>(null);
  const [copied, setCopied] = useState<CardId | null>(null);
  const [igExpanded, setIgExpanded] = useState(false);
  const [reserved, setReserved] = useState<{ x?: string; ig?: string }>({});

  // 新しい生成結果が来たら全部リセット
  useEffect(() => {
    setXBody(result.x.body);
    setIgCaption(result.instagram.caption);
    setNoteText(composeNote(result.note));
    setNoteEdited(false);
    setEditing(null);
    setCopied(null);
    setIgExpanded(false);
    setReserved({});
  }, [result]);

  const displayName = (handle || '').trim() || 'あなた';
  const initial = displayName.charAt(0).toUpperCase();
  const atHandle = (handle || '').toLowerCase().replace(/[^a-z0-9_]/g, '') || 'you';
  const xLen = [...xBody].length;
  const igTags = result.instagram.hashtags;
  const igCopyText = igCaption + (igTags.length ? '\n\n' + igTags.join(' ') : '');

  const doCopy = async (id: CardId, text: string) => {
    const ok = await copyText(text);
    if (ok) {
      setCopied(id);
      window.setTimeout(() => setCopied(c => (c === id ? null : c)), 1800);
    } else {
      notifyInApp({ kind: 'warn', title: 'コピーできませんでした', body: '本文を長押しして、手動でコピーしてください。' });
    }
  };

  const reserve = (id: 'x' | 'ig') => {
    if (reserved[id]) return; // 二重予約防止
    if (!queue?.add) {
      notifyInApp({ kind: 'warn', title: '予約できませんでした', body: 'アプリを再読み込みして、もう一度お試しください。' });
      return;
    }
    const slot = suggestNextSlot();
    try {
      queue.add({
        scheduledAt: slot.toISOString(),
        platform: id === 'x' ? 'x' : 'instagram_feed',
        source: 'draft',
        caption: id === 'x' ? xBody : igCaption,
        hashtags: id === 'x' ? [] : igTags,
        note: '思考ドロップから生成',
      });
      const label = fmtSlot(slot);
      setReserved(r => ({ ...r, [id]: label }));
      notifyInApp({ kind: 'success', title: 'ベスト枠に予約しました', body: `${label} に投稿予約。投稿タブでいつでも変更できます。` });
    } catch (e: any) {
      notifyInApp({ kind: 'warn', title: '予約に失敗しました', body: e?.message || 'もう一度お試しください。' });
    }
  };

  // X の投稿画面を本文入りで開く (intent URL は本文を prefill できる)
  const postToX = () => {
    const text = xBody.trim();
    if (!text) {
      notifyInApp({ kind: 'warn', title: '本文が空です', body: '編集で少し書き足してから投稿してください。' });
      return;
    }
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    const w = window.open(url, '_blank', 'noopener');
    if (!w) {
      // ポップアップがブロックされた時は保険でコピー
      copyText(text);
      notifyInApp({ kind: 'warn', title: 'ポップアップがブロックされました', body: '本文はコピー済みです。Xを開いて貼り付けてください。' });
      return;
    }
    notifyInApp({ kind: 'success', title: 'Xの投稿画面を開きました', body: '本文はすでに入っています。そのまま投稿できます。' });
  };

  // Instagram はキャプションを prefill できないので、共有シート/コピーで運ぶ
  const shareIg = async () => {
    try {
      const r = await shareToInstagram({ caption: igCopyText });
      notifyInApp({
        kind: r.method === 'failed' ? 'warn' : 'success',
        title: r.method === 'failed' ? 'Instagramを開けませんでした' : 'Instagramへ',
        body: r.message,
      });
    } catch {
      await copyText(igCopyText);
      notifyInApp({ kind: 'warn', title: 'Instagramを開けませんでした', body: 'キャプションはコピー済みです。Instagramで貼り付けてください。' });
    }
  };

  const copyAndOpenNote = async () => {
    const ok = await copyText(noteText);
    if (ok) {
      setCopied('note');
      window.setTimeout(() => setCopied(c => (c === 'note' ? null : c)), 1800);
      notifyInApp({ kind: 'success', title: '本文をコピーしました', body: 'noteのエディタが開きます。そのまま貼り付けてください。' });
    } else {
      notifyInApp({ kind: 'warn', title: 'コピーできませんでした', body: '本文を長押しでコピーしてから、noteに貼り付けてください。' });
    }
    window.open('https://note.com/notes/new', '_blank', 'noopener');
  };

  const cardShadow = '0 6px 24px rgba(31,26,46,0.1)';
  const enter = (i: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay: i * 0.09, ease: EASE_OUT_FM },
  });

  return (
    <section aria-label="生成された3つの投稿" style={{ display: 'grid', gap: '0.55rem' }}>
      <p style={{
        margin: '0 0.15rem', fontSize: '0.78rem', color: bg.inkSoft,
        fontWeight: 600, fontFamily: IRIS_FONTS.body,
      }}>
        できあがり ─ そのまま使えます。カードは編集もできます
      </p>

      <div className="iris-pcards">
        {/* ══ X カード ══ */}
        <motion.article {...enter(0)} style={{
          background: '#000000',
          border: '1px solid #2F3336',
          borderRadius: 20,
          padding: '1rem',
          boxShadow: cardShadow,
          display: 'flex', flexDirection: 'column', gap: '0.7rem',
        }}>
          <header style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #E1306C, #833AB4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#FFFFFF', fontWeight: 800, fontSize: '1rem',
            }}>
              {initial}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, color: '#E7E9EA', fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName}
              </p>
              <p style={{ margin: 0, color: '#71767B', fontSize: '0.76rem' }}>@{atHandle}</p>
            </div>
            <XGlyph size={16} color="#E7E9EA" />
          </header>

          {editing === 'x' ? (
            <textarea
              value={xBody}
              onChange={e => setXBody(e.target.value)}
              rows={5}
              autoFocus
              style={{
                width: '100%', minHeight: 130,
                background: '#16181C', color: '#E7E9EA',
                border: '1px solid #2F3336', borderRadius: 12,
                padding: '0.65rem 0.75rem', fontSize: 16, lineHeight: 1.6,
                fontFamily: IRIS_FONTS.body, outline: 'none', resize: 'vertical',
              }}
            />
          ) : (
            <p style={{
              margin: 0, color: '#E7E9EA', fontSize: '0.94rem', lineHeight: 1.65,
              whiteSpace: 'pre-wrap', overflowWrap: 'break-word', flex: 1,
            }}>
              {xBody}
            </p>
          )}

          {/* 文字数カウンタ (140 超は赤) */}
          <p style={{
            margin: 0, textAlign: 'right',
            fontSize: '0.72rem', fontWeight: 700,
            color: xLen > 140 ? '#F4212E' : '#71767B',
          }}>
            {xLen} / 140{xLen > 140 ? ' ─ 少し削りましょう' : ''}
          </p>

          <footer style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', borderTop: '1px solid #2F3336', paddingTop: '0.65rem' }}>
            <ActionBtn dark onClick={() => setEditing(e => (e === 'x' ? null : 'x'))}>
              {editing === 'x' ? <Check size={14} /> : <Pencil size={14} />}
              {editing === 'x' ? '完了' : '編集'}
            </ActionBtn>
            <ActionBtn dark onClick={() => doCopy('x', xBody)}>
              {copied === 'x' ? <Check size={14} /> : <Copy size={14} />}
              {copied === 'x' ? 'コピーした' : 'コピー'}
            </ActionBtn>
            {queue?.add && (
              <ActionBtn dark onClick={() => reserve('x')}>
                <CalendarClock size={14} />
                {reserved.x ? `予約済み ${reserved.x}` : 'ベスト枠に予約'}
              </ActionBtn>
            )}
            <ActionBtn primary onClick={postToX}>
              <XGlyph size={13} color="#FFFFFF" />
              Xで投稿
            </ActionBtn>
          </footer>
        </motion.article>

        {/* ══ Instagram カード ══ */}
        <motion.article {...enter(1)} style={{
          background: '#FFFFFF',
          border: '1px solid rgba(31,26,46,0.1)',
          borderRadius: 20,
          padding: '1rem',
          boxShadow: cardShadow,
          display: 'flex', flexDirection: 'column', gap: '0.7rem',
        }}>
          <header style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #FCB045, #E1306C 55%, #833AB4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#FFFFFF', fontWeight: 800, fontSize: '0.85rem',
            }}>
              {initial}
            </div>
            <p style={{ margin: 0, color: '#262626', fontWeight: 700, fontSize: '0.84rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </p>
            <InstagramGlyph size={17} color="#E1306C" strokeWidth={2} />
          </header>

          {editing === 'ig' ? (
            <textarea
              value={igCaption}
              onChange={e => setIgCaption(e.target.value)}
              rows={6}
              autoFocus
              style={{
                width: '100%', minHeight: 150,
                background: '#FFFFFF', color: '#262626',
                border: '1px solid rgba(31,26,46,0.16)', borderRadius: 12,
                padding: '0.65rem 0.75rem', fontSize: 16, lineHeight: 1.65,
                fontFamily: IRIS_FONTS.body, outline: 'none', resize: 'vertical',
              }}
            />
          ) : (
            <div style={{ flex: 1 }}>
              <p style={{
                margin: 0, color: '#262626', fontSize: '0.9rem', lineHeight: 1.65,
                whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
                ...(igExpanded ? {} : {
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical' as const,
                  overflow: 'hidden',
                }),
              }}>
                {igCaption}
              </p>
              <button
                type="button"
                onClick={() => setIgExpanded(v => !v)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: '#8E8E8E', fontSize: '0.78rem', fontWeight: 600,
                  padding: '0.35rem 0', minHeight: 32, fontFamily: IRIS_FONTS.body,
                }}
              >
                {igExpanded ? 'たたむ' : '…続きを読む'}
              </button>
            </div>
          )}

          {/* ハッシュタグ (薄ピンクチップ) */}
          {igTags.length > 0 && (
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {igTags.map(t => (
                <span key={t} style={{
                  background: 'rgba(225,48,108,0.08)',
                  border: '1px solid rgba(225,48,108,0.18)',
                  color: '#C13584',
                  borderRadius: 999, padding: '0.22rem 0.6rem',
                  fontSize: '0.72rem', fontWeight: 600,
                }}>
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* リール台本フック案 */}
          {result.instagram.reelHook && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.45rem',
              background: 'rgba(225,48,108,0.05)', borderRadius: 12,
              padding: '0.6rem 0.7rem',
            }}>
              <Film size={14} color="#E1306C" strokeWidth={2.2} style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#3D3247', lineHeight: 1.55 }}>
                <b style={{ color: '#C13584' }}>リールにするなら:</b> {result.instagram.reelHook}
              </p>
            </div>
          )}

          <footer style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', borderTop: '1px solid rgba(31,26,46,0.08)', paddingTop: '0.65rem' }}>
            <ActionBtn onClick={() => setEditing(e => (e === 'ig' ? null : 'ig'))}>
              {editing === 'ig' ? <Check size={14} /> : <Pencil size={14} />}
              {editing === 'ig' ? '完了' : '編集'}
            </ActionBtn>
            <ActionBtn onClick={() => doCopy('ig', igCopyText)}>
              {copied === 'ig' ? <Check size={14} /> : <Copy size={14} />}
              {copied === 'ig' ? 'コピーした' : 'コピー'}
            </ActionBtn>
            {queue?.add && (
              <ActionBtn onClick={() => reserve('ig')}>
                <CalendarClock size={14} />
                {reserved.ig ? `予約済み ${reserved.ig}` : 'ベスト枠に予約'}
              </ActionBtn>
            )}
            <ActionBtn primary onClick={shareIg}>
              <Send size={14} />
              Instagramへ
            </ActionBtn>
          </footer>
        </motion.article>

        {/* ══ note カード ══ */}
        <motion.article {...enter(2)} style={{
          background: '#FFFDF8',
          border: '1px solid rgba(31,26,46,0.1)',
          borderRadius: 20,
          padding: '1.05rem 1rem',
          boxShadow: cardShadow,
          display: 'flex', flexDirection: 'column', gap: '0.7rem',
        }}>
          <header style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              fontFamily: IRIS_FONTS.body, fontWeight: 800, fontSize: '0.95rem',
              color: '#41C9B4', letterSpacing: '-0.01em',
            }}>
              note
            </span>
            <span style={{ fontSize: '0.68rem', color: '#8A7AA0', fontWeight: 600 }}>
              記事の下書き
            </span>
          </header>

          {editing === 'note' ? (
            <textarea
              value={noteText}
              onChange={e => { setNoteText(e.target.value); setNoteEdited(true); }}
              rows={9}
              autoFocus
              style={{
                width: '100%', minHeight: 200,
                background: '#FFFFFF', color: '#1F1A2E',
                border: '1px solid rgba(31,26,46,0.16)', borderRadius: 12,
                padding: '0.65rem 0.75rem', fontSize: 16, lineHeight: 1.7,
                fontFamily: IRIS_FONTS.body, outline: 'none', resize: 'vertical',
              }}
            />
          ) : noteEdited ? (
            /* ユーザーが編集した場合は編集後の全文をそのまま見せる */
            <p style={{
              margin: 0, color: '#2A1A3A', fontSize: '0.86rem', lineHeight: 1.75,
              whiteSpace: 'pre-wrap', overflowWrap: 'break-word', flex: 1,
            }}>
              {noteText}
            </p>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <h3 style={{
                margin: 0,
                fontFamily: IRIS_FONTS.display, fontWeight: 700,
                fontSize: '1.12rem', lineHeight: 1.45, color: '#1F1A2E',
                overflowWrap: 'break-word',
              }}>
                {result.note.title}
              </h3>
              <p style={{
                margin: 0, color: '#3D3247', fontSize: '0.85rem', lineHeight: 1.8,
                whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
              }}>
                {result.note.lead}
              </p>
              {result.note.headings.length > 0 && (
                <div>
                  <p style={{
                    margin: '0 0 0.35rem', fontSize: '0.64rem', letterSpacing: '0.18em',
                    color: '#8A7AA0', fontWeight: 800, textTransform: 'uppercase',
                  }}>
                    見出し構成
                  </p>
                  <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {result.note.headings.map((h, i) => (
                      <li key={i} style={{
                        display: 'flex', gap: '0.55rem', alignItems: 'baseline',
                        padding: '0.4rem 0',
                        borderTop: '1px solid rgba(31,26,46,0.07)',
                        fontSize: '0.82rem', color: '#2A1A3A', lineHeight: 1.5,
                      }}>
                        <span style={{
                          fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
                          color: '#C13584', fontWeight: 700, fontSize: '0.85rem',
                          flexShrink: 0,
                        }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        {h}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}

          <footer style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', borderTop: '1px solid rgba(31,26,46,0.08)', paddingTop: '0.65rem' }}>
            <ActionBtn onClick={() => setEditing(e => (e === 'note' ? null : 'note'))}>
              {editing === 'note' ? <Check size={14} /> : <Pencil size={14} />}
              {editing === 'note' ? '完了' : '編集'}
            </ActionBtn>
            <ActionBtn onClick={() => doCopy('note', noteText)}>
              {copied === 'note' ? <Check size={14} /> : <Copy size={14} />}
              {copied === 'note' ? 'コピーした' : 'コピー'}
            </ActionBtn>
            <ActionBtn primary onClick={copyAndOpenNote}>
              <ExternalLink size={14} />
              コピーしてnoteで書く
            </ActionBtn>
          </footer>
        </motion.article>
      </div>

      <style>{`
        .iris-pcards {
          display: flex;
          gap: 0.85rem;
          overflow-x: auto;
          padding: 0.15rem 0.15rem 0.7rem;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
        }
        .iris-pcards > * {
          flex: 0 0 min(82vw, 320px);
          scroll-snap-align: center;
        }
        @media (min-width: 768px) {
          .iris-pcards {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            overflow: visible;
            padding: 0.15rem;
          }
          .iris-pcards > * { flex: none; }
        }
      `}</style>
    </section>
  );
}

// ─── 共通アクションボタン ─────
function ActionBtn({ dark, primary, onClick, children }: {
  dark?: boolean;
  primary?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        minHeight: 44, padding: '0.35rem 0.8rem', borderRadius: 12,
        background: primary
          ? 'linear-gradient(135deg, #E1306C, #833AB4)'
          : dark ? 'rgba(255,255,255,0.08)' : 'rgba(31,26,46,0.05)',
        border: primary
          ? 'none'
          : dark ? '1px solid rgba(255,255,255,0.16)' : '1px solid rgba(31,26,46,0.1)',
        color: primary ? '#FFFFFF' : dark ? '#E7E9EA' : '#3D3247',
        fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer',
        fontFamily: IRIS_FONTS.body,
        boxShadow: primary ? '0 4px 12px rgba(225,48,108,0.3)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

// ─── X (旧Twitter) 公式グリフ — lucide に無いため自作 SVG ─────
function XGlyph({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" />
    </svg>
  );
}
