-- Execute uma vez no SQL Editor do seu projeto Supabase.
-- O servidor identifica o dono pelo JWT validado; o cliente não escolhe o usuário.
begin;
create table if not exists public.meu_saldo_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 document jsonb not null,
 revision bigint not null default 1 check (revision > 0),
 updated_at timestamptz not null default now(),
 constraint meu_saldo_document_version check (document->>'version' = '1'),
 constraint meu_saldo_document_entries check (jsonb_typeof(document->'entries') = 'array'),
 constraint meu_saldo_document_cards check (jsonb_typeof(document->'cards') = 'array')
);
alter table public.meu_saldo_accounts enable row level security;
revoke all on public.meu_saldo_accounts from anon, authenticated;
grant select on public.meu_saldo_accounts to authenticated;
-- Preserva o bloqueio administrativo mesmo se a instalação inicial for repetida.
create or replace function public.meu_saldo_has_access() returns boolean
language plpgsql stable security definer set search_path='' as $$
declare allowed boolean;
begin
 if auth.uid() is null then return false; end if;
 if to_regclass('public.meu_saldo_members') is null then return true; end if;
 execute 'select exists(select 1 from public.meu_saldo_members where user_id=$1 and active)' into allowed using auth.uid();
 return allowed;
end $$;
revoke all on function public.meu_saldo_has_access() from public,anon;
grant execute on function public.meu_saldo_has_access() to authenticated;
drop policy if exists meu_saldo_read_own on public.meu_saldo_accounts;
create policy meu_saldo_read_own on public.meu_saldo_accounts for select to authenticated using ((select auth.uid()) = user_id and (select public.meu_saldo_has_access()));
-- Escritas são feitas apenas pela função abaixo, com controle de versão atômico.
create or replace function public.save_meu_saldo(p_document jsonb, p_expected_revision bigint)
returns table(document jsonb, revision bigint)
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
 if v_user is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if not public.meu_saldo_has_access() then raise exception 'access_blocked' using errcode='42501'; end if;
 if p_document is null or octet_length(p_document::text)>5242880
 or p_document->>'version' is distinct from '1'
 or jsonb_typeof(p_document->'entries') is distinct from 'array'
 or jsonb_typeof(p_document->'cards') is distinct from 'array'
 then raise exception 'invalid_document' using errcode='22023'; end if;
 if p_expected_revision=0 then
  return query insert into public.meu_saldo_accounts as a(user_id,document) values(v_user,p_document)
  on conflict (user_id) do nothing returning a.document,a.revision;
 else
  return query update public.meu_saldo_accounts as a set document=p_document,revision=a.revision+1,updated_at=now()
  where a.user_id=v_user and a.revision=p_expected_revision returning a.document,a.revision;
 end if;
 if not found then raise exception 'finance_conflict' using errcode='40001'; end if;
end $$;
revoke all on function public.save_meu_saldo(jsonb,bigint) from public, anon;
grant execute on function public.save_meu_saldo(jsonb,bigint) to authenticated;
commit;
