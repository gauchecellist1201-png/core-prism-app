import { Printer, FileText } from 'lucide-react';
import { PRISM } from '../prism/MockShell';
import type { DailyHealth, MedicalProfile } from '../../types/health';

interface Props {
  days: DailyHealth[];
  profile: MedicalProfile;
  userName: string;
}

/**
 * 医師受診向けの 1 枚サマリ PDF。
 * ブラウザのプリント機能 → PDF 保存で利用。
 * 印刷時に背景・色も保持されるよう CSS を仕込む。
 */
export function HealthReportPrint({ days, profile, userName }: Props) {
  const lookback = days.slice(-30);
  const avg = (k: keyof DailyHealth) =>
    lookback.reduce((s, d) => s + Number(d[k] ?? 0), 0) / Math.max(1, lookback.length);
  const min = (k: keyof DailyHealth) => Math.min(...lookback.map((d) => Number(d[k] ?? 0)));
  const max = (k: keyof DailyHealth) => Math.max(...lookback.map((d) => Number(d[k] ?? 0)));

  const handlePrint = () => window.print();

  return (
    <div className="glass rounded-2xl p-4">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #phr-print, #phr-print * { visibility: visible; }
          #phr-print {
            position: absolute; top: 0; left: 0;
            width: 100%; padding: 24px;
            background: white !important;
            color: #111 !important;
          }
          #phr-print .ink { color: #111 !important; }
          #phr-print .muted { color: #555 !important; }
          #phr-print .border { border-color: #ddd !important; }
          #phr-print .bg-card { background: #f8f8f5 !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" style={{ color: PRISM.empathy }} />
          <span className="text-[12px] tracking-[0.4em] text-fg-muted">CHECKUP REPORT · 医師受診サマリ</span>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium"
          style={{ background: PRISM.empathy, color: '#0A0A0A' }}
        >
          <Printer className="h-3 w-3" /> 印刷 / PDF 保存
        </button>
      </div>

      {/* 印刷対象 */}
      <div id="phr-print" className="no-print-bg mt-4 rounded-xl border border-white/8 bg-surface-2 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[18px] font-semibold ink">CORE PRISM OS · PHR Summary</div>
            <div className="text-[12px] muted">医療従事者向け受診サマリ</div>
          </div>
          <div className="text-right text-[12px] muted">
            <div>発行: {new Date().toLocaleDateString('ja-JP')}</div>
            <div>対象期間: 直近 {lookback.length} 日</div>
          </div>
        </div>

        <hr className="my-3 border-white/10 border" />

        {/* 患者情報 */}
        <Section title="患者情報">
          <div className="grid grid-cols-4 gap-2 text-[13px]">
            <KV label="氏名" value={userName || '—'} />
            <KV label="生年" value={profile.birthYear ? `${profile.birthYear}年` : '—'} />
            <KV label="性別" value={profile.sex ?? '—'} />
            <KV
              label="血液型"
              value={profile.bloodType ? `${profile.bloodType}${profile.rhFactor ?? ''}` : '—'}
            />
            <KV label="身長" value={profile.heightCm ? `${profile.heightCm} cm` : '—'} />
          </div>
        </Section>

        <Section title="既往歴">
          {profile.conditions.length === 0 ? (
            <p className="text-[13px] muted">特記事項なし</p>
          ) : (
            <ul className="text-[13px]">
              {profile.conditions.map((c) => (
                <li key={c.id} className="ink">
                  ・ {c.name}{c.diagnosedYear ? ` (${c.diagnosedYear}年〜)` : ''} — {labelStatus(c.status)}{c.notes ? ` / ${c.notes}` : ''}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="服用中の薬">
          {profile.medications.length === 0 ? (
            <p className="text-[13px] muted">なし</p>
          ) : (
            <ul className="text-[13px]">
              {profile.medications.map((m) => (
                <li key={m.id} className="ink">
                  ・ {m.name} {m.dose} ({m.frequency}){m.prescribedBy ? ` / 処方: ${m.prescribedBy}` : ''}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="アレルギー">
          {profile.allergies.length === 0 ? (
            <p className="text-[13px] muted">なし</p>
          ) : (
            <ul className="text-[13px]">
              {profile.allergies.map((a) => (
                <li key={a.id} className="ink">
                  ・ {a.substance} → {a.reaction} ({labelSeverity(a.severity)})
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="家族歴">
          {profile.familyHistory.length === 0 ? (
            <p className="text-[13px] muted">特記事項なし</p>
          ) : (
            <ul className="text-[13px]">
              {profile.familyHistory.map((f) => (
                <li key={f.id} className="ink">
                  ・ {f.relation} → {f.condition}{f.ageOfOnset ? ` (${f.ageOfOnset}歳発症)` : ''}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <hr className="my-3 border-white/10 border" />

        {/* PHR バイタル統計 */}
        <Section title={`PHR バイタル統計 (直近 ${lookback.length} 日)`}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="muted">
                <th className="text-left">項目</th>
                <th className="text-right">平均</th>
                <th className="text-right">最小</th>
                <th className="text-right">最大</th>
                <th className="text-right">参照値</th>
              </tr>
            </thead>
            <tbody className="ink">
              <Tr name="睡眠時間 (h)" mean={avg('sleepHours').toFixed(1)} min={min('sleepHours').toFixed(1)} max={max('sleepHours').toFixed(1)} ref="7.0–9.0" />
              <Tr name="深睡眠 (分)" mean={avg('deepSleepMin').toFixed(0)} min={min('deepSleepMin').toFixed(0)} max={max('deepSleepMin').toFixed(0)} ref="60–120" />
              <Tr name="HRV SDNN (ms)" mean={avg('hrv').toFixed(0)} min={min('hrv').toFixed(0)} max={max('hrv').toFixed(0)} ref="40–80" />
              <Tr name="安静時心拍 (bpm)" mean={avg('restingHR').toFixed(0)} min={min('restingHR').toFixed(0)} max={max('restingHR').toFixed(0)} ref="55–70" />
              <Tr name="歩数 (歩/日)" mean={avg('steps').toFixed(0)} min={min('steps').toFixed(0)} max={max('steps').toFixed(0)} ref="≥ 8,000" />
              <Tr name="運動時間 (分)" mean={avg('activeMinutes').toFixed(0)} min={min('activeMinutes').toFixed(0)} max={max('activeMinutes').toFixed(0)} ref="≥ 30" />
              <Tr name="ストレス指数 (0–100)" mean={avg('stressLevel').toFixed(0)} min={min('stressLevel').toFixed(0)} max={max('stressLevel').toFixed(0)} ref="≤ 50" />
              <Tr name="マインドフル (分)" mean={avg('mindfulMinutes').toFixed(0)} min={min('mindfulMinutes').toFixed(0)} max={max('mindfulMinutes').toFixed(0)} ref="—" />
              <Tr name="水分 (L)" mean={avg('hydrationL').toFixed(1)} min={min('hydrationL').toFixed(1)} max={max('hydrationL').toFixed(1)} ref="2.0–2.5" />
              <Tr name="カフェイン (mg)" mean={avg('caffeineMg').toFixed(0)} min={min('caffeineMg').toFixed(0)} max={max('caffeineMg').toFixed(0)} ref="≤ 400" />
              <Tr name="アルコール (杯/日)" mean={avg('alcoholDrinks').toFixed(1)} min={min('alcoholDrinks').toFixed(0)} max={max('alcoholDrinks').toFixed(0)} ref="≤ 1" />
            </tbody>
          </table>
        </Section>

        {/* 異常検知サマリ */}
        <Section title="主訴 / 気になる傾向">
          <ul className="text-[13px] ink">
            {avg('sleepHours') < 7 && <li>・ 平均睡眠 {avg('sleepHours').toFixed(1)}h と短く、慢性睡眠負債の可能性</li>}
            {avg('hrv') < 50 && <li>・ HRV 平均 {avg('hrv').toFixed(0)}ms。自律神経の回復力低下の傾向</li>}
            {avg('restingHR') > 65 && <li>・ 安静時心拍 平均 {avg('restingHR').toFixed(0)}bpm と高め</li>}
            {avg('stressLevel') > 60 && <li>・ ストレス指数 {avg('stressLevel').toFixed(0)} 持続的な交感神経優位</li>}
            {avg('alcoholDrinks') * 7 >= 14 && <li>・ 週間アルコール {(avg('alcoholDrinks') * 7).toFixed(0)} 杯と推奨上限超過</li>}
            {avg('steps') < 6000 && <li>・ 平均歩数 {avg('steps').toFixed(0)} 歩 — 運動不足傾向</li>}
            {[avg('sleepHours') < 7, avg('hrv') < 50, avg('restingHR') > 65, avg('stressLevel') > 60].every((f) => !f) && (
              <li className="muted">・ 顕著な逸脱なし</li>
            )}
          </ul>
        </Section>

        <p className="mt-4 text-[11px] muted leading-relaxed">
          ※ 本書は CORE PRISM OS が PHR データから自動生成した参考情報です。診断・治療方針は医療従事者の判断に委ねます。
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="text-[12px] tracking-[0.3em] muted">{title}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] muted">{label}</div>
      <div className="text-[14px] ink">{value}</div>
    </div>
  );
}

function Tr({ name, mean, min, max, ref }: { name: string; mean: string; min: string; max: string; ref: string }) {
  return (
    <tr className="border-t border">
      <td className="py-1">{name}</td>
      <td className="py-1 text-right font-mono">{mean}</td>
      <td className="py-1 text-right font-mono">{min}</td>
      <td className="py-1 text-right font-mono">{max}</td>
      <td className="py-1 text-right muted">{ref}</td>
    </tr>
  );
}

function labelStatus(s: 'active' | 'remission' | 'resolved') {
  return s === 'active' ? '進行中' : s === 'remission' ? '寛解' : '完治';
}
function labelSeverity(s: 'mild' | 'moderate' | 'severe') {
  return s === 'severe' ? '重度' : s === 'moderate' ? '中等度' : '軽度';
}
