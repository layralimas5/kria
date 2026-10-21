import { lazy, Suspense, type ComponentType } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { OnboardingGate } from '@/components/OnboardingGate'
import { RequireAuth } from '@/components/RequireAuth'
import { Spinner } from '@/components/ui/Spinner'
import { AccountProvider } from '@/hooks/useAccount'
import { BalanceProvider } from '@/hooks/useBalance'
import { GenerationsProvider } from '@/hooks/useGenerations'
import { ProfileProvider } from '@/hooks/useProfile'
import { SessionProvider } from '@/hooks/useSession'
import { LandingPage } from '@/landing/LandingPage'
import { LoginPage } from '@/pages/LoginPage'

/** Página carregada sob demanda a partir do export nomeado. */
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(() => load().then((module) => ({ default: module[name] })))
}

const HomePage = page(() => import('@/pages/HomePage'), 'HomePage')
const StudioPage = page(() => import('@/pages/StudioPage'), 'StudioPage')
const GalleryPage = page(() => import('@/pages/GalleryPage'), 'GalleryPage')
const PersonasPage = page(() => import('@/pages/PersonasPage'), 'PersonasPage')
const CreditsPage = page(() => import('@/pages/CreditsPage'), 'CreditsPage')
const SubscriptionPage = page(() => import('@/pages/SubscriptionPage'), 'SubscriptionPage')
const AccountPage = page(() => import('@/pages/AccountPage'), 'AccountPage')
const AccountSettingsPage = page(() => import('@/pages/AccountSettingsPage'), 'AccountSettingsPage')
const OnboardingPage = page(() => import('@/pages/OnboardingPage'), 'OnboardingPage')
const ForgotPasswordPage = page(() => import('@/pages/ForgotPasswordPage'), 'ForgotPasswordPage')
const ResetPasswordPage = page(() => import('@/pages/ResetPasswordPage'), 'ResetPasswordPage')
const SubscribePage = page(() => import('@/pages/SubscribePage'), 'SubscribePage')
const TermsPage = page(() => import('@/landing/TermsPage'), 'TermsPage')

function PageFallback() {
  return (
    <div className="grid place-items-center py-24 text-zinc-500" role="status" aria-label="Carregando">
      <Spinner className="size-6" />
    </div>
  )
}

/** Tudo o que precisa da pessoa logada: saldo, gerações, perfil e conta. */
function SignedIn() {
  return (
    <RequireAuth>
      <BalanceProvider>
        <GenerationsProvider>
          <ProfileProvider>
            <AccountProvider>
              <Suspense fallback={<PageFallback />}>
                <Outlet />
              </Suspense>
            </AccountProvider>
          </ProfileProvider>
        </GenerationsProvider>
      </BalanceProvider>
    </RequireAuth>
  )
}

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route index element={<LandingPage />} />
            <Route path="/termos" element={<TermsPage />} />
            <Route path="/entrar" element={<LoginPage />} />
            <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
            <Route path="/nova-senha" element={<ResetPasswordPage />} />
            <Route element={<SignedIn />}>
              <Route path="boas-vindas" element={<OnboardingPage />} />
              <Route path="assinar/:plan" element={<SubscribePage />} />
              <Route
                element={
                  <OnboardingGate>
                    <AppShell />
                  </OnboardingGate>
                }
              >
                <Route path="inicio" element={<HomePage />} />
                <Route path="estudio" element={<StudioPage />} />
                <Route path="galeria" element={<GalleryPage />} />
                <Route path="personas" element={<PersonasPage />} />
                <Route path="creditos" element={<CreditsPage />} />
                <Route path="assinatura" element={<SubscriptionPage />} />
                <Route path="conta" element={<AccountPage />} />
                <Route path="conta/configuracoes" element={<AccountSettingsPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </SessionProvider>
  )
}
