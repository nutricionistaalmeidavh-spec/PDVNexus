import { meuEngenheiroSeed } from "@nexus-core/database";
import { Pill, SectionCard } from "@nexus-core/ui";
import { useEffect, useState } from "react";
import {
  createChatService,
  getGeminiApiKey,
  getGroqApiKey,
  getOpenRouterApiKey,
  saveGeminiApiKey,
  saveGroqApiKey,
  saveOpenRouterApiKey
} from "../lib/ai";

interface ConversationItem {
  role: "user" | "assistant";
  content: string;
}

export function DrEngenheiroPage() {
  const [input, setInput] = useState("");
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState("");
  const [openRouterApiKeyInput, setOpenRouterApiKeyInput] = useState("");
  const [groqApiKeyInput, setGroqApiKeyInput] = useState("");
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [hasOpenRouterKey, setHasOpenRouterKey] = useState(false);
  const [hasGroqKey, setHasGroqKey] = useState(false);
  const [isSavingKeys, setIsSavingKeys] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const { prompts, disciplines } = meuEngenheiroSeed;

  useEffect(() => {
    void loadKeyState();
  }, []);

  async function loadKeyState() {
    const [geminiKey, openRouterKey, groqKey] = await Promise.all([
      getGeminiApiKey(),
      getOpenRouterApiKey(),
      getGroqApiKey()
    ]);
    setHasGeminiKey(Boolean(geminiKey));
    setHasOpenRouterKey(Boolean(openRouterKey));
    setHasGroqKey(Boolean(groqKey));
    setGeminiApiKeyInput(geminiKey);
    setOpenRouterApiKeyInput(openRouterKey);
    setGroqApiKeyInput(groqKey);
  }

  async function handleSaveKeys() {
    setIsSavingKeys(true);
    setError("");

    try {
      await Promise.all([
        saveGeminiApiKey(geminiApiKeyInput),
        saveOpenRouterApiKey(openRouterApiKeyInput),
        saveGroqApiKey(groqApiKeyInput)
      ]);
      await loadKeyState();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Falha ao salvar as chaves.";
      setError(message);
    } finally {
      setIsSavingKeys(false);
    }
  }

  async function ask(question: string) {
    const trimmed = question.trim();

    if (!trimmed || isLoading) {
      return;
    }

    const nextConversation: ConversationItem[] = [...conversation, { role: "user", content: trimmed }];
    setInput("");
    setError("");
    setConversation(nextConversation);
    setIsLoading(true);

    try {
      const chatService = await createChatService();
      const response = await chatService.chat({
        systemPrompt:
          "Voce e o Dr. Engenheiro, especialista em engenharia civil. Responda com clareza, objetividade e foco pratico.",
        messages: nextConversation.map((item) => ({
          role: item.role,
          content: item.content
        }))
      });

      setConversation((current) => {
        const updated: ConversationItem[] = [
          ...current,
          { role: "assistant", content: `[${response.provider}:${response.model}] ${response.text}` }
        ];

        return updated;
      });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Falha ao consultar os provedores de IA.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <SectionCard title="Configuracao de IA" subtitle="Fallback atual: Gemini, depois OpenRouter, depois Groq.">
        <div style={styles.keyBlock}>
          <label style={styles.label}>Gemini API key</label>
          <input
            type="password"
            value={geminiApiKeyInput}
            onChange={(event) => setGeminiApiKeyInput(event.target.value)}
            placeholder="Cole sua Gemini API key"
            style={styles.input}
          />
          <p style={styles.status}>{hasGeminiKey ? "Gemini configurado neste dispositivo." : "Gemini nao configurado."}</p>
        </div>

        <div style={styles.keyBlock}>
          <label style={styles.label}>OpenRouter API key</label>
          <input
            type="password"
            value={openRouterApiKeyInput}
            onChange={(event) => setOpenRouterApiKeyInput(event.target.value)}
            placeholder="Cole sua OpenRouter API key"
            style={styles.input}
          />
          <p style={styles.status}>
            {hasOpenRouterKey ? "OpenRouter configurado neste dispositivo." : "OpenRouter nao configurado."}
          </p>
        </div>

        <div style={styles.keyBlock}>
          <label style={styles.label}>Groq API key</label>
          <input
            type="password"
            value={groqApiKeyInput}
            onChange={(event) => setGroqApiKeyInput(event.target.value)}
            placeholder="Cole sua Groq API key"
            style={styles.input}
          />
          <p style={styles.status}>{hasGroqKey ? "Groq configurado neste dispositivo." : "Groq nao configurado."}</p>
        </div>

        <div style={styles.actions}>
          <button onClick={handleSaveKeys} style={styles.button} disabled={isSavingKeys}>
            {isSavingKeys ? "Salvando..." : "Salvar chaves"}
          </button>
        </div>
        <p style={styles.help}>
          Nesta fase inicial, as chaves ficam salvas localmente para uso pessoal. Na versao desktop final, a ideia e mover isso para armazenamento mais seguro no Electron.
        </p>
      </SectionCard>

      <SectionCard title="Dr. Engenheiro" subtitle="Especialista em engenharia civil com fallback automatico de provedores">
        <div style={styles.pills}>
          {disciplines.map((discipline) => (
            <Pill key={discipline.id}>{discipline.name}</Pill>
          ))}
        </div>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Pergunte qualquer coisa sobre engenharia civil..."
          style={styles.textarea}
        />
        <div style={styles.actions}>
          <button onClick={() => ask(input)} style={styles.button} disabled={isLoading}>
            {isLoading ? "Consultando IA..." : "Perguntar"}
          </button>
        </div>
        {error ? <p style={styles.error}>{error}</p> : null}
      </SectionCard>

      <SectionCard title="Perguntas sugeridas" subtitle="Baseadas nos prints e no seed inicial do produto">
        <div style={styles.suggestions}>
          {prompts.map((prompt) => (
            <button key={prompt.id} onClick={() => ask(prompt.question)} style={styles.suggestionButton}>
              {prompt.question}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Conversa" subtitle="Historico local da sessao atual">
        <div style={styles.conversation}>
          {conversation.length === 0 ? <p style={styles.empty}>Nenhuma pergunta enviada ainda.</p> : null}
          {conversation.map((item, index) => (
            <div
              key={`${item.role}-${index}`}
              style={{
                ...styles.message,
                ...(item.role === "assistant" ? styles.assistantMessage : styles.userMessage)
              }}
            >
              <strong>{item.role === "assistant" ? "Dr. Engenheiro" : "Voce"}</strong>
              <p style={styles.answer}>{item.content}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}

const styles = {
  pills: {
    marginBottom: "16px"
  },
  keyBlock: {
    marginBottom: "16px"
  },
  label: {
    display: "block",
    marginBottom: "8px",
    fontWeight: 600
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "14px",
    border: "1px solid #cbd5e1",
    boxSizing: "border-box"
  },
  textarea: {
    width: "100%",
    minHeight: "120px",
    padding: "16px",
    borderRadius: "16px",
    border: "1px solid #cbd5e1",
    resize: "vertical",
    fontSize: "15px",
    boxSizing: "border-box"
  },
  actions: {
    marginTop: "12px"
  },
  button: {
    padding: "12px 18px",
    borderRadius: "12px",
    border: "none",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    cursor: "pointer"
  },
  status: {
    margin: "8px 0 0",
    color: "#0f172a"
  },
  help: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.6
  },
  suggestions: {
    display: "grid",
    gap: "12px"
  },
  suggestionButton: {
    textAlign: "left",
    padding: "14px 16px",
    borderRadius: "14px",
    border: "1px solid #dbeafe",
    backgroundColor: "#eff6ff",
    cursor: "pointer"
  },
  conversation: {
    display: "grid",
    gap: "12px"
  },
  message: {
    padding: "14px 16px",
    borderRadius: "16px"
  },
  userMessage: {
    backgroundColor: "#eff6ff"
  },
  assistantMessage: {
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0"
  },
  answer: {
    margin: "8px 0 0",
    lineHeight: 1.7,
    whiteSpace: "pre-wrap"
  },
  empty: {
    margin: 0,
    color: "#64748b"
  },
  error: {
    margin: "12px 0 0",
    color: "#b91c1c"
  }
} as const;