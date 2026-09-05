import {
  ChatService,
  FallbackProvider,
  GeminiProvider,
  GroqProvider,
  OpenRouterProvider
} from "@nexus-core/ai-runtime";
import { createUserSecretStore } from "@nexus-core/desktop-runtime";

const GEMINI_KEY_NAME = "gemini-api-key";
const OPENROUTER_KEY_NAME = "openrouter-api-key";
const GROQ_KEY_NAME = "groq-api-key";
const secretStore = createUserSecretStore();

export async function getGeminiApiKey() {
  const saved = await secretStore.get(GEMINI_KEY_NAME);
  return saved || import.meta.env.VITE_GEMINI_API_KEY || "";
}

export async function saveGeminiApiKey(apiKey: string) {
  const trimmed = apiKey.trim();

  if (!trimmed) {
    await secretStore.remove(GEMINI_KEY_NAME);
    return;
  }

  await secretStore.set(GEMINI_KEY_NAME, trimmed);
}

export async function getOpenRouterApiKey() {
  const saved = await secretStore.get(OPENROUTER_KEY_NAME);
  return saved || import.meta.env.VITE_OPENROUTER_API_KEY || "";
}

export async function saveOpenRouterApiKey(apiKey: string) {
  const trimmed = apiKey.trim();

  if (!trimmed) {
    await secretStore.remove(OPENROUTER_KEY_NAME);
    return;
  }

  await secretStore.set(OPENROUTER_KEY_NAME, trimmed);
}

export async function getGroqApiKey() {
  const saved = await secretStore.get(GROQ_KEY_NAME);
  return saved || import.meta.env.VITE_GROQ_API_KEY || "";
}

export async function saveGroqApiKey(apiKey: string) {
  const trimmed = apiKey.trim();

  if (!trimmed) {
    await secretStore.remove(GROQ_KEY_NAME);
    return;
  }

  await secretStore.set(GROQ_KEY_NAME, trimmed);
}

export async function createChatService() {
  const [geminiApiKey, openRouterApiKey, groqApiKey] = await Promise.all([
    getGeminiApiKey(),
    getOpenRouterApiKey(),
    getGroqApiKey()
  ]);

  return new ChatService(
    new FallbackProvider([
      new GeminiProvider({ apiKey: geminiApiKey }),
      new OpenRouterProvider({
        apiKey: openRouterApiKey,
        model: "openai/gpt-4o",
        siteUrl: "http://localhost",
        siteName: "Nexus Core"
      }),
      new GroqProvider({
        apiKey: groqApiKey,
        model: "llama-3.3-70b-versatile"
      })
    ])
  );
}