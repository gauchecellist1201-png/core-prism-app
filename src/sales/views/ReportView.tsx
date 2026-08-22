// ============================================================
// レポート — CORE Studio Sales Report + 業種別の学習
// 母数が足りない区分は率を薄く出し、「読んではいけない」と明記する。
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { T, yen } from '../theme';
import { Btn, Card, Chip, CopyBtn, ErrorNote, Label, Muted, Spinner, Stat } from '../ui';
import { fetchReport } from '../api';
import type { IndustryStat, ReportResponse } from '../shared/types';

const RANGES = [7, 14, 30];

export default function ReportView({ rev }: { rev: number }) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<ReportResponse | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  // 効果の中で同期的に setState しない (await のあとだけで触る)
  const load = useCallback(async () => {
    try {
      const d = await fetchReport(days);
      setData(d); setErr('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [days]);

  const reload = useCallback(() => { setLoading(true); void load(); }, [load]);

  useEffect(() => { void load(); }, [load, rev]);

  if (err) return <ErrorNote onRetry={reload}>{err}</ErrorNote>;
  if (loading && !data) return <Spinner label="集計しています…" />;
  if (!data) return null;

  const t = data.totals;

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {RANGES.map(d => (
          <Chip key={d} color={T.gold} active={days === d} onClick={() => setDays(d)}>直近{d}日</Chip>
        ))}
      </div>

      <Card style={{ marginBottom: 14 }}>
        <Label>Sales Report</Label>
        <div style={{ fontSize: 12, color: T.mute, margin: '6px 0 12px' }}>
          {data.weekFrom} 〜 {data.weekTo}（この期間の活動）
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))', gap: 8 }}>
          <Stat label="接触" value={t.contacted} />
          <Stat label="返信" value={t.replied} color={T.blue} />
          <Stat label="商談" value={t.meetings} color={T.amber} />
          <Stat label="提案" value={t.proposals} color={T.amber} />
          <Stat label="受注" value={t.won} color={T.green} />
          <Stat label="月額" value={t.monthly} color={T.green} />
          <Stat label="OEM" value={t.oem} color={T.gold} />
          <Stat label="失注" value={t.lost} color={T.mute} />
        </div>
        <div style={{ marginTop: 10 }}>
          {/* 単発は「1本いくら」、月額は「月いくら」。足すと単位の無い数字になるので分けて出す */}
          <Muted>単発の受注額 (累計): {t.oneOffYen ? yen(t.oneOffYen) : '未入力'}</Muted>
          <Muted>月額 (MRR): {t.mrrYen ? `${yen(t.mrrYen)}／月` : '未入力'}</Muted>
        </div>
      </Card>

      {(data.recommendations.length > 0 || data.notes.length > 0) && (
        <Card style={{ marginBottom: 14, borderColor: T.goldLine }}>
          <Label>来週どこに寄せるか</Label>
          <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
            {data.recommendations.map((r, i) => (
              <div key={i} style={{ fontSize: 13, color: T.ink, lineHeight: 1.9 }}>・{r}</div>
            ))}
            {data.notes.map((n, i) => (
              <div key={`n${i}`} style={{ fontSize: 12, color: T.mute, lineHeight: 1.85 }}>※ {n}</div>
            ))}
          </div>
          {data.recommendations.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <CopyBtn label="この提案をコピー" text={data.recommendations.map(r => `・${r}`).join('\n')} />
            </div>
          )}
        </Card>
      )}

      {/* この2表だけ累計。期間で切ると母数が10件に届かず率を読める区分ができない */}
      <StatTable title="ターゲット区分ごと (累計)" rows={data.byTier} />
      <StatTable title="業種ごと (累計)" rows={data.byIndustry} />

      {data.lostReasons.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ margin: '0 2px 8px' }}><Label>失注理由</Label></div>
          <Card>
            {data.lostReasons.map(r => (
              <div key={r.reason} style={{ display: 'flex', gap: 10, padding: '5px 0', fontSize: 12.5 }}>
                <div style={{ flex: 1, minWidth: 0, color: T.body, wordBreak: 'break-word' }}>{r.reason}</div>
                <div style={{ color: T.ink, fontWeight: 800 }}>{r.count}</div>
              </div>
            ))}
          </Card>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Btn full variant="quiet" onClick={reload}>最新にする</Btn>
      </div>
    </div>
  );
}

function StatTable({ title, rows }: { title: string; rows: IndustryStat[] }) {
  if (!rows.length) return null;
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ margin: '0 2px 8px' }}><Label>{title}</Label></div>
      <Card pad={0}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 540 }}>
            <thead>
              <tr>
                {['区分', '社数', '接触', '返信率', '商談率', '受注率', '単発平均', 'MRR'].map(h => (
                  <th key={h} style={{
                    textAlign: h === '区分' ? 'left' : 'right', fontSize: 10.5, color: T.faint,
                    fontWeight: 800, padding: '10px 10px', borderBottom: `1px solid ${T.line}`, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const dim = r.tooSmall ? T.faint : T.ink;
                return (
                  <tr key={r.industry}>
                    <td style={{ padding: '9px 10px', fontSize: 12, color: T.body, borderBottom: `1px solid ${T.lineSoft}`, maxWidth: 170 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.industry}</div>
                      {r.tooSmall && <div style={{ fontSize: 10, color: T.faint }}>母数不足 (率は読まない)</div>}
                    </td>
                    <Td v={String(r.companies)} color={T.mute} />
                    <Td v={String(r.contacted)} color={T.mute} />
                    <Td v={`${r.replyRatePct}%`} color={dim} />
                    <Td v={`${r.meetingRatePct}%`} color={dim} />
                    <Td v={`${r.winRatePct}%`} color={dim} />
                    <Td v={r.avgOneOffYen ? yen(r.avgOneOffYen) : '—'} color={T.mute} />
                    <Td v={r.mrrYen ? `${yen(r.mrrYen)}／月` : '—'} color={T.mute} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Td({ v, color }: { v: string; color: string }) {
  return (
    <td style={{
      padding: '9px 10px', fontSize: 12, textAlign: 'right', color,
      borderBottom: `1px solid ${T.lineSoft}`, whiteSpace: 'nowrap', fontWeight: 700,
    }}>{v}</td>
  );
}
