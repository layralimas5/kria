import { Download } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { downloadCsv, toCsv } from '@/domain/business'
import { brtDay } from '@/domain/adminDashboard'
import { EXPORT_HEADER, exportRows, SUMMARY_HEADER, summaryRows, type Explorer, type Movement } from '@/domain/financeExplorer'
import { useToast } from '@/hooks/useToast'
import { EXPORT_LIMIT } from '@/hooks/useFinanceExplorer'
import { errorMessage } from '@/lib/api'
import { downloadBlob } from '@/lib/render/download'

type Format = 'csv' | 'xlsx'

interface ExportButtonsProps {
  readonly data: Explorer
  readonly loadAll: () => Promise<{ rows: Movement[]; total: number; data: Explorer } | null>
  readonly planName: (slug: string | null) => string
}

/** Relatório do recorte inteiro (não só a página): CSV com as movimentações, Excel com resumo e movimentações. */
export function ExportButtons({ data, loadAll, planName }: ExportButtonsProps) {
  const notify = useToast()
  const [busy, setBusy] = useState<Format | null>(null)
  const [error, setError] = useState<string | null>(null)
  const name = `vynkio-financeiro-${brtDay(new Date(data.period.from))}-a-${brtDay(new Date(new Date(data.period.to).getTime() - 1))}`

  async function run(format: Format) {
    setBusy(format)
    setError(null)
    try {
      const all = await loadAll()
      if (!all) return
      const rows = exportRows(all.rows, planName)
      if (format === 'csv') {
        downloadCsv(`${name}.csv`, toCsv(EXPORT_HEADER, rows))
      } else {
        const { buildXlsx, XLSX_MIME } = await import('@/lib/xlsx')
        const file = buildXlsx([
          { name: 'Resumo', header: SUMMARY_HEADER, rows: summaryRows(all.data) },
          { name: 'Movimentações', header: EXPORT_HEADER, rows },
        ])
        downloadBlob(new Blob([new Uint8Array(file)], { type: XLSX_MIME }), `${name}.xlsx`)
      }
      notify(
        all.total > all.rows.length
          ? `Exportadas as primeiras ${all.rows.length.toLocaleString('pt-BR')} de ${all.total.toLocaleString('pt-BR')} linhas. Use um recorte menor para o resto.`
          : `${all.rows.length.toLocaleString('pt-BR')} movimentações exportadas.`,
      )
    } catch (exportError) {
      setError(errorMessage(exportError))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button variant="secondary" className="min-h-9" loading={busy === 'csv'} disabled={busy !== null} onClick={() => void run('csv')}>
          <Download className="size-4" aria-hidden="true" />
          CSV
        </Button>
        <Button variant="secondary" className="min-h-9" loading={busy === 'xlsx'} disabled={busy !== null} onClick={() => void run('xlsx')}>
          <Download className="size-4" aria-hidden="true" />
          Excel
        </Button>
      </div>
      {data.table.total > EXPORT_LIMIT && <p className="text-[11px] text-zinc-500">Exporta até {EXPORT_LIMIT.toLocaleString('pt-BR')} linhas por vez.</p>}
      {error && (
        <p role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}
