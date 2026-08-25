import { createFileRoute } from "@tanstack/react-router";
import { type ComponentType, useEffect, useState } from "react";
import { Splash } from "@/components/simulation/Splash";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [App, setApp] = useState<ComponentType | null>(null);

  useEffect(() => {
    void import("@/components/simulation/Simulation").then((mod) => {
      setApp(() => mod.default);
    });
  }, []);

  if (!App) return <Splash />;
  return <App />;
}
