/** Not wired to app startup: activation requires a baseline retention/call-budget decision. */
export type LegacyRouteBaselineCleanupStorage = {
  getAllKeys(): Promise<readonly string[]>;
  removeItem(key: string): Promise<void>;
};

// Only the historical default namespace and its exact coordinate-pair key shape.
// Never read values, accept caller prefixes, clear storage, or expose keys in receipts.
const historicalKey = /^timefit:route-baselines:v1:(-?\d{1,2}\.\d{5}),(-?\d{1,3}\.\d{5}):(-?\d{1,2}\.\d{5}),(-?\d{1,3}\.\d{5})$/;
const ownsKey = (key: string) => {
  const match = historicalKey.exec(key);
  return !!match && Math.abs(Number(match[1])) <= 90 && Math.abs(Number(match[2])) <= 180
    && Math.abs(Number(match[3])) <= 90 && Math.abs(Number(match[4])) <= 180;
};

export async function purgeLegacyRouteBaselineCache(storage: LegacyRouteBaselineCleanupStorage): Promise<{
  status: 'completed' | 'partial' | 'unavailable'; removedCount: number; failedCount: number;
}> {
  let keys: readonly string[];
  try { keys = await storage.getAllKeys(); }
  catch { return { status: 'unavailable', removedCount: 0, failedCount: 0 }; }
  let removedCount = 0, failedCount = 0;
  for (const key of new Set(keys.filter(ownsKey))) {
    try { await storage.removeItem(key); removedCount++; }
    catch { failedCount++; }
  }
  return { status: failedCount ? 'partial' : 'completed', removedCount, failedCount };
}
