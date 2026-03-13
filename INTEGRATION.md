# 🎮 Integração do Sistema de Alunos — LectorBook

## Ficheiros entregues

```
supabase/migration.sql                          ← Executar no Supabase SQL Editor
src/types/student.ts                            ← Tipos + utilitários XP/Nível
src/app/api/student/profile/route.ts            ← GET / POST / PATCH
src/app/api/student/quiz-result/route.ts        ← POST (salvar resultado + XP)
src/app/api/student/ranking/route.ts            ← GET ranking
src/hooks/useStudentProfile.ts                  ← Hook central
src/components/student/LevelBadge.tsx           ← Badge de nível + barra XP
src/components/student/StudentButton.tsx        ← Botão no Header
src/components/student/StudentProfileModal.tsx  ← Modal de cadastro/edição
src/components/student/StudentDashboard.tsx     ← Dashboard lateral (stats + ranking)
src/components/student/LevelUpToast.tsx         ← Notificação de subida de nível
```

---

## Passo 1 — Executar a migration no Supabase

No Supabase Dashboard → SQL Editor, copiar e executar o conteúdo de `supabase/migration.sql`.

---

## Passo 2 — Integrar no Header.tsx

```tsx
// src/components/layout/Header.tsx
import { StudentButton } from '@/components/student/StudentButton';
import { Student } from '@/types/student';

// Adicionar ao interface HeaderProps:
student?: Student | null;
onOpenStudentDashboard?: () => void;
onOpenStudentProfile?: () => void;

// Dentro do JSX, antes do botão de Settings:
<StudentButton
  student={student}
  onOpenDashboard={onOpenStudentDashboard ?? (() => {})}
  onOpenProfile={onOpenStudentProfile ?? (() => {})}
/>
```

---

## Passo 3 — Integrar no App.tsx

```tsx
// src/App.tsx
import { useStudentProfile } from '@/hooks/useStudentProfile';
import { StudentProfileModal } from '@/components/student/StudentProfileModal';
import { StudentDashboard } from '@/components/student/StudentDashboard';
import { LevelUpToast } from '@/components/student/LevelUpToast';
import { AnimatePresence } from 'motion/react';

// Dentro do componente App:
const {
  student,
  isLoading: isStudentLoading,
  isProfileOpen,
  isDashboardOpen,
  ranking,
  levelUpInfo,
  createProfile,
  updateProfile,
  openProfile,
  closeProfile,
  openDashboard,
  closeDashboard,
  loadRanking,
} = useStudentProfile();

// Passar ao Header:
<Header
  // ... props existentes ...
  student={student}
  onOpenStudentDashboard={openDashboard}
  onOpenStudentProfile={openProfile}
/>

// Adicionar antes do </div> final:
<StudentProfileModal
  isOpen={isProfileOpen}
  onClose={closeProfile}
  onSave={student ? updateProfile : createProfile}
  existingStudent={student}
/>

<StudentDashboard
  isOpen={isDashboardOpen}
  onClose={closeDashboard}
  student={student!}
  ranking={ranking}
  onEditProfile={() => { closeDashboard(); openProfile(); }}
  onLoadRanking={loadRanking}
/>

<AnimatePresence>
  {levelUpInfo && (
    <LevelUpToast
      from={levelUpInfo.from as any}
      to={levelUpInfo.to as any}
      xp={levelUpInfo.xp}
      onDismiss={() => {}}
    />
  )}
</AnimatePresence>
```

---

## Passo 4 — Salvar resultado do quiz automaticamente

No `QuizInterface.tsx`, após o quiz terminar (estado `finished`), chamar:

```tsx
// Passar saveQuizResult como prop ao QuizInterface
interface QuizInterfaceProps {
  // ... props existentes ...
  onQuizFinished?: (score: number, total: number, percentage: number) => void;
}

// No useQuiz, quando transitar para 'finished':
// Já existe a lógica em nextQuestion() → setQuizState('finished')
// Basta chamar o callback após:
onQuizFinished?.(score, questions.length, percentage);
```

No `App.tsx`:
```tsx
<QuizInterface
  allFiles={teachingDocs}
  apiKey={currentApiKey}
  onBack={handleBackToChat}
  onQuizFinished={(score, total, pct) => {
    saveQuizResult(score, total, pct, repoUrl?.split('github.com/')[1]);
  }}
/>
```

Onde `saveQuizResult` vem de `useStudentProfile`.

---

## Sistema de XP

| Situação         | XP ganho                          |
|------------------|-----------------------------------|
| Por pergunta     | `(percentagem / 100) * perguntas * 5` |
| Bónus ≥ 90%      | +50 XP extra                      |
| Bónus ≥ 70%      | +20 XP extra                      |

## Tabela de Níveis

| Nível    | XP mínimo | Emoji |
|----------|-----------|-------|
| Bronze   | 0         | 🥉    |
| Prata    | 200       | 🥈    |
| Ouro     | 500       | 🥇    |
| Épico    | 1.000     | 💠    |
| Lendário | 2.000     | 👑    |

---

## Degradação graciosa

Se o Supabase não estiver configurado (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` ausentes):
- Os endpoints retornam `503` silenciosamente
- O hook captura o erro e não exibe nada
- O resto da app funciona normalmente
