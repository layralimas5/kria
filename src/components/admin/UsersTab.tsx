import clsx from 'clsx'
import { ChevronRight, Eye, Search, SlidersHorizontal, UserPlus, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  activeFilterCount,
  displayName,
  EMPTY_USER_FILTERS,
  SORT_LABELS,
  SUBSCRIPTION_FILTER_LABELS,
  USER_SORTS,
  USERS_PAGE_SIZE,
  type UserFilters,
  type UserRow,
} from '@/domain/adminUsers'
import { formatDate, formatDateTime } from '@/domain/format'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { useQuery } from '@/hooks/useQuery'
import { fetchAdminPlans, fetchUsersPage } from '@/lib/adminApi'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { TextField } from '../ui/Field'
import { Notice } from '../ui/Notice'
import { ScopeSelect } from './dashboard/ScopeFilter'
import { formatBrlValue, formatNumber } from './finance/format'
import { Pager } from './lists/ListControls'
import { AdminAvatar } from './ProfileMenu'
import { CreateUserDrawer } from './users/CreateUserDrawer'
import { UserDrawer } from './users/UserDrawer'

const ANY = 'any'
const orNull = <T extends string>(value: string) => (value === ANY ? null : (value as T))
const TH = 'px-3 py-3 font-bold whitespace-nowrap'

function FilterPanel({ filters, plans, onChange }: { readonly filters: UserFilters; readonly plans: readonly { slug: string; name: string }[]; readonly onChange: (next: UserFilters) => void }) {
  const set = <K extends keyof UserFilters>(key: K, value: UserFilters[K]) => onChange({ ...filters, [key]: value })
  return (
    <div className="grid gap-3 card-premium rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-4">
      <ScopeSelect
        label="Plano"
        value={filters.plan ?? ANY}
        onChange={(value) => set('plan', orNull(value))}
        options={[{ value: ANY, label: 'Todos' }, ...plans.map((plan) => ({ value: plan.slug, label: plan.name }))]}
      />
      <ScopeSelect
        label="Assinatura"
        value={filters.subscription ?? ANY}
        onChange={(value) => set('subscription', orNull(value))}
        options={[{ value: ANY, label: 'Todas' }, ...Object.entries(SUBSCRIPTION_FILTER_LABELS).map(([value, label]) => ({ value, label }))]}
      />
      <ScopeSelect
        label="Conta"
        value={filters.account ?? ANY}
        onChange={(value) => set('account', orNull<'active' | 'suspended'>(value))}
        options={[
          { value: ANY, label: 'Todas' },
          { value: 'active', label: 'Ativas' },
          { value: 'suspended', label: 'Bloqueadas' },
        ]}
      />
      <ScopeSelect
        label="Último acesso"
        value={filters.seen ?? ANY}
        onChange={(value) => set('seen', orNull<'7d' | '30d' | 'idle30'>(value))}
        options={[
          { value: ANY, label: 'Qualquer' },
          { value: '7d', label: 'Últimos 7 dias' },
          { value: '30d', label: 'Últimos 30 dias' },
          { value: 'idle30', label: 'Sumidos há 30+ dias' },
        ]}
      />
      <ScopeSelect
        label="Créditos"
        value={filters.credits ?? ANY}
        onChange={(value) => set('credits', orNull<'with' | 'without'>(value))}
        options={[
          { value: ANY, label: 'Todos' },
          { value: 'with', label: 'Com saldo' },
          { value: 'without', label: 'Sem saldo' },
        ]}
      />
      <ScopeSelect
        label="Origem"
        value={filters.manual === null ? ANY : filters.manual ? 'manual' : 'signup'}
        onChange={(value) => set('manual', value === ANY ? null : value === 'manual')}
        options={[
          { value: ANY, label: 'Todas' },
          { value: 'manual', label: 'Criados no admin' },
          { value: 'signup', label: 'Cadastro próprio' },
        ]}
      />
      <TextField label="Cadastro de" type="date" value={filters.createdFrom} onChange={(event) => set('createdFrom', event.target.value)} />
      <TextField label="Cadastro até" type="date" value={filters.createdTo} onChange={(event) => set('createdTo', event.target.value)} />
    </div>
  )
}

function StatusBadge({ user }: { readonly user: UserRow }) {
  return (
    <span
      className={clsx(
        'inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold',
        user.suspended_at ? 'bg-red-400/10 text-red-300' : 'bg-emerald-400/10 text-emerald-300',
      )}
    >
      {user.suspended_at ? 'Bloqueada' : 'Ativa'}
    </span>
  )
}

function UsersTable({ rows, showCost, onOpen }: { readonly rows: readonly UserRow[]; readonly showCost: boolean; readonly onOpen: (id: string) => void }) {
  return (
    <div className="relative overflow-x-auto card-premium rounded-2xl">
      <table className="w-full min-w-[60rem] text-left text-sm">
        <caption className="sr-only">Usuários</caption>
        <thead className="border-b border-white/[0.06] bg-white/[0.025] text-[11px] uppercase tracking-wider text-zinc-500">
          <tr>
            <th scope="col" className={TH}>Usuário</th>
            <th scope="col" className={TH}>Plano</th>
            <th scope="col" className={clsx(TH, 'text-right')}>Saldo</th>
            <th scope="col" className={clsx(TH, 'text-right')}>Consumidos</th>
            <th scope="col" className={clsx(TH, 'text-right')}>Gerações</th>
            {showCost && <th scope="col" className={clsx(TH, 'text-right')}>Custo IA</th>}
            <th scope="col" className={TH}>Cadastro</th>
            <th scope="col" className={TH}>Último acesso</th>
            <th scope="col" className={TH}>Status</th>
            <th scope="col" className={TH}><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {rows.map((user) => {
            const name = displayName(user)
            return (
              <tr key={user.id} className="transition-colors hover:bg-white/[0.025]">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <AdminAvatar name={name} path={user.avatar_path} className="size-8" />
                    <div className="min-w-0">
                      <p className="max-w-56 truncate font-semibold text-zinc-100">
                        {name}
                        {user.manual && <span className="ml-1.5 rounded bg-white/[0.06] px-1 py-px text-[10px] font-bold uppercase text-zinc-400">admin</span>}
                      </p>
                      <p className="max-w-56 truncate text-xs text-zinc-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-zinc-300">
                  {user.plan_slug}
                  {user.courtesy && <span className="block text-[11px] text-amber-300">cortesia</span>}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-200">{formatNumber(user.balance)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{formatNumber(user.consumed)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{formatNumber(user.generations)}</td>
                {showCost && <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{user.ai_cost_brl === null ? '–' : formatBrlValue(user.ai_cost_brl)}</td>}
                <td className="whitespace-nowrap px-3 py-2.5 text-zinc-400">{formatDate(user.created_at)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-zinc-400">{user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : 'nunca'}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge user={user} />
                </td>
                <td className="px-2 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                  <Link
                    to={`/admin/usuarios/${user.id}/visao`}
                    aria-label={`Ver como ${name} vê o Vynkio`}
                    title="Ver como esta pessoa vê o Vynkio"
                    className="inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-lg bg-accent/10 px-2.5 text-[12px] font-semibold text-accent-soft ring-1 ring-accent/25 transition-colors hover:bg-accent/20 hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <Eye className="size-3.5" aria-hidden="true" />
                    Ver como
                  </Link>
                  <button
                    type="button"
                    onClick={() => onOpen(user.id)}
                    aria-label={`Abrir conta de ${name}`}
                    className="grid size-8 place-items-center rounded-lg text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-2 card-premium rounded-2xl p-4" role="status" aria-label="Carregando usuários">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="h-11 animate-pulse rounded-xl bg-surface-2" />
      ))}
    </div>
  )
}

/** Gestão de usuários: busca, filtros combinados, perfil completo e cadastro por convite. */
export function UsersTab() {
  const { can } = useAdminAccess()
  const [filters, setFilters] = useState<UserFilters>(EMPTY_USER_FILTERS)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [params, setParams] = useSearchParams()
  const creating = params.get('novo') === '1'
  // Conta aberta fica na URL (`?usuario=`): a central de comando abre a ficha direto pelo link.
  const openId = params.get('usuario')
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  const setCreating = (open: boolean) => setParam('novo', open ? '1' : null)
  const setOpenId = (id: string | null) => setParam('usuario', id)

  const plans = useQuery(fetchAdminPlans, 'Não deu para carregar os planos.')
  const livePlans = useMemo(() => (plans.data ?? []).filter((plan) => plan.status === 'live' && plan.active).map((plan) => ({ slug: plan.slug, name: plan.name })), [plans.data])
  const load = useCallback(() => fetchUsersPage(filters, page), [filters, page])
  const users = useQuery(load, 'Não deu para carregar os usuários.')
  const active = activeFilterCount(filters)

  useEffect(() => setPage(0), [filters])

  function search(event: FormEvent) {
    event.preventDefault()
    setFilters((current) => ({ ...current, query }))
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <form onSubmit={search} role="search" className="flex flex-1 gap-2">
          <label htmlFor="admin-user-search" className="sr-only">
            Buscar por nome ou e-mail
          </label>
          <input
            id="admin-user-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome, e-mail ou @"
            className="min-h-10 w-full max-w-md rounded-xl border border-white/[0.08] bg-surface-2 px-3.5 text-[15px] text-zinc-100 placeholder:text-zinc-500 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <Button type="submit" variant="secondary" aria-label="Buscar">
            <Search className="size-4" aria-hidden="true" />
          </Button>
        </form>
        <div className="flex flex-wrap items-end gap-2">
          <ScopeSelect
            label="Ordenar"
            value={filters.sort}
            onChange={(value) => setFilters((current) => ({ ...current, sort: value as UserFilters['sort'] }))}
            options={USER_SORTS.filter((sort) => sort !== 'cost' || can('finance.view')).map((sort) => ({ value: sort, label: SORT_LABELS[sort] }))}
          />
          <Button variant="secondary" aria-expanded={showFilters} aria-controls="user-filters" onClick={() => setShowFilters((value) => !value)}>
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Filtros{active > 0 && ` (${active})`}
          </Button>
          {active > 0 && (
            <Button
              variant="ghost"
              onClick={() => {
                setQuery('')
                setFilters((current) => ({ ...EMPTY_USER_FILTERS, sort: current.sort }))
              }}
            >
              Limpar tudo
            </Button>
          )}
        </div>
      </div>

      <div id="user-filters" hidden={!showFilters}>
        <FilterPanel filters={filters} plans={[{ slug: 'gratis', name: 'Grátis' }, ...livePlans.filter((plan) => plan.slug !== 'gratis')]} onChange={setFilters} />
      </div>

      {users.error && <Notice tone="error">{users.error}</Notice>}
      {!users.data && users.loading && <TableSkeleton />}
      {users.data && users.data.rows.length === 0 && (
        <EmptyState
          icon={<Users className="size-6" aria-hidden="true" />}
          title={active > 0 ? 'Ninguém com esses filtros' : 'Nenhum usuário ainda'}
          description={active > 0 ? 'Afrouxe ou limpe os filtros para ver mais contas.' : 'As contas aparecem aqui assim que alguém se cadastra.'}
        />
      )}
      {users.data && users.data.rows.length > 0 && (
        <div className={clsx('space-y-3 transition-opacity', users.loading && 'opacity-60')}>
          <UsersTable rows={users.data.rows} showCost={can('finance.view')} onOpen={setOpenId} />
          <Pager page={page} total={users.data.total} onPage={setPage} pageSize={USERS_PAGE_SIZE} />
        </div>
      )}

      <UserDrawer key={openId ?? 'none'} userId={openId} plans={livePlans.filter((plan) => plan.slug !== 'gratis')} onClose={() => setOpenId(null)} onChanged={() => void users.reload()} />
      {can('users.manage') && (
        <CreateUserDrawer
          open={creating}
          plans={livePlans}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            void users.reload()
            const next = new URLSearchParams(params)
            next.delete('novo')
            next.set('usuario', id)
            setParams(next, { replace: true })
          }}
        />
      )}
    </div>
  )
}

/** Botão do topo da página: abre o cadastro pela URL (`?novo=1`), sem depender do estado da lista. */
export function AddUserButton() {
  const { can } = useAdminAccess()
  const [params, setParams] = useSearchParams()
  if (!can('users.manage')) return null
  return (
    <Button
      onClick={() => {
        const next = new URLSearchParams(params)
        next.set('novo', '1')
        setParams(next, { replace: true })
      }}
    >
      <UserPlus className="size-4" aria-hidden="true" />
      Adicionar usuário
    </Button>
  )
}
