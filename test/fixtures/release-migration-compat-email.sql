-- Existing Auth server sync runs as the owner of the SECURITY DEFINER trigger,
-- not the Auth caller. Exercise real SQL roles rather than JWT/string assertions.
do $$ begin
  begin
    insert into auth.users(id,raw_user_meta_data) values ('c0000000-0000-4000-8000-000000000009',
      '{"signup_request_id":"c2000000-0000-4000-8000-000000000009","required_consents":{"terms":{"document_id":"terms-of-service","document_version":"fixture-v1","accepted":true},"privacy":{"document_id":"privacy-policy","document_version":"fixture-v1","accepted":true}}}');
    raise exception 'missing documents accepted';
  exception when raise_exception then if sqlerrm<>'signup_consent_required' then raise; end if; end;
end $$;
insert into public.signup_consent_documents values
 ('terms-of-service','fixture-v1','https://fixture.invalid/terms',true,'2026-09-01'),
 ('privacy-policy','fixture-v1','https://fixture.invalid/privacy',true,'2026-09-01');
set role supabase_auth_admin;
do $$ declare consent jsonb; begin
  foreach consent in array array[
    '{"signup_request_id":"c2000000-0000-4000-8000-000000000009","required_consents":{"terms":{"document_id":"terms-of-service","document_version":"fixture-v1","accepted":false},"privacy":{"document_id":"privacy-policy","document_version":"fixture-v1","accepted":true}}}'::jsonb,
    '{"signup_request_id":"c2000000-0000-4000-8000-000000000009","required_consents":{"terms":{"document_id":"terms-of-service","document_version":"wrong","accepted":true},"privacy":{"document_id":"privacy-policy","document_version":"fixture-v1","accepted":true}}}'::jsonb
  ] loop
    begin
      insert into auth.users(id,raw_user_meta_data) values ('c0000000-0000-4000-8000-000000000009',consent);
      raise exception 'invalid consent accepted';
    exception when raise_exception then if sqlerrm<>'signup_consent_required' then raise; end if; end;
  end loop;
end $$;
insert into auth.users(id,raw_user_meta_data) values ('c0000000-0000-4000-8000-000000000003',
 '{"signup_request_id":"c2000000-0000-4000-8000-000000000003","required_consents":{"terms":{"document_id":"terms-of-service","document_version":"fixture-v1","accepted":true},"privacy":{"document_id":"privacy-policy","document_version":"fixture-v1","accepted":true}}}');
update auth.users set email_confirmed_at='2026-09-07T01:00:00Z' where id='c0000000-0000-4000-8000-000000000003';
reset role;
do $$ begin
  if not exists(select 1 from public.profiles where id='c0000000-0000-4000-8000-000000000003' and email_verified_at='2026-09-07T01:00:00Z' and birth_year is null and age_band is null) then raise exception 'new email sync/no-age failed'; end if;
  if (select count(*) from public.account_consent_records)<>2 then raise exception 'consent evidence lost'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000003',false);
select set_config('request.jwt.claims','{"is_anonymous":false}',false);
do $$ declare assignment text; begin
  foreach assignment in array array['email_verified_at=now()','id=gen_random_uuid()','terms_agreed_at=now()','privacy_agreed_at=now()'] loop
    begin
      execute 'update public.profiles set '||assignment;
      raise exception 'client mutation allowed: %',assignment;
    exception when insufficient_privilege then null; end;
  end loop;
  perform public.update_account_nickname('compat-nickname','fixture');
  if (select count(*) from public.profiles)<>1 then raise exception 'own profile SELECT failed'; end if;
end $$;
reset role;
-- An administrator does not get a blanket immutable-field exception either.
do $$ declare assignment text; begin
  foreach assignment in array array['email_verified_at=now()','id=gen_random_uuid()','terms_agreed_at=now()','privacy_agreed_at=now()','birth_year=1991','age_band=''30s'''] loop
    begin
      execute 'update public.profiles set '||assignment||' where id=''c0000000-0000-4000-8000-000000000003''';
      raise exception 'admin direct mutation allowed: %',assignment;
    exception when raise_exception then
      if sqlerrm <> 'immutable_profile_field' then raise; end if;
    end;
  end loop;
end $$;
select 'compat email: PASS';
