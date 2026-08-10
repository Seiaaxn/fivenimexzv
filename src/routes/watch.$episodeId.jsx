import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/Watch";

export const Route = createFileRoute("/watch/$episodeId")({ component: Page });
