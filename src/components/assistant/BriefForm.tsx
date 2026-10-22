import clsx from 'clsx'
import { Coins, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { TextArea, TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import {
  CHANNEL_LABELS,
  CHANNELS,
  CONTENT_GOAL_LABELS,
  CONTENT_GOALS,
  COPY_FORMAT_LABELS,
  COPY_FORMATS,
  FORMATS_ON_EXISTING_TEXT,
  TEXT_LENGTH_LABELS,
  TEXT_LENGTHS,
  type AssistantToolInfo,
} from '@/domain/assistant'
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

/** Grupo de pílulas de escolha única. `null` como valor é "deixar a IA decidir". */
function Pills<T extends string>({
  legend,
  name,
  options,
  labels,
  value,
  onChange,
  emptyLabel,
}: {
  readonly legend: string
  readonly name: string
  readonly options: readonly T[]
  readonly labels: Record<T, string>
  readonly value: T | null
  readonly onChange: (value: T | null) => void
  readonly emptyLabel?: string
}) {
  const choices: readonly (T | null)[] = emptyLabel ? [null, ...options] : options
  return (
    <fieldset>
      <legend className="mb-2 text-[13px] font-semibold text-zinc-300">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {choices.map((choice) => {
          const checked = value === choice
          return (
            <label key={choice ?? 'auto'} className="cursor-pointer">
              <input type="radio" name={name} checked={checked} onChange={() => onChange(choice)} className="peer sr-only" />
              <span
                className={clsx(
                  'inline-flex min-h-9 items-center rounded-full px-3.5 text-sm ring-1 transition-colors',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-accent',
                  checked ? 'bg-accent/15 text-accent-soft ring-accent/50' : 'bg-surface-2 text-zinc-400 ring-white/[0.08] hover:text-zinc-100',
                )}
              >
                {choice === null ? emptyLabel : labels[choice]}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export function BriefForm({ info, assistant, credits, brands, projects, onSubmit }: BriefFormProps) {
  const onExistingText = info.formats && FORMATS_ON_EXISTING_TEXT.includes(assistant.format)
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

      {info.formats && (
        <Pills
          legend="Tipo de texto"
          name="format"
          options={COPY_FORMATS}
          labels={COPY_FORMAT_LABELS}
          value={assistant.format}
          onChange={(value) => value && assistant.setFormat(value)}
        />
      )}

      <Pills
        legend="Onde vai publicar"
        name="channel"
        options={CHANNELS}
        labels={CHANNEL_LABELS}
        value={assistant.channel}
        onChange={(value) => value && assistant.setChannel(value)}
      />

      <details className="group rounded-2xl bg-surface-2/60 ring-1 ring-white/[0.05] open:pb-4">
        <summary className="cursor-pointer list-none rounded-2xl px-4 py-3 text-sm font-semibold text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          Ajustes finos <span className="font-normal text-zinc-500">(objetivo, tamanho e tom)</span>
        </summary>
        <div className="space-y-4 px-4">
          <Pills
            legend="Objetivo"
            name="goal"
            options={CONTENT_GOALS}
            labels={CONTENT_GOAL_LABELS}
            value={assistant.goal}
            onChange={assistant.setGoal}
            emptyLabel="A IA decide"
          />
          <Pills
            legend="Tamanho"
            name="length"
            options={TEXT_LENGTHS}
            labels={TEXT_LENGTH_LABELS}
            value={assistant.length}
            onChange={assistant.setLength}
            emptyLabel="A IA decide"
          />
          <TextField
            label="Tom só para este pedido"
            hint="Vence o tom salvo na marca. Deixe vazio para usar o da marca."
            maxLength={80}
            placeholder="Ex.: mais sério, com humor"
            value={assistant.tone}
            onChange={(event) => assistant.setTone(event.target.value)}
          />
        </div>
      </details>

      <TextArea
        label={onExistingText ? 'Texto' : 'Briefing'}
        hint={
          onExistingText
            ? 'Cole o texto que você quer adaptar, revisar ou analisar.'
            : 'Diga o assunto, o objetivo e qualquer detalhe que não pode faltar.'
        }
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
