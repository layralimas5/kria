import { Copy as CopyIcon, Film, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate } from '@/domain/format'
import { PLATFORM_LABELS, type MultiplierProject } from '@/domain/multiplier'
import { useActiveBrand } from '@/hooks/useActiveBrand'
import { useQuery } from '@/hooks/useQuery'
import { errorMessage } from '@/lib/api'
import { deleteMultiplierProject, fetchMultiplierProjects, saveMultiplierProject } from '@/lib/multiplierApi'

const STEPS = [
  { title: 'Envie os takes', text: 'Vídeos e fotos que você gravou. Ficam no seu aparelho.' },
  { title: 'Gere os roteiros', text: 'A IA escreve variações com outro gancho, outra ordem e outro CTA.' },
  { title: 'Monte em lote', text: 'Cada variação vira um MP4 com texto, transição e trilha. Baixe tudo em ZIP.' },
]

function ProjectCard({ project, onDelete }: { readonly project: MultiplierProject; readonly onDelete: () => void }) {
  return (
    <article className="flex flex-col rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06] transition-colors hover:ring-white/[0.12]">
      <Link to={`/multiplicador/${project.id}`} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <h3 className="font-headline text-xl text-zinc-50">{project.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{project.product_name || 'Produto não informado'}</p>
        <p className="mt-4 text-xs text-zinc-500">
          {project.takes.length} {project.takes.length === 1 ? 'arquivo' : 'arquivos'} · {PLATFORM_LABELS[project.platform]} · {project.aspect} · atualizado em{' '}
          {formatDate(project.updated_at)}
        </p>
      </Link>
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" className="min-h-9 px-2 hover:text-red-300" onClick={onDelete} aria-label={`Apagar ${project.name}`}>
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </article>
  )
}

export function MultiplierPage() {
  const navigate = useNavigate()
  const { activeBrand } = useActiveBrand()
  const projects = useQuery(fetchMultiplierProjects, 'Não deu para carregar seus projetos.')
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<MultiplierProject | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return setError('Dê um nome ao projeto.')
    setBusy(true)
    setError(null)
    try {
      const project = await saveMultiplierProject({
        brand_id: activeBrand?.id ?? null,
        name: name.trim(),
        product_name: '',
        product_description: '',
        audience: activeBrand?.audience ?? '',
        platform: 'instagram',
        objective: 'vendas',
        aspect: '9:16',
        transcript: '',
        takes: [],
        rights_confirmed: false,
      })
      navigate(`/multiplicador/${project.id}`)
    } catch (createError) {
      setError(errorMessage(createError))
      setBusy(false)
    }
  }

  async function remove() {
    if (!deleting) return
    setBusy(true)
    try {
      await deleteMultiplierProject(deleting.id)
      setDeleting(null)
      await projects.reload()
    } catch (deleteError) {
      setError(errorMessage(deleteError))
    } finally {
      setBusy(false)
    }
  }

  const newProjectForm = (
    <form onSubmit={(event) => void create(event)} className="flex w-full flex-col gap-3 sm:flex-row sm:items-end">
      <TextField label="Nome do projeto" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Sérum vitamina C, novembro" className="flex-1" autoFocus />
      <div className="flex gap-2">
        <Button type="submit" loading={busy}>
          Criar projeto
        </Button>
        <Button variant="ghost" onClick={() => setCreating(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  )

  return (
    <div className="mx-auto max-w-6xl space-y-8 pt-4">
      <PageHeader
        title="Multiplicador"
        description="Um vídeo gravado vira várias versões com roteiro e montagem diferentes, prontas para postar."
        action={
          !creating && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden="true" /> Novo projeto
            </Button>
          )
        }
      />

      <ol className="grid gap-3 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="rounded-2xl bg-surface p-4 ring-1 ring-white/[0.06]">
            <span className="text-xs font-bold text-accent-soft">Etapa {index + 1}</span>
            <p className="mt-1 text-sm font-semibold text-zinc-100">{step.title}</p>
            <p className="mt-1 text-sm text-zinc-400">{step.text}</p>
          </li>
        ))}
      </ol>

      {creating && <div className="rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06]">{newProjectForm}</div>}
      {error && <Notice tone="error">{error}</Notice>}
      {projects.error && <Notice tone="error">{projects.error}</Notice>}
      {projects.loading && !projects.data && (
        <p className="flex items-center gap-2 text-sm text-zinc-400" role="status">
          <Spinner className="size-4" /> Carregando projetos
        </p>
      )}

      {projects.data?.length === 0 && !creating && (
        <EmptyState
          icon={<Film className="size-5" aria-hidden="true" />}
          title="Multiplique seu primeiro vídeo"
          description="Crie um projeto, envie o que você gravou e gere as variações. A montagem roda no seu navegador."
          action={
            <Button onClick={() => setCreating(true)}>
              <CopyIcon className="size-4" aria-hidden="true" /> Criar projeto
            </Button>
          }
        />
      )}

      {projects.data && projects.data.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.data.map((project) => (
            <ProjectCard key={project.id} project={project} onDelete={() => setDeleting(project)} />
          ))}
        </div>
      )}

      <ConfirmDialog open={deleting !== null} title="Apagar projeto" confirmLabel="Apagar" busy={busy} onConfirm={() => void remove()} onCancel={() => setDeleting(null)}>
        <p>O projeto "{deleting?.name}" e os roteiros dele saem do Vynkio. Seus arquivos continuam no seu aparelho.</p>
      </ConfirmDialog>
    </div>
  )
}
