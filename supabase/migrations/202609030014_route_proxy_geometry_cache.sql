-- DB-ROUTE-GEOMETRY-01: retain only bounded WGS84 paths for public POI routes.
-- Private origin/destination routes never use this cache; no identity, coordinate
-- columns, provider response body, request URL, or credential is persisted.

create or replace function public.route_proxy_put_route(
  p_provider text,
  p_mode text,
  p_from_poi_id text,
  p_to_poi_id text,
  p_catalog_version text,
  p_total_min integer,
  p_steps jsonb,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_steps jsonb := '[]'::jsonb;
  v_step jsonb;
  v_clean_paths jsonb;
  v_path jsonb;
  v_clean_path jsonb;
  v_point jsonb;
  v_lon numeric;
  v_lat numeric;
  v_path_count integer := 0;
  v_point_count integer := 0;
  v_now timestamptz := timezone('utc', now());
begin
  if p_provider is null or p_provider not in ('kakao', 'tmap')
    or p_mode is null or p_mode not in ('walk', 'transit')
    or p_from_poi_id is null or char_length(p_from_poi_id) not between 1 and 160
    or p_to_poi_id is null or char_length(p_to_poi_id) not between 1 and 160
    or p_catalog_version is null or char_length(p_catalog_version) not between 1 and 120
    or p_total_min is null or p_total_min not between 1 and 1440
    or p_expires_at is null or p_expires_at <= v_now or p_expires_at > v_now + interval '24 hours' then
    raise exception 'invalid_route_result';
  end if;
  if jsonb_typeof(coalesce(p_steps, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_route_result';
  end if;
  if jsonb_array_length(coalesce(p_steps, '[]'::jsonb)) > 32 then
    raise exception 'invalid_route_result';
  end if;

  for v_step in
    select element.value
    from jsonb_array_elements(coalesce(p_steps, '[]'::jsonb)) as element(value)
  loop
    if jsonb_typeof(v_step) <> 'object' then
      raise exception 'invalid_route_result';
    end if;

    if exists (
      select 1
      from jsonb_object_keys(v_step) as allowed(step_key)
      where step_key not in ('min', 'distanceM', 'instruction', 'paths')
    ) then
      raise exception 'invalid_route_result';
    end if;

    if not (v_step ? 'min')
      or jsonb_typeof(v_step -> 'min') <> 'number'
      or (v_step ->> 'min') !~ '^[0-9]+$' then
      raise exception 'invalid_route_result';
    end if;
    if (v_step ->> 'min')::numeric not between 1 and 1440 then
      raise exception 'invalid_route_result';
    end if;

    if v_step ? 'distanceM' then
      if jsonb_typeof(v_step -> 'distanceM') <> 'number'
        or (v_step ->> 'distanceM') !~ '^[0-9]+$' then
        raise exception 'invalid_route_result';
      end if;
      if (v_step ->> 'distanceM')::numeric > 2147483647 then
        raise exception 'invalid_route_result';
      end if;
    end if;
    if v_step ? 'instruction' and jsonb_typeof(v_step -> 'instruction') <> 'string' then
      raise exception 'invalid_route_result';
    end if;

    v_clean_paths := '[]'::jsonb;
    if v_step ? 'paths' then
      if jsonb_typeof(v_step -> 'paths') <> 'array' then
        raise exception 'invalid_route_result';
      end if;

      for v_path in
        select path_element.value
        from jsonb_array_elements(v_step -> 'paths') as path_element(value)
      loop
        v_path_count := v_path_count + 1;
        if v_path_count > 32 or jsonb_typeof(v_path) <> 'array' then
          raise exception 'invalid_route_result';
        end if;
        if jsonb_array_length(v_path) < 2 then
          raise exception 'invalid_route_result';
        end if;

        v_clean_path := '[]'::jsonb;
        for v_point in
          select point_element.value
          from jsonb_array_elements(v_path) as point_element(value)
        loop
          v_point_count := v_point_count + 1;
          if v_point_count > 512 or jsonb_typeof(v_point) <> 'array' then
            raise exception 'invalid_route_result';
          end if;
          if jsonb_array_length(v_point) <> 2 then
            raise exception 'invalid_route_result';
          end if;
          if jsonb_typeof(v_point -> 0) <> 'number'
            or jsonb_typeof(v_point -> 1) <> 'number' then
            raise exception 'invalid_route_result';
          end if;

          v_lon := (v_point ->> 0)::numeric;
          v_lat := (v_point ->> 1)::numeric;
          if v_lon not between -180 and 180 or v_lat not between -90 and 90 then
            raise exception 'invalid_route_result';
          end if;

          v_clean_path := v_clean_path || jsonb_build_array(v_point);
        end loop;
        v_clean_paths := v_clean_paths || jsonb_build_array(v_clean_path);
      end loop;
    end if;

    v_steps := v_steps || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'min', (v_step ->> 'min')::integer,
      'distanceM', case when v_step ? 'distanceM' then (v_step ->> 'distanceM')::integer end,
      'instruction', case when v_step ? 'instruction' then left(v_step ->> 'instruction', 240) end,
      'paths', case when v_step ? 'paths' then v_clean_paths end
    )));
  end loop;

  insert into public.route_proxy_cache (
    provider, mode, from_poi_id, to_poi_id, catalog_version, total_min, steps, expires_at
  ) values (
    p_provider, p_mode, p_from_poi_id, p_to_poi_id, p_catalog_version, p_total_min, v_steps, p_expires_at
  )
  on conflict (provider, mode, from_poi_id, to_poi_id, catalog_version) do update
  set total_min = excluded.total_min,
      steps = excluded.steps,
      expires_at = excluded.expires_at,
      updated_at = v_now;
end;
$$;

revoke all on function public.route_proxy_put_route(text, text, text, text, text, integer, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.route_proxy_put_route(text, text, text, text, text, integer, jsonb, timestamptz) to service_role;
