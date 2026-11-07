import { useCallback, useEffect, useState } from 'react'
import type { MultiplierProject, ProjectInput, Variation } from '@/domain/multiplier'
import { errorMessage } from '@/lib/api'
import { fetchMultiplierProject, fetchVariations, saveMultiplierProject } from '@/lib/multiplierApi'

export interface MultiplierProjectState {
  readonly project: MultiplierProject | null
  readonly variations: readonly Variation[]
  readonly loading: boolean
  readonly error: string | null
  readonly save: (input: ProjectInput) => Promise<MultiplierProject>
  /** Recarrega projeto (leitura do material) e variações depois de um lote. */
  readonly reload: () => Promise<void>
  readonly replaceVariation: (variation: Variation) => void
  readonly removeVariation: (id: string) => void
}

export function useMultiplierProject(id: string | undefined): MultiplierProjectState {
  const [project, setProject] = useState<MultiplierProject | null>(null)
  const [variations, setVariations] = useState<readonly Variation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const loaded = await fetchMultiplierProject(id)
      setProject(loaded)
      setVariations(await fetchVariations(id, loaded.takes))
      setError(null)
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void reload()
  }, [reload])

  const save = useCallback(
    async (input: ProjectInput) => {
      const saved = await saveMultiplierProject(input, id)
      setProject(saved)
      // Takes mudaram: roteiros são ajustados aos takes novos.
      if (id) setVariations(await fetchVariations(id, saved.takes))
      return saved
    },
    [id],
  )

  const replaceVariation = useCallback((variation: Variation) => {
    setVariations((current) => current.map((item) => (item.id === variation.id ? variation : item)))
  }, [])

  const removeVariation = useCallback((variationId: string) => {
    setVariations((current) => current.filter((item) => item.id !== variationId))
  }, [])

  return { project, variations, loading, error, save, reload, replaceVariation, removeVariation }
}
