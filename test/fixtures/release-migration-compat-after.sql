-- User approved exact legacy age deletion. No other business fields may change.
update compat_fixture.before_rows set rows=(
  select jsonb_agg(jsonb_set(item,'{raw_user_meta_data}',(item->'raw_user_meta_data')-'birth_year'-'age_band') order by item->>'id')
  from jsonb_array_elements(rows) item
) where table_name='auth.users';
update compat_fixture.before_rows set rows=(
  select jsonb_agg((item-'updated_at')||'{"birth_year":null,"age_band":null}'::jsonb order by ((item-'updated_at')||'{"birth_year":null,"age_band":null}'::jsonb)::text)
  from jsonb_array_elements(rows) item
) where table_name='profiles';
do $$ declare entry record; actual jsonb; begin
  for entry in select * from compat_fixture.before_rows loop
    if entry.table_name='auth.users' then
      select jsonb_agg(to_jsonb(u) order by id) into actual from auth.users u;
    elsif entry.table_name='profiles' then
      select jsonb_agg(to_jsonb(t)-'nickname'-'nickname_updated_at'-'updated_at' order by (to_jsonb(t)-'nickname'-'nickname_updated_at'-'updated_at')::text) into actual from public.profiles t;
    elsif entry.table_name='courses' then
      select jsonb_agg(to_jsonb(t)-'client_request_id' order by (to_jsonb(t)-'client_request_id')::text) into actual from public.courses t;
    else
      execute format('select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.%I t',entry.table_name) into actual;
    end if;
    if actual is distinct from entry.rows then raise exception 'upgrade changed existing %',entry.table_name; end if;
  end loop;
  if exists(select 1 from public.account_consent_records) then raise exception 'legacy consent fabricated'; end if;
end $$;
-- Registry absent: exact explicit consent still cannot claim nonexistent documents.
do $$ begin
  begin
    insert into auth.users(id,raw_user_meta_data) values ('c0000000-0000-4000-8000-000000000004','{"signup_request_id":"c2000000-0000-4000-8000-000000000004","required_consents":{"terms":{"accepted":true,"document_id":"terms-of-service","document_version":"fixture-v1"},"privacy":{"accepted":true,"document_id":"privacy-policy","document_version":"fixture-v1"}}}');
    raise exception 'missing documents accepted';
  exception when raise_exception then if sqlerrm<>'signup_consent_required' then raise; end if; end;
end $$;
set role supabase_auth_admin;
update auth.users set email_confirmed_at='2026-09-07T01:00:00Z' where id='c0000000-0000-4000-8000-000000000001';
reset role;
do $$ begin
  if not exists(select 1 from public.profiles where id='c0000000-0000-4000-8000-000000000001' and email_verified_at='2026-09-07T01:00:00Z') then raise exception 'legacy email sync failed'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000001',false);
select set_config('request.jwt.claims','{"is_anonymous":false}',false);
do $$ begin
  if (select count(*) from public.courses)<>1 or (select count(*) from public.course_stops)<>1 or (select count(*) from public.course_legs)<>2 then raise exception 'legacy owner graph inaccessible'; end if;
  perform public.update_account_nickname('legacy-nickname','fixture');
end $$;
select set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000002',false);
do $$ begin if exists(select 1 from public.courses) then raise exception 'B sees A'; end if; end $$;
select set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000001',false);
select set_config('request.jwt.claims','{"is_anonymous":true}',false);
do $$ begin if exists(select 1 from public.profiles) or exists(select 1 from public.courses) then raise exception 'anonymous sees member'; end if; end $$;
reset role;
\ir release-migration-compat-email.sql
\ir release-migration-compat-privileges.sql
select 'compat populated 001-014 -> 015 -> 016: PASS';
