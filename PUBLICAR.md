# Meu saldo — versão 6.0

## Login e sincronização

Antes de publicar esta atualização, siga **ADMINISTRADOR.md**: confirme a conta administrativa, execute `supabase/ativar-admin.sql` e publique a Edge Function `manage-users`. A nova versão nega acesso a usuários sem permissão ativa e não exibe cadastro público.

Para usuários independentes do ML Controle, crie um projeto Supabase exclusivo das finanças e siga **CONFIGURAR-LOGIN.md**. O código sem configuração continua em modo local. Para compartilhar as mesmas finanças entre aparelhos, o projeto real precisa estar configurado, com a tabela e as políticas do script `supabase/setup.sql`.

Não inclua senha de banco, senha pessoal ou chave service_role no site. `cloud-config.js` deve conter somente URL e chave pública publishable/anon.

## Atualizar o site

1. Exporte um backup dos registros na versão que você está usando e guarde uma cópia.
2. Configure o Supabase conforme CONFIGURAR-LOGIN.md.
3. Gere o pacote com `npm run package` se alterou cloud-config.js. A pasta de arquivos do repositório também pode ser publicada diretamente.
4. Extraia `financas-final-site.zip`. Preserve `index.html`, `app.js`, `cloud.js`, `cloud-config.js`, `style.css`, `sw.js`, `manifest.webmanifest` e a pasta `icons/` juntos.
5. No Netlify, envie a pasta extraída para atualizar o **mesmo projeto/site**. Preserve seu endereço para continuar acessando os registros locais antigos. Também pode configurar publicação a partir deste repositório.
6. Abra o site HTTPS. Se ainda aparecer a versão anterior, feche e reabra o aplicativo para ativar a atualização. Não limpe os dados antes de exportar backup.
7. Entre pela aba Minha conta e sincronização e leve os dados locais para a conta, ou importe seu backup.

O pacote não publica o site sozinho. O arquivo HTML independente continua disponível para uso local/teste; para login e instalação, prefira o site HTTPS publicado.

## Abrir no celular

- Android/Chrome: abra o endereço HTTPS e use menu ⋮ → Instalar aplicativo ou Adicionar à tela inicial.
- iPhone/Safari: abra o endereço HTTPS e use Compartilhar → Adicionar à Tela de Início. Se houver a opção, ative Abrir como App da Web.
- Computador/Chrome ou Edge: use o ícone de instalação na barra de endereço ou a opção do menu.

Entre com o mesmo e-mail e senha em cada aparelho para carregar os dados dessa conta. Outras contas não veem suas finanças. O sistema não usa as contas do ML Controle se você criou o projeto exclusivo recomendado.

No modo online, gravações exigem conexão. O modo local continua funcionando offline depois da primeira visita. A instalação depende do navegador e não é um aplicativo de App Store/Play Store.

## Backups e segurança

O backup JSON contém dados financeiros pessoais: guarde-o em local seguro. No modo online, importar substitui os registros da conta depois da confirmação. Mantenha uma cópia antes de importar ou migrar.

Testes locais cobrem o uso da interface com Supabase simulado e as políticas reais em PostgreSQL embarcado. A configuração do Supabase real e a publicação devem ser verificadas antes de usar dados reais. Consulte CONFIGURAR-LOGIN.md.
