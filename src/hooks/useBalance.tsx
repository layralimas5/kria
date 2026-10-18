import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { walletSchema, type Wallet } from '@/domain/types'
import { isDemo, supabase } from '@/lib/supabase'
import { useUserId } from './useSession'

interface BalanceState {
  /** Total disponível (plano + comprado). `null` enquanto carrega. */
  readonly balance: number | null
  readonly wallet: Wallet | null
  readonly refresh: () => Promise<void>
}

const BalanceContext = createContext<BalanceState>({ balance: null, wallet: null, refresh: async () => {} })

const EMPTY_WALLET: Wallet = { balance: 0, subscription_balance: 0, purchased_balance: 0 }

export function BalanceProvider({ children }: { readonly children: ReactNode }) {
  const userId = useUserId()
  const [wallet, setWallet] = useState<Wallet | null>(null)

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('credit_balances')
      .select('balance, subscription_balance, purchased_balance')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      console.error('saldo', error)
      return
    }
    setWallet(data ? walletSchema.parse(data) : EMPTY_WALLET)
  }, [userId])

  useEffect(() => {
    void refresh()
    if (isDemo) return
    const channel = supabase
      .channel(`balance:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'credit_balances', filter: `user_id=eq.${userId}` },
        (payload) => {
          const parsed = walletSchema.safeParse(payload.new)
          if (parsed.success) setWallet(parsed.data)
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, refresh])

  return <BalanceContext.Provider value={{ balance: wallet?.balance ?? null, wallet, refresh }}>{children}</BalanceContext.Provider>
}

export function useBalance(): BalanceState {
  return useContext(BalanceContext)
}
