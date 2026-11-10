import { lazy, Suspense, type ComponentType } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { OnboardingGate } from '@/components/OnboardingGate'
import { RequireAuth } from '@/components/RequireAuth'
import { Spinner } from '@/components/ui/Spinner'
import { AccountProvider } from '@/hooks/useAccount'
import { ActiveBrandProvider } from '@/hooks/useActiveBrand'
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
const FormatsPage = page(() => import('@/pages/FormatsPage'), 'FormatsPage')
const FormatPage = page(() => import('@/pages/FormatPage'), 'FormatPage')
const GalleryPage = page(() => import('@/pages/GalleryPage'), 'GalleryPage')
const PersonasPage = page(() => import('@/pages/PersonasPage'), 'PersonasPage')
const CreditsPage = page(() => import('@/pages/CreditsPage'), 'CreditsPage')
const SubscriptionPage = page(() => import('@/pages/SubscriptionPage'), 'SubscriptionPage')
const SupportPage = page(() => import('@/pages/SupportPage'), 'SupportPage')
const AccountPage = page(() => import('@/pages/AccountPage'), 'AccountPage')
const AccountSettingsPage = page(() => import('@/pages/AccountSettingsPage'), 'AccountSettingsPage')
const OnboardingPage = page(() => import('@/pages/OnboardingPage'), 'OnboardingPage')
const ForgotPasswordPage = page(() => import('@/pages/ForgotPasswordPage'), 'ForgotPasswordPage')
const ResetPasswordPage = page(() => import('@/pages/ResetPasswordPage'), 'ResetPasswordPage')
const SubscribePage = page(() => import('@/pages/SubscribePage'), 'SubscribePage')
const AssistantPage = page(() => import('@/pages/AssistantPage'), 'AssistantPage')
const BrandsPage = page(() => import('@/pages/BrandsPage'), 'BrandsPage')
const ProjectsPage = page(() => import('@/pages/ProjectsPage'), 'ProjectsPage')
const ContentPage = page(() => import('@/pages/ContentPage'), 'ContentPage')
const ResultsPage = page(() => import('@/pages/ResultsPage'), 'ResultsPage')
const MultiplierPage = page(() => import('@/pages/MultiplierPage'), 'MultiplierPage')
const MultiplierProjectPage = page(() => import('@/pages/MultiplierProjectPage'), 'MultiplierProjectPage')
const AdminRoot = page(() => import('@/pages/admin/AdminRoot'), 'AdminRoot')
const AdminDashboardPage = page(() => import('@/pages/admin/AdminDashboardPage'), 'AdminDashboardPage')
const AdminAnalyticsPage = page(() => import('@/pages/admin/AdminAnalyticsPage'), 'AdminAnalyticsPage')
const AdminGenerationsPage = page(() => import('@/pages/admin/AdminListsPages'), 'AdminGenerationsPage')
const AdminSubscriptionsPage = page(() => import('@/pages/admin/AdminListsPages'), 'AdminSubscriptionsPage')
const AdminUsersPage = page(() => import('@/pages/admin/AdminSectionPages'), 'AdminUsersPage')
const AdminUserViewPage = page(() => import('@/pages/admin/AdminUserViewPage'), 'AdminUserViewPage')
const AdminPlansPage = page(() => import('@/pages/admin/AdminSectionPages'), 'AdminPlansPage')
const AdminModelsPage = page(() => import('@/pages/admin/AdminSectionPages'), 'AdminModelsPage')
const AdminAuditPage = page(() => import('@/pages/admin/AdminSectionPages'), 'AdminAuditPage')
const AdminFinancePage = page(() => import('@/pages/admin/AdminFinancePage'), 'AdminFinancePage')
const AdminAdminsPage = page(() => import('@/pages/admin/AdminAdminsPage'), 'AdminAdminsPage')
const AdminSecurityPage = page(() => import('@/pages/admin/AdminSecurityPage'), 'AdminSecurityPage')
const AdminAccountPage = page(() => import('@/pages/admin/AdminAccountPage'), 'AdminAccountPage')
const TermsPage = page(() => import('@/landing/TermsPage'), 'TermsPage')

function PageFallback() {
  return (
    <div className="grid place-items-center py-24 text-zinc-500" role="status" aria-label="Carregando">
      <Spinner className="size-6" />
    </div>
  )
}

/** Tudo o que precisa da pessoa logada: saldo, gerações, perfil, conta e marca ativa. */
function SignedIn() {
  return (
    <RequireAuth>
      <BalanceProvider>
        <GenerationsProvider>
          <ProfileProvider>
            <AccountProvider>
              <ActiveBrandProvider>
                <Suspense fallback={<PageFallback />}>
                  <Outlet />
                </Suspense>
              </ActiveBrandProvider>
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
            <Route path="/entrar" element={<LoginPage key="signin" initialMode="signin" />} />
            <Route path="/criar-conta" element={<LoginPage key="signup" initialMode="signup" />} />
            <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
            <Route path="/nova-senha" element={<ResetPasswordPage />} />
            <Route element={<SignedIn />}>
              <Route path="boas-vindas" element={<OnboardingPage />} />
              <Route path="assinar/:plan" element={<SubscribePage />} />
              {/* Operação: moldura própria, fora do painel do usuário e sem link em menu (docs/admin.md). */}
              <Route path="admin" element={<AdminRoot />}>
                <Route index element={<AdminDashboardPage />} />
                <Route path="analytics" element={<AdminAnalyticsPage />} />
                <Route path="usuarios" element={<AdminUsersPage />} />
                <Route path="usuarios/:id/visao" element={<AdminUserViewPage />} />
                <Route path="geracoes" element={<AdminGenerationsPage />} />
                <Route path="assinaturas" element={<AdminSubscriptionsPage />} />
                <Route path="modelos" element={<AdminModelsPage />} />
                <Route path="planos" element={<AdminPlansPage />} />
                <Route path="financeiro" element={<AdminFinancePage />} />
                <Route path="auditoria" element={<AdminAuditPage />} />
                <Route path="administradores" element={<AdminAdminsPage />} />
                <Route path="seguranca" element={<AdminSecurityPage />} />
                <Route path="conta" element={<AdminAccountPage />} />
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </Route>
              <Route
                element={
                  <OnboardingGate>
                    <AppShell />
                  </OnboardingGate>
                }
              >
                <Route path="inicio" element={<HomePage />} />
                <Route path="estudio" element={<StudioPage />} />
                <Route path="multiplicador" element={<MultiplierPage />} />
                <Route path="multiplicador/:id" element={<MultiplierProjectPage />} />
                <Route path="formatos" element={<FormatsPage />} />
                <Route path="formatos/:slug" element={<FormatPage />} />
                <Route path="galeria" element={<GalleryPage />} />
                <Route path="personas" element={<PersonasPage />} />
                <Route path="assistente" element={<Navigate to="/assistente/ideias" replace />} />
                <Route path="assistente/:ferramenta" element={<AssistantPage />} />
                <Route path="marcas" element={<BrandsPage />} />
                <Route path="projetos" element={<ProjectsPage />} />
                <Route path="conteudo" element={<ContentPage />} />
                <Route path="resultados" element={<ResultsPage />} />
                <Route path="creditos" element={<CreditsPage />} />
                <Route path="assinatura" element={<SubscriptionPage />} />
                <Route path="suporte" element={<SupportPage />} />
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
