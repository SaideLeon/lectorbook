# Lectorbook

Lectorbook é uma aplicação web para **leitura inteligente de artigos** com apoio de IA. Ela permite importar conteúdo por URL, PDF ou texto bruto, gerar análise inicial automaticamente, conversar com o conteúdo em formato de chat e produzir relatórios de estudo.

## Principais funcionalidades

- **Ingestão de conteúdo multimodal**:
  - URL de artigo
  - Arquivo PDF
  - Texto colado manualmente
- **Biblioteca de artigos** com histórico recente para retomar leituras.
- **Chat com IA** contextualizado no artigo selecionado.
- **Resumo/análise inicial automática** para acelerar entendimento.
- **Geração de relatório do artigo** para revisão e documentação.
- **Integração com GitHub** (OAuth e leitura de repositórios/arquivos) para enriquecer fluxos de análise técnica.
- **Interface responsiva** com suporte a português, inglês e espanhol.

## Stack do projeto

- **Framework:** Next.js (App Router)
- **Linguagem:** TypeScript
- **UI:** React 19, Tailwind CSS, Motion e Lucide Icons
- **IA:** integração com Gemini (`@google/genai`)

## Como rodar localmente

### 1) Pré-requisitos

- Node.js 20+
- npm 10+

### 2) Instalação

```bash
npm install
```

### 3) Configuração de ambiente

Crie um arquivo `.env` com base em `.env.example`:

```bash
cp .env.example .env
```

Variáveis importantes:

- `GEMINI_API_KEY` (obrigatória para recursos de IA)
- `APP_URL` (URL base da aplicação)
- `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET` (opcionais, para OAuth GitHub)

### 4) Executar em desenvolvimento

```bash
npm run dev
```

A aplicação ficará disponível em `http://localhost:3000`.

## Scripts disponíveis

- `npm run dev`: inicia o ambiente de desenvolvimento.
- `npm run build`: gera build de produção e copia saída para `dist`.
- `npm run start`: inicia aplicação em modo produção na porta 3000.
- `npm run clean`: limpa artefatos (`.next` e `dist`).
- `npm run lint`: valida tipos TypeScript (`tsc --noEmit`).

## Estrutura de pastas

- `src/app/page.tsx`: ponto de entrada da interface.
- `src/app/api/**`: rotas de backend (análise de IA, extração de artigo, GitHub, etc.).
- `src/server/**`: serviços compartilhados no servidor (Gemini, GitHub e cache).
- `src/components/**`: componentes de layout, chat, explorador e UI base.
- `src/hooks/**`: gerenciamento de estado e regras de negócio no cliente.
- `src/services/**`: camada de chamadas para APIs do app.

## Visão geral do fluxo

1. O usuário envia um artigo por URL, PDF ou texto.
2. O conteúdo é extraído e estruturado no backend.
3. A IA gera análise inicial e disponibiliza contexto para o chat.
4. O usuário interage com o artigo no painel de leitura e conversa com a IA.
5. Opcionalmente, é gerado um relatório consolidado do artigo.

## Nome do projeto

O projeto foi padronizado para o nome **Lectorbook** em metadados e documentação.
