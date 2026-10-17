import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { useUserId } from './useSession'

interface BalanceState {
  readonly balance: number | null
  readonly refresh: () => Promise<void>
}

const BalanceContext = createContext<BalanceState>({ balance: null, refresh: async () => {} })

const balanceRowSchema = z.object({ balance: z.number().int() })

export function BalanceProvider({ children }: { readonly children: ReactNode }) {
  const userId = useUserId()
  const [balance, setBalance] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('credit_balances').select('balance').eq('user_id', userId).maybeSingle()
    if (error) {
      console.error('saldo', error)
      return
    }
    setBalance(data ? balanceRowSchema.parse(data).balance : 0)
  }, [userId])

  useEffect(() => {
    void refresh()
    const channel = supabase
      .channel(`balance:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'credit_balances', filter: `user_id=eq.${userId}` },
        (payload) => {
          const parsed = balanceRowSchema.safeParse(payload.new)
          if (parsed.success) setBalance(parsed.data.balance)
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, refresh])

  return <BalanceContext.Provider value={{ balance, refresh }}>{children}</BalanceContext.Provider>
}

export function useBalance(): BalanceState {
  return useContext(BalanceContext)
}
