import { CalendarPlus, Check, Clapperboard, Copy, ImageIcon, PenLine, Pencil, Save } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { briefFromIdea, planDay, toolInfo } from '@/domain/assistant'
import { addDays, toIsoDate, type ContentFormat, type NewContent } from '@/domain/content'
import type { AssistantOutput, AssistantTool, TextGeneration } from '@/domain/types'
import { contextParams } from '@/domain/workspace'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { createContentItem, errorMessage } from '@/lib/api'

const ACTION =
  'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50'

type Item = AssistantOutput['items'][number]

/** O texto inteiro, para copiar ou levar adiante de uma vez. */
function fullText(items: readonly Item[]): string {
  return items.map((item) => (item.label ? `${item.label}\n${item.text}` : item.text)).join('\n\n')
}

const contextQuery = (generation: TextGeneration) => contextParams({ brandId: generation.brand_id, projectId: generation.project_id })

function studioLink(generation: TextGeneration, visualPrompt: string): string {
  const params = contextQuery(generation)
  params.set('modo', 'imagem')
  params.set('prompt', visualPrompt.slice(0, 2000))
  return `/estudio?${params.toString()}`
}

function toolLink(generation: TextGeneration, path: string, brief: string, extra: Record<string, string> = {}): string {
  const params = contextQuery(generation)
  params.set('briefing', brief.slice(0, 2000))
  for (const [key, value] of Object.entries(extra)) params.set(key, value)
  return `/assistente/${path}?${params.toString()}`
}

/** Formato do conteúdo a partir do rótulo do planejamento ("Dia 2, Carrossel"). */
function formatFromLabel(label: string): ContentFormat {
  const text = label.toLowerCase()
  if (text.includes('carrossel')) return 'carrossel'
  if (text.includes('stor')) return 'story'
  if (text.includes('short')) return 'shorts'
  if (text.includes('reels')) return 'reels'
  if (text.includes('vídeo') || text.includes('video')) return 'video'
  return 'post'
}

/** Como cada ferramenta vira conteúdo: roteiro vai no campo de roteiro, copy no de copy. */
function contentFrom(generation: TextGeneration, tool: AssistantTool, title: string, text: string, planned: string | null): NewContent {
  const isScript = tool === 'roteiro' || tool === 'ugc-roteiro'
  return {
    title: title.slice(0, 120) || 'Conteúdo do Vynkio AI',
    channel: null,
    format: tool === 'planejamento' ? formatFromLabel(title) : isScript ? 'reels' : 'post',
    status: planned ? 'planned' : 'idea',
    planned_for: planned,
    brand_id: generation.brand_id,
    project_id: generation.project_id,
    script: isScript ? text.slice(0, 10000) : '',
    copy: tool === 'copy' ? text.slice(0, 5000) : '',
    notes: tool === 'ideias' || tool === 'planejamento' ? text.slice(0, 2000) : '',
    asset_ids: [],
    source_generation_id: generation.id,
  }
}

export function ResultView({ generation }: { readonly generation: TextGeneration }) {
  const { copied, failed, copy } = useCopyToClipboard()
  const output = generation.output_text
  // Edição local: o original fica no histórico; o editado é o que se copia, transforma e salva.
  const [edited, setEdited] = useState<readonly Item[]>(() => output?.items ?? [])
  const [editing, setEditing] = useState<number | null>(null)
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set())
  const [saving, setSaving] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  if (generation.status === 'failed') return <Notice tone="error">{generation.error ?? 'Esse pedido falhou e o crédito voltou.'}</Notice>
  if (!output) return <Notice tone="error">Não deu para ler esse resultado.</Notice>

  const tool = generation.model_slug
  const info = toolInfo(tool)
  const isScript = tool === 'roteiro' || tool === 'ugc-roteiro'
  const tomorrow = addDays(toIsoDate(new Date()), 1)

  async function save(key: string, contents: readonly NewContent[]) {
    setSaving(key)
    setSaveError(null)
    try {
      for (const content of contents) await createContentItem(content)
      setSaved((current) => new Set(current).add(key))
    } catch (error) {
      setSaveError(errorMessage(error))
    } finally {
      setSaving(null)
    }
  }

  const updateText = (index: number, text: string) => setEdited((items) => items.map((item, position) => (position === index ? { ...item, text } : item)))

  // Roteiro e plano são uma peça só; ideias e copys são opções separadas.
  const wholeKey = 'all'
  const wholeContents: NewContent[] =
    tool === 'planejamento'
      ? edited.map((item, index) => contentFrom(generation, tool, item.label, item.text, addDays(tomorrow, planDay(item.label, index) - 1)))
      : [contentFrom(generation, tool, output.title, fullText(edited), null)]

  return (
    <section aria-labelledby={`result-${generation.id}`} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`result-${generation.id}`} className="font-headline text-xl text-zinc-50">
          {output.title}
        </h2>
        <div className="flex flex-wrap gap-1">
          <button type="button" className={ACTION} onClick={() => void copy('all', fullText(edited))}>
            {copied === 'all' ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
            {copied === 'all' ? 'Copiado' : 'Copiar tudo'}
          </button>
          {isScript && (
            <Link to={toolLink(generation, 'copy', `Legenda para este vídeo:\n\n${fullText(edited)}`, { tipo: 'legenda' })} className={ACTION}>
              <PenLine className="size-3.5" aria-hidden="true" />
              Escrever a legenda
            </Link>
          )}
          {(isScript || tool === 'planejamento') && (
            <Button
              variant="ghost"
              className="min-h-9 px-2.5 text-xs"
              loading={saving === wholeKey}
              disabled={saved.has(wholeKey)}
              onClick={() => void save(wholeKey, wholeContents)}
            >
              {saved.has(wholeKey) ? <Check className="size-3.5" aria-hidden="true" /> : tool === 'planejamento' ? <CalendarPlus className="size-3.5" aria-hidden="true" /> : <Save className="size-3.5" aria-hidden="true" />}
              {saved.has(wholeKey) ? 'Salvo em Conteúdos' : tool === 'planejamento' ? 'Pôr no calendário a partir de amanhã' : 'Salvar em Conteúdos'}
            </Button>
          )}
        </div>
      </div>
      {failed && <Notice tone="error">O navegador não deixou copiar. Selecione o texto e copie à mão.</Notice>}
      {saveError && <Notice tone="error">{saveError}</Notice>}
      {saved.size > 0 && (
        <Notice>
          Salvo.{' '}
          <Link to={tool === 'planejamento' ? '/conteudo?visao=calendario' : '/conteudo'} className="font-semibold text-accent-soft underline-offset-2 hover:underline">
            Abrir em Conteúdos
          </Link>
        </Notice>
      )}

      <ol className="space-y-2.5">
        {edited.map((item, index) => {
          const key = `${generation.id}-${index}`
          return (
            <li key={key} className="rounded-2xl bg-surface p-4 ring-1 ring-white/[0.06]">
              {item.label && <p className="text-xs font-bold uppercase tracking-wide text-accent-soft">{item.label}</p>}
              {editing === index ? (
                <label className="mt-1.5 block">
                  <span className="sr-only">Editar {item.label || `item ${index + 1}`}</span>
                  <textarea
                    value={item.text}
                    maxLength={3000}
                    rows={Math.min(12, Math.max(3, item.text.split('\n').length + 1))}
                    onChange={(event) => updateText(index, event.target.value)}
                    className="w-full resize-y rounded-xl border border-white/[0.08] bg-surface-2 px-3 py-2 text-[15px] leading-relaxed text-zinc-100 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </label>
              ) : (
                <p className="mt-1.5 whitespace-pre-line text-[15px] leading-relaxed text-zinc-200">{item.text}</p>
              )}
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
                <button type="button" className={ACTION} aria-pressed={editing === index} onClick={() => setEditing(editing === index ? null : index)}>
                  {editing === index ? <Check className="size-3.5" aria-hidden="true" /> : <Pencil className="size-3.5" aria-hidden="true" />}
                  {editing === index ? 'Pronto' : 'Editar'}
                </button>
                {info.scenes && item.visual_prompt && (
                  <Link to={studioLink(generation, item.visual_prompt)} className={ACTION}>
                    <ImageIcon className="size-3.5" aria-hidden="true" />
                    Criar a cena no Studio
                  </Link>
                )}
                {(tool === 'ideias' || tool === 'planejamento') && (
                  <>
                    <Link to={toolLink(generation, 'roteiro', briefFromIdea(item.label, item.text))} className={ACTION}>
                      <Clapperboard className="size-3.5" aria-hidden="true" />
                      Virar roteiro
                    </Link>
                    <Link to={toolLink(generation, 'copy', briefFromIdea(item.label, item.text), { tipo: 'legenda' })} className={ACTION}>
                      <PenLine className="size-3.5" aria-hidden="true" />
                      Virar legenda
                    </Link>
                  </>
                )}
                {!isScript && (
                  <button
                    type="button"
                    className={ACTION}
                    disabled={saving === key || saved.has(key)}
                    onClick={() =>
                      void save(key, [
                        contentFrom(
                          generation,
                          tool,
                          tool === 'copy' ? `${output.title}: ${item.label}` : item.label,
                          item.text,
                          tool === 'planejamento' ? addDays(tomorrow, planDay(item.label, index) - 1) : null,
                        ),
                      ])
                    }
                  >
                    {saved.has(key) ? <Check className="size-3.5" aria-hidden="true" /> : <Save className="size-3.5" aria-hidden="true" />}
                    {saved.has(key) ? 'Salvo' : 'Salvar em Conteúdos'}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
