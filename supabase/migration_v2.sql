-- ============================================================
-- LectorBook — Migration v2
-- Execute no SQL Editor do Supabase (após migration.sql)
-- ============================================================

-- ─── 1. Respostas individuais de cada quiz ───────────────────
create table if not exists public.quiz_answers (
  id              uuid primary key default gen_random_uuid(),
  quiz_result_id  uuid not null references public.quiz_results(id) on delete cascade,
  question_index  integer not null,
  question_text   text    not null,
  options         jsonb   not null,   -- string[]
  correct_index   integer not null,
  selected_index  integer,            -- null = não respondida
  is_correct      boolean not null,
  explanation     text,
  source          text,
  created_at      timestamptz not null default now()
);

create index if not exists quiz_answers_result_idx
  on public.quiz_answers (quiz_result_id);

-- ─── 2. Ranking por repositório ─────────────────────────────
create or replace view public.repo_ranking as
select
  s.id,
  s.name,
  s.class,
  s.gender,
  s.level,
  qr.repo_full_name,
  count(qr.id)                             as quizzes_count,
  round(avg(qr.percentage)::numeric, 2)    as avg_percentage,
  sum(qr.xp_earned)                        as xp_in_repo,
  max(qr.percentage)                       as best_score,
  rank() over (
    partition by qr.repo_full_name
    order by
      avg(qr.percentage)  desc,
      sum(qr.xp_earned)   desc,
      count(qr.id)        desc,
      s.created_at        asc
  )                                        as rank_position
from public.students s
join public.quiz_results qr on qr.student_id = s.id
where qr.repo_full_name is not null
group by s.id, s.name, s.class, s.gender, s.level, qr.repo_full_name;

-- ─── 3. Ranking geral com média de posições por repo ────────
--  Para cada aluno: calcula a posição média em todos os repos
--  em que participou — quem joga mais fica em evidência.
create or replace view public.student_ranking as
with repo_positions as (
  select
    id,
    name,
    class,
    gender,
    level,
    avg(rank_position) as avg_repo_position,
    count(distinct repo_full_name) as repos_count
  from public.repo_ranking
  group by id, name, class, gender, level
),
all_students as (
  select
    s.id,
    s.name,
    s.class,
    s.gender,
    s.level,
    s.total_xp,
    s.quizzes_completed,
    s.avg_percentage,
    s.last_study_at,
    coalesce(rp.avg_repo_position, 9999) as avg_repo_position,
    coalesce(rp.repos_count, 0)          as repos_count
  from public.students s
  left join repo_positions rp on rp.id = s.id
)
select
  id,
  name,
  class,
  gender,
  level,
  total_xp,
  quizzes_completed,
  avg_percentage,
  last_study_at,
  repos_count,
  round(avg_repo_position::numeric, 2) as avg_repo_position,
  rank() over (
    order by
      total_xp        desc,
      avg_percentage  desc,
      quizzes_completed desc
  ) as rank_position
from all_students;
