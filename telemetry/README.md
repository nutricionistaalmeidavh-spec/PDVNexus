# Telemetria do PDV Nexus

A telemetria do PDV Nexus e opcional, privacy-first e fail-open: nenhuma venda, estoque, caixa, impressao ou atualizacao depende dela para funcionar.

## Arquitetura de dados

- dados operacionais do PDV permanecem no SQLite/local do cliente;
- o D1 remoto `pdvnexus` e o banco de controle usado para licencas e telemetria;
- a telemetria usa tabelas proprias prefixadas com `telemetry_`;
- o Cloudflare Worker conectado a este repositorio e o servico `pdvnexus`.

## Politica do cliente

- o endpoint de producao pode vir embutido no instalador, mas nenhum evento e enviado sem consentimento explicito;
- identidade pseudonima aleatoria por instalacao;
- fila local limitada e envio em segundo plano;
- falha de rede/coletor nunca bloqueia o PDV;
- credencial do coletor fica protegida pelo `safeStorage` do Electron quando disponivel;
- payloads passam por allowlist e bloqueio de campos/valores sensiveis.

## O que pode ser enviado

- versao/release do PDV;
- plataforma e arquitetura;
- abertura e fechamento do aplicativo;
- heartbeat tecnico para estimar instalacoes online;
- tempo de sessao/uptime;
- resultado/canal de atualizacao;
- falhas tecnicas anonimizadas por fingerprint.

## O que nao e enviado

- vendas, itens, valores ou formas de pagamento;
- nomes de clientes, operadores ou empresas;
- CPF/CNPJ, telefone, e-mail ou endereco;
- senhas, tokens, chaves, certificados ou credenciais fiscais;
- XML/DANFE ou dados de cartao;
- mensagens, observacoes ou stack trace bruto.

## Coletor self-hosted, R$ 0

Requer Node.js 22+ e usa apenas modulos nativos (`node:http` e `node:sqlite`).

```powershell
$env:PDV_TELEMETRY_ADMIN_TOKEN = "troque-por-um-segredo-forte"
$env:PDV_TELEMETRY_HOST = "127.0.0.1"
$env:PDV_TELEMETRY_PORT = "8788"
node telemetry/self-hosted/server.mjs
```

O banco SQLite e criado em `data/pdv-nexus-telemetry.sqlite` por padrao. Para clientes fora da mesma rede, publique o coletor atras de HTTPS e use a URL HTTPS como endpoint do PDV.

Endpoints:

- `GET /health`
- `POST /v1/installations/register`
- `POST /v1/events`
- `GET /v1/admin/summary` com `Authorization: Bearer <PDV_TELEMETRY_ADMIN_TOKEN>`

## Cloudflare Worker + D1 `pdvnexus`

A integracao Cloudflare Builds deste repositorio publica o Worker `pdvnexus`. O adaptador em `cloudflare/telemetry/` usa o mesmo D1 `pdvnexus`, criado como banco remoto de controle para licencas + telemetria.

As tabelas de telemetria ficam isoladas das tabelas de licenciamento:

- `telemetry_installations`
- `telemetry_events`

O endpoint de producao usado pelos instaladores e:

`https://pdvnexus.nutricionistaalmeidavh.workers.dev`

Qualquer evolucao do licenciamento no mesmo Worker deve preservar as rotas de telemetria e as tabelas `telemetry_*`; a telemetria nao le nem altera tabelas de licenca.

## Ativacao no instalador

Os builds oficiais usam o endpoint de producao acima. `PDV_TELEMETRY_ENDPOINT` continua podendo sobrescrever o destino no build. Mesmo com endpoint configurado, o cliente so envia eventos apos consentimento explicito.
