# ─── Gemini AI ────────────────────────────────────────────────────────────────
# Obrigatório para chamadas de IA (análise, chat, TTS, embeddings).
# AI Studio injeta automaticamente em runtime a partir dos secrets do utilizador.
GEMINI_API_KEY="MY_GEMINI_API_KEY"

# Modelo de embeddings (opcional): o padrão é gemini-embedding-001.
# Sobrescreva apenas se a tua conta tiver acesso a outro modelo de embedding.
GEMINI_EMBEDDING_MODEL=

# ─── URL da Aplicação ──────────────────────────────────────────────────────────
# URL onde a aplicação está hospedada.
# AI Studio injeta automaticamente com o URL do serviço Cloud Run.
APP_URL="MY_APP_URL"

# ─── GitHub OAuth (Opcional) ──────────────────────────────────────────────────
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Token do GitHub para chamadas server-side (listar repositórios do utilizador).
# Configure APENAS no .env do servidor — nunca exponha no frontend.
GITHUB_TOKEN=

# ─── Groq (Transcrição de áudio + fallback de chat) ───────────────────────────
# Suporta múltiplas chaves separadas por vírgula para rotação automática.
# Ex: GROQ_API_KEY=chave1,chave2,chave3
GROQ_API_KEY=

# ─── Supabase (Vector Store + Histórico persistente) ──────────────────────────
# Opcional — se não configurado, o sistema usa busca semântica em memória
# e histórico de chat apenas no estado React (sessão atual).
#
# Obtenha em: https://supabase.com/dashboard/project/_/settings/api
#
# SUPABASE_URL: URL do projeto (ex: https://xxxx.supabase.co)
SUPABASE_URL=

# SUPABASE_SERVICE_ROLE_KEY: chave de serviço com permissão de escrita.
# NUNCA exponha no frontend — use exclusivamente no servidor.
# Obtenha em: Project Settings → API → service_role
SUPABASE_SERVICE_ROLE_KEY=

# SUPABASE_ANON_KEY: chave publishable/anon (uso no frontend e fallback no backend).
# Obtenha em: Project Settings → API → publishable (anon)
SUPABASE_ANON_KEY=
