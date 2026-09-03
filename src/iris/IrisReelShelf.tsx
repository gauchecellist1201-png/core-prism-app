// ============================================================
// CORE Iris ▸ 作ったリールの棚 — 2026-08-31
//
// 何のためにあるか:
//   これまで保存枠は 1 つだけで、2 本目を作り始めた瞬間に 1 本目の
//   並び・尺・字幕が上書きで消えていた。素材の棚は残るのに、
//   組み上げた結果だけが残らない = 毎回ゼロから組み直しになっていた。
//   ここは「先週作ったリールを開き直す」を 2 タップにするための薄い一覧。
//
// 約束:
//   ・保存は今までどおり自動 (「保存」ボタンは増やさない)
//   ・消す時は必ず確認し、消したあとも 10 秒は元に戻せる
//   ・数字は実測値だけ (カットの枚数・保存時刻)。推定しない
//   ・1 本も無い時は 1px も出さない (今までと同じ画面のまま)
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { Film, Loader2, Trash2, Undo2, X } from 'lucide-react';
import type { IrisBackgroundDef } from './irisStyle';
import {
  listReelProjects, loadReelProjectById, deleteReelProject, restoreReelProject, reelSavedLabel,
  type ReelProjectSummary, type StoredProject,
} from './reelStore';

interface Props {
  bg: IrisBackgroundDef;
  /** すぐ上の「前回のつづきから」で既に出している 1 本の id。
   *  同じものを 2 つ並べないため、一覧からは外す */
  hiddenId?: string;
  /** 一覧の 1 本を開く。呼び出し側が素材を読み直してクリップに戻す */
  onOpen: (id: string) => void | Promise<void>;
  /** 中身が変わった合図 (保存した / 新しく作った)。変わるたびに読み直す */
  refreshKey?: number;
  /** 復元中などで触らせたくない時 */
  busy?: boolean;
}

export default function IrisReelShelf({ bg, hiddenId, onOpen, refreshKey = 0, busy = false }: Props) {
  const [items, setItems] = useState<ReelProjectSummary[] | null>(null); // null = 読み込み中
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [undo, setUndo] = useState<StoredProject | null>(null);
  const [err, setErr] = useState('');
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    const rows = await listReelProjects();
    setItems(rows);
  }, []);

  // 画面を離れたあとに書き込まない (外した画面へ setState しない)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows = await listReelProjects();
      if (!cancelled) setItems(rows);
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  const remove = async (id: string) => {
    setConfirmId(null);
    setErr('');
    // 消す前に中身を控える — 控えずに消すと「元に戻す」が嘘になる
    const kept = await loadReelProjectById(id);
    const r = await deleteReelProject(id);
    if (!r.ok) { setErr(r.message); return; }
    await reload();
    if (kept) {
      setUndo(kept);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndo(null), 10000);
    }
  };

  const doUndo = async () => {
    if (!undo) return;
    const p = undo;
    setUndo(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const r = await restoreReelProject(p);
    if (!r.ok) { setErr(r.message); return; }
    await reload();
  };

  // すぐ上の「前回のつづきから」に出ている 1 本は外す (同じものを 2 つ並べない)
  const rows = (items || []).filter(r => r.id !== hiddenId);

  // 1 本も無い / まだ読めていない間は、今までの画面と 1px も変えない
  if (!rows.length && !undo && !err) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{
        margin: '0 0 8px', fontSize: 11.5, fontWeight: 800, letterSpacing: '.04em',
        color: bg.inkSoft,
      }}>
        作ったリール（{rows.length}）
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(it => {
          const isConfirm = confirmId === it.id;
          return (
            <div key={it.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: 8, borderRadius: 14,
              background: `${bg.accent}0c`,
              border: `1px solid ${bg.accent}33`,
            }}>
              {/* 1 枚目のサムネ。棚に無い素材では出さない (無いものを描かない) */}
              <div style={{
                width: 44, height: 60, borderRadius: 9, flexShrink: 0, overflow: 'hidden',
                background: `${bg.accent}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {it.thumb
                  ? <img src={it.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Film size={18} color={bg.accent} strokeWidth={1.6} />}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0, fontSize: 13, fontWeight: 800, color: bg.ink,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {it.title}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: bg.inkSoft }}>
                  カット {it.clipCount} 枚 ・ {reelSavedLabel(it.savedAt)}
                </p>
              </div>

              {isConfirm ? (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => void remove(it.id)} style={{
                    minHeight: 44, minWidth: 44, padding: '0 .7rem', border: 'none', borderRadius: 11,
                    background: '#dc2626', color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
                  }}>消す</button>
                  <button onClick={() => setConfirmId(null)} aria-label="やめる" style={{
                    minHeight: 44, minWidth: 44, border: `1px solid ${bg.accent}44`, borderRadius: 11,
                    background: 'transparent', color: bg.inkSoft, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}><X size={16} /></button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => { setOpening(it.id); void Promise.resolve(onOpen(it.id)).finally(() => setOpening(null)); }}
                    disabled={busy || !!opening}
                    style={{
                      minHeight: 44, padding: '0 .9rem', border: 'none', borderRadius: 11,
                      background: bg.accentSolid, color: '#fff', fontSize: 12.5, fontWeight: 800,
                      cursor: busy || opening ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                    {opening === it.id ? <Loader2 size={13} className="spin" /> : null}
                    開く
                  </button>
                  <button onClick={() => setConfirmId(it.id)} aria-label={`${it.title} を消す`} style={{
                    minHeight: 44, minWidth: 44, border: `1px solid ${bg.accent}44`, borderRadius: 11,
                    background: 'transparent', color: bg.inkSoft, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}><Trash2 size={15} /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 消したあとの取り消し (10 秒)。押せる形で出す — 文章で謝らない */}
      {undo && (
        <div style={{
          marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: '.6rem .75rem', borderRadius: 12,
          background: `${bg.accent}14`, border: `1px solid ${bg.accent}44`,
        }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: bg.ink }}>
            「{undo.title || 'リール'}」を消しました
          </span>
          <button onClick={() => void doUndo()} style={{
            minHeight: 44, padding: '0 .9rem', marginLeft: 'auto', border: 'none', borderRadius: 11,
            background: bg.accentSolid, color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <Undo2 size={14} />元に戻す
          </button>
        </div>
      )}

      {err && (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#dc2626', fontWeight: 700 }}>{err}</p>
      )}
    </div>
  );
}
