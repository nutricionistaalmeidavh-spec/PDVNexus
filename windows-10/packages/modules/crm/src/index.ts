import { defineModule } from "@nexus-core/core";

export const crmModule = defineModule({
  key: "crm",
  name: "Cadastros Base",
  description: "Modulo de entidades, relacionamentos e cadastros reaproveitaveis.",
  routes: [{ key: "disciplinas", label: "Disciplinas", path: "/disciplinas", icon: "DB" }],
  entities: ["category", "group", "item"],
  reusable: true
});