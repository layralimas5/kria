import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Coins, FolderKanban, Lightbulb, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GenerationCard } from '@/components/GenerationCard'
import { GenerationDetails } from '@/components/library/GenerationDetails'
import { MakePersonaDialog } from '@/components/MakePersonaDialog'
import { Composer } from '@/components/studio/Composer'
import { ModelTiles } from '@/components/studio/ModelTiles'
import { Notice } from '@/components/ui/Notice'
import { isOpen, type Generation, type MediaKind } from '@/domain/types'
import { useBalance } from '@/hooks/useBalance'
import { useModels, usePersonas } from '@/hooks/useCatalog'
import { usePlanModels } from '@/hooks/usePlanModels'
import { useGenerations } from '@/hooks/useGenerations'
import { useStudio } from '@/hooks/useStudio'
import { useProjects } from '@/hooks/useWorkspace'

const RECENT_LIMIT = 24
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

/** Pedidos de exemplo para quem chega sem ideia; clicar escreve na caixa. */
const IDEAS: Record<MediaKind, readonly string[]> = {
  image: [
    'Mulher de 28 anos tomando café numa varanda em Lisboa, luz de fim de tarde, foto de celular',
    'Tênis branco sobre pedra molhada, fundo desfocado de cidade à noite, luz neon roxa',
    'Homem de 35 anos gravando story na cozinha, expressão surpresa, estilo vlog',
    'Prato de massa fresca com manjericão em mesa de madeira, luz natural de janela',
  ],
  video: [
    'Ela olha para a câmera, sorri e diz "bom dia, gente!"',
    'A câmera se aproxima devagar enquanto ele ajusta o relógio no pulso',
    'O vapor sobe da xícara e a luz da janela muda suavemente',
  ],
}

const KIND_TITLE: Record<MediaKind, string> = { image: 'imagem', video: 'vídeo' }

function EmptyHero({ kind, onIdea }: { readonly kind: MediaKind; readonly onIdea: (idea: string) => void }) {
  return (
    <section className="flex flex-col items-center px-2 py-12 text-center md:py-16" aria-labelledby="studio-empty">
      <div aria-hidden="true" className="relative mb-10 flex h-28 items-center justify-center">
        <span className="absolute h-24 w-20 -translate-x-20 -rotate-12 rounded-xl border border-white/10 bg-white/[0.02]" />
        <span className="absolute h-28 w-22 rounded-xl border border-accent/50 bg-accent/10 shadow-[0_0_60px_-10px_rgb(124_58_237/0.7)]" />
        <span className="absolute h-24 w-20 translate-x-20 rotate-12 rounded-xl border border-white/10 bg-white/[0.02]" />
      </div>
      <h2 id="studio-empty" className="font-headline text-4xl text-balance text-zinc-50 md:text-6xl">
        Crie. Anime. <span className="bg-gradient-to-r from-accent-soft via-violet-300 to-galaxy bg-clip-text text-transparent">Publique.</span>
      </h2>
      <p className="mt-5 max-w-lg text-pretty text-zinc-400">Escreva o que você quer ver na caixa abaixo, ou comece por uma destas ideias.</p>
      <ul className="mt-8 grid w-full max-w-3xl gap-2 sm:grid-cols-2">
        {IDEAS[kind].map((idea) => (
          <li key={idea}>
            <button
              type="button"
              onClick={() => onIdea(idea)}
              className={clsx('card-premium card-hover flex h-full w-full items-start gap-3 rounded-2xl p-4 text-left text-sm text-zinc-300', FOCUS)}
            >
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent-soft" aria-hidden="true" />
              {idea}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Avisa em qual projeto a próxima criação vai entrar, com saída para gerar solta. */
function ProjectBanner({ projectId, onLeave }: { readonly projectId: string; readonly onLeave: () => void }) {
  const projects = useProjects()
  const name = projects.data?.find((project) => project.id === projectId)?.name
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm text-accent-soft">
      <span className="flex items-center gap-2">
        <FolderKanban className="size-4" aria-hidden="true" />
        {name ? `Criando no projeto ${name}` : 'Criando dentro de um projeto'}
      </span>
      <button type="button" onClick={onLeave} className={clsx('font-semibold text-zinc-300 hover:text-zinc-50', FOCUS)}>
        Criar fora do projeto
      </button>
    </div>
  )
}

function StudioHeader({ kind, running }: { readonly kind: MediaKind; readonly running: number }) {
  const reduceMotion = useReducedMotion()
  const { balance } = useBalance()
  return (
    <motion.header
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="mb-5 flex flex-wrap items-end justify-between gap-4"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Estúdio</p>
        <h1 className="font-headline mt-1.5 text-3xl text-zinc-50 md:text-4xl">
          Nova <span className="bg-gradient-to-r from-accent-soft via-violet-300 to-galaxy bg-clip-text text-transparent">{KIND_TITLE[kind]}</span>
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {running > 0 && (
          <span className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-accent/10 px-3 text-[13px] font-semibold text-accent-soft ring-1 ring-accent/25" role="status">
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {running} em produção
          </span>
        )}
        <Link to="/creditos" className={clsx('card-premium card-hover hidden min-h-9 items-center gap-2 rounded-xl px-3 text-[13px] font-semibold text-zinc-100 md:inline-flex', FOCUS)}>
          <Coins className="size-3.5 text-accent-soft" aria-hidden="true" />
          <span className="tabular-nums">{balance === null ? '...' : balance.toLocaleString('pt-BR')}</span>
          <span className="text-zinc-400">créditos</span>
        </Link>
      </div>
    </motion.header>
  )
}

export function StudioPage() {
  const models = useModels()
  const personas = usePersonas()
  const { generations, error } = useGenerations()
  const planModels = usePlanModels()
  const studio = useStudio(planModels.models ?? [])
  const [personaSource, setPersonaSource] = useState<Generation | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const ownImages = useMemo(() => generations.filter((item) => item.kind === 'image' && item.status === 'succeeded').slice(0, 16), [generations])
  const modelName = useMemo(() => {
    const names = new Map((models.data ?? []).map((model) => [model.slug, model.name]))
    return (slug: string) => names.get(slug) ?? slug
  }, [models.data])
  const running = useMemo(() => generations.filter(isOpen).length, [generations])
  const recent = generations.slice(0, RECENT_LIMIT)
  const selected = generations.find((item) => item.id === selectedId) ?? null

  function writePrompt(text: string) {
    studio.setPrompt(text)
    document.getElementById('prompt')?.focus()
  }

  // Aqui o Estúdio já está aberto: refazer escreve na caixa em vez de navegar para a mesma rota.
  function reuse(generation: Generation) {
    setSelectedId(null)
    studio.setKind(generation.kind)
    if (generation.kind === 'video' && generation.source_generation_id) studio.setSource({ type: 'image', id: generation.source_generation_id })
    else if (generation.kind === 'video' && generation.persona_id) studio.setSource({ type: 'persona', id: generation.persona_id })
    writePrompt(generation.prompt)
  }

  return (
    <div className="mx-auto max-w-[1600px] pb-72">
      <StudioHeader kind={studio.kind} running={running} />
      {models.error && <Notice tone="error">{models.error}</Notice>}
      {/* Cada aba (Imagem, Vídeo) mostra só os modelos dela. */}
      {models.data && <ModelTiles models={studio.modelsOfKind} selected={studio.model?.slug ?? null} onSelect={studio.selectModel} />}

      {studio.projectId && <ProjectBanner projectId={studio.projectId} onLeave={studio.leaveProject} />}

      {error && (
        <div className="mt-6">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {recent.length === 0 ? (
        <EmptyHero kind={studio.kind} onIdea={writePrompt} />
      ) : (
        <section aria-labelledby="recent-title" className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="recent-title" className="font-headline text-lg text-zinc-100">
              Suas criações
            </h2>
            <Link to="/galeria" className={clsx('group inline-flex items-center gap-1 rounded text-sm font-semibold text-zinc-400 hover:text-zinc-100', FOCUS)}>
              Abrir biblioteca
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {recent.map((generation) => (
              <GenerationCard
                key={generation.id}
                generation={generation}
                modelName={modelName(generation.model_slug)}
                onMakePersona={setPersonaSource}
                onOpen={(item) => setSelectedId(item.id)}
              />
            ))}
          </div>
        </section>
      )}

      <Composer studio={studio} personas={personas.data ?? []} images={ownImages} />

      <GenerationDetails
        generation={selected}
        modelName={modelName}
        onClose={() => setSelectedId(null)}
        onReuse={reuse}
        onMakePersona={(generation) => {
          setSelectedId(null)
          setPersonaSource(generation)
        }}
      />
      <MakePersonaDialog
        generation={personaSource}
        onClose={() => setPersonaSource(null)}
        onCreated={(persona) => {
          setPersonaSource(null)
          void personas.reload()
          studio.setSource({ type: 'persona', id: persona.id })
        }}
      />
    </div>
  )
}
