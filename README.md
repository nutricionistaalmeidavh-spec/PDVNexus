# PDV Nexus

Repositorio organizado por compatibilidade de sistema operacional.

## Edicoes

| Pasta | Plataforma | Runtime desktop | Persistencia local | Geracao do instalador |
| --- | --- | --- | --- | --- |
| [`windows-10/`](windows-10/) | Windows 10 e superiores | Electron 39.8.10 | SQLite nativo (`node:sqlite`) | `npm run desktop:dist:pdv` |
| [`windows-7/`](windows-7/) | Windows 7 x64 | Electron 22.3.27 | Arquivo JSON local | `npm run desktop:dist:pdv:win7` |

## Diferencas importantes

- A edicao Windows 10 usa o runtime atual do projeto e armazenamento relacional em SQLite.
- A edicao Windows 7 fixa o Electron 22, ultima linha usada pelo projeto para compatibilidade com esse sistema.
- No Windows 7, `node:sqlite` nao esta disponivel; por isso a persistencia desktop usa `pdv-nexus-data.json`.
- O driver `serialport` e fixado em `10.5.0` no Windows 7 e usa a serie 13 no Windows 10.
- O instalador do Windows 7 possui configuracao propria e gera o artefato `PDV-Nexus-Windows-7-Setup-*`.

Cada edicao possui seu proprio `package.json`, lockfile, codigo-fonte, testes e instrucoes. Instale e execute os comandos dentro da pasta da edicao desejada.

## Experimentos

`experimentos/pdv-rebuild-caixa/` preserva a reconstrucao experimental da interface de caixa separada das duas edicoes publicaveis.

## Inicio rapido

```powershell
cd windows-10 # ou windows-7
npm ci
npm run typecheck
npm run test:pdv-payments
```

Os instaladores e demais arquivos gerados nao sao versionados; devem ser produzidos localmente pelos scripts de cada edicao.
