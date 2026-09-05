# Nexus Core Design System

## Product Context

Nexus Core is a reusable software factory for operational desktop/web products: ERP-like apps, POS, CRM, academic assistant workflows, dashboards, and reusable business modules. Interfaces should feel work-focused, dense, clear, and reliable. Prioritize scanning, repeated actions, comparison, and operational confidence over marketing-style presentation.

Key surfaces:
- `Meu Engenheiro`: academic app with disciplines, AI specialist chat, and generated artifacts.
- `PDV Demo`: point-of-sale desktop workflow with checkout, products, customers, finance, administration, and scale integrations.
- `Nexus CRM`: compact CRM demo showing reusable modules in another domain.
- `Dashboard Demo`: KPI/chart dashboards for operational and academic contexts.

## Visual Principles

- Use practical desktop application layouts: sidebars, topbars, toolbars, grids, tables, forms, panels, and clear action areas.
- Keep information density high but organized.
- Avoid oversized landing-page hero sections for product screens.
- Avoid nested cards and decorative background blobs.
- Use restrained, professional surfaces with strong hierarchy through spacing, weight, and alignment.
- Use consistent controls for workflows: icon or short-label buttons for commands, tabs/segmented controls for modes, inputs for search/filtering, tables for operational records.

## Typography

- Primary font: `Segoe UI`, fallback `Aptos`, `Arial`, `sans-serif`.
- H1/page title: 28-32px, 700-800 weight, line-height 1.05-1.15.
- Section/card title: 15-20px, 700 weight.
- Body: 14-16px, line-height 1.5-1.7.
- Metadata/eyebrows: 11-12px, uppercase only where already established, muted color.
- Letter spacing: `0` except tiny uppercase eyebrows may use up to `0.14em`.

## Color Tokens

Core:
- Page background: `#f5f7fb`
- Main text: `#0f172a`
- Muted text: `#475569`, `#64748b`
- Border: `#cbd5e1`, `#e2e8f0`
- Card/surface: `#ffffff`
- Soft surface: `#f8fafc`
- Blue primary: `#2563eb`, `#2057d8`
- Info surface: `#eff6ff`
- Danger: `#b91c1c`, `#fef2f2`, `#fecaca`

Navigation:
- Sidebar background: `#111827`
- Sidebar item: `#1f2937`
- Sidebar text: `#e5e7eb`, `#ffffff`
- Sidebar border/accent: `#475569`

Operational dashboard:
- Dark PDV page: `#121820`
- Dark sidebar: `#171e27`
- Dark panel: `#1f2933`
- Dark text: `#dbe4ef`, `#e7eef7`
- Operational success: `#16a34a`, `#22c55e`
- Warning: `#d97706`
- Danger: `#dc2626`

## Spacing And Shape

- Page padding: 24px desktop.
- Grid gaps: 10px, 12px, 16px, 18px.
- Compact controls: 34-38px tall.
- Standard inputs/buttons: 44px tall.
- POS primary controls: 56-70px tall.
- App cards: existing shared cards use 20px radius; new dense operational panels should prefer 8px radius unless matching existing shared `SectionCard`.
- Pill radius: 999px.

## Effects

- Shared cards: `0 10px 30px rgba(15, 23, 42, 0.08)`.
- Dashboard panels: `0 8px 22px rgba(20, 31, 45, 0.05)`.
- Active nav: `0 4px 14px rgba(20, 31, 45, 0.06)`.
- Keep shadows subtle; use borders for structure.

## Component Style

- `AppShell`: dark sticky sidebar, fixed desktop grid, content area with simple H1 header.
- `SectionCard`: white card, clear heading/subtitle, internal content slot.
- `TextInput`: full-width rounded input, generous padding.
- `Pill`: compact muted metadata tag.
- Dashboard panels: 8px radius, thin border, white or dark surface depending context.

## Improvement Direction

For redesign variants, preserve the product’s practical business-app character while improving:
- Navigation clarity and active state.
- Visual hierarchy in cards, lists, tables, and filters.
- Button affordance and action grouping.
- Responsive behavior, especially the currently desktop-first shared shell.
- Domain-specific tone: POS should be fast and high-contrast; academic assistant should be calmer and organized; CRM should be pipeline-oriented; dashboards should be compact and analytical.

Use ONLY these fonts, colors, spacing, and component styles unless the user explicitly approves a new brand direction.
