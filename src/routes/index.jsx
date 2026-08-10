import { createFileRoute } from "@tanstack/react-router";
import Home from "@/components/Home";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "FiveNime - Nonton Anime & Donghua Sub Indo Gratis" },
      {
        name: "description",
        content:
          "Streaming anime, donghua, dan baca komik sub Indo gratis. Update episode terbaru setiap hari di FiveNime.",
      },
      { property: "og:title", content: "FiveNime - Nonton Anime & Donghua Sub Indo" },
      {
        property: "og:description",
        content: "Ribuan judul anime, donghua, dan komik sub Indo. Gratis dan update tiap hari.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
