import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/DonghuaOngoing";

export const Route = createFileRoute("/donghua-ongoing")({ component: Page });
