import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/Messages";

export const Route = createFileRoute("/messages")({ component: Page });
