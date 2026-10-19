import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAccount } from '@/hooks/useAccount'

/** Conta que ainda não respondeu o objetivo vai para o onboarding antes do app. */
export function OnboardingGate({ children }: { readonly children: ReactNode }) {
  const { loading, error, preferences } = useAccount()
  // Sem conseguir ler as preferências, não prende a pessoa fora do app.
  if (!loading && !error && !preferences?.onboarded_at) return <Navigate to="/boas-vindas" replace />
  return <>{children}</>
}
