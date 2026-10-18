import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteAccount, errorMessage, exportAccountData } from '@/lib/api'
import { isDemo } from '@/lib/supabase'
import { Button } from '../ui/Button'
import { TextField } from '../ui/Field'
import { Notice } from '../ui/Notice'

function download(data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `kria-meus-dados-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

/** Baixa tudo o que a Kria guarda da pessoa (LGPD, art. 18). */
export function ExportData() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExport() {
    setBusy(true)
    setError(null)
    try {
      download(await exportAccountData())
    } catch (exportError) {
      setError(errorMessage(exportError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && <Notice tone="error">{error}</Notice>}
      <Button variant="secondary" loading={busy} onClick={() => void handleExport()}>
        Baixar meus dados (JSON)
      </Button>
    </div>
  )
}

const CONFIRMATION = 'EXCLUIR'

/** Exclusão definitiva: cancela a assinatura, apaga arquivos e a conta. Pede a palavra digitada. */
export function DeleteAccount() {
  const navigate = useNavigate()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (typed !== CONFIRMATION) return
    setBusy(true)
    setError(null)
    try {
      await deleteAccount()
      navigate('/entrar', { replace: true })
    } catch (deleteError) {
      setError(errorMessage(deleteError))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-zinc-400">
        Apaga perfil, personagens, criações e créditos (inclusive os comprados) e cancela a assinatura. Não dá para desfazer.
      </p>
      <TextField
        label={`Digite ${CONFIRMATION} para confirmar`}
        value={typed}
        onChange={(event) => setTyped(event.target.value.toUpperCase())}
        autoComplete="off"
      />
      {error && <Notice tone="error">{error}</Notice>}
      {isDemo && <Notice>No modo demo a conta não é excluída.</Notice>}
      <Button
        type="submit"
        variant="secondary"
        loading={busy}
        disabled={typed !== CONFIRMATION || isDemo}
        className="border-red-500/40 text-red-200 hover:border-red-500/70 hover:bg-red-500/10"
      >
        Excluir minha conta
      </Button>
    </form>
  )
}
