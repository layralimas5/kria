import { useEffect, useState } from 'react'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { useUserId } from './useSession'

// Uma consulta por conta e por carregamento da página: barra lateral, menu e busca leem o mesmo resultado.
const cache = new Map<string, Promise<boolean>>()

function fetchIsAdmin(userId: string): Promise<boolean> {
  const cached = cache.get(userId)
  if (cached) return cached
  const request = Promise.resolve(supabase.rpc('is_admin')).then(({ data, error }) => {
    if (error) {
      console.warn('não deu para conferir o acesso ao admin', error)
      cache.delete(userId)
      return false
    }
    return z.boolean().catch(false).parse(data)
  })
  cache.set(userId, request)
  return request
}

/**
 * Se a conta logada está em `admin_users`. Só decide se o atalho para o /admin aparece:
 * quem manda é o banco, que confere papel e segundo fator em cada função `admin_*`.
 */
export function useIsAdmin(): boolean {
  const userId = useUserId()
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    let active = true
    void fetchIsAdmin(userId).then((value) => {
      if (active) setIsAdmin(value)
    })
    return () => {
      active = false
    }
  }, [userId])
  return isAdmin
}
