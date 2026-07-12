import { useEffect, useState } from "react";

export type ViewportTier = "wide" | "medium" | "compact";

export interface ViewportInfo {
  width: number;
  height: number;
  tier: ViewportTier;
  compact: boolean;
  medium: boolean;
  short: boolean;
}

function readViewport(): ViewportInfo {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const tier: ViewportTier =
    width < 720 ? "compact" : width < 980 ? "medium" : "wide";
  return {
    width,
    height,
    tier,
    compact: tier === "compact",
    medium: tier !== "wide",
    short: height < 520,
  };
}

export function useViewport(): ViewportInfo {
  const [viewport, setViewport] = useState(readViewport);

  useEffect(() => {
    const onResize = () => setViewport(readViewport());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return viewport;
}