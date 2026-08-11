import { createFileRoute } from "@tanstack/react-router";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=120, s-maxage=300",
    },
  });

export const Route = createFileRoute("/api/public/nontonanimeid")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const action = (url.searchParams.get("action") || "home").toLowerCase();
        const page = Number(url.searchParams.get("page") || "1") || 1;
        const slug = url.searchParams.get("slug") || "";
        const q = url.searchParams.get("q") || "";
        const sort = url.searchParams.get("sort") || "";

        const { NontonAnimeIDScraper } = await import("@/lib/nontonanimeid.server");
        const base = url.searchParams.get("base") || undefined;
        const scraper = new NontonAnimeIDScraper(base);

        try {
          switch (action) {
            case "home":
              return json({ ok: true, data: await scraper.getHome() });
            case "list": {
              const filters: Record<string, string | string[]> = {};
              for (const [k, v] of url.searchParams.entries()) {
                if (["action", "page", "slug", "q", "sort", "base"].includes(k)) continue;
                filters[k] = v.includes(",") ? v.split(",") : v;
              }
              return json({ ok: true, data: await scraper.getAnimeList(page, filters) });
            }
            case "ongoing":
              return json({ ok: true, data: await scraper.getOngoingList(page, sort || "date") });
            case "popular":
              return json({ ok: true, data: await scraper.getPopularSeries(page) });
            case "schedule":
              return json({ ok: true, data: await scraper.getJadwalRilis() });
            case "genres":
              return json({ ok: true, data: await scraper.getGenresList(sort || "az") });
            case "genre":
              if (!slug) return json({ ok: false, error: "slug required" }, 400);
              return json({ ok: true, data: await scraper.getGenreAnime(slug, page) });
            case "search":
              if (!q) return json({ ok: false, error: "q required" }, 400);
              return json({ ok: true, data: await scraper.searchAnime(q, page) });
            case "detail":
              if (!slug) return json({ ok: false, error: "slug required" }, 400);
              return json({ ok: true, data: await scraper.getAnimeDetail(slug) });
            case "stream":
              if (!slug) return json({ ok: false, error: "slug required" }, 400);
              return json({ ok: true, data: await scraper.getStreamingDetail(slug) });
            case "iframe": {
              const post = url.searchParams.get("post") || "";
              const nume = url.searchParams.get("nume") || "";
              const server = url.searchParams.get("server") || "";
              const nonce: string | null = url.searchParams.get("nonce");
              const ajaxUrl: string | null = url.searchParams.get("ajax_url");
              if (!post || !nume) return json({ ok: false, error: "post & nume required" }, 400);
              const iframeUrl = await scraper.getVideoIframe(
                post,
                nume,
                server,
                nonce as never,
                ajaxUrl as never,
              );
              return json({ ok: true, data: { iframe_url: iframeUrl } });
            }
            default:
              return json({ ok: false, error: `unknown action: ${action}` }, 400);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "scrape failed";
          return json({ ok: false, error: message }, 502);
        }
      },
    },
  },
});
