# Meu saldo — finanças pessoais · versão final 4.0

Para baixar pelo GitHub, clique em **Code → Download ZIP**. Extraia a pasta. O arquivo `financas-final.html` permite abrir o sistema diretamente no navegador. Para publicar com HTTPS e instalar na tela inicial do celular, use o pacote `financas-final-site.zip` e siga `PUBLICAR.md`. Exporte um backup antes de mudar de arquivo, endereço ou navegador.

Os dados reais são salvos no navegador do usuário; este repositório contém código e exemplos fictícios. A cópia principal começa sem registros.

Sistema web responsivo para acompanhar receitas, despesas, contas a pagar e receber, cartões e faturas. Interface em português e valores em reais.

## Executar

Requer Node.js 18 ou superior, sem dependências externas.

```sh
npm start
```

O servidor escuta na porta 3000 (ou na variável `PORT`). Para disponibilizar no Android e iPhone fora da rede local, publique em uma hospedagem com HTTPS. A aplicação também pode ser hospedada como arquivos estáticos (`index.html`, `style.css`, `app.js`).

## Funcionalidades

- Resumo mensal, saldo realizado e despesas por categoria.
- Cadastro, edição e exclusão de receitas e despesas.
- Contas pendentes, identificação de atrasos e confirmação de pagamento/recebimento.
- Cadastro de cartões com limite, fechamento e vencimento; nunca informe dados completos ou CVV.
- Compras vinculadas ao mês da fatura, limite disponível e quitação da fatura.
- Busca, filtro por tipo e seleção de mês.
- Cinco cores para o site (verde, azul, roxo, rosa e terracota), com preferência salva neste navegador.
- Exportação e importação de backup JSON validado, com confirmação antes de substituir dados.

## Persistência e limites

Os registros são salvos no `localStorage`, com alternativa em IndexedDB se o navegador bloquear o primeiro método, por navegador e origem. Se ambos estiverem bloqueados, o formulário mostra um erro e não confirma o salvamento. Não existe conta, servidor de dados ou sincronização entre dispositivos. Não use navegação privada para guardar seus registros. Limpar os dados do navegador pode apagar tudo; exporte backups regularmente. O backup contém informações financeiras pessoais.

O mês da fatura é informado manualmente; fechamento e vencimento são referências. O saldo mensal considera entradas recebidas e despesas pagas na data registrada. O limite disponível desconta todas as compras de cartão pendentes. Contas fixas geram vencimentos pendentes ao selecionar cada mês a partir do início, até encerrar. Parcelamentos geram de 2 a 360 parcelas com o valor unitário informado; datas como dia 31 são ajustadas ao último dia do mês. Só a primeira parcela usa o status escolhido, as demais ficam pendentes. Cada vencimento pode ser editado ou excluído individualmente. Não há cálculo de juros ou importação bancária.

## Verificação

```sh
npm run check
```

Fluxos de cadastro, persistência após recarga, quitação de fatura e exportação/importação também foram verificados em Chromium com viewport de celular. Validação em aparelhos físicos Android/iPhone e publicação em hospedagem não foram realizadas.

## Demonstração com dados fictícios

Acesse o caminho `/demo` no servidor ou abra `demo.html`. Outubro de 2026 inclui receitas, despesas, contas fixas, financiamento e cartão. A demonstração usa chaves e banco local separados dos dados reais. Para regenerar após alterações na interface: `python3 scripts/build-demo.py`. Os valores são fictícios; o arquivo demo-data.json permite inspecionar os exemplos.

## Salvamento na prévia (versão 3.1)

O navegador pode impedir submissões nativas em iframes sem `allow-forms`, inclusive o evento `submit`. Os botões Salvar chamam a rotina de validação e armazenamento diretamente, sem submissão ou navegação. A tecla Enter usa a mesma rotina. Bloqueios de armazenamento continuam sendo informados ao usuário, sem confirmação falsa de sucesso.

Teste de regressão, com Playwright disponível e o servidor em execução: `node tests/save-preview.cjs`. O teste verifica gravação de movimentação e cartão numa prévia sem `allow-forms`, persistência após recarga, Enter, validação e armazenamento negado. `TEST_URL` e `CHROMIUM_PATH` podem selecionar o servidor e Chromium.

## Filtros e confirmação de pagamento (3.2)

O seletor de datas oferece mês, dia e período inclusivo de até 10 anos. O resumo, movimentações, pendências e parcelas seguem as datas selecionadas. Contas fixas são geradas uma vez para cada mês abrangido, sem duplicação. Intervalos invertidos mostram uma mensagem. Cartões continuam mostrando a fatura do mês inicial do filtro, indicado na tela.

Cada movimentação tem um check Pago (ou Recebido para entradas). Marcar confirma e desmarcar volta para pendente. A alteração é persistida e atualiza os totais e limites. Em Contas e vencimentos, itens pagos saem da lista; desmarque em Movimentações para torná-los pendentes novamente.

Teste funcional com Playwright e servidor executando: `TEST_URL=http://127.0.0.1:3000 node tests/filters-payment.cjs`. O teste usa `/demo`, datas fictícias, filtro com dois meses, datas invertidas e persistência do check.

## Categorias personalizadas (3.3)

Escolher Outros no formulário abre um campo opcional para escrever uma categoria (até 60 caracteres). Ao salvar a movimentação, a categoria é armazenada nos dados e incluída na lista dos próximos cadastros. Campo vazio mantém Outros. Nomes iguais com diferenças de maiúsculas ou espaços são reutilizados. Categorias são mantidas nos backups JSON; backups antigos continuam aceitos. Teste com Playwright: `node tests/custom-categories.cjs`.

## Versão final: web e tela inicial

Dez temas: azul, azul-marinho, azul-claro, roxo, rosa, pink, terracota, laranja, vermelho e grafite. Verde foi removido; preferências antigas verdes usam azul. Dados financeiros mantêm o mesmo formato e chave de armazenamento.

A aplicação inclui manifesto, ícones e service worker para instalação pelo navegador e uso offline depois da primeira visita online. Publique com HTTPS; consulte PUBLICAR.md para Android, iPhone e computador. Os recursos não exigem conta ou serviço externo. A fonte usa arquivos do sistema, sem download de fontes. Os arquivos relativos também permitem hospedagem em subpasta.

Gere a distribuição com `npm run package`. O pacote final não contém dados de demonstração ou dados pessoais. O HTML de demonstração é separado. Teste PWA/cores/offline: `TEST_URL=http://127.0.0.1:3000 node tests/final-app.cjs`, com Playwright disponível. Testes em Chromium não confirmam instalação em aparelhos físicos.
