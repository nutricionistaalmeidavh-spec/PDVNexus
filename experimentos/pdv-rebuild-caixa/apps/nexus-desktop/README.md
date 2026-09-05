# Desktop Shell

## Objetivo

Este app e o shell Electron do Nexus Core.

## O que ele faz hoje

- abre o build web do `Meu Engenheiro`
- fornece `preload` com ponte para segredos locais
- salva chaves por usuario no `userData` do app
- usa `safeStorage` do Electron para criptografar os segredos quando o sistema operacional oferece suporte
- bloqueia `window.open` e remove menu padrao

## Scripts

- `npm run desktop:start`: builda o renderer e abre o app Electron
- `npm run desktop:pack`: cria uma pasta empacotada de teste com `electron-builder --dir`
- `npm run dist --workspace @nexus-core/nexus-desktop`: gera instalador quando a distribuicao estiver pronta

## Proximo passo

- adicionar icone e metadados de instalador
- trocar armazenamento por cofre nativo dedicado se precisarmos de garantias maiores
- adicionar bridge de porta serial e HID para PDV/balanca