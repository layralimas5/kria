import { useMemo } from 'react'
import { canUseModel } from '@/domain/plans'
import type { MediaKind, Model } from '@/domain/types'
import { useAccount } from './useAccount'
import { useModels } from './useCatalog'

export interface PlanModels {
  /** Só os modelos que o plano da pessoa libera; nulo enquanto modelos ou plano carregam. */
  readonly models: readonly Model[] | null
  /** Tipos de criação com pelo menos um modelo liberado no Estúdio (imagem, vídeo). */
  readonly kinds: readonly MediaKind[] | null
  readonly error: string | null
}

/** O app mostra só o que o plano inclui: modelo fora do plano não aparece, nem com cadeado. */
export function usePlanModels(): PlanModels {
  const { data, error } = useModels()
  const { plan } = useAccount()
  return useMemo(() => {
    if (!data || !plan) return { models: null, kinds: null, error }
    const models = data.filter((model) => canUseModel(model.allowed_plans, plan.slug))
    const kinds = [...new Set(models.filter((model) => model.studio).map((model) => model.kind))]
    return { models, kinds, error }
  }, [data, plan, error])
}
