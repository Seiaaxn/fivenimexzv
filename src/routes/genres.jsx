import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/Genres";

export const Route = createFileRoute("/genres")({ component: Page });
