import { defineApp } from "@nexus-core/core";
import { aiModule } from "@nexus-core/module-ai";
import { crmModule } from "@nexus-core/module-crm";

export const nexusCrmDefinition = defineApp({
  key: "nexus-crm",
  name: "Nexus CRM",
  description: "Exemplo de segundo produto criado sobre a mesma base.",
  modules: [crmModule, aiModule],
  navigation: [...crmModule.routes, ...aiModule.routes]
});