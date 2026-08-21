import { createFileRoute } from "@tanstack/react-router";
import { CommandCenter } from "@/components/cc/app";

export const Route = createFileRoute("/cc")({ component: Hub });

function Hub() {
  return <CommandCenter />;
}
