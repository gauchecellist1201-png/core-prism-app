import { useRef, useState } from 'react';
import { Upload, CheckCircle2, AlertTriangle, FileText, Loader2, Sparkles, FileSpreadsheet } from 'lucide-react';
import { PRISM, Pill } from '../prism/MockShell';
import { importAppleHealthXml, importAppleHealthZip, type AppleImportProgress } from '../../data/appleHealthImport';
import { generateMockHealth } from '../../data/mockHealth';
import { parseHealthCsv } from '../../data/healthCsvImport';
import type { useHealth } from '../../hooks/useHealth';

interface Props {
  health: ReturnType<typeof useHealth>;
}

export function AppleHealthImport({ health }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<AppleImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedDays, setCompletedDays] = useState<number | null>(null);
  // 何日ぶんが「いつからいつまで」入ったのか。3 か月前の書き出しでも、
  // 入った期間をそのまま出せば「今日のぶんが無い」理由が本人の目で分かる。
  const [importedRange, setImportedRange] = useState<{ from: string; to: string } | null>(null);
  const [draggingOver, setDraggingOver] = useState(false);

  const handleFile = async (file: File) => {
    setError(null);
    setCompletedDays(null);
    setProgress({ phase: 'parsing', recordsRead: 0, daysProduced: 0, message: '読み込み中...' });

    try {
      let days;
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.zip')) {
        // ZIP を直接受け付け、中の export.xml を解凍してパース
        days = await importAppleHealthZip(file, (p) => setProgress(p));
      } else if (lower.endsWith('.xml')) {
        const text = await file.text();
        days = await importAppleHealthXml(text, (p) => setProgress(p));
      } else if (lower.endsWith('.csv')) {
        // 簡易 CSV (1 行 = 1 日)
        setProgress({ phase: 'aggregating', recordsRead: 0, daysProduced: 0, message: 'CSV を解析中...' });
        const text = await file.text();
        const r = parseHealthCsv(text);
        if (r.warnings.length && r.days.length === 0) {
          setError(r.warnings.join(' / '));
          setProgress(null);
          return;
        }
        if (r.unknownColumns.length > 0) {
          // 警告として表示 (失敗扱いはしない)
          setError(`未認識の列: ${r.unknownColumns.slice(0, 4).join(', ')}${r.unknownColumns.length > 4 ? ' …' : ''} (それ以外は取込みました)`);
        }
        days = r.days;
      } else {
        setError('export.zip / export.xml / CSV のいずれかを選んでください。');
        setProgress(null);
        return;
      }

      // 0 日を「インポート完了」と言わない。増えていないのに緑のチェックを出すと、
      // 本人は「取り込めた」と思ったまま、いつまでも空のグラフを見ることになる。
      if (days.length === 0) {
        setError('このファイルからは 1 日分も取り込めませんでした。ファイルを選び直すか、下の「サンプルデータで試す」で画面の動きを確認してください。');
        setProgress(null);
        return;
      }

      health.mergeDays(days);
      health.markAppleHealthImported(days.length);
      setCompletedDays(days.length);
      setImportedRange({ from: days[0].date, to: days[days.length - 1].date });
      setProgress({ phase: 'done', recordsRead: progress?.recordsRead ?? 0, daysProduced: days.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'インポート失敗');
      setProgress(null);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const handleSampleData = async () => {
    setError(null);
    setProgress({ phase: 'parsing', recordsRead: 0, daysProduced: 0, message: 'サンプル PHR を生成中...' });
    try {
      const days = generateMockHealth(30);
      health.mergeDays(days);
      health.markAppleHealthImported(days.length);
      setCompletedDays(days.length);
      setProgress({ phase: 'done', recordsRead: days.length * 60, daysProduced: days.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'サンプル生成に失敗');
      setProgress(null);
    }
  };

  const isParsing = progress && progress.phase !== 'done' && progress.phase !== 'error';

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="text-[12px] tracking-[0.4em] text-fg-muted">健康データ取込</div>
        <Pill color={PRISM.empathy}>.zip / .xml / .csv</Pill>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
          onDragLeave={() => setDraggingOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 transition ${
            draggingOver
              ? 'border-pink-300/60 bg-pink-500/10'
              : 'border-white/10 bg-black/20 hover:bg-white/3'
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xml,.zip,.csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          {isParsing ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-pink-300" />
              <div className="mt-3 text-[14px] text-fg">{phaseLabel(progress!.phase)}</div>
              <div className="mt-1 font-mono text-[13px] text-fg-subtle">
                {progress!.recordsRead.toLocaleString()} records · {progress!.daysProduced} 日分
              </div>
              {/* フェーズバー */}
              <div className="mt-3 w-full max-w-[260px]">
                <div className="flex justify-between text-[10px] tracking-[0.2em] text-fg-subtle">
                  <span style={{ opacity: phaseStep(progress!.phase) >= 1 ? 1 : 0.35 }}>UNZIP</span>
                  <span style={{ opacity: phaseStep(progress!.phase) >= 2 ? 1 : 0.35 }}>PARSE</span>
                  <span style={{ opacity: phaseStep(progress!.phase) >= 3 ? 1 : 0.35 }}>AGGREGATE</span>
                  <span style={{ opacity: phaseStep(progress!.phase) >= 4 ? 1 : 0.35 }}>MERGE</span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full transition-[width] duration-500"
                    style={{
                      width: `${(phaseStep(progress!.phase) / 4) * 100}%`,
                      background: 'linear-gradient(90deg, #ec4899, #a78bfa)',
                    }}
                  />
                </div>
              </div>
            </>
          ) : completedDays !== null ? (
            <>
              <CheckCircle2 className="h-7 w-7" style={{ color: PRISM.ethics }} />
              <div className="mt-3 text-[14px] font-medium text-fg">
                インポート完了 · {completedDays} 日分の PHR を追加
              </div>
              {/* text-fg-subtle は Iris の明るい画面では 2.43:1 で読めなかった。
                  「いつからいつまで入ったか」は、今日のぶんが無い理由そのものなので必ず読める濃さで。 */}
              <div className="mt-1 text-[12.5px] text-fg">
                {importedRange
                  ? `${importedRange.from} 〜 ${importedRange.to} のぶんを、既存データとマージしました`
                  : '既存データとマージしました'}
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setCompletedDays(null); setImportedRange(null); setProgress(null); }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[13px] text-fg hover:bg-white/10"
                style={{ minHeight: 44 }}
              >
                もう一度取込む
              </button>
            </>
          ) : (
            <>
              <Upload className="h-6 w-6 text-fg-muted" />
              <div className="mt-3 text-[14px] text-fg">
                <span className="text-fg">export.zip</span> / <span className="text-fg">.xml</span> / <span className="text-fg">.csv</span> をドロップ
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[13px] text-fg-subtle">
                <FileSpreadsheet className="h-3 w-3" /> 自分の表計算 CSV も OK · 解凍不要
              </div>
            </>
          )}
        </div>

        {/* Instructions */}
        <div className="rounded-xl border border-white/8 bg-surface-2 p-3">
          <div className="text-[11px] tracking-[0.3em] text-fg-subtle">取得方法</div>
          <ol className="mt-2 flex flex-col gap-1 text-[14px] leading-relaxed text-fg-muted">
            <li>1. iPhone「ヘルスケア」アプリ</li>
            <li>2. 右上のプロフィール → <span className="text-fg">すべてのヘルスケアデータを書き出す</span></li>
            <li>3. 出力された <span className="text-fg">.zip</span> をそのままここにドロップ</li>
            <li>4. ブラウザ内で自動展開・解析されます</li>
          </ol>
          <div className="mt-3 rounded-md border border-emerald-300/15 bg-emerald-300/5 px-2 py-1.5 text-[12px] leading-relaxed text-emerald-200/85">
            <FileSpreadsheet className="mr-1 inline h-3 w-3" />
            CSV も OK: 1 行目に <code className="rounded bg-black/30 px-1">date</code>, <code className="rounded bg-black/30 px-1">sleepHours</code>, <code className="rounded bg-black/30 px-1">steps</code>, <code className="rounded bg-black/30 px-1">restingHR</code> など (日本語ヘッダ・Apple Health → CSV 書出しも対応)。
          </div>
          <div className="mt-2 rounded-md bg-amber-300/5 px-2 py-1.5 text-[12px] leading-relaxed text-amber-200/80">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            ファイルはブラウザ内のみで処理。サーバーへ送信しません。
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleSampleData(); }}
            disabled={!!isParsing}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2.5 text-[13px] font-medium text-fg hover:bg-white/10 disabled:opacity-60"
            style={{ minHeight: 44 }}
          >
            <Sparkles className="h-3 w-3" style={{ color: PRISM.creative }} />
            サンプルデータで試す (30 日分)
          </button>
        </div>
      </div>

      {error && (
        /* このカードは Prism (暗い画面) と Iris「カラダ管理」(明るいピンクの画面) の
           両方に出る。text-rose-200 のままだと Iris では 1.21:1 = ほぼ見えない。
           失敗の理由こそ読めないと意味がないので、面と文字を自分で持つ。 */
        <div
          className="mt-3 rounded-md px-3 py-2 text-[13px]"
          style={{ background: '#FFE4E6', color: '#7F1D1D', border: '1px solid #FDA4AF' }}
          role="alert"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
          {/* 失敗したまま行き止まりにしない。ここから直接やり直せる */}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setError(null); fileRef.current?.click(); }}
              className="inline-flex items-center justify-center rounded-full px-4 py-2 text-[13px] font-medium"
              style={{ minHeight: 44, background: '#7F1D1D', color: '#FFF1F2', border: '1px solid #7F1D1D' }}
            >
              もう一度ファイルを選ぶ
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleSampleData(); }}
              disabled={!!isParsing}
              className="inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium disabled:opacity-60"
              style={{ minHeight: 44, background: '#FFF1F2', color: '#7F1D1D', border: '1px solid #FDA4AF' }}
            >
              <Sparkles className="h-3 w-3" style={{ color: PRISM.creative }} />
              サンプルで試す
            </button>
          </div>
        </div>
      )}

      {/* What gets imported */}
      <div className="mt-3 rounded-xl border border-white/5 bg-white/2 p-3">
        <div className="text-[11px] tracking-[0.3em] text-fg-subtle">対応メトリクス</div>
        <div className="mt-2 flex flex-wrap gap-1">
          {METRICS.map((m) => (
            <span
              key={m}
              className="rounded-full bg-surface-3 px-2 py-0.5 text-[12px] text-fg-muted"
            >
              <FileText className="mr-1 inline h-2.5 w-2.5" />
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const METRICS = [
  '睡眠 (Core/Deep/REM)',
  '歩数',
  '心拍 / 安静時心拍',
  'HRV (SDNN)',
  '活動エネルギー',
  '運動時間',
  '体重・体脂肪率',
  '血圧',
  '血糖',
  'カフェイン',
  '水分摂取',
  'マインドフル時間',
];

function phaseLabel(p: AppleImportProgress['phase']): string {
  switch (p) {
    case 'parsing':     return 'XML を解析中...';
    case 'aggregating': return '日次集計中...';
    case 'merging':     return '既存データにマージ中...';
    case 'done':        return '完了';
    case 'error':       return 'エラー';
  }
}

function phaseStep(p: AppleImportProgress['phase']): number {
  switch (p) {
    case 'parsing':     return 2;  // ZIP は parser 側で解凍済 / XML パース中
    case 'aggregating': return 3;
    case 'merging':     return 4;
    case 'done':        return 4;
    default:            return 1;
  }
}
