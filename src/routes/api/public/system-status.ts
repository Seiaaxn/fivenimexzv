import { createFileRoute } from '@tanstack/react-router'

// Waktu boot proses/worker. Dipakai sebagai fallback "APP UPTIME" ketika
// `process.uptime()` tidak tersedia (runtime edge tidak selalu punya).
const BOOT_AT = Date.now()

type Metrics = {
  status: 'online'
  serverTime: number
  appUptimeSeconds: number
  osUptimeSeconds: number | null
  node: {
    version: string | null
    platform: string | null
    arch: string | null
  }
  cpu: {
    model: string | null
    cores: number | null
    loadPercent: number | null
  }
  memory: {
    usedBytes: number | null
    totalBytes: number | null
    freeBytes: number | null
    usedPercent: number | null
  }
  runtime: string
}

const safe = <T,>(fn: () => T): T | null => {
  try {
    return fn()
  } catch {
    return null
  }
}

export const Route = createFileRoute('/api/public/system-status')({
  server: {
    handlers: {
      GET: async () => {
        // `os` hanya sebagian yang didukung di runtime edge, jadi setiap
        // pemanggilan dibungkus try/catch dan boleh bernilai null.
        let os: typeof import('node:os') | null = null
        try {
          os = await import('node:os')
        } catch {
          os = null
        }

        const cpus = os ? safe(() => os!.cpus()) : null
        const totalmem = os ? safe(() => os!.totalmem()) : null
        const freemem = os ? safe(() => os!.freemem()) : null
        const loadavg = os ? safe(() => os!.loadavg()) : null

        const procUptime = safe(() => Math.floor(process.uptime()))
        const appUptime =
          procUptime && procUptime > 0 ? procUptime : Math.floor((Date.now() - BOOT_AT) / 1000)

        const cores = cpus?.length ?? null
        let loadPercent: number | null = null
        const load1 = loadavg?.[0]
        if (typeof load1 === 'number' && cores) {
          loadPercent = Math.max(0, Math.min(100, Math.round((load1 / cores) * 100)))
        }
        // Fallback: pakai heap usage sebagai proksi beban ketika loadavg
        // tidak tersedia (runtime edge).
        if (loadPercent === null) {
          const mu = safe(() => process.memoryUsage())
          if (mu?.heapTotal) {
            loadPercent = Math.round((mu.heapUsed / mu.heapTotal) * 100)
          }
        }

        let usedBytes: number | null = null
        let totalBytes: number | null = totalmem
        let freeBytes: number | null = freemem
        if (totalmem && freemem) {
          usedBytes = totalmem - freemem
        } else {
          const mu = safe(() => process.memoryUsage())
          if (mu) {
            usedBytes = mu.rss || mu.heapUsed
            totalBytes = mu.heapTotal || null
            freeBytes = totalBytes && usedBytes ? Math.max(0, totalBytes - usedBytes) : null
          }
        }

        const metrics: Metrics = {
          status: 'online',
          serverTime: Date.now(),
          appUptimeSeconds: appUptime,
          osUptimeSeconds: os ? safe(() => Math.floor(os!.uptime())) : null,
          node: {
            version: safe(() => process.version) ?? null,
            platform: os ? safe(() => os!.platform()) : null,
            arch: os ? safe(() => os!.arch()) : null,
          },
          cpu: {
            model: cpus?.[0]?.model ?? null,
            cores,
            loadPercent,
          },
          memory: {
            usedBytes,
            totalBytes,
            freeBytes,
            usedPercent:
              usedBytes && totalBytes ? Math.round((usedBytes / totalBytes) * 100) : null,
          },
          runtime: os ? 'node-compat' : 'edge',
        }

        return new Response(JSON.stringify(metrics), {
          headers: {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          },
        })
      },
    },
  },
})
