export const HISTORY_DELETE_WIDTH = 64;
export const HISTORY_REVEAL_WIDTH = HISTORY_DELETE_WIDTH + 8;
const clamp = (n: number) => Math.max(-HISTORY_REVEAL_WIDTH, Math.min(0, n));
export function createHistorySwipeMotion(port: {
  stop(callback: (value: number) => void): void; write(value: number): void;
  animate(target: number, complete: () => void): void; settled(open: boolean): void;
}) {
  let epoch = 0, alive = true, dragging = false, ready = false, dx = 0, appliedDx = 0, value = 0;
  let releasePending = false, target: number | null = null;
  const apply = () => { if (dragging && ready) { value = clamp(value + dx - appliedDx); appliedDx = dx; port.write(value); } };
  const settle = (open: boolean) => {
    const run = ++epoch; dragging = false; ready = false; target = open ? -HISTORY_REVEAL_WIDTH : 0;
    port.animate(target, () => { if (!alive || epoch !== run) return; value = open ? -HISTORY_REVEAL_WIDTH : 0; target = null; port.settled(open); });
  };
  const release = () => { if (!dragging) return; if (!ready) { releasePending = true; return; } apply(); settle(value < -HISTORY_REVEAL_WIDTH / 2); };
  return {
    activate() { alive = true; },
    isRevealed() { return alive && !dragging && target === null && value === -HISTORY_REVEAL_WIDTH; },
    grant(originDx = 0) { const run = ++epoch; dragging = true; ready = false; dx = appliedDx = originDx; releasePending = false; target = null;
      port.stop(sample => { if (!alive || !dragging || epoch !== run) return; value = clamp(sample); ready = true; apply(); if (releasePending) release(); }); },
    move(delta: number) { if (!dragging) return; dx = delta; apply(); }, release,
    cancel() { if (alive) settle(false); },
    sync(open: boolean, force = false) { if (!alive || (!force && dragging)) return; const next = open ? -HISTORY_REVEAL_WIDTH : 0;
      if (!dragging && (target === next || (target === null && value === next))) return; settle(open); },
    dispose() { alive = false; epoch++; dragging = false; port.stop(() => {}); },
  };
}
