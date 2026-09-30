import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const [socket, port] = process.argv.slice(2);
if (!socket || !port) throw new Error('local cluster socket and port required');
const psql = '/opt/homebrew/bin/psql';
const query = async (sql, role = 'postgres') => {
  const { stdout } = await exec(psql, ['-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-h', socket, '-p', port, '-d', 'postgres', '-c', `set role ${role}; ${sql}`]);
  return stdout.trim().split('\n').at(-1);
};
const reserve = (scope, operation) => query(`select granted::text || ':' || reason from public.reserve_live_provider_attempt('${scope}','${operation}')`, 'service_role');

assert.equal(await reserve('tourapi', 'catalog_page'), 'false:unconfigured');
assert.equal(await reserve('busan_public_data', 'attractions_page'), 'false:unconfigured');
assert.equal(await reserve('unknown', 'catalog_page'), 'false:invalid_input');
await query("insert into public.live_provider_budget_config(scope, rolling_24h_cap) values ('tourapi', 0), ('busan_public_data', 0)");
assert.equal(await reserve('tourapi', 'catalog_page'), 'false:unconfigured');
await query("update public.live_provider_budget_config set rolling_24h_cap=2 where scope='tourapi'");
await query("update public.live_provider_budget_config set rolling_24h_cap=1 where scope='busan_public_data'");
assert.equal(await reserve('tourapi', 'wrong'), 'false:invalid_input');
const pair = await Promise.all([reserve('tourapi', 'catalog_page'), reserve('tourapi', 'detail_intro')]);
assert.deepEqual(pair.sort(), ['true:granted', 'true:granted']);
assert.equal(await reserve('tourapi', 'detail_intro'), 'false:limit');
assert.equal(await reserve('tourapi', 'catalog_page'), 'false:limit'); // replay cannot exceed the cap
const busan = await Promise.all([
  reserve('busan_public_data', 'attractions_page'),
  reserve('busan_public_data', 'food_page'),
  reserve('busan_public_data', 'shopping_page'),
]);
assert.deepEqual(busan.sort(), ['false:limit', 'false:limit', 'true:granted']);
assert.equal(await query("select count(*) from public.live_provider_attempt_reservations where scope='tourapi'"), '2');
assert.equal(await query("select count(*) from public.live_provider_attempt_reservations where scope='busan_public_data'"), '1');
await query("update public.live_provider_attempt_reservations set reserved_at=clock_timestamp()-interval '23 hours 59 minutes' where scope='busan_public_data'");
assert.equal(await reserve('busan_public_data', 'shopping_page'), 'false:limit');
await query("update public.live_provider_attempt_reservations set reserved_at=clock_timestamp()-interval '24 hours 1 second' where scope='tourapi'");
assert.equal(await reserve('tourapi', 'catalog_page'), 'true:granted');
assert.equal(await query("select count(*) from public.live_provider_attempt_reservations where scope='tourapi' and reserved_at > clock_timestamp()-interval '24 hours'"), '1');
assert.equal(await query("select pronargs from pg_proc where oid='public.reserve_live_provider_attempt(text,text)'::regprocedure"), '2');
for (const role of ['anon', 'authenticated']) {
  await assert.rejects(query("select * from public.reserve_live_provider_attempt('tourapi','catalog_page')", role), /permission denied/);
  await assert.rejects(query('select count(*) from public.live_provider_attempt_reservations', role), /permission denied/);
  await assert.rejects(query('select count(*) from public.live_provider_budget_config', role), /permission denied/);
}
await assert.rejects(query('select count(*) from public.live_provider_attempt_reservations', 'service_role'), /permission denied/);
await assert.rejects(query('select count(*) from public.live_provider_budget_config', 'service_role'), /permission denied/);
console.log('live-provider budget local DB: missing/zero, allowlist, rolling expiry, concurrent global cap, ACL PASS');
