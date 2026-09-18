# Distribuição automática do PDV Nexus no Google Drive

O workflow `Publish PDV Release` mantém dois canais sincronizados depois que W10, W7, W8 x86 e QA passam para o mesmo commit:

1. GitHub Release, usada pelo atualizador dos clientes existentes.
2. Google Drive, usada como canal de primeira instalação para clientes novos.

## Segurança

A autenticação do Google Drive nunca deve ser versionada no repositório.

O GitHub Actions espera o secret de repositório:

`PDV_GDRIVE_RCLONE_CONFIG`

Ele deve conter apenas a configuração do remote rclone autorizado `artisys-qa-drive`.

Em uma máquina que já tenha esse remote autenticado, o secret pode ser cadastrado sem imprimir o token na tela:

```powershell
rclone config show artisys-qa-drive | gh secret set PDV_GDRIVE_RCLONE_CONFIG --repo nutricionistaalmeidavh-spec/PDVNexus
```

A configuração é enviada pela entrada padrão e armazenada como GitHub Actions Secret.

## Destino

- Pasta pública de distribuição: `1M0_SfF1h_zUqEM-Ns1HJ8ZtCMMcbHnFr`
- Histórico: `anterior`

Esses valores ficam em `pdv-release.json` para que o workflow e o QA validem o mesmo destino.

## Ordem transacional

Para uma versão nova:

1. Confirma W10, W7, W8 x86 e QA verdes no mesmo SHA.
2. Confirma que a credencial privada do Drive existe.
3. Baixa os três instaladores dos artifacts aprovados.
4. Gera `latest.json` e hashes da GitHub Release.
5. Cria a GitHub Release como **draft**.
6. Envia os três instaladores para uma pasta temporária no Drive.
7. Executa `rclone check` na pasta temporária.
8. Copia os três instaladores para a pasta principal do Drive.
9. Executa `rclone check` novamente na pasta principal.
10. Move instaladores antigos para `anterior`.
11. Publica a GitHub Release, tirando-a de draft.

Se a sincronização do Drive falhar, a release nova permanece como draft e não se torna o canal `latest` dos clientes existentes.

## Nomes publicados no Drive

- `PDV-Nexus-Windows-10-Setup-<versão>.exe`
- `PDV-Nexus-Windows-7-Setup-<versão>.exe`
- `PDV-Nexus-Windows-8-32bit-Setup-<versão>.exe`

O manual e o `Bem-vindo.txt` não são alterados pelo workflow.
