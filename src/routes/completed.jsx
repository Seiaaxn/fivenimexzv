import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/Completed";

export const Route = createFileRoute("/completed")({ component: Page });
