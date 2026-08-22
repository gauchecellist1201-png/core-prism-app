// ============================================================
// 企業 — 一覧 / 追加 (1社・まとめて貼り付け) / 絞り込み
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { T, shortDate } from '../theme';
import { Btn, Card, Chip, Empty, ErrorNote, Field, Label, Muted, Sheet, Spinner } from '../ui';
import { createBulk, createCompany, fetchRows } from '../api';
import type { CompanyRow, TargetTier } from '../shared/types';
import { scoreBand } from '../shared/score';
import { stageMeta } from '../shared/catalog';

type Filter = 'all' | 'unanalyzed' | 'untouched' | 'A' | 'B' | 'C' | 'won' | 'lost';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'すべて' },
  { id: 'unanalyzed', label: '未分析' },
  { id: 'untouched', label: '未接触' },
  { id: 'A', label: 'A 代理店' },
  { id: 'B', label: 'B 求人' },
  { id: 'C', label: 'C 相性' },
  { id: 'won', label: '受注' },
  { id: 'lost', label: '失注' },
];

export default function CompaniesView(props: {
  rev: number; onOpen: (id: string) => void; onChanged: () => void;
}) {
  const { rev, onOpen, onChanged } = props;
  const [rows, setRows] = useState<CompanyRow[] | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [addOpen, setAddOpen] = useState(false);
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

  const shown = useMemo(() => {
    const list = rows ?? [];
    const needle = q.trim().toLowerCase();
    return list
      .filter(r => {
        if (filter === 'unanalyzed') return r.stage === 'NEW';
        if (filter === 'untouched') return r.touches === 0 && r.stage !== 'LOST';
        if (filter === 'won') return ['TRIAL', 'WON', 'MONTHLY', 'OEM'].includes(r.stage);
        if (filter === 'lost') return r.stage === 'LOST';
        if (filter === 'A' || filter === 'B' || filter === 'C') return r.targetTier === (filter as TargetTier);
        return true;
      })
      .filter(r => !needle || `${r.name} ${r.industry} ${r.url}`.toLowerCase().includes(needle))
      .sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name, 'ja'));
  }, [rows, q, filter]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            value={q} onChange={e => setQ(e.target.value)} placeholder="社名・業種・URLで探す"
            style={{
              width: '100%', boxSizing: 'border-box', background: '#0B0D12',
              border: `1px solid ${T.line}`, borderRadius: 12, color: T.ink,
              padding: '11px 12px', fontSize: 16, minHeight: 44, outline: 'none',
            }}
          />
        </div>
        <Btn variant="primary" onClick={() => setAddOpen(true)}>追加</Btn>
      </div>

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 6 }}>
        {FILTERS.map(f => (
          <Chip key={f.id} color={T.gold} active={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</Chip>
        ))}
      </div>

      {err ? <ErrorNote onRetry={reload}>{err}</ErrorNote> : null}
      {loading && !rows && !err ? <Spinner /> : null}

      {rows && rows.length === 0 && (
        <Empty
          title="営業先がまだありません"
          body="URLを1つ貼るだけで、そのまま企業分析・動画企画3案・メール・電話トークまで作れます。"
          action={<Btn variant="primary" onClick={() => setAddOpen(true)}>営業先を追加する</Btn>}
        />
      )}

      {rows && rows.length > 0 && (
        <>
          <Muted>{shown.length} 社 / 全 {rows.length} 社</Muted>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            {shown.map(r => <Row key={r.id} row={r} onOpen={onOpen} />)}
          </div>
          {shown.length === 0 && <Muted>この条件に当てはまる会社はありません。</Muted>}
        </>
      )}

      <AddSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onDone={() => { setAddOpen(false); reload(); onChanged(); }}
      />
    </div>
  );
}

function Row({ row, onOpen }: { row: CompanyRow; onOpen: (id: string) => void }) {
  const band = scoreBand(row.score);
  const st = stageMeta(row.stage);
  return (
    <Card onClick={() => onOpen(row.id)} pad={12}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 11, flexShrink: 0,
          background: `${band.color}18`, border: `1px solid ${band.color}44`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: band.color, lineHeight: 1 }}>{row.score}</div>
          <div style={{ fontSize: 8, color: band.color, fontWeight: 700 }}>点</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14.5, fontWeight: 800, color: T.ink,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{row.name || '(社名未設定)'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: st.color, fontWeight: 700 }}>{st.label}</span>
            {row.industry ? <span style={{ fontSize: 11, color: T.mute }}>{row.industry}</span> : null}
            {row.targetTier !== 'X' ? <span style={{ fontSize: 11, color: T.gold, fontWeight: 700 }}>{row.targetTier}</span> : null}
            <span style={{ fontSize: 11, color: T.faint }}>接触{row.touches}</span>
            {row.nextActionAt ? <span style={{ fontSize: 11, color: T.faint }}>次 {shortDate(row.nextActionAt)}</span> : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ---- 追加シート ----------------------------------------------------------
function AddSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<'one' | 'bulk'>('one');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [memo, setMemo] = useState('');
  const [bulk, setBulk] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState('');

  const reset = () => { setName(''); setUrl(''); setPhone(''); setEmail(''); setMemo(''); setBulk(''); setErr(''); setResult(''); };

  const submitOne = async () => {
    setBusy(true); setErr(''); setResult('');
    try {
      const r = await createCompany({ name, url, phone, email, memo });
      if (!r.created) { setErr(r.message || 'すでに登録ずみです。'); return; }
      reset();
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const submitBulk = async () => {
    setBusy(true); setErr(''); setResult('');
    try {
      const r = await createBulk(bulk);
      const msgs = [`${r.created} 社を追加しました。`];
      if (r.skipped) msgs.push(`${r.skipped} 社は重複などで飛ばしました。`);
      if (r.truncated) msgs.push(r.note);
      setResult(msgs.join(' '));
      if (r.created > 0) { setBulk(''); onDone(); }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  return (
    <Sheet open={open} title="営業先を追加" onClose={() => { reset(); onClose(); }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <Chip color={T.gold} active={mode === 'one'} onClick={() => setMode('one')}>1社ずつ</Chip>
        <Chip color={T.gold} active={mode === 'bulk'} onClick={() => setMode('bulk')}>まとめて貼る</Chip>
      </div>

      {mode === 'one' ? (
        <>
          <Field label="会社のURL" value={url} onChange={setUrl} placeholder="https://example.co.jp" inputMode="url"
            hint="URLだけでも大丈夫です。社名はサイトから読み取ります。" />
          <Field label="社名 (任意)" value={name} onChange={setName} placeholder="株式会社◯◯" />
          <Field label="電話 (任意)" value={phone} onChange={setPhone} placeholder="03-0000-0000" inputMode="tel" />
          <Field label="メール (任意)" value={email} onChange={setEmail} placeholder="info@example.co.jp" inputMode="email" />
          <Field label="メモ (任意)" value={memo} onChange={setMemo} rows={3}
            placeholder="どこで知ったか、誰の紹介か、求人を見たか など" hint="ここに書いたことは分析とメールの材料になります。" />
          {err ? <div style={{ marginBottom: 12 }}><ErrorNote>{err}</ErrorNote></div> : null}
          <Btn variant="primary" full disabled={busy || (!url.trim() && !name.trim())} onClick={submitOne}>
            {busy ? '追加しています…' : '追加する'}
          </Btn>
        </>
      ) : (
        <>
          <Label>1行に1社</Label>
          <Muted>「社名,URL」または URL だけ。カンマ・タブ区切りに対応しています。1回に最大60社。</Muted>
          <div style={{ height: 10 }} />
          <Field
            label="貼り付け" value={bulk} onChange={setBulk} rows={8}
            placeholder={'株式会社アルファ,https://alpha.co.jp\nhttps://beta.jp\nガンマ広告,gamma-ad.com'}
          />
          {err ? <div style={{ marginBottom: 12 }}><ErrorNote>{err}</ErrorNote></div> : null}
          {result ? <div style={{ marginBottom: 12, fontSize: 12.5, color: T.green, lineHeight: 1.8 }}>{result}</div> : null}
          <Btn variant="primary" full disabled={busy || !bulk.trim()} onClick={submitBulk}>
            {busy ? '取り込んでいます…' : 'まとめて追加する'}
          </Btn>
        </>
      )}
    </Sheet>
  );
}
