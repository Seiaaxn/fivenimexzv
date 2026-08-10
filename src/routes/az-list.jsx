import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/AZList";

export const Route = createFileRoute("/az-list")({ component: Page });
