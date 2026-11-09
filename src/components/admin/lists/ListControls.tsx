import { Search } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { PAGE_SIZE } from '@/domain/adminLists'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/Field'

/** Busca por e-mail que só consulta ao enviar (Enter ou botão), sem bater no banco a cada letra. */
export function EmailSearch({ onSearch, children }: { readonly onSearch: (email: string) => void; readonly children?: ReactNode }) {
  const [email, setEmail] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    onSearch(email.trim())
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
      <TextField label="E-mail" type="search" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Parte do e-mail" />
      {children}
      <Button type="submit" variant="secondary" className="min-h-11">
        <Search className="size-4" aria-hidden="true" /> Buscar
      </Button>
    </form>
  )
}

/** Página atual, total e anterior/próxima. */
export function Pager({
  page,
  total,
  onPage,
  pageSize = PAGE_SIZE,
}: {
  readonly page: number
  readonly total: number
  readonly onPage: (page: number) => void
  readonly pageSize?: number
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-3 text-sm text-zinc-400">
      <span>
        {total.toLocaleString('pt-BR')} {total === 1 ? 'registro' : 'registros'} · página {page + 1} de {pages}
      </span>
      <span className={pages === 1 ? 'hidden' : 'flex gap-2'}>
        <Button variant="secondary" disabled={page === 0} onClick={() => onPage(page - 1)}>
          Anterior
        </Button>
        <Button variant="secondary" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>
          Próxima
        </Button>
      </span>
    </nav>
  )
}
