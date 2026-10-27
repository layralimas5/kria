import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  checkUploadFile,
  defaultChoices,
  formatAllowed,
  formatCost,
  type Format,
  type FormatCost,
  type Upload,
  type UploadType,
} from '@/domain/formats'
import type { Generation, Model } from '@/domain/types'
import { errorMessage, generateFormat, uploadPhoto } from '@/lib/api'
import { useAccount } from './useAccount'
import { useActiveBrand } from './useActiveBrand'
import { useBalance } from './useBalance'
import { useGenerations } from './useGenerations'
import { useIdempotencyKey } from './useIdempotencyKey'
import { useUserId } from './useSession'

type Step = 'edit' | 'final'

interface Photo {
  readonly file: File
  readonly type: UploadType
  /** Prévia local: mostra o "antes" sem esperar o Storage. */
  readonly previewUrl: string
}

/**
 * Estado e envio de um formato. A foto só sobe quando a pessoa gera (e depois de
 * confirmar o direito de uso); a mesma foto serve para as etapas seguintes.
 * No antes e depois, a edição sai primeiro e o vídeo só libera com ela pronta.
 */
export function useFormatRun(format: Format, models: readonly Model[]) {
  const userId = useUserId()
  const { plan } = useAccount()
  const { balance, refresh: refreshBalance } = useBalance()
  const { generations, upsert } = useGenerations()
  const { activeBrandId } = useActiveBrand()
  const requestKey = useIdempotencyKey()

  const [photo, setPhoto] = useState<Photo | null>(null)
  const [upload, setUpload] = useState<Upload | null>(null)
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [choices, setChoices] = useState<Readonly<Record<string, string>>>(() => defaultChoices(format.fields))
  const [note, setNote] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [busyStep, setBusyStep] = useState<Step | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!photo) return
    return () => URL.revokeObjectURL(photo.previewUrl)
  }, [photo])

  // Pedido diferente, chave nova; o aviso some quando a pessoa mexe no que faltava.
  useEffect(() => {
    setError(null)
    requestKey.rotate()
  }, [photo, rightsConfirmed, choices, note, editId, requestKey])

  const choosePhoto = useCallback((file: File) => {
    const check = checkUploadFile(file)
    if (!check.ok) {
      setError(check.reason)
      return
    }
    setPhoto({ file, type: check.type, previewUrl: URL.createObjectURL(file) })
    setUpload(null)
    setEditId(null)
  }, [])

  const setChoice = useCallback((key: string, value: string) => setChoices((current) => ({ ...current, [key]: value })), [])

  const cost: FormatCost | null = useMemo(() => formatCost(format, models), [format, models])
  const allowed = plan === null || formatAllowed(format, models, plan.slug)
  const editGeneration: Generation | null = generations.find((item) => item.id === editId) ?? null
  const results = useMemo(
    () => generations.filter((item) => item.format_slug === format.slug && item.id !== editId),
    [generations, format.slug, editId],
  )

  function stepCredits(step: Step): number | null {
    if (!cost) return null
    return step === 'edit' ? cost.edit : cost.final
  }

  /** O que falta para a etapa, dito para a pessoa em vez de um botão morto. */
  function missingFor(step: Step): string | null {
    if (!photo) return 'Escolha a foto primeiro.'
    if (!rightsConfirmed) return 'Confirme que a foto não mostra pessoas e que você pode usá-la.'
    if (!allowed) return 'Esse formato faz parte dos planos pagos. Veja em Assinatura.'
    if (step === 'final' && format.flow === 'before_after' && editGeneration?.status !== 'succeeded') {
      return 'Gere a foto do depois primeiro.'
    }
    const credits = stepCredits(step)
    if (credits === null) return 'Esse formato está indisponível agora.'
    if (balance !== null && balance < credits) return `Você precisa de ${credits} créditos para essa etapa.`
    return null
  }

  async function ensureUpload(current: Photo): Promise<Upload> {
    if (upload) return upload
    const created = await uploadPhoto(userId, current.file, current.type, rightsConfirmed)
    setUpload(created)
    return created
  }

  async function run(step: Step) {
    const missing = missingFor(step)
    if (missing || !photo) {
      setError(missing)
      return
    }
    setBusyStep(step)
    setError(null)
    try {
      const sent = await ensureUpload(photo)
      const generation = await generateFormat({
        slug: format.slug,
        step,
        fields: choices,
        note: note.trim(),
        uploadId: sent.id,
        endGenerationId: step === 'final' && format.flow === 'before_after' ? (editId ?? undefined) : undefined,
        brandId: activeBrandId ?? undefined,
        idempotencyKey: requestKey.current(),
      })
      requestKey.rotate()
      upsert(generation)
      if (step === 'edit') setEditId(generation.id)
      void refreshBalance()
    } catch (runError) {
      setError(errorMessage(runError))
    } finally {
      setBusyStep(null)
    }
  }

  return {
    photo,
    choosePhoto,
    upload,
    rightsConfirmed,
    setRightsConfirmed,
    choices,
    setChoice,
    note,
    setNote,
    cost,
    allowed,
    editGeneration,
    results,
    busyStep,
    error,
    canRun: (step: Step) => missingFor(step) === null,
    run: (step: Step) => void run(step),
  }
}

export type FormatRun = ReturnType<typeof useFormatRun>
