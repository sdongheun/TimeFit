// Synthetic disposable cluster only. Never reads application env or linked project.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
const [psql,socket,port,root]=process.argv.slice(2);
assert.match(socket,/^\/private\/tmp\/timefit-release-identity\.[A-Za-z0-9]+$/);
assert.match(port,/^\d+$/);
const args=['-X','-U','postgres','-h',socket,'-p',port,'-d','postgres','-v','ON_ERROR_STOP=1','-At'];
function query(sql,db='postgres') {
  const result=spawnSync(psql,[...args,'-d',db],{input:sql,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr); return result.stdout.trim();
}
const dir=path.join(socket,'cli-project');
fs.mkdirSync(path.join(dir,'supabase','migrations'),{recursive:true});
fs.writeFileSync(path.join(dir,'supabase','config.toml'),'project_id = "timefit-local-readiness"\n[db]\nmajor_version = 17\n[db.seed]\nenabled = false\n');
const migrations=fs.readdirSync(path.join(root,'supabase','migrations')).filter(f=>f.endsWith('.sql')).sort();
for(const f of migrations) fs.copyFileSync(path.join(root,'supabase','migrations',f),path.join(dir,'supabase','migrations',f));
query(`create schema supabase_migrations;
create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);
insert into supabase_migrations.schema_migrations(version) values ${migrations.slice(0,14).map(f=>`('${f.split('_')[0]}')`).join(',')};
create table compat_fixture.cli_mode(mode text); insert into compat_fixture.cli_mode values('verify');
create table compat_fixture.cli_observations(object_name text,lock_value text,statement_value text);
create function compat_fixture.check_cli_timeout() returns event_trigger language plpgsql as $$
declare item record; v_mode text; begin
  for item in select * from pg_event_trigger_ddl_commands() loop
    if item.object_identity in ('public.signup_consent_documents','public.dwell_personalization_consents') and item.command_tag='CREATE TABLE' then
      if current_setting('lock_timeout')<>'3s' or current_setting('statement_timeout')<>'1min' then
        raise exception 'cli_timeout_missing: %/%',current_setting('lock_timeout'),current_setting('statement_timeout');
      end if;
      insert into compat_fixture.cli_observations values(item.object_identity,current_setting('lock_timeout'),current_setting('statement_timeout'));
      select mode into v_mode from compat_fixture.cli_mode;
      if v_mode='statement' and item.object_identity='public.signup_consent_documents' then perform pg_sleep(65); end if;
      if v_mode='fail016' and item.object_identity='public.dwell_personalization_consents' then raise exception 'fixture_016_failure'; end if;
    end if;
  end loop;
end $$;
create event trigger compat_cli_timeout on ddl_command_end execute function compat_fixture.check_cli_timeout();`);
for(const db of ['cli_lock','cli_statement','cli_partial']) query(`create database ${db} template postgres`);
function cli(db='postgres') {
  return new Promise((resolve,reject)=>{
    const started=Date.now();
    const child=spawn('npx',['--offline','supabase@2.116.0','db','push','--db-url',`postgresql://postgres@127.0.0.1:${port}/${db}?sslmode=disable`,'--skip-vault','--yes'],{cwd:dir,env:{PATH:process.env.PATH,HOME:process.env.HOME,NO_COLOR:'1'}});
    let output=''; child.stdout.on('data',d=>{output+=d}); child.stderr.on('data',d=>{output+=d});
    child.on('error',reject); child.on('close',code=>resolve({code,output,elapsed:Date.now()-started}));
  });
}
const result=await cli();
// First run is expected to succeed when the actual migration has SET LOCAL.
// On the old SQL the DDL event raises cli_timeout_missing (failure-first gate).
assert.equal(result.code,0,result.output);
assert.equal(query('select count(*) from compat_fixture.cli_observations'), '2');
assert.equal(query('select count(*) from supabase_migrations.schema_migrations'),'16');
console.log('CLI 2.116.0 actual 015/016 timeout and history: PASS');
function unchanged(db) {
  assert.equal(query('select count(*) from supabase_migrations.schema_migrations',db),'14');
  assert.equal(query('select count(*) from public.profiles where birth_year is not null and age_band is not null',db),'2');
  assert.equal(query("select count(*) from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='nickname'",db),'0');
  assert.equal(query("select to_regclass('public.signup_consent_documents') is null",db),'t');
}
const locker=spawn(psql,[...args,'-d','cli_lock'],{stdio:['pipe','pipe','pipe']});
let lockerError=''; locker.stderr.on('data',d=>lockerError+=d);
try {
  await new Promise((resolve,reject)=>{
    locker.stdout.on('data',d=>{if(d.toString().includes('LOCK_READY'))resolve();});
    locker.on('error',reject); locker.on('exit',code=>reject(new Error(`lock fixture exited ${code}: ${lockerError}`)));
    locker.stdin.write("begin; lock public.profiles in access exclusive mode; select 'LOCK_READY';\n");
  });
  const locked=await cli('cli_lock');
  assert.notEqual(locked.code,0); assert.match(locked.output,/lock timeout/);
  assert.ok(locked.elapsed>=2900 && locked.elapsed<15000,`lock elapsed=${locked.elapsed}`);
  console.log(`CLI lock timeout: PASS (${locked.elapsed}ms)`);
} finally { locker.stdin.end('rollback;\n'); }
await new Promise(resolve=>locker.exitCode!==null?resolve():locker.on('close',resolve));
unchanged('cli_lock');
query("update compat_fixture.cli_mode set mode='statement'",'cli_statement');
console.log('CLI statement timeout: testing actual 60-second bound...');
const timed=await cli('cli_statement');
assert.notEqual(timed.code,0); assert.match(timed.output,/statement timeout/);
assert.ok(timed.elapsed>=59000 && timed.elapsed<75000,`statement elapsed=${timed.elapsed}`);
unchanged('cli_statement');
console.log(`CLI statement timeout + full file rollback: PASS (${timed.elapsed}ms)`);
query("update compat_fixture.cli_mode set mode='fail016'",'cli_partial');
const partial=await cli('cli_partial');
assert.notEqual(partial.code,0); assert.match(partial.output,/fixture_016_failure/);
assert.equal(query('select count(*) from supabase_migrations.schema_migrations','cli_partial'),'15');
assert.equal(query("select to_regclass('public.account_course_completions') is not null and to_regclass('public.dwell_personalization_consents') is null",'cli_partial'),'t');
assert.equal(query('select count(*) from public.profiles where birth_year is not null or age_band is not null','cli_partial'),'0');
console.log('CLI 015 committed / 016 rolled back / history 015 only: PASS (no retry)');
const compatibility=spawnSync(psql,[...args,'-f',path.join(root,'test/fixtures/release-migration-compat-after.sql')],{encoding:'utf8'});
assert.equal(compatibility.status,0,compatibility.stderr);
console.log('CLI applied existing-data compatibility fixture: PASS');
