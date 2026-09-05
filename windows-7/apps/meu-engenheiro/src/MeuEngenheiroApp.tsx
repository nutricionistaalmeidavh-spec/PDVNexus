import { AppShell, SectionCard } from "@nexus-core/ui";
import { meuEngenheiroAppDefinition } from "./app-definition";
import { useHashRoute } from "./lib/useHashRoute";
import { ArtefatosPage } from "./pages/ArtefatosPage";
import { DisciplinasPage } from "./pages/DisciplinasPage";
import { DrEngenheiroPage } from "./pages/DrEngenheiroPage";

function HomePage() {
  return (
    <SectionCard title="Meu Engenheiro" subtitle="Escolha uma area no menu lateral para navegar pelo produto.">
      <p style={{ margin: 0, lineHeight: 1.7 }}>
        Esta versao ja separa o produto em paginas reais de Disciplinas, Dr. Engenheiro e Artefatos.
      </p>
    </SectionCard>
  );
}

export function MeuEngenheiroApp() {
  const route = useHashRoute("/disciplinas");

  return (
    <AppShell title="Meu Engenheiro" nav={meuEngenheiroAppDefinition.navigation}>
      {route === "/disciplinas" ? <DisciplinasPage /> : null}
      {route === "/dr-engenheiro" ? <DrEngenheiroPage /> : null}
      {route === "/artefatos" ? <ArtefatosPage /> : null}
      {!["/disciplinas", "/dr-engenheiro", "/artefatos"].includes(route) ? <HomePage /> : null}
    </AppShell>
  );
}