import type { Command, GoShortcut } from '@/domain/commands'
import type { MediaKind, Plan } from '@/domain/types'
import { EMPTY_USER_FILTERS, displayName } from '@/domain/adminUsers'
import { fetchUsersPage } from '@/lib/adminApi'
import { adminNavFor } from '../admin/adminNav'
import { navGroupsFor } from '../layout/nav'

/** Palavras que a pessoa costuma digitar e não estão no nome da tela. */
const KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  '/inicio': ['inicio', 'home', 'painel'],
  '/estudio?modo=imagem': ['foto', 'gerar', 'criar', 'estudio'],
  '/estudio?modo=video': ['gerar', 'criar', 'kling', 'animar', 'estudio'],
  '/personas': ['persona', 'rosto', 'influenciador', 'avatar'],
  '/galeria': ['criacoes', 'arquivos', 'download', 'historico'],
  '/creditos': ['saldo', 'consumo', 'comprar', 'pacote'],
  '/assinatura': ['plano', 'cancelar', 'upgrade', 'pagamento'],
  '/suporte': ['ajuda', 'whatsapp', 'email', 'contato'],
  '/conta/configuracoes': ['perfil', 'senha', 'conta', 'excluir'],
  '/admin': ['central de comando', 'inicio', 'kpi', 'visao geral', 'mrr'],
  '/admin/financeiro': ['receita', 'lucro', 'pagamento', 'despesa', 'margem', 'asaas'],
  '/admin/usuarios': ['clientes', 'contas', 'convite'],
  '/admin/planos': ['precos', 'suporte', 'whatsapp', 'checkout'],
  '/admin/modelos': ['custo', 'tarifa', 'fal', 'anthropic'],
  '/admin/assinaturas': ['assinantes', 'churn', 'atraso'],
  '/admin/auditoria': ['log', 'historico', 'quem fez'],
}

export const APP_GO_SHORTCUTS: readonly GoShortcut[] = [
  { key: 'i', to: '/inicio', label: 'Dashboard' },
  { key: 'e', to: '/estudio?modo=imagem', label: 'Estúdio de imagens' },
  { key: 'v', to: '/estudio?modo=video', label: 'Estúdio de vídeos' },
  { key: 'p', to: '/personas', label: 'Personagens' },
  { key: 'b', to: '/galeria', label: 'Biblioteca' },
  { key: 'c', to: '/creditos', label: 'Créditos e consumo' },
  { key: 's', to: '/suporte', label: 'Suporte' },
]

export const ADMIN_GO_SHORTCUTS: readonly GoShortcut[] = [
  { key: 'a', to: '/admin', label: 'Dashboard' },
  { key: 'u', to: '/admin/usuarios', label: 'Usuários' },
  { key: 'f', to: '/admin/financeiro', label: 'Financeiro' },
  { key: 'p', to: '/admin/planos', label: 'Planos' },
  { key: 'm', to: '/admin/modelos', label: 'Modelos e custos' },
  { key: 'g', to: '/admin/geracoes', label: 'Gerações' },
]

const shortcutLabel = (to: string, shortcuts: readonly GoShortcut[]) => {
  const found = shortcuts.find((item) => item.to === to)
  return found ? `G ${found.key.toUpperCase()}` : undefined
}

interface AppActions {
  readonly toggleSidebar: () => void
  readonly signOut: () => void
}

/** Comandos do app: o menu do plano em vigor e as ações do dia a dia. */
export function appCommands(plan: Plan | null, kinds: readonly MediaKind[] | null, actions: AppActions): Command[] {
  const nav = navGroupsFor(plan, kinds).flatMap((group) =>
    group.items
      .filter((item) => !item.soon)
      .map<Command>((item) => ({
        id: `nav:${item.to}`,
        label: item.label,
        group: 'Ir para',
        section: group.title,
        to: item.to,
        keywords: KEYWORDS[item.to],
        shortcut: shortcutLabel(item.to, APP_GO_SHORTCUTS),
      })),
  )
  return [
    ...nav,
    { id: 'act:image', label: 'Criar uma imagem', group: 'Ações', to: '/estudio?modo=imagem', keywords: ['foto', 'gerar'] },
    ...(kinds?.includes('video') ? [{ id: 'act:video', label: 'Criar um vídeo', group: 'Ações' as const, to: '/estudio?modo=video', keywords: ['animar', 'gerar'] }] : []),
    { id: 'act:persona', label: 'Criar um personagem', group: 'Ações', to: '/personas', keywords: ['persona', 'rosto'] },
    { id: 'act:buy', label: 'Comprar créditos', group: 'Ações', to: '/creditos', keywords: ['saldo', 'pacote', 'pix'] },
    { id: 'act:plans', label: 'Ver planos e fazer upgrade', group: 'Ações', to: '/assinatura', keywords: ['assinar', 'plano'] },
    { id: 'act:support', label: 'Falar com o suporte', group: 'Ações', to: '/suporte', keywords: ['ajuda', 'whatsapp'] },
    { id: 'act:sidebar', label: 'Recolher ou abrir o menu lateral', group: 'Ações', run: actions.toggleSidebar, keywords: ['sidebar', 'menu'] },
    { id: 'act:signout', label: 'Sair da conta', group: 'Ações', run: actions.signOut, keywords: ['logout', 'deslogar'] },
  ]
}

/** Comandos do admin: só as telas que a permissão libera. */
export function adminCommands(can: (permission: string) => boolean, actions: AppActions): Command[] {
  const nav = adminNavFor(can).flatMap((group) =>
    group.items.flatMap<Command>((item) =>
      item.to
        ? [
            {
              id: `admin:${item.to}`,
              label: item.label,
              group: 'Ir para',
              section: group.label,
              to: item.to,
              keywords: KEYWORDS[item.to.split('?')[0] ?? item.to],
              shortcut: shortcutLabel(item.to, ADMIN_GO_SHORTCUTS),
            },
          ]
        : [],
    ),
  )
  return [
    ...nav,
    ...(can('finance.view')
      ? [
          { id: 'act:finance-export', label: 'Exportar movimentações do mês', group: 'Ações' as const, to: '/admin/financeiro?periodo=month', keywords: ['csv', 'excel', 'relatorio'] },
          { id: 'act:expense', label: 'Lançar despesa', group: 'Ações' as const, to: '/admin#financeiro', keywords: ['custo', 'gasto', 'supabase'] },
        ]
      : []),
    ...(can('users.manage') ? [{ id: 'act:invite', label: 'Convidar usuário', group: 'Ações' as const, to: '/admin/usuarios?novo=1', keywords: ['criar conta', 'convite'] }] : []),
    { id: 'act:app', label: 'Voltar ao app', group: 'Ações', to: '/inicio', keywords: ['sair do admin'] },
    { id: 'act:sidebar', label: 'Recolher ou abrir o menu lateral', group: 'Ações', run: actions.toggleSidebar, keywords: ['sidebar', 'menu'] },
    { id: 'act:signout', label: 'Sair da conta', group: 'Ações', run: actions.signOut, keywords: ['logout'] },
  ]
}

/** Busca de cliente por e-mail ou nome, para quem vê usuários. */
export async function searchAdminUsers(query: string): Promise<Command[]> {
  // Página 0: a lista do admin conta as páginas a partir de zero.
  const page = await fetchUsersPage({ ...EMPTY_USER_FILTERS, query }, 0)
  return page.rows.slice(0, 8).map((user) => ({
    id: `user:${user.id}`,
    label: user.email ?? displayName(user),
    group: 'Clientes',
    section: `${user.plan_slug}${user.suspended_at ? ' · suspensa' : ''}`,
    to: `/admin/usuarios?usuario=${user.id}`,
  }))
}
