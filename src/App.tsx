import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { RequireAuth } from '@/components/RequireAuth'
import { Spinner } from '@/components/ui/Spinner'
import { BalanceProvider } from '@/hooks/useBalance'
import { GenerationsProvider } from '@/hooks/useGenerations'
import { ProfileProvider } from '@/hooks/useProfile'
import { SessionProvider } from '@/hooks/useSession'
import { LandingPage } from '@/landing/LandingPage'
import { LoginPage } from '@/pages/LoginPage'

const StudioPage = lazy(() => import('@/pages/StudioPage').then((module) => ({ default: module.StudioPage })))
const GalleryPage = lazy(() => import('@/pages/GalleryPage').then((module) => ({ default: module.GalleryPage })))
const PersonasPage = lazy(() => import('@/pages/PersonasPage').then((module) => ({ default: module.PersonasPage })))
const TermsPage = lazy(() => import('@/landing/TermsPage').then((module) => ({ default: module.TermsPage })))
const CreditsPage = lazy(() => import('@/pages/CreditsPage').then((module) => ({ default: module.CreditsPage })))
const AccountPage = lazy(() => import('@/pages/AccountPage').then((module) => ({ default: module.AccountPage })))
const AccountSettingsPage = lazy(() =>
  import('@/pages/AccountSettingsPage').then((module) => ({ default: module.AccountSettingsPage })),
)

function PageFallback() {
  return (
    <div className="grid place-items-center py-24 text-zinc-500" role="status" aria-label="Carregando">
      <Spinner className="size-6" />
    </div>
  )
}

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route index element={<LandingPage />} />
          <Route path="/entrar" element={<LoginPage />} />
          <Route
            path="/termos"
            element={
              <Suspense fallback={<PageFallback />}>
                <TermsPage />
              </Suspense>
            }
          />
          <Route
            element={
              <RequireAuth>
                <BalanceProvider>
                  <GenerationsProvider>
                    <ProfileProvider>
                      <Suspense fallback={<PageFallback />}>
                        <AppShell />
                      </Suspense>
                    </ProfileProvider>
                  </GenerationsProvider>
                </BalanceProvider>
              </RequireAuth>
            }
          >
            <Route path="estudio" element={<StudioPage />} />
            <Route path="galeria" element={<GalleryPage />} />
            <Route path="personas" element={<PersonasPage />} />
            <Route path="creditos" element={<CreditsPage />} />
            <Route path="conta" element={<AccountPage />} />
            <Route path="conta/configuracoes" element={<AccountSettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  )
}
