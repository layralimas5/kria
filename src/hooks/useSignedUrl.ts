import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const TTL_SECONDS = 60 * 60
const cache = new Map<string, { url: string; expiresAt: number }>()
const pending = new Map<string, Promise<string | null>>()

function fetchSignedUrl(path: string): Promise<string | null> {
  const cached = cache.get(path)
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.url)
  const inFlight = pending.get(path)
  if (inFlight) return inFlight

  const request = supabase.storage
    .from('media')
    .createSignedUrl(path, TTL_SECONDS)
    .then(({ data, error }) => {
      if (error || !data) return null
      cache.set(path, { url: data.signedUrl, expiresAt: Date.now() + (TTL_SECONDS - 60) * 1000 })
      return data.signedUrl
    })
    .finally(() => pending.delete(path))
  pending.set(path, request)
  return request
}

/** URL assinada (1h) para um arquivo privado do bucket `media`, com cache entre telas. */
export function useSignedUrl(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() => (path ? (cache.get(path)?.url ?? null) : null))

  useEffect(() => {
    if (!path) {
      setUrl(null)
      return
    }
    let active = true
    void fetchSignedUrl(path).then((signed) => {
      if (active) setUrl(signed)
    })
    return () => {
      active = false
    }
  }, [path])

  return url
}
