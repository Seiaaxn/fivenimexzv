import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/Profile";

export const Route = createFileRoute("/profile")({ component: Page });
