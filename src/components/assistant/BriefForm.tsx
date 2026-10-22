import clsx from 'clsx'
import { Coins, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { TextArea } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { CHANNEL_LABELS, CHANNELS, type AssistantToolInfo } from '@/domain/assistant'
import type { Brand, Project } from '@/domain/types'
import { BRIEF_MAX, type Assistant } from '@/hooks/useAssistant'
import { ContextSelect } from './ContextSelect'

interface BriefFormProps {
  readonly info: AssistantToolInfo
  readonly assistant: Assistant
  readonly credits: number | null
  /** Nulo enquanto carrega: a dica de criar marca só aparece quando a lista vem vazia. */
  readonly brands: readonly Brand[] | null
  /** Nulo quando o plano não tem projetos: o seletor some. */
  readonly projects: readonly Project[] | null
  readonly onSubmit: () => void
}

export function BriefForm({ info, assistant, credits, brands, projects, onSubmit }: BriefFormProps) {
  return (
    <form
      className="space-y-5 rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06] md:p-6"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ContextSelect
          label="Marca"
          emptyLabel="Sem marca"
          value={assistant.brandId}
          onChange={assistant.setBrandId}
          options={(brands ?? []).map((brand) => ({ id: brand.id, label: brand.name }))}
        />
        {projects && (
          <ContextSelect
            label="Projeto"
            emptyLabel="Sem projeto"
            value={assistant.projectId}
            onChange={assistant.setProjectId}
            options={projects.map((project) => ({ id: project.id, label: project.name }))}
          />
        )}
      </div>
      {brands?.length === 0 && (
        <p className="text-xs text-zinc-500">
          Com uma marca cadastrada, o texto já sai no tom e para o público dela.{' '}
          <Link to="/marcas" className="font-semibold text-accent-soft underline-offset-2 hover:underline">
            Criar marca
          </Link>
        </p>
      )}

      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-zinc-300">Onde vai publicar</legend>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((channel) => (
            <label key={channel} className="cursor-pointer">
              <input
                type="radio"
                name="channel"
                value={channel}
                checked={assistant.channel === channel}
                onChange={() => assistant.setChannel(channel)}
                className="peer sr-only"
              />
              <span
                className={clsx(
                  'inline-flex min-h-9 items-center rounded-full px-3.5 text-sm ring-1 transition-colors',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-accent',
                  assistant.channel === channel
                    ? 'bg-accent/15 text-accent-soft ring-accent/50'
                    : 'bg-surface-2 text-zinc-400 ring-white/[0.08] hover:text-zinc-100',
                )}
              >
                {CHANNEL_LABELS[channel]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <TextArea
        label="Briefing"
        hint="Diga o assunto, o objetivo e qualquer detalhe que não pode faltar."
        value={assistant.brief}
        maxLength={BRIEF_MAX}
        rows={5}
        placeholder={info.placeholder}
        onChange={(event) => assistant.setBrief(event.target.value)}
      />

      {assistant.error && <Notice tone="error">{assistant.error}</Notice>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Coins className="size-3.5" aria-hidden="true" />
          {credits === null ? 'Fora do seu plano' : `${credits} créditos por pedido. Se falhar, o crédito volta.`}
        </p>
        <Button type="submit" loading={assistant.submitting} disabled={credits === null} className="sm:min-w-44">
          {!assistant.submitting && <Sparkles className="size-4" aria-hidden="true" />}
          {assistant.submitting ? 'Escrevendo...' : 'Gerar'}
        </Button>
      </div>
    </form>
  )
}
