import { PLAN_CATALOG } from '@/domain/planCatalog'
import type { SubscriptionPlan } from '@/domain/plans'
import { fetchPlans } from '@/lib/api'
import { isConfigured } from '@/lib/supabase'
import { useQuery, type QueryState } from './useQuery'

/** Com Supabase, os planos vêm de `subscription_plans`. Sem ele (prévia local), do catálogo igual ao seed. */
async function loadPlans(): Promise<SubscriptionPlan[]> {
  if (!isConfigured) return PLAN_CATALOG
  return fetchPlans()
}

export function usePlans(): QueryState<SubscriptionPlan[]> {
  return useQuery(loadPlans, 'Não deu para carregar os planos agora.')
}
