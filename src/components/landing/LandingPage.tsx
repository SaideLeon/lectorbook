'use client';

import { motion } from 'motion/react';
import {
  BookOpen, Github, Brain, Trophy, Star, Zap, ArrowRight,
  CheckCircle2, GitBranch, MessageSquare, FileText,
  BarChart3, Shield, Volume2, Search, Mic,
  ChevronRight, Flame, Globe, Medal, Crown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LectorLogo } from '@/components/layout/LectorLogo';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LandingPageProps {
  onEnterApp: () => void;
}

const EASE_OUT_QUART: [number, number, number, number] = [0.22, 1, 0.36, 1];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: EASE_OUT_QUART },
  }),
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function GlowOrb({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'absolute rounded-full blur-3xl pointer-events-none',
        className,
      )}
    />
  );
}

function StepCard({
  icon: Icon,
  step,
  title,
  description,
  color,
  delay,
}: {
  icon: any;
  step: string;
  title: string;
  description: string;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      variants={fadeUp}
      custom={delay}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      className="group relative bg-white/[0.03] border border-white/8 rounded-2xl p-6 hover:border-indigo-500/30 hover:bg-white/[0.05] transition-all duration-300"
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <p className="font-mono text-[10px] text-indigo-400 font-semibold tracking-[0.15em] uppercase mb-4">
        {step}
      </p>
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center mb-4', color)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <h3 className="text-base font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </motion.div>
  );
}

function FeatureRow({
  icon: Icon,
  title,
  description,
  badge,
}: {
  icon: any;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <div className="flex items-start gap-4 py-5 border-b border-white/5 last:border-0 group">
      <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 group-hover:bg-indigo-500/20 transition-colors">
        <Icon className="w-4 h-4 text-indigo-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-white">{title}</p>
          {badge && (
            <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function LevelPill({
  emoji,
  label,
  xp,
  active,
}: {
  emoji: string;
  label: string;
  xp: string;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl border transition-all',
        active
          ? 'bg-indigo-500/15 border-indigo-500/40 shadow-lg shadow-indigo-500/10'
          : 'bg-white/3 border-white/8',
      )}
    >
      <span className="text-2xl">{emoji}</span>
      <span
        className={cn(
          'text-[10px] font-bold uppercase tracking-wider',
          active ? 'text-indigo-300' : 'text-gray-500',
        )}
      >
        {label}
      </span>
      <span className="font-mono text-[9px] text-gray-600">{xp}</span>
    </div>
  );
}

function MockQuizCard() {
  return (
    <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-[#151515]">
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs font-semibold text-white">Testar Conhecimento</span>
        </div>
        <span className="font-mono text-[10px] text-gray-500">7 / 15</span>
      </div>
      {/* Progress */}
      <div className="h-1 bg-white/5">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
          style={{ width: '46%' }}
        />
      </div>
      {/* Question */}
      <div className="p-4 space-y-3">
        <p className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest">
          aulas/RA1.md
        </p>
        <p className="text-sm font-semibold text-white leading-snug">
          Qual é o principal objetivo das atividades de compra, venda ou troca de bens?
        </p>
        {/* Options */}
        {[
          { text: 'Reduzir a circulação de produtos', state: 'wrong' },
          { text: 'Obter lucro', state: 'correct' },
          { text: 'Aumentar impostos do Estado', state: 'neutral' },
          { text: 'Dificultar a distribuição', state: 'neutral' },
        ].map((opt, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl border text-xs',
              opt.state === 'correct' &&
                'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
              opt.state === 'wrong' && 'bg-red-500/10 border-red-500/30 text-red-300',
              opt.state === 'neutral' && 'bg-white/3 border-white/8 text-gray-500',
            )}
          >
            <span
              className={cn(
                'w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0',
                opt.state === 'correct' && 'bg-emerald-500/20 text-emerald-400',
                opt.state === 'wrong' && 'bg-red-500/20 text-red-400',
                opt.state === 'neutral' && 'bg-white/8 text-gray-600',
              )}
            >
              {['A', 'B', 'C', 'D'][i]}
            </span>
            {opt.text}
            {opt.state === 'correct' && (
              <CheckCircle2 className="w-3.5 h-3.5 ml-auto shrink-0 text-emerald-400" />
            )}
          </div>
        ))}
        {/* XP badge */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <span className="text-[10px] text-gray-600">Resposta correcta!</span>
          <span className="text-[10px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 px-2 py-1 rounded-full">
            +25 XP
          </span>
        </div>
      </div>
    </div>
  );
}

function MockProfileCard() {
  return (
    <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
      {/* Avatar header */}
      <div className="relative h-20 bg-gradient-to-br from-indigo-600/30 to-violet-600/20">
        <div className="absolute bottom-0 translate-y-1/2 left-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xl border-2 border-[#111] shadow-lg">
            🧑
          </div>
        </div>
      </div>
      <div className="pt-9 px-4 pb-4 space-y-3">
        <div>
          <p className="text-sm font-bold text-white">Saíde Omar Saíde</p>
          <div className="flex gap-1.5 mt-1 flex-wrap">
            <span className="text-[9px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-semibold">
              #1 global
            </span>
            <span className="text-[9px] bg-white/5 text-gray-500 border border-white/8 px-2 py-0.5 rounded-full">
              Turma B
            </span>
          </div>
        </div>
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Trophy, val: '3', lbl: 'Testes', color: 'bg-indigo-600' },
            { icon: BarChart3, val: '64%', lbl: 'Média', color: 'bg-emerald-600' },
            { icon: Flame, val: '210', lbl: 'XP', color: 'bg-rose-600' },
          ].map(({ icon: Icon, val, lbl, color }) => (
            <div
              key={lbl}
              className="bg-white/3 border border-white/8 rounded-xl p-2.5 text-center"
            >
              <div
                className={cn(
                  'w-6 h-6 rounded-lg flex items-center justify-center mx-auto mb-1',
                  color,
                )}
              >
                <Icon className="w-3 h-3 text-white" />
              </div>
              <p className="text-sm font-bold text-white">{val}</p>
              <p className="text-[9px] text-gray-600 uppercase tracking-wider">{lbl}</p>
            </div>
          ))}
        </div>
        {/* XP bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-500">🥈 Prata · 210 XP</span>
            <span className="text-yellow-500">🥇 Ouro →</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-slate-400 to-slate-200 rounded-full"
              style={{ width: '3%' }}
            />
          </div>
          <p className="text-[9px] text-gray-600">Faltam 290 XP</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LandingPage({ onEnterApp }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-[#080810] text-gray-100 overflow-x-hidden selection:bg-indigo-500/30">

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 h-16 bg-[#080810]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <LectorLogo className="w-7 h-7" />
          <span className="font-bold text-base tracking-tight text-white">LectorBook</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {['Como funciona', 'Funcionalidades', 'Gamificação'].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/ /g, '-')}`}
              className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 hover:text-white transition-colors"
            >
              {item}
            </a>
          ))}
        </div>
        <button
          onClick={onEnterApp}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all hover:shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-0.5"
        >
          Começar grátis
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </nav>

      {/* ── HERO ── */}
      <section className="relative flex flex-col items-center justify-center min-h-screen text-center px-6 pt-20 pb-16 overflow-hidden">
        {/* Background orbs */}
        <GlowOrb className="w-[700px] h-[400px] bg-indigo-600/15 top-[-10%] left-1/2 -translate-x-1/2" />
        <GlowOrb className="w-[400px] h-[300px] bg-violet-600/10 bottom-[10%] right-[-5%]" />
        {/* Grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />

        {/* Badge */}
        <motion.div
          variants={fadeUp}
          custom={0}
          initial="hidden"
          animate="show"
          className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/25 rounded-full px-4 py-1.5 mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-indigo-300 tracking-wide uppercase">
            Tutor de Leitura com IA · GitHub Integrado
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          variants={fadeUp}
          custom={1}
          initial="hidden"
          animate="show"
          className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.95] mb-6"
        >
          Estude mais.
          <br />
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
            Aprenda melhor.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={fadeUp}
          custom={2}
          initial="hidden"
          animate="show"
          className="max-w-xl text-base md:text-lg text-gray-500 leading-relaxed mb-10"
        >
          Transforme qualquer repositório GitHub em uma experiência de
          aprendizagem completa — com fichas de leitura, quizzes gerados por IA
          e ranking entre colegas.
        </motion.p>

        {/* CTAs */}
        <motion.div
          variants={fadeUp}
          custom={3}
          initial="hidden"
          animate="show"
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <button
            onClick={onEnterApp}
            className="group flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3.5 rounded-xl font-bold text-sm transition-all hover:shadow-2xl hover:shadow-indigo-500/30 hover:-translate-y-0.5"
          >
            <Zap className="w-4 h-4" />
            Começar agora
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <a
            href="https://aistudio.google.com/api-keys"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/20 text-gray-300 px-6 py-3.5 rounded-xl font-bold text-sm transition-all"
          >
            <Star className="w-4 h-4 text-yellow-500" />
            Obter API Key grátis
          </a>
        </motion.div>

        {/* Mock cards floating */}
        <motion.div
          variants={fadeUp}
          custom={4}
          initial="hidden"
          animate="show"
          className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-5 max-w-xl w-full"
        >
          <MockQuizCard />
          <MockProfileCard />
        </motion.div>
      </section>

      {/* ── STATS BAR ── */}
      <div className="border-y border-white/[0.06] bg-white/[0.02]">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-12 py-10 px-6">
          {[
            { icon: Github, val: '∞', lbl: 'Repositórios suportados' },
            { icon: Brain, val: 'IA', lbl: 'Quizzes automáticos' },
            { icon: Medal, val: '5', lbl: 'Níveis de progressão' },
            { icon: Globe, val: '100%', lbl: 'Gratuito para estudantes' },
          ].map(({ icon: Icon, val, lbl }, i) => (
            <motion.div
              key={lbl}
              variants={fadeUp}
              custom={i}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="flex flex-col items-center gap-1"
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-indigo-400" />
                <span className="text-3xl font-black bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                  {val}
                </span>
              </div>
              <span className="text-[11px] text-gray-600 uppercase tracking-widest font-semibold">
                {lbl}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <section id="como-funciona" className="max-w-5xl mx-auto px-6 py-28">
        <motion.div
          variants={fadeUp}
          custom={0}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mb-16"
        >
          <p className="text-xs font-bold tracking-[0.15em] uppercase text-indigo-400 mb-3">
            Como funciona
          </p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight mb-4">
            Três passos para
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              dominar o conteúdo
            </span>
          </h2>
          <p className="text-gray-500 max-w-md leading-relaxed">
            Do repositório ao conhecimento consolidado — em minutos. A IA faz o
            trabalho pesado, você foca em aprender.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StepCard
            icon={Github}
            step="01 — Conectar"
            title="Cole o link do repositório"
            description="Qualquer repositório público do GitHub. O LectorBook extrai automaticamente os arquivos e o conteúdo relevante."
            color="bg-indigo-600/80"
            delay={0}
          />
          <StepCard
            icon={FileText}
            step="02 — Ler"
            title="Leia com fichas inteligentes"
            description="A IA gera fichas de leitura estruturadas dos documentos, tornando conteúdos técnicos fáceis de absorver."
            color="bg-cyan-600/80"
            delay={1}
          />
          <StepCard
            icon={Brain}
            step="03 — Testar"
            title="Teste seu conhecimento"
            description="Quizzes gerados com IA a partir do repositório. Cada resposta certa ganha XP e avança seu nível."
            color="bg-violet-600/80"
            delay={2}
          />
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section
        id="funcionalidades"
        className="border-y border-white/[0.06] bg-white/[0.02]"
      >
        <div className="max-w-5xl mx-auto px-6 py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div>
              <motion.div
                variants={fadeUp}
                custom={0}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
              >
                <p className="text-xs font-bold tracking-[0.15em] uppercase text-indigo-400 mb-3">
                  Funcionalidades
                </p>
                <h2 className="text-4xl font-black tracking-tight leading-tight mb-4">
                  Tudo que você
                  <br />
                  <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                    precisa para estudar
                  </span>
                </h2>
                <p className="text-gray-500 leading-relaxed mb-10">
                  Uma plataforma completa que combina GitHub, IA e gamificação
                  para criar a melhor experiência de estudo.
                </p>
              </motion.div>

              <motion.div
                variants={fadeUp}
                custom={1}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="bg-[#0e0e1a] border border-white/8 rounded-2xl divide-y divide-white/5 overflow-hidden"
              >
                <FeatureRow
                  icon={FileText}
                  title="Fichas de Leitura com IA"
                  description="Conteúdo transformado em fichas didáticas claras. Baixe em PDF."
                  badge="Popular"
                />
                <FeatureRow
                  icon={Brain}
                  title="Quizzes Automáticos"
                  description="Questões de múltipla escolha geradas direto do conteúdo do repo."
                />
                <FeatureRow
                  icon={MessageSquare}
                  title="Chat com Tutor Lector"
                  description="Tutor IA especializado em contabilidade, direito e economia."
                />
                <FeatureRow
                  icon={Search}
                  title="Busca Semântica RAG"
                  description="Respostas contextualizadas com LangChain + pgvector no Supabase."
                  badge="Novo"
                />
                <FeatureRow
                  icon={GitBranch}
                  title="Explorador de Arquivos"
                  description="Navegação completa pelo repositório com renderização Markdown."
                />
                <FeatureRow
                  icon={Volume2}
                  title="Áudio com Gemini TTS"
                  description="Ouça as respostas do tutor. Grave suas perguntas por voz."
                />
                <FeatureRow
                  icon={Mic}
                  title="Transcrição via Groq"
                  description="Ditado por voz para o chat usando Whisper Large V3 Turbo."
                />
                <FeatureRow
                  icon={Trophy}
                  title="Ranking & Gamificação"
                  description="Compare seu desempenho com colegas em rankings globais e por repo."
                />
              </motion.div>
            </div>

            {/* Right: mock file viewer */}
            <motion.div
              variants={fadeUp}
              custom={2}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="sticky top-24"
            >
              <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 bg-[#151515]">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/60" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                    <div className="w-3 h-3 rounded-full bg-green-500/60" />
                  </div>
                  <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1 text-xs text-gray-400">
                    <FileText className="w-3 h-3 text-indigo-400" />
                    aulas/RA1.md
                  </div>
                </div>
                {/* Content preview */}
                <div className="p-5 space-y-4 text-sm">
                  <div>
                    <p className="text-lg font-black text-white mb-2">
                      1. Conceito de Comércio
                    </p>
                    <p className="text-gray-400 leading-relaxed text-xs">
                      O <strong className="text-white">comércio</strong> é o
                      conjunto de atividades relacionadas com a{' '}
                      <strong className="text-white">
                        compra, venda ou troca de bens e serviços
                      </strong>
                      , com o objetivo de{' '}
                      <strong className="text-white">obter lucro</strong>.
                    </p>
                  </div>
                  <div className="h-px bg-white/5" />
                  <div>
                    <p className="text-base font-black text-white mb-2">
                      2. Importância do Comércio na Economia
                    </p>
                    <div className="space-y-1.5">
                      {[
                        'Permite a circulação de produtos entre produtores',
                        'Cria empregos e gera renda para trabalhadores',
                        'Gera receitas para o Estado através de impostos',
                        'Satisfaz as necessidades dos consumidores',
                      ].map((item) => (
                        <div
                          key={item}
                          className="flex items-center gap-2 text-xs text-gray-400"
                        >
                          <CheckCircle2 className="w-3 h-3 text-indigo-400 shrink-0" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Bottom tab bar */}
                <div className="flex border-t border-white/8 bg-[#151515]">
                  {[
                    { icon: MessageSquare, label: 'Chat', active: false },
                    { icon: BookOpen, label: 'Testar', active: false },
                    { icon: FileText, label: 'Preview', active: true },
                  ].map(({ icon: Icon, label, active }) => (
                    <div
                      key={label}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold',
                        active ? 'text-indigo-400' : 'text-gray-600',
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── GAMIFICATION ── */}
      <section id="gamificação" className="max-w-5xl mx-auto px-6 py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            variants={fadeUp}
            custom={0}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            <p className="text-xs font-bold tracking-[0.15em] uppercase text-indigo-400 mb-3">
              Gamificação
            </p>
            <h2 className="text-4xl font-black tracking-tight leading-tight mb-4">
              Aprenda como
              <br />
              <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                se fosse um jogo
              </span>
            </h2>
            <p className="text-gray-500 leading-relaxed mb-10">
              Cada quiz completo rende XP. Acumule pontos, suba de nível e
              dispute o topo do ranking da sua turma.
            </p>

            {/* Level pills */}
            <div className="flex gap-2 flex-wrap">
              <LevelPill emoji="🥉" label="Bronze" xp="0 XP" />
              <LevelPill emoji="🥈" label="Prata" xp="200 XP" active />
              <LevelPill emoji="🥇" label="Ouro" xp="500 XP" />
              <LevelPill emoji="💠" label="Épico" xp="1000 XP" />
              <LevelPill emoji="👑" label="Lendário" xp="2000 XP" />
            </div>

            {/* XP formula */}
            <div className="mt-8 bg-white/3 border border-white/8 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Fórmula de XP
              </p>
              {[
                { pct: '≥ 90%', xp: 'Base + 50 XP bônus', color: 'text-emerald-400' },
                { pct: '≥ 70%', xp: 'Base + 20 XP bônus', color: 'text-blue-400' },
                { pct: '< 70%', xp: 'Base apenas', color: 'text-amber-400' },
              ].map(({ pct, xp, color }) => (
                <div key={pct} className="flex items-center justify-between text-xs">
                  <span className={cn('font-mono font-bold', color)}>{pct}</span>
                  <span className="text-gray-500">{xp}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Ranking card */}
          <motion.div
            variants={fadeUp}
            custom={1}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="space-y-4"
          >
            <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-[#151515]">
                <div className="flex items-center gap-2">
                  <Crown className="w-3.5 h-3.5 text-yellow-500" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Ranking — Turma B
                  </span>
                </div>
                <span className="text-[10px] text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">
                  Global
                </span>
              </div>
              <div className="p-3 space-y-2">
                {[
                  { pos: '🥇', name: 'Saíde Omar Saíde', xp: '210 XP', level: '🥈 Prata', you: true, avg: '64%' },
                  { pos: '🥈', name: 'Maria F.', xp: '185 XP', level: '🥈 Prata', you: false, avg: '58%' },
                  { pos: '🥉', name: 'João M.', xp: '140 XP', level: '🥉 Bronze', you: false, avg: '47%' },
                ].map(({ pos, name, xp, level, you, avg }) => (
                  <div
                    key={name}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl border text-xs transition-all',
                      you
                        ? 'bg-indigo-500/10 border-indigo-500/25'
                        : 'bg-white/2 border-white/5',
                    )}
                  >
                    <span className="text-base w-6 text-center">{pos}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'font-semibold',
                            you ? 'text-indigo-300' : 'text-gray-300',
                          )}
                        >
                          {name}
                        </span>
                        {you && (
                          <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full">
                            Você
                          </span>
                        )}
                      </div>
                      <span className="text-gray-600">{avg} média</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-300">{level}</p>
                      <p className="text-gray-600 font-mono">{xp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* History snippet */}
            <div className="bg-[#111] border border-white/10 rounded-2xl p-4 space-y-2.5">
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                Histórico recente
              </p>
              {[
                { pct: 100, label: 'IDEACSPISR', time: 'há 24h', xp: '+125 XP', color: 'text-emerald-400' },
                { pct: 73, label: 'PMOPPOSL', time: 'há 23h', xp: '+75 XP', color: 'text-blue-400' },
                { pct: 20, label: 'IDEACSPISR', time: 'há 20h', xp: '+10 XP', color: 'text-red-400' },
              ].map(({ pct, label, time, xp, color }) => (
                <div
                  key={`${label}-${time}`}
                  className="flex items-center gap-3 text-xs"
                >
                  <span className={cn('text-base font-black w-12 text-right', color)}>
                    {pct}%
                  </span>
                  <div className="flex-1">
                    <span className="text-gray-400 font-semibold">{label}</span>
                    <span className="text-gray-700 ml-2">· {time}</span>
                  </div>
                  <span className="text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full font-semibold">
                    {xp}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative border-t border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <GlowOrb className="w-[600px] h-[300px] bg-indigo-600/15 left-1/2 -translate-x-1/2 top-0" />
        <div className="relative max-w-2xl mx-auto text-center px-6 py-28">
          <motion.div
            variants={fadeUp}
            custom={0}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            <h2 className="text-5xl md:text-6xl font-black tracking-tight leading-tight mb-4">
              Pronto para
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
                estudar melhor?
              </span>
            </h2>
            <p className="text-gray-500 mb-10 leading-relaxed">
              Cole um link de repositório e comece agora. Sem cadastro obrigatório, sem complicação.
            </p>
            <button
              onClick={onEnterApp}
              className="group inline-flex items-center gap-2.5 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl font-bold text-base transition-all hover:shadow-2xl hover:shadow-indigo-500/30 hover:-translate-y-0.5"
            >
              <Zap className="w-5 h-5" />
              Abrir o LectorBook
              <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <p className="mt-5 text-xs text-gray-700">
              Gratuito · Powered by Google Gemini & Groq · Open source
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.06] px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <LectorLogo className="w-6 h-6" />
            <span className="font-bold text-sm text-white">LectorBook</span>
          </div>
          <div className="flex gap-6">
            {[
              { label: 'Políticas de Uso', href: '/politicas' },
              { label: 'AI Studio', href: 'https://aistudio.google.com/api-keys' },
              { label: 'GitHub', href: '#' },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                target={href.startsWith('http') ? '_blank' : undefined}
                rel={href.startsWith('http') ? 'noreferrer' : undefined}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                {label}
              </a>
            ))}
          </div>
          <p className="text-xs text-gray-700">© 2026 LectorBook — Quelimane, Moçambique</p>
        </div>
      </footer>
    </div>
  );
}
