import clsx from 'clsx'
import type { Profile } from '@/domain/types'
import { displayNameOf } from '@/hooks/useProfile'
import { MediaView } from '../MediaView'

function initialsOf(name: string): string {
  const parts = name.replace(/[@._]/g, ' ').trim().split(/\s+/)
  return ((parts[0]?.[0] ?? 'K') + (parts[1]?.[0] ?? '')).toUpperCase()
}

/** Foto de perfil (uma imagem gerada pela pessoa) ou as iniciais sobre o lima. */
export function Avatar({ profile, className }: { readonly profile: Profile | null; readonly className?: string }) {
  if (profile?.avatar_path) {
    return <MediaView path={profile.avatar_path} kind="image" alt="" className={clsx('shrink-0 rounded-full', className)} />
  }
  return (
    <span
      aria-hidden="true"
      className={clsx('grid shrink-0 place-items-center rounded-full bg-accent font-bold text-accent-ink', className)}
    >
      <span className="text-[0.85em]">{initialsOf(displayNameOf(profile))}</span>
    </span>
  )
}
