# Extractable Components

## AppShell
- Source: `packages/ui/src/index.tsx`
- Category: layout
- Description: Shared two-column app shell with collapsible sidebar, brand text, navigation items, and page title.
- Extractable props: `title` (string, default: "Meu Engenheiro"), `collapsed` (boolean, default: false), `activeItem` (string, default: "disciplinas")
- Hardcoded: Nexus Core brand text, dark sidebar styling, typography, sidebar item treatment.

## SectionCard
- Source: `packages/ui/src/index.tsx`
- Category: basic
- Description: White content card with title, subtitle, shadow, and optional wide layout behavior.
- Extractable props: `title` (string), `subtitle` (string), `wide` (boolean, default: false)
- Hardcoded: white background, 20px radius, shadow, internal spacing.

## Pill
- Source: `packages/ui/src/index.tsx`
- Category: basic
- Description: Compact gray pill label used for discipline/artifact tags.
- Extractable props: `label` (string)
- Hardcoded: gray background, dark slate text, rounded shape.

## TextInput
- Source: `packages/ui/src/index.tsx`
- Category: basic
- Description: Full-width rounded search/text input.
- Extractable props: `value` (string), `placeholder` (string)
- Hardcoded: border, radius, padding, font size.

## DashboardShell
- Source: `apps/dashboard-demo/src/DashboardDemoApp.tsx`
- Category: layout
- Description: CSS-based dashboard layout with sidebar, topbar, action buttons, filters, KPI grid, chart grid, and table area.
- Extractable props: `activeDashboard` (string, default: "pdv")
- Hardcoded: Nexus Dashboards brand, sidebar/tab behavior, card and chart styling.
