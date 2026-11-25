import { Send } from 'lucide-react'
import type { ReactNode } from 'react'
import type { PushTopic } from '@/domain/appDevice'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { Spinner } from '@/components/ui/Spinner'
import { Switch } from '@/components/ui/Switch'
import { usePushNotifications, type PushStatus } from '@/hooks/usePushNotifications'

export interface PushOption {
  readonly topic: PushTopic
  readonly label: string
  readonly description: string
}

const BLOCKED: Partial<Record<PushStatus, ReactNode>> = {
  demo: 'No modo demonstração as notificações ficam desligadas.',
  'needs-install': (
    <>
      No iPhone, o aviso só chega com o Vynkio instalado. No Safari, toque em <strong>Compartilhar</strong> e depois em{' '}
      <strong>Adicionar à Tela de Início</strong>. Abra o Vynkio pelo ícone novo e volte aqui.
    </>
  ),
  unsupported: 'Este navegador não recebe notificações. Abra o Vynkio no Chrome, Edge, Firefox ou Safari, ou instale o app.',
  'not-configured': 'As notificações ainda não foram ativadas no Vynkio. Volte em breve.',
  denied: 'As notificações estão bloqueadas para o Vynkio neste navegador. Libere nas permissões do site (ícone ao lado do endereço) e recarregue.',
}

/** Liga e desliga os avisos deste aparelho. Cada tela passa só os tópicos que fazem sentido para ela. */
export function PushSettings({ options }: { readonly options: readonly PushOption[] }) {
  const push = usePushNotifications()

  if (push.status === 'loading') {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-400" role="status">
        <Spinner /> Conferindo este aparelho…
      </div>
    )
  }

  const blocked = BLOCKED[push.status]
  if (blocked) return <Notice>{blocked}</Notice>

  return (
    <div className="space-y-5">
      {options.map((option) => (
        <Switch
          key={option.topic}
          checked={push.topics.includes(option.topic)}
          onChange={(on) => void push.setTopic(option.topic, on)}
          label={option.label}
          description={option.description}
          disabled={push.busy}
        />
      ))}
      <p className="text-xs text-zinc-500">Vale só para este aparelho. Ligue em cada celular ou computador em que quiser receber.</p>
      {push.error && <Notice tone="error">{push.error}</Notice>}
      {push.notice && <Notice tone="success">{push.notice}</Notice>}
      {push.topics.length > 0 && (
        <Button variant="secondary" loading={push.busy} onClick={() => void push.sendTest()}>
          <Send className="size-4" aria-hidden="true" /> Mandar um teste
        </Button>
      )}
    </div>
  )
}
