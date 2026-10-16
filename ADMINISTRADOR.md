# Administração de usuários — versão 6.0

A tela **Administrar usuários** permite cadastrar nome, e-mail e senha inicial, listar usuários, bloquear e desbloquear. Ela aparece somente para administradores ativos. Usuários comuns não podem conceder acesso nem ver a lista. O administrador não vê as finanças de outras pessoas.

## Ativação inicial (uma vez no Supabase)

1. No projeto **Meu Saldo**, confirme que o script `supabase/setup.sql` já foi executado.
2. Abra **Authentication → Users**. Se ainda não existir, use **Add user → Create new user** para cadastrar `brunosousa2913@gmail.com`, escolha sua própria senha forte e marque **Auto Confirm User**. Não envie a senha ao assistente nem coloque-a no código.
3. Abra **SQL Editor**, cole todo o conteúdo de **supabase/ativar-admin.sql** e execute. Ele cria a tabela de permissões, torna cadastros pendentes por padrão, protege as finanças de contas bloqueadas e define explicitamente `brunosousa2913@gmail.com` como administrador. Não concede administração ao primeiro usuário que se cadastrar. Os usuários existentes, exceto o administrador designado, ficam pendentes até você liberar. As finanças existentes são preservadas.
4. Em **Authentication → Sign In / Providers**, desative **Allow new users to sign up** para impedir cadastro público. A proteção no banco também recusa contas que não tenham sido liberadas, mesmo que essa opção ainda esteja ligada.
5. Publique a função de servidor **manage-users** conforme abaixo.
6. Baixe a nova versão do GitHub, extraia `financas-final-site.zip` e atualize o **mesmo projeto** `financas-kb` no Netlify. Preserve o domínio. Exporte um backup antes de qualquer atualização.
7. Entre com `brunosousa2913@gmail.com`. A opção **Administrar usuários** aparecerá no menu.

## Publicar a Edge Function

No painel Supabase, abra **Edge Functions → Deploy a new function → Via Editor** (os nomes podem variar conforme o painel):

1. Nome da função: **manage-users**.
2. Substitua o código do editor pelo conteúdo completo de `supabase/functions/manage-users/index.ts`.
3. Publique a função.
4. Na configuração da função, desative **Verify JWT with legacy secret**, caso apareça. A função valida o Bearer token no Supabase Auth e verifica o papel e status no banco em cada chamada. Esse ajuste evita a verificação antiga do gateway para projetos com novas chaves; chamadas sem token são recusadas pelo próprio servidor.

Alternativa via Supabase CLI autenticada (não exige credenciais no navegador):

```sh
supabase functions deploy manage-users --project-ref gpcjeseybbvuemgajxmf --no-verify-jwt
```

A função usa `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` fornecidas automaticamente pelo ambiente de servidor do Supabase. **Nunca** coloque a service_role/secret key em `cloud-config.js`, HTML, GitHub, Netlify Drop ou chat. Se essas variáveis não estiverem disponíveis na sua configuração de servidor, use o painel seguro de Secrets do Supabase; não inclua valores no código.

## Uso diário

Em **Administrar usuários**, preencha nome, e-mail e senha inicial de 12 a 128 caracteres. Clique **Cadastrar e liberar**. O cadastro confirma o e-mail administrativamente, sem depender de convite por e-mail. Você é responsável por conferir o destinatário. Envie o acesso por um canal seguro. O usuário pode usar **Esqueci minha senha** para definir uma senha pessoal; isso exige o envio de e-mails do Supabase configurado.

**Bloquear** mantém os registros e impede imediatamente novas leituras/gravações no banco, mesmo com token já emitido. O site verifica o acesso a cada atualização e antes de salvar. Conteúdo já visto/baixado não pode ser recolhido; a interface conectada limpa os dados quando detecta o bloqueio. O servidor também tenta bloquear novos logins no Supabase Auth. Se essa operação adicional falhar, a tela informa e o bloqueio de dados continua valendo.

**Desbloquear** retira o bloqueio do Auth e libera as finanças novamente. Não é possível bloquear a própria conta nem outras contas administrativas por essa tela. Não há exclusão de usuários nem promoção de outros administradores na interface.

## Conferência

Teste primeiro com uma conta fictícia: crie pelo site, entre em outro navegador, cadastre uma movimentação, bloqueie e confirme que novas consultas/gravações são recusadas. Desbloqueie e confira que os registros retornam. Uma conta comum não deve ver a administração. Só libere o endereço do site quando a função, RLS e o login tiverem sido verificados no projeto real.

Testes locais:

```sh
node tests/admin-function.cjs
# PostgreSQL embarcado com @electric-sql/pglite 0.3.14:
node tests/admin-database.cjs
# Com Playwright e Chromium disponíveis, servidor em execução:
TEST_URL=http://127.0.0.1:3000 node tests/admin-ui.cjs
```

Os testes de servidor usam o handler real com Supabase simulado e o SQL real em PostgreSQL embarcado. Não confirmam implantação da Edge Function, regras de senha ou acesso no projeto Supabase real.
