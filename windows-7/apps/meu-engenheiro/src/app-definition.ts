import { defineApp } from "@nexus-core/core";
import { aiModule } from "@nexus-core/module-ai";
import { crmModule } from "@nexus-core/module-crm";
import { documentosModule } from "@nexus-core/module-documentos";

export const meuEngenheiroAppDefinition = defineApp({
  key: "meu-engenheiro",
  name: "Meu Engenheiro",
  description: "App academico com especialista IA e biblioteca de artefatos.",
  modules: [crmModule, aiModule, documentosModule],
  navigation: [...crmModule.routes, ...aiModule.routes, ...documentosModule.routes]
});