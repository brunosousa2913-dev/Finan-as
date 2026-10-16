# Meu saldo — finanças pessoais · versão 6.1

Sistema web responsivo em português para receitas, despesas, contas fixas, parcelas, cartões e faturas. Inclui login e sincronização entre aparelhos quando conectado a um projeto Supabase exclusivo das finanças.

Para baixar, clique em **Code → Download ZIP** no GitHub e extraia a pasta. Para publicar/atualizar o site, use `financas-final-site.zip` e siga [PUBLICAR.md](PUBLICAR.md). Para configurar o login e a administração, siga [CONFIGURAR-LOGIN.md](CONFIGURAR-LOGIN.md) e [ADMINISTRADOR.md](ADMINISTRADOR.md). A URL e a chave pública do projeto Meu Saldo estão configuradas em cloud-config.js. Para ativar o login, ainda é necessário executar os scripts SQL e publicar a função manage-users no projeto antes de atualizar o site.

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
- Login, recuperação de senha, migração local e sincronização com Supabase.
- Administração de usuários: cadastro restrito ao administrador, bloqueio/desbloqueio com preservação das finanças. Sem cadastro público na interface.

## Login e dados em vários aparelhos

Use um **projeto Supabase exclusivo** para ter usuários separados do ML Controle. Execute `supabase/setup.sql`, preencha `cloud-config.js` apenas com a URL e a chave pública publishable/anon, configure as URLs de autenticação e atualize a hospedagem. Nunca publique senhas, secret keys ou service_role.

No modo configurado, o usuário deve entrar para acessar as finanças. Cada usuário ativo lê apenas sua linha, protegida por RLS. O banco recusa contas bloqueadas ou pendentes, inclusive com JWT válido. O papel de administrador vem do banco, nunca de dados enviados pelo cliente. Escritas passam por uma função que verifica `auth.uid()` e a revisão. Computador e celular usam o mesmo e-mail e senha da conta de finanças. A atualização ocorre ao salvar, ao voltar à janela e a cada 20 segundos sem edição modal aberta.

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

## Administrador e usuários (6.0)

Consulte ADMINISTRADOR.md para a implantação obrigatória: execute `supabase/ativar-admin.sql` depois de criar a conta inicial indicada, publique `supabase/functions/manage-users/index.ts` como Edge Function **manage-users**, desative novos cadastros no Auth e atualize o Netlify. A tabela de acesso começa pendente por padrão, sem autoeleição de administrador. A função valida o token no Auth e consulta o administrador ativo no banco antes de qualquer ação. A chave service_role permanece exclusivamente no ambiente de servidor do Supabase.

O administrador pode listar/cadastrar usuários comuns, bloquear e desbloquear. Não pode bloquear a si mesmo ou outro administrador pela tela, nem consultar as finanças de outras pessoas. Bloqueio não apaga dados. Conteúdo já baixado não pode ser recolhido, mas novas consultas e gravações são negadas imediatamente pelo banco.

Testes adicionais: `node tests/admin-function.cjs`, `node tests/admin-ui.cjs` (Playwright + servidor) e `node tests/admin-database.cjs` (PGlite). Os testes são locais; a função e a migração precisam ser ativadas e verificadas no projeto real.

## Pagamentos e faturas (6.1)

Nova movimentação separa Dinheiro, Débito, Pix, Crédito e Conta a pagar/a receber. Dinheiro/débito/Pix usam a data do pagamento e são confirmados como pagos (ou recebidos para entradas). Crédito exige cartão e usa a data da compra, entrando pendente na fatura calculada. Contas futuras mantêm vencimento e status; parcelas e repetições futuras não são marcadas como pagas antecipadamente.

O cálculo usa o fechamento efetivo do mês (limitado ao último dia). Compras no dia do fechamento ou depois passam para o próximo fechamento. Se o vencimento for anterior ou igual ao dia nominal de fechamento, a fatura vence no mês seguinte ao fechamento. Parcelas avançam a partir da primeira fatura. Cartões existentes e registros antigos são preservados; novas compras usam a regra automática.

Em Cartões e faturas, use Editar fatura/registrar pagamento para informar o total final e o total já pago. A diferença entre compras e total final fica registrada como encargos/descontos. Aumentar o pago acumulado cria uma saída apenas pela diferença, com data e forma de pagamento. Reduzir o valor corrige os pagamentos mais recentes. O restante aparece como fatura pendente no vencimento. Não há transferência automática de saldo para outra fatura.

Compras permanecem registradas pelos valores originais. Pagamentos de fatura são lançamentos separados e não duplicam despesas realizadas. Ao ajustar pela primeira vez uma fatura antiga, compras que já estavam pagas são convertidas em pagamentos equivalentes, preservando datas. O check de uma compra no crédito abre a fatura para confirmar o valor efetivamente pago. O limite exibido é uma estimativa com base no saldo das faturas, incluindo ajustes.

Novos campos ficam no mesmo documento JSON por usuário; esta atualização financeira não exige uma nova tabela. A ativação administrativa 6.0 continua obrigatória. Testes: `node tests/payment-methods.cjs` e `node tests/invoice-payments.cjs` com Playwright e o servidor em execução.
