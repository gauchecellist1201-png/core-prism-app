// ============================================================
// TrustPage — /trust 公開トラスト ページ
//
// オーナー指示 (2026-06-04 第 28 波 VVVV):
//   「データはどこに」「誰が触れる」「削除はどう」 を 1 ページに集約。
//   GDPR / 個人情報保護法 のクイック対応 + 監査人 へのワンストップ説明。
//
// 観点:
//   1. データの所在 (リージョン / どのクラウド)
//   2. アクセス権 (誰が触れる / 監査ログ)
//   3. 退会・削除 / エクスポート
//   4. AI モデル の取り扱い (学習に使うか)
//   5. 暗号化 / バックアップ / 障害時 連絡
//   6. 法令 (個人情報保護法 / GDPR / SOC2 ロードマップ)
// ============================================================

import { ArrowLeft, ShieldCheck, MapPin, Users, Trash2, Sparkles, Lock, Scale, Mail, Download, FileText } from 'lucide-react';

const COLOR_BG = 'linear-gradient(180deg, #070712 0%, #0d0d1c 100%)';
const SECTION_BG = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.08)';

const UPDATED = '2026-06-04';

type Section = {
  id: string;
  icon: React.ReactNode;
  title: string;
  oneLine: string;
  rows: { label: string; value: string }[];
  note?: string;
};

const SECTIONS: Section[] = [
  {
    id: 'where',
    icon: <MapPin size={18} />,
    title: 'データは どこに 保管されていますか',
    oneLine: '原則 日本 (東京 リージョン)。一部 グローバル CDN を経由します。',
    rows: [
      { label: 'アプリ / API',  value: 'Vercel Edge (Tokyo HND1 + Global Edge) — 動的レンダリングは Tokyo 優先' },
      { label: 'データベース',   value: 'Upstash Redis (東京 リージョン推奨) / Stripe 顧客 DB (米国 ・ EU マルチ リージョン)' },
      { label: '決済',          value: 'Stripe (PCI DSS Level 1) — カード情報は弊社サーバを通りません' },
      { label: 'メール送信',     value: 'Resend (米国) — 1 通ごとに to/from のみ記録、本文は保管しません' },
      { label: 'AI 推論',        value: 'Anthropic Claude (米国) / Google Gemini (米国・EU) — 入力は学習に使われない契約' },
      { label: '静的アセット',    value: 'Vercel CDN — グローバル エッジ (HTTPS only)' },
    ],
    note: 'CDN を含む グローバル 配信を完全に止めることはできませんが、個人データ (氏名/メール/会話履歴) は 東京 リージョン に固定します。',
  },
  {
    id: 'who',
    icon: <Users size={18} />,
    title: '誰が データに 触れますか',
    oneLine: '原則 ご本人のみ。弊社からは 緊急対応 + 監査時のみ、ログ付きで閲覧します。',
    rows: [
      { label: '本人',          value: 'ログイン後 自分のデータのみ閲覧 (他のユーザーには 隔離 — KK 巡回済み)' },
      { label: '同じ会社のメンバー', value: 'チーム招待 (QQQ) で 役割 別 (オーナー / 編集 / 閲覧)。退会で即取消し' },
      { label: '運営者 (CORE)', value: '緊急バグ調査・法令対応のみ。閲覧時は ログ + 本人通知 (audit log) を残す方針' },
      { label: '第三者',        value: '原則なし。例外: Stripe (決済) / Resend (メール) / Anthropic / Google (AI) は 利用規約 で定めた範囲のみ' },
    ],
    note: '弊社の従業員アクセス は 監査ログ + 2 段階認証 (TOTP, LLLL) を必須にしています。',
  },
  {
    id: 'delete',
    icon: <Trash2 size={18} />,
    title: '退会 / 削除 はどうやって',
    oneLine: '設定 → 個人情報 → 「全データ JSON エクスポート」「全データ削除」 で 30 秒で完了。',
    rows: [
      { label: '全データ エクスポート', value: '設定 → 個人情報 → 全データ JSON ダウンロード (JJJ, 30秒)' },
      { label: '会話履歴 エクスポート', value: 'モバイル チャット 履歴を .txt / .md で (LLL)' },
      { label: '退会 / 削除',         value: '設定 → 個人情報 → 「すべて削除」 をタップ → 確認 → 即時削除 (バックアップから 30 日以内に消滅)' },
      { label: 'サブスク解約',         value: 'Stripe カスタマー ポータル (自動 リンク) で 即時 解約' },
      { label: '通信履歴 / メール',    value: 'メールアドレス を 削除依頼 として core.guild.inc@gmail.com に送信 → 7 日以内に対応' },
    ],
  },
  {
    id: 'ai',
    icon: <Sparkles size={18} />,
    title: 'AI モデル は あなたの データで 学習しますか',
    oneLine: 'いいえ。Anthropic / Google の API 規約で「学習しない」 を 明示しています。',
    rows: [
      { label: 'Anthropic Claude',  value: 'Commercial API: デフォルトで 入力 を 学習に使わない (no-training)' },
      { label: 'Google Gemini',     value: 'Google AI for Developers / Vertex AI: 同上 (no-training)' },
      { label: 'OpenAI 互換',       value: '弊社では Anthropic / Google のみ採用。OpenAI を経由 する場合は別途 同意 を 取ります' },
      { label: 'ログ保持',          value: 'API の呼び出しログ は 90 日 (Anthropic) / 30 日 (Google) で消滅。弊社では生 ログを保管しません' },
      { label: 'プロンプトの 二次利用', value: 'なし。 弊社内部の 分析用 ダッシュボード ですら 個別プロンプトの内容 は表示しません' },
    ],
    note: 'AI 利用状況 (XXX) で「自分が どの モデル を 何回 呼んだか」 はいつでも 確認できます。',
  },
  {
    id: 'security',
    icon: <Lock size={18} />,
    title: '暗号化 / バックアップ / 障害',
    oneLine: '全通信 TLS 1.3。Vercel + Upstash の標準 バックアップ。重大障害は Slack / メール で告知。',
    rows: [
      { label: '通信暗号化',     value: 'HTTPS / TLS 1.3 (HSTS preload, vercel.json 設定済)' },
      { label: '保管暗号化',     value: 'Upstash: AES-256 / Stripe: PCI DSS Level 1 / Vercel KV: AES-256' },
      { label: 'バックアップ',   value: 'Upstash: PITR (Point-In-Time Recovery 35 日)。アプリ ソース は GitHub' },
      { label: '監視',          value: '自前 error tracker (UU) + secrets-health (FFF) + anomaly-detect (UUUU) で 24/7 監視' },
      { label: '障害時の連絡',    value: 'メール (オーナーは Resend) / Slack (オーナー Webhook) で 30 分以内に第一報' },
    ],
  },
  {
    id: 'legal',
    icon: <Scale size={18} />,
    title: '法令 / 認証',
    oneLine: '個人情報保護法 / GDPR / CCPA 準拠。SOC2 / ISO27001 は 2026Q4 取得を目標に。',
    rows: [
      { label: '個人情報保護法 (日本)', value: '対応済。事業者: 井出 直毅（屋号: CORE）' },
      { label: 'GDPR (EU)',            value: '対応済 (アクセス / 訂正 / 削除 / 持ち出し / 異議申立 の権利を保証)' },
      { label: 'CCPA (米 加州)',        value: '対応済 (Do Not Sell / Share — 弊社は そもそも 個人データを 売却しません)' },
      { label: 'SOC2 / ISO27001',       value: '取得 ロードマップ中 (Type I を 2026Q3, Type II を 2026Q4 目標)' },
      { label: '特定商取引法',           value: '/tokushoho に 事業者情報・販売条件・解約 を 全文掲載' },
      { label: '個人情報保護管理者',     value: '井出直毅 (core.guild.inc@gmail.com)' },
    ],
  },
];

export default function TrustPage() {
  return (
    <div style={{ minHeight: '100vh', background: COLOR_BG, color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif' }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '32px 18px 80px' }}>
        {/* Back */}
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: 24 }}>
          <ArrowLeft size={14} /> ホームへ戻る
        </a>

        {/* Hero */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 18 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #34D399, #10B981)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#04130c', boxShadow: '0 12px 24px rgba(52,211,153,0.35)',
            flexShrink: 0,
          }}>
            <ShieldCheck size={28} />
          </div>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.3em', color: '#34D399', fontWeight: 800 }}>TRUST CENTER</div>
            <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.3rem)', margin: '4px 0 6px', fontWeight: 900, lineHeight: 1.25 }}>
              データは どこに / 誰が触れる / 削除はどう
            </h1>
            <p style={{ fontSize: '0.92rem', color: 'rgba(255,255,255,0.72)', margin: 0, lineHeight: 1.7 }}>
              CORE Prism / Iris の データ取り扱い を 1 ページにまとめました。
              監査・営業先・パートナー の方は そのまま PDF として 印刷 してご活用ください。
            </p>
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 28 }}>
          最終更新: {UPDATED}  /  運営責任者: <strong style={{ color: 'rgba(255,255,255,0.75)' }}>井出 直毅（CORE）</strong>  /  代表: 井出直毅
        </div>

        {/* TL;DR card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(52,211,153,0.12), rgba(99,102,241,0.10))',
          border: '1px solid rgba(52,211,153,0.3)',
          borderRadius: 16,
          padding: '16px 18px',
          marginBottom: 28,
        }}>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#34D399', fontWeight: 800, marginBottom: 8 }}>5 行 サマリー</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.92rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.85 }}>
            <li>個人データ (氏名・メール・会話) は <strong>東京 リージョン</strong> に保管</li>
            <li>あなたのデータを <strong>AI の学習</strong> に使うことはありません (Anthropic / Google の API 規約で明示)</li>
            <li><strong>退会 / 削除</strong> は 設定 → 個人情報 から <strong>30 秒</strong> で完了</li>
            <li><strong>2 段階認証 (TOTP)</strong> + <strong>監査ログ</strong> + <strong>自動 異常検知</strong> で 24/7 監視</li>
            <li>GDPR / 個人情報保護法 / CCPA 準拠。SOC2 は <strong>2026Q4</strong> 取得目標</li>
          </ul>
        </div>

        {/* TOC */}
        <div style={{
          background: SECTION_BG, border: `1px solid ${BORDER}`,
          borderRadius: 12, padding: '12px 14px',
          marginBottom: 28,
        }}>
          <div style={{ fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.55)', fontWeight: 700, marginBottom: 8 }}>目次</div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 6 }}>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} style={{ color: 'rgba(255,255,255,0.78)', textDecoration: 'none', fontSize: '0.86rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{s.icon}</span> {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Sections */}
        {SECTIONS.map((s) => (
          <section
            id={s.id}
            key={s.id}
            style={{
              background: SECTION_BG,
              border: `1px solid ${BORDER}`,
              borderRadius: 16,
              padding: '20px 22px',
              marginBottom: 18,
              scrollMarginTop: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(52,211,153,0.16)', color: '#34D399',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>{s.icon}</div>
              <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 800 }}>{s.title}</h2>
            </div>
            <p style={{ fontSize: '0.92rem', color: 'rgba(255,255,255,0.78)', margin: '0 0 14px', lineHeight: 1.7 }}>
              <strong style={{ color: '#34D399' }}>結論:</strong> {s.oneLine}
            </p>
            <div style={{
              border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden',
              background: 'rgba(0,0,0,0.2)',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <tbody>
                  {s.rows.map((r, i) => (
                    <tr key={i} style={{ borderBottom: i === s.rows.length - 1 ? 'none' : `1px solid ${BORDER}` }}>
                      <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap', width: '30%', verticalAlign: 'top' }}>
                        {r.label}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.9)', lineHeight: 1.65 }}>
                        {r.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {s.note && (
              <p style={{ marginTop: 12, fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
                <FileText size={11} style={{ verticalAlign: 'text-bottom' }} /> {s.note}
              </p>
            )}
          </section>
        ))}

        {/* Action footer */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(168,85,247,0.10))',
          border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: 16,
          padding: '20px 22px',
          marginTop: 32,
        }}>
          <h3 style={{ fontSize: '1.05rem', margin: '0 0 10px', fontWeight: 800 }}>もう一歩 踏み込んで 確認したい</h3>
          <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.78)', lineHeight: 1.7, margin: '0 0 14px' }}>
            DPA (データ処理契約) / 監査 / SOC2 試行レポート の 開示が必要な場合、
            メール 1 通 で 24 時間以内に 返信します。
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <a href="mailto:core.guild.inc@gmail.com?subject=%5BCORE%20Trust%5D%20%E5%95%8F%E5%90%88%E3%82%8F%E3%81%9B" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 16px', borderRadius: 10,
              background: 'linear-gradient(135deg, #6366F1, #A855F7)', color: '#fff',
              textDecoration: 'none', fontWeight: 700, fontSize: '0.88rem',
              boxShadow: '0 10px 22px rgba(99,102,241,0.4)',
            }}>
              <Mail size={14} /> 監査担当に問い合わせ
            </a>
            <a href="/privacy" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 16px', borderRadius: 10,
              background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)',
              textDecoration: 'none', fontWeight: 700, fontSize: '0.88rem',
              border: `1px solid ${BORDER}`,
            }}>
              <FileText size={14} /> プライバシーポリシー 全文
            </a>
            <a href="/terms" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 16px', borderRadius: 10,
              background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)',
              textDecoration: 'none', fontWeight: 700, fontSize: '0.88rem',
              border: `1px solid ${BORDER}`,
            }}>
              <FileText size={14} /> 利用規約
            </a>
            <button
              onClick={() => window.print()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '10px 16px', borderRadius: 10,
                background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)',
                border: `1px solid ${BORDER}`, fontSize: '0.88rem', fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Download size={14} /> PDF / 印刷
            </button>
          </div>
        </div>

        {/* Tiny footer */}
        <div style={{ marginTop: 28, fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
          © Naoki Ide (CORE) — CORE Prism / Iris.   最終更新: {UPDATED}
        </div>
      </div>
    </div>
  );
}
