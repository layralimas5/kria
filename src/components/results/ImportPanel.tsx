import { Download, FileUp } from 'lucide-react'
import { useId, useState, type ChangeEvent } from 'react'
import { ContextSelect } from '@/components/assistant/ContextSelect'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import {
  ANALYTICS_PLATFORMS,
  CSV_TEMPLATE,
  MAX_FILE_BYTES,
  METRIC_LABELS,
  parseAnalyticsCsv,
  PLATFORM_LABELS,
  type AnalyticsPlatform,
  type ParseResult,
} from '@/domain/analytics'
import type { Brand } from '@/domain/types'
import { errorMessage, importAnalytics } from '@/lib/api'

const SELECT =
  'min-h-11 w-full rounded-xl border border-white/[0.08] bg-surface-2 px-3 text-[15px] text-zinc-100 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20'

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([`﻿${CSV_TEMPLATE}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'modelo-metricas-vynkio.csv'
  link.click()
  URL.revokeObjectURL(url)
}

interface ImportPanelProps {
  readonly brands: readonly Brand[]
  readonly defaultBrandId: string | null
  readonly onImported: () => Promise<void>
}

/** Importação manual: a pessoa exporta da rede, confere a prévia e só então grava. */
export function ImportPanel({ brands, defaultBrandId, onImported }: ImportPanelProps) {
  const fileId = useId()
  const platformId = useId()
  const [platform, setPlatform] = useState<AnalyticsPlatform>('instagram')
  const [brandId, setBrandId] = useState<string | null>(defaultBrandId)
  const [file, setFile] = useState<{ readonly name: string; readonly result: ParseResult } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0]
    event.target.value = ''
    setError(null)
    setDone(null)
    if (!chosen) return
    if (!chosen.name.toLowerCase().endsWith('.csv')) {
      setFile(null)
      setError('Envie um arquivo .csv. No Excel ou Planilhas, use "Salvar como CSV".')
      return
    }
    if (chosen.size > MAX_FILE_BYTES) {
      setFile(null)
      setError('O arquivo passa de 2 MB. Divida em partes menores.')
      return
    }
    setFile({ name: chosen.name, result: parseAnalyticsCsv(await chosen.text()) })
  }

  async function confirm() {
    if (!file || file.result.rows.length === 0) return
    setSaving(true)
    setError(null)
    try {
      await importAnalytics(platform, brandId, file.name, file.result.rows)
      setDone(`${file.result.rows.length} linhas de ${file.name} importadas.`)
      setFile(null)
      await onImported()
    } catch (importError) {
      setError(errorMessage(importError))
    } finally {
      setSaving(false)
    }
  }

  const rows = file?.result.rows ?? []
  const dates = rows.map((row) => row.metric_date).sort()

  return (
    <section aria-labelledby="importar-title" className="space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06] md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="importar-title" className="font-headline text-xl text-zinc-50">
            Importar métricas
          </h2>
          <p className="mt-1 max-w-xl text-sm text-zinc-400">
            Exporte o relatório da própria rede (ou preencha o modelo) e envie o CSV. Cada número fica marcado com o arquivo e a data da importação.
          </p>
        </div>
        <Button variant="ghost" className="shrink-0 text-sm" onClick={downloadTemplate}>
          <Download className="size-4" aria-hidden="true" />
          Baixar modelo
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block" htmlFor={platformId}>
          <span className="mb-1.5 block text-[13px] font-semibold text-zinc-300">Rede</span>
          <select
            id={platformId}
            value={platform}
            onChange={(event) => setPlatform(ANALYTICS_PLATFORMS.find((item) => item === event.target.value) ?? 'instagram')}
            className={SELECT}
          >
            {ANALYTICS_PLATFORMS.map((item) => (
              <option key={item} value={item}>
                {PLATFORM_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <ContextSelect
          label="Marca"
          emptyLabel="Sem marca"
          value={brandId}
          onChange={setBrandId}
          options={brands.map((brand) => ({ id: brand.id, label: brand.name }))}
        />
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-zinc-300">Arquivo</span>
          <label
            htmlFor={fileId}
            className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 px-3 text-sm font-semibold text-zinc-300 hover:border-accent/60 hover:text-accent-soft focus-within:ring-2 focus-within:ring-accent"
          >
            <FileUp className="size-4" aria-hidden="true" />
            {file ? file.name : 'Escolher CSV'}
            <input id={fileId} type="file" accept=".csv,text/csv" onChange={(event) => void pick(event)} className="sr-only" />
          </label>
        </div>
      </div>

      {file && file.result.errors.length > 0 && (
        <Notice tone="error">
          <p className="font-semibold">Corrija o arquivo e envie de novo. Nada foi importado.</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            {file.result.errors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Notice>
      )}

      {rows.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-300">
            <span className="font-semibold text-zinc-50">{rows.length} linhas</span> de {dates[0]} a {dates.at(-1)}. Métricas no arquivo:{' '}
            {file?.result.metrics.map((metric) => METRIC_LABELS[metric]).join(', ')}.
          </p>
          <Button loading={saving} onClick={() => void confirm()} className="shrink-0">
            Importar para {PLATFORM_LABELS[platform]}
          </Button>
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}
      {done && <Notice tone="success">{done}</Notice>}
    </section>
  )
}
