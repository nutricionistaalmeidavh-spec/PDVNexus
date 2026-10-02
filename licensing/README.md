# Licenciamento PDV Nexus v2

A geração licenciada começa em **2.1.0**. O canal antigo fica congelado em 2.0.0 e não passa a exigir e-mail/código.

## Infraestrutura atual

O licenciamento usa o Worker `pdvnexus` e o D1 já existentes no Cloudflare.

Configure o segredo administrativo `LICENSE_ADMIN_TOKEN`.

### Criar uma licença

```powershell
$headers = @{ Authorization = "Bearer $env:PDV_LICENSE_ADMIN_TOKEN"; "Content-Type" = "application/json" }
$body = @{ email = "cliente@exemplo.com"; max_devices = 1 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "https://pdvnexus.nutricionistaalmeidavh.workers.dev/v1/admin/licenses" -Headers $headers -Body $body
```

A resposta devolve o código `NX-....` uma única vez.

Depois da primeira ativação, a máquina salva a autorização via Electron `safeStorage` e o PDV continua funcionando offline.

### Rotas

- `POST /v1/licenses/activate`
- `POST /v1/admin/licenses`
- `GET /v1/admin/licenses`
- `POST /v1/admin/licenses/revoke`

Revogar uma licença impede novas ativações. Um caixa que já foi autorizado continua funcionando offline, para não depender da disponibilidade de internet durante a operação.
