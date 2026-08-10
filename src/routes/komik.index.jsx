import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/Komik";

export const Route = createFileRoute("/komik/")({ component: Page });
