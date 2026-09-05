# Meu Engenheiro - Navegacao e IA

## O que foi separado

O app agora tem paginas reais para:

- `Disciplinas`
- `Dr. Engenheiro`
- `Artefatos`

## Como a navegacao funciona

Nesta fase, usamos navegacao por `hash` para evitar dependencias extras enquanto o projeto ainda esta sendo estruturado.

Exemplos:

- `#/disciplinas`
- `#/dr-engenheiro`
- `#/artefatos`

## Camada de IA

A integracao do produto nao fala direto com Gemini. Ela fala com o `ChatService`.

Fluxo:

- tela do app
- `chatService`
- `AIProvider`
- `GeminiProvider`

Isso permite trocar de provedor depois sem reescrever a interface do produto.

## Implementacao atual

A partir de 6 de agosto de 2026, o `GeminiProvider` ja chama a API REST `generateContent` de forma real via `fetch`.

Observacao:

- a documentacao oficial da Google recomenda a `Interactions API` para novos projetos desde junho de 2026
- mesmo assim, `generateContent` continua suportada e foi escolhida aqui por simplicidade inicial