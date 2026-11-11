# PDV Nexus 2.0.4 — migração e atualização sem perda de dados

## Compatibilidade e distribuição

A versão 2.0.4 usa **o mesmo código do PDV Nexus** para quem já recebeu a 2.0.3 e para quem está na 2.0.2, mas mantém **temporariamente** a identidade de instalação `br.com.artisys.pdvnexus.nova` para não sobrescrever bases em uso. A unificação definitiva de identidades exige uma migração assistida de máquinas que já operaram simultaneamente nas duas instalações.

- Clientes 2.0.2 consultam a Release pública `releases/latest/download/latest.json`.
- Clientes 2.0.3 consultam `pdv-nova-release.json`, que **permanece na versão 2.0.3 até existir uma Release pública com executáveis e SHA-256**.
- Os instaladores 2.0.4 são compilados conforme `pdv-build-release.json`. Somente depois de publicar GitHub Release o pipeline atualiza o manifesto dos clientes 2.0.3.
- O Google Drive é apenas canal opcional para entrega; não existe dependência de plano pago.

## Primeira execução de uma instalação que veio da 2.0.2

1. Antes de abrir o banco da nova edição, procurar os dados da instalação antiga no diretório do aplicativo `PDV Nexus`.
2. **Se a nova edição já tiver banco próprio, nunca sobrescrevê-lo**. Bases usadas em paralelo exigem reconciliação assistida e não devem ser mescladas por cópia arbitrária.
3. No Windows 10+, abrir o SQLite legado em modo somente leitura, validar `PRAGMA quick_check` e snapshots, fazer `VACUUM INTO` para arquivo temporário e comparar contagens/snapshots.
4. No Windows 7/8, validar o JSON e utilizar o `.bak` caso o arquivo principal esteja ilegível. Falhar de modo explícito se ambos estiverem danificados.
5. Copiar a imagem validada para `pdv-upgrade-backups` no destino; só então renomear o temporário para o arquivo ativo.
6. Preservar a instalação antiga e sua base **sem qualquer modificação ou exclusão**. Se a migração falhar, o aplicativo novo bloqueia a abertura, sem criar uma loja vazia.
7. No Windows 10+, após essa cópia, o mecanismo atual de migração cria ainda o backup por versão.

## Limitações que não devem ser ocultadas

- **Esta entrega não desinstala a edição antiga**. Quem usou as duas instalações e registrou vendas diferentes em cada base precisa de reconciliação orientada antes de eliminar qualquer delas.
- A aplicação não deve funcionar simultaneamente nas duas edições depois da migração, pois isto gera históricos divergentes.
- Migração automática de um banco JSON de Windows 7/8 para SQLite de Windows 10, ou de SQLite para JSON, **não é suportada**; o processo bloqueia em vez de descartar registros.
- Testes de CI com dados sintéticos verificam a lógica, mas não substituem testes em uma máquina representativa antes da liberação final.

## QA requerido para a publicação

- `windows-10: npm run test:pdv-upgrade && npm run test:pdv-payments && npm run typecheck`.
- `windows-7: npm run test:pdv-upgrade && npm run test:pdv-payments && npm run typecheck`.
- Builds de Windows 10, 7 e 8 x86 e QA de UI no mesmo commit da `main`, todos verdes.
- Verificação manual de uma base 2.0.2 representativa, incluindo produtos, clientes, vendas, cancelamentos, estoque e financeiro, mais teste de atualização de uma 2.0.3 sem substituição de dados.
- Conferência final dos dois canais públicos e hashes SHA-256 antes de declarar que os avisos estão ativos.

Em nenhuma hipótese publicar 2.0.4 antecipadamente só alterando o campo `version` no manifesto consumido pelos clientes.
