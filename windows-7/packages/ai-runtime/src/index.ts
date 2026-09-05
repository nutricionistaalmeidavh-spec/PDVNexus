export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIChatRequest {
  systemPrompt?: string;
  messages: AIMessage[];
  temperature?: number;
}

export interface AIChatResponse {
  text: string;
  provider: string;
  model: string;
}

export interface AIProvider {
  readonly name: string;
  chat(request: AIChatRequest): Promise<AIChatResponse>;
}

export interface GeminiProviderOptions {
  apiKey?: string;
  model?: string;
}

export interface OpenRouterProviderOptions {
  apiKey?: string;
  model?: string;
  siteUrl?: string;
  siteName?: string;
}

export interface GroqProviderOptions {
  apiKey?: string;
  model?: string;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

interface OpenRouterChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

interface GroqChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  private readonly apiKey?: string;
  private readonly model: string;

  constructor(options: GeminiProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? "gemini-2.5-pro";
  }

  async chat(request: AIChatRequest): Promise<AIChatResponse> {
    const lastUserMessage = [...request.messages].reverse().find((message) => message.role === "user");

    if (!this.apiKey) {
      throw new Error(
        [
          "Gemini ainda nao esta autenticado.",
          "Configure a Gemini API key para habilitar a chamada real.",
          `Ultima pergunta recebida: ${lastUserMessage?.content ?? "nenhuma"}`
        ].join(" ")
      );
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey
        },
        body: JSON.stringify({
          systemInstruction: request.systemPrompt
            ? {
                parts: [{ text: request.systemPrompt }]
              }
            : undefined,
          contents: request.messages
            .filter((message) => message.role !== "system")
            .map((message) => ({
              role: message.role === "assistant" ? "model" : "user",
              parts: [{ text: message.content }]
            })),
          generationConfig: {
            temperature: request.temperature ?? 0.4
          }
        })
      }
    );

    const data = (await response.json()) as GeminiGenerateContentResponse;

    if (!response.ok) {
      throw new Error(data.error?.message ?? `Falha Gemini (${response.status})`);
    }

    const text =
      data.candidates
        ?.flatMap((candidate) => candidate.content?.parts ?? [])
        .map((part) => part.text ?? "")
        .join("")
        .trim() ?? "";

    if (!text) {
      throw new Error("Gemini retornou uma resposta vazia.");
    }

    return {
      provider: this.name,
      model: this.model,
      text
    };
  }
}

export class OpenRouterProvider implements AIProvider {
  readonly name = "openrouter";
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly siteUrl: string;
  private readonly siteName: string;

  constructor(options: OpenRouterProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? "openai/gpt-4o";
    this.siteUrl = options.siteUrl ?? "http://localhost";
    this.siteName = options.siteName ?? "Nexus Core";
  }

  async chat(request: AIChatRequest): Promise<AIChatResponse> {
    if (!this.apiKey) {
      throw new Error("OpenRouter ainda nao esta autenticado. Configure a OpenRouter API key.");
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "HTTP-Referer": this.siteUrl,
        "X-Title": this.siteName,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          ...(request.systemPrompt
            ? [
                {
                  role: "system",
                  content: request.systemPrompt
                }
              ]
            : []),
          ...request.messages
        ],
        temperature: request.temperature ?? 0.4
      })
    });

    const data = (await response.json()) as OpenRouterChatResponse;

    if (!response.ok) {
      throw new Error(data.error?.message ?? `Falha OpenRouter (${response.status})`);
    }

    const text = data.choices?.[0]?.message?.content?.trim() ?? "";

    if (!text) {
      throw new Error("OpenRouter retornou uma resposta vazia.");
    }

    return {
      provider: this.name,
      model: this.model,
      text
    };
  }
}

export class GroqProvider implements AIProvider {
  readonly name = "groq";
  private readonly apiKey?: string;
  private readonly model: string;

  constructor(options: GroqProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? "llama-3.3-70b-versatile";
  }

  async chat(request: AIChatRequest): Promise<AIChatResponse> {
    if (!this.apiKey) {
      throw new Error("Groq ainda nao esta autenticado. Configure a GROQ API key.");
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          ...(request.systemPrompt
            ? [
                {
                  role: "system",
                  content: request.systemPrompt
                }
              ]
            : []),
          ...request.messages
        ],
        temperature: request.temperature ?? 0.4
      })
    });

    const data = (await response.json()) as GroqChatResponse;

    if (!response.ok) {
      throw new Error(data.error?.message ?? `Falha Groq (${response.status})`);
    }

    const text = data.choices?.[0]?.message?.content?.trim() ?? "";

    if (!text) {
      throw new Error("Groq retornou uma resposta vazia.");
    }

    return {
      provider: this.name,
      model: this.model,
      text
    };
  }
}

export class FallbackProvider implements AIProvider {
  readonly name = "fallback";

  constructor(private readonly providers: AIProvider[]) {}

  async chat(request: AIChatRequest): Promise<AIChatResponse> {
    const errors: string[] = [];

    for (const provider of this.providers) {
      try {
        return await provider.chat(request);
      } catch (error) {
        const message = error instanceof Error ? error.message : `Falha desconhecida em ${provider.name}.`;
        errors.push(`${provider.name}: ${message}`);
      }
    }

    throw new Error(`Nenhum provedor de IA respondeu com sucesso. ${errors.join(" | ")}`);
  }
}

export class ChatService {
  constructor(private readonly provider: AIProvider) {}

  chat(request: AIChatRequest): Promise<AIChatResponse> {
    return this.provider.chat(request);
  }
}