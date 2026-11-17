import { createContext, useContext } from 'react'
import type { MediaKind } from '@/domain/types'

/**
 * Tipos de criação que o plano libera (`usePlanModels().kinds`), carregados uma vez no `AppShell`.
 * Cards e atalhos leem daqui para não buscar os modelos de novo em cada item da lista.
 */
export const PlanKindsContext = createContext<readonly MediaKind[] | null>(null)

/** Falso enquanto o plano carrega: atalho para o que o plano não libera nunca aparece, nem por um instante. */
export function useCanCreate(kind: MediaKind): boolean {
  return useContext(PlanKindsContext)?.includes(kind) ?? false
}
