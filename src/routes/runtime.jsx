import { createFileRoute } from '@tanstack/react-router';
import { Cpu, HardDrive, MemoryStick, Server, Terminal, Timer } from 'lucide-react';
import SystemStatus from '@/components/SystemStatus';
import { useSystemStatus } from '@/hooks/useSystemStatus';
import { formatBytes, formatUptime } from '@/utils/systemStatus';

export const Route = createFileRoute('/runtime')({
  component: RuntimePage,
  head: () => ({
    meta: [
      { title: 'Status Runtime - Uptime & Node.js | FiveNime' },
      {
        name: 'description',
        content:
          'Detail runtime FiveNime: uptime aplikasi, uptime sistem host, versi Node.js, platform, arsitektur, jumlah core CPU, dan memori terpakai.',
      },
      { property: 'og:title', content: 'Status Runtime FiveNime' },
      {
        property: 'og:description',
        content: 'Uptime aplikasi, versi Node.js, CPU, dan memori server FiveNime.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
});

function RuntimePage() {
  const { metrics, online, persisted } = useSystemStatus();

  const rows = [
    { icon: Timer, label: 'App Uptime', value: formatUptime(metrics?.appUptimeSeconds) },
    {
      icon: HardDrive,
      label: 'OS Uptime',
      value: metrics?.osUptimeSeconds != null ? formatUptime(metrics.osUptimeSeconds) : '-',
    },
    { icon: Terminal, label: 'Node.js', value: metrics?.node?.version || '-' },
    {
      icon: Server,
      label: 'Platform',
      value: [metrics?.node?.platform, metrics?.node?.arch].filter(Boolean).join(' / ') || '-',
    },
    {
      icon: Cpu,
      label: 'CPU',
      value: metrics?.cpu?.model
        ? `${metrics.cpu.model} (${metrics?.cpu?.cores ?? '?'} cores)`
        : `${metrics?.cpu?.cores ?? '-'} cores`,
    },
    {
      icon: MemoryStick,
      label: 'Memori',
      value: `${formatBytes(metrics?.memory?.usedBytes)} / ${formatBytes(metrics?.memory?.totalBytes)}`,
    },
  ];

  return (
    <div className="main-container">
      <header className="page-header section section-neo">
        <h1 className="main-title text-gradient">Status Runtime</h1>
        <p className="subtitle">
          Informasi proses server FiveNime {online ? '(server merespons normal)' : '(server tidak merespons)'}.
          {persisted ? ' Data tersimpan di Firebase.' : ' Login untuk menyimpan riwayat ke Firebase.'}
        </p>
      </header>

      <section className="section section-neo">
        <div className="sysstat-grid">
          {rows.map(({ icon: Icon, label, value }) => (
            <div className="sysstat-card" key={label}>
              <div className="sysstat-card__head">
                <Icon size={15} aria-hidden="true" />
                <span>{label}</span>
              </div>
              <div className="sysstat-card__value" style={{ fontSize: '0.9rem' }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </section>

      <SystemStatus />
    </div>
  );
}
