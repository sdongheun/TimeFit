-- Actual forbidden statements run only in a disposable cluster. Exception blocks
-- roll successful attacks back as well, so a failing assertion cannot destroy data.
create function public.compat_noop() returns trigger language plpgsql as $$ begin return new; end $$;
create schema compat_privileges;
grant usage,create on schema compat_privileges to anon,authenticated;
create function compat_privileges.assert_denied() returns void language plpgsql security invoker as $$ declare name text; begin
  foreach name in array array['profiles','courses','course_stops','course_legs','course_feedback','recommendation_events'] loop
    begin
      execute format('truncate public.%I cascade',name);
      raise exception 'TRUNCATE allowed: %',name;
    exception when insufficient_privilege then null; end;
    begin
      execute format('create table compat_privileges.forbidden_reference (id uuid references public.%I(id))',name);
      raise exception 'REFERENCES allowed: %',name;
    exception when insufficient_privilege then null; end;
    begin
      execute format('create trigger forbidden_trigger before insert on public.%I for each row execute function public.compat_noop()',name);
      raise exception 'TRIGGER allowed: %',name;
    exception when insufficient_privilege then null; end;
    if current_setting('server_version_num')::integer >= 170000 then
      begin
        execute format('reindex table public.%I',name);
        raise exception 'MAINTAIN REINDEX allowed: %',name;
      exception when insufficient_privilege then null; end;
    end if;
  end loop;
end $$;
set role authenticated;
select compat_privileges.assert_denied();
reset role;
set role anon;
select compat_privileges.assert_denied();
reset role;
do $$ declare name text; role_name text; priv text; begin
  foreach name in array array['profiles','courses','course_stops','course_legs','course_feedback','recommendation_events'] loop
    foreach role_name in array array['anon','authenticated'] loop
      foreach priv in array array['TRUNCATE','REFERENCES','TRIGGER'] loop
        if has_table_privilege(role_name,'public.'||name,priv) then raise exception 'residual privilege %.% %',role_name,name,priv; end if;
      end loop;
      if current_setting('server_version_num')::integer >= 170000 then
        if has_table_privilege(role_name,'public.'||name,'MAINTAIN') then raise exception 'residual MAINTAIN %.%',role_name,name; end if;
      end if;
    end loop;
    if current_setting('server_version_num')::integer >= 170000 then
      if not has_table_privilege('service_role','public.'||name,'MAINTAIN') then raise exception 'service MAINTAIN changed'; end if;
    end if;
    foreach priv in array array['SELECT','INSERT','UPDATE','DELETE'] loop
      if not has_table_privilege('service_role','public.'||name,priv) then raise exception 'service grant changed: %.%',name,priv; end if;
    end loop;
  end loop;
end $$;
select 'compat privileges: PASS';
