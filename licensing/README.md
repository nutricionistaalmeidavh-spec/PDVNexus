# Licenciamento PDV Nexus v2

A geração licenciada começa em **2.1.0**. O canal antigo fica congelado em 2.0.0 e não passa a exigir e-mail/código.

## Núcleo R$ 0 / self-hosted / open source

`licensing/self-hosted/server.mjs` usa apenas Node.js 22 e SQLite.

```powershell
$env:PDV_LICENSE_ADMIN_TOKEN = "troque-por-um-segredo-forte"
$env:PDV_LICENSE_HOST = "127.0.0.1"
$env:PDV_LICENSE_PORT = "8790"
node licensing/self-hosted/server.mjs
```

Para uso fora da rede local, publique atrás de HTTPS e gere o instalador com `PDV_LICENSE_ENDPOINT` apontando para essa URL.

## Cloudflare opcional

O Worker `pdvnexus` oferece a mesma API sobre o D1 existente. Configure o segredo `LICENSE_ADMIN_TOKEN`.

Criar uma licença:

```powershell
$headers = @{ Authorization = "Bearer $env:PDV_LICENSE_ADMIN_TOKEN"; "Content-Type" = "application/json" }
$body = @{ email = "cliente@exemplo.com"; max_devices = 1 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "https://pdvnexus.nutricionistaalmeidavh.workers.dev/v1/admin/licenses" -Headers $headers -Body $body
```

A resposta devolve o código `NX-....` uma única vez. A máquina ativada salva a autorização via `safeStorage` e continua funcionando offline. Revogar uma licença impede novas ativações, mas não derruba um caixa já autorizado quando ele estiver offline.
