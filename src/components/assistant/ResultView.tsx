import { Check, Clapperboard, Copy, ImageIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Notice } from '@/components/ui/Notice'
import { briefFromIdea, toolInfo } from '@/domain/assistant'
import type { AssistantOutput, TextGeneration } from '@/domain/types'
import { contextParams } from '@/domain/workspace'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'

const ACTION =
  'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

/** O texto inteiro, para copiar de uma vez. */
function fullText(output: AssistantOutput): string {
  return output.items.map((item) => (item.label ? `${item.label}\n${item.text}` : item.text)).join('\n\n')
}

const contextQuery = (generation: TextGeneration) =>
  contextParams({ brandId: generation.brand_id, projectId: generation.project_id })

function studioLink(generation: TextGeneration, visualPrompt: string): string {
  const params = contextQuery(generation)
  params.set('modo', 'imagem')
  params.set('prompt', visualPrompt.slice(0, 2000))
  return `/estudio?${params.toString()}`
}

function scriptLink(generation: TextGeneration, label: string, text: string): string {
  const params = contextQuery(generation)
  params.set('briefing', briefFromIdea(label, text))
  return `/assistente/roteiro?${params.toString()}`
}

export function ResultView({ generation }: { readonly generation: TextGeneration }) {
  const { copied, failed, copy } = useCopyToClipboard()
  const output = generation.output_text

  if (generation.status === 'failed') return <Notice tone="error">{generation.error ?? 'Esse pedido falhou e o crédito voltou.'}</Notice>
  if (!output) return <Notice tone="error">Não deu para ler esse resultado.</Notice>

  const info = toolInfo(generation.model_slug)
  return (
    <section aria-labelledby={`result-${generation.id}`} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id={`result-${generation.id}`} className="font-headline text-xl text-zinc-50">
          {output.title}
        </h2>
        <button type="button" className={ACTION} onClick={() => void copy('all', fullText(output))}>
          {copied === 'all' ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
          {copied === 'all' ? 'Copiado' : 'Copiar tudo'}
        </button>
      </div>
      {failed && <Notice tone="error">O navegador não deixou copiar. Selecione o texto e copie à mão.</Notice>}

      <ol className="space-y-2.5">
        {output.items.map((item, index) => {
          const key = `${generation.id}-${index}`
          return (
            <li key={key} className="rounded-2xl bg-surface p-4 ring-1 ring-white/[0.06]">
              {item.label && <p className="text-xs font-bold uppercase tracking-wide text-accent-soft">{item.label}</p>}
              <p className="mt-1.5 whitespace-pre-line text-[15px] leading-relaxed text-zinc-200">{item.text}</p>
              {info.scenes && item.visual_prompt && (
                <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-xs leading-relaxed text-zinc-400">
                  <span className="font-semibold text-zinc-300">Cena: </span>
                  {item.visual_prompt}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                <button type="button" className={ACTION} onClick={() => void copy(key, item.text)}>
                  {copied === key ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                  {copied === key ? 'Copiado' : 'Copiar'}
                </button>
                {info.scenes && item.visual_prompt && (
                  <Link to={studioLink(generation, item.visual_prompt)} className={ACTION}>
                    <ImageIcon className="size-3.5" aria-hidden="true" />
                    Criar a cena no Studio
                  </Link>
                )}
                {generation.model_slug === 'ideias' && (
                  <Link to={scriptLink(generation, item.label, item.text)} className={ACTION}>
                    <Clapperboard className="size-3.5" aria-hidden="true" />
                    Transformar em roteiro
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
