// ============================================================
// 追客 — 期限で並べる。1回で終わらせないための画面。
// 期限超過 → 今日 → 今週 → 先 の順。切り口 (何回目に何を送るか) も出す。
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { T, daysFromToday, shortDate, todayStr } from '../theme';
import { Btn, Card, Chip, Empty, ErrorNote, Label, Muted, Spinner } from '../ui';
import { fetchRows } from '../api';
import type { CompanyRow } from '../shared/types';
import { FOLLOWUPS, stageMeta } from '../shared/catalog';

interface Bucket { key: string; label: string; color: string; rows: CompanyRow[] }

export default function FollowupsView({ rev, onOpen }: { rev: number; onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<CompanyRow[] | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  // 効果の中で同期的に setState しない (await のあとだけで触る)
  const load = useCallback(async () => {
    try {
      const r = await fetchRows();
      setRows(r.rows);
      setErr('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);
  const reload = useCallback(() => { void load(); }, [load]);
  useEffect(() => { void load(); }, [load, rev]);

  const buckets = useMemo<Bucket[]>(() => {
    // 失注も、再アプローチ日が来ていれば出す (来ていないうちは出さない)。
    const today = todayStr();
    const list = (rows ?? []).filter(r =>
      r.nextActionAt && (r.stage !== 'LOST' || r.nextActionAt <= today));
    const b: Bucket[] = [
      { key: 'over', label: '期限を過ぎている', color: T.red, rows: [] },
      { key: 'today', label: '今日', color: T.amber, rows: [] },
      { key: 'week', label: '今週 (7日以内)', color: T.blue, rows: [] },
      { key: 'later', label: 'それ以降', color: T.mute, rows: [] },
    ];
    for (const r of list) {
      const d = daysFromToday(r.nextActionAt);
      if (d === null) continue;
      if (d < 0) b[0].rows.push(r);
      else if (d === 0) b[1].rows.push(r);
      else if (d <= 7) b[2].rows.push(r);
      else b[3].rows.push(r);
    }
    for (const x of b) x.rows.sort((p, q) => (p.nextActionAt || '').localeCompare(q.nextActionAt || ''));
    return b.filter(x => x.rows.length > 0);
  }, [rows]);

  if (err) return <ErrorNote onRetry={reload}>{err}</ErrorNote>;
  if (loading && !rows) return <Spinner />;
  if (!rows) return null;

  const total = buckets.reduce((a, b) => a + b.rows.length, 0);

  return (
    <div>
      <Card style={{ marginBottom: 14 }}>
        <Label>追客の型</Label>
        <div style={{ marginTop: 8, display: 'grid', gap: 5 }}>
          {FOLLOWUPS.map(f => (
            <div key={f.touch} style={{ display: 'flex', gap: 8, fontSize: 12, lineHeight: 1.75 }}>
              <span style={{ color: T.gold, fontWeight: 800, minWidth: 62, flexShrink: 0 }}>{f.afterDays}日後</span>
              <span style={{ color: T.ink, fontWeight: 700, minWidth: 78, flexShrink: 0 }}>{f.angle}</span>
              <span style={{ color: T.mute, minWidth: 0 }}>{f.instruction}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10 }}><Muted>毎回同じ営業文は送りません。回ごとに中身が変わります。</Muted></div>
      </Card>

      {total === 0 ? (
        <Empty title="追いかける相手がいません" body="まだ誰にも接触していないか、全員の予定日が入っていません。今日タブから最初の1社を打ってください。" />
      ) : (
        buckets.map(b => (
          <div key={b.key} style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 2px 8px' }}>
              <Label>{b.label}</Label>
              <Chip color={b.color} active>{b.rows.length}</Chip>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {b.rows.map(r => {
                const d = daysFromToday(r.nextActionAt);
                return (
                  <Card key={r.id} pad={12} onClick={() => onOpen(r.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 14, fontWeight: 800, color: T.ink,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{r.name || '(社名未設定)'}</div>
                        <div style={{ fontSize: 11.5, color: T.mute, marginTop: 4, lineHeight: 1.7 }}>
                          {r.nextActionLabel || stageMeta(r.stage).nextHint}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: b.color }}>{shortDate(r.nextActionAt)}</div>
                        <div style={{ fontSize: 10.5, color: T.faint, marginTop: 2 }}>
                          {d === null ? '' : d < 0 ? `${Math.abs(d)}日超過` : d === 0 ? '今日' : `あと${d}日`}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}

      <Btn full variant="quiet" onClick={reload}>最新にする</Btn>
    </div>
  );
}
