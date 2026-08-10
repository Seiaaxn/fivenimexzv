import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/DonghuaDetail";

export const Route = createFileRoute("/donghua/$slug")({ component: Page });
