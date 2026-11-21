import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { formatBRL } from '@/domain/format'
import type { StorePix } from '@/lib/api'

interface PixPanelProps {
  readonly pix: StorePix
  readonly totalCents: number
}

/** QR do Pix na própria página, com o copia e cola. A página pergunta o status sozinha. */
export function PixPanel({ pix, totalCents }: PixPanelProps) {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(pix.payload)
      setCopied(true)
      setCopyFailed(false)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopyFailed(true)
    }
  }

  return (
    <div className="space-y-5 text-center">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Pague com Pix</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Valor: <strong className="text-zinc-900">{formatBRL(totalCents)}</strong>
        </p>
      </div>
      <img
        src={`data:image/png;base64,${pix.qrBase64}`}
        alt="QR Code do Pix"
        width={220}
        height={220}
        className="mx-auto size-[220px] rounded-xl border border-zinc-200 bg-white p-2"
      />
      <ol className="mx-auto max-w-xs space-y-1 text-left text-[13px] text-zinc-600">
        <li>1. Abra o app do seu banco e escolha Pix.</li>
        <li>2. Leia o QR Code ou cole o código abaixo.</li>
        <li>3. Confirme. Esta página muda sozinha quando o pagamento cair.</li>
      </ol>
      <div className="space-y-2">
        <label htmlFor="pix-payload" className="sr-only">
          Código Pix copia e cola
        </label>
        <input
          id="pix-payload"
          readOnly
          value={pix.payload}
          onFocus={(event) => event.target.select()}
          className="w-full truncate rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 font-mono text-xs text-zinc-700"
        />
        <button
          type="button"
          onClick={() => void copy()}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-4 text-base font-bold text-white hover:bg-green-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-600/40"
        >
          {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copied ? 'Código copiado' : 'Copiar código Pix'}
        </button>
        {copyFailed && <p className="text-xs text-zinc-600">Não deu para copiar sozinho. Selecione o código acima e copie.</p>}
      </div>
      <p className="flex items-center justify-center gap-2 text-sm text-zinc-600" role="status">
        <Spinner className="size-4 text-violet-600" /> Esperando o pagamento
      </p>
    </div>
  )
}
