# UX Contract - PDV Nexus Rebuild

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Table Selection | Native table rows and explicit action buttons | PdvDemoApp catalog state | no bulk selection | keyboard + product flow |
| Select/Listbox | Native select | Electron desktop platform controls | native popup | keyboard selection |
| Date | Formatted readonly desktop timestamps | SQLite timestamps | no date picker in this cut | locale rendering |
| Form | PdvDemoApp product form | SQLite catalog mutation | create / edit / cancel | create-edit-delete flow |
| Scrollbar | Native desktop scrollbar | Electron platform | table/list overflow | narrow layout |
| Toast | Persistent event message in the cashier surface | PdvDemoApp lastEvent | success / error | mutation feedback |
| CRUD | IPC catalog bridge | SQLite `pdv_products` | product create / edit / delete | SQLite readback |

## Data ownership

SQLite in the Electron main process is the sole persistent source for products, customers, inventory, cash sessions, sales, and reports. Renderer state is transient presentation state only. The renderer receives data through explicit IPC queries and mutations; it never persists PDV business data in localStorage.

## Catalog consistency

Products, stock selection, category filters, product tiles, barcode lookup, and sales validation all consume the same `catalog` query. A successful create, edit, stock movement, or delete increments the catalog revision and refetches every catalog consumer.

## Cashier shortcuts

| Key | Effect |
| --- | --- |
| F2 | Inicia uma nova venda. |
| F3 | Foca a busca/leitor de produto. |
| F6 | Registra o pagamento à vista, como na versão funcional atual. |
| F8 | Finaliza uma venda válida. |
| Delete | Remove o último item quando o foco não está em campo de texto. |
| Escape | Fecha um diálogo ou cancela uma edição ainda não salva. |

Shortcut handlers are scoped to `/caixa`, ignore IME composition, and never intercept typing in an input, textarea, select, or dialog field.

## Fonte do catálogo

Na reconstrução, Produtos e Caixa carregam o catálogo pela rota `pdvCatalog`, que consulta `pdv_products` no SQLite. Cadastro, edição e exclusão devolvem a lista recém-lida da tabela antes de atualizar a interface. O snapshot legado permanece temporariamente para as outras áreas, mas não é a fonte que monta o catálogo do caixa.

## Destructive actions

Deleting a product or customer requires an app-owned confirmation dialog naming the record. Product deletion removes it from the active catalog but preserves historical sale and stock records. Success refreshes affected query consumers and announces the result.

## Feedback and recovery

Mutations disable their triggering control while pending, retain form values after an error, expose errors in text, and do not use browser alert/confirm/prompt. Lists have loading, empty, and error states without moving primary controls.
