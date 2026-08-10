import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/AnimeDetail";

export const Route = createFileRoute("/anime/$animeId")({ component: Page });
