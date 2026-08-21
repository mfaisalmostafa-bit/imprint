import { createFileRoute } from "@tanstack/react-router";
import { CommandCenter } from "@/components/cc/app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <CommandCenter />;
}
