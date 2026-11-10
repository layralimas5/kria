import { isOpen, type Generation, type MediaKind } from './types'

// Biblioteca: busca, filtros, ordem e resumo do que a pessoa já criou.

export type LibraryKind = 'all' | MediaKind
export type LibraryStatus = 'all' | 'ready' | 'running' | 'failed'
export type LibrarySort = 'newest' | 'oldest'

export interface LibraryQuery {
  readonly kind: LibraryKind
  readonly status: LibraryStatus
  /** Slug do modelo; nulo mostra todos. */
  readonly model: string | null
  readonly search: string
  readonly sort: LibrarySort
}

export const EMPTY_QUERY: LibraryQuery = { kind: 'all', status: 'all', model: null, search: '', sort: 'newest' }

type Facts = Pick<Generation, 'kind' | 'status' | 'model_slug' | 'prompt' | 'created_at' | 'credits'>

/** Minúsculo e sem acento: "Café" acha "cafe". */
export const normalize = (text: string): string => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

function statusOf(generation: Pick<Generation, 'status'>): Exclude<LibraryStatus, 'all'> {
  if (generation.status === 'succeeded') return 'ready'
  if (generation.status === 'failed') return 'failed'
  return 'running'
}

export function matchesQuery(generation: Facts, query: LibraryQuery): boolean {
  if (query.kind !== 'all' && generation.kind !== query.kind) return false
  if (query.status !== 'all' && statusOf(generation) !== query.status) return false
  if (query.model && generation.model_slug !== query.model) return false
  const terms = normalize(query.search).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const prompt = normalize(generation.prompt)
  return terms.every((term) => prompt.includes(term))
}

/** A lista do banco chega da mais nova para a mais antiga; "oldest" só inverte. */
export function applyQuery<T extends Facts>(generations: readonly T[], query: LibraryQuery): T[] {
  const matched = generations.filter((generation) => matchesQuery(generation, query))
  return query.sort === 'oldest' ? matched.reverse() : matched
}

export function isFiltered(query: LibraryQuery): boolean {
  return query.kind !== 'all' || query.status !== 'all' || query.model !== null || query.search.trim() !== '' || query.sort !== 'newest'
}

export interface LibrarySummary {
  readonly total: number
  readonly images: number
  readonly videos: number
  readonly running: number
  readonly failed: number
  /** Créditos das criações que deram certo (falha devolve). */
  readonly creditsSpent: number
}

export function librarySummary(generations: readonly Facts[]): LibrarySummary {
  let images = 0
  let videos = 0
  let running = 0
  let failed = 0
  let creditsSpent = 0
  for (const generation of generations) {
    if (generation.kind === 'image') images += 1
    else videos += 1
    if (isOpen(generation)) running += 1
    if (generation.status === 'failed') failed += 1
    if (generation.status === 'succeeded') creditsSpent += generation.credits
  }
  return { total: generations.length, images, videos, running, failed, creditsSpent }
}

/** Modelos que aparecem na biblioteca, do mais usado para o menos usado. */
export function modelsInUse(generations: readonly Pick<Generation, 'model_slug'>[]): string[] {
  const counts = new Map<string, number>()
  for (const generation of generations) counts.set(generation.model_slug, (counts.get(generation.model_slug) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([slug]) => slug)
}

/** Link do Estúdio com o mesmo pedido e o mesmo tipo, para refazer ou variar. */
export function reuseLink(generation: Pick<Generation, 'kind' | 'prompt' | 'source_generation_id' | 'persona_id'>): string {
  const params = new URLSearchParams({ modo: generation.kind === 'video' ? 'video' : 'imagem', prompt: generation.prompt })
  if (generation.kind === 'video' && generation.source_generation_id) params.set('origem', generation.source_generation_id)
  else if (generation.kind === 'video' && generation.persona_id) params.set('persona', generation.persona_id)
  return `/estudio?${params.toString()}`
}
