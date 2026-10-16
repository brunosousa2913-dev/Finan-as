-- Execute depois de setup.sql. Não promove automaticamente nenhum usuário.
begin;
create table if not exists public.meu_saldo_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null,
 name text not null default '',
 role text not null default 'user' check(role in ('admin','user')),
 active boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.meu_saldo_members enable row level security;
revoke all on public.meu_saldo_members from public,anon,authenticated;
grant select on public.meu_saldo_members to authenticated;
grant all on public.meu_saldo_members to service_role;
drop policy if exists meu_saldo_member_self on public.meu_saldo_members;
create policy meu_saldo_member_self on public.meu_saldo_members for select to authenticated using((select auth.uid())=user_id);
-- Cadastros antigos ficam pendentes, sem perder contas financeiras.
insert into public.meu_saldo_members(user_id,email)
select id,coalesce(email,'') from auth.users on conflict(user_id) do nothing;
create or replace function public.meu_saldo_new_member() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.meu_saldo_members(user_id,email) values(new.id,coalesce(new.email,'')) on conflict(user_id) do nothing;
 return new;
end $$;
revoke all on function public.meu_saldo_new_member() from public,anon,authenticated;
drop trigger if exists meu_saldo_member_created on auth.users;
create trigger meu_saldo_member_created after insert on auth.users for each row execute function public.meu_saldo_new_member();
-- O bloqueio é consultado a cada leitura/escrita, mesmo com JWT ainda válido.
drop policy if exists meu_saldo_read_own on public.meu_saldo_accounts;
create policy meu_saldo_read_own on public.meu_saldo_accounts for select to authenticated using (
 (select auth.uid())=user_id and exists(select 1 from public.meu_saldo_members m where m.user_id=(select auth.uid()) and m.active)
);
create or replace function public.save_meu_saldo(p_document jsonb,p_expected_revision bigint)
returns table(document jsonb,revision bigint)
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if not exists(select 1 from public.meu_saldo_members m where m.user_id=v_user and m.active)
 then raise exception 'access_blocked' using errcode='42501'; end if;
 if p_document is null or octet_length(p_document::text)>5242880
 or p_document->>'version' is distinct from '1'
 or jsonb_typeof(p_document->'entries') is distinct from 'array'
 or jsonb_typeof(p_document->'cards') is distinct from 'array'
 then raise exception 'invalid_document' using errcode='22023'; end if;
 if p_expected_revision=0 then
  return query insert into public.meu_saldo_accounts as a(user_id,document) values(v_user,p_document)
  on conflict(user_id) do nothing returning a.document,a.revision;
 else
  return query update public.meu_saldo_accounts as a set document=p_document,revision=a.revision+1,updated_at=now()
  where a.user_id=v_user and a.revision=p_expected_revision returning a.document,a.revision;
 end if;
 if not found then raise exception 'finance_conflict' using errcode='40001'; end if;
end $$;
revoke all on function public.save_meu_saldo(jsonb,bigint) from public,anon;
grant execute on function public.save_meu_saldo(jsonb,bigint) to authenticated;
notify pgrst,'reload schema';
commit;

-- 1. Crie sua conta em Authentication > Users > Add user > Create new user.
-- 2. Marque Auto Confirm User. Não informe sua senha no SQL.
-- 3. Substitua somente o e-mail abaixo e execute depois de admin.sql.
do $$
declare v_id uuid;
begin
 select id into v_id from auth.users where lower(email)=lower('brunosousa2913@gmail.com');
 if v_id is null then raise exception 'Conta não encontrada: crie a conta em Authentication > Users e confira o e-mail.'; end if;
 insert into public.meu_saldo_members(user_id,email,role,active)
 select id,email,'admin',true from auth.users where id=v_id
 on conflict(user_id) do update set role='admin',active=true,email=excluded.email;
end $$;
