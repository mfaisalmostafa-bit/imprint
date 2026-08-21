import { createFileRoute } from "@tanstack/react-router";
import { JobsApp } from "@/components/jobs/app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <JobsApp />;
}
