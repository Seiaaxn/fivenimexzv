import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/Ongoing";

export const Route = createFileRoute("/ongoing")({ component: Page });
