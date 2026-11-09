import { KeyRound, ShieldCheck, UserRound } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PasswordForm } from '@/components/account/PasswordForm'
import { AdminAvatar } from '@/components/admin/ProfileMenu'
import { ADMIN_PERMISSION_LABELS, ADMIN_ROLE_DESCRIPTIONS, ADMIN_ROLE_LABELS } from '@/domain/adminDashboard'
import { useAdminAccess } from '@/hooks/useAdminAccess'

function Card({ id, icon, title, description, children }: { id?: string; icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id ?? title}-title`} className="scroll-mt-24 rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06] sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-accent-soft">{icon}</span>
        <div>
          <h2 id={`${id ?? title}-title`} className="text-lg font-bold text-zinc-50">
            {title}
          </h2>
          <p className="text-sm text-zinc-400">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

/** Conta de quem administra: dados, papel, permissões e troca de senha. */
export function AdminAccountPage() {
  const { me } = useAdminAccess()
  const { hash } = useLocation()
  const name = me.display_name?.trim() || me.email?.split('@')[0] || 'Admin'

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <AdminAvatar name={name} path={me.avatar_path} className="size-14 text-lg" />
        <div className="min-w-0">
          <h1 className="truncate font-headline text-3xl text-zinc-50">{name}</h1>
          <p className="truncate text-sm text-zinc-400">{me.email}</p>
        </div>
      </div>

      <Card icon={<UserRound className="size-5" aria-hidden="true" />} title="Perfil" description="Nome e foto vêm do seu perfil no app.">
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-zinc-500">Nome</dt>
            <dd className="font-semibold text-zinc-100">{name}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">E-mail</dt>
            <dd className="break-all font-semibold text-zinc-100">{me.email ?? '–'}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Papel</dt>
            <dd className="font-semibold text-zinc-100">{ADMIN_ROLE_LABELS[me.role]}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-zinc-400">
          Para trocar nome ou foto, use o{' '}
          <Link to="/conta" className="font-semibold text-accent-soft underline-offset-2 hover:underline">
            perfil no app
          </Link>
          .
        </p>
      </Card>

      <Card icon={<ShieldCheck className="size-5" aria-hidden="true" />} title="Permissões" description={ADMIN_ROLE_DESCRIPTIONS[me.role]}>
        <ul className="grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
          {me.permissions.map((permission) => (
            <li key={permission} className="rounded-xl bg-surface-2 px-3 py-2">
              {ADMIN_PERMISSION_LABELS[permission] ?? permission}
            </li>
          ))}
        </ul>
      </Card>

      <Card
        id="senha"
        icon={<KeyRound className="size-5" aria-hidden="true" />}
        title="Alterar senha"
        description="Vale para o app e para o admin. Sua sessão atual continua aberta; o segundo fator não muda."
      >
        <PasswordForm />
      </Card>
    </div>
  )
}
