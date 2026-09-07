// Invoked only by the disposable local DB harness, before 015 is applied.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const [psql, socket, port] = process.argv.slice(2);
assert.match(socket, /^\/private\/tmp\/timefit-release-identity\.[A-Za-z0-9]+$/);
const sql = fs.readFileSync(new URL('../supabase/migrations/202609070015_release_account_identity_records.sql', import.meta.url), 'utf8');
const guard = sql.match(/execute \$guard_definition\$([\s\S]*?)\$guard_definition\$;/)[1];
const erase = sql.match(/do \$erase_legacy_age\$[\s\S]*?\$erase_legacy_age\$;/)[0];
function run(input, expectedStatus = 0) {
  const result = spawnSync(psql, ['-X','-U','postgres','-h',socket,'-p',port,'-d','postgres','-v','ON_ERROR_STOP=1'], {input,encoding:'utf8'});
  assert.equal(result.status, expectedStatus, result.stderr);
  return result;
}
const nullable = 'alter table public.profiles alter column birth_year drop not null; alter table public.profiles alter column age_band drop not null;';
run(`begin; ${nullable} ${guard}
do $$ declare assignment text; begin
  foreach assignment in array array[
    'birth_year=1991,age_band=null', 'birth_year=null,age_band=''20s''',
    'birth_year=null,age_band=null,terms_agreed_at=now()',
    'birth_year=null,age_band=null,privacy_agreed_at=now()',
    'birth_year=null,age_band=null,email_verified_at=now()',
    'birth_year=null,age_band=null,id=gen_random_uuid()',
    'birth_year=null,age_band=null,created_at=now()'
  ] loop
    begin
      execute 'update public.profiles set '||assignment||' where id=''c0000000-0000-4000-8000-000000000001''';
      raise exception 'unsafe erasure accepted';
    exception when raise_exception then if sqlerrm<>'immutable_profile_field' then raise; end if; end;
  end loop;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000001',true);
do $$ begin
  begin
    update public.profiles set birth_year=null,age_band=null where id='c0000000-0000-4000-8000-000000000001';
    raise exception 'client erasure accepted';
  exception when raise_exception then if sqlerrm<>'immutable_profile_field' then raise; end if; end;
end $$;
reset role;
update public.profiles set birth_year=null,age_band=null where id='c0000000-0000-4000-8000-000000000001';
rollback;`);

// Force an error AFTER the profile erase, before Auth metadata erase. The actual
// DO block must roll back both the row change and temporary function definition.
const before = run("select pg_get_functiondef('public.guard_profile_changes()'::regprocedure);").stdout;
run(nullable);
const failure = run(erase.replace('  update auth.users', "  raise exception 'fixture_auth_write_failed';\n  update auth.users"), 3);
assert.match(failure.stderr, /fixture_auth_write_failed/);
assert.equal(run("select pg_get_functiondef('public.guard_profile_changes()'::regprocedure);").stdout, before);
run(`do $$ begin
  if (select count(*) from public.profiles where birth_year is not null and age_band is not null)<>2
    or (select count(*) from auth.users where raw_user_meta_data ?& array['birth_year','age_band'])<>2 then
    raise exception 'failed migration lost age data';
  end if;
end $$;`);
run('alter table public.profiles alter column birth_year set not null; alter table public.profiles alter column age_band set not null;');
console.log('compat exact age guard + failed migration rollback: PASS');
