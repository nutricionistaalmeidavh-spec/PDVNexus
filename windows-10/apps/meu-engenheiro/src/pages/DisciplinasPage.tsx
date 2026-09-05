import { meuEngenheiroSeed } from "@nexus-core/database";
import { SectionCard, TextInput } from "@nexus-core/ui";
import { useState } from "react";

export function DisciplinasPage() {
  const { disciplines, semesters } = meuEngenheiroSeed;
  const [query, setQuery] = useState("");

  const normalized = query.trim().toLowerCase();

  return (
    <>
      <SectionCard title="Minhas Disciplinas" subtitle={`${disciplines.length} disciplinas cadastradas`}>
        <TextInput value={query} onChange={setQuery} placeholder="Buscar disciplina..." />
      </SectionCard>

      {semesters.map((semester) => {
        const filtered = disciplines.filter(
          (discipline) =>
            discipline.semesterId === semester.id &&
            (!normalized || discipline.name.toLowerCase().includes(normalized))
        );

        if (filtered.length === 0) {
          return null;
        }

        return (
          <SectionCard
            key={semester.id}
            title={semester.name}
            subtitle={`${filtered.length} disciplina(s) neste agrupamento`}
          >
            <div style={styles.list}>
              {filtered.map((discipline) => (
                <div key={discipline.id} style={styles.item}>
                  <span style={{ ...styles.dot, backgroundColor: discipline.color }} />
                  <div>
                    <strong>{discipline.name}</strong>
                    <div style={styles.meta}>
                      {discipline.materialCount} materiais • {discipline.conversationCount} conversa(s)
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        );
      })}
    </>
  );
}

const styles = {
  list: {
    display: "grid",
    gap: "12px"
  },
  item: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
    padding: "14px 16px",
    borderRadius: "16px",
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0"
  },
  dot: {
    width: "14px",
    height: "14px",
    borderRadius: "999px",
    marginTop: "4px",
    flexShrink: 0
  },
  meta: {
    color: "#64748b",
    marginTop: "6px"
  }
} as const;