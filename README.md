# Meu saldo — finanças pessoais · versão 5.0

Sistema web responsivo em português para receitas, despesas, contas fixas, parcelas, cartões e faturas. Inclui login e sincronização entre aparelhos quando conectado a um projeto Supabase exclusivo das finanças.

Para baixar, clique em **Code → Download ZIP** no GitHub e extraia a pasta. Para publicar/atualizar o site, use `financas-final-site.zip` e siga [PUBLICAR.md](PUBLICAR.md). Para ativar login, siga [CONFIGURAR-LOGIN.md](CONFIGURAR-LOGIN.md). A configuração pública distribuída começa vazia: login não funciona até conectar o projeto real.

## Executar

Node.js 18 ou superior, sem dependências externas em produção:

```sh
npm start
```

A porta padrão é 3000, configurável com `PORT`. A aplicação também pode ser hospedada como arquivos estáticos com HTTPS. Os caminhos relativos permitem hospedagem em subpasta. Não há fontes ou bibliotecas baixadas em tempo de execução.

## Funcionalidades

- Receitas e despesas com categorias, busca, edição e exclusão.
- Filtros por mês, dia e período inclusivo de até 10 anos, com validação de datas.
- Check Pago/Recebido para confirmar ou desfazer pagamentos, atualizando os totais.
- Contas fixas mensais e parcelamentos de 2 a 360 parcelas. Datas são ajustadas ao último dia do mês; só a primeira parcela usa o status escolhido, as futuras começam pendentes.
- Cartões com limite, fechamento, vencimento e fatura do mês inicial do filtro. A escolha do mês da fatura é manual; o limite desconta todas as compras pendentes.
- Categorias personalizadas ao escolher Outros. Nomes já usados ficam disponíveis nos próximos cadastros.
- Dez cores sem verde, com preferência por aparelho.
- Backup JSON com validação e confirmação antes de substituir registros.
- Manifesto, ícones, instalação na tela inicial e uso local offline após a primeira visita.
- Login, cadastro com confirmação de e-mail, recuperação de senha, migração local e sincronização com Supabase.

## Login e dados em vários aparelhos

Use um **projeto Supabase exclusivo** para ter usuários separados do ML Controle. Execute `supabase/setup.sql`, preencha `cloud-config.js` apenas com a URL e a chave pública publishable/anon, configure as URLs de autenticação e atualize a hospedagem. Nunca publique senhas, secret keys ou service_role.

No modo configurado, o usuário deve entrar para acessar as finanças. Cada usuário lê apenas sua linha, protegida por RLS. Escritas passam por uma função que verifica `auth.uid()` e a revisão. Computador e celular usam o mesmo e-mail e senha da conta de finanças. A atualização ocorre ao salvar, ao voltar à janela e a cada 20 segundos sem edição modal aberta.

Conflitos entre aparelhos não são mesclados silenciosamente: o banco recusa uma versão antiga, mantém o formulário e orienta atualizar os dados antes de tentar novamente. A gravação online precisa de internet e confirmação do servidor. Não existe fila de alterações offline.

Os registros locais anteriores são preservados separadamente. Antes de migrar, exporte um backup. Entre na conta e use Levar minhas contas locais para a nuvem, disponível para conta online vazia. Se estiver mudando de endereço ou arquivo, exporte no antigo e importe na conta online no novo. Importar backup com login substitui os dados online.

Sem Supabase configurado, o modo local anterior continua funcionando: localStorage com alternativa em IndexedDB, por aparelho e origem. Se ambos estiverem bloqueados, o sistema mostra erro e não confirma o salvamento. Limpar os dados do navegador pode apagar registros; mantenha backups. Não há cálculo de juros, importação bancária ou criptografia adicional do documento no cliente.

## Distribuição

```sh
npm run check
npm run package
```

O empacotamento usa Python 3 e gera `financas-final.html`, `financas-final-demo.html` e `financas-final-site.zip` em `/workspace`. Nenhum registro pessoal ou credencial administrativa é incluído. A configuração pública é incorporada à distribuição no momento da geração. Para uso com login, prefira o site HTTPS publicado em vez do arquivo HTML local.

Acesse `/demo` ou `demo.html` para ver dados fictícios de outubro de 2026. A demonstração é independente do Supabase e usa armazenamento separado. Regere com `python3 scripts/build-demo.py`.

## Testes

`npm run check` verifica a sintaxe. Com Playwright e Chromium disponíveis e o servidor executando, use `TEST_URL=http://127.0.0.1:3000` com:

```sh
node tests/save-preview.cjs
node tests/custom-categories.cjs
node tests/filters-payment.cjs
node tests/final-app.cjs
node tests/cloud-sync.cjs
```

O teste de nuvem simula o Supabase: dois aparelhos, usuários distintos, migração, conflitos, conexão perdida, sessão, cadastro e recuperação. O teste SQL executa o script real em PostgreSQL embarcado, verificando RLS, permissão anônima, escrita direta negada e conflitos:

```sh
# Com @electric-sql/pglite 0.3.14 disponível como dependência de teste:
node tests/cloud-database.cjs
# Ou PGLITE_MODULE=/caminho/para/@electric-sql/pglite node tests/cloud-database.cjs
```

Os testes locais não confirmam e-mail, políticas e conectividade no projeto Supabase real. A ativação requer configurar e testar esse projeto. Não foi realizada instalação em aparelhos físicos ou publicação do novo pacote em hospedagem externa.
