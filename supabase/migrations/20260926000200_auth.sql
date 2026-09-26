-- ============================================================================
-- StockSense — Migration 2: authentication glue
-- Supabase Auth owns credentials (SystemArchitecture.md §6). This migration
-- keeps public.profiles in sync with auth.users and provides the Login-ID
-- lookups that the login / sign-up screens need (SystemDesign.md §5).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Create a profile row whenever a Supabase Auth user is created.
-- Sign-up metadata: { login_id, full_name, role }
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_login_id text;
  v_role     text;
begin
  v_login_id := nullif(trim(coalesce(new.raw_user_meta_data ->> 'login_id', '')), '');
  if v_login_id is null then
    -- Fallback keeps the 6–12 character rule ("user" + 8 hex chars = 12).
    v_login_id := 'user' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  v_role := upper(coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'INVENTORY_MANAGER'));
  if v_role not in ('INVENTORY_MANAGER', 'WAREHOUSE_STAFF') then
    v_role := 'INVENTORY_MANAGER';
  end if;

  insert into public.profiles (id, login_id, email, full_name, role)
  values (
    new.id,
    v_login_id,
    lower(new.email),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    v_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email aligned if the auth email changes.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Login-ID helpers (callable before authentication)
-- ---------------------------------------------------------------------------

-- Used by the sign-up form to enforce "Login ID must be unique" up front.
create or replace function public.login_id_available(p_login_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1 from public.profiles where lower(login_id) = lower(trim(p_login_id))
  );
$$;

-- Used by the login form: "Login ID / email". Supabase signs in by email, so a
-- Login ID is resolved to its email first. Returns NULL when unknown; the UI
-- always shows the same "Invalid Login ID or Password" message.
create or replace function public.email_for_login_id(p_login_id text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select email from public.profiles where lower(login_id) = lower(trim(p_login_id)) limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Role helpers used by RLS policies and functions
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_inventory_manager()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select role = 'INVENTORY_MANAGER' from public.profiles where id = auth.uid()), false);
$$;
