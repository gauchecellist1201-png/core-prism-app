import { useRef, useState } from 'react';
import { Upload, CheckCircle2, AlertTriangle, FileText, Loader2, Sparkles } from 'lucide-react';
import { PRISM, Pill } from '../prism/MockShell';
import { importAppleHealthXml, importAppleHealthZip, type AppleImportProgress } from '../../data/appleHealthImport';
import { generateMockHealth } from '../../data/mockHealth';
import type { useHealth } from '../../hooks/useHealth';

interface Props {
  health: ReturnType<typeof useHealth>;
}

export function AppleHealthImport({ health }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<AppleImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedDays, setCompletedDays] = useState<number | null>(null);
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
      } else {
        setError('export.zip または export.xml を選択してください。');
        setProgress(null);
        return;
      }

      health.mergeDays(days);
      health.markAppleHealthImported(days.length);
      setCompletedDays(days.length);
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
        <div className="text-[12px] tracking-[0.4em] text-fg-muted">APPLE HEALTH IMPORT</div>
        <Pill color={PRISM.empathy}>export.zip / .xml</Pill>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_220px] gap-3">
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
            accept=".xml,.zip"
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
              <div className="mt-1 text-[12px] text-fg-subtle">既存データとマージしました</div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setCompletedDays(null); setProgress(null); }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] text-fg hover:bg-white/10"
              >
                もう一度取込む
              </button>
            </>
          ) : (
            <>
              <Upload className="h-6 w-6 text-fg-muted" />
              <div className="mt-3 text-[14px] text-fg">
                Apple Health の <span className="text-fg">export.zip</span> をドロップ
              </div>
              <div className="mt-1 text-[13px] text-fg-subtle">解凍不要 · ZIP/XML 両対応</div>
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
          <div className="mt-3 rounded-md bg-amber-300/5 px-2 py-1.5 text-[12px] leading-relaxed text-amber-200/80">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            ファイルはブラウザ内のみで処理。サーバーへ送信しません。
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleSampleData(); }}
            disabled={!!isParsing}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-medium text-fg hover:bg-white/10 disabled:opacity-60"
          >
            <Sparkles className="h-3 w-3" style={{ color: PRISM.creative }} />
            サンプルデータで試す (30 日分)
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
          <span>{error}</span>
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
