-- Phase 1b review fix: Postgres knows a few pseudo zones ("Factory",
-- "posixrules", "localtime") and legacy abbreviations that browsers can't
-- format. Accept only UTC or IANA "Area/Location" names that Postgres knows.
create or replace function private.validate_timezone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.timezone is distinct from 'UTC'
     and (new.timezone !~ '^[A-Z][A-Za-z_]+(/[A-Za-z0-9_+-]+)+$'
          or not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone)) then
    raise exception 'unknown timezone "%"', new.timezone using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_timezone() from public, anon, authenticated;
