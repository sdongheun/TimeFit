-- Fixed synthetic pre-015 accounts. No real data, no trigger bypass.
insert into auth.users(id,raw_user_meta_data,email_confirmed_at) values
 ('c0000000-0000-4000-8000-000000000001','{"birth_year":1990,"age_band":"30s","terms_agreed_at":"2026-08-01T00:00:00Z","privacy_agreed_at":"2026-08-02T00:00:00Z","unrelated":{"preserve":true}}',null),
 ('c0000000-0000-4000-8000-000000000002','{"birth_year":2000,"age_band":"20s","unrelated":"keep"}','2026-08-03T00:00:00Z');
insert into public.courses(id,user_id,origin_label,origin_lat,origin_lon,starts_at,ends_at,mode,total_move_min,total_dwell_min,buffer_min,recommendation_snapshot)
values ('c1000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','synthetic',35,129,'2026-08-04T00:00:00Z','2026-08-04T01:00:00Z','walk',10,20,5,'{"fixture":true}');
insert into public.course_stops(course_id,stop_order,place_content_id,title,category,lat,lon,planned_dwell_min,dwell_source)
values ('c1000000-0000-4000-8000-000000000001',1,'synthetic-stop','fixture','cafe',35,129,20,'fixture');
insert into public.course_legs(course_id,leg_order,from_kind,to_kind,mode,move_min,source)
values ('c1000000-0000-4000-8000-000000000001',1,'origin','stop','walk',5,'fixture'),
 ('c1000000-0000-4000-8000-000000000001',2,'stop','destination','walk',5,'fixture');
insert into public.course_feedback(course_id,user_id,rating) values ('c1000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001',4);
insert into public.recommendation_events(user_id,event_type) values ('c0000000-0000-4000-8000-000000000001','course_saved');
insert into public.route_proxy_cache(provider,mode,from_poi_id,to_poi_id,catalog_version,total_min,steps,expires_at)
values ('tmap','walk','synthetic-a','synthetic-b','fixture',5,'[{"min":5,"paths":[[[129,35],[129.001,35.001]]]}]','2026-09-08T00:00:00Z');
create schema compat_fixture;
create table compat_fixture.before_rows(table_name text primary key, rows jsonb);
do $$ declare name text; snapshot jsonb; begin
  foreach name in array array['profiles','courses','course_stops','course_legs','course_feedback','recommendation_events','route_proxy_cache'] loop
    execute format('select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.%I t',name) into snapshot;
    insert into compat_fixture.before_rows values(name,snapshot);
  end loop;
  insert into compat_fixture.before_rows select 'auth.users',jsonb_agg(to_jsonb(u) order by id) from auth.users u;
end $$;
