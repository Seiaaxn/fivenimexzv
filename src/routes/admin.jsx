import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/AdminPanel";

export const Route = createFileRoute("/admin")({ component: Page });
