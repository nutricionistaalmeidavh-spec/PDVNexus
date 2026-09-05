# Modulo Dashboard

## Nome

`dashboard`

## Objetivo

Fornecer a base reutilizavel para dashboards com KPIs, graficos, filtros, tabela, resumo, indicadores e acoes rapidas.

## Principio visual

A logica e compartilhada, mas a identidade visual nao e. O mesmo contrato de dashboard pode renderizar:

- PDV com visual operacional escuro, denso e rapido
- Sr. Engenheiro com visual academico claro, organizado e de leitura confortavel
- Financeiro com visual enterprise, analitico e cheio de filtros

## Entidades

- `dashboard`
- `kpi`
- `chart`
- `filter`
- `quickAction`

## API/Servicos

Funcoes iniciais:

- `createKpi`
- `buildTrend`
- `formatCurrency`
- `formatNumber`
- `buildPdvDashboard`
- `buildAcademicDashboard`

## Padrao obrigatorio

Todo dashboard deve possuir, quando fizer sentido:

- KPIs
- graficos
- filtros
- tabela
- resumo
- indicadores
- acoes rapidas

## Estilos suportados

- `enterprise`
- `glassmorphism`
- `minimalism`
- `bento`
- `dark-professional`
- `academic`

## Demo

O app `apps/dashboard-demo` demonstra a mesma logica com duas identidades:

- `PDV`: operacional, escuro, rapido
- `Sr. Engenheiro`: academico, claro, organizado

Comandos:

```bash
npm run build:dashboard-demo
npm run dev --workspace @nexus-core/dashboard-demo
```

## Historico

- `0.1.0`: contratos, helpers, dashboard PDV, dashboard academico e demo visual