import { Clapperboard, FolderKanban, ImageIcon, Images, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { ProjectForm } from '@/components/workspace/ProjectForm'
import { planIncludes } from '@/domain/plans'
import { projectInputSchema, type Project, type ProjectInput } from '@/domain/types'
import { contextParams, PROJECT_STATUS_LABELS } from '@/domain/workspace'
import { useAccount } from '@/hooks/useAccount'
import { useEntityEditor } from '@/hooks/useEntityEditor'
import { useGenerations } from '@/hooks/useGenerations'
import { useActiveBrand } from '@/hooks/useActiveBrand'
import { useProjects } from '@/hooks/useWorkspace'
import { deleteProject, errorMessage, saveProject } from '@/lib/api'

const EMPTY_PROJECT: ProjectInput = { name: '', goal: '', brand_id: null, status: 'planning' }

const LINK =
  'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

interface ProjectCardProps {
  readonly project: Project
  readonly brandName: string | null
  readonly creations: number
  readonly onEdit: () => void
  readonly onDelete: () => void
}

function ProjectCard({ project, brandName, creations, onEdit, onDelete }: ProjectCardProps) {
  const query = contextParams({ brandId: project.brand_id, projectId: project.id }).toString()
  return (
    <article className="flex flex-col rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-headline text-xl text-zinc-50">{project.name}</h3>
        <span className="shrink-0 rounded-full bg-surface-3 px-2.5 py-1 text-[11px] font-semibold text-zinc-300">
          {PROJECT_STATUS_LABELS[project.status]}
        </span>
      </div>
      {brandName && <p className="mt-1 text-sm text-accent-soft">{brandName}</p>}
      {project.goal && <p className="mt-3 line-clamp-3 text-sm text-zinc-400">{project.goal}</p>}
      <p className="mt-3 text-xs text-zinc-500">
        {creations} {creations === 1 ? 'criação' : 'criações'}
      </p>
      <div className="mt-auto flex flex-wrap gap-1 pt-4">
        <Link to={`/assistente/roteiro?${query}`} className={LINK}>
          <Clapperboard className="size-3.5" aria-hidden="true" />
          Roteiro
        </Link>
        <Link to={`/estudio?modo=imagem&${query}`} className={LINK}>
          <ImageIcon className="size-3.5" aria-hidden="true" />
          Criar no Studio
        </Link>
        <Link to={`/galeria?projeto=${project.id}`} className={LINK}>
          <Images className="size-3.5" aria-hidden="true" />
          Criações
        </Link>
        <Button variant="ghost" className="min-h-9 px-2.5 text-xs" onClick={onEdit}>
          <Pencil className="size-3.5" aria-hidden="true" />
          Editar
        </Button>
        <Button variant="ghost" className="min-h-9 px-2.5 text-xs" onClick={onDelete} aria-label={`Remover ${project.name}`}>
          <Trash2 className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </article>
  )
}

export function ProjectsPage() {
  const { plan } = useAccount()
  const projects = useProjects()
  const { brands } = useActiveBrand()
  const { generations } = useGenerations()
  const editor = useEntityEditor(projectInputSchema, saveProject, projects.reload)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const brandNames = useMemo(() => new Map((brands.data ?? []).map((brand) => [brand.id, brand.name])), [brands.data])
  const creationsByProject = useMemo(() => {
    const counts = new Map<string, number>()
    generations.forEach((item) => {
      if (item.project_id) counts.set(item.project_id, (counts.get(item.project_id) ?? 0) + 1)
    })
    return counts
  }, [generations])

  if (plan && !planIncludes(plan, 'projects')) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title="Meus projetos" description="Organize roteiros e criações por campanha ou cliente." />
        <Notice>
          Projetos fazem parte do plano Studio.{' '}
          <Link to="/assinatura" className="font-semibold text-accent-soft hover:underline">
            Ver planos
          </Link>
        </Notice>
      </div>
    )
  }

  async function remove(project: Project) {
    if (!window.confirm(`Remover o projeto ${project.name}? As criações ficam na galeria, só perdem o vínculo.`)) return
    try {
      setDeleteError(null)
      await deleteProject(project.id)
      await projects.reload()
    } catch (error) {
      setDeleteError(errorMessage(error))
    }
  }

  const list = projects.data ?? []
  const newButton = (
    <Button onClick={() => editor.open(EMPTY_PROJECT)} disabled={editor.editing !== null}>
      <Plus className="size-4" aria-hidden="true" />
      Novo projeto
    </Button>
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Meus projetos"
        description="Cada campanha num lugar: o roteiro, as cenas e tudo que você gerou para ela."
        action={newButton}
      />
      {projects.error && <Notice tone="error">{projects.error}</Notice>}
      {deleteError && <Notice tone="error">{deleteError}</Notice>}

      {editor.editing && (
        <ProjectForm
          draft={editor.editing.draft}
          isNew={!editor.editing.id}
          brands={brands.data ?? []}
          saving={editor.saving}
          error={editor.error}
          onChange={editor.update}
          onSubmit={() => void editor.submit()}
          onCancel={editor.close}
        />
      )}

      {projects.loading && !projects.data ? (
        <div className="grid place-items-center py-16 text-zinc-500" role="status" aria-label="Carregando">
          <Spinner className="size-6" />
        </div>
      ) : list.length === 0 && !editor.editing ? (
        <EmptyState
          icon={<FolderKanban className="size-5" aria-hidden="true" />}
          title="Nenhum projeto ainda"
          description="Crie um projeto por campanha, lançamento ou cliente. O que você gerar dentro dele fica junto."
          action={newButton}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              brandName={project.brand_id ? (brandNames.get(project.brand_id) ?? null) : null}
              creations={creationsByProject.get(project.id) ?? 0}
              onEdit={() => editor.open({ name: project.name, goal: project.goal, brand_id: project.brand_id, status: project.status }, project.id)}
              onDelete={() => void remove(project)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
