-- Metadata only. Run on the disposable fixture, never a connected production DB.
select c.relname, coalesce(r.rolname,'PUBLIC') as granted_to, a.privilege_type,
       pg_get_userbyid(a.grantor) as grantor
from pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join lateral aclexplode(c.relacl) a
left join pg_roles r on r.oid=a.grantee
where n.nspname='public' and c.relkind='r'
  and a.privilege_type in ('TRUNCATE','REFERENCES','TRIGGER')
  and (a.grantee=0 or r.rolname in ('anon','authenticated'))
order by c.relname,granted_to,a.privilege_type;
select pg_get_userbyid(roleid) as granted_role, pg_get_userbyid(member) as member
from pg_auth_members
where member in ('anon'::regrole,'authenticated'::regrole);
select p.proname,pg_get_userbyid(p.proowner) as owner,p.prosecdef,t.tgname,t.tgenabled
from pg_proc p join pg_trigger t on t.tgfoid=p.oid
where p.proname in ('sync_profile_email_verification','guard_profile_changes');
