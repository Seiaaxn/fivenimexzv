import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/DonghuaGenreFilter";

export const Route = createFileRoute("/donghua-genre/$slug")({ component: Page });
