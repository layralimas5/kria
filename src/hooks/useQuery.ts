import { useCallback, useEffect, useState } from 'react'

export interface QueryState<T> {
  readonly data: T | null
  readonly loading: boolean
  readonly error: string | null
  readonly reload: () => Promise<void>
}

/** Carrega uma vez ao montar (e quando `load` muda), com estados de loading e erro. */
export function useQuery<T>(load: () => Promise<T>, errorText: string): QueryState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setData(await load())
      setError(null)
    } catch (loadError) {
      console.error(errorText, loadError)
      setError(errorText)
    } finally {
      setLoading(false)
    }
  }, [load, errorText])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, error, reload }
}
