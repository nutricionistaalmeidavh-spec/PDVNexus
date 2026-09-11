# PDV Nexus UI QA

This integration uses the pinned ArtiSys QA 1.2.0 runtime in `../tools/artisys-qa` to exercise the real Electron renderer without mutating PDV business data.

## Local Windows run

```powershell
npm ci
npm ci --prefix tools/artisys-qa
npm run typecheck
npm run test:pdv-payments
npm run build:pdv-demo
node tools/artisys-qa/src/cli.mjs validate --config qa/artisys-qa.config.json
node tools/artisys-qa/src/cli.mjs run --config qa/artisys-qa.config.json --flow ui-review --output qa-artifacts
```

Screenshots, trace, telemetry and run summary are written under `qa-artifacts/`.

The `ui-review` flow is intentionally read-only: it only navigates between Caixa Rápido, Produtos, Clientes, Financeiro, Administração and Balança and captures each screen.
