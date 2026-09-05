export interface Semester {
  id: string;
  name: string;
  disciplineCount: number;
}

export interface Discipline {
  id: string;
  name: string;
  semesterId: string;
  materialCount: number;
  conversationCount: number;
  color: string;
}

export interface Artifact {
  id: string;
  title: string;
  type: "resumo" | "infografico" | "mapa-mental" | "imagem";
  disciplineId: string;
  createdAt: string;
}

export interface SpecialistPrompt {
  id: string;
  question: string;
}

export interface MeuEngenheiroSeed {
  semesters: Semester[];
  disciplines: Discipline[];
  artifacts: Artifact[];
  prompts: SpecialistPrompt[];
}

export const meuEngenheiroSeed: MeuEngenheiroSeed = {
  semesters: [
    { id: "s1", name: "1o Semestre", disciplineCount: 1 },
    { id: "el", name: "Eletivas", disciplineCount: 2 }
  ],
  disciplines: [
    {
      id: "d1",
      name: "Legislacao, seguranca do trabalho e meio ambiente",
      semesterId: "s1",
      materialCount: 5,
      conversationCount: 1,
      color: "#22c55e"
    },
    {
      id: "d2",
      name: "Instalacoes hidrossanitarias",
      semesterId: "el",
      materialCount: 23,
      conversationCount: 1,
      color: "#3b82f6"
    },
    {
      id: "d3",
      name: "Comportamento organizacional",
      semesterId: "el",
      materialCount: 3,
      conversationCount: 0,
      color: "#10b981"
    }
  ],
  artifacts: [
    {
      id: "a1",
      title: "Tornover",
      type: "infografico",
      disciplineId: "d1",
      createdAt: "2026-05-24"
    },
    {
      id: "a2",
      title: "Encanador",
      type: "mapa-mental",
      disciplineId: "d2",
      createdAt: "2026-05-10"
    },
    {
      id: "a3",
      title: "Encanador",
      type: "resumo",
      disciplineId: "d2",
      createdAt: "2026-05-10"
    }
  ],
  prompts: [
    { id: "p1", question: "Explique os principios do dimensionamento de reservatorios de agua" },
    { id: "p2", question: "Quais sao as normas ABNT para instalacoes hidrossanitarias?" },
    { id: "p3", question: "Como calcular a resistencia de uma viga de concreto armado?" }
  ]
};
export * from './pdv';
