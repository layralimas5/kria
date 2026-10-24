import type { ReactNode } from 'react'
import { AuditTab } from '@/components/admin/AuditTab'
import { ModelsTab } from '@/components/admin/ModelsTab'
import { PlansTab } from '@/components/admin/PlansTab'
import { UsersTab } from '@/components/admin/UsersTab'

function SectionPage({ title, description, children }: { readonly title: string; readonly description: string; readonly children: ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-3xl text-zinc-50 md:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-zinc-400">{description}</p>
      </div>
      {children}
    </div>
  )
}

export function AdminUsersPage() {
  return (
    <SectionPage title="Usuários" description="Busca por e-mail, @ ou nome. Ajuste de crédito e suspensão pedem motivo e vão para a auditoria.">
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
    <SectionPage title="Modelos e custos" description="Preço em créditos, custo real no fornecedor e planos liberados por modelo. Vale para as próximas gerações, sem deploy.">
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
