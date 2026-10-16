# Login e sincronização — versão 6.0

A aplicação usa Supabase Auth para e-mail/senha e uma tabela PostgreSQL com isolamento por usuário. Sem configuração, o modo local continua funcionando. Login não é ativado apenas publicando o código. Na versão 6.0, também siga ADMINISTRADOR.md para configurar as permissões e a função de servidor antes de publicar a atualização.

## 1. Crie um projeto exclusivo para as finanças

No painel do Supabase, escolha **New project** e crie um projeto exclusivo para Meu saldo. Não use o projeto do ML Controle: os usuários devem ser independentes. Cada projeto Supabase tem sua própria lista de usuários. Use a senha do banco somente nas configurações seguras do Supabase, nunca neste repositório ou no chat.

No Supabase, abra o **SQL Editor**, crie uma consulta e execute o conteúdo de `supabase/setup.sql`. Ele cria somente a tabela `public.meu_saldo_accounts`, sua política de leitura e a função `public.save_meu_saldo`. A função identifica o dono com `auth.uid()` e verifica a revisão antes de gravar. Acesso anônimo e escrita direta são negados. Não remova as políticas RLS nem as substitua por acesso público.

## 2. Configure o site

Em **Project Settings → API/API Keys**, obtenha:

- URL do projeto, por exemplo `https://SEU-PROJETO.supabase.co`.
- Chave **publishable** (ou a chave legada **anon**).

Edite `cloud-config.js`:

```js
window.FINANCE_CLOUD_CONFIG = {
  url: 'https://SEU-PROJETO.supabase.co',
  publicKey: 'SUA_CHAVE_PUBLICA'
};
```

Esses dois valores são públicos e ficam no navegador. Nunca coloque `service_role`, `sb_secret_...`, senha de banco, senha de usuário ou token administrativo nesse arquivo. A proteção das contas está na autenticação e nas políticas do banco, não em esconder a chave pública.

## 3. E-mail e recuperação

Em **Authentication → URL Configuration → Redirect URLs**, acrescente o endereço HTTPS deste site (incluindo o caminho de acesso, normalmente `/`). Defina **Site URL** como o endereço publicado das finanças e inclua a mesma URL nas Redirect URLs. Não altere as configurações do projeto ML Controle. O cadastro e a recuperação informam a URL desta aplicação como destino.

Mantenha confirmação de e-mail ativada e configure o envio de e-mails conforme as regras do seu projeto (o remetente padrão do Supabase pode ter restrições). O administrador cadastra cada pessoa pela tela Administrar usuários, depois de concluir ADMINISTRADOR.md. Desative Allow new users to sign up no Auth para impedir cadastros livres. Em cada dispositivo, ela entra com o mesmo e-mail e senha dessa conta. Contas do ML Controle não dão acesso ao projeto novo.

## 4. Atualize a hospedagem

Gere `npm run package` e publique o conteúdo de `financas-final-site.zip` no mesmo projeto Netlify, preservando o domínio onde seus dados locais estão salvos. Reabra o site. Se a versão antiga ainda aparecer, feche e abra o aplicativo para ativar a atualização do service worker; nunca limpe os dados antes de exportar o backup.

O pacote inclui `cloud-config.js` e `cloud.js`. Todos os arquivos devem ser publicados juntos.

## 5. Leve seus registros para a conta

1. Na versão/navegador que contém suas contas, exporte um backup JSON e guarde uma cópia segura.
2. Abra **Minha conta e sincronização** e entre com seu e-mail e senha.
3. Se a conta online estiver vazia, clique em **Levar minhas contas locais para a nuvem**. Os registros locais originais são preservados.
4. Se os dados estavam em outro arquivo/endereço, entre na conta no site novo e importe o backup na aba **Backup dos dados**. A importação substitui todos os dados online da conta: revise a confirmação antes de continuar.
5. No celular, abra o mesmo site e entre na mesma conta. As contas online serão carregadas.

Após migrar, trabalhe com login em todos os aparelhos. O modo local tem dados independentes. Sair da conta volta ao modo local e não apaga as contas online.

## Sincronização e conflitos

- Só existe confirmação de salvamento online depois da resposta do servidor.
- A atualização automática acontece a cada 20 segundos, ao voltar à janela e ao recuperar conexão, quando nenhum formulário modal está aberto.
- Durante edição, outro aparelho pode ter alterado os dados. O banco recusa a gravação com revisão antiga; o formulário fica aberto. Copie o que digitou, feche o formulário, clique **Atualizar da nuvem** na conta e refaça a alteração. Nada é sobrescrito silenciosamente.
- Para alterações online, é necessário internet. Nesta versão, não há fila de alterações offline nem mesclagem automática. Se o dispositivo perde a conexão, o formulário mantém os dados digitados e não informa sucesso.
- Ao reabrir com login, os dados precisam ser carregados do servidor. A interface local pode abrir offline, mas a conta online não é editável sem conexão.
- O servidor nunca recebe sua senha em tabelas financeiras. As sessões são mantidas pelo Supabase; o navegador guarda os tokens de sessão para continuar conectado. Em dispositivos compartilhados, use Sair.

## Verificar antes de usar dados reais

Crie duas contas de teste. Salve uma movimentação na primeira e abra a mesma conta em outro navegador para confirmar a sincronização. Na segunda conta, os registros da primeira não devem aparecer. Teste sair/entrar, recuperação de senha, migração, pagamento e perda de conexão. Confirme que somente a chave pública foi publicada e que o script SQL foi executado com sucesso.

Os testes locais automatizados verificam a interface com serviço simulado e a política SQL em PostgreSQL embarcado. Isso não substitui a validação no projeto real (e-mail, URLs, permissões, plano e configuração do Supabase).
