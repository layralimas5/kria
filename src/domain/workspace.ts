import type { ProjectStatus } from './types'

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planejando',
  producing: 'Em produção',
  done: 'Pronto',
}

/** Querystring que leva marca e projeto de uma tela para outra (assistente, Studio, galeria). */
export function contextParams(context: { readonly brandId?: string | null; readonly projectId?: string | null }): URLSearchParams {
  const params = new URLSearchParams()
  if (context.brandId) params.set('marca', context.brandId)
  if (context.projectId) params.set('projeto', context.projectId)
  return params
}
