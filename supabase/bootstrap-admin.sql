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
