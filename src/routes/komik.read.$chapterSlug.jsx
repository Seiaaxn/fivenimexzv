import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/KomikReader";

export const Route = createFileRoute("/komik/read/$chapterSlug")({ component: Page });
