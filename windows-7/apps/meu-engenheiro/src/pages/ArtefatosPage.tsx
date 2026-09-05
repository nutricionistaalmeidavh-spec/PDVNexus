import { meuEngenheiroSeed } from "@nexus-core/database";
import { Pill, SectionCard, TextInput } from "@nexus-core/ui";
import { useMemo, useState } from "react";

const labels: Record<string, string> = {
  resumo: "Resumo",
  infografico: "Infografico",
  "mapa-mental": "Mapa Mental",
  imagem: "Imagem"
};

export function ArtefatosPage() {
  const { artifacts, disciplines } = meuEngenheiroSeed;
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("todos");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return artifacts.filter((artifact) => {
      const matchesQuery = !normalized || artifact.title.toLowerCase().includes(normalized);
      const matchesType = typeFilter === "todos" || artifact.type === typeFilter;
      return matchesQuery && matchesType;
    });
  }, [artifacts, query, typeFilter]);

  const types = ["todos", ...new Set(artifacts.map((artifact) => artifact.type))];

  return (
    <>
      <SectionCard title="Artefatos" subtitle="Conteudos gerados pela IA em todas as disciplinas">
        <TextInput value={query} onChange={setQuery} placeholder="Buscar artefato..." />
        <div style={styles.filters}>
          {types.map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              style={{ ...styles.filterButton, ...(typeFilter === type ? styles.filterButtonActive : {}) }}
            >
              {type === "todos" ? "Todos" : labels[type] ?? type}
            </button>
          ))}
        </div>
      </SectionCard>

      <div style={styles.grid}>
        {filtered.map((artifact) => {
          const discipline = disciplines.find((item) => item.id === artifact.disciplineId);

          return (
            <SectionCard key={artifact.id} title={artifact.title} subtitle={artifact.createdAt}>
              <Pill>{labels[artifact.type] ?? artifact.type}</Pill>
              <p style={styles.discipline}>{discipline?.name ?? "Sem disciplina"}</p>
              <div style={styles.actions}>
                <button style={styles.actionButton}>Abrir</button>
                <button style={styles.actionButton}>Duplicar</button>
                <button style={styles.dangerButton}>Excluir</button>
              </div>
            </SectionCard>
          );
        })}
      </div>
    </>
  );
}

const styles = {
  filters: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginTop: "16px"
  },
  filterButton: {
    padding: "10px 14px",
    borderRadius: "999px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#ffffff",
    cursor: "pointer"
  },
  filterButtonActive: {
    backgroundColor: "#2563eb",
    color: "#ffffff",
    borderColor: "#2563eb"
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "16px"
  },
  discipline: {
    color: "#475569"
  },
  actions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap"
  },
  actionButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#ffffff",
    cursor: "pointer"
  },
  dangerButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #fecaca",
    backgroundColor: "#fef2f2",
    color: "#b91c1c",
    cursor: "pointer"
  }
} as const;