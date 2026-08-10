import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/KomikGenres";

export const Route = createFileRoute("/komik/genres")({ component: Page });
