# AI Runtime

Camada de infraestrutura para provedores de IA da plataforma.

## Objetivo

Separar o modulo de IA da implementacao do provedor.

## Estrutura

- `AIProvider`: contrato comum
- `GeminiProvider`: adaptador inicial para Gemini
- `ChatService`: ponto unico de uso pelo app

## Resultado

O app fala com `ChatService`. O `ChatService` usa qualquer provedor compativel.