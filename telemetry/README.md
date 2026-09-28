# Telemetria do PDV Nexus

A telemetria do PDV Nexus e opcional, privacy-first e fail-open: nenhuma venda, estoque, caixa, impressao ou atualizacao depende dela para funcionar.

## Politica do cliente

- endpoint vazio por padrao: nenhum dado e enviado;
- consentimento explicito antes do primeiro envio;
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

## Coletor principal: self-hosted, R$ 0

Requer Node.js 22+ e usa apenas modulos nativos (`node:http` e `node:sqlite`).

```powershell
$env:PDV_TELEMETRY_ADMIN_TOKEN = "troque-por-um-segredo-forte"
$env:PDV_TELEMETRY_HOST = "127.0.0.1"
$env:PDV_TELEMETRY_PORT = "8788"
node telemetry/self-hosted/server.mjs
```

O banco SQLite e criado em `data/pdv-nexus-telemetry.sqlite` por padrao. Para clientes fora da mesma rede, publique o coletor atras de HTTPS (por exemplo Caddy/Nginx ou tunnel de sua escolha) e use a URL HTTPS como endpoint do PDV.

Endpoints:

- `GET /health`
- `POST /v1/installations/register`
- `POST /v1/events`
- `GET /v1/admin/summary` com `Authorization: Bearer <PDV_TELEMETRY_ADMIN_TOKEN>`

O resumo administrativo retorna contagem de instalacoes, estimativa de online nos ultimos 10 minutos, ativos em 24 horas e erros tecnicos em 24 horas.

## Opcional: Cloudflare Worker + D1

Existe um adaptador em `cloudflare/telemetry/` que implementa o mesmo protocolo. Ele e opcional e nao e dependencia do PDV.

Passos gerais:

1. criar um D1 dedicado `pdv-nexus-telemetry`;
2. colocar o `database_id` em `cloudflare/telemetry/wrangler.jsonc`;
3. aplicar `cloudflare/telemetry/migrations/0001_init.sql`;
4. cadastrar `TELEMETRY_ADMIN_TOKEN` como secret do Worker;
5. publicar o Worker;
6. compilar o instalador com `PDV_TELEMETRY_ENDPOINT=https://...` definido explicitamente.

## Ativacao no instalador

A telemetria so ganha endpoint embutido quando `PDV_TELEMETRY_ENDPOINT` e informado no momento do build. Sem essa variavel, o instalador permanece com telemetria sem destino e nao envia nada.
