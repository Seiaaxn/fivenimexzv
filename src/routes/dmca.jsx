import { createFileRoute } from "@tanstack/react-router";
import DMCA from "@/components/DMCA";

export const Route = createFileRoute("/dmca")({
  component: DMCA,
  head: () => ({
    meta: [
      { title: "DMCA - FiveNime" },
      {
        name: "description",
        content:
          "Kebijakan DMCA FiveNime. Kami tidak menyimpan file video di server kami. Semua konten bersumber dari pihak ketiga.",
      },
    ],
  }),
});
