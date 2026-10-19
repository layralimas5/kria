import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { z } from 'zod'
import { currentSubscription } from '@/domain/plans'
import {
  PLAN_COLUMNS,
  planSchema,
  SUBSCRIPTION_COLUMNS,
  subscriptionSchema,
  type Goal,
  type Plan,
  type Preferences,
  type Subscription,
} from '@/domain/types'
import { fetchPreferences, saveGoal } from '@/lib/api'
import { isDemo, supabase } from '@/lib/supabase'
import { useUserId } from './useSession'

interface AccountState {
  readonly loading: boolean
  readonly error: string | null
  readonly plans: readonly Plan[]
  readonly subscriptions: readonly Subscription[]
  /** A assinatura que vale agora (ativa, em atraso na carência ou cancelada no período pago). */
  readonly subscription: Subscription | null
  /** O plano em vigor; sem assinatura, o grátis. */
  readonly plan: Plan | null
  readonly preferences: Preferences | null
  readonly refresh: () => Promise<void>
  readonly setGoal: (goal: Goal) => Promise<void>
}

const AccountContext = createContext<AccountState | null>(null)

async function fetchPlans(): Promise<Plan[]> {
  const { data, error } = await supabase.from('subscription_plans').select(PLAN_COLUMNS).order('position')
  if (error) throw error
  return z.array(planSchema).parse(data)
}

async function fetchSubscriptions(): Promise<Subscription[]> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select(SUBSCRIPTION_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return z.array(subscriptionSchema).parse(data)
}

/** Plano, assinatura e preferências da pessoa logada. */
export function AccountProvider({ children }: { readonly children: ReactNode }) {
  const userId = useUserId()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [preferences, setPreferences] = useState<Preferences | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [loadedPlans, loadedSubscriptions, loadedPreferences] = await Promise.all([
        fetchPlans(),
        fetchSubscriptions(),
        fetchPreferences(userId),
      ])
      setPlans(loadedPlans)
      setSubscriptions(loadedSubscriptions)
      setPreferences(loadedPreferences)
      setError(null)
    } catch (loadError) {
      console.error('conta', loadError)
      setError('Não deu para carregar os dados da sua conta.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void refresh()
    if (isDemo) return
    // Pagamento confirmado pelo webhook aparece sem recarregar.
    const channel = supabase
      .channel(`subscriptions:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${userId}` }, () => {
        void refresh()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, refresh])

  const setGoal = useCallback(
    async (goal: Goal) => {
      setPreferences(await saveGoal(userId, goal))
    },
    [userId],
  )

  const value = useMemo<AccountState>(() => {
    const subscription = currentSubscription(subscriptions)
    const slug = subscription?.plan_slug ?? 'gratis'
    const plan = plans.find((item) => item.slug === slug) ?? null
    return { loading, error, plans, subscriptions, subscription, plan, preferences, refresh, setGoal }
  }, [loading, error, plans, subscriptions, preferences, refresh, setGoal])

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount(): AccountState {
  const context = useContext(AccountContext)
  if (!context) throw new Error('useAccount fora do AccountProvider')
  return context
}
