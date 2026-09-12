/** Official destination-only link: https://apis.map.kakao.com/web/guide/#routeurl
 * No browsing origin, route API, course state or lifecycle callbacks.
 */
export function buildNearbyDirectionsUrl(place: { title: string; lat: number; lon: number }): string | null {
  if (!place.title.trim() || !Number.isFinite(place.lat) || Math.abs(place.lat) > 90 || !Number.isFinite(place.lon) || Math.abs(place.lon) > 180) return null;
  return `https://map.kakao.com/link/to/${encodeURIComponent(place.title.trim())},${place.lat},${place.lon}`;
}
export async function openNearbyDirections(place: { title: string; lat: number; lon: number }, ports: {
  openExternal(url: string): Promise<unknown>; openBrowser(url: string): Promise<unknown>;
}): Promise<'opened' | 'cancelled' | 'unconfirmed' | 'failed'> {
  const url = buildNearbyDirectionsUrl(place);
  if (!url) return 'failed';
  // HTTPS lets the OS/Kakao dispatch to the installed app or web, without an invented sp.
  try { await ports.openExternal(url); return 'opened'; } catch { /* same destination in browser */ }
  try {
    const result = await ports.openBrowser(url);
    const type = (result as { type?: string } | null)?.type;
    return type === 'cancel' || type === 'dismiss' ? 'cancelled' : type === 'opened' ? 'opened' : 'unconfirmed';
  } catch { return 'failed'; }
}
