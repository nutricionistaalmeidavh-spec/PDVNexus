# Chaves por Usuario

## Como cada usuario conectara sua API key

O fluxo pensado para o Nexus Core e este:

1. o usuario abre a area de configuracao da IA
2. cola a propria `Gemini API key`, `OpenRouter API key` e, se quiser, `Groq API key`
3. o app salva essas chaves localmente naquele dispositivo
4. o modulo de IA tenta `Gemini`, depois `OpenRouter` e por fim `Groq`

## Estado atual em 6 de agosto de 2026

No `Meu Engenheiro`, isso ja foi preparado para uso pessoal.

- a tela do `Dr. Engenheiro` aceita salvar as tres chaves
- a chave e lida dinamicamente antes de criar o `ChatService`
- o armazenamento atual usa persistencia local do navegador como etapa inicial
- o fallback atual e `Gemini -> OpenRouter -> Groq`

## Evolucao recomendada

Quando o app migrar para Electron, o ideal e trocar esse armazenamento por:

- arquivo local protegido do app
- ou cofre seguro do sistema operacional

## Regra pratica

- uso pessoal inicial: armazenamento local no dispositivo do usuario
- versao desktop madura: armazenamento seguro fora do frontend
- versao multiusuario futura: chave por conta, perfil ou tenant