import assert from 'node:assert/strict';
import test from 'node:test';
import { createTourApiLiveHandler as createRawTourApiLiveHandler } from '../supabase/functions/tourapi-live/handler';

const createTourApiLiveHandler = (deps: Parameters<typeof createRawTourApiLiveHandler>[0]) => createRawTourApiLiveHandler({ reserveProviderAttempt: async () => 'granted', ...deps });

const ref = { contentId: '1', contentTypeId: '12' };
const envelope = (items: unknown[], totalCount = items.length) => ({ response: { header: { resultCode: '0000' }, body: { totalCount, items: { item: items } } } });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const request = (body: unknown, token = 'fixture-token') => new Request('https://edge.test/tourapi-live', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const codec = { async encode(value: unknown) { return JSON.stringify(value); }, async decode(value: string) { try { return JSON.parse(value); } catch { return null; } } };

test('same content ID with changed type is catalog identity_conflict partial and exposes no changed facts', async () => {
  let detailCalls = 0;
  const edge = createTourApiLiveHandler({ serviceKey: 'secret', authenticate: async () => true, sessionCodec: codec, randomId: () => 's', fetch: async (input) => {
    const url = new URL(String(input)); if (url.pathname.endsWith('/detailIntro2')) detailCalls += 1;
    return response(envelope([{ contentid: '1', contenttypeid: '14', title: 'changed-title', mapx: '129.9', mapy: '35.9' }]));
  } });
  const result = await edge(request({ action: 'catalog', approvedCandidates: [ref] })); const text = await result.text(); const body = JSON.parse(text);
  assert.equal(body.status, 'partial'); assert.deepEqual(body.snapshot.candidateStates, [{ ...ref, state: 'identity_conflict' }]); assert.deepEqual(body.snapshot.catalogPlaces, []); assert.equal(detailCalls, 0);
  assert.doesNotMatch(text, /changed-title|129\.9|35\.9|category|AI-Hub/);
});

test('email and anonymous user JWT classes pass the same auth gate; missing token is 401', async () => {
  const accepted = new Set(['email-token', 'anonymous-token']);
  const edge = createTourApiLiveHandler({ serviceKey: 'secret', authenticate: async (token) => accepted.has(token), sessionCodec: codec, fetch: async () => response(envelope([])) });
  for (const token of accepted) assert.equal((await edge(request({ action: 'catalog', approvedCandidates: [] }, token))).status, 200);
  const noToken = new Request('https://edge.test/tourapi-live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'catalog', approvedCandidates: [] }) });
  assert.equal((await edge(noToken)).status, 401);
});

test('provider 401/403/429 and provider messages are reduced to safe typed failures', async () => {
  for (const [status, code] of [[401, 'unauthorized'], [403, 'unauthorized'], [429, 'rate_limited']] as const) {
    const edge = createTourApiLiveHandler({ serviceKey: 'secret', authenticate: async () => true, sessionCodec: codec, fetch: async () => response({ raw: 'hidden' }, status) });
    const text = await (await edge(request({ action: 'catalog', approvedCandidates: [] }))).text(); assert.match(text, new RegExp(code)); assert.doesNotMatch(text, /hidden/);
  }
});
