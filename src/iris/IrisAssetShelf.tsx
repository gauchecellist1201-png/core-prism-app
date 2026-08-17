// ============================================================
// CORE Iris ▸ 素材の棚 (Media Library) — 2026-08-03
//
// 何のためにあるか:
//   リールを 2 本目から作るとき、毎回カメラロールを開き直すのをやめる。
//   一度読み込んだ写真・動画はこの端末の中に残り続け、次からは「棚から選ぶだけ」。
//
// 約束:
//   ・素材はどこにも送らない (IndexedDB = この端末の中だけ)
//   ・黙って消さない。消すのはユーザーが選んだ時だけで、必ず確認する
//   ・数字は実測値だけ (件数・使った回数・使用量)。推定や水増しはしない
// ============================================================
import React, { useCallback, useEffect, useState } from 'react';
import { Film, Layers, Check, Trash2, Plus, Loader2, AlertCircle, X, RefreshCw } from 'lucide-react';
import type { IrisBackgroundDef } from './irisStyle';
import { listLibrary, deleteLibraryItems, type LibraryItem } from './reelStore';

/** 棚から素材を出せなかった理由を、人の言葉にする。英語の原文は console にだけ残す。
 *  返す文は必ず「次に何をすればいいか」で終える。 */
function humanizeMediaError(e: unknown): string {
  try { console.warn('[iris/shelf] pick failed:', e); } catch { /* noop */ }
  const name = (e as { name?: string } | null)?.name;
  if (name === 'QuotaExceededError')
    return 'この端末の空きが足りないようです。「整理」から使っていない素材を減らしてから、もう一度おためしください。';
  if (name === 'NotFoundError')
    return '棚の中身が見つかりませんでした。ページを開き直すと直ることがあります。';
  if (name === 'NotReadableError' || name === 'SecurityError')
    return 'ファイルを読み取れませんでした。もう一度おためしください。';
  return 'もう一度おためしください。何度も続くときは、別の素材でおためしください。';
}

/** 読み込み済みのメディア要素から小さなサムネイルを作る (9:16 で切り抜く)。
 *  失敗しても undefined を返すだけ — 棚には名前で残る。 */
export function makeThumbDataUrl(el: HTMLImageElement | HTMLVideoElement): string | undefined {
  try {
    const W = 132, H = 234;   // 9:16。棚のタイル (66×117) の 2 倍 = Retina で綺麗
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) return undefined;
    const sw = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth;
    const sh = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight;
    if (!sw || !sh) return undefined;
    // cover: はみ出す方を切る
    const scale = Math.max(W / sw, H / sh);
    const dw = sw * scale, dh = sh * scale;
    ctx.drawImage(el, (W - dw) / 2, (H - dh) / 2, dw, dh);
    return c.toDataURL('image/jpeg', 0.72);
  } catch { return undefined; }
}

/** バイト数を人が読める形に (実測値のまま・切り上げない) */
function fmtBytes(n: number): string {
  if (!n || n < 0) return '0 MB';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

interface Props {
  bg: IrisBackgroundDef;
  /** いま編集中のリールが使っている assetId。棚では「使用中」と出し、消しても Blob は残す */
  activeAssetIds: string[];
  /** 棚のタイルを押した時。素材の実体を渡すので、呼び出し側でクリップに変換する */
  onPick: (item: LibraryItem) => void | Promise<void>;
  /** 空の棚の 1 つだけのボタン。押すと「写真・動画を選ぶ」を開く */
  onRequestAdd?: () => void;
  /** 中身が変わった合図 (素材を足した / 書き出した)。変わるたびに読み直す */
  refreshKey?: number;
}

export default function IrisAssetShelf({ bg, activeAssetIds, onPick, onRequestAdd, refreshKey = 0 }: Props) {
  const [items, setItems] = useState<LibraryItem[] | null>(null);   // null = 読み込み中
  const [tidy, setTidy] = useState(false);                          // 整理モード
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [pickErr, setPickErr] = useState('');
  // 失敗した素材そのものを覚えておく。覚えていないと「もう一度」を出せず、
  // 横スクロールの棚から同じタイルを目で探し直させることになる。
  const [pickErrItem, setPickErrItem] = useState<LibraryItem | null>(null);
  /** 端末の空き。取れない環境 (Safari の一部) では出さない — 分からないものは書かない */
  const [space, setSpace] = useState<{ usage: number; quota: number } | null>(null);

  const reload = useCallback(async () => {
    const rows = await listLibrary();
    setItems(rows);
  }, []);

  useEffect(() => { void reload(); }, [reload, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const est = await navigator.storage?.estimate?.();
        if (cancelled || !est || !est.quota || !est.usage) return;
        setSpace({ usage: est.usage, quota: est.quota });
      } catch { /* 取れない端末では出さない */ }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const active = new Set(activeAssetIds);
  const list = items || [];
  const totalBytes = list.reduce((s, it) => s + (it.size || 0), 0);
  const near = space ? space.usage / space.quota >= 0.8 : false;
  // 消す候補 = まだ一度も使っていない & 古い順。黙って消さず、これを提案するだけ
  const purgeCandidates = list
    .filter(it => !it.usedCount && !active.has(it.id))
    .sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0))
    .slice(0, 10);

  const doDelete = async (ids: string[]) => {
    await deleteLibraryItems(ids, activeAssetIds);
    setConfirmIds(null);
    await reload();
  };

  const handlePick = async (it: LibraryItem) => {
    setPickErr('');
    setPickErrItem(null);
    setPicking(it.id);
    try { await onPick(it); }
    catch (e) {
      // 以前は e.message を括弧に入れてそのまま出していて、
      // 「（NotReadableError: The I/O read operation failed）」のような英語が人に見えていた。
      setPickErr(`「${it.name || '素材'}」を読み込めませんでした。${humanizeMediaError(e)}棚からは消していません。`);
      setPickErrItem(it);
    }
    finally { setPicking(null); }
  };

  const headStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
    fontSize: 12, fontWeight: 800, color: bg.ink, margin: 0,
  };

  // ── 読み込み中: 棚があるかどうかも分からないうちは何も断定しない ──
  if (items === null) {
    return (
      <p style={{ margin: '12px 2px 0', fontSize: 11.5, color: bg.inkSoft, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Loader2 size={12} className="spin" style={{ flexShrink: 0 }} />
        棚を開いています…
      </p>
    );
  }

  // ── 空っぽ 3 点セット (何が起きるか / なぜ空か / 押せるボタン 1 つ) ──
  if (!list.length) {
    return (
      <div style={{
        marginTop: 12, padding: '1rem',
        border: `1px dashed ${bg.accent}44`, borderRadius: 16,
        background: `${bg.accent}07`,
      }}>
        <p style={headStyle}>
          <Layers size={13} style={{ color: bg.accentText, flexShrink: 0 }} />
          まだ棚は空です
        </p>
        <p style={{ margin: '5px 0 10px', fontSize: 11.5, lineHeight: 1.6, color: bg.inkSoft, overflowWrap: 'break-word' }}>
          写真や動画を入れると、ここに残ります。次に作るときはカメラロールを開かずに、
          <strong style={{ color: bg.ink }}>棚から選ぶだけ</strong>で始められます。
          素材はこの端末の中だけに置かれ、どこにも送りません。
        </p>
        {onRequestAdd && (
          <button onClick={onRequestAdd} style={{
            minHeight: 44, padding: '0 1rem',
            background: bg.accentSolid, color: '#fff', border: 'none', borderRadius: 12,
            fontSize: 13, fontWeight: 800, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <Plus size={15} /> 写真・動画を選ぶ
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <p style={headStyle}>
          <Layers size={13} style={{ color: bg.accentText, flexShrink: 0 }} />
          棚の素材 {list.length} 件
          <span style={{ fontWeight: 600, color: bg.inkSoft }}>（この端末 {fmtBytes(totalBytes)}）</span>
        </p>
        <button onClick={() => setTidy(t => !t)} style={{
          minHeight: 44, padding: '0 0.85rem',
          background: 'transparent', color: tidy ? bg.accentText : bg.inkSoft,
          border: `1px solid ${bg.accent}44`, borderRadius: 999,
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
        }}>
          {tidy ? <><X size={13} /> 整理をやめる</> : <><Trash2 size={13} /> 整理</>}
        </button>
      </div>
      <p style={{ margin: '4px 2px 8px', fontSize: 11, color: bg.inkSoft, lineHeight: 1.55 }}>
        {tidy ? '消したい素材の × を押してください。消す前に必ず確認します。'
              : 'タップすると、いま作っているリールに入ります。'}
      </p>

      {/* 端末の空きが少ない時だけ。勝手に消さず、提案して確認を取る */}
      {near && purgeCandidates.length > 0 && (
        <div style={{
          margin: '0 0 10px', padding: '0.8rem 0.9rem',
          background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.45)',
          borderRadius: 14,
        }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: bg.ink, overflowWrap: 'break-word' }}>
            この端末の空きが少なくなっています
          </p>
          <p style={{ margin: '4px 0 8px', fontSize: 11.5, lineHeight: 1.6, color: bg.inkSoft, overflowWrap: 'break-word' }}>
            {space ? `${fmtBytes(space.usage)} / ${fmtBytes(space.quota)} を使っています。` : ''}
            まだ一度も使っていない古い素材が {purgeCandidates.length} 件あります。勝手には消しません。
          </p>
          <button onClick={() => setConfirmIds(purgeCandidates.map(c => c.id))} style={{
            minHeight: 44, padding: '0 1rem',
            background: 'transparent', color: bg.ink, border: `1px solid ${bg.accent}66`,
            borderRadius: 12, fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
          }}>
            使っていない古い {purgeCandidates.length} 件を見る
          </button>
        </div>
      )}

      {/* 消す前の確認 — 何が消えるかを名前で見せる */}
      {confirmIds && (
        <div style={{
          margin: '0 0 10px', padding: '0.85rem 0.95rem',
          background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.42)',
          borderRadius: 14,
        }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: bg.ink, overflowWrap: 'break-word' }}>
            この {confirmIds.length} 件を棚から消します。元には戻せません。
          </p>
          <p style={{ margin: '4px 0 8px', fontSize: 11.5, lineHeight: 1.6, color: bg.inkSoft, overflowWrap: 'break-word' }}>
            {list.filter(it => confirmIds.includes(it.id)).slice(0, 6).map(it => it.name || '名前のない素材').join('、')}
            {confirmIds.length > 6 ? ` ほか ${confirmIds.length - 6} 件` : ''}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => void doDelete(confirmIds)} style={{
              minHeight: 44, padding: '0 1rem',
              background: '#dc2626', color: '#fff', border: 'none', borderRadius: 12,
              fontSize: 13, fontWeight: 800, cursor: 'pointer',
            }}>
              消す
            </button>
            <button onClick={() => setConfirmIds(null)} style={{
              minHeight: 44, padding: '0 1rem',
              background: 'transparent', color: bg.inkSoft, border: `1px solid ${bg.accent}44`,
              borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              やめる
            </button>
          </div>
        </div>
      )}

      {pickErr && (
        <div role="alert" style={{
          margin: '0 0 8px', padding: '0.6rem 0.75rem', borderRadius: 12,
          background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.42)',
          fontSize: 11.5, lineHeight: 1.6, color: bg.ink,
          overflowWrap: 'break-word',
        }}>
          <p style={{ margin: 0, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <AlertCircle size={13} style={{ color: '#e11d48', flexShrink: 0, marginTop: 2 }} />
            {pickErr}
          </p>
          {/* 失敗した素材が分かっている時は、棚から目で探し直させない */}
          {pickErrItem && (
            <button
              onClick={() => void handlePick(pickErrItem)}
              disabled={picking === pickErrItem.id}
              style={{
                marginTop: 8, minHeight: 44, padding: '0 1rem',
                background: bg.accentSolid, color: '#fff', border: 'none', borderRadius: 12,
                fontSize: 12.5, fontWeight: 800,
                cursor: picking === pickErrItem.id ? 'progress' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
              <RefreshCw size={14} />
              {picking === pickErrItem.id ? 'もう一度ためしています…' : 'もう一度ためす'}
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
        {list.map(it => {
          const inUse = active.has(it.id);
          return (
            <div key={it.id} style={{ flexShrink: 0, width: 66 }}>
              <button
                onClick={() => (tidy ? setConfirmIds([it.id]) : void handlePick(it))}
                disabled={picking === it.id}
                aria-label={tidy ? `${it.name || '素材'} を棚から消す` : `${it.name || '素材'} をリールに入れる`}
                style={{
                  position: 'relative', display: 'block', padding: 0,
                  width: 66, height: 117, borderRadius: 10, overflow: 'hidden',
                  background: '#000', cursor: picking === it.id ? 'wait' : 'pointer',
                  border: inUse ? `2px solid ${bg.accent}` : `1.5px solid ${bg.cardBorder}`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                }}>
                {it.thumb
                  ? <img src={it.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{
                      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 9, padding: 4, textAlign: 'center', lineHeight: 1.3, wordBreak: 'break-all',
                    }}>{(it.name || '素材').slice(0, 18)}</span>}

                {picking === it.id && (
                  <span style={{
                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                  }}><Loader2 size={16} className="spin" /></span>
                )}

                {tidy && (
                  <span style={{
                    position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(220,38,38,0.92)', color: '#fff',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}><X size={12} /></span>
                )}

                {it.kind === 'video' && (
                  <span style={{
                    position: 'absolute', top: 3, left: 3,
                    background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 4, padding: '1px 3px',
                    display: 'inline-flex',
                  }}><Film size={10} /></span>
                )}

                {/* 使った印 — 同じ絵を続けて使わないため */}
                {it.usedCount > 0 && (
                  <span style={{
                    position: 'absolute', bottom: 3, left: 3,
                    background: 'rgba(0,0,0,0.62)', color: '#fff', borderRadius: 4,
                    padding: '1px 4px', fontSize: 8.5, fontWeight: 800,
                    display: 'inline-flex', alignItems: 'center', gap: 2,
                  }}>
                    <Check size={9} />使った{it.usedCount > 1 ? ` ${it.usedCount}` : ''}
                  </span>
                )}
                {inUse && (
                  <span style={{
                    position: 'absolute', bottom: 3, right: 3,
                    background: bg.accentSolid, color: '#fff', borderRadius: 4,
                    padding: '1px 4px', fontSize: 8.5, fontWeight: 800,
                  }}>使用中</span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
