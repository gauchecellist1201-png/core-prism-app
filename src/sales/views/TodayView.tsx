// ============================================================
// 今日 — TODAY'S MISSION / TOP LEADS / ファネル
// 開いた瞬間に「誰に何をするか」が並ぶ。管理表は下に置く。
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { RADIUS, T, daysFromToday, yen } from '../theme';
import { Btn, Card, Chip, Dot, Empty, ErrorNote, Label, Spinner, Stat } from '../ui';
import { fetchToday } from '../api';
import type { TodayLead, TodayResponse } from '../shared/types';
import { scoreBand } from '../shared/score';
import { stageMeta } from '../shared/catalog';

const ACTION_COLOR: Record<TodayLead['action'], string> = {
  call: '#34D399',
  email: '#5BA8F5',
  followup: '#F5A524',
  analyze: '#A78BFA',
};

export default function TodayView(props: { rev: number; onOpen: (id: string) => void; onGoCompanies: () => void }) {
  const { rev, onOpen, onGoCompanies } = props;
  const [data, setData] = useState<TodayResponse | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  // 効果の中で同期的に setState しない (await のあとだけで触る)
  const load = useCallback(async () => {
    try {
      const d = await fetchToday();
      setData(d);
      setErr('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(() => { setLoading(true); void load(); }, [load]);

  useEffect(() => { void load(); }, [load, rev]);

  if (err) return <ErrorNote onRetry={reload}>{err}</ErrorNote>;
  if (loading && !data) return <Spinner label="今日やることを組み立てています…" />;
  if (!data) return null;

  const { mission, kpi, leads, funnel } = data;
  const missionTotal = mission.followup + mission.call + mission.email + mission.analyze;

  if (data.total === 0) {
    return (
      <Empty
        title="まだ営業先が1件もありません"
        body="企業タブでURLを貼れば、そのまま分析・企画・メール・電話トークまで作れます。1社だけでも入れてみてください。"
        action={<Btn variant="primary" onClick={onGoCompanies}>営業先を追加する</Btn>}
      />
    );
  }

  return (
    <div>
      {/* ---- 今日のミッション ---- */}
      <Card style={{ marginBottom: 14, borderColor: T.goldLine, background: 'linear-gradient(180deg, rgba(216,168,59,0.08), rgba(216,168,59,0))' }}>
        <Label>Today&apos;s Mission</Label>
        <div style={{ fontSize: 20, fontWeight: 900, margin: '6px 0 2px', letterSpacing: '-0.01em' }}>
          {missionTotal > 0 ? `今日やることは ${missionTotal} 件` : '今日の期限は空です'}
        </div>
        <div style={{ fontSize: 12.5, color: T.mute, lineHeight: 1.8, marginBottom: 12 }}>
          {data.overdue > 0
            ? `うち ${data.overdue} 件は期限を過ぎています。ここから消してください。`
            : missionTotal > 0
              ? '上から順に消していけば、その日の最善手になります。'
              : '新しい営業先を足すか、企業タブから前倒しで動けます。'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(84px, 1fr))', gap: 8 }}>
          <Stat label="追客" value={mission.followup} color={ACTION_COLOR.followup} />
          <Stat label="電話" value={mission.call} color={ACTION_COLOR.call} />
          <Stat label="メール" value={mission.email} color={ACTION_COLOR.email} />
          <Stat label="分析" value={mission.analyze} color={ACTION_COLOR.analyze} />
          <Stat label="商談中" value={mission.meeting} color={T.ink} />
        </div>
      </Card>

      {/* ---- トップリード ---- */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '18px 2px 10px' }}>
        <Label>Today&apos;s Top Leads</Label>
        <span style={{ fontSize: 11.5, color: T.faint }}>期限 → スコアの順</span>
      </div>

      {leads.length === 0 ? (
        <Empty title="今日の相手がいません" body="全社まだ分析前か、次にやる日が先に設定されています。企業タブから前倒しで進められます。" />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {leads.map((l, i) => <LeadCard key={l.row.id} lead={l} rank={i + 1} onOpen={onOpen} />)}
        </div>
      )}

      {/* ---- KPI ---- */}
      <div style={{ margin: '22px 2px 10px' }}><Label>数字</Label></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))', gap: 8 }}>
        <Stat label="今日の接触" value={kpi.todayTouched} sub={`電話${kpi.todayCalls} / メール${kpi.todayEmails}`} />
        <Stat label="返信" value={kpi.replies} sub={`返信率 ${kpi.replyRatePct}%`} color={T.blue} />
        <Stat label="商談" value={kpi.meetings} />
        <Stat label="受注" value={kpi.won} sub={`受注率 ${kpi.winRatePct}%`} color={T.green} />
        <Stat label="月額契約" value={kpi.monthly} color={T.green} />
        <Stat label="OEM" value={kpi.oem} color={T.gold} />
        <Stat label="見込 (商談中)" value={kpi.pipelineYen ? yen(kpi.pipelineYen) : '—'} sub={kpi.pipelineYen ? '' : '金額未入力'} />
        <Stat label="確定" value={kpi.wonYen ? yen(kpi.wonYen) : '—'} sub={kpi.avgDealYen ? `平均 ${yen(kpi.avgDealYen)}` : '金額未入力'} color={T.green} />
      </div>

      {/* ---- ファネル ---- */}
      <div style={{ margin: '22px 2px 10px' }}><Label>ファネル</Label></div>
      <Card>
        {funnel.map(f => {
          const max = Math.max(1, ...funnel.map(x => x.count));
          return (
            <div key={f.stage} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
              <div style={{ width: 78, fontSize: 12, color: T.body, flexShrink: 0 }}>{f.label}</div>
              <div style={{ flex: 1, height: 8, background: T.raise2, borderRadius: 999, overflow: 'hidden', minWidth: 0 }}>
                <div style={{ width: `${(f.count / max) * 100}%`, height: '100%', background: stageMeta(f.stage).color, borderRadius: 999 }} />
              </div>
              <div style={{ width: 30, textAlign: 'right', fontSize: 12.5, fontWeight: 800, color: f.count ? T.ink : T.faint }}>{f.count}</div>
            </div>
          );
        })}
        <div style={{ fontSize: 11.5, color: T.faint, marginTop: 8, lineHeight: 1.7 }}>
          合計 {data.total} 社。段は下がりません (返信をもらった会社が接触ずみに戻ることはありません)。
        </div>
      </Card>

      <div style={{ marginTop: 16 }}>
        <Btn full variant="quiet" onClick={reload}>最新にする</Btn>
      </div>
    </div>
  );
}

function LeadCard({ lead, rank, onOpen }: { lead: TodayLead; rank: number; onOpen: (id: string) => void }) {
  const { row, reason, action, actionLabel } = lead;
  const band = scoreBand(row.score);
  const color = ACTION_COLOR[action];
  const d = daysFromToday(row.nextActionAt);
  const overdue = d !== null && d < 0;

  return (
    <Card onClick={() => onOpen(row.id)} pad={13} style={{ borderColor: overdue ? 'rgba(248,113,113,0.4)' : T.line }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 8, background: T.raise2, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 900, color: rank <= 3 ? T.gold : T.mute,
        }}>{rank}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <div style={{
              fontSize: 15, fontWeight: 800, color: T.ink, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{row.name || '(社名未設定)'}</div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
            <Chip color={band.color} active>{row.score}点</Chip>
            <Chip color={stageMeta(row.stage).color} active>{stageMeta(row.stage).label}</Chip>
            {row.targetTier !== 'X' && <Chip color={T.gold} active>{row.targetTier}</Chip>}
          </div>

          <div style={{ fontSize: 11.5, color: T.mute, marginTop: 7, lineHeight: 1.7 }}>
            {reason.join(' ・ ')}
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 7, marginTop: 9,
            background: `${color}14`, border: `1px solid ${color}44`,
            borderRadius: RADIUS.sm, padding: '7px 9px',
          }}>
            <Dot color={color} />
            <div style={{ fontSize: 12.5, fontWeight: 800, color, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {actionLabel}
            </div>
            {overdue && (
              <div style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: T.red, whiteSpace: 'nowrap' }}>
                {Math.abs(d as number)}日超過
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
