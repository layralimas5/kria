import clsx from 'clsx'
import { Check, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { profileUpdateSchema, type Profile, type ProfileUpdate } from '@/domain/types'
import { errorMessage } from '@/lib/api'
import { MediaView } from '../MediaView'
import { Button } from '../ui/Button'
import { TextArea, TextField } from '../ui/Field'
import { Notice } from '../ui/Notice'

export interface AvatarChoice {
  readonly path: string
  readonly label: string
}

interface EditProfileDialogProps {
  readonly open: boolean
  readonly profile: Profile
  readonly avatarChoices: readonly AvatarChoice[]
  readonly onClose: () => void
  readonly onSave: (update: ProfileUpdate) => Promise<unknown>
}

type FieldErrors = Partial<Record<keyof ProfileUpdate, string>>

function initialForm(profile: Profile): ProfileUpdate {
  return {
    display_name: profile.display_name ?? '',
    username: profile.username,
    bio: profile.bio,
    location: profile.location,
    instagram: profile.instagram,
    tiktok: profile.tiktok,
    youtube: profile.youtube,
    avatar_path: profile.avatar_path,
  }
}

interface AvatarPickerProps {
  readonly value: string | null
  readonly choices: readonly AvatarChoice[]
  readonly onChange: (path: string | null) => void
}

/** A foto de perfil sai das personas e imagens da própria pessoa: sem upload. */
function AvatarPicker({ value, choices, onChange }: AvatarPickerProps) {
  return (
    <fieldset>
      <legend className="mb-1 text-[13px] font-semibold text-zinc-300">Foto de perfil</legend>
      <p className="mb-2 text-xs text-zinc-500">Escolha uma das suas personas ou imagens.</p>
      <div role="radiogroup" aria-label="Foto de perfil" className="flex gap-2 overflow-x-auto p-1 scrollbar-none">
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          aria-label="Sem foto"
          title="Sem foto"
          onClick={() => onChange(null)}
          className={clsx(
            'grid size-14 shrink-0 place-items-center rounded-full bg-surface-3 text-zinc-400 ring-2 focus-visible:outline-none focus-visible:ring-accent',
            value === null ? 'ring-accent' : 'ring-transparent',
          )}
        >
          <X className="size-4" aria-hidden="true" />
        </button>
        {choices.map((choice) => {
          const selected = choice.path === value
          return (
            <button
              key={choice.path}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={choice.label}
              title={choice.label}
              onClick={() => onChange(choice.path)}
              className={clsx(
                'relative shrink-0 rounded-full ring-2 focus-visible:outline-none focus-visible:ring-accent',
                selected ? 'ring-accent' : 'ring-transparent hover:ring-white/30',
              )}
            >
              <MediaView path={choice.path} kind="image" alt="" className="size-14 rounded-full" />
              {selected && (
                <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-accent text-accent-ink">
                  <Check className="size-3" aria-hidden="true" />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export function EditProfileDialog({ open, profile, avatarChoices, onClose, onSave }: EditProfileDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [form, setForm] = useState<ProfileUpdate>(() => initialForm(profile))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setForm(initialForm(profile))
      setErrors({})
      setError(null)
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open, profile])

  const set = <K extends keyof ProfileUpdate>(key: K, value: ProfileUpdate[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = profileUpdateSchema.safeParse(form)
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ProfileUpdate
        fieldErrors[key] ??= issue.message
      }
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    setSaving(true)
    setError(null)
    try {
      await onSave(parsed.data)
      onClose()
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  const socialField = (key: 'instagram' | 'tiktok' | 'youtube', label: string, placeholder: string) => (
    <TextField
      label={label}
      value={form[key]}
      onChange={(event) => set(key, event.target.value)}
      placeholder={placeholder}
      hint={errors[key]}
      aria-invalid={errors[key] ? true : undefined}
    />
  )

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="edit-profile-title"
      className="m-auto max-h-[92dvh] w-[min(94vw,32rem)] overflow-y-auto rounded-3xl border border-white/[0.08] bg-surface-2 p-0 text-zinc-100 shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5 p-5 sm:p-6">
        <h2 id="edit-profile-title" className="font-headline text-2xl">
          Editar perfil
        </h2>

        <AvatarPicker value={form.avatar_path} choices={avatarChoices} onChange={(path) => set('avatar_path', path)} />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Nome"
            value={form.display_name}
            onChange={(event) => set('display_name', event.target.value)}
            maxLength={80}
            placeholder="Como você quer aparecer"
          />
          <TextField
            label="@ de usuário"
            value={form.username}
            onChange={(event) => set('username', event.target.value.toLowerCase())}
            maxLength={24}
            required
            hint={errors.username ?? 'Letras minúsculas, números, ponto ou _.'}
            aria-invalid={errors.username ? true : undefined}
          />
        </div>

        <TextArea
          label="Sobre você"
          value={form.bio}
          onChange={(event) => set('bio', event.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Conte sua trajetória e seu estilo de criação"
        />

        <TextField
          label="Localização"
          value={form.location}
          onChange={(event) => set('location', event.target.value)}
          maxLength={80}
          placeholder="Ex.: São Paulo, SP"
        />

        <div className="grid gap-4 sm:grid-cols-3">
          {socialField('instagram', 'Instagram', '@seuperfil')}
          {socialField('tiktok', 'TikTok', '@seuperfil')}
          {socialField('youtube', 'YouTube', '@seucanal')}
        </div>

        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Salvar perfil
          </Button>
        </div>
      </form>
    </dialog>
  )
}
