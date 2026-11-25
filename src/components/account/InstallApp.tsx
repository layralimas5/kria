import { CheckCircle2, Download } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { useInstallApp } from '@/hooks/useInstallApp'

/** Botão "Instalar o app" quando o navegador deixa; senão, o passo a passo do aparelho. */
export function InstallApp() {
  const app = useInstallApp()
  const [declined, setDeclined] = useState(false)

  if (app.installed) {
    return (
      <p className="flex items-center gap-2 text-sm font-semibold text-accent-soft">
        <CheckCircle2 className="size-4" aria-hidden="true" /> Você está usando o app instalado.
      </p>
    )
  }

  if (app.canPrompt) {
    return (
      <div className="space-y-3">
        <Button onClick={() => void app.install().then((accepted) => setDeclined(!accepted))}>
          <Download className="size-4" aria-hidden="true" /> Instalar o app
        </Button>
        {declined && <p className="text-sm text-zinc-400">Sem problema. O botão fica aqui se mudar de ideia.</p>}
      </div>
    )
  }

  if (app.platform === 'ios') {
    return (
      <Notice>
        No Safari, toque em <strong>Compartilhar</strong> (o quadrado com a seta) e depois em <strong>Adicionar à Tela de Início</strong>.
      </Notice>
    )
  }

  if (app.platform === 'android') {
    return (
      <Notice>
        No Chrome, abra o menu <strong>⋮</strong> e toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.
      </Notice>
    )
  }

  return (
    <Notice>
      No Chrome ou no Edge, clique no ícone de instalar no fim da barra de endereço, ou abra o menu e escolha <strong>Instalar Vynkio</strong>.
    </Notice>
  )
}
