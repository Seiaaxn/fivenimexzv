import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/KomikDetail";

export const Route = createFileRoute("/komik/$slug")({ component: Page });
