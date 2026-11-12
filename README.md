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

## Atualização para clientes existentes (2.0.2 → 2.0.4)

O **PDV Nexus é um produto único**. Todos os três instaladores Windows 10+, Windows 7 e Windows 8 32-bit mantêm o appId original `com.nexuscore.pdv`, nome de aplicação `PDV Nexus`, atalho e diretório `userData` do 2.0.2. Não é necessária uma "Nova Edição" nem uma importação entre instalações para atualizar o software.

O manifesto de atualização continua sendo `pdv-release.json` e os clientes já instalados verificam `https://github.com/nutricionistaalmeidavh-spec/PDVNexus/releases/latest/download/latest.json`. O sistema detecta uma nova versão, baixa o arquivo do canal e arquitetura corretos, valida SHA-256 e oferece **Instalar agora / Depois**. Os dados comerciais locais **não podem ser apagados durante o upgrade**.

Na abertura da versão 2.0.4 o `pdv-lifecycle.cjs` prepara backup do SQLite quando necessário, e o `main.cjs` utiliza migração aditiva, sem limpeza das tabelas. Em Windows 7/8 o arquivo JSON legado permanece no mesmo local e seu gravador usa cópia `.bak` e troca atômica. O modelo de fornecedores e as melhorias de busca/CSV introduzidos pela PR #44 adicionam campos opcionais compatíveis com registros anteriores.

O manifesto `pdv-nova-release.json` foi preservado apenas como arquivo de compatibilidade **inativo** (`artifacts: {}`) para não gerar atualização silenciosa em uma hipotética instalação de 2.0.3; o empacotamento, os builds e a publicação não o utilizam mais. Não publicar nem enviar ao cliente os instaladores da antiga edição paralela.

A publicação do 2.0.4 exige CI verde nas três arquiteturas e QA, criação da release e sincronização dos instaladores para o Drive. A pasta de clientes deve conter somente os três instaladores atuais, tutoriais em vídeo e manual. Instaladores anteriores vão para `Pdv antigos` **fora** da pasta enviada aos clientes, após verificação da cópia.

QA: `cd windows-10 && npm ci && npm run test:pdv-upgrade && npm run test:pdv-payments && npm run typecheck`; repetir em `windows-7` e verificar os três instaladores por hashes SHA-256.

## Hotfix PDV Nexus 2.0.5 — 12/11/2026

Esta release corrige possíveis travamentos de interface em abertura de caixa, cadastro e pesquisa de produtos. A gravação SQLite incremental atualiza apenas entidades alteradas, preservando a transação, o controle CAS/revision, o histórico e o backup de migração. A pesquisa mantém índice normalizado do catálogo e o autocompletar exibe até 8 sugestões. O atualizador solicita consentimento antes de baixar, transmite o instalador por stream e calcula o SHA-256 de modo assíncrono.

Instalações já existentes 2.0.2 e 2.0.4 devem ser atualizadas sem desinstalar, mantendo o appId e userData. Não reinstalar versão antiga 2.0.2 como rollback: continha rotina de reset de dados quando a versão mudava. A publicação da 2.0.5 depende dos builds Windows 7/8/10, QA comercial/visual verdes e sincronização do Google Drive de clientes.
