-- 0001_init.sql — core schema + Row-Level Security.
--
-- Security model (see plans/02-security-plan.md §2):
--   * The application connects as role `app_user`, which is NEITHER the table owner NOR a
--     superuser. Owners/superusers BYPASS RLS, so the app role must be restricted for RLS
--     to be an actual control.
--   * Every tenant table enables RLS with a policy keyed on current_setting('app.tenant_id').
--   * FORCE ROW LEVEL SECURITY so even the table owner is subject to policy in tests.
--   * No-GUC / wrong-GUC queries return zero rows (fail closed).

begin;

-- ---------- roles ----------
-- Run once by a migration/superuser. The app connects as app_user.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user login noinherit;
  end if;
end$$;

create type membership_role as enum ('owner', 'admin', 'author', 'reviewer', 'viewer');
create type artifact_state as enum ('draft', 'published', 'archived');

-- ---------- tenants ----------
create table tenants (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  name           text not null,
  storage_prefix text not null,          -- e.g. 't/<id>/'
  created_at     timestamptz not null default now()
);

-- ---------- users (mirror of OIDC subjects) ----------
create table users (
  id         uuid primary key default gen_random_uuid(),
  oidc_sub   text unique not null,
  email      text,                       -- optional; avoid storing when account-only
  email_hash text,                       -- mbox_sha1sum when hashing is required
  created_at timestamptz not null default now()
);

-- ---------- memberships (user <-> tenant <-> role) ----------
create table memberships (
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id   uuid not null references users(id) on delete cascade,
  role      membership_role not null,
  status    text not null default 'active',
  primary key (tenant_id, user_id)
);

-- ---------- artifacts ----------
create table artifacts (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references tenants(id) on delete cascade,
  iri_seed                    text not null,
  current_published_version_id uuid,
  created_by                  uuid references users(id),
  created_at                  timestamptz not null default now(),
  deleted_at                  timestamptz          -- soft-delete only
);
create index on artifacts (tenant_id) where deleted_at is null;

-- ---------- artifact_versions (immutable once published) ----------
create table artifact_versions (
  id                uuid primary key default gen_random_uuid(),
  artifact_id       uuid not null references artifacts(id) on delete cascade,
  tenant_id         uuid not null references tenants(id) on delete cascade,
  version           integer not null,
  state             artifact_state not null default 'draft',
  document          jsonb not null,
  created_by        uuid references users(id),
  created_at        timestamptz not null default now(),
  published_at      timestamptz,
  parent_version_id uuid references artifact_versions(id),
  unique (artifact_id, version)
);
create index on artifact_versions (tenant_id, artifact_id);

-- Enforce immutability of published versions: only archive transition allowed.
create or replace function forbid_published_mutation() returns trigger as $$
begin
  if old.state = 'published' then
    if not (new.state = 'archived'
            and new.document is not distinct from old.document
            and new.version = old.version
            and new.artifact_id = old.artifact_id) then
      raise exception 'published versions are immutable (only archive is allowed)';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_version_immutable
  before update on artifact_versions
  for each row execute function forbid_published_mutation();

-- ---------- assets ----------
create table assets (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  artifact_id  uuid references artifacts(id) on delete cascade,
  r2_key       text not null,             -- always begins with tenant storage_prefix
  kind         text not null,
  content_type text not null,
  sha256       text not null,
  width        integer,
  height       integer,
  created_at   timestamptz not null default now()
);
create index on assets (tenant_id);

-- ---------- exports ----------
create table exports (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  version_id  uuid not null references artifact_versions(id) on delete cascade,
  profile     text not null check (profile in ('xapi', 'cmi5')),
  activity_id text not null,
  r2_key      text,
  status      text not null default 'queued',
  created_at  timestamptz not null default now()
);
create index on exports (tenant_id);

-- ---------- audit_log (append-only, hash-chained) ----------
create table audit_log (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null,
  actor_id    uuid,
  action      text not null,
  target_type text,
  target_id   text,
  meta        jsonb not null default '{}',
  at          timestamptz not null default now(),
  prev_hash   text,
  hash        text not null
);
create index on audit_log (tenant_id, at desc);

-- ================= RLS =================
-- helper to fetch the tenant GUC, NULL-safe (missing_ok = true)
create or replace function current_tenant() returns uuid as $$
  select nullif(current_setting('app.tenant_id', true), '')::uuid;
$$ language sql stable;

do $$
declare t text;
begin
  foreach t in array array[
    'artifacts','artifact_versions','assets','exports','memberships','audit_log'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('alter table %I force row level security;', t);
    execute format($p$
      create policy tenant_isolation on %I
        using (tenant_id = current_tenant())
        with check (tenant_id = current_tenant());
    $p$, t);
  end loop;
end$$;

-- audit_log is append-only for the app role: allow INSERT/SELECT, deny UPDATE/DELETE.
revoke update, delete on audit_log from public;

-- grants: app_user gets DML but is NOT the owner (RLS applies).
grant select, insert, update, delete on all tables in schema public to app_user;
grant usage, select on all sequences in schema public to app_user;
revoke update, delete on audit_log from app_user;

commit;

-- Sanity checks to run in CI (see plans/02 §2):
--   set app.tenant_id = '<A>'  -> only tenant A rows visible
--   reset app.tenant_id        -> zero rows (fail closed)
--   attempt update of a published version -> error
