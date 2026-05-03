import { motion } from 'framer-motion';
import { RefreshCw, Check, Plug, Loader2 } from 'lucide-react';
import { PRISM, Pill } from '../prism/MockShell';
import { AppleHealthImport } from './AppleHealthImport';
import type { useHealth } from '../../hooks/useHealth';
import type { HealthSource } from '../../types/health';

interface Props {
  health: ReturnType<typeof useHealth>;
}

const SOURCE_META: Record<HealthSource['id'], { color: string; icon: string; tag: string }> = {
  'apple-health': { color: PRISM.empathy,  icon: '', tag: 'iOS' },
  'oura':         { color: PRISM.creative, icon: '○', tag: 'Wearable' },
  'whoop':        { color: PRISM.action,   icon: '◇', tag: 'Wearable' },
  'garmin':       { color: PRISM.logic,    icon: '⌚', tag: 'Watch' },
  'fitbit':       { color: PRISM.ethics,   icon: '⚡', tag: 'Wearable' },
  'manual':       { color: '#9C9C9C',      icon: '✍', tag: '手動' },
};

export function HealthSourcesView({ health }: Props) {
  const totalRecords = health.sources.reduce((s, x) => s + x.recordsImported, 0);
  const connectedCount = health.sources.filter((s) => s.status === 'connected').length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="glass rounded-2xl p-4">
          <div className="text-[11px] tracking-[0.3em] text-fg-subtle">CONNECTED</div>
          <div className="mt-2 font-mono text-2xl font-light text-fg">{connectedCount}</div>
          <div className="mt-1 text-[12px] text-fg-subtle">/ {health.sources.length} sources</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-[11px] tracking-[0.3em] text-fg-subtle">RECORDS IMPORTED</div>
          <div className="mt-2 font-mono text-2xl font-light text-fg">{totalRecords.toLocaleString()}</div>
          <div className="mt-1 text-[12px] text-fg-subtle">過去30日内</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-[11px] tracking-[0.3em] text-fg-subtle">PHR DAYS</div>
          <div className="mt-2 font-mono text-2xl font-light text-fg">{health.days.length}</div>
          <div className="mt-1 text-[12px] text-fg-subtle">日 蓄積中</div>
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="text-[12px] tracking-[0.4em] text-fg-muted">PHR SOURCES</div>

        <div className="mt-3 grid grid-cols-1 gap-2">
          {health.sources.map((s) => {
            const meta = SOURCE_META[s.id];
            const isSyncing = s.status === 'syncing';
            const isConnected = s.status === 'connected';
            return (
              <motion.div
                key={s.id}
                layout
                className="grid grid-cols-[44px_1fr_auto_auto] items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5"
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-[14px]"
                  style={{ background: `${meta.color}1A`, border: `1px solid ${meta.color}55`, color: meta.color }}
                >
                  {meta.icon || s.name.slice(0, 1)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] text-fg">{s.name}</span>
                    <Pill color={meta.color}>{meta.tag}</Pill>
                  </div>
                  <div className="mt-0.5 text-[12px] text-fg-subtle">
                    {isConnected && s.lastSync && `最終同期: ${formatRelative(s.lastSync)} · ${s.recordsImported.toLocaleString()} records`}
                    {!isConnected && '未接続'}
                    {isSyncing && '同期中…'}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {isConnected && (
                    <Pill color={PRISM.ethics}>
                      <Check className="mr-1 h-2.5 w-2.5" /> 接続済
                    </Pill>
                  )}
                  {isSyncing && (
                    <Pill color={PRISM.action}>
                      <Loader2 className="mr-1 h-2.5 w-2.5 animate-spin" /> 同期中
                    </Pill>
                  )}
                  {!isConnected && !isSyncing && (
                    <Pill color="#9C9C9C">
                      <Plug className="mr-1 h-2.5 w-2.5" /> 未接続
                    </Pill>
                  )}
                </div>

                <button
                  disabled={isSyncing}
                  onClick={() => isConnected ? health.triggerSync(s.id) : health.toggleConnection(s.id)}
                  className="flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] disabled:opacity-40"
                  style={{ background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}40` }}
                >
                  {isConnected ? (
                    <>
                      <RefreshCw className="h-3 w-3" /> 同期
                    </>
                  ) : isSyncing ? '...' : '接続'}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      <AppleHealthImport health={health} />

      <div className="glass rounded-2xl p-4">
        <div className="text-[12px] tracking-[0.4em] text-fg-muted">DATA UTILIZATION</div>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
          PHRデータは <span className="text-fg">あなたのデバイス内のみ</span> に保存され、AI解析時のみ Claude API に送信されます。
          外部サーバーへ常時アップロードしません。
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Pill color={PRISM.ethics}><Check className="mr-1 h-2.5 w-2.5" /> Local-first</Pill>
          <Pill color={PRISM.logic}><Check className="mr-1 h-2.5 w-2.5" /> E2E AI解析</Pill>
          <Pill color={PRISM.creative}><Check className="mr-1 h-2.5 w-2.5" /> 任意でエクスポート</Pill>
        </div>
      </div>
    </div>
  );
}

function formatRelative(iso: string) {
  const t = new Date(iso).getTime();
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return 'たった今';
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  return `${Math.floor(diff / 86400)}日前`;
}
