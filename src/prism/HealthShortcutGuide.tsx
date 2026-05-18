// ============================================================
// CORE Prism ▸ Apple Health 連携ガイド
//
// 経営者向けの「ZIP アップロードではなく iOS ショートカットで毎朝自動同期」
// セットアップ画面。ユーザー紐付けは email の SHA-256 ハッシュで判定する。
//
// 提供するもの:
//   1. 自分の email から計算したハッシュ (識別子) — コピー可能
//   2. 投稿先 URL (絶対 URL) — コピー可能
//   3. iOS ショートカットの作り方 (Health 4 項目 → JSON → POST)
//   4. curl で接続確認するサンプル — コピー可能
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import HealthQuickInput from '../components/HealthQuickInput';

interface Props {
  /** ログイン中ユーザーの email (BillingUser から渡す) */
  email: string;
  /** 閉じるとき */
  onClose?: () => void;
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input.trim().toLowerCase());
  const hash = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function CopyButton({ value, label = 'コピー' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* ignore */
        }
      }}
      className="text-xs px-2.5 py-1 rounded-md font-medium transition-all"
      style={{
        background: copied ? 'rgba(52, 211, 153, 0.18)' : 'rgba(255,255,255,0.08)',
        color: copied ? '#34d399' : 'var(--fg)',
        border: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      {copied ? 'コピーしました' : label}
    </button>
  );
}

function CodeBlock({ children, value }: { children: string; value?: string }) {
  return (
    <div className="relative rounded-lg p-3 pr-20 text-xs leading-relaxed font-mono whitespace-pre-wrap break-all" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {children}
      <div className="absolute top-2 right-2">
        <CopyButton value={value ?? children} />
      </div>
    </div>
  );
}

export default function HealthShortcutGuide({ email, onClose }: Props) {
  const [hash, setHash] = useState<string>('');
  const endpoint = useMemo(() => {
    if (typeof window === 'undefined') return '/api/health/ingest';
    return `${window.location.origin}/api/health/ingest`;
  }, []);

  useEffect(() => {
    if (!email) return;
    let alive = true;
    sha256Hex(email).then((h) => { if (alive) setHash(h); });
    return () => { alive = false; };
  }, [email]);

  const curlSample = useMemo(() => {
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return `curl -X POST '${endpoint}' \\
  -H 'Content-Type: application/json' \\
  -H 'X-User-Email-Hash: ${hash || '<あなたのハッシュ>'}' \\
  -d '{
    "date": "${date}",
    "steps": 8421,
    "sleepMin": 432,
    "heartRateAvg": 58,
    "weightKg": 68.4,
    "mood": 4
  }'`;
  }, [endpoint, hash]);

  const shortcutJsonHint = `{
  "date": "今日の日付 (YYYY-MM-DD)",
  "steps": 歩数 (数値),
  "sleepMin": 睡眠時間 (分),
  "heartRateAvg": 平均心拍 (bpm),
  "weightKg": 体重 (kg, 任意),
  "mood": 1〜5 (任意)
}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-3xl mx-auto rounded-2xl p-5 sm:p-6 space-y-5"
      style={{
        background: 'linear-gradient(160deg, rgba(46,111,255,0.10), rgba(232,75,151,0.06))',
        border: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] tracking-[0.18em] font-semibold uppercase opacity-60">体調を記録する</div>
          <h2 className="text-lg sm:text-xl font-semibold mt-1">2 つの方法から、好きなほうで</h2>
          <p className="text-sm opacity-70 mt-1">
            むずかしい設定は不要です。まずは下の「かんたん入力」だけで十分。Apple Watch をお持ちの方は、自動同期も選べます。
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-2.5 py-1 rounded-md opacity-70 hover:opacity-100"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            閉じる
          </button>
        )}
      </header>

      {/* おすすめ: かんたん入力 (5 秒・誰でも) */}
      <section className="space-y-2">
        <div className="text-sm font-semibold flex items-center gap-2">
          <span style={{
            fontSize: 9, fontWeight: 800, color: '#fff',
            background: '#10B981', padding: '2px 7px', borderRadius: 999,
          }}>おすすめ</span>
          方法 A — かんたん入力（Apple Watch 不要・5 秒）
        </div>
        <HealthQuickInput accent="#8E5CFF" />
      </section>

      {/* くわしい方向け: Apple Watch 自動同期 */}
      <div className="text-sm font-semibold pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
        方法 B — Apple Watch 自動同期（くわしい方向け・一度だけ設定）
      </div>
      <p className="text-xs opacity-60">
        以下は上級者向けです。設定すると、毎朝 iPhone が自動で歩数・睡眠・心拍・体重を届けます。むずかしければ、上の「かんたん入力」だけで OK です。
      </p>

      {/* Step 0: あなたの識別子 */}
      <section className="space-y-2">
        <div className="text-sm font-semibold">① あなたの「合言葉」を控える</div>
        <p className="text-xs opacity-70">
          メールアドレス ({email || '未ログイン'}) から自動計算した安全な識別子です。ショートカットの「ヘッダー」欄にそのまま貼ってください。
        </p>
        <CodeBlock value={hash}>{hash || '（計算中…）'}</CodeBlock>
      </section>

      {/* Step 1: 投稿先 URL */}
      <section className="space-y-2">
        <div className="text-sm font-semibold">② 投稿先の URL</div>
        <CodeBlock value={endpoint}>{endpoint}</CodeBlock>
      </section>

      {/* Step 2: ショートカットの手順 */}
      <section className="space-y-2">
        <div className="text-sm font-semibold">③ iOS ショートカットの作り方 (1 回だけ)</div>
        <ol className="text-sm space-y-2 pl-5 list-decimal opacity-90">
          <li>iPhone の「ショートカット」アプリを開いて、右上の「＋」で新規ショートカットを作成。</li>
          <li>
            アクションを 4 つ追加して、それぞれ Apple Health から「直近のサンプル」を取得します：
            <ul className="list-disc pl-5 mt-1 text-xs opacity-80 space-y-0.5">
              <li>歩数 (Step Count) — 今日</li>
              <li>睡眠分析 (Sleep Analysis) — 今日 — 分の合計</li>
              <li>安静時心拍 (Resting Heart Rate) — 今日 — 平均</li>
              <li>体重 (Body Mass) — 今日 — 最新</li>
            </ul>
          </li>
          <li>「テキスト」アクションで、以下のような JSON を組み立てます。{' '}<span className="opacity-60 text-xs">(各値はマジック変数で前のアクションを参照)</span></li>
        </ol>
        <CodeBlock>{shortcutJsonHint}</CodeBlock>
        <ol start={4} className="text-sm space-y-2 pl-5 list-decimal opacity-90">
          <li>
            「URL の内容を取得」アクションを追加して、以下のように設定します：
            <ul className="list-disc pl-5 mt-1 text-xs opacity-80 space-y-0.5">
              <li>URL: 上の「②」をペースト</li>
              <li>メソッド: <span className="font-mono">POST</span></li>
              <li>ヘッダー: <span className="font-mono">Content-Type</span> = <span className="font-mono">application/json</span></li>
              <li>ヘッダー: <span className="font-mono">X-User-Email-Hash</span> = 上の「①」をペースト</li>
              <li>本文を要求: <span className="font-mono">JSON</span>、3 で作ったテキストを渡す</li>
            </ul>
          </li>
          <li>
            ショートカットの「⋯」→「オートメーション」で「毎朝 6:30 に実行」を設定。{' '}
            <span className="opacity-60 text-xs">(時刻はお好みで)</span>
          </li>
        </ol>
      </section>

      {/* Step 3: 接続確認 (curl) */}
      <section className="space-y-2">
        <div className="text-sm font-semibold">④ Mac で接続確認したい場合 (任意)</div>
        <p className="text-xs opacity-70">
          ターミナルに貼り付けて実行すると、ダミーの 1 日分が登録されます。ダッシュボードの「今日のカラダ」に反映されます。
        </p>
        <CodeBlock value={curlSample}>{curlSample}</CodeBlock>
      </section>

      {/* fine print */}
      <footer className="text-xs opacity-60 leading-relaxed pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        プライバシー: あなたの体のデータはこのデバイスとサーバーの間でだけやり取りされ、上の「合言葉」を知っている人しか取り出せません。第三者には公開されません。
      </footer>
    </motion.div>
  );
}
