# Lectorbook 

Lectorbook é uma aplicação web para **analisar repositórios GitHub com apoio de IA**.
A interface permite carregar a árvore de arquivos de um repositório, visualizar conteúdos de arquivos, conversar com um assistente sobre o código e gerar uma ficha de leitura do conteúdo.

> Stack principal: **Next.js (App Router)** + **React 19** + rotas API no servidor.

## O que o projeto faz

- Analisa repositórios GitHub a partir de URL.
- Exibe árvore de arquivos e visualização de conteúdo.
- Permite chat contextual sobre o repositório carregado, com voz-para-texto, texto-para-voz e conversa ao vivo com contexto do repositório.
- Gera ficha de leitura com base na análise.
- Suporta cache de dados de GitHub no backend para reduzir chamadas repetidas.

## Arquitetura (visão rápida)

- **Frontend**: componentes React em `src/components/**` e composição principal em `src/App.tsx`.
- **Entrada da aplicação**: `src/app/page.tsx`.
- **Backend (Next API Routes)**: `src/app/api/**`.
- **Serviços de servidor**: `src/server/**` (integração GitHub, Gemini, cache e utilidades).
- **Hooks de domínio**: `src/hooks/**` (carregamento de repositório e chat/IA).

## Requisitos

- Node.js 18+
- npm

## Configuração de ambiente

Crie o arquivo `.env` com base no `.env.example`.

Variáveis mais importantes:

- `GEMINI_API_KEY`: chave para chamadas de IA.
- `APP_URL`: URL base da aplicação (usada em callbacks e links internos).
- `GITHUB_TOKEN`: token do GitHub usado **apenas no servidor** para chamadas à API do GitHub.
- `GROQ_API_KEY`: chave da API Groq para transcrição de áudio (fala-para-texto no chat).
- `SUPABASE_URL`: URL do projeto Supabase (persistência de dados).
- `SUPABASE_SERVICE_ROLE_KEY`: chave de serviço do Supabase (uso exclusivo no backend).
- `SUPABASE_ANON_KEY`: chave publishable/anon do Supabase (pode ser usada como fallback quando a service role não estiver definida).

### Importante sobre o token do GitHub

O token do GitHub deve ser configurado **somente no `.env` do servidor**.
O frontend não deve enviar token por `localStorage` ou cabeçalhos customizados.


### Habilitando persistência no Supabase

1. No Supabase Dashboard, abra **SQL Editor**.
2. Execute o conteúdo de `supabase/migration.sql`.
3. Configure `SUPABASE_URL` no `.env` e pelo menos uma chave: `SUPABASE_SERVICE_ROLE_KEY` (recomendado para backend) ou `SUPABASE_ANON_KEY` (fallback).

Sem `SUPABASE_URL` e sem uma das chaves, os endpoints de persistência retornam erro `503` e a app continua em modo sem persistência.

## Rodando localmente

```bash
npm install
npm run dev
```

A aplicação ficará disponível em `http://localhost:3000`.

## Scripts úteis

- `npm run dev` — inicia ambiente de desenvolvimento.
- `npm run build` — gera build de produção.
- `npm run start` — sobe a aplicação em modo produção.
- `npm run lint` — valida tipos com TypeScript (`tsc --noEmit`).

## Fluxo de uso

1. Abra a aplicação.
2. Informe a URL de um repositório GitHub.
3. Aguarde a leitura da árvore de arquivos.
4. Navegue pelos arquivos e faça perguntas no chat.
5. Opcionalmente, gere uma ficha de leitura.
6. Para gamificação do aluno, use os botões **Entrar** ou **Inscrever-se** no topo para persistir progresso no Supabase.

## Estrutura de pastas (resumida)

```text
src/
  app/
    api/                 # Rotas backend (Next.js)
    page.tsx             # Página principal
  components/            # UI (layout, chat, file explorer, etc.)
  hooks/                 # Lógica de estado/integrações no cliente
  server/                # Serviços de backend (GitHub, cache, IA)
  utils/                 # Helpers utilitários
```

## Observações

- A listagem de repositórios do usuário depende de `GITHUB_TOKEN` configurado no servidor.
- Se houver erro de autenticação GitHub, verifique primeiro o `.env` e permissões do token.
ter varias chaves