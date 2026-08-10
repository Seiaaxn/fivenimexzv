import { createFileRoute } from '@tanstack/react-router'

// Comic chapter images are served from rotating third-party CDNs, so an
// exact host allowlist is not viable. Instead: https only, public DNS names
// only (no IP literals, localhost, or internal TLDs), and image responses only.
const BLOCKED_HOST = /^(localhost|.*\.local|.*\.internal|metadata.*)$/i
const IP_LITERAL = /^(\d{1,3}\.){3}\d{1,3}$|^\[|:/

function isAllowed(host: string) {
  if (!host.includes('.')) return false
  if (BLOCKED_HOST.test(host)) return false
  if (IP_LITERAL.test(host)) return false
  return true
}


export const Route = createFileRoute('/api/public/img-proxy')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const target = new URL(request.url).searchParams.get('url')
        if (!target) return new Response('Missing url', { status: 400 })

        let parsed: URL
        try {
          parsed = new URL(target)
        } catch {
          return new Response('Invalid url', { status: 400 })
        }
        if (parsed.protocol !== 'https:' || !isAllowed(parsed.hostname)) {
          return new Response('Host not allowed', { status: 403 })
        }

        const headers: Record<string, string> = {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
        }

        let upstream: Response
        try {
          upstream = await fetch(parsed.toString(), { headers })
          if (!upstream.ok) {
            // Some hosts only serve images with a same-site referer.
            upstream = await fetch(parsed.toString(), {
              headers: { ...headers, Referer: `${parsed.origin}/` },
            })
          }
        } catch (err) {
          return new Response(`Upstream fetch failed: ${String(err)}`, { status: 502 })
        }

        if (!upstream.ok || !upstream.body) {
          return new Response(`Upstream error ${upstream.status}`, { status: 502 })
        }


        const contentType = upstream.headers.get('content-type') ?? 'image/jpeg'
        if (!contentType.startsWith('image/')) {
          return new Response('Not an image', { status: 415 })
        }

        return new Response(upstream.body, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400, s-maxage=604800',
          },
        })
      },
    },
  },
})
