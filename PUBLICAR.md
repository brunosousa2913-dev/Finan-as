# Meu saldo — versão final 4.0

## Publicar na web

Extraia o pacote e publique a pasta que contém `index.html` em uma hospedagem estática com HTTPS. Preserve os nomes e a pasta `icons`. Não é necessário servidor de banco de dados. Os arquivos `index.html`, `app.js`, `style.css`, `sw.js`, `manifest.webmanifest` e `icons/` devem ficar juntos.

No Netlify, por exemplo, envie a pasta extraída em https://app.netlify.com/drop e use o endereço HTTPS fornecido. O pacote não publica o site sozinho.

## Salvar no celular

- Android/Chrome: abra o endereço HTTPS, acesse o menu ⋮ e escolha Instalar aplicativo ou Adicionar à tela inicial.
- iPhone/Safari: abra o endereço HTTPS no Safari, toque em Compartilhar e Adicionar à Tela de Início. Se houver a opção, ative Abrir como App da Web.
- Computador/Chrome ou Edge: use o ícone de instalação na barra de endereço ou a opção do menu.

A aba Instalar no celular também contém essas instruções. A instalação depende do navegador. Abra uma vez com internet para preparar os arquivos offline. Não é um aplicativo de App Store ou Play Store.

## Seus dados

Os dados ficam no navegador/aparelho e endereço utilizado. Não há login nem sincronização automática. Antes de mudar de arquivo, navegador, endereço ou aparelho, exporte seu backup na versão que contém seus registros. Depois importe o JSON na nova versão em Backup dos dados. Mantenha cópias em local seguro. Limpar dados do navegador pode apagar os registros.

O arquivo HTML independente serve para abrir/testar sem hospedagem. Para instalação e modo offline gerenciado, use o pacote publicado com HTTPS.

## Verificação

Foram testados no Chromium: salvamento na prévia, cartões, categorias personalizadas, filtros, marcar/desmarcar pagamento, dez temas sem verde, preservação de dados após recarregar e uso offline. Não foi realizada publicação externa nem instalação em aparelhos físicos Android/iPhone.
