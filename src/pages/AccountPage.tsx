import clsx from 'clsx'
import { ChevronLeft, Clapperboard, ImageIcon, Plus, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EditProfileDialog, type AvatarChoice } from '@/components/account/EditProfileDialog'
import { ProfileCard } from '@/components/account/ProfileCard'
import { WorkSection } from '@/components/account/WorkSection'
import { GenerationCard } from '@/components/GenerationCard'
import { MediaView } from '@/components/MediaView'
import { Notice } from '@/components/ui/Notice'
import { Spinner } from '@/components/ui/Spinner'
import type { Generation, Persona } from '@/domain/types'
import { useBalance } from '@/hooks/useBalance'
import { useModels, usePersonas } from '@/hooks/useCatalog'
import { useGenerations } from '@/hooks/useGenerations'
import { useProfile } from '@/hooks/useProfile'

type Tab = 'all' | 'personas' | 'images' | 'videos'

const TABS: readonly { value: Tab; label: string }[] = [
  { value: 'all', label: 'Tudo' },
  { value: 'personas', label: 'Personas' },
  { value: 'images', label: 'Imagens' },
  { value: 'videos', label: 'Vídeos' },
]

const PREVIEW = 5
const GRID = 'grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5'

function PersonaTile({ persona }: { readonly persona: Persona }) {
  return (
    <Link
      to={`/estudio?modo=imagem&persona=${persona.id}`}
      className="group relative block aspect-[4/5] overflow-hidden rounded-2xl ring-1 ring-white/[0.06] hover:ring-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <MediaView path={persona.image_path} kind="image" alt="" className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.03]" />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-10 font-headline text-lg text-zinc-50">
        {persona.name}
      </span>
    </Link>
  )
}

export function AccountPage() {
  const { profile, error, stats, refreshStats, save } = useProfile()
  const { balance } = useBalance()
  const personas = usePersonas()
  const models = useModels()
  const { generations } = useGenerations()
  const [tab, setTab] = useState<Tab>('all')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    void refreshStats()
  }, [refreshStats])

  const done = useMemo(() => generations.filter((item) => item.status === 'succeeded'), [generations])
  const images = useMemo(() => done.filter((item) => item.kind === 'image'), [done])
  const videos = useMemo(() => done.filter((item) => item.kind === 'video'), [done])
  const personaList = personas.data ?? []
  const modelNames = useMemo(() => new Map((models.data ?? []).map((model) => [model.slug, model.name])), [models.data])

  const avatarChoices: AvatarChoice[] = useMemo(
    () => [
      ...personaList.map((persona) => ({ path: persona.image_path, label: persona.name })),
      ...images.slice(0, 20).map((image) => ({ path: image.output_path ?? '', label: image.prompt })),
    ].filter((choice, index, list) => choice.path && list.findIndex((other) => other.path === choice.path) === index),
    [personaList, images],
  )

  if (error) return <Notice tone="error">{error}</Notice>
  if (!profile) {
    return (
      <div className="grid place-items-center py-24 text-zinc-500" role="status" aria-label="Carregando perfil">
        <Spinner className="size-6" />
      </div>
    )
  }

  const limit = (list: readonly Generation[]) => (tab === 'all' ? list.slice(0, PREVIEW) : list)
  const show = (section: Exclude<Tab, 'all'>) => tab === 'all' || tab === section

  return (
    <div className="mx-auto max-w-[1600px] pb-10">
      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-8">
        <div className="space-y-4">
          <Link to="/estudio" className="inline-flex items-center gap-1 rounded text-sm font-semibold text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <ChevronLeft className="size-4" aria-hidden="true" /> Voltar ao Estúdio
          </Link>
          <ProfileCard profile={profile} stats={stats} balance={balance} onEdit={() => setEditing(true)} />
        </div>

        <div className="min-w-0 space-y-10">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.06]">
            <div role="tablist" aria-label="Seus trabalhos" className="-mb-px flex gap-5 overflow-x-auto scrollbar-none">
              {TABS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                  className={clsx(
                    'whitespace-nowrap border-b-2 pb-3 pt-1 text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    tab === value ? 'border-zinc-100 text-zinc-50' : 'border-transparent text-zinc-500 hover:text-zinc-200',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Link
              to="/estudio"
              className="btn-accent mb-2 inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-[14px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Plus className="size-4" aria-hidden="true" /> Criar
            </Link>
          </div>

          {show('personas') && (
            <WorkSection
              title="Personas"
              count={personaList.length}
              onSeeAll={tab === 'all' ? () => setTab('personas') : undefined}
              empty={{
                icon: UserRound,
                title: 'Pronta para mostrar suas personas?',
                description: 'Crie um influenciador e use o mesmo rosto em todas as fotos e vídeos.',
                actionLabel: 'Criar persona',
                actionTo: '/personas',
              }}
            >
              <div className={GRID}>
                {(tab === 'all' ? personaList.slice(0, PREVIEW) : personaList).map((persona) => (
                  <PersonaTile key={persona.id} persona={persona} />
                ))}
              </div>
            </WorkSection>
          )}

          {show('images') && (
            <WorkSection
              title="Imagens"
              count={images.length}
              onSeeAll={tab === 'all' ? () => setTab('images') : undefined}
              empty={{
                icon: ImageIcon,
                title: 'Mostre sua imaginação',
                description: 'Suas melhores imagens aparecem aqui assim que ficarem prontas.',
                actionLabel: 'Abrir Estúdio',
                actionTo: '/estudio?modo=imagem',
              }}
            >
              <div className={GRID}>
                {limit(images).map((item) => (
                  <GenerationCard key={item.id} generation={item} modelName={modelNames.get(item.model_slug) ?? item.model_slug} />
                ))}
              </div>
            </WorkSection>
          )}

          {show('videos') && (
            <WorkSection
              title="Vídeos"
              count={videos.length}
              onSeeAll={tab === 'all' ? () => setTab('videos') : undefined}
              empty={{
                icon: Clapperboard,
                title: 'Dê vida às suas personas',
                description: 'Transforme uma imagem em vídeo com fala e movimento.',
                actionLabel: 'Criar vídeo',
                actionTo: '/estudio?modo=video',
              }}
            >
              <div className={GRID}>
                {limit(videos).map((item) => (
                  <GenerationCard key={item.id} generation={item} modelName={modelNames.get(item.model_slug) ?? item.model_slug} />
                ))}
              </div>
            </WorkSection>
          )}
        </div>
      </div>

      <EditProfileDialog open={editing} profile={profile} avatarChoices={avatarChoices} onClose={() => setEditing(false)} onSave={save} />
    </div>
  )
}
