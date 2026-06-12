// ============================================================
// GoogleSuiteCard — Google カレンダー & ドキュメントの実連携カード
//   カレンダー: 隙間時間を可視化 → その隙間に会議を登録
//   ドキュメント: ドキュメント本文を CORE のナレッジに取り込む
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { CalendarDays } from 'lucide-react';
import { BrandIcon } from './BrandIcons';
import {
  isCalendarConnected, connectCalendar, getFreeSlots, createEvent, disconnectCalendar,
  type FreeSlot,
} from '../lib/gcal';
import {
  isDocsConnected, connectDocs, listDocs, readDocText, parseDriveId, disconnectDocs,
  type DriveDoc,
} from '../lib/gdocs';

type Ingest = (title: string, content: string) => unknown;

export default function GoogleSuiteCard({ onIngestKnowledge }: { onIngestKnowledge?: Ingest }) {
  return (
    <div style={{
      padding: '16px 16px 14px', borderRadius: 14, background: 'var(--surface)',
      border: '1px solid rgba(66,133,244,0.3)', marginBottom: 14, color: 'var(--fg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg,#4285F4,#34A853)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><CalendarDays size={20} color="#fff" strokeWidth={2.2} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 900, color: 'var(--fg-strong)', margin: 0 }}>
            Google カレンダー & ドキュメント
          </h3>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
            隙間時間に会議を入れ、ドキュメントを役員のナレッジに
          </div>
        </div>
      </div>
      <CalendarSection />
      <div style={{ height: 12 }} />
      <DocsSection onIngestKnowledge={onIngestKnowledge} />
    </div>
  );
}

function Sub({ brand, title }: { brand: 'gcalendar' | 'gdocs'; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <BrandIcon name={brand} size={22} />
      <strong style={{ fontSize: 12.5, color: 'var(--fg-strong)' }}>{title}</strong>
    </div>
  );
}

const btnPrimary = (color = '#4285F4'): React.CSSProperties => ({
  padding: '9px 14px', borderRadius: 9, border: 'none', background: color, color: '#fff',
  fontSize: 12.5, fontWeight: 800, cursor: 'pointer', minHeight: 40,
});
const cardBox: React.CSSProperties = {
  background: 'var(--surface-3)', border: '1px solid var(--border, rgba(0,0,0,0.08))',
  borderRadius: 10, padding: 12,
};

// ─────────── カレンダー ───────────
function CalendarSection() {
  const [connected, setConnected] = useState(isCalendarConnected);
  const [busy, setBusy] = useState(false);
  const [slots, setSlots] = useState<FreeSlot[] | null>(null);
  const [err, setErr] = useState('');
  const [picked, setPicked] = useState<FreeSlot | null>(null);
  const [title, setTitle] = useState('');
  const [dur, setDur] = useState(30);
  const [done, setDone] = useState('');

  const loadSlots = useCallback(async () => {
    setBusy(true); setErr('');
    try { setSlots(await getFreeSlots({ days: 5 })); }
    catch (e: any) { setErr(e?.message || '取得に失敗しました'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { if (connected) loadSlots(); }, [connected, loadSlots]);

  const connect = async () => {
    setBusy(true); setErr('');
    try { await connectCalendar(); setConnected(true); }
    catch (e: any) { setErr(e?.message || '連携に失敗しました'); }
    finally { setBusy(false); }
  };

  const insert = async () => {
    if (!picked || !title.trim()) return;
    setBusy(true); setErr(''); setDone('');
    try {
      const start = new Date(picked.startISO);
      const end = new Date(Math.min(new Date(picked.startISO).getTime() + dur * 60000, new Date(picked.endISO).getTime()));
      const r = await createEvent({ summary: title.trim(), startISO: start.toISOString(), endISO: end.toISOString() });
      setDone(`✓ 「${title.trim()}」を ${picked.label.split(' ')[0]} ${start.getHours()}:${String(start.getMinutes()).padStart(2, '0')} に登録しました`);
      setTitle(''); setPicked(null);
      void r; await loadSlots();
    } catch (e: any) { setErr(e?.message || '登録に失敗しました'); }
    finally { setBusy(false); }
  };

  return (
    <div style={cardBox}>
      <Sub brand="gcalendar" title="カレンダー — 隙間時間に会議を入れる" />
      {!connected ? (
        <>
          <p style={{ fontSize: 11.5, color: 'var(--fg-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
            連携すると、これからの予定の<b style={{ color: 'var(--fg-strong)' }}>空き時間</b>を自動で割り出し、その隙間に会議を入れられます。
          </p>
          <button onClick={connect} disabled={busy} style={btnPrimary()}>
            {busy ? '接続中…' : 'Google カレンダーと連携する'}
          </button>
        </>
      ) : (
        <>
          {busy && !slots && <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>空き時間を計算中…</div>}
          {slots && slots.length === 0 && <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>今後5日（平日 9〜19時）に30分以上の空きが見つかりませんでした。</div>}
          {slots && slots.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 6 }}>今後5日の空き時間（平日 9〜19時）</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {slots.slice(0, 12).map((s, i) => (
                  <button key={i} onClick={() => setPicked(s)} style={{
                    padding: '6px 9px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    border: `1px solid ${picked === s ? '#4285F4' : 'var(--border, rgba(0,0,0,0.1))'}`,
                    background: picked === s ? 'rgba(66,133,244,0.18)' : 'var(--surface)',
                    color: picked === s ? '#4285F4' : 'var(--fg)',
                  }}>{s.label} <span style={{ opacity: 0.6 }}>({s.minutes}分)</span></button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="会議名（例: 田中様と商談）"
                  style={{ flex: 1, minWidth: 160, padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border, rgba(0,0,0,0.12))', background: 'var(--surface)', color: 'var(--fg)', fontSize: 16 }} />
                <select value={dur} onChange={e => setDur(Number(e.target.value))}
                  style={{ padding: '9px 8px', borderRadius: 8, border: '1px solid var(--border, rgba(0,0,0,0.12))', background: 'var(--surface)', color: 'var(--fg)', fontSize: 13 }}>
                  <option value={30}>30分</option><option value={60}>60分</option><option value={90}>90分</option>
                </select>
                <button onClick={insert} disabled={busy || !picked || !title.trim()} style={{ ...btnPrimary('#34A853'), opacity: (!picked || !title.trim()) ? 0.5 : 1 }}>
                  {busy ? '登録中…' : 'この隙間に入れる'}
                </button>
              </div>
              {picked && <div style={{ fontSize: 10.5, color: 'var(--fg-muted)', marginTop: 6 }}>選択中: {picked.label}</div>}
            </>
          )}
          {done && <div style={{ fontSize: 11.5, color: '#34A853', fontWeight: 800, marginTop: 8 }}>{done}</div>}
          <button onClick={() => { disconnectCalendar(); setConnected(false); setSlots(null); }}
            style={{ marginTop: 10, fontSize: 10.5, color: 'var(--fg-subtle)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>連携を解除</button>
        </>
      )}
      {err && <div style={{ fontSize: 11, color: '#F87171', marginTop: 8, whiteSpace: 'pre-line', lineHeight: 1.5 }}>{err}</div>}
    </div>
  );
}

// ─────────── ドキュメント ───────────
function DocsSection({ onIngestKnowledge }: { onIngestKnowledge?: Ingest }) {
  const [connected, setConnected] = useState(isDocsConnected);
  const [busy, setBusy] = useState(false);
  const [docs, setDocs] = useState<DriveDoc[] | null>(null);
  const [err, setErr] = useState('');
  const [folderUrl, setFolderUrl] = useState('');
  const [ingested, setIngested] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState('');

  const load = useCallback(async (folderId?: string) => {
    setBusy(true); setErr('');
    try { setDocs(await listDocs({ folderId, max: 30 })); }
    catch (e: any) { setErr(e?.message || '一覧取得に失敗しました'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { if (connected) load(); }, [connected, load]);

  const connect = async () => {
    setBusy(true); setErr('');
    try { await connectDocs(); setConnected(true); }
    catch (e: any) { setErr(e?.message || '連携に失敗しました'); }
    finally { setBusy(false); }
  };

  const applyFolder = () => {
    const { type, id } = parseDriveId(folderUrl.trim());
    if (type === 'folder' && id) load(id);
    else { setErr('フォルダの共有URLを貼ってください（…/folders/xxxx）'); }
  };

  const ingest = async (d: DriveDoc) => {
    if (!onIngestKnowledge) return;
    setBusy(true); setErr(''); setNote('');
    try {
      const { title, text } = await readDocText(d.id);
      if (!text) { setErr(`「${d.name}」は本文が空でした`); return; }
      onIngestKnowledge(title || d.name, text);
      setIngested(p => ({ ...p, [d.id]: true }));
      setNote(`✓ 「${d.name}」を役員のナレッジに取り込みました（${text.length}文字）`);
    } catch (e: any) { setErr(e?.message || '取り込みに失敗しました'); }
    finally { setBusy(false); }
  };

  return (
    <div style={cardBox}>
      <Sub brand="gdocs" title="ドキュメント — 中身を役員のナレッジに" />
      {!connected ? (
        <>
          <p style={{ fontSize: 11.5, color: 'var(--fg-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
            連携すると、Google ドキュメントの<b style={{ color: 'var(--fg-strong)' }}>中身を読み込んで</b>、役員AIがそれを踏まえて提案・回答できるようになります。
          </p>
          <button onClick={connect} disabled={busy} style={btnPrimary()}>
            {busy ? '接続中…' : 'Google ドキュメントと連携する'}
          </button>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <input value={folderUrl} onChange={e => setFolderUrl(e.target.value)} placeholder="（任意）特定フォルダの共有URLで絞り込み"
              style={{ flex: 1, minWidth: 180, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border, rgba(0,0,0,0.12))', background: 'var(--surface)', color: 'var(--fg)', fontSize: 16 }} />
            <button onClick={applyFolder} style={btnPrimary('#5F6368')}>絞り込み</button>
          </div>
          {busy && !docs && <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>ドキュメント一覧を取得中…</div>}
          {docs && docs.length === 0 && <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>Google ドキュメントが見つかりませんでした。</div>}
          {docs && docs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
              {docs.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border, rgba(0,0,0,0.07))' }}>
                  <BrandIcon name="gdocs" size={20} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  <button onClick={() => ingest(d)} disabled={busy} style={{
                    flexShrink: 0, padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 800,
                    background: ingested[d.id] ? 'rgba(52,168,83,0.18)' : '#4285F4', color: ingested[d.id] ? '#34A853' : '#fff',
                  }}>{ingested[d.id] ? '✓ 取込済' : 'ナレッジに取り込む'}</button>
                </div>
              ))}
            </div>
          )}
          {note && <div style={{ fontSize: 11.5, color: '#34A853', fontWeight: 800, marginTop: 8 }}>{note}</div>}
          <button onClick={() => { disconnectDocs(); setConnected(false); setDocs(null); }}
            style={{ marginTop: 10, fontSize: 10.5, color: 'var(--fg-subtle)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>連携を解除</button>
        </>
      )}
      {err && <div style={{ fontSize: 11, color: '#F87171', marginTop: 8, whiteSpace: 'pre-line', lineHeight: 1.5 }}>{err}</div>}
    </div>
  );
}
