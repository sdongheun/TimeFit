import type { LatLon } from "../../engine";

export type RouteMapSegment = {
  points: LatLon[];
  quality: "precise" | "approx" | "fallback";
};

export function buildRouteMapSegments(
  points: LatLon[],
  travelLegs: Array<{ geo?: LatLon[]; src?: string }>,
): RouteMapSegment[] {
  return travelLegs
    .map((leg, index) => {
      const geo = normalizeRoutePoints(leg.geo);
      const hasGeo = geo.length > 1;
      const quality: RouteMapSegment["quality"] =
        leg.src === "TMAP" && geo.length >= 4
          ? "precise"
          : hasGeo
            ? "approx"
            : "fallback";
      return {
        points: hasGeo ? geo : [points[index], points[index + 1]].filter(Boolean),
        quality,
      };
    })
    .filter((segment) => segment.points.length > 1);
}

function normalizeRoutePoints(points?: LatLon[]): LatLon[] {
  if (!points) return [];
  const normalized: LatLon[] = [];
  for (const point of points) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
    const previous = normalized[normalized.length - 1];
    if (
      previous &&
      Math.abs(previous.lat - point.lat) < 0.00001 &&
      Math.abs(previous.lon - point.lon) < 0.00001
    ) {
      continue;
    }
    normalized.push(point);
  }
  return normalized;
}
