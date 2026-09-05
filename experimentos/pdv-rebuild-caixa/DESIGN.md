---
version: alpha
colors:
  canvas: "#F5F7FA"
  surface: "#FFFFFF"
  ink: "#10213A"
  muted: "#60708A"
  sidebar: "#0B1B33"
  accent: "#0B8AA5"
  success: "#16804B"
  danger: "#D84D57"
typography:
  display:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "1.5rem"
    lineHeight: "1.2"
  body:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "1rem"
    lineHeight: "1.45"
rounded:
  control: "0.75rem"
  panel: "1rem"
spacing:
  compact: "0.5rem"
  regular: "1rem"
  spacious: "1.5rem"
components:
  sidebar:
    expandedWidth: "12.5rem"
    collapsedWidth: "4.75rem"
  cashier:
    layout: "catalog-and-order"
---

## Overview

The rebuild is a desktop operational point of sale for an operator using a keyboard, barcode scanner, and sometimes a scale. The cashier surface is the primary workflow: fast, calm, readable, and dense enough for real operation without becoming a dashboard.

## Colors

Use navy for structure, teal for committed operational actions, green for an open/healthy cash state, and red only for destructive actions. The canvas stays neutral and panels are flat with subtle borders rather than decorative shadows.

## Typography

Use Segoe UI with system fallbacks. Data labels are compact and high contrast; totals and primary actions have stronger weight. Avoid marketing copy and oversized titles on the cashier route.

## Layout

The sidebar is intentionally narrow: 200px expanded and 76px collapsed. The Cashier has a status strip, scanner search/actions, a product catalog zone, and a persistent current-order zone. At small widths the catalog and order stack without hiding controls.

## Elevation & Depth

Panels separate through spacing, one-pixel borders, and restrained surface color. Shadows are reserved for dialogs only.

## Shapes

Inputs and buttons use a 12px radius. Primary operational panels use 16px. Avoid pills except category filters.

## Components

Shared UI primitives in `packages/ui` own the sidebar shell, buttons, inputs, section cards, focus states, and global scrollbar baseline. The Cashier extends those primitives rather than duplicating them screen by screen.

## Do's and Don'ts

- Do keep F2, F3, F4, F6, F8 and Delete visible as shortcuts in the cashier.
- Do show a clear active-cash state and protect destructive actions with app-owned confirmation UI.
- Do derive product lists from SQLite queries via IPC.
- Do not use localStorage or screen-specific persisted product copies.
- Do not hide scrollbars or make an entire page a nested fixed-height scroller.
- Do not turn the cashier into a reporting dashboard.
