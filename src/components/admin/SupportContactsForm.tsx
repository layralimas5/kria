import { useState, type FormEvent } from 'react'
import { formatWhatsapp, type SupportSettings } from '@/domain/support'
import { useToast } from '@/hooks/useToast'
import { setSupportSettings } from '@/lib/adminApi'
import { errorMessage } from '@/lib/api'
import { Button } from '../ui/Button'
import { TextField } from '../ui/Field'

const digits = (value: string) => value.replace(/\D/g, '')

/** Contatos que a aba Suporte do app mostra: e-mail (Starter) e WhatsApp (Pro e Max). */
export function SupportContactsForm({ settings, canEdit, onSaved }: { readonly settings: SupportSettings; readonly canEdit: boolean; readonly onSaved: () => void }) {
  const notify = useToast()
  const [email, setEmail] = useState(settings.email ?? '')
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp ? formatWhatsapp(settings.whatsapp) : '')
  const [community, setCommunity] = useState(settings.community_url ?? '')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(event: FormEvent) {
    event.preventDefault()
    const number = digits(whatsapp)
    if (number && (number.length < 12 || number.length > 13)) {
      setError('WhatsApp com DDI e DDD, por exemplo +55 11 99999-0000.')
      return
    }
    if (community.trim() && !community.trim().startsWith('https://')) {
      setError('O link da comunidade precisa começar com https://.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await setSupportSettings({ email: email.trim(), whatsapp: number, communityUrl: community.trim(), reason })
      notify('Contatos de suporte salvos.')
      setReason('')
      onSaved()
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-4 card-premium rounded-2xl p-5">
      <div className="grid gap-4 md:grid-cols-3">
        <TextField label="E-mail (Starter)" type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={!canEdit} hint="Pro e Max também veem enquanto não houver WhatsApp." />
        <TextField label="WhatsApp (Pro e Max)" inputMode="tel" placeholder="+55 11 99999-0000" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} disabled={!canEdit} hint="Vazio = o app mostra o e-mail." />
        <TextField label="Link da comunidade" type="url" placeholder="https://" value={community} onChange={(event) => setCommunity(event.target.value)} disabled={!canEdit} hint="Vazio = aparece como “em breve”." />
      </div>
      {canEdit && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextField className="flex-1" label="Motivo" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex.: número novo do suporte" required minLength={5} />
          <Button type="submit" disabled={busy}>
            Salvar contatos
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </form>
  )
}
