import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/WatchHistory";

export const Route = createFileRoute("/history")({ component: Page });
