import type { StageTheme } from "./types.ts";

export function routeArtwork(theme: StageTheme): string {
  const base = typeof window !== "undefined" && window.location.pathname.startsWith("/rhythm-express/")
    ? "/rhythm-express/" : "/";
  return `${base}art/route-${theme}.jpg`;
}

export function rhythmGeometry(width: number, height: number) {
  return {
    targetX: Math.max(68, width * 0.21),
    targetY: height * 0.8,
    radius: Math.max(24, Math.min(36, height * 0.07, width * 0.05)),
    laneTop: height * 0.66,
    laneBottom: height * 0.96,
  };
}

export function noteScreenX(noteTime: number, playhead: number, width: number, targetX: number, travelTime: number): number {
  return targetX + (noteTime - playhead) * (width - targetX - 34) / Math.max(0.5, travelTime);
}
