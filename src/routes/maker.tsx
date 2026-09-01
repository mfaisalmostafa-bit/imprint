import { createFileRoute } from "@tanstack/react-router";
import { MakerApp } from "@/components/maker/app";

export const Route = createFileRoute("/maker")({ component: MakerPage });

function MakerPage() {
  return <MakerApp />;
}
