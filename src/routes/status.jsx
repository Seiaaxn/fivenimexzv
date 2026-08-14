import { createFileRoute } from '@tanstack/react-router';
import SystemStatus from '@/components/SystemStatus';

export const Route = createFileRoute('/status')({
  component: StatusPage,
  head: () => ({
    meta: [
      { title: 'Status Server & Runtime - FiveNime' },
      {
        name: 'description',
        content:
          'Pantau status server FiveNime secara realtime: uptime aplikasi, uptime host, versi Node.js, beban CPU, penggunaan RAM, latency, dan aktivitas request terakhir.',
      },
      { property: 'og:title', content: 'Status Server & Runtime - FiveNime' },
      {
        property: 'og:description',
        content:
          'Uptime, Node.js, CPU, RAM, latency, dan aktivitas request FiveNime secara realtime.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
});

function StatusPage() {
  return (
    <div className="main-container">
      <header className="page-header section section-neo">
        <h1 className="main-title text-gradient">Status Server</h1>
        <p className="subtitle">
          Metrik runtime FiveNime diperbarui setiap 5 detik dan tersimpan di Firebase.
        </p>
      </header>
      <SystemStatus />
    </div>
  );
}
