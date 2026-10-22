import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { z } from 'zod'
import { GENERATION_COLUMNS, generationSchema, isOpen, MEDIA_KINDS, type Generation } from '@/domain/types'
import { refreshGenerations } from '@/lib/api'
import { isDemo, supabase } from '@/lib/supabase'
import { useBalance } from './useBalance'
import { useUserId } from './useSession'

const PAGE_SIZE = 60
// No demo não há realtime: a conferência faz o papel dele, bem mais rápido.
const POLL_INTERVAL_MS = isDemo ? 2_000 : 15_000
const POLL_AFTER_MS = isDemo ? 0 : 20_000

interface GenerationsState {
  readonly generations: readonly Generation[]
  readonly loading: boolean
  readonly error: string | null
  readonly upsert: (generation: Generation) => void
  readonly reload: () => Promise<void>
}

const GenerationsContext = createContext<GenerationsState | null>(null)

function mergeSorted(list: readonly Generation[], next: Generation): Generation[] {
  const rest = list.filter((item) => item.id !== next.id)
  return [next, ...rest].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

/**
 * Uma lista só, compartilhada entre Estúdio, Galeria e Personas.
 * Atualiza por realtime; gerações abertas há mais de 20s também são
 * conferidas no servidor a cada 15s, caso o webhook do fal se perca.
 */
export function GenerationsProvider({ children }: { readonly children: ReactNode }) {
  const userId = useUserId()
  const { refresh: refreshBalance } = useBalance()
  const [generations, setGenerations] = useState<readonly Generation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const generationsRef = useRef(generations)
  generationsRef.current = generations

  const reload = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('generations')
      .select(GENERATION_COLUMNS)
      .in('kind', MEDIA_KINDS)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
    setLoading(false)
    if (queryError) {
      setError('Não deu para carregar suas criações.')
      return
    }
    setError(null)
    setGenerations(z.array(generationSchema).parse(data))
  }, [])

  const upsert = useCallback((generation: Generation) => {
    setGenerations((list) => mergeSorted(list, generation))
  }, [])

  useEffect(() => {
    void reload()
    if (isDemo) return
    const channel = supabase
      .channel(`generations:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'generations', filter: `user_id=eq.${userId}` },
        (payload) => {
          const parsed = generationSchema.safeParse(payload.new)
          if (parsed.success) upsert(parsed.data)
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, reload, upsert])

  useEffect(() => {
    const timer = window.setInterval(async () => {
      const stale = generationsRef.current
        .filter((item) => isOpen(item) && Date.now() - new Date(item.created_at).getTime() > POLL_AFTER_MS)
        .map((item) => item.id)
      if (stale.length === 0) return
      try {
        await refreshGenerations(stale)
        await Promise.all([reload(), refreshBalance()])
      } catch (pollError) {
        console.warn('conferência de gerações falhou', pollError)
      }
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [reload, refreshBalance])

  return (
    <GenerationsContext.Provider value={{ generations, loading, error, upsert, reload }}>
      {children}
    </GenerationsContext.Provider>
  )
}

export function useGenerations(): GenerationsState {
  const context = useContext(GenerationsContext)
  if (!context) throw new Error('useGenerations fora do GenerationsProvider')
  return context
}
