import { useState } from 'react';
import { Plus, Trash2, Heart, Pill as PillIcon, AlertCircle, Users, Syringe } from 'lucide-react';
import { PRISM, Pill as PillBadge } from '../prism/MockShell';
import type { useMedicalHistory } from '../../hooks/useMedicalHistory';
import { DrugInteractionPanel } from './DrugInteractionPanel';
import { HealthReportPrint } from './HealthReportPrint';
import type { useHealth } from '../../hooks/useHealth';

interface Props {
  med: ReturnType<typeof useMedicalHistory>;
  health?: ReturnType<typeof useHealth>;
  userName?: string;
}

export function HealthHistoryView({ med, health, userName = '' }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <BasicProfileCard med={med} />
      <ConditionsCard med={med} />
      <MedicationsCard med={med} />
      {health && <DrugInteractionPanel health={health} profile={med.profile} />}
      <AllergiesCard med={med} />
      <FamilyCard med={med} />
      <VaccinationsCard med={med} />
      {health && <HealthReportPrint days={health.days} profile={med.profile} userName={userName} />}
    </div>
  );
}

function Section({
  title, icon, color, children,
}: {
  title: string; icon: React.ReactNode; color: string; children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: `${color}1A`, border: `1px solid ${color}40` }}>
          {icon}
        </span>
        <span className="text-[12px] tracking-[0.3em]" style={{ color }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function BasicProfileCard({ med }: Props) {
  const p = med.profile;
  return (
    <Section title="BASIC PROFILE" color={PRISM.logic} icon={<Heart className="h-3 w-3" style={{ color: PRISM.logic }} />}>
      <div className="grid grid-cols-4 gap-2">
        {[
          { k: 'sex' as const, label: '性別', opts: ['男性', '女性', 'その他'] },
          { k: 'bloodType' as const, label: '血液型', opts: ['A', 'B', 'O', 'AB'] },
          { k: 'rhFactor' as const, label: 'Rh', opts: ['+', '-'] },
        ].map((s) => (
          <div key={s.k}>
            <div className="text-[11px] tracking-[0.3em] text-fg-subtle">{s.label}</div>
            <select
              value={(p[s.k] as string) ?? ''}
              onChange={(e) => med.update({ [s.k]: (e.target.value || undefined) as never })}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[14px] text-fg outline-none"
            >
              <option value="">未設定</option>
              {s.opts.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
        <div>
          <div className="text-[11px] tracking-[0.3em] text-fg-subtle">生年</div>
          <input
            type="number"
            value={p.birthYear ?? ''}
            onChange={(e) => med.update({ birthYear: e.target.value ? +e.target.value : undefined })}
            placeholder="1985"
            className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[14px] text-fg outline-none placeholder:text-fg-subtle"
          />
        </div>
        <div>
          <div className="text-[11px] tracking-[0.3em] text-fg-subtle">身長 cm</div>
          <input
            type="number"
            value={p.heightCm ?? ''}
            onChange={(e) => med.update({ heightCm: e.target.value ? +e.target.value : undefined })}
            placeholder="170"
            className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[14px] text-fg outline-none placeholder:text-fg-subtle"
          />
        </div>
      </div>
    </Section>
  );
}

function ConditionsCard({ med }: Props) {
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  return (
    <Section title="CHRONIC CONDITIONS · 既往歴" color={PRISM.empathy} icon={<Heart className="h-3 w-3" style={{ color: PRISM.empathy }} />}>
      <div className="flex flex-col gap-1.5">
        {med.profile.conditions.map((c) => (
          <Row key={c.id} onRemove={() => med.removeCondition(c.id)}>
            <span className="text-fg text-[14px]">{c.name}</span>
            {c.diagnosedYear && <span className="text-[12px] text-fg-subtle">{c.diagnosedYear}年〜</span>}
            <PillBadge color={c.status === 'active' ? '#FF6F6F' : c.status === 'remission' ? PRISM.action : PRISM.ethics}>
              {c.status === 'active' ? '進行中' : c.status === 'remission' ? '寛解' : '完治'}
            </PillBadge>
          </Row>
        ))}
        {med.profile.conditions.length === 0 && <Empty />}
      </div>
      <AddRow placeholder="例: 高血圧、喘息、胃潰瘍">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="疾患名" className={INPUT} />
        <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="診断年" className={`${INPUT} w-20`} />
        <AddBtn
          color={PRISM.empathy}
          onClick={() => {
            if (!name.trim()) return;
            med.addCondition({ name: name.trim(), diagnosedYear: year ? +year : undefined, status: 'active' });
            setName(''); setYear('');
          }}
        />
      </AddRow>
    </Section>
  );
}

function MedicationsCard({ med }: Props) {
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [freq, setFreq] = useState('');
  return (
    <Section title="MEDICATIONS · 服用中の薬" color={PRISM.action} icon={<PillIcon className="h-3 w-3" style={{ color: PRISM.action }} />}>
      <div className="flex flex-col gap-1.5">
        {med.profile.medications.map((m) => (
          <Row key={m.id} onRemove={() => med.removeMedication(m.id)}>
            <span className="text-fg text-[14px]">{m.name}</span>
            <span className="text-[12px] text-fg-muted">{m.dose}</span>
            <span className="text-[12px] text-fg-subtle">{m.frequency}</span>
          </Row>
        ))}
        {med.profile.medications.length === 0 && <Empty />}
      </div>
      <AddRow placeholder="例: アムロジピン 5mg 朝食後">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="薬名" className={INPUT} />
        <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="用量" className={`${INPUT} w-20`} />
        <input value={freq} onChange={(e) => setFreq(e.target.value)} placeholder="頻度" className={`${INPUT} w-32`} />
        <AddBtn
          color={PRISM.action}
          onClick={() => {
            if (!name.trim()) return;
            med.addMedication({ name: name.trim(), dose, frequency: freq });
            setName(''); setDose(''); setFreq('');
          }}
        />
      </AddRow>
    </Section>
  );
}

function AllergiesCard({ med }: Props) {
  const [substance, setSubstance] = useState('');
  const [reaction, setReaction] = useState('');
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('moderate');
  const sevLabel = { mild: '軽度', moderate: '中等度', severe: '重度' };
  return (
    <Section title="ALLERGIES · アレルギー" color={'#FF6F6F'} icon={<AlertCircle className="h-3 w-3" style={{ color: '#FF6F6F' }} />}>
      <div className="flex flex-col gap-1.5">
        {med.profile.allergies.map((a) => (
          <Row key={a.id} onRemove={() => med.removeAllergy(a.id)}>
            <span className="text-fg text-[14px]">{a.substance}</span>
            <span className="text-[12px] text-fg-muted">→ {a.reaction}</span>
            <PillBadge color={a.severity === 'severe' ? '#FF3D5A' : a.severity === 'moderate' ? PRISM.action : PRISM.ethics}>
              {sevLabel[a.severity]}
            </PillBadge>
          </Row>
        ))}
        {med.profile.allergies.length === 0 && <Empty />}
      </div>
      <AddRow placeholder="例: 卵 → 蕁麻疹">
        <input value={substance} onChange={(e) => setSubstance(e.target.value)} placeholder="物質" className={INPUT} />
        <input value={reaction} onChange={(e) => setReaction(e.target.value)} placeholder="反応" className={INPUT} />
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as typeof severity)}
          className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[14px] text-fg outline-none"
        >
          <option value="mild">軽度</option>
          <option value="moderate">中等度</option>
          <option value="severe">重度</option>
        </select>
        <AddBtn
          color="#FF6F6F"
          onClick={() => {
            if (!substance.trim()) return;
            med.addAllergy({ substance: substance.trim(), reaction, severity });
            setSubstance(''); setReaction('');
          }}
        />
      </AddRow>
    </Section>
  );
}

function FamilyCard({ med }: Props) {
  const [relation, setRelation] = useState<'父' | '母' | '兄弟姉妹' | '祖父母' | 'その他'>('父');
  const [condition, setCondition] = useState('');
  const [age, setAge] = useState('');
  return (
    <Section title="FAMILY HISTORY · 家族歴" color={PRISM.creative} icon={<Users className="h-3 w-3" style={{ color: PRISM.creative }} />}>
      <div className="flex flex-col gap-1.5">
        {med.profile.familyHistory.map((f) => (
          <Row key={f.id} onRemove={() => med.removeFamily(f.id)}>
            <PillBadge color={PRISM.creative}>{f.relation}</PillBadge>
            <span className="text-fg text-[14px]">{f.condition}</span>
            {f.ageOfOnset && <span className="text-[12px] text-fg-subtle">{f.ageOfOnset}歳発症</span>}
          </Row>
        ))}
        {med.profile.familyHistory.length === 0 && <Empty />}
      </div>
      <AddRow placeholder="例: 父 → 心筋梗塞 (60歳)">
        <select
          value={relation}
          onChange={(e) => setRelation(e.target.value as typeof relation)}
          className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[14px] text-fg outline-none"
        >
          {['父', '母', '兄弟姉妹', '祖父母', 'その他'].map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <input value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="疾患" className={INPUT} />
        <input value={age} onChange={(e) => setAge(e.target.value)} placeholder="発症年齢" className={`${INPUT} w-24`} />
        <AddBtn
          color={PRISM.creative}
          onClick={() => {
            if (!condition.trim()) return;
            med.addFamily({ relation, condition: condition.trim(), ageOfOnset: age ? +age : undefined });
            setCondition(''); setAge('');
          }}
        />
      </AddRow>
    </Section>
  );
}

function VaccinationsCard({ med }: Props) {
  const [vaccine, setVaccine] = useState('');
  const [date, setDate] = useState('');
  return (
    <Section title="VACCINATIONS · ワクチン履歴" color={PRISM.ethics} icon={<Syringe className="h-3 w-3" style={{ color: PRISM.ethics }} />}>
      <div className="flex flex-col gap-1.5">
        {med.profile.vaccinations.map((v) => (
          <Row key={v.id} onRemove={() => med.removeVaccination(v.id)}>
            <span className="text-fg text-[14px]">{v.vaccine}</span>
            <span className="text-[12px] text-fg-muted">{v.date}</span>
          </Row>
        ))}
        {med.profile.vaccinations.length === 0 && <Empty />}
      </div>
      <AddRow placeholder="例: インフルエンザ 2026-01-15">
        <input value={vaccine} onChange={(e) => setVaccine(e.target.value)} placeholder="ワクチン名" className={INPUT} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${INPUT} w-44`} />
        <AddBtn
          color={PRISM.ethics}
          onClick={() => {
            if (!vaccine.trim() || !date) return;
            med.addVaccination({ vaccine: vaccine.trim(), date });
            setVaccine(''); setDate('');
          }}
        />
      </AddRow>
    </Section>
  );
}

const INPUT =
  'flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[14px] text-fg outline-none placeholder:text-fg-subtle';

function Row({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
      <div className="flex items-center gap-2 flex-wrap">{children}</div>
      <button onClick={onRemove} className="text-fg-subtle hover:text-rose-300">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Empty() {
  return <p className="text-center text-[13px] text-fg-subtle py-2">登録なし</p>;
}

function AddRow({ children, placeholder: _ }: { children: React.ReactNode; placeholder: string }) {
  return <div className="mt-3 flex items-center gap-1.5">{children}</div>;
}

function AddBtn({ color, onClick }: { color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md text-[#0A0A0A]"
      style={{ background: color }}
    >
      <Plus className="h-3.5 w-3.5" />
    </button>
  );
}
