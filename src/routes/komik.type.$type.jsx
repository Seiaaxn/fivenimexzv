import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/KomikByType";

export const Route = createFileRoute("/komik/type/$type")({ component: Page });
