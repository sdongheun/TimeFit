type Point = Readonly<{ lat: number; lon: number }>;
export type ManualReselection = Point & Readonly<{ label: string; source: 'provider' | 'map' }>;
type Endpoints = { origin: Point; destination: Point | null };
type ManualProof = Readonly<{ version: 1; origin: Point; destination: Point | null }>;
const valid = (p: Point | null | undefined): p is Point => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
const same = (a: Point | null | undefined, b: Point | null | undefined) => valid(a) && valid(b) && a.lat === b.lat && a.lon === b.lon;
const copy = (p: Point) => ({ lat: p.lat, lon: p.lon });

/** Local input-version evidence, not GPS classification or learning/visit evidence. Never stamped on read/write. */
export function withManualLocationProof<T extends Endpoints>(input: T): T & { manualLocation: ManualProof } {
  if (!valid(input.origin) || (input.destination !== null && !valid(input.destination))) throw Error('manual_location_invalid');
  return { ...input, manualLocation: { version: 1, origin: copy(input.origin), destination: input.destination === null ? null : copy(input.destination) } };
}
export function hasManualLocationProof(input: Endpoints | null | undefined): boolean {
  if (!input) return false;
  const proof = (input as Endpoints & { manualLocation?: ManualProof }).manualLocation;
  return proof?.version === 1 && same(proof.origin, input.origin)
    && (input.destination === null ? proof.destination === null : same(proof.destination, input.destination));
}

/** Only newly selected coordinates may unlock the unchanged snapshot. Changed routes require separate revalidation. */
export function manualReselectionResult(input: Endpoints, origin: ManualReselection | null, destination: ManualReselection | null, endsAtMs: number, nowMs: number): 'ready' | 'missing' | 'expired' | 'changed' {
  const selected = (p: ManualReselection | null) => valid(p) && (p.source === 'provider' || p.source === 'map');
  if (!selected(origin) || !selected(destination)) return 'missing';
  if (!Number.isFinite(endsAtMs) || !Number.isFinite(nowMs) || nowMs >= endsAtMs) return 'expired';
  if (!same(input.origin, origin) || !same(input.destination ?? input.origin, destination)) return 'changed';
  return 'ready';
}
