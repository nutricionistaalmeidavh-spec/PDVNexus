import { defineModule } from "@nexus-core/core";

export const documentosModule = defineModule({
  key: "documentos",
  name: "Artefatos",
  description: "Documentos, artefatos, filtros, exportacao e biblioteca de conteudo.",
  routes: [{ key: "artefatos", label: "Artefatos", path: "/artefatos", icon: "AR" }],
  entities: ["artifact", "artifactType", "attachment"],
  reusable: true
});