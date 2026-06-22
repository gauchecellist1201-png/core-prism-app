// ============================================================
// /strategy?tab=robotics — CORE Robotics 事業計画
//   既存5プロダクト(Resonance/Guild/Iris/Prism/Lume)をロボティクスへ応用。
//   ハードは作らず「ソフト・データ・接点」の層を取る。市場数字は2025-26の一次情報で裏取り済。
//   StrategyDashboard の robotics タブから描画される自己完結ページ。
// ============================================================
import { motion } from 'framer-motion';

const FONT_DISPLAY = '"Cinzel", "Noto Serif JP", serif';
const FONT_SERIF_JA = '"Noto Serif JP", "游明朝", serif';
const TEAL = '#2dd4bf';
const VIOLET = '#a78bfa';
const BLUE = '#60a5fa';
const GOLD = '#fbbf24';

// ─── 5プロダクト → ロボティクス写像 ───
const MAP = [
  { p: 'Guild', role: '実演データの分散収集マーケット', detail: '現場の人がロボに動きを教え→トークンで謝礼。ロボ版RLHFを群衆で回す。', fit: '◎ 最重要', c: TEAL },
  { p: 'Prism', role: 'ロボット運用OS（Fleet Ops）', detail: '複数台を「事業」として管理：稼働率 / ROI / 異常対応 / スケジュール。', fit: '◎ 高', c: VIOLET },
  { p: 'Resonance', role: 'ロボの人格・対話・通知層', detail: '受付/介護/接客ロボが履歴を覚え自然に話す。操作者へのスマホ通知も同じ仕組み。', fit: '◎ 高', c: BLUE },
  { p: 'Lume', role: 'シミュ / 合成データ生成', detail: 'デジタルツインで仮想空間に大量試行させ学習データを量産（sim2real）。', fit: '○ 中〜高', c: GOLD },
  { p: 'Iris', role: '直接適合は弱い（本業継続が賢明）', detail: '撮影ロボ×クリエイター市場、またはタスク計画への転用が候補。無理に転用しない。', fit: '△ 候補', c: '#9ca3af' },
];

// ─── 5層スタック ───
const STACK = [
  { n: '⑤ 接点層', who: 'Resonance', role: 'ロボの人格・対話・操作者通知', c: BLUE },
  { n: '④ 運用層', who: 'Prism', role: '群管理・ROI・自律オペ（Fleet OS）', c: VIOLET },
  { n: '③ 頭脳層', who: 'OSS活用', role: '方策・タスク計画（自作せず巨人の肩に乗る）', c: '#9ca3af' },
  { n: '② データ層', who: 'Guild + Lume', role: '実演収集＋合成生成 ＝ ここが堀', c: TEAL },
  { n: '① ハード層', who: '他社製', role: 'Unitree / 中国製アーム / LeRobot。買う。作らない', c: '#6b7280' },
];

// ─── 市場（裏取り済み）───
const MARKET = [
  { k: '世界ヒューマノイド市場 (2035)', v: '約5.7兆円', note: '380億ドル（強気23兆円）', src: 'Goldman Sachs' },
  { k: '世界ロボVC投資 (2025)', v: '約4.1兆円', note: '276億ドル・前年比2倍', src: 'PitchBook' },
  { k: 'うちロボ基盤モデルへ (2025)', v: '22億ドル超', note: '「データ＝価値」の証明', src: 'PitchBook' },
  { k: '日本のロボットソフト市場 (2030)', v: '約2,700億円', note: '17.9億ドル・CAGR26.3%', src: 'Next Move' },
  { k: '日本サービスロボ市場・全体 (2030)', v: '約4,000億円', note: 'ほぼ倍増', src: '富士経済' },
  { k: '労働力不足 (2040)', v: '1,100万人', note: '働き手世代20%減＝構造需要', src: 'リクルートワークス' },
];

// ─── データ層の需要は実証済み ───
const PROOF = [
  { name: 'Physical Intelligence (π)', v: '評価額 約1.6兆円', note: 'ロボ基盤モデル。110億ドルまで上昇' },
  { name: 'Skild AI', v: '評価額 140億ドル超', note: '売上3,000万ドルでSoftBank主導14億ドル調達' },
  { name: '基盤モデルへの投資 (2025)', v: '22億ドル超', note: '良質な実演データを渇望＝買い手が実在' },
];

// ─── シェアシナリオ ───
const SHARE = [
  { y: '1年目', aim: 'パイロット3〜5社、データ収集の型作り', rev: '〜¥1,000万' },
  { y: '3年目', aim: '運用ソフト数百台契約 or データを基盤モデル企業へ販売', rev: '¥3〜10億' },
  { y: '5年目', aim: '国内ニッチの事実上の標準層（SAM比5〜8%）', rev: '¥20〜50億' },
];

// ─── くさび戦略 4ステップ ───
const WEDGE = [
  { t: 'データを入口に', d: '設備不要。現場の人がスマホ/簡易アームでロボに動きを教える→Guildがトークンで謝礼→国内ロボ企業・大学・基盤モデル企業に販売。在庫ゼロ・高粗利。' },
  { t: '現場と信頼を作る', d: 'データ取引で現場（数十社）と関係ができる。' },
  { t: '運用OS・対話を差込', d: 'そこにPrism（運用OS）とResonance（対話層）を後から売る。顧客はもう中にいるので営業コストが激減。' },
  { t: '合成データで強化', d: 'Lumeの合成データで「実演が足りない分」を埋め、データ商品を強化。' },
];

// ─── コスト（フェーズ別）───
const COST = [
  { ph: 'フェーズ0：検証（0〜3ヶ月）', total: '30〜50万円（自己負担）', items: ['低価格アーム LeRobot SO-ARM100：3〜15万円', 'GPU（クラウド従量 or 中古4090）：5〜30万円', 'ソフト/シミュ：0円（ROS2 / Isaac / Mujoco は無料OSS）', '謝礼トークン原資（被験者10人）：5〜20万円'] },
  { ph: 'フェーズ1：MVP＋パイロット（3〜9ヶ月）', total: '300〜2,000万円', items: ['コモディティ・ロボ2〜3台：50〜500万円', 'データ収集謝礼（現場100人）：50〜200万円', '業務委託（ロボ制御Eng・スポット）：100〜500万円', 'GPU/クラウド：30〜100万円'] },
  { ph: 'フェーズ2：スケール（9〜24ヶ月）', total: '数千万〜（要・外部資金）', items: ['営業/CS人員、ロボ台数増、データ基盤強化', '自己資金ではなく「データ販売売上＋VC調達」で回す', '日本のフィジカルAIには現在、資金が付きやすい'] },
];

// ─── ロードマップ ───
const ROADMAP = [
  { s: 'Step 1', when: '今週', t: 'LeRobot SO-ARM100を1台発注。guildに「実演提出→トークン謝礼」モードを実装' },
  { s: 'Step 2', when: '1ヶ月', t: 'アームで「物をつかむ」実演を自分で50回記録→模倣学習。まず自分でフル成功体験' },
  { s: 'Step 3', when: '2ヶ月', t: 'Lumeをデジタルツイン化。Isaac Simで1万回試行→sim2realで性能向上を確認' },
  { s: 'Step 4', when: '3ヶ月', t: '「データを売れる相手」3者リスト化（国内ロボ企業/大学/基盤モデル企業）。要承認で打診' },
  { s: 'Step 5', when: '4〜6ヶ月', t: '現場1社とパイロット。Prismを稼働ダッシュボード化、Resonanceで通知を実装' },
  { s: 'Step 6', when: '6〜12ヶ月', t: 'データ販売実績を武器に運用OSを横展開。VC/事業会社との提携を検討' },
];

// ─── リスクと対策 ───
const RISK = [
  ['実機制御の難易度が高い', '自作せずROS2/LeRobot/Isaacに乗る。最初は「つかむ/運ぶ」の単純タスク限定'],
  ['データの権利・安全', '提供者と権利同意・匿名化を最初から設計（Guildの共創ルール流用）'],
  ['顧客がまだロボを持たない', 'だからデータを入口にする（くさび戦略）。普及を待たず収益化'],
  ['資本力で大手に潰される', '大手が嫌がる「狭い国内ニッチ＋泥臭いデータ収集」に陣取る'],
];

const card: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14 };

function Head({ sub, title, desc }: { sub: string; title: string; desc?: string }) {
  return (
    <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.65rem', letterSpacing: '0.4em', color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: 6 }}>{sub}</p>
      <h2 style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.4rem, 2.8vw, 2rem)', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 8 }}>{title}</h2>
      {desc && <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.8, maxWidth: 720, margin: '0 auto' }}>{desc}</p>}
    </div>
  );
}

function Wrap({ children, bg }: { children: React.ReactNode; bg?: string }) {
  return (
    <section className="lp-section-pad" style={{ padding: '3.5rem 1.5rem', background: bg || '#000' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>{children}</div>
    </section>
  );
}

export default function RoboticsPlan() {
  return (
    <div>
      {/* Hero */}
      <section className="lp-section-pad" style={{ padding: '4rem 1.5rem 2.5rem', textAlign: 'center', background: `radial-gradient(900px 420px at 50% -10%, rgba(45,212,191,0.14), transparent), linear-gradient(180deg,#000,#04100f)` }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.45em', color: TEAL, fontWeight: 600, marginBottom: '1.1rem' }}>CORE ROBOTICS — BUSINESS PLAN</p>
        <h1 style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.9rem, 4.6vw, 3rem)', fontWeight: 800, lineHeight: 1.4, letterSpacing: '0.03em', marginBottom: '1rem' }}>
          ロボットは作らない。<br /><span style={{ background: `linear-gradient(90deg,${TEAL},${BLUE},${VIOLET})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 900 }}>動かす頭脳・データ・接点</span>を取る。
        </h1>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.95rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.9, maxWidth: 680, margin: '0 auto 2rem' }}>
          ハードは急速にコモディティ化する。空いているのは物理世界の「ソフト・データ層」。既存5プロダクトの思想を、そのまま物理世界へ拡張する。
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '0.75rem', maxWidth: 760, margin: '0 auto' }}>
          {[
            { l: '世界ヒューマノイド 2035', v: '¥5.7兆', c: BLUE },
            { l: '日本ロボソフト 2030', v: '¥2,700億', c: TEAL },
            { l: '狙うシェア 5年', v: '5〜8%', c: VIOLET },
          ].map((s, i) => (
            <div key={i} style={{ ...card, padding: '1.1rem 1rem' }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.6rem', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 6 }}>{s.l}</p>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.6rem', fontWeight: 800, color: s.c }}>{s.v}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '1.5rem' }}>
          <button onClick={() => window.print()} style={{ padding: '0.55rem 1.3rem', borderRadius: 999, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontFamily: FONT_SERIF_JA, fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer' }}>印刷 / PDF 出力</button>
        </div>
      </section>

      {/* 戦略思想 */}
      <Wrap bg="#000">
        <Head sub="THE THESIS" title="核心の戦略思想" desc="ロボット本体ではなく、ロボットを動かす層を握る。" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '0.9rem' }}>
          {[
            { t: 'ハードはコモディティ化', d: 'Unitree G1が約240万円、中国製アーム・LeRobot系オープンハードが数万〜数十万円。資本のない個人がここで戦えば負ける。' },
            { t: '真のボトルネックはソフト層', d: '①学習（実演）データ ②タスク計画・群管理 ③人との自然な対話 ④現場オペレーション ⑤改善ループ。ここはまだ覇者がいない。' },
          ].map((x, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} style={{ ...card, padding: '1.5rem' }}>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.05rem', fontWeight: 700, marginBottom: 8, color: TEAL }}>{x.t}</p>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.85 }}>{x.d}</p>
            </motion.div>
          ))}
        </div>
      </Wrap>

      {/* 5プロダクト写像 */}
      <Wrap bg="linear-gradient(180deg,#000,#070712)">
        <Head sub="PRODUCT MAPPING" title="5プロダクト → ロボティクス" desc="偶然ではなく、足りない層にそのまま対応している。Guildとプリズムが二枚看板。" />
        <div style={{ display: 'grid', gap: '0.7rem' }}>
          {MAP.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
              style={{ ...card, padding: '1.1rem 1.3rem', borderLeft: `3px solid ${m.c}`, display: 'grid', gridTemplateColumns: '110px 1fr auto', gap: '1rem', alignItems: 'center' }} className="cr-row">
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1rem', fontWeight: 800, color: m.c }}>{m.p}</p>
              <div>
                <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.92rem', fontWeight: 700, marginBottom: 3 }}>{m.role}</p>
                <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>{m.detail}</p>
              </div>
              <span style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.75rem', fontWeight: 700, color: m.c, whiteSpace: 'nowrap' }}>{m.fit}</span>
            </motion.div>
          ))}
        </div>
      </Wrap>

      {/* 5層スタック */}
      <Wrap bg="#000">
        <Head sub="THE STACK" title="CORE Robotics 5層スタック" desc="コモディティのロボ本体の上に、当社の層を積む。" />
        <div style={{ display: 'grid', gap: '0.5rem', maxWidth: 820, margin: '0 auto' }}>
          {STACK.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
              style={{ ...card, padding: '1rem 1.3rem', display: 'grid', gridTemplateColumns: '120px 130px 1fr', gap: '1rem', alignItems: 'center', background: `linear-gradient(90deg, ${s.c}14, rgba(255,255,255,0.02))`, border: `1px solid ${s.c}33` }} className="cr-stack">
              <p style={{ fontFamily: FONT_SERIF_JA, fontWeight: 800, color: s.c, fontSize: '0.95rem' }}>{s.n}</p>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.82rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{s.who}</p>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>{s.role}</p>
            </motion.div>
          ))}
        </div>
        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontFamily: FONT_SERIF_JA, fontSize: '0.9rem', color: TEAL, fontWeight: 700 }}>「データ層を握った者がロボティクスを制す」。Guildの共創エンジンが最大の勝ち筋。</p>
      </Wrap>

      {/* 市場 */}
      <Wrap bg="linear-gradient(180deg,#000,#070712)">
        <Head sub="MARKET — VERIFIED 2025-26" title="市場規模（一次情報で裏取り済み）" desc="数字はすべて2025〜2026年の公開情報で確認。出典を併記。" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '0.7rem' }}>
          {MARKET.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }} style={{ ...card, padding: '1.2rem 1.3rem' }}>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>{m.k}</p>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.5rem', fontWeight: 800, color: TEAL }}>{m.v}</p>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{m.note}</p>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.62rem', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>出典：{m.src}</p>
            </motion.div>
          ))}
        </div>
      </Wrap>

      {/* データ層は市場が証明 */}
      <Wrap bg="#000">
        <Head sub="PROOF OF DEMAND" title="「データ層が勝ち筋」は市場が証明済み" desc="くさび戦略の入口＝実演データには、すでに巨大な買い手と高い値付けが存在する。" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '0.7rem' }}>
          {PROOF.map((p, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} style={{ ...card, padding: '1.4rem', textAlign: 'center', border: `1px solid ${VIOLET}33` }}>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', fontWeight: 700, marginBottom: 8 }}>{p.name}</p>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.3rem', fontWeight: 800, color: VIOLET }}>{p.v}</p>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)', marginTop: 6, lineHeight: 1.7 }}>{p.note}</p>
            </motion.div>
          ))}
        </div>
      </Wrap>

      {/* シェアシナリオ */}
      <Wrap bg="linear-gradient(180deg,#000,#070712)">
        <Head sub="SHARE SCENARIO" title="獲得シェア・現実シナリオ" desc="世界の10%は取れない。日本のサービスロボ運用ソフト＋実演データに絞れば、5年で5〜8%は現実的。" />
        <div style={{ display: 'grid', gap: '0.7rem', maxWidth: 860, margin: '0 auto' }}>
          {SHARE.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
              style={{ ...card, padding: '1.2rem 1.4rem', display: 'grid', gridTemplateColumns: '80px 1fr 140px', gap: '1rem', alignItems: 'center' }} className="cr-row">
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1rem', fontWeight: 800, color: GOLD }}>{s.y}</p>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.86rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>{s.aim}</p>
              <p style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 700, color: '#86efac', textAlign: 'right' }}>{s.rev}</p>
            </motion.div>
          ))}
        </div>
      </Wrap>

      {/* くさび戦略 */}
      <Wrap bg="#000">
        <Head sub="THE WEDGE" title="最も効果的な戦略：データのくさび" desc="最小コストで最大の堀を作る順番。" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: '0.7rem' }}>
          {WEDGE.map((w, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} style={{ ...card, padding: '1.4rem' }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.4rem', fontWeight: 800, color: TEAL, marginBottom: 6 }}>{String(i + 1).padStart(2, '0')}</p>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.95rem', fontWeight: 700, marginBottom: 8 }}>{w.t}</p>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>{w.d}</p>
            </motion.div>
          ))}
        </div>
      </Wrap>

      {/* コスト */}
      <Wrap bg="linear-gradient(180deg,#000,#070712)">
        <Head sub="COST" title="必要コスト（フェーズ別）" desc="PoCまで自己負担30〜50万円。スケールはデータ販売売上＋外部調達で回す。" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '0.8rem' }}>
          {COST.map((c, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} style={{ ...card, padding: '1.5rem' }}>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.9rem', fontWeight: 700, marginBottom: 4 }}>{c.ph}</p>
              <p style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 800, color: GOLD, marginBottom: 12 }}>{c.total}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                {c.items.map((it, j) => (
                  <li key={j} style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, paddingLeft: 14, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, color: TEAL }}>·</span>{it}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </Wrap>

      {/* ロードマップ */}
      <Wrap bg="#000">
        <Head sub="ROADMAP" title="実行ロードマップ" desc="まず自分でフルに成功体験を作る。" />
        <div style={{ display: 'grid', gap: '0.6rem', maxWidth: 880, margin: '0 auto' }}>
          {ROADMAP.map((r, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
              style={{ ...card, padding: '1.1rem 1.3rem', display: 'grid', gridTemplateColumns: '70px 90px 1fr', gap: '0.9rem', alignItems: 'center' }} className="cr-road">
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.85rem', fontWeight: 800, color: BLUE }}>{r.s}</p>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.78rem', fontWeight: 700, color: TEAL }}>{r.when}</p>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.83rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>{r.t}</p>
            </motion.div>
          ))}
        </div>
      </Wrap>

      {/* リスク */}
      <Wrap bg="linear-gradient(180deg,#000,#070712)">
        <Head sub="RISK & MITIGATION" title="リスクと対策" desc="silent fail を作らない。" />
        <div style={{ display: 'grid', gap: '0.6rem', maxWidth: 920, margin: '0 auto' }}>
          {RISK.map(([r, m], i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
              style={{ ...card, padding: '1.1rem 1.3rem', display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '1rem', alignItems: 'center' }} className="cr-row">
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', fontWeight: 700, color: '#fca5a5' }}>{r}</p>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>{m}</p>
            </motion.div>
          ))}
        </div>
      </Wrap>

      {/* まとめ / CTA */}
      <section className="lp-section-pad" style={{ padding: '4rem 1.5rem 5rem', textAlign: 'center', background: `radial-gradient(800px 400px at 50% 120%, rgba(45,212,191,0.14), transparent), #000` }}>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.1rem, 2.4vw, 1.5rem)', fontWeight: 800, lineHeight: 1.7, maxWidth: 820, margin: '0 auto 1.5rem' }}>
          ハードを作らず、<span style={{ color: TEAL }}>Guildでデータ層を握り</span>、そこを足がかりに<span style={{ color: VIOLET }}>Prism（運用OS）</span>と<span style={{ color: BLUE }}>Resonance（対話）</span>を物理世界に差し込む。
        </p>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.9rem', color: 'rgba(255,255,255,0.55)', marginBottom: '2rem' }}>日本のサービスロボ・ソフトで5年5〜8%シェアを狙う。</p>
        <div style={{ display: 'flex', gap: '0.7rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="https://guild-hazel.vercel.app/robot" target="_blank" rel="noopener noreferrer"
            style={{ padding: '0.7rem 1.5rem', borderRadius: 999, background: `linear-gradient(135deg,${TEAL},${BLUE})`, color: '#04100f', fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.05em', textDecoration: 'none' }}>
            実演データ収集ボードを見る →
          </a>
        </div>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.6rem', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.35)', marginTop: '2.5rem' }}>CORE ROBOTICS · 2026</p>
      </section>

      <style>{`
        @media (max-width: 720px) {
          .cr-row, .cr-stack, .cr-road { grid-template-columns: 1fr !important; gap: 0.4rem !important; }
        }
      `}</style>
    </div>
  );
}
