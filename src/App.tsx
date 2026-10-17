import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { RequireAuth } from '@/components/RequireAuth'
import { Spinner } from '@/components/ui/Spinner'
import { BalanceProvider } from '@/hooks/useBalance'
import { GenerationsProvider } from '@/hooks/useGenerations'
import { SessionProvider } from '@/hooks/useSession'
import { LoginPage } from '@/pages/LoginPage'
import { StudioPage } from '@/pages/StudioPage'

const GalleryPage = lazy(() => import('@/pages/GalleryPage').then((module) => ({ default: module.GalleryPage })))
const PersonasPage = lazy(() => import('@/pages/PersonasPage').then((module) => ({ default: module.PersonasPage })))
const CreditsPage = lazy(() => import('@/pages/CreditsPage').then((module) => ({ default: module.CreditsPage })))

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
          <Route path="/entrar" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <BalanceProvider>
                  <GenerationsProvider>
                    <Suspense fallback={<PageFallback />}>
                      <AppShell />
                    </Suspense>
                  </GenerationsProvider>
                </BalanceProvider>
              </RequireAuth>
            }
          >
            <Route index element={<StudioPage />} />
            <Route path="galeria" element={<GalleryPage />} />
            <Route path="personas" element={<PersonasPage />} />
            <Route path="creditos" element={<CreditsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  )
}
