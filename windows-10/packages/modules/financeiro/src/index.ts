import { defineModule } from "@nexus-core/core";

export const financeiroModule = defineModule({
  key: "financeiro",
  name: "Financeiro",
  description: "Modulo financeiro reutilizavel para futuros produtos da plataforma.",
  routes: [],
  entities: ["account", "transaction", "costCenter"],
  reusable: true
});