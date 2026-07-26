// ============================================================
// InstagramAgentBrief — 「Instagramをつなぐと、AIが勝手に働き出す」(2026-07-26)
//
// Prism のカレンダー/メール/売上 連携エージェントと同型を Iris に横展開。
// つないだあと放置せず、Iris が本人の実投稿を読んで自分から動く:
//  1. OAuth連携済みの実投稿(いいね/コメント/リーチ/保存)を読む
//  2. コード確定で「投稿が途切れている」「直近のリーチが落ちている」を検知
//     (AI不使用＝誤検知しない)
//  3. AI が「次に出すべきリール企画」を最大2件、実データを根拠に出す
//  4. ワンタップでリールスタジオへ企画を持ち込む
//
// 費用ガード: 1日1回だけ自動実行。未連携なら何も出さない。
// ============================================================
import { useCallback } from 'react';
import { fetchOauthMedia, isOauthConnected, type OauthMediaItem } from './instagramConnect';
import { useAgentBrief, askAgentRows, type BriefRow, type BriefResult } from '../lib/agentBrief';
import AgentBriefShell, { ACCENT_ROSE, type BriefAction } from '../components/AgentBriefShell';
import InstagramGlyph from './InstagramGlyph';

const BRIEF_KEY = 'iris_ig_agent_brief_v1';

function daysSince(iso: string): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return (Date.now() - t) / 86400000;
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

/** コード確定の検知（AIに数字を判定させない＝嘘ゼロ） */
function factRows(media: OauthMediaItem[]): BriefRow[] {
  const out: BriefRow[] = [];
  if (media.length === 0) return out;

  const sorted = [...media].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // ① 投稿が途切れている
  const gap = daysSince(sorted[0].timestamp);
  if (gap >= 7) {
    out.push({
      tone: 'alert',
      title: `最後の投稿から ${Math.floor(gap)}日 空いています`,
      detail: '間が空くほど表示が減ります。今日1本出すだけで戻せます。',
    });
  }

  // ② 直近3本のリーチが、その前6本の平均より30%以上落ちている
  const withReach = sorted.filter((m) => typeof m.reach === 'number' && (m.reach as number) > 0);
  if (withReach.length >= 9) {
    const recent = avg(withReach.slice(0, 3).map((m) => m.reach as number));
    const base = avg(withReach.slice(3, 9).map((m) => m.reach as number));
    if (base > 0 && recent < base * 0.7) {
      const pct = Math.round((1 - recent / base) * 100);
      out.push({
        tone: 'alert',
        title: `直近3本のリーチが ${pct}% 落ちています`,
        detail: `直近3本の平均 ${Math.round(recent).toLocaleString('ja-JP')} に対し、その前6本は ${Math.round(base).toLocaleString('ja-JP')}。切り口を変えるタイミングです。`,
      });
    }
  }
  return out;
}

function mediaLine(m: OauthMediaItem): string {
  const d = new Date(m.timestamp);
  const when = Number.isFinite(d.getTime()) ? `${d.getMonth() + 1}/${d.getDate()}` : '不明';
  const nums = [
    `いいね${m.likes}`,
    `コメント${m.comments}`,
    typeof m.reach === 'number' ? `リーチ${m.reach}` : '',
    typeof m.saved === 'number' ? `保存${m.saved}` : '',
  ].filter(Boolean).join('/');
  return `${when} [${m.mediaType}] ${nums} 「${(m.caption || '(キャプションなし)').slice(0, 60).replace(/\s+/g, ' ')}」`;
}

export default function InstagramAgentBrief({
  handle,
  onOpenReelStudio,
}: {
  /** 表示用の @ハンドル（あれば見出しの補足に使う） */
  handle?: string;
  /** 企画をリールスタジオへ持ち込む */
  onOpenReelStudio?: (theme: string) => void;
}) {
  const connected = typeof document !== 'undefined' && isOauthConnected();

  const runner = useCallback(async (): Promise<BriefResult> => {
    const media = await fetchOauthMedia();
    const rows = factRows(media);

    let aiRows: BriefRow[] = [];
    if (media.length > 0) {
      const list = [...media]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 12)
        .map(mediaLine)
        .join('\n');
      aiRows = await askAgentRows(
        'あなたはInstagram運用の専属ディレクターAIです。本人の実投稿の数字とキャプションを読み、次に出すべきリール企画を最大2件出します。title は企画名(20字以内)、detail は「誰の何の悩みに、どんな構成で」を具体的に書く。伸びた投稿の共通点を根拠にする。一般論は書かない。',
        `本人の直近投稿(新しい順):\n${list}`,
      );
    }

    return {
      rows: [...rows, ...aiRows],
      meta: media.length > 0
        ? `${handle ? `@${handle} の` : ''}実投稿 ${media.length}件の数字から`
        : '取得できる投稿がありません',
    };
  }, [handle]);

  const { rows, meta, loading, error, refresh } = useAgentBrief(BRIEF_KEY, connected, runner);

  if (!connected) return null; // 未連携なら何も出さない（偽の器を見せない）

  function actionsFor(row: BriefRow): BriefAction[] {
    if (!onOpenReelStudio || row.tone === 'alert') return [];
    return [{ label: 'この企画でリールを作る', run: () => onOpenReelStudio(`${row.title} — ${row.detail}`) }];
  }

  return (
    <AgentBriefShell
      explainId="ig-agent-brief"
      icon={<InstagramGlyph size={16} />}
      title="Instagram連携エージェント"
      meta={meta}
      accent={ACCENT_ROSE}
      loading={loading}
      error={error}
      emptyText="いまの投稿ペースと数字は保てています。"
      rows={rows}
      actionsFor={actionsFor}
      onRefresh={refresh}
    />
  );
}
