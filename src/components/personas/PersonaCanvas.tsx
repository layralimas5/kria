import clsx from 'clsx'
import { Clapperboard, History, Sparkles, Trash2, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Brand, Generation, Persona } from '@/domain/types'
import { GenerationCard } from '../GenerationCard'
import { MediaView } from '../MediaView'
import { Notice } from '../ui/Notice'
import { GROUP_ICONS } from './traitIcons'

export type CanvasTab = 'personas' | 'history'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
// Colunas pela largura da área, não da tela: o construtor ao lado ocupa boa parte dela.
const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2.5'

interface PersonaCardProps {
  readonly persona: Persona
  readonly brands: readonly Brand[]
  readonly onDelete: (persona: Persona) => void
  readonly onLinkBrand: (persona: Persona, brandId: string | null) => void
}

function PersonaCard({ persona, brands, onDelete, onLinkBrand }: PersonaCardProps) {
  return (
    <article className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-white/[0.06] transition-shadow hover:ring-white/15">
      <MediaView
        path={persona.image_path}
        kind="image"
        alt={`Persona ${persona.name}`}
        className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.03]"
      />
      {brands.length > 0 && (
        <label className="absolute left-2 top-2 max-w-[calc(100%-1rem)]">
          <span className="sr-only">Marca de {persona.name}</span>
          <select
            value={persona.brand_id ?? ''}
            onChange={(event) => onLinkBrand(persona, event.target.value || null)}
            className={clsx('max-w-full truncate rounded-lg bg-black/60 px-2 py-1 text-[11px] font-semibold text-zinc-100 backdrop-blur', FOCUS)}
          >
            <option value="">Sem marca</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-3 pt-16">
        <div>
          <h3 className="font-headline text-xl text-zinc-50">{persona.name}</h3>
          <p className="line-clamp-1 text-xs text-zinc-300">{persona.description}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            to={`/estudio?modo=imagem&persona=${persona.id}`}
            className={clsx('btn-accent inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold', FOCUS)}
          >
            <Sparkles className="size-3.5" aria-hidden="true" /> Criar
          </Link>
          <Link
            to={`/estudio?modo=video&persona=${persona.id}`}
            aria-label={`Animar ${persona.name}`}
            title="Animar em vídeo"
            className={clsx('grid size-9 place-items-center rounded-lg bg-black/55 text-zinc-100 backdrop-blur hover:bg-white/20', FOCUS)}
          >
            <Clapperboard className="size-4" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={() => onDelete(persona)}
            aria-label={`Remover persona ${persona.name}`}
            title="Remover"
            className={clsx('grid size-9 place-items-center rounded-lg bg-black/55 text-zinc-300 backdrop-blur hover:text-red-300', FOCUS)}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  )
}

const SHOWCASE = [
  { label: 'Feminino', icon: GROUP_ICONS.gender, rotate: '-rotate-12', offset: 'translate-y-3' },
  { label: 'Parda', icon: GROUP_ICONS.ethnicity, rotate: '-rotate-6', offset: 'translate-y-1' },
  { label: 'Tranças', icon: GROUP_ICONS.hairstyle, rotate: 'rotate-0', offset: '' },
  { label: 'Sardas', icon: GROUP_ICONS.features, rotate: 'rotate-6', offset: 'translate-y-1' },
  { label: 'Fitness', icon: GROUP_ICONS.niche, rotate: 'rotate-12', offset: 'translate-y-3' },
] as const

/** Estado vazio: as características em leque, como cartas, convidando a montar a primeira. */
function EmptyShowcase() {
  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center overflow-hidden rounded-3xl bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08),transparent_60%)] px-6 py-16 text-center ring-1 ring-white/[0.06] md:py-24">
      <p className="mb-8 text-xs font-semibold text-zinc-500">Suas personas</p>
      <div aria-hidden="true" className="flex -space-x-3">
        {SHOWCASE.map(({ label, icon: Icon, rotate, offset }) => (
          <span
            key={label}
            className={clsx(
              'flex h-24 w-[4.5rem] flex-col items-center justify-end gap-2 rounded-xl bg-surface-3 pb-2.5 shadow-xl shadow-black/50 ring-1 ring-white/10',
              rotate,
              offset,
            )}
          >
            <Icon className="size-6 text-zinc-300" />
            <span className="text-[11px] font-bold text-zinc-200">{label}</span>
          </span>
        ))}
      </div>
      <h2 className="mt-10 text-xl font-bold text-zinc-50 md:text-2xl">Monte uma persona pelas opções ao lado</h2>
      <p className="mt-2 text-sm text-zinc-400">Gere retratos até gostar de um rosto e salve. Suas personas aparecem aqui.</p>
    </div>
  )
}

interface PersonaCanvasProps {
  readonly tab: CanvasTab
  readonly onTabChange: (tab: CanvasTab) => void
  readonly personas: readonly Persona[]
  readonly personasError: string | null
  /** Quantos personagens o plano deixa salvar; nulo enquanto o plano carrega. */
  readonly maxPersonas: number | null
  readonly history: readonly Generation[]
  readonly modelNames: ReadonlyMap<string, string>
  readonly onDelete: (persona: Persona) => void
  readonly brands: readonly Brand[]
  readonly onLinkBrand: (persona: Persona, brandId: string | null) => void
  readonly onMakePersona: (generation: Generation) => void
  readonly className?: string
}

export function PersonaCanvas({
  tab,
  onTabChange,
  personas,
  personasError,
  maxPersonas,
  history,
  modelNames,
  onDelete,
  brands,
  onLinkBrand,
  onMakePersona,
  className,
}: PersonaCanvasProps) {
  const tabs = [
    { value: 'personas', label: 'Personas', icon: UsersRound, count: maxPersonas === null ? `${personas.length}` : `${personas.length}/${maxPersonas}` },
    { value: 'history', label: 'Histórico', icon: History, count: history.length > 0 ? `${history.length}` : '' },
  ] as const

  return (
    <section aria-label="Suas personas e histórico" className={clsx('flex flex-col rounded-3xl bg-surface/60 ring-1 ring-white/[0.05]', className)}>
      <div role="tablist" aria-label="Visualizar" className="flex gap-1 p-3">
        {tabs.map(({ value, label, icon: Icon, count }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => onTabChange(value)}
            className={clsx(
              'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-bold transition-colors',
              FOCUS,
              tab === value ? 'bg-surface-3 text-zinc-50' : 'text-zinc-500 hover:text-zinc-200',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
            {count && <span className="tabular-nums opacity-60">{count}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 scrollbar-none">
        {personasError && <Notice tone="error">{personasError}</Notice>}

        {tab === 'personas' &&
          (personas.length === 0 ? (
            <div className="flex min-h-full items-center py-6">
              <EmptyShowcase />
            </div>
          ) : (
            <div className={GRID}>
              {personas.map((persona) => (
                <PersonaCard key={persona.id} persona={persona} brands={brands} onDelete={onDelete} onLinkBrand={onLinkBrand} />
              ))}
            </div>
          ))}

        {tab === 'history' &&
          (history.length === 0 ? (
            <p className="py-16 text-center text-sm text-zinc-500">Os retratos e vídeos das suas personas aparecem aqui.</p>
          ) : (
            <>
              <p className="mb-3 px-1 text-xs text-zinc-500">Gostou de um rosto? Passe o mouse e toque em “Virar persona”.</p>
              <div className={GRID}>
                {history.map((generation) => (
                  <GenerationCard
                    key={generation.id}
                    generation={generation}
                    modelName={modelNames.get(generation.model_slug) ?? generation.model_slug}
                    onMakePersona={onMakePersona}
                  />
                ))}
              </div>
            </>
          ))}
      </div>
    </section>
  )
}
