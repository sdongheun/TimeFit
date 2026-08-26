import type { CourseV1Point, CourseV1TravelMode } from '../../src/engine/courseV1';
import type { CourseV1RouteFetcher } from '../../src/services/courseV1RouteAdapter';

export const routeFixturePoints = {
  origin: { id: 'origin', lat: 35.15781, lon: 129.05941 },
  nearby: { id: 'nearby', lat: 35.15801, lon: 129.06001 },
  distant: { id: 'distant', lat: 35.17961, lon: 129.07501 },
} satisfies Record<string, CourseV1Point>;

export function routeFetcherFixture(responses: Partial<Record<string, { min: number; source: string } | null>>) {
  const calls: string[] = [];
  const fetcher: CourseV1RouteFetcher = {
    async fetch(from, to, mode) {
      const key = fixtureRouteKey(mode, from, to);
      calls.push(key);
      return responses[key] ?? null;
    },
  };
  return { fetcher, calls };
}

export function fixtureRouteKey(mode: CourseV1TravelMode, from: CourseV1Point, to: CourseV1Point): string {
  return `${mode}:${from.id}>${to.id}`;
}
