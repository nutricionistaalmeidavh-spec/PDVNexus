# Balança Ramuza Atena II — PDV Nexus

## Escopo implementado

O Nexus exporta produtos da base canônica do PDV para o formato **Filizola (Windows-1252)**, utilizado pela função **Customizar arquivo** do software oficial Ramuza Atena II. O módulo permite:
- gerar `CADTXT.TXT` (PLUs, tipo peso/unidade, descrição, preço em centavos e validade);
- gerar `SETORTXT.TXT` (setores, PLU e índices);
- validar códigos numéricos de até 6 dígitos, preços, validades, nomes e duplicatas antes do download;
- filtrar apenas produtos ativos e por peso (unidades podem ser incluídas explicitamente);
- selecionar etiqueta EAN-13 tipo 03 (2 + 5C + 6T + DV, modo preço) ou tipo 06 (2 + 6C + 5T + DV);
- consultar conectividade TCP na rede local com o equipamento pelo endereço IPv4 e porta 33581.

**Importante:** o teste TCP apenas confirma abertura da porta; **não** envia PLUs nem comandos para a balança. O protocolo proprietário de envio não está disponível na documentação técnica pública consultada. Não há rotina de transmissão automática direta do Nexus para a balança, nem alegação de homologação física sem aparelho.

## Como enviar produtos (sem custo de licença extra)

1. Abra `Balança` no PDV e localize o bloco **Ramuza Atena II**.
2. Confira a quantidade de produtos e setores. Baixe o arquivo `CADTXT.TXT`; se necessário, baixe também o `SETORTXT.TXT`.
3. Abra o software **Ramuza Atena II** no Windows (a versão do software deve corresponder à versão da balança).
4. Vá a **Arquivo > Importar/Exportar > Customizar arquivo** e selecione o formato **FILIZOLA (Windows-1252)**. Importe `CADTXT.TXT` para o software.
5. Confira os produtos em **Base de dados > PLU**. No software Ramuza, escolha **Ethernet > Download (para balança) > Executar**.
6. Verifique o log de conclusão do software. Faça uma etiqueta de teste, leia no caixa e confira peso/preço/código.
7. Verifique que o formato EAN-13 configurado na Atena corresponde ao perfil selecionado no Nexus.

### Layout de arquivos

- `CADTXT.TXT`: 6 dígitos código + 1 letra (`P` peso ou `U` unidade) + 22 caracteres descrição + 7 dígitos valor em centavos + 3 dígitos validade; 39 bytes por linha, sem CRLF.
- `SETORTXT.TXT`: setor (12 caracteres) + código (6 dígitos) + índice (4 dígitos, iniciando em 0001 no setor) + tecla (3 dígitos, 000 sem associação); 25 bytes por linha.
- Todos os arquivos usam fim de linha CRLF, sem linha em branco extra, codificação Windows-1252.
- Alguns firmwares usam layout e limites diferentes. Confira as linhas e o modo de importação no software antes de transmitir a carga completa.

### Teste de rede local

Informe o IP da balança (exemplo fornecido pelo fabricante: 192.168.0.150) e clique em **Testar rede**. O recurso está disponível no instalador desktop Electron. A aplicação rejeita IPs públicos, hostnames e portas arbitrárias, usa somente o destino TCP 33581 e não grava ou altera dados do equipamento.

### Segurança e regressões

- Sem chamadas à Cloudflare, assinatura, serviço externo ou custo adicional.
- Sem alteração automática do catálogo, estoque, vendas, configurações fiscais, secrets ou bancos SQLite.
- Perfis Toledo/Urano/Filizola existentes permanecem intactos.
- Arquivos ficam no computador do operador; não são enviados à nuvem.
- Testes: `npm run test:ramuza-atena-2` e suíte `npm run test:pdv-payments`.

## Referências

- Manual oficial de software Ramuza: https://ramuza.com.br/wp-content/uploads/2024/09/manual-do-usuario-atenaii-software.pdf
- Manual oficial da Atena II: https://ramuza.com.br/wp-content/uploads/2024/09/manual-do-usuario-atenaii-balanca-2018.pdf
- Guia de importação Filizola no Atena II: https://ajuda.alterdata.com.br/pages/viewpage.action?pageId=326771289
- Layout CADTXT/SETORTXT: https://infokaw.com.br/jkawflex/SNAPSHOT/lib/jkaw-4.00-SNAPSHOT/balancas/layoutFilizola/CONVERSAO_DE_PRODUTOS_E_SETORES_FILIZOLA.pdf
