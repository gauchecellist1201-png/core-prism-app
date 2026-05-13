// ============================================================
// Highlight.ts — BGM の音量ピーク検出 (Web Audio API)
//
// アップロード済 BGM File を OfflineAudioContext で解析し、
// 上位 N 個のラウドネスピーク (秒) を返す。
// 自動ハイライト = ピーク時刻にカット点を合わせる
// ============================================================

export interface PeakResult {
  /** ピーク時刻 (秒, 昇順) */
  peaks: number[];
  /** 解析した音源の総秒数 */
  duration: number;
}

/**
 * File を decode し、20ms ホップで RMS を計算、上位 topN のピーク時刻を返す
 * 互いに 0.8 秒以上離れたものだけを採用する
 */
export async function detectAudioPeaks(file: File, topN = 5): Promise<PeakResult> {
  const arrayBuf = await file.arrayBuffer();
  const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
  // OfflineAudioContext で decode (即座に終わる)
  const ac = new AC();
  const audioBuf = await ac.decodeAudioData(arrayBuf.slice(0));
  ac.close();

  const sr = audioBuf.sampleRate;
  const ch = audioBuf.getChannelData(0);
  const hop = Math.floor(sr * 0.02);          // 20ms
  const win = Math.floor(sr * 0.05);          // 50ms 窓
  const frames = Math.floor((ch.length - win) / hop);
  const rms: number[] = new Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    const base = i * hop;
    for (let j = 0; j < win; j++) {
      const v = ch[base + j];
      s += v * v;
    }
    rms[i] = Math.sqrt(s / win);
  }

  // ピーク候補: 前後より大きい局所最大
  const candidates: { t: number; v: number }[] = [];
  for (let i = 2; i < frames - 2; i++) {
    if (rms[i] > rms[i - 1] && rms[i] > rms[i + 1] && rms[i] > rms[i - 2] && rms[i] > rms[i + 2]) {
      candidates.push({ t: (i * hop) / sr, v: rms[i] });
    }
  }
  // 大きい順
  candidates.sort((a, b) => b.v - a.v);
  // 最低距離 0.8s で間引き
  const picked: number[] = [];
  for (const c of candidates) {
    if (picked.length >= topN) break;
    if (picked.every(p => Math.abs(p - c.t) >= 0.8)) {
      picked.push(c.t);
    }
  }
  picked.sort((a, b) => a - b);

  return { peaks: picked, duration: audioBuf.duration };
}
