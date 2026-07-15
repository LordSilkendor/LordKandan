-- Kjør hele filen én gang i Supabase: SQL Editor → New query → Run.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text,
  global_role text not null default 'user' check (global_role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  board jsonb not null default '[]'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('viewer','editor','admin')),
  created_at timestamptz not null default now(),
  primary key (project_id,user_id)
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,display_name,global_role)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'name',split_part(new.email,'@',1)),case when lower(new.email)='pladsenschjelderup@gmail.com' then 'admin' else 'user' end)
  on conflict(id) do update set email=excluded.email;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_global_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and global_role='admin');
$$;
create or replace function public.has_project_role(pid uuid, roles text[]) returns boolean language sql stable security definer set search_path=public as $$
  select public.is_global_admin() or exists(select 1 from public.project_members where project_id=pid and user_id=auth.uid() and role=any(roles));
$$;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select to authenticated using (id=auth.uid() or public.is_global_admin());
drop policy if exists "read member projects" on public.projects;
create policy "read member projects" on public.projects for select to authenticated using (public.has_project_role(id,array['viewer','editor','admin']));
drop policy if exists "edit member projects" on public.projects;
create policy "edit member projects" on public.projects for update to authenticated using (public.has_project_role(id,array['editor','admin'])) with check (public.has_project_role(id,array['editor','admin']));
drop policy if exists "delete admin projects" on public.projects;
create policy "delete admin projects" on public.projects for delete to authenticated using (public.has_project_role(id,array['admin']));
drop policy if exists "read project members" on public.project_members;
create policy "read project members" on public.project_members for select to authenticated using (public.has_project_role(project_id,array['viewer','editor','admin']));

create or replace function public.create_project(project_name text, project_board jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare pid uuid;
begin
  if auth.uid() is null then raise exception 'Ikke innlogget'; end if;
  insert into public.projects(name,board,created_by) values(project_name,project_board,auth.uid()) returning id into pid;
  insert into public.project_members(project_id,user_id,role) values(pid,auth.uid(),'admin');
  return pid;
end; $$;

create or replace function public.set_project_member(pid uuid, member_email text, member_role text) returns void language plpgsql security definer set search_path=public as $$
declare uid uuid;
begin
  if not public.has_project_role(pid,array['admin']) then raise exception 'Ingen administratortilgang'; end if;
  if member_role not in ('viewer','editor','admin') then raise exception 'Ugyldig rolle'; end if;
  select id into uid from public.profiles where lower(email)=lower(member_email);
  if uid is null then raise exception 'Brukeren må logge inn én gang før tilgang kan gis'; end if;
  insert into public.project_members(project_id,user_id,role) values(pid,uid,member_role)
  on conflict(project_id,user_id) do update set role=excluded.role;
end; $$;

create or replace function public.remove_project_member(pid uuid, member_user_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_project_role(pid,array['admin']) then raise exception 'Ingen administratortilgang'; end if;
  delete from public.project_members where project_id=pid and user_id=member_user_id and user_id<>auth.uid();
end; $$;

create or replace function public.list_project_members(pid uuid) returns table(user_id uuid,email text,role text) language sql stable security definer set search_path=public as $$
  select pm.user_id,p.email,pm.role from public.project_members pm join public.profiles p on p.id=pm.user_id
  where pm.project_id=pid and public.has_project_role(pid,array['admin']) order by p.email;
$$;

grant execute on function public.create_project(text,jsonb) to authenticated;
grant execute on function public.set_project_member(uuid,text,text) to authenticated;
grant execute on function public.remove_project_member(uuid,uuid) to authenticated;
grant execute on function public.list_project_members(uuid) to authenticated;
