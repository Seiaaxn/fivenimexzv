import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/UnifiedSearch";

export const Route = createFileRoute("/search")({ component: Page });
