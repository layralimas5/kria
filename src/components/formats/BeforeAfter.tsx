import type { ReactNode } from 'react'
import { isOpen, type Generation } from '@/domain/types'
import { GenerationCard } from '../GenerationCard'

interface BeforeAfterProps {
  readonly beforeUrl: string
  readonly after: Generation | null
  readonly modelName: string
}

function Frame({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <figure className="min-w-0">
      {children}
      <figcaption className="mt-2 text-center text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</figcaption>
    </figure>
  )
}

/** As duas pontas da transição lado a lado, antes de gastar com o vídeo. */
export function BeforeAfter({ beforeUrl, after, modelName }: BeforeAfterProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Frame label="Antes">
        <img src={beforeUrl} alt="Foto original" className="aspect-[4/5] w-full rounded-xl object-cover ring-1 ring-white/[0.06]" />
      </Frame>
      <Frame label={after && isOpen(after) ? 'Depois (gerando)' : 'Depois'}>
        {after ? (
          <GenerationCard generation={after} modelName={modelName} />
        ) : (
          <div className="grid aspect-[4/5] place-items-center rounded-xl border border-dashed border-white/15 px-4 text-center text-xs text-zinc-500">
            A foto editada aparece aqui
          </div>
        )}
      </Frame>
    </div>
  )
}
