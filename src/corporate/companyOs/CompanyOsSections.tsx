import { useState, type FormEvent, type ReactNode } from 'react';
import { COMPANY_OS_COPY, COMPANY_OS_OUTCOMES, COMPANY_OS_PACKAGES } from './catalog';
import { estimateCompanyOs, type PriceScope } from './pricing';
import { rememberSource, track } from '../roai/track';
import './companyOs.css';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section id={id} className="company-os-section"><div className="ch-wrap"><h2>{title}</h2>{children}</div></section>;
}
export function CompanyOsIntro() {
  const [variant] = useState<'a'|'b'>(() => typeof location !== 'undefined' && new URLSearchParams(location.search).get('os-copy') === 'b' ? 'b' : 'a');
  return <div className="company-os">
    <Section id="company-os-problem" title="本当に価値を生む仕事に、時間を戻す。"><p>商談後の転記、資料探し、部署間の確認待ち。AIを使っていても、仕事がつながらなければ、人の負担は残ります。</p><p>経営目標から、人・業務・データ・意思決定の流れを組み直します。</p></Section>
    <Section id="company-os-definition" title={COMPANY_OS_COPY[variant]}><p className="company-os-label">CORE — AI Company OS Company</p><h3>御社専用のAI Company OSを。</h3><p>経営、営業、マーケティング、採用、法務、ナレッジ、クリエイティブ。企業活動をAI前提で再構築し、人が本当に価値を生み出す仕事に集中できる会社をつくります。</p><p>既存のシステムと資産を生かし、御社の仕事に合わせて設計・実装・運用する仕組みです。</p><a className="company-os-button" href="/roai-score" onClick={() => { rememberSource(`company-os-${variant}`); track('corp_cta_click', `company-os-${variant}`); }}>自社の改善機会を無料診断する</a></Section>
    <Section id="company-os-how" title="成果を決め、仕事を組み直し、測り続ける。"><ol><li>経営目標と導入前の状態を確かめる。</li><li>人とAIの役割、データ、承認を設計する。</li><li>一つの業務から実装し、現場で確かめる。</li><li>ROAIを測り、効果が確認できた範囲を広げる。</li></ol></Section>
    <Section id="company-os-modules" title="必要な仕事から、一つの会社へ。"><div className="company-os-grid">{COMPANY_OS_OUTCOMES.map(([title, modules, body]) => <article key={title}><h3>{title}</h3><p>{body}</p><small>{modules}</small></article>)}</div><p>導入範囲は診断後に合意します。NERIは音声による操作窓口、会社記憶と権限・承認は各部門を支える共通基盤です。</p></Section>
  </div>;
}
export function CompanyOsProof() {
  return <div className="company-os"><Section id="company-os-proof" title="CORE自身の実践を、設計に生かす。"><p>映像制作、営業管理、会社の知識、AIとの対話。COREは自社の仕組みを開発し、使いながら改善しています。</p><p>制作物と稼働機能を示し、検証した範囲をお伝えします。全社統合の成果や導入後のROAIは、Baselineと比較して確かめる対象です。</p><a href="/studio">CORE Studioの制作を見る →</a></Section></div>;
}
export function CompanyOsCommercial() {
  const [result, setResult] = useState<ReturnType<typeof estimateCompanyOs>>(null);
  const [attempted, setAttempted] = useState(false);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const d = new FormData(e.currentTarget);
    const n = (k:string) => d.get(k) === '' ? NaN : Number(d.get(k));
    setResult(estimateCompanyOs({ employees:n('employees'), departments:n('departments'), agents:n('agents'), apis:n('apis'), sources:n('sources'), security:d.get('security') as PriceScope['security'], complexity:d.get('complexity') as PriceScope['complexity'] })); setAttempted(true);
  };
  return <div className="company-os">
    <Section id="company-os-process" title="小さく始めて、会社の変革へ。"><p>CORE Studio → SNS・Marketing改善 → Growth / Sales → Knowledge → 複数部門のCompany OS → CORE OS Update。</p><p>まず制作だけのご相談も可能です。業務の課題が見えたら、次に取り組む範囲を一緒に決めます。</p><h3>無料診断と、有料Company Scanの違い</h3><p>無料ROAI SCOREは、自己申告から改善の可能性を探す入口。Company Scanは経営者面談と業務・データの確認を行い、導入前のBaseline、設計図、90日計画を納品します。</p></Section>
    <Section id="company-os-pricing" title="何を納めるかと、予算を明確に。"><p>新規サービスの目安・税抜。期間と金額は接続先、データ、権限、業務の複雑さにより個別に見積もります。</p><div className="company-os-grid">{COMPANY_OS_PACKAGES.map(p=><article key={p.id}><h3>{p.name}</h3><strong>{p.price}</strong><p>{p.scope}</p><small>{p.term}</small></article>)}</div>
      <details><summary>構築予算の目安を計算する</summary><form onSubmit={submit} onChange={()=> { setAttempted(false); setResult(null); }} className="company-os-form">
        {([['employees','従業員数',1],['departments','対象部門数',1],['agents','Agent数',0],['apis','接続API数',0],['sources','データソース数',0]] as const).map(([key,label,min])=><label key={key}>{label}<input name={key} type="number" min={min} max={100000} step="1" required /></label>)}
        <label>セキュリティ<select name="security"><option value="standard">標準</option><option value="sso">SSO等を追加</option><option value="dedicated">専用環境</option></select></label>
        <label>業務の複雑さ<select name="complexity"><option value="standard">標準</option><option value="exceptions">例外処理が多い</option><option value="core">基幹システムと連携</option></select></label>
        <button className="company-os-button" type="submit">概算を表示</button>
      </form><div aria-live="polite">{result ? <p>構築 {(result.low/10000).toLocaleString()}〜{(result.high/10000).toLocaleString()}万円 / 運用 月{(result.monthlyLow/10000).toLocaleString()}万円〜。{result.basis}{result.enterprise && '全社導入として個別調査が必要です。'}</p> : attempted ? <p>項目を整数で入力してください。未入力では算定できません。</p> : <p>入力内容はこの計算では送信・保存しません。</p>}</div><p><small>算定式（万円）: (60＋40×部門＋8×Agent＋12×API＋8×データソース＋50名超の人数×0.2)×セキュリティ係数(1/1.25/1.6)×複雑度係数(1/1.3/1.6)。上限は1.5倍。設計上の仮定であり確定見積ではありません。</small></p></details>
    </Section>
    <Section id="company-os-action" title="御社の「核」から、次の90日を。"><p>どの仕事から変えるべきか。まずは改善の可能性を確認できます。</p><a className="company-os-button" href="/roai-score" onClick={()=>{rememberSource('company-os-bottom');track('corp_cta_click','company-os-bottom');}}>ROAIを無料診断する</a><p><a href="/corp#contact">Company Scanについて相談する →</a></p></Section>
  </div>;
}
