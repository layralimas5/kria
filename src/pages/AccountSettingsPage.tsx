import { BellRing, ChevronLeft, Download, KeyRound, LogOut, Mail, Smartphone, Target, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { GoalSelect } from '@/components/account/GoalSelect'
import { InstallApp } from '@/components/account/InstallApp'
import { PasswordForm } from '@/components/account/PasswordForm'
import { DeleteAccount, ExportData } from '@/components/account/PrivacyActions'
import { PushSettings, type PushOption } from '@/components/account/PushSettings'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { errorMessage, signOutEverywhere } from '@/lib/api'
import { useSession } from '@/hooks/useSession'

function SettingsCard({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06] sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-accent-soft">{icon}</span>
        <div>
          <h2 className="text-lg font-bold text-zinc-50">{title}</h2>
          <p className="text-sm text-zinc-400">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

const GENERATION_OPTIONS: readonly PushOption[] = [
  {
    topic: 'generations',
    label: 'Avisar quando a criação ficar pronta',
    description: 'Imagem e vídeo levam alguns minutos. Pode fechar o Vynkio que a gente avisa aqui.',
  },
]

export function AccountSettingsPage() {
  const { session } = useSession()
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignOutEverywhere() {
    if (!window.confirm('Sair do Vynkio em todos os aparelhos, inclusive neste?')) return
    setSigningOut(true)
    try {
      await signOutEverywhere()
    } catch (signOutError) {
      setError(errorMessage(signOutError))
      setSigningOut(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <Link to="/conta" className="inline-flex items-center gap-1 rounded text-sm font-semibold text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <ChevronLeft className="size-4" aria-hidden="true" /> Voltar ao perfil
      </Link>
      <PageHeader title="Configurações" description="Acesso, preferências e privacidade da sua conta." />

      <SettingsCard icon={<Mail className="size-5" aria-hidden="true" />} title="E-mail" description="É com ele que você entra no Vynkio.">
        <p className="rounded-xl bg-surface-2 px-4 py-3 text-[15px] font-semibold text-zinc-100">{session?.user.email ?? '–'}</p>
      </SettingsCard>

      <SettingsCard icon={<KeyRound className="size-5" aria-hidden="true" />} title="Senha" description="Use pelo menos 8 caracteres, com letras e números.">
        <PasswordForm />
      </SettingsCard>

      <SettingsCard icon={<LogOut className="size-5" aria-hidden="true" />} title="Aparelhos conectados" description="Esqueceu a conta aberta em outro lugar? Saia de todos de uma vez.">
        {error && (
          <div className="mb-4">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        <Button variant="secondary" loading={signingOut} onClick={() => void handleSignOutEverywhere()}>
          Sair de todos os aparelhos
        </Button>
      </SettingsCard>

      <SettingsCard icon={<Smartphone className="size-5" aria-hidden="true" />} title="App no celular" description="Instale o Vynkio e abra direto pelo ícone, sem procurar no navegador.">
        <InstallApp />
      </SettingsCard>

      <SettingsCard icon={<BellRing className="size-5" aria-hidden="true" />} title="Notificações" description="Avisos na tela deste aparelho, mesmo com o Vynkio fechado.">
        <PushSettings options={GENERATION_OPTIONS} />
      </SettingsCard>

      <SettingsCard icon={<Target className="size-5" aria-hidden="true" />} title="Preferências" description="O que você mais quer criar no Vynkio.">
        <GoalSelect />
      </SettingsCard>

      <SettingsCard icon={<Download className="size-5" aria-hidden="true" />} title="Seus dados" description="Uma cópia de tudo o que guardamos sobre você, em JSON.">
        <ExportData />
      </SettingsCard>

      <SettingsCard icon={<Trash2 className="size-5" aria-hidden="true" />} title="Excluir conta" description="Remove a conta e tudo o que está nela.">
        <DeleteAccount />
      </SettingsCard>
    </div>
  )
}
