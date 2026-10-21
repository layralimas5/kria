import clsx from 'clsx'
import { MapPin, PenLine, Plus } from 'lucide-react'
import type { Profile } from '@/domain/types'
import type { AccountStats } from '@/lib/api'
import { displayNameOf } from '@/hooks/useProfile'
import { LogoMark } from '../Logo'
import { Avatar } from './Avatar'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const joined = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })

const SOCIAL = [
  { key: 'instagram', label: 'Instagram', url: (handle: string) => `https://instagram.com/${handle}` },
  { key: 'tiktok', label: 'TikTok', url: (handle: string) => `https://www.tiktok.com/@${handle}` },
  { key: 'youtube', label: 'YouTube', url: (handle: string) => `https://www.youtube.com/@${handle}` },
] as const

interface ProfileCardProps {
  readonly profile: Profile
  readonly stats: AccountStats | null
  readonly balance: number | null
  readonly onEdit: () => void
}

export function ProfileCard({ profile, stats, balance, onEdit }: ProfileCardProps) {
  const numbers = [
    { label: 'Personas', value: stats?.personas },
    { label: 'Imagens', value: stats?.images },
    { label: 'Vídeos', value: stats?.videos },
    { label: 'Créditos', value: balance ?? undefined },
  ]
  const socials = SOCIAL.filter(({ key }) => profile[key])

  return (
    <div>
      <section
        aria-label="Seu perfil"
        className="relative overflow-hidden rounded-3xl bg-surface p-6 ring-1 ring-white/[0.06]"
      >
        <span className="relative inline-block rounded-full border-2 border-dashed border-white/25 p-1.5">
          <Avatar profile={profile} className="size-24 text-3xl" />
        </span>

        <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-50">{displayNameOf(profile)}</h1>
        <p className="text-[15px] text-zinc-400">@{profile.username}</p>

        <dl className="mt-5 grid grid-cols-4 gap-2">
          {numbers.map(({ label, value }) => (
            <div key={label}>
              <dt className="sr-only">{label}</dt>
              <dd className="text-lg font-bold tabular-nums text-zinc-50">{value ?? '–'}</dd>
              <dd aria-hidden="true" className="text-xs text-zinc-500">
                {label}
              </dd>
            </div>
          ))}
        </dl>

        <button
          type="button"
          onClick={onEdit}
          className={clsx('mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-surface-3 text-[14px] font-bold text-zinc-100 hover:bg-white/10', FOCUS)}
        >
          <PenLine className="size-4" aria-hidden="true" />
          Editar perfil
        </button>

        <button
          type="button"
          onClick={onEdit}
          className={clsx('mt-5 block w-full rounded-xl border border-white/[0.08] p-3 text-left hover:border-white/20', FOCUS)}
        >
          {profile.bio ? (
            <span className="block whitespace-pre-line text-sm text-zinc-300">{profile.bio}</span>
          ) : (
            <>
              <span className="block text-sm font-semibold text-zinc-300">Fale sobre você</span>
              <span className="block text-sm text-zinc-500">Conte sua trajetória e seu estilo de criação</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onEdit}
          className={clsx('mt-4 flex items-center gap-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-100', FOCUS)}
        >
          <MapPin className="size-4" aria-hidden="true" />
          {profile.location || 'Adicionar localização'}
        </button>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {socials.map(({ key, label, url }) => (
            <a
              key={key}
              href={url(profile[key])}
              target="_blank"
              rel="noreferrer"
              className={clsx('inline-flex min-h-8 items-center gap-1 rounded-lg bg-surface-3 px-2.5 text-[13px] font-semibold text-zinc-200 hover:bg-white/10', FOCUS)}
            >
              {label} <span className="text-zinc-500">@{profile[key]}</span>
            </a>
          ))}
          <button
            type="button"
            onClick={onEdit}
            className={clsx('inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 text-[13px] font-semibold text-zinc-400 hover:text-zinc-100', FOCUS)}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {socials.length ? 'Editar redes' : 'Adicionar redes sociais'}
          </button>
        </div>
      </section>

      <p className="mt-4 flex items-center gap-2 px-2 text-sm text-zinc-500">
        <span className="scale-75 opacity-60 grayscale">
          <LogoMark />
        </span>
        No Vynkio desde {joined.format(new Date(profile.created_at))}
      </p>
    </div>
  )
}
