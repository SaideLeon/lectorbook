# Brada Iota (Next.js)

Aplicação migrada para **Next.js (App Router)**, mantendo o mesmo design da interface.

## Rodar localmente

```bash
npm install
npm run dev
```

A aplicação ficará em `http://localhost:3000`.

## Estrutura

- `src/app/page.tsx`: entrada do frontend.
- `src/app/api/**`: backend via rotas do servidor Next.js.
- `src/server/**`: serviços compartilhados do backend (GitHub, cache, Gemini).
