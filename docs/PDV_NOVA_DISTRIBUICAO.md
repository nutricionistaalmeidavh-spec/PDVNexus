# PDV Nexus Nova — isolamento da distribuição

## Estado seguro da nova linha (2.1.0)
- Instalador e identificador Windows distintos: **PDV Nexus Nova** e `com.artisys.pdvnexus.nova`.
- Os instaladores novos são gerados como artifacts do GitHub Actions por Windows 10+, 7 x64 e 8 x86.
- O manifesto de atualização da nova linha começa **vazio**: esta edição não pesquisa atualizações na distribuição legada e não incomoda clientes existentes.
- A versão antiga usa `releases/latest/download/latest.json`, preservada em `legacyManifestUrl` apenas como referência. A release antiga não deve ser substituída, reclassificada como latest nem sobrescrita.
- O job `publish` do workflow histórico foi desabilitado permanentemente (`if: false`) para impedir que um merge publique a versão 2.1.0 e acione instalações legadas.
- Não configurar `pdvUpdateManifestUrl` com a URL antiga, nem publicar no mesmo `latest`; quando houver lançamento aprovado, criar canal de release separado e validar o cliente legado contra o manifesto antigo.
- A identidade nova usa pasta de dados do aplicativo diferente; **não há migração automática** da base de clientes antigos. Uma eventual migração deve ser explícita, por backup/importação verificada, sem substituir o banco original.

## Checklist de publicação futura
1. Validar `npm run typecheck`, `npm run test:pdv-payments`, `npm run test:pdv-upgrade`, e E2E com provas visuais.
2. Baixar instaladores **Nova** do GitHub Actions; conferir SHA-256, execução e identidade independente no registro de programas instalados.
3. Verificar que o PDV legado continua instalado e não recebe aviso de atualização.
4. Apenas após aprovação explícita criar um canal de distribuição da Nova com manifesto e histórico independentes, nunca `releases/latest` do PDVNexus original.
5. O Google Drive da versão antiga também não deve ser sobrescrito com instaladores da Nova.

Zero dependências de serviços pagos. Núcleo offline / self-hosted / open source.
