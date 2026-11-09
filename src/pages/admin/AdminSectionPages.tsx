import type { ReactNode } from 'react'
import { AuditTab } from '@/components/admin/AuditTab'
import { ModelsTab } from '@/components/admin/ModelsTab'
import { PlansTab } from '@/components/admin/PlansTab'
import { AddUserButton, UsersTab } from '@/components/admin/UsersTab'

interface SectionPageProps {
  readonly title: string
  readonly description: string
  readonly action?: ReactNode
  readonly children: ReactNode
}

function SectionPage({ title, description, action, children }: SectionPageProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-headline text-3xl text-zinc-50 md:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-zinc-400">{description}</p>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  )
}

export function AdminUsersPage() {
  return (
    <SectionPage
      title="Usuários"
      description="Filtros combinados, perfil completo e cadastro por convite. Toda ação sensível pede confirmação e motivo, e vai para a auditoria."
      action={<AddUserButton />}
    >
      <UsersTab />
    </SectionPage>
  )
}

export function AdminPlansPage() {
  return (
    <SectionPage title="Planos" description="Mudar preço ou créditos cria uma versão nova do plano. Assinaturas existentes guardam o valor contratado.">
      <PlansTab />
    </SectionPage>
  )
}

export function AdminModelsPage() {
  return (
    <SectionPage
      title="Modelos e custos"
      description="Quanto cada IA custa de verdade, quanto o Vynkio cobra em créditos e o que sobra. Custo medido ou estimado aparece sempre identificado."
    >
      <ModelsTab />
    </SectionPage>
  )
}

export function AdminAuditPage() {
  return (
    <SectionPage title="Auditoria" description="As 100 ações mais recentes da operação. O registro não se edita nem se apaga.">
      <AuditTab />
    </SectionPage>
  )
}
