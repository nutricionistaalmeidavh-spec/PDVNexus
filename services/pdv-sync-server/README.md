# Servidor multiloja PDV Nexus — P2/P3

Serviço **opcional**, 100% self-hosted e open source: Node.js 22, PostgreSQL 17 e pg. O caixa **continua** em SQLite (Windows 10+) ou no JSON legado (Windows 7/8); não há dependência de SaaS.

## Instalação
1. Instale PostgreSQL 17 no servidor privado ou execute docker compose (definir PDV_POSTGRES_PASSWORD fora do repositório).
2. Defina DATABASE_URL fora do Git, no ambiente do serviço. Nunca comite credenciais.
3. Execute npm install --no-audit --no-fund dentro deste diretório.
4. Cadastre cada terminal com: npm run provision -- empresa-local "Minha Empresa" matriz "Matriz" CAIXA-01
5. A credencial de acesso é exibida uma única vez: use-a no PDV para conectar a unidade correspondente.
6. npm start (porta 4317, escuta somente 127.0.0.1 por padrão).

Para acessar de outros computadores, configure proxy HTTPS self-hosted ou WireGuard. Não exponha HTTP sem criptografia à internet. Opcional PDV_SYNC_HOST e PDV_SYNC_PORT e PDV_ADMIN_TOKEN (mín. 32 caracteres).

## Endpoints
- GET /health (sem autenticação).
- GET /v1/meta (Bearer do terminal: empresa, filial e ID).
- POST /v1/sync/push com eventos incrementais (até 250 por lote, atômico, idempotente).
- GET /v1/sync/pull?after=0&limit=100 (cursor incremental por filial).
- GET /v1/admin/overview (token administrativo opcional).

A mesma identificação de evento não pode representar payload diferente: retorna HTTP 409 e rollback de toda a transação. Tokens não concedem acesso a filiais ou terminais diferentes.

## Segurança e limites
- Comunicação no transporte deve utilizar HTTPS ou túnel VPN seguro fora do computador.
- Banco PostgreSQL não é armazenado no mesmo diretório do SQLite; efetue backup com pg_dump.
- O servidor guarda eventos imutáveis de vendas, cancelamentos, movimentações de estoque, cadastros; não substitui snapshots dos terminais indiscriminadamente.
- Operações offline podem produzir conflitos de estoque; o cliente bloqueia conciliação insegura. Não existe garantia de estoque global durante desconexão.
- Sem fiscal: não emite NF-e ou NFC-e.
