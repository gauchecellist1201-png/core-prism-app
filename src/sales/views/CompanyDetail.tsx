// ============================================================
// 企業カード — 1社の全部。ここだけ見れば次の一手が打てる。
// スマホ: 電話 / メール / サイト / SNS はワンタップ。
// ============================================================
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { RADIUS, T, shortDate, yen } from '../theme';
import { Btn, Card, Chip, CopyBtn, ErrorNote, Field, Label, Muted, ScoreBar, Sheet, Spinner } from '../ui';
import {
  analyze, fetchCompany, generate, generatePlan, logActivity, newRequestId,
  patchCompany, removeCompany, type SalesConfig,
} from '../api';
import type { Activity, ActivityKind, Company, PlanKind, VideoPlan } from '../shared/types';
import { scoreBand } from '../shared/score';
import { productById, stageMeta, targetByTier } from '../shared/catalog';

const ACTIVITY_BUTTONS: Array<{ kind: ActivityKind; label: string; color: string }> = [
  { kind: 'call', label: '電話した', color: T.green },
  { kind: 'call_no_answer', label: '不在', color: T.mute },
  { kind: 'email', label: 'メール送った', color: T.blue },
  { kind: 'reply', label: '返信きた', color: T.purple },
  { kind: 'meeting', label: '商談した', color: T.amber },
  { kind: 'proposal', label: '提案した', color: T.amber },
  { kind: 'trial', label: '初回受注', color: T.green },
  { kind: 'won', label: '受注', color: T.green },
  { kind: 'monthly', label: '月額契約', color: T.green },
  { kind: 'oem', label: 'OEM契約', color: T.gold },
  { kind: 'lost', label: '失注', color: T.red },
  { kind: 'note', label: 'メモだけ', color: T.mute },
];

const NEEDS_AMOUNT: ActivityKind[] = ['proposal', 'trial', 'won', 'monthly', 'oem'];

export default function CompanyDetail(props: {
  id: string; cfg: SalesConfig; onBack: () => void; onChanged: () => void; onDeleted: () => void;
}) {
  const { id, cfg, onBack, onChanged, onDeleted } = props;
  const [c, setC] = useState<Company | null>(null);
  const [acts, setActs] = useState<Activity[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [siteNote, setSiteNote] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [logOpen, setLogOpen] = useState<ActivityKind | null>(null);

  const load = useCallback(() => {
    setErr('');
    fetchCompany(id)
      .then(r => { setC(r.company); setActs(r.activities); })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const run = async (label: string, fn: () => Promise<Company>) => {
    setBusy(label); setErr('');
    try {
      const co = await fn();
      setC(co);
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(''); }
  };

  if (err && !c) return <div><Btn small variant="quiet" onClick={onBack}>← 戻る</Btn><div style={{ height: 10 }} /><ErrorNote onRetry={load}>{err}</ErrorNote></div>;
  if (!c) return <Spinner />;

  const band = scoreBand(c.score?.total ?? 0);
  const st = stageMeta(c.stage);
  const tier = targetByTier(c.targetTier);
  const a = c.analysis;
  const plan = productById(a?.recommendedPlan || 'entry');

  const mailtoHref = (() => {
    if (!c.email || !c.email1) return '';
    const q = `subject=${encodeURIComponent(c.email1.subject)}&body=${encodeURIComponent(c.email1.body)}`;
    return `mailto:${encodeURIComponent(c.email)}?${q}`;
  })();

  return (
    <div>
      <Btn small variant="quiet" onClick={onBack}>← 一覧へ戻る</Btn>

      {/* ---- 見出し ---- */}
      <Card style={{ marginTop: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 13, flexShrink: 0,
            background: `${band.color}18`, border: `1px solid ${band.color}55`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 19, fontWeight: 900, color: band.color, lineHeight: 1 }}>{c.score?.total ?? 0}</div>
            <div style={{ fontSize: 8.5, color: band.color, fontWeight: 700 }}>SCORE</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 18, fontWeight: 900, margin: 0, lineHeight: 1.35, wordBreak: 'break-word' }}>
              {c.name || '(社名未設定)'}
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
              <Chip color={st.color} active>{st.label}</Chip>
              {c.targetTier !== 'X' && <Chip color={tier.color} active>TARGET {c.targetTier}</Chip>}
              {c.industry && <Chip>{c.industry}</Chip>}
              <Chip>接触 {c.touches} 回</Chip>
            </div>
            <div style={{ fontSize: 11.5, color: T.mute, marginTop: 8, lineHeight: 1.7 }}>
              次にやること: <span style={{ color: T.ink, fontWeight: 700 }}>{c.nextActionLabel || st.nextHint}</span>
              {c.nextActionAt ? `（${shortDate(c.nextActionAt)}）` : ''}
            </div>
          </div>
        </div>

        {/* ワンタップ */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <Btn small href={c.phone ? `tel:${c.phone.replace(/[^\d+]/g, '')}` : undefined} disabled={!c.phone} variant="primary">
            電話する
          </Btn>
          <Btn small href={mailtoHref || undefined} disabled={!mailtoHref} title={!c.email ? 'メールアドレス未登録' : !c.email1 ? 'メール文が未作成' : ''}>
            メールを開く
          </Btn>
          <Btn small href={c.url || undefined} disabled={!c.url} newTab>サイト</Btn>
          <Btn small href={c.sns || undefined} disabled={!c.sns} newTab>SNS</Btn>
          <Btn small variant="quiet" onClick={() => setEditOpen(true)}>編集</Btn>
        </div>
      </Card>

      {err ? <div style={{ marginBottom: 12 }}><ErrorNote onRetry={load}>{err}</ErrorNote></div> : null}
      {busy ? <div style={{ marginBottom: 12 }}><Spinner label={busy} /></div> : null}

      {/* ---- 作る ---- */}
      <div style={{ margin: '4px 2px 8px' }}><Label>作る</Label></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 6 }}>
        <Btn full disabled={!!busy || !c.url} variant={a ? 'ghost' : 'primary'}
          onClick={() => run('サイトを読んで分析しています…', async () => {
            const r = await analyze({ id: c.id });
            setSiteNote(r.site.ok ? '' : r.site.note);
            return r.company;
          })}>
          {a ? '分析をやり直す' : '企業分析をかける'}
        </Btn>
        <Btn full disabled={!!busy || !a} variant={a && !c.plans ? 'primary' : 'ghost'}
          onClick={() => run('動画企画をつくっています… (A/3)', async () => {
            // 1案ずつ作って、できたそばから画面に出す。
            // 3案を1回のリクエストで書かせると Edge の 25 秒に収まらない。
            const kinds: PlanKind[] = ['A', 'B', 'C'];
            let latest = c;
            for (let i = 0; i < kinds.length; i++) {
              setBusy(`動画企画をつくっています… (${kinds[i]}/3)`);
              latest = (await generatePlan(c.id, kinds[i])).company;
              setC(latest);
            }
            return latest;
          })}>
          {c.plans ? '企画を作り直す' : '動画企画3案'}
        </Btn>
        <Btn full disabled={!!busy || !a}
          onClick={() => run('メールを書いています…', async () => (await generate(c.id, 'email')).company)}>
          {c.email1 ? `メールを書き直す (${c.touches + 1}回目)` : '営業メールを書く'}
        </Btn>
        <Btn full disabled={!!busy || !a}
          onClick={() => run('電話トークを作っています…', async () => (await generate(c.id, 'call')).company)}>
          {c.call ? 'トークを作り直す' : '電話トークを作る'}
        </Btn>
      </div>
      {!c.url && <Muted>URLが未登録なので分析できません。編集からURLを入れてください。</Muted>}
      {siteNote && <div style={{ marginTop: 8 }}><Muted>サイト取得の注意: {siteNote}</Muted></div>}

      {/* ---- 電話トーク ---- */}
      {c.call && (
        <Section title="電話トーク (30秒)">
          <div style={{ display: 'grid', gap: 8 }}>
            <Line n="1" label="名乗り・理由" text={c.call.opening} />
            <Line n="2" label="質問" text={c.call.question} />
            <Line n="3" label="つなぎ" text={c.call.bridge} />
            <Line n="4" label="この会社なら" text={c.call.hook} />
            <Line n="5" label="クロージング" text={c.call.close} />
          </div>
          {c.call.objections.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Label>断られたら</Label>
              <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
                {c.call.objections.map((o, i) => (
                  <div key={i} style={{ fontSize: 12.5, lineHeight: 1.8 }}>
                    <span style={{ color: T.mute }}>「{o.q}」</span>
                    <span style={{ color: T.ink }}> → {o.a}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <CopyBtn label="トークをコピー" text={[c.call.opening, c.call.question, c.call.bridge, c.call.hook, c.call.close].filter(Boolean).join('\n')} />
            {c.phone && <Btn small variant="primary" href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}>この番号にかける</Btn>}
          </div>
        </Section>
      )}

      {/* ---- メール ---- */}
      {c.email1 && (
        <Section title={`営業メール (${c.email1.touch}回目・${c.email1.angle})`}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 8 }}>{c.email1.subject}</div>
          <div style={{
            whiteSpace: 'pre-wrap', fontSize: 13, color: T.body, lineHeight: 1.95,
            background: T.raise2, border: `1px solid ${T.line}`, borderRadius: RADIUS.md, padding: 12,
          }}>{c.email1.body}</div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <CopyBtn label="本文をコピー" text={c.email1.body} />
            <CopyBtn label="件名をコピー" text={c.email1.subject} />
            {mailtoHref && <Btn small variant="primary" href={mailtoHref}>メールアプリで開く</Btn>}
          </div>
          {!c.email && <div style={{ marginTop: 8 }}><Muted>送り先メールアドレスが未登録です。編集から入れるとワンタップで開けます。</Muted></div>}
          {!cfg.mayQuotePrice && <div style={{ marginTop: 8 }}><Muted>金額が公開ページと食い違っているため、この文面には金額を入れていません。</Muted></div>}
        </Section>
      )}

      {/* ---- 企画 ---- */}
      {c.plans && c.plans.length > 0 && (
        <Section title="AI動画 企画3案">
          <div style={{ display: 'grid', gap: 10 }}>
            {c.plans.map(p => <PlanCard key={p.kind} p={p} />)}
          </div>
          <div style={{ marginTop: 10 }}>
            <CopyBtn full label="3案まとめてコピー" text={c.plans.map(planToText).join('\n\n──────────\n\n')} />
          </div>
        </Section>
      )}

      {/* ---- 分析 ---- */}
      {a && (
        <Section title="企業分析">
          {a.warnings.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <ErrorNote>{a.warnings.join(' / ')}</ErrorNote>
            </div>
          )}
          <KV k="会社概要" v={a.summary} />
          <KV k="事業内容" v={a.business} />
          <KV k="主要商品" v={a.products.join('、')} />
          <KV k="顧客層" v={a.customers} />
          <FactRow k="SNS" f={a.sns} />
          <FactRow k="動画活用" f={a.videoUsage} />
          <FactRow k="広告" f={a.ads} />
          <FactRow k="求人" f={a.hiring} />
          <KV k="競合" v={a.competitors.join('、')} />
          <KV k="AI動画との相性" v={a.aiVideoFit} />
          <KV k="想定課題" v={a.painHypothesis.map(x => `・${x}`).join('\n')} />
          <KV k="営業の切り口" v={a.angle} highlight />
          <KV k="推奨商品" v={plan ? `${plan.name} (${plan.tagline}) ${plan.price}` : a.recommendedPlan} highlight />
          <KV k="想定予算" v={a.budgetGuess} />
        </Section>
      )}

      {/* ---- スコア内訳 ---- */}
      {c.score && (
        <Section title={`CORE SALES SCORE ${c.score.total} / 100`}>
          <div style={{ display: 'grid', gap: 10 }}>
            {c.score.items.map(it => (
              <div key={it.key}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 12.5, color: T.body, flex: 1 }}>{it.label}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: it.unknown ? T.faint : T.ink }}>
                    {it.unknown ? '未確認' : `${it.value} / ${it.max}`}
                  </div>
                </div>
                <ScoreBar value={it.value} max={it.max} color={it.unknown ? T.line : band.color} />
                {it.evidence ? (
                  <div style={{ fontSize: 11, color: T.faint, marginTop: 4, lineHeight: 1.7 }}>{it.evidence}</div>
                ) : (
                  <div style={{ fontSize: 11, color: T.faint, marginTop: 4 }}>根拠が取れなかったので0点にしています。</div>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <Muted>根拠が取れた項目 {Math.round(c.score.confidence * 6)} / 6。少ないほど、この点数はまだ当てになりません。</Muted>
          </div>
        </Section>
      )}

      {/* ---- 結果を入れる ---- */}
      <Section title="結果を入れる">
        <Muted>
          {busy ? 'いま作成中です。終わってから入れてください。' : '入れた瞬間に、次にやる日と内容が決まります。'}
        </Muted>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
          {ACTIVITY_BUTTONS.map(b => (
            <Chip key={b.kind} color={b.color} active onClick={() => { if (!busy) setLogOpen(b.kind); }}>
              {b.label}
            </Chip>
          ))}
        </div>
        {/* 単発の累計と月額は単位が違うので、必ず別の行に出す */}
        {c.oneOffYen > 0 && (
          <div style={{ marginTop: 10 }}>
            <Muted>単発の受注 {yen(c.oneOffYen)}（{c.oneOffCount}本）</Muted>
          </div>
        )}
        {c.mrrYen > 0 && (
          <div style={{ marginTop: 4 }}><Muted>月額 {yen(c.mrrYen)}／月</Muted></div>
        )}
        {c.oneOffYen === 0 && c.mrrYen === 0 && c.dealYen > 0 && (
          <div style={{ marginTop: 10 }}><Muted>見込金額 {yen(c.dealYen)}</Muted></div>
        )}
        {c.lostReason && <div style={{ marginTop: 6 }}><Muted>失注理由: {c.lostReason}</Muted></div>}
      </Section>

      {/* ---- 履歴 ---- */}
      {acts.length > 0 && (
        <Section title="履歴">
          <div style={{ display: 'grid', gap: 7 }}>
            {acts.map(x => (
              <div key={x.id} style={{ display: 'flex', gap: 8, fontSize: 12, color: T.mute, lineHeight: 1.7 }}>
                <span style={{ color: T.faint, flexShrink: 0 }}>{shortDate(x.at)}</span>
                <span style={{ color: T.body, fontWeight: 700, flexShrink: 0 }}>
                  {ACTIVITY_BUTTONS.find(b => b.kind === x.kind)?.label || x.kind}
                </span>
                <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{x.note}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div style={{ marginTop: 18 }}>
        <Btn variant="danger" small onClick={async () => {
          if (!window.confirm(`${c.name || 'この営業先'} を削除します。よろしいですか？`)) return;
          try { await removeCompany(c.id); onDeleted(); }
          catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
        }}>この営業先を削除</Btn>
      </div>

      <EditSheet
        open={editOpen} company={c}
        onClose={() => setEditOpen(false)}
        onSaved={(co) => { setC(co); setEditOpen(false); onChanged(); }}
      />

      <LogSheet
        kind={logOpen} company={c}
        onClose={() => setLogOpen(null)}
        onSaved={(co) => { setLogOpen(null); setC(co); onChanged(); load(); }}
      />
    </div>
  );
}

// ---- 部品 ----------------------------------------------------------------
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ margin: '0 2px 8px' }}><Label>{title}</Label></div>
      <Card>{children}</Card>
    </div>
  );
}

function KV({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  if (!v) return null;
  return (
    <div style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: `1px solid ${T.lineSoft}` }}>
      <div style={{ width: 96, flexShrink: 0, fontSize: 11.5, color: T.mute, fontWeight: 700, paddingTop: 2 }}>{k}</div>
      <div style={{
        flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.85, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        color: highlight ? T.gold : T.body, fontWeight: highlight ? 700 : 400,
      }}>{v}</div>
    </div>
  );
}

function FactRow({ k, f }: { k: string; f: { value: string; evidence: string } }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: `1px solid ${T.lineSoft}` }}>
      <div style={{ width: 96, flexShrink: 0, fontSize: 11.5, color: T.mute, fontWeight: 700, paddingTop: 2 }}>{k}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {f.value ? (
          <>
            <div style={{ fontSize: 12.5, color: T.body, lineHeight: 1.85, wordBreak: 'break-word' }}>{f.value}</div>
            <div style={{ fontSize: 11, color: T.faint, marginTop: 2, lineHeight: 1.7 }}>根拠: {f.evidence}</div>
          </>
        ) : (
          <div style={{ fontSize: 12.5, color: T.faint }}>未確認</div>
        )}
      </div>
    </div>
  );
}

function Line({ n, label, text }: { n: string; label: string; text: string }) {
  if (!text) return null;
  return (
    <div style={{ display: 'flex', gap: 9 }}>
      <div style={{
        width: 20, height: 20, borderRadius: 6, background: T.raise2, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 800, color: T.gold,
      }}>{n}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10.5, color: T.faint, fontWeight: 700, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.85, wordBreak: 'break-word' }}>{text}</div>
      </div>
    </div>
  );
}

function planToText(p: VideoPlan): string {
  return [
    `【PLAN ${p.kind}】${p.title} (${p.purpose})`,
    `冒頭3秒: ${p.hook3s}`,
    ...p.beats.map(b => `${b.time} ${b.shot}${b.audio ? ` / 音: ${b.audio}` : ''}`),
    p.story ? `ストーリー: ${p.story}` : '',
    p.visual ? `映像イメージ: ${p.visual}` : '',
    p.narration ? `ナレーション: ${p.narration}` : '',
    p.cta ? `CTA: ${p.cta}` : '',
  ].filter(Boolean).join('\n');
}

function PlanCard({ p }: { p: VideoPlan }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: T.raise2, border: `1px solid ${T.line}`, borderRadius: RADIUS.md, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 6, background: T.goldSoft, color: T.gold,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0,
        }}>{p.kind}</div>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink, flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{p.title}</div>
        <span style={{ fontSize: 10.5, color: T.mute, whiteSpace: 'nowrap' }}>{p.purpose}</span>
      </div>
      <div style={{ fontSize: 12.5, color: T.body, lineHeight: 1.85, marginTop: 8 }}>
        <span style={{ color: T.gold, fontWeight: 700 }}>冒頭3秒 </span>{p.hook3s}
      </div>
      {open && (
        <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
          {p.beats.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, lineHeight: 1.8 }}>
              <span style={{ color: T.gold, fontWeight: 700, flexShrink: 0, minWidth: 44 }}>{b.time}</span>
              <span style={{ color: T.body, minWidth: 0, wordBreak: 'break-word' }}>
                {b.shot}{b.audio ? <span style={{ color: T.mute }}>{` / 音: ${b.audio}`}</span> : null}
              </span>
            </div>
          ))}
          {p.story && <Muted>ストーリー: {p.story}</Muted>}
          {p.visual && <Muted>映像イメージ: {p.visual}</Muted>}
          {p.narration && <Muted>ナレーション: {p.narration}</Muted>}
          {p.cta && <Muted>CTA: {p.cta}</Muted>}
        </div>
      )}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <Btn small variant="quiet" onClick={() => setOpen(v => !v)}>{open ? '閉じる' : '構成を見る'}</Btn>
        <CopyBtn label="この案をコピー" text={planToText(p)} />
      </div>
    </div>
  );
}

// ---- 編集 ----------------------------------------------------------------
function EditSheet({ open, company, onClose, onSaved }: {
  open: boolean; company: Company; onClose: () => void; onSaved: (c: Company) => void;
}) {
  const [f, setF] = useState(() => ({
    name: company.name, url: company.url, phone: company.phone, email: company.email,
    sns: company.sns, contactName: company.contactName, industry: company.industry, memo: company.memo,
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setF({
      name: company.name, url: company.url, phone: company.phone, email: company.email,
      sns: company.sns, contactName: company.contactName, industry: company.industry, memo: company.memo,
    });
    setErr('');
  }, [open, company]);

  const set = (k: keyof typeof f) => (v: string) => setF(prev => ({ ...prev, [k]: v }));

  return (
    <Sheet open={open} title="営業先を編集" onClose={onClose}>
      <Field label="社名" value={f.name} onChange={set('name')} />
      <Field label="URL" value={f.url} onChange={set('url')} inputMode="url" />
      <Field label="業種" value={f.industry} onChange={set('industry')} placeholder="美容クリニック / 広告代理店 など" />
      <Field label="担当者" value={f.contactName} onChange={set('contactName')} />
      <Field label="電話" value={f.phone} onChange={set('phone')} inputMode="tel" />
      <Field label="メール" value={f.email} onChange={set('email')} inputMode="email" />
      <Field label="SNS (URL)" value={f.sns} onChange={set('sns')} inputMode="url" />
      <Field label="メモ" value={f.memo} onChange={set('memo')} rows={4} hint="ここに書いたことは分析・メールの材料になります。" />
      {err ? <div style={{ marginBottom: 12 }}><ErrorNote>{err}</ErrorNote></div> : null}
      <Btn variant="primary" full disabled={busy} onClick={async () => {
        setBusy(true); setErr('');
        try { onSaved((await patchCompany(company.id, f)).company); }
        catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
        finally { setBusy(false); }
      }}>{busy ? '保存しています…' : '保存する'}</Btn>
    </Sheet>
  );
}

// ---- 結果入力 ------------------------------------------------------------
function LogSheet({ kind, company, onClose, onSaved }: {
  kind: ActivityKind | null; company: Company; onClose: () => void; onSaved: (c: Company) => void;
}) {
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // 二重記録を防ぐ札。開いている間は同じものを使い、押し直しても1回しか適用されない。
  const reqId = useRef(newRequestId());

  useEffect(() => {
    if (!kind) return;
    setNote(''); setAmount(''); setErr('');
    reqId.current = newRequestId();
  }, [kind]);

  if (!kind) return null;
  const def = ACTIVITY_BUTTONS.find(b => b.kind === kind);
  const needsAmount = NEEDS_AMOUNT.includes(kind);
  const isLost = kind === 'lost';

  return (
    <Sheet open title={`${def?.label ?? ''} を記録`} onClose={onClose}>
      <Muted>{company.name}</Muted>
      <div style={{ height: 12 }} />
      <Field
        label={isLost ? '失注の理由' : 'メモ (任意)'} value={note} onChange={setNote} rows={3}
        placeholder={isLost ? '例: 社内に編集者がいる / 予算が来期 / 反応なし' : '相手が言ったことをそのまま書くと、次の文面に効きます'}
      />
      {needsAmount && (
        <Field
          label={kind === 'monthly' || kind === 'oem' ? '月額 (円)' : '金額 (円)'} value={amount} onChange={setAmount}
          inputMode="numeric" placeholder="148000"
          hint="入れておくと、見込・確定・平均単価の数字に反映されます。"
        />
      )}
      {err ? <div style={{ marginBottom: 12 }}><ErrorNote>{err}</ErrorNote></div> : null}
      <Btn variant="primary" full disabled={busy} onClick={async () => {
        setBusy(true); setErr('');
        try {
          const dealYen = Number(amount.replace(/[^\d]/g, ''));
          const r = await logActivity({
            id: company.id, kind, note, requestId: reqId.current,
            ...(Number.isFinite(dealYen) && dealYen > 0 ? { dealYen } : {}),
            ...(isLost ? { lostReason: note } : {}),
          });
          onSaved(r.company);
        } catch (e) {
          setErr(e instanceof Error ? e.message : String(e));
        } finally { setBusy(false); }
      }}>{busy ? '記録しています…' : '記録する'}</Btn>
    </Sheet>
  );
}
