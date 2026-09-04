// ============================================================
// CORE Studio — お問い合わせ (/studio/contact) 2026-09-04 全面刷新
// 旧: 白い1段組に質問カード1枚。「答えたあと何が起きるか」がどこにも無かった。
// 新: 暗部のヒーロー (1営業日・無料・NDA・請求書払い) → 2段組
//     (左: 6問の見積ウィザード / 右: ご相談からの流れ + 直接の窓口) → 結果は見積書の体裁。
// ウィザードの判定 (estimate.ts)・保存 (estimateDraft.ts)・計測 (track) は旧版から
// そのまま移した。ここで変えたのは見た目と構成だけ。
// ============================================================
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { STUDIO, CONTACT, PROCESS } from './plans';
import { estimate, type EstimateAnswers, type Purpose, type Scale, type Feature, type Timeline, type Budget } from './estimate';
import { C, D, SANS } from './theme';
import { Band, H2, IconChat, IconCopy, IconArrow, IconMail, LineCta } from './ui';
import { PageStyle, PageHero } from './PageHero';
import { track } from './track';
import { ESTIMATE_KEY, EMPTY_DRAFT, parseSavedEstimate, type DraftOptions } from './estimateDraft';

type WizardStep = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 6 = 結果

const PURPOSES: Array<{ v: Purpose; label: string }> = [
  { v: 'lp', label: '集客LP (1ページ)' },
  { v: 'corporate', label: 'コーポレートサイト' },
  { v: 'ec', label: 'EC・オンライン販売' },
  { v: 'webapp', label: 'Webアプリ・業務システム' },
  { v: 'saas', label: 'SaaS・本格プロダクト' },
];
const SCALES: Array<{ v: Scale; label: string }> = [
  { v: 'small', label: '小規模 (〜5ページ/画面)' },
  { v: 'medium', label: '標準 (〜15ページ/画面)' },
  { v: 'large', label: '大規模 (それ以上)' },
];
const FEATURES: Array<{ v: Feature; label: string }> = [
  { v: 'booking', label: '予約' },
  { v: 'payment', label: '決済' },
  { v: 'auth', label: 'ログイン・会員' },
  { v: 'ai', label: 'AI機能' },
  { v: 'multilingual', label: '多言語' },
];
const TIMELINES: Array<{ v: Timeline; label: string }> = [
  { v: 'asap', label: '2週間以内 (特急)' },
  { v: 'normal', label: '1〜2ヶ月' },
  { v: 'flexible', label: '3ヶ月以上・柔軟' },
];
const BUDGETS: Array<{ v: Budget; label: string }> = [
  { v: 'u10', label: '〜10万円' },
  { v: 'u30', label: '〜30万円' },
  { v: 'u100', label: '〜100万円' },
  { v: 'u500', label: '〜500万円' },
  { v: 'over500', label: '500万円以上' },
  { v: 'unknown', label: '未定' },
];

const labelOf = <T extends string>(list: Array<{ v: T; label: string }>, v: T) => list.find(x => x.v === v)?.label ?? String(v);

/** 保存の読み戻しに渡す「実在する選択肢」の一覧 (画面の並びが唯一の出どころ) */
const DRAFT_OPTIONS: DraftOptions = {
  purposes: PURPOSES.map(x => x.v),
  scales: SCALES.map(x => x.v),
  features: FEATURES.map(x => x.v),
  timelines: TIMELINES.map(x => x.v),
  budgets: BUDGETS.map(x => x.v),
};

const FACTS = [
  { v: '1営業日', l: '以内にご返信' },
  { v: '無料', l: 'ご相談からお見積りまで' },
  { v: 'NDA', l: '締結に対応' },
  { v: '請求書払い', l: '対応' },
];

// ---- 右の列: ご相談からの流れ + 直接の窓口 ----
function SidePanel() {
  return (
    <aside className="sp-side">
      <div className="sp-side-card">
        <div className="st-label" style={{ color: D.gold }}>What happens next</div>
        <div className="st-serif" style={{ fontSize: 19, fontWeight: 700, color: '#fff', lineHeight: 1.6, marginTop: 10 }}>ご相談からの流れ</div>
        <ol className="sp-steps">
          {PROCESS.map(s => (
            <li key={s.no}><i>{s.no}</i><div><b>{s.title}</b><p>{s.body}</p></div></li>
          ))}
        </ol>
      </div>
      <div className="st-card" style={{ marginTop: 14 }}>
        <div className="st-label" style={{ fontSize: 10.5, marginBottom: 10 }}>Direct</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, lineHeight: 1.7 }}>質問に答えず、直接ご相談いただいても構いません。</div>
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          <LineCta where="contact-side" />
          <a className="st-btn st-btn-ghost" href={`mailto:${STUDIO.email}?subject=${encodeURIComponent('【CORE Studio】制作のご相談')}`}>
            <IconMail /> メールで相談する
          </a>
        </div>
        <p style={{ fontSize: 12, color: C.mute, margin: '12px 0 0', lineHeight: 1.85 }}>{CONTACT.lineNote} {CONTACT.lineChannelNote}</p>
      </div>
    </aside>
  );
}

export default function ContactPage() {
  // 保存があれば続きから開く (読めない・壊れている時は素の初期値)
  const restored = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try { return parseSavedEstimate(localStorage.getItem(ESTIMATE_KEY), DRAFT_OPTIONS); } catch { return null; }
  }, []);
  const init = restored ?? EMPTY_DRAFT;

  const [step, setStep] = useState<WizardStep>(init.step as WizardStep);
  const [purpose, setPurpose] = useState<Purpose | null>(init.purpose as Purpose | null);
  const [scale, setScale] = useState<Scale | null>(init.scale as Scale | null);
  const [cms, setCms] = useState<boolean | null>(init.cms);
  const [features, setFeatures] = useState<Feature[]>(init.features as Feature[]);
  const [timeline, setTimeline] = useState<Timeline | null>(init.timeline as Timeline | null);
  const [budget, setBudget] = useState<Budget | null>(init.budget as Budget | null);
  const [copied, setCopied] = useState(false);
  const [resumed, setResumed] = useState(restored !== null);

  const answers: EstimateAnswers | null = useMemo(() => {
    if (!purpose || !scale || cms === null || !timeline || !budget) return null;
    return { purpose, scale, cms, features, timeline, budget };
  }, [purpose, scale, cms, features, timeline, budget]);

  const result = useMemo(() => (answers ? estimate(answers) : null), [answers]);

  // 途中の答えを手元に残す。1問目のまま (step 0) は残さない
  // ——「開いただけ」を復帰対象にすると、次に来た時に何も変わらないのに
  // 「続きから」と名乗ることになる。
  useEffect(() => {
    try {
      if (step === 0) localStorage.removeItem(ESTIMATE_KEY);
      else localStorage.setItem(ESTIMATE_KEY, JSON.stringify({ step, purpose, scale, cms, features, timeline, budget }));
    } catch { /* 保存できない設定でも入力は続けられる */ }
  }, [step, purpose, scale, cms, features, timeline, budget]);

  // 何問目まで来て帰ったかを CORE 側に残す。戻るボタンで下がった時は数えない
  // (同じ人が行ったり来たりするたびに「到達者」が増えると、離脱地点が読めなくなる)。
  // 続きから開いた回は、その step を新規到達として数えない (reachedRef の初期値がそれ)。
  const reachedRef = useRef<number>(init.step);
  useEffect(() => {
    if (step <= reachedRef.current) return;
    if (reachedRef.current === 0 && step === 1) track('studio_estimate_start');
    reachedRef.current = step;
    track('studio_estimate_step', { step });
  }, [step]);

  useEffect(() => {
    if (restored) track('studio_estimate_resume', { step: restored.step });
    // 復帰は「この画面を開いた回」に 1 度だけ数える
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 結果が出たことは 1 回だけ数える (プラン別)
  const doneRef = useRef(false);
  useEffect(() => {
    if (step === 6 && result && !doneRef.current) {
      doneRef.current = true;
      track('studio_estimate_done', { plan: result.plan });
    }
  }, [step, result]);

  const resetAll = () => {
    setStep(0); setPurpose(null); setScale(null); setCms(null);
    setFeatures([]); setTimeline(null); setBudget(null);
    setResumed(false);
    reachedRef.current = 0;
    doneRef.current = false;
    try { localStorage.removeItem(ESTIMATE_KEY); } catch { /* */ }
  };

  const summaryText = useMemo(() => {
    if (!answers || !result) return '';
    return [
      '【CORE Studio お見積りのご相談】',
      `・目的: ${labelOf(PURPOSES, answers.purpose)}`,
      `・規模: ${labelOf(SCALES, answers.scale)}`,
      `・CMS (自社更新): ${answers.cms ? '必要' : '不要'}`,
      `・機能: ${answers.features.length ? answers.features.map(f => labelOf(FEATURES, f)).join(' / ') : 'なし'}`,
      `・希望納期: ${labelOf(TIMELINES, answers.timeline)}`,
      `・予算感: ${labelOf(BUDGETS, answers.budget)}`,
      '',
      `【概算結果】${result.plan} プラン / ¥${result.minPrice}万〜¥${result.maxPrice}万`,
    ].join('\n');
  }, [answers, result]);

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // clipboard 不許可環境では選択用に prompt
      window.prompt('以下をコピーしてLINEに貼り付けてください', summaryText.replace(/\n/g, ' '));
    }
  };

  // LINEを開く前に概算結果をコピーしておく。貼るだけで相談が始まる状態にする。
  const openLine = () => {
    track('studio_line_cta', { where: 'estimate-result' });
    void copySummary();
  };

  const stepDefs: Array<{ title: string; body: ReactNode }> = [
    {
      title: '制作したいものをお選びください',
      body: <Choices items={PURPOSES} value={purpose} onPick={v => { setPurpose(v); setStep(1); }} />,
    },
    {
      title: '想定される規模をお選びください',
      body: <Choices items={SCALES} value={scale} onPick={v => { setScale(v); setStep(2); }} />,
    },
    {
      title: '貴社での更新機能 (CMS) は必要ですか',
      body: (
        <Choices
          items={[{ v: 'yes', label: '必要 — お知らせ等を自社で更新したい' }, { v: 'no', label: '不要 — 更新は依頼したい' }]}
          value={cms === null ? null : cms ? 'yes' : 'no'}
          onPick={v => { setCms(v === 'yes'); setStep(3); }}
        />
      ),
    },
    {
      title: '必要な機能をお選びください (複数可・なければそのまま次へ)',
      body: (
        <div>
          <div className="sp-opts" data-cols="2">
            {FEATURES.map((f, i) => (
              <button key={f.v} type="button" className="sp-opt" data-on={features.includes(f.v)} aria-pressed={features.includes(f.v)}
                onClick={() => setFeatures(prev => prev.includes(f.v) ? prev.filter(x => x !== f.v) : [...prev, f.v])}>
                <span className="sp-opt-no">{String(i + 1).padStart(2, '0')}</span>
                {f.label}
                <span className="sp-opt-arrow" aria-hidden>{features.includes(f.v) ? '✓' : ''}</span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 18 }}>
            <button className="st-btn st-btn-primary" onClick={() => setStep(4)}>次へ <IconArrow /></button>
          </div>
        </div>
      ),
    },
    {
      title: 'ご希望の納期をお選びください',
      body: <Choices items={TIMELINES} value={timeline} onPick={v => { setTimeline(v); setStep(5); }} />,
    },
    {
      title: 'ご予算の目安をお選びください',
      body: <Choices items={BUDGETS} value={budget} onPick={v => { setBudget(v); setStep(6); }} />,
    },
  ];

  const hero = (
    <PageHero
      en="Contact"
      title={<>6つの質問で、<br />概算をその場で。</>}
      lead="制作したいもの・規模・機能・納期・予算をお選びいただくと、最適なプランと概算の金額をその場でご確認いただけます。正式なお見積りはヒアリングのうえで確定し、ご契約後の追加費用はありません。"
      facts={FACTS}
      note={CONTACT.lineNote}
    />
  );

  if (step === 6 && result) {
    const rows = answers ? [
      { k: '目的', v: labelOf(PURPOSES, answers.purpose) },
      { k: '規模', v: labelOf(SCALES, answers.scale) },
      { k: 'CMS (自社更新)', v: answers.cms ? '必要' : '不要' },
      { k: '機能', v: answers.features.length ? answers.features.map(f => labelOf(FEATURES, f)).join(' / ') : 'なし' },
      { k: '希望納期', v: labelOf(TIMELINES, answers.timeline) },
      { k: '予算感', v: labelOf(BUDGETS, answers.budget) },
    ] : [];
    return (
      <div>
        <PageStyle />
        {hero}
        <Band wide pad="clamp(44px, 5vw, 72px) 0">
          <div className="sp-contact">
            <div>
              <H2 en="Estimate" sub="ご回答をもとに算出した概算です。正式なお見積りはヒアリングの上で確定し、ご契約後の追加費用は発生しません。">概算お見積り</H2>
              <div className="sp-quote-doc">
                <div className="sp-quote-head">
                  <div>
                    <div className="st-label" style={{ color: D.gold, fontSize: 10.5 }}>ご提案プラン</div>
                    <div className="st-serif" style={{ fontSize: 'clamp(26px, 3.4vw, 34px)', fontWeight: 700, letterSpacing: '0.06em', color: '#fff', lineHeight: 1.3, marginTop: 6 }}>{result.plan}</div>
                    <div style={{ fontSize: 12.5, color: D.mute, marginTop: 2 }}>{result.kind === 'dev' ? '受託開発' : 'サイト制作'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="st-label" style={{ color: D.gold, fontSize: 10.5 }}>概算</div>
                    <div className="sp-quote-price">¥{result.minPrice}万<span style={{ fontSize: '0.5em', color: D.mute, fontWeight: 400, margin: '0 6px' }}>〜</span>¥{result.maxPrice}万</div>
                  </div>
                </div>
                <div className="sp-quote-body">
                  <p className="sp-best" style={{ margin: 0 }}>{result.note}</p>
                  <div className="sp-col-sub" style={{ margin: '20px 0 4px' }}>ご回答の内容</div>
                  <dl className="sp-quote-dl">
                    {rows.map(r => <div key={r.k}><dt>{r.k}</dt><dd>{r.v}</dd></div>)}
                  </dl>
                  <div style={{ display: 'grid', gap: 10, marginTop: 22 }}>
                    <a className="st-btn st-btn-line" href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer"
                      style={{ width: '100%', boxSizing: 'border-box' }} onClick={openLine}>
                      <IconChat /> この内容でLINE相談する
                    </a>
                    <button className="st-btn st-btn-ghost" onClick={copySummary} style={{ width: '100%', boxSizing: 'border-box' }}>
                      <IconCopy /> {copied ? 'コピーしました' : '内容をコピーする'}
                    </button>
                  </div>
                  <p style={{ fontSize: 12, color: C.mute, lineHeight: 1.9, margin: '14px 0 0', textAlign: 'center' }}>
                    LINEを開くと同時に、この内容をコピーします。トークに貼り付けて送信してください。<br />
                    LINEをお使いでない場合は <a href={`mailto:${STUDIO.email}?subject=${encodeURIComponent('【CORE Studio】制作のご相談')}`} style={{ color: C.ink }}>{STUDIO.email}</a> でも承ります。
                  </p>
                  <div style={{ textAlign: 'center', marginTop: 6 }}>
                    <button onClick={resetAll}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: C.mute, textDecoration: 'underline', minHeight: 44, fontFamily: SANS }}>
                      最初からやり直す
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <SidePanel />
          </div>
        </Band>
      </div>
    );
  }

  const def = stepDefs[step];
  return (
    <div>
      <PageStyle />
      {hero}
      <Band wide pad="clamp(44px, 5vw, 72px) 0">
        <div className="sp-contact">
          <div>
            {/* 続きから開いたことを黙って隠さない。前の答えのまま進むか、やり直すかを選べるようにする */}
            {resumed && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
                background: C.alt, borderLeft: `3px solid ${C.gold}`, borderRadius: 4, padding: '10px 14px', marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: C.body, lineHeight: 1.8 }}>前回の続きから表示しています。</span>
                <button onClick={resetAll}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: C.ink, fontWeight: 600, textDecoration: 'underline', minHeight: 44, padding: 0, fontFamily: SANS }}>
                  最初からやり直す
                </button>
              </div>
            )}
            <div className="sp-wiz">
              <div className="sp-progress" aria-hidden>
                {stepDefs.map((_, i) => <i key={i} data-on={i <= step} />)}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span className="st-serif" style={{ fontSize: 26, fontWeight: 700, color: C.goldText, lineHeight: 1 }}>{String(step + 1).padStart(2, '0')}</span>
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: C.mute }}>/ {String(stepDefs.length).padStart(2, '0')}</span>
              </div>
              <div className="sp-wiz-q">{def.title}</div>
              {def.body}
              {step > 0 && (
                <button onClick={() => setStep((step - 1) as WizardStep)}
                  style={{ marginTop: 18, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: C.mute, textDecoration: 'underline', minHeight: 44, padding: 0, fontFamily: SANS }}>
                  ひとつ戻る
                </button>
              )}
            </div>
          </div>
          <SidePanel />
        </div>
      </Band>
    </div>
  );
}

function Choices<T extends string>({ items, value, onPick }: {
  items: Array<{ v: T; label: string }>;
  value: T | null;
  onPick: (v: T) => void;
}) {
  return (
    <div className="sp-opts">
      {items.map((it, i) => (
        <button key={it.v} type="button" className="sp-opt" data-on={value === it.v} onClick={() => onPick(it.v)}>
          <span className="sp-opt-no">{String(i + 1).padStart(2, '0')}</span>
          {it.label}
          <span className="sp-opt-arrow"><IconArrow /></span>
        </button>
      ))}
    </div>
  );
}
