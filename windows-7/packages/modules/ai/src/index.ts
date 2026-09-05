import { defineModule } from "@nexus-core/core";

export const aiModule = defineModule({
  key: "ai",
  name: "Especialista IA",
  description: "Especialistas, prompts, historico, contexto e chat reutilizavel.",
  routes: [{ key: "dr-engenheiro", label: "Dr. Engenheiro", path: "/dr-engenheiro", icon: "AI" }],
  entities: ["specialist", "conversation", "message", "prompt"],
  reusable: true
});