import { useState, type ReactNode } from 'react';
import { COMPANY_OS_COPY, COMPANY_OS_OUTCOMES, COMPANY_OS_PACKAGES, OFFER_PRICES, studioEntry } from './catalog';
import { rememberSource, track } from '../roai/track';
import './companyOs.css';
function Section({id,title,children}:{id:string;title:string;children:ReactNode}) {
 return <section id={id} className="company-os-section"><div className="ch-wrap"><h2>{title}</h2>{children}</div></section>;
}
const yen=(n:number)=>n.toLocaleString('ja-JP');
const action=(source:string)=>{rememberSource(source);track('corp_cta_click',source);};
export function CompanyOsIntro(){
 const [variant]=useState<'a'|'b'>(()=>typeof location!=='undefined'&&new URLSearchParams(location.search).get('os-copy')==='b'?'b':'a');
 return <div className="company-os"><Section id="company-os-definition" title={COMPANY_OS_COPY[variant]}>
 <p className="company-os-label">CORE — AI Company OS Company</p>
 <p id="company-os-problem">魅力はあるのに伝わらない。発信しても商談につながらない。忙しいのに、転記と確認待ちが減らない。</p>
 <p>企業の「核」から、伝え方と仕事の流れを設計し直す。制作から営業、会社の記憶まで、必要なところをつないでいく。それが、御社専用のAI Company OSです。</p>
 <a className="company-os-button" href="#company-os-pricing" onClick={()=>action(`packages-${variant}`)}>目的から、3つのプランを見る</a>
 </Section></div>;
}
export function CompanyOsProof(){return <div className="company-os"><Section id="company-os-proof" title="自分たちで使い、確かめたことを。">
 <p>COREは映像制作、営業管理、会社の知識、AIとの対話の仕組みを自ら開発・運用しています。実物と検証した範囲を示し、御社の業務に合わせて設計します。</p>
 <p>Company OS全社統合の成果は検証を重ねる段階です。導入前と導入後の数字を比べ、効果を確かめてから広げます。</p><a href="/studio/works">公開している制作実例を見る →</a>
 </Section></div>;}
export function CompanyOsCommercial(){
 const [pick,setPick]=useState('all'); const studio=studioEntry();
 return <div className="company-os">
 <span id="services" /><span id="investment" />
 <Section id="company-os-pricing" title="変えたいことから、選ぶ。">
 <p>制作だけでも、集客の改善からでも。業務をつなぐときも、最初は一つから始められます。</p>
 <div className="company-os-picker" aria-label="目的からプランを絞り込む">{[['all','3つを比較'],['studio','伝えたい'],['growth','顧客を増やしたい'],['company','業務を変えたい']].map(([id,label])=><button type="button" key={id} aria-pressed={pick===id} onClick={()=>setPick(id)}>{label}</button>)}</div>
 <div className="company-os-offers">{COMPANY_OS_PACKAGES.filter(p=>pick==='all'||p.id===pick).map((p,i)=><article key={p.id}>
 <p className="company-os-label">{String(i+1).padStart(2,'0')} / {p.name}</p><h3>{p.outcome}</h3><p>{p.for}</p>
 <div className="company-os-price">{p.id==='studio'?<><strong>映像 {yen(studio.gross)}円</strong><small>税込・標準30秒1本</small></>:p.id==='growth'?<><strong>月{yen(OFFER_PRICES.growth)}円</strong><small>税別／税込330,000円</small></>:<><strong>初期{yen(OFFER_PRICES.build)}円</strong><small>税別／税込1,320,000円</small></>}</div>
 <ul>{p.scope.map(s=><li key={s}>{s}</li>)}</ul>
 <p className="company-os-total">{p.id==='studio'?studio.note:p.id==='growth'?'初期0円。3か月総額90万円（税別）／99万円（税込）。':'診断から始める場合は20万円（税別）。同範囲の構築へ進む場合は初期費用に充当。'}</p>
 <details><summary>対象・納品範囲・費用の詳細</summary><p>{p.persona}</p><p>{p.term}</p><p>{p.exclude}</p>{p.id==='growth'&&<p>既存LPの改善提案1件/月と60分の定例を含みます。成果指標は有効問い合わせ・商談化。売上や再生数の保証はありません。</p>}{p.id==='company'&&<p>商談記録→議事録・提案の下書き→承認→CRM登録など、対象の1業務を合意。操作研修2回、手順書、移管資料、受入テストを含みます。複数部門の統合は300万円〜の個別設計です。</p>}</details>
 <a className="company-os-button" href={p.href} onClick={()=>action(`offer-${p.id}`)}>{p.cta}</a>
 </article>)}</div>
 <p><small>新規支援の標準スコープです。正式な提供範囲・費用・日程は見積書で合意します。既存の制作・製品契約を自動変更するものではありません。</small></p>
 </Section>
 <span id="engagement" />
 <Section id="company-os-process" title="小さな一歩を、次の成果へ。">
 <div id="company-os-how" className="company-os-grid"><article><h3>01 目的を決める</h3><p>無料相談またはROAI SCOREで課題を整理。制作は用途から、業務改善は現場とデータから始めます。</p></article><article><h3>02 作り、現場で確かめる</h3><p>完成物と受入条件を合意。人の承認を組み込み、動くところまで一緒に確認します。</p></article><article><h3>03 成果を比較する</h3><p>制作の利用状況、問い合わせ、商談、業務時間を記録。現金効果と戻った時間を分けて測ります。</p></article><article><h3>04 必要な範囲へ広げる</h3><p>Studio → Growth → 営業・会社記憶 → Company OS。課題と効果が確認できたときに次へ進みます。</p></article></div>
 <details><summary>診断・運用の料金と、止められるタイミング</summary><h3>Company Scan：20万円（税別）</h3><p>2週間・1部門の候補2業務を確認。優先順位、導入前の計測方法、90日設計図、見積を納品します。実装は含みません。同一法人・同範囲・60日以内の構築契約では20万円を充当し、追加100万円が標準です。診断だけで終了できます。</p><h3>CORE OS Update：月10万円（税別）</h3><p>構築後の安定化30日が終わってから、希望する場合に開始。1業務の監視・障害調査・既存ルール改善・月次レビューを月6時間まで。初回3か月計30万円（税別）、以降は1か月更新。終了は次月開始30日前までに通知。新規開発、24時間SLA、AI/クラウド実費は別です。</p><p>初年度の例：初期120万円＋運用9か月90万円＝210万円（税別）／231万円（税込）＋外部実費。運用開始時期で変わります。運用を引き継いで終了する選択肢もあります。</p></details>
 <details id="company-os-modules"><summary>既存のCORE製品・OSとの関係</summary><p>NERIは操作の窓口、Prismは経営・知識、Iris・Resonance・Crystal・Lumeは発信と顧客接点、Guildは合意と実行の候補です。すべての契約や自動接続を含むセット販売ではありません。</p><div className="company-os-grid">{COMPANY_OS_OUTCOMES.map(([title,module,body])=><article key={title}><h3>{title}</h3><p>{body}</p><small>{module}</small></article>)}</div><p>単体製品、学習サービス、業界向けの取り組みも継続します。利用料と導入範囲は各製品または個別見積で確認できます。</p><a href="/corp#products">自分で使う製品・業界別の取り組みを見る →</a></details>
 </Section>
 <Section id="company-os-action" title="御社は、何から変えますか。"><p>目的が決まっていなくても構いません。いま困っている仕事から整理します。</p><a className="company-os-button" href="/corp#contact" onClick={()=>action('packages-consult')}>目的と予算を相談する</a><p><a href="/roai-score" onClick={()=>action('packages-score')}>まず自分で、改善機会を無料診断する →</a></p></Section>
 </div>;
}
