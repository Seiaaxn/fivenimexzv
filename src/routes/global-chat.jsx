import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/GlobalChatPage";

export const Route = createFileRoute("/global-chat")({ component: Page });
