-- Forward-only fix for the existing pgcrypto placement; never relocate the extension.
-- Run in the migration transaction. Public contracts, ACLs, search_path and hash inputs stay intact.
set local lock_timeout = '3s';
set local statement_timeout = '60s';

do $migration$
declare
  v_schema text;
  v_extension oid;
  v_target record;
  v_function oid;
  v_source text;
  v_definition text;
begin
  select e.oid,n.nspname into strict v_extension,v_schema
  from pg_catalog.pg_extension e join pg_catalog.pg_namespace n on n.oid=e.extnamespace
  where e.extname='pgcrypto';
  if v_schema not in ('public','extensions') then
    raise exception 'unexpected_pgcrypto_schema';
  end if;
  -- Refuse an unrelated function shadowing the extension's required overload.
  if not exists (
    select 1 from pg_catalog.pg_depend d
    where d.classid='pg_catalog.pg_proc'::regclass
      and d.objid=pg_catalog.to_regprocedure(pg_catalog.format('%I.digest(bytea,text)',v_schema))
      and d.refclassid='pg_catalog.pg_extension'::regclass
      and d.refobjid=v_extension and d.deptype='e'
  ) then raise exception 'pgcrypto_digest_dependency_mismatch'; end if;

  for v_target in select * from (values
    ('public.write_account_course_completion(text,text,bigint,bigint,jsonb)','c6f242c0fbeab2864936caef61b2d3cf'),
    ('public.import_guest_course_completions(uuid,jsonb)','7f2652ddc9ce6d9bcb7df30769cccd34'),
    ('public.submit_dwell_completion_sample(text,text,smallint,text,text,text,integer,bigint,uuid,uuid,bigint)','973420697816d334ca93f9b158eacadf')
  ) as targets(signature,source_md5)
  loop
    v_function:=pg_catalog.to_regprocedure(v_target.signature);
    select prosrc into strict v_source from pg_catalog.pg_proc where oid=v_function;
    -- Exact original body guard: no broad rewrite of concurrently modified functions.
    if pg_catalog.md5(v_source)<>v_target.source_md5 then
      raise exception 'digest_target_source_mismatch: %',v_target.signature;
    end if;
    v_definition:=pg_catalog.pg_get_functiondef(v_function);
    execute pg_catalog.replace(v_definition,'digest(',pg_catalog.format('%I.digest(',v_schema));
  end loop;
end;
$migration$;
