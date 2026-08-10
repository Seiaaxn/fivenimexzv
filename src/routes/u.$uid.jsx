import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/PublicProfile";

export const Route = createFileRoute("/u/$uid")({ component: Page });
