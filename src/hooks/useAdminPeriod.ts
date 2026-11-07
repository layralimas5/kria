import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { CustomRange } from '@/components/admin/dashboard/PeriodFilter'
import { brtDay, PERIOD_PRESETS, resolvePeriod, type PeriodPreset } from '@/domain/adminDashboard'

const DEFAULT_PRESET: PeriodPreset = '30d'
const isPreset = (value: string | null): value is PeriodPreset => PERIOD_PRESETS.some((preset) => preset === value)

/**
 * Período na URL (`?periodo=7d`, ou `?periodo=custom&de=…&ate=…`): recarregar e compartilhar mantém
 * o recorte. Outros parâmetros da página (como `?aba=`) são preservados.
 */
export function useAdminPeriod() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('periodo')
  const preset = isPreset(raw) ? raw : DEFAULT_PRESET
  const today = brtDay(new Date())
  const start = params.get('de') ?? today
  const end = params.get('ate') ?? today
  const custom = useMemo<CustomRange>(() => ({ start, end }), [start, end])
  // `today` nas dependências: virou o dia, "Hoje" passa a ser o novo dia.
  const period = useMemo(() => resolvePeriod(preset, new Date(), custom), [preset, custom, today])

  function update(next: Record<string, string>) {
    const merged = new URLSearchParams(params)
    for (const key of ['periodo', 'de', 'ate']) merged.delete(key)
    for (const [key, value] of Object.entries(next)) merged.set(key, value)
    setParams(merged, { replace: true })
  }

  return {
    preset,
    custom,
    period,
    setPreset: (value: PeriodPreset) => update(value === 'custom' ? { periodo: value, de: custom.start, ate: custom.end } : { periodo: value }),
    setCustom: (range: CustomRange) => update({ periodo: 'custom', de: range.start, ate: range.end }),
  }
}
