# Theme

## Compact Token Summary

Framework/styling:
- React 19 + Vite.
- No Tailwind config found.
- Styling uses inline `CSSProperties` in shared UI/apps plus one CSS file for `dashboard-demo`.
- Font stack: `"Segoe UI", "Aptos", sans-serif` for dashboard demo; `"Segoe UI", sans-serif` for shared shell.

Core shared app colors:
- Page background: `#f5f7fb`
- Main text: `#0f172a`
- Sidebar background: `#111827`
- Sidebar item background: `#1f2937`
- Sidebar border/accent: `#475569`
- Card background: `#ffffff`
- Muted text: `#475569`, `#64748b`
- Input border: `#cbd5e1`
- Soft surfaces: `#f8fafc`, `#eff6ff`, `#e2e8f0`
- Primary blue: `#2563eb`
- Danger: `#b91c1c`, `#fef2f2`, `#fecaca`

Dashboard demo tokens:
- Page light background: `#f4f6f8`, `#f6f8fc`
- Dashboard text: `#18202f`, `#172033`
- Primary blue: `#2057d8`, `#2563eb`, `#3b82f6`
- Success green: `#16a34a`, `#22c55e`
- Warning orange: `#d97706`
- Danger red: `#dc2626`, `#b91c1c`
- Dark PDV background: `#121820`, `#171e27`, panels `#1f2933`

Spacing/radius:
- Shared shell main padding: `24px`
- Sidebar width: `240px`, collapsed `76px`; dashboard demo sidebar `232px`
- Card radius: shared `20px`; dashboard demo panels `8px`; PDV operational surfaces mostly `8px`
- Inputs: `14px` to `16px` padding; radius `10px` to `16px`
- Buttons: min heights `34px`, `36px`, `44px`, `56px`, `58px`, `70px`

Shadows:
- Shared card: `0 10px 30px rgba(15, 23, 42, 0.08)`
- Dashboard active nav: `0 4px 14px rgba(20, 31, 45, 0.06)`
- Dashboard panels: `0 8px 22px rgba(20, 31, 45, 0.05)`
- POS order panel: `0 14px 28px rgba(15, 23, 42, 0.08)`

Responsive:
- Dashboard demo collapses to one column under `820px`, sidebar becomes horizontal scroll nav.
- Shared `AppShell` has no media query and is desktop-first.

## Raw Source Dumps

### `apps/dashboard-demo/src/styles.css`

```css
:root {
  color: #18202f;
  background: #f4f6f8;
  font-family: "Segoe UI", "Aptos", sans-serif;
}

* { box-sizing: border-box; }
body { margin: 0; }
button, input { font: inherit; }

.dashboard-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 232px 1fr;
}

.sidebar {
  padding: 20px;
  border-right: 1px solid rgba(20, 31, 45, 0.12);
  background: #f7f9fb;
}

.brand {
  font-weight: 800;
  margin-bottom: 22px;
}

.nav {
  width: 100%;
  min-height: 38px;
  margin-bottom: 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  padding: 0 10px;
  cursor: pointer;
}

.nav.active {
  background: #ffffff;
  border-color: rgba(20, 31, 45, 0.14);
  box-shadow: 0 4px 14px rgba(20, 31, 45, 0.06);
}

.content {
  padding: 24px;
  display: grid;
  gap: 16px;
  align-content: start;
}

.topbar {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: start;
}

.eyebrow {
  margin: 0 0 6px;
  font-size: 12px;
  text-transform: uppercase;
  color: #64748b;
}

h1, h2, p { margin-top: 0; }
h1 { margin-bottom: 6px; font-size: 28px; letter-spacing: 0; }
h2 { font-size: 15px; margin-bottom: 16px; }
.subtitle { margin-bottom: 0; color: #64748b; }

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.action {
  min-height: 36px;
  border-radius: 6px;
  border: 1px solid rgba(20, 31, 45, 0.14);
  padding: 0 12px;
  background: #ffffff;
  cursor: pointer;
}

.action--primary { background: #2057d8; color: #ffffff; border-color: #2057d8; }
.action--danger { background: #b91c1c; color: #ffffff; border-color: #b91c1c; }
```
