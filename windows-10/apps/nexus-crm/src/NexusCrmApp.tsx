import { AppShell, SectionCard } from "@nexus-core/ui";
import { nexusCrmDefinition } from "./app-definition";

const leads = [
  { id: "l1", name: "Construtora Atlas", stage: "Proposta" },
  { id: "l2", name: "Predial Norte", stage: "Contato inicial" },
  { id: "l3", name: "Urbaniza", stage: "Negociacao" }
];

const prompts = [
  "Resuma o historico deste lead antes da proxima reuniao.",
  "Monte uma mensagem de follow-up comercial.",
  "Sugira objeções provaveis e respostas curtas."
];

export function NexusCrmApp() {
  return (
    <AppShell title="Nexus CRM" nav={nexusCrmDefinition.navigation}>
      <SectionCard
        title="Mesmo modulo, outro produto"
        subtitle="Aqui os mesmos blocos de CRM e IA foram reutilizados em um contexto comercial."
      >
        <p style={styles.copy}>
          O que mudou foi o dominio do produto. O modulo continua o mesmo, mas a tela, os textos e os
          dados foram adaptados para outro tipo de sistema.
        </p>
      </SectionCard>

      <div style={styles.grid}>
        <SectionCard title="Leads" subtitle="Cadastro comercial reutilizando a base de entidades">
          <ul style={styles.list}>
            {leads.map((lead) => (
              <li key={lead.id} style={styles.item}>
                <strong>{lead.name}</strong>
                <span style={styles.meta}>{lead.stage}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Assistente Comercial" subtitle="Mesmo modulo de IA usado no Sr. Engenheiro">
          <ul style={styles.list}>
            {prompts.map((prompt) => (
              <li key={prompt} style={styles.promptItem}>
                {prompt}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </AppShell>
  );
}

const styles = {
  copy: {
    margin: 0,
    lineHeight: 1.6
  },
  grid: {
    display: "grid",
    gap: "16px",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))"
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "grid",
    gap: "12px"
  },
  item: {
    display: "grid",
    gap: "4px",
    padding: "14px 16px",
    borderRadius: "14px",
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0"
  },
  meta: {
    color: "#64748b"
  },
  promptItem: {
    padding: "14px 16px",
    borderRadius: "14px",
    backgroundColor: "#eff6ff"
  }
} as const;