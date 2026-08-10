import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/Schedule";

export const Route = createFileRoute("/schedule")({ component: Page });
