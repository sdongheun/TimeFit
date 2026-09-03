\set ON_ERROR_STOP on

create or replace function public.assert_invalid_route_steps(p_steps jsonb)
returns void
language plpgsql
as $$
begin
  begin
    perform public.route_proxy_put_route(
      'kakao', 'walk', 'fixture-from', 'fixture-to', 'geometry-v1',
      10, p_steps, timezone('utc', now()) + interval '1 hour'
    );
    raise exception 'expected_invalid_route_result';
  exception
    when raise_exception then
      if sqlerrm <> 'invalid_route_result' then
        raise;
      end if;
  end;
end;
$$;

do $$
declare
  v_valid_steps jsonb := '[{"min":3,"distanceM":210,"instruction":"walk","paths":[[[129.0601,35.1572],[129.0611,35.1582]],[[129.0611,35.1582],[129.0621,35.1592]]]}]'::jsonb;
  v_cached_steps jsonb;
  v_many_points jsonb;
  v_many_paths jsonb;
begin
  perform public.route_proxy_put_route(
    'kakao', 'walk', 'valid-from', 'valid-to', 'geometry-v1',
    3, v_valid_steps, timezone('utc', now()) + interval '1 hour'
  );
  select steps into v_cached_steps
  from public.route_proxy_get_route(
    'kakao', 'walk', 'valid-from', 'valid-to', 'geometry-v1', timezone('utc', now())
  );
  if v_cached_steps is distinct from v_valid_steps then
    raise exception 'valid_geometry_round_trip_failed';
  end if;

  perform public.route_proxy_put_route(
    'kakao', 'walk', 'legacy-from', 'legacy-to', 'geometry-v1',
    2, '[{"min":2,"distanceM":15,"instruction":"legacy"}]'::jsonb,
    timezone('utc', now()) + interval '1 hour'
  );
  select steps into v_cached_steps
  from public.route_proxy_get_route(
    'kakao', 'walk', 'legacy-from', 'legacy-to', 'geometry-v1', timezone('utc', now())
  );
  if (v_cached_steps -> 0) ? 'paths' then
    raise exception 'legacy_step_gained_paths';
  end if;

  perform public.route_proxy_put_route(
    'kakao', 'walk', 'empty-from', 'empty-to', 'geometry-v1',
    1, '[]'::jsonb, timezone('utc', now()) + interval '1 hour'
  );
  select steps into v_cached_steps
  from public.route_proxy_get_route(
    'kakao', 'walk', 'empty-from', 'empty-to', 'geometry-v1', timezone('utc', now())
  );
  if v_cached_steps <> '[]'::jsonb then
    raise exception 'empty_steps_regression';
  end if;

  select jsonb_build_array(jsonb_build_object(
    'min', 3,
    'paths', jsonb_build_array(jsonb_agg(jsonb_build_array(129.0, 35.0)))
  )) into v_many_points
  from generate_series(1, 513);
  perform public.assert_invalid_route_steps(v_many_points);

  select jsonb_build_array(jsonb_build_object(
    'min', 3,
    'paths', jsonb_agg(jsonb_build_array(
      jsonb_build_array(129.0, 35.0), jsonb_build_array(129.1, 35.1)
    ))
  )) into v_many_paths
  from generate_series(1, 33);
  perform public.assert_invalid_route_steps(v_many_paths);

  perform public.assert_invalid_route_steps('[{"min":3,"paths":[[["129.0",35.0],[129.1,35.1]]]}]'::jsonb);
  perform public.assert_invalid_route_steps(jsonb_build_array(jsonb_build_object(
    'min', 3,
    'paths', jsonb_build_array(jsonb_build_array(
      jsonb_build_array(to_jsonb('NaN'::numeric), to_jsonb(35.0)),
      jsonb_build_array(129.1, 35.1)
    ))
  )));
  perform public.assert_invalid_route_steps('[{"min":3,"paths":[[[181,35.0],[129.1,35.1]]]}]'::jsonb);
  perform public.assert_invalid_route_steps('[{"min":3,"paths":[[[129.0,-91],[129.1,35.1]]]}]'::jsonb);
  perform public.assert_invalid_route_steps('[{"min":3,"paths":[[[{"lon":129},35.0],[129.1,35.1]]]}]'::jsonb);
  perform public.assert_invalid_route_steps('[{"min":3,"paths":[{"points":[[129.0,35.0],[129.1,35.1]]}]}]'::jsonb);
  perform public.assert_invalid_route_steps('[{"min":3,"paths":[[{"lon":129,"lat":35},[129.1,35.1]]]}]'::jsonb);
  perform public.assert_invalid_route_steps('[{"min":3,"paths":[[[129.0,35.0]]]}]'::jsonb);
  perform public.assert_invalid_route_steps('[{"min":3,"paths":[[[129.0,35.0],[129.1,35.1]]],"raw":{"provider":"body"}}]'::jsonb);

  if to_regprocedure('public.route_proxy_put_route(text,text,text,text,text,integer,jsonb,timestamp with time zone)') is null
    or to_regprocedure('public.route_proxy_complete_fetch_lease(text,text,text,text,text,uuid,integer,jsonb,timestamp with time zone)') is null then
    raise exception 'rpc_signature_changed';
  end if;

  if not has_function_privilege(
      'service_role',
      'public.route_proxy_put_route(text,text,text,text,text,integer,jsonb,timestamp with time zone)',
      'execute'
    )
    or has_function_privilege(
      'anon',
      'public.route_proxy_put_route(text,text,text,text,text,integer,jsonb,timestamp with time zone)',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'public.route_proxy_put_route(text,text,text,text,text,integer,jsonb,timestamp with time zone)',
      'execute'
    ) then
    raise exception 'rpc_permission_regression';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('route_proxy_cache', 'route_proxy_fetch_lease')
      and column_name in (
        'user_id', 'profile_id', 'origin_lat', 'origin_lon',
        'destination_lat', 'destination_lon', 'search_query', 'raw_response'
      )
  ) then
    raise exception 'private_route_storage_regression';
  end if;
end;
$$;

drop function public.assert_invalid_route_steps(jsonb);
