import clsx from 'clsx'
import { toolInfo } from '@/domain/assistant'
import { formatDateTime } from '@/domain/format'
import type { TextGeneration } from '@/domain/types'

interface TextHistoryProps {
  readonly items: readonly TextGeneration[]
  readonly selectedId: string | null
  readonly onSelect: (generation: TextGeneration) => void
}

export function TextHistory({ items, selectedId, onSelect }: TextHistoryProps) {
  if (items.length === 0) return <p className="text-sm text-zinc-500">O que você gerar aparece aqui.</p>
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onSelect(item)}
            aria-current={item.id === selectedId || undefined}
            className={clsx(
              'w-full rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              item.id === selectedId ? 'bg-accent/10 ring-1 ring-accent/40' : 'hover:bg-white/[0.04]',
            )}
          >
            <span className="block truncate text-sm text-zinc-200">{item.output_text?.title ?? item.prompt}</span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              {toolInfo(item.model_slug).label} · {formatDateTime(item.created_at)}
              {item.status === 'failed' && ' · falhou'}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
