import test from 'node:test';
import assert from 'node:assert/strict';
import { createPersonalizationSessionController } from '../../src/ui/personalizationSessionModel';

test('B: account change rejects late samples; snapshots freeze values; consent change invalidates previous sessions', async () => {
  let resolve!: (v: any) => void;
  const source = [{ category: '문화시설', subCategory: '전시', dwellMin: 30 }];
  const controller = createPersonalizationSessionController({ read: () => new Promise(r => { resolve = r; }), timeoutMs: 30 });
  controller.setAccount('A');
  const old = controller.snapshot();
  controller.setAccount('B');
  resolve({ enabled: true, samples: source });
  assert.deepEqual((await old).samples, []);
  const fresh = controller.snapshot();
  resolve({ enabled: true, samples: source });
  const captured = await fresh;
  source[0].dwellMin = 80;
  assert.equal(captured.samples[0].dwellMin, 30);
  assert.ok(Object.isFrozen(captured.samples[0]));
  assert.equal(captured.isCurrent(), true);
  controller.invalidate();
  assert.equal(captured.isCurrent(), false);
  controller.setAccount(null);
  assert.deepEqual((await controller.snapshot()).samples, []);
});

test('B: unavailable or indefinitely loading samples produce bounded default recommendation', async () => {
  const c = createPersonalizationSessionController({ read: () => new Promise(() => {}), timeoutMs: 5 });
  c.setAccount('A');
  assert.deepEqual((await c.snapshot()).samples, []);
});
