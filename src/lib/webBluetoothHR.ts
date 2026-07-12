// ============================================================
// Web Bluetooth ライブ心拍計接続 (Polar H10, Wahoo Tickr, etc.)
// ============================================================
// 標準 GATT サービス: 0x180D (Heart Rate)
//   キャラクタリスティック:
//     0x2A37 (Heart Rate Measurement) - notify
//     0x2A38 (Body Sensor Location)   - read
// バッテリー: 0x180F (Battery Service)
//   キャラクタリスティック: 0x2A19 (Battery Level) - read

const HR_SERVICE = 'heart_rate';
const HR_MEASUREMENT = 'heart_rate_measurement';
const BODY_LOCATION = 'body_sensor_location';
const BATTERY_SERVICE = 'battery_service';
const BATTERY_LEVEL = 'battery_level';

export interface HRReading {
  bpm: number;
  rrIntervals: number[]; // ms (HRV算出用)
  energyExpended?: number; // kJ
  contact?: boolean;       // 装着中か
  timestamp: number;       // unix ms
}

export interface BleDeviceInfo {
  id: string;
  name: string;
  bodyLocation?: string;   // chest / wrist / finger / hand / earlobe / foot
  batteryLevel?: number;   // 0-100
}

export type HRListener = (r: HRReading) => void;
export type StatusListener = (state: 'idle' | 'pairing' | 'connected' | 'reconnecting' | 'disconnected' | 'error', detail?: string) => void;

const BODY_LOCATIONS = ['不明', '胸部', '手首', '指先', '手', '耳たぶ', '足'];

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/** 1 回の計測セッションの要約 (ingest 保存や医療記録に使う) */
export interface HRSessionSummary {
  avgBpm: number;
  minBpm: number;       // 安静時心拍の近似 (装着中の安定した最小値)
  maxBpm: number;
  restingBpm: number;   // 下位25%の平均 = 安静時心拍のより頑健な推定
  hrvRmssd: number;     // ms
  energyKj: number;     // デバイスが返した累積消費エネルギー
  sampleCount: number;
  durationSec: number;
}

export class HeartRateMonitor {
  private device: any = null;
  private server: any = null;
  private hrChar: any = null;
  private listeners: Set<HRListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  public info: BleDeviceInfo | null = null;
  private rrBuffer: number[] = [];
  // ── セッション集計 (保存・医療記録用) ──
  private bpmSamples: number[] = [];
  private startedAt = 0;
  private lastEnergy = 0;
  // ── 自動再接続 ──
  private intentionalDisconnect = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly MAX_RECONNECT = 6;

  onReading(fn: HRListener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  onStatus(fn: StatusListener) {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }
  private emitStatus(s: Parameters<StatusListener>[0], detail?: string) {
    this.statusListeners.forEach(l => l(s, detail));
  }

  async pair(): Promise<BleDeviceInfo> {
    if (!isWebBluetoothSupported()) {
      throw new Error('お使いのブラウザは Web Bluetooth に対応していません。Chrome / Edge / Brave をご利用ください。');
    }
    this.emitStatus('pairing');
    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [{ services: [HR_SERVICE] }],
      optionalServices: [BATTERY_SERVICE],
    });
    if (!device) throw new Error('デバイス未選択');
    this.device = device;
    this.intentionalDisconnect = false;
    device.addEventListener('gattserverdisconnected', this.handleDisconnect);

    await this.openGatt(device);
    this.startedAt = this.startedAt || Date.now();
    this.emitStatus('connected', this.info?.name);
    return this.info!;
  }

  /** GATT を開いて notify を張る (初回接続・再接続で共用) */
  private async openGatt(device: any): Promise<void> {
    const server = await device.gatt.connect();
    this.server = server;

    const hrSvc = await server.getPrimaryService(HR_SERVICE);
    this.hrChar = await hrSvc.getCharacteristic(HR_MEASUREMENT);

    let bodyLocation: string | undefined;
    try {
      const locChar = await hrSvc.getCharacteristic(BODY_LOCATION);
      const locVal = await locChar.readValue();
      const idx = locVal.getUint8(0);
      bodyLocation = BODY_LOCATIONS[idx] ?? '不明';
    } catch { /* オプショナル */ }

    let batteryLevel: number | undefined;
    try {
      const batSvc = await server.getPrimaryService(BATTERY_SERVICE);
      const batChar = await batSvc.getCharacteristic(BATTERY_LEVEL);
      const batVal = await batChar.readValue();
      batteryLevel = batVal.getUint8(0);
    } catch { /* オプショナル */ }

    this.info = {
      id: device.id,
      name: device.name || '心拍計',
      bodyLocation: bodyLocation ?? this.info?.bodyLocation,
      batteryLevel: batteryLevel ?? this.info?.batteryLevel,
    };

    await this.hrChar.startNotifications();
    this.hrChar.addEventListener('characteristicvaluechanged', this.handleNotification);
  }

  private handleNotification = (event: Event) => {
    const target = event.target as any;
    const dv = target.value as DataView;
    const reading = parseHRMeasurement(dv);
    if (!reading) return;
    if (reading.rrIntervals.length > 0) {
      this.rrBuffer.push(...reading.rrIntervals);
      if (this.rrBuffer.length > 600) this.rrBuffer = this.rrBuffer.slice(-300);
    }
    // 装着中(または装着状態不明)の妥当な心拍のみ集計に加える
    if (reading.bpm >= 30 && reading.bpm <= 240 && reading.contact !== false) {
      this.bpmSamples.push(reading.bpm);
      if (this.bpmSamples.length > 5000) this.bpmSamples = this.bpmSamples.slice(-3000);
    }
    if (typeof reading.energyExpended === 'number') this.lastEnergy = reading.energyExpended;
    this.listeners.forEach(l => l(reading));
  };

  // gattserverdisconnected ハンドラ。意図的でない切断なら自動再接続を試みる。
  private handleDisconnect = () => {
    if (this.intentionalDisconnect) { this.emitStatus('disconnected'); return; }
    this.hrChar = null;
    this.server = null;
    if (this.reconnectAttempts >= this.MAX_RECONNECT) {
      this.emitStatus('disconnected', '再接続できませんでした。装着とデバイスの電源をご確認ください。');
      return;
    }
    const attempt = ++this.reconnectAttempts;
    const wait = Math.min(8000, 800 * Math.pow(2, attempt - 1)); // 0.8s→1.6→3.2→…上限8s
    this.emitStatus('reconnecting', `再接続中… (${attempt}/${this.MAX_RECONNECT})`);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(async () => {
      if (this.intentionalDisconnect || !this.device) return;
      try {
        await this.openGatt(this.device);
        this.reconnectAttempts = 0;
        this.emitStatus('connected', this.info?.name);
      } catch {
        this.handleDisconnect(); // 次のバックオフへ
      }
    }, wait);
  };

  async disconnect() {
    this.intentionalDisconnect = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    try {
      if (this.hrChar) {
        await this.hrChar.stopNotifications();
        this.hrChar.removeEventListener('characteristicvaluechanged', this.handleNotification);
      }
      if (this.device) this.device.removeEventListener('gattserverdisconnected', this.handleDisconnect);
      if (this.server?.connected) this.server.disconnect();
    } catch { /* ignore */ }
    this.server = null;
    this.hrChar = null;
    this.device = null;
    this.info = null;
    this.emitStatus('disconnected');
  }

  /** RR 間隔から RMSSD ベースの HRV を算出 */
  computeHRV(): number {
    if (this.rrBuffer.length < 2) return 0;
    let sumSq = 0;
    for (let i = 1; i < this.rrBuffer.length; i++) {
      const d = this.rrBuffer[i] - this.rrBuffer[i - 1];
      sumSq += d * d;
    }
    return Math.sqrt(sumSq / (this.rrBuffer.length - 1));
  }

  /** この計測セッションの要約 (保存・医療記録用)。まだ十分なサンプルが無ければ null。 */
  sessionSummary(): HRSessionSummary | null {
    const s = this.bpmSamples;
    if (s.length < 5) return null;
    const sorted = [...s].sort((a, b) => a - b);
    const sum = s.reduce((a, b) => a + b, 0);
    const q = Math.max(1, Math.floor(sorted.length * 0.25));
    const restingBpm = Math.round(sorted.slice(0, q).reduce((a, b) => a + b, 0) / q);
    return {
      avgBpm: Math.round(sum / s.length),
      minBpm: sorted[0],
      maxBpm: sorted[sorted.length - 1],
      restingBpm,
      hrvRmssd: Math.round(this.computeHRV()),
      energyKj: Math.round(this.lastEnergy),
      sampleCount: s.length,
      durationSec: this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : 0,
    };
  }
}

// 0x2A37 Heart Rate Measurement のバイナリパース
//   フラグバイトの構造:
//     bit 0: HR Value Format (0=uint8, 1=uint16)
//     bit 1-2: Sensor Contact (00/01=未対応, 10=非接触, 11=接触)
//     bit 3: Energy Expended Status
//     bit 4: RR-Interval present
function parseHRMeasurement(dv: DataView): HRReading | null {
  if (dv.byteLength < 2) return null;
  const flags = dv.getUint8(0);
  const is16 = (flags & 0x01) !== 0;
  const contactSupported = (flags & 0x04) !== 0;
  const contact = contactSupported ? (flags & 0x02) !== 0 : undefined;
  const hasEnergy = (flags & 0x08) !== 0;
  const hasRR = (flags & 0x10) !== 0;

  let offset = 1;
  let bpm: number;
  if (is16) {
    bpm = dv.getUint16(offset, true);
    offset += 2;
  } else {
    bpm = dv.getUint8(offset);
    offset += 1;
  }

  let energyExpended: number | undefined;
  if (hasEnergy && offset + 2 <= dv.byteLength) {
    energyExpended = dv.getUint16(offset, true);
    offset += 2;
  }

  const rrIntervals: number[] = [];
  if (hasRR) {
    while (offset + 2 <= dv.byteLength) {
      const rrRaw = dv.getUint16(offset, true);
      rrIntervals.push((rrRaw / 1024) * 1000); // 1/1024s 単位 → ms
      offset += 2;
    }
  }

  return {
    bpm,
    rrIntervals,
    energyExpended,
    contact,
    timestamp: Date.now(),
  };
}
