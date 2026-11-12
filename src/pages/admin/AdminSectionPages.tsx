import type { ReactNode } from 'react'
import { AuditTab } from '@/components/admin/AuditTab'
import { ModelsTab } from '@/components/admin/ModelsTab'
import { PlansTab } from '@/components/admin/PlansTab'
import { AddUserButton, UsersTab } from '@/components/admin/UsersTab'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'

interface SectionPageProps {
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly action?: ReactNode
  readonly children: ReactNode
}

function SectionPage({ eyebrow, title, description, action, children }: SectionPageProps) {
  return (
    <div className="space-y-6">
      <AdminPageHeader eyebrow={eyebrow} title={title} description={description} actions={action} />
      {children}
    </div>
  )
}

export function AdminUsersPage() {
  return (
    <SectionPage
      eyebrow="Operação"
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
    <SectionPage eyebrow="Comercial" title="Planos" description="Mudar preço ou créditos cria uma versão nova do plano. Assinaturas existentes guardam o valor contratado.">
      <PlansTab />
    </SectionPage>
  )
}

export function AdminModelsPage() {
  return (
    <SectionPage
      eyebrow="Operação"
      title="Modelos e custos"
      description="Quanto cada IA custa de verdade, quanto o Vynkio cobra em créditos e o que sobra. Custo medido ou estimado aparece sempre identificado."
    >
      <ModelsTab />
    </SectionPage>
  )
}

export function AdminAuditPage() {
  return (
    <SectionPage eyebrow="Sistema" title="Auditoria" description="As 100 ações mais recentes da operação. O registro não se edita nem se apaga.">
      <AuditTab />
    </SectionPage>
  )
}
