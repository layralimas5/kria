import type { SubscriptionPlan } from '@/domain/plans'
import { fetchPlans } from '@/lib/api'
import { isConfigured } from '@/lib/supabase'
import { useQuery, type QueryState } from './useQuery'

async function loadPlans(): Promise<SubscriptionPlan[]> {
  if (!isConfigured) throw new Error('Supabase não configurado: sem planos para mostrar')
  return fetchPlans()
}

/** Planos ativos, direto de `subscription_plans`. */
export function usePlans(): QueryState<SubscriptionPlan[]> {
  return useQuery(loadPlans, 'Não deu para carregar os planos agora.')
}
