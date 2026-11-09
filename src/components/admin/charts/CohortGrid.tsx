const dayFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' })

export interface CohortRow {
  readonly cohort: string
  readonly size: number
  /** Contas da coorte que geraram algo na semana N; nulo para semana que ainda não chegou. */
  readonly active: readonly (number | null)[]
}

/** Retenção por coorte semanal: tabela de verdade, com a intensidade da célula só como reforço. */
export function CohortGrid({ rows }: { readonly rows: readonly CohortRow[] }) {
  const weeks = Math.max(0, ...rows.map((row) => row.active.length))
  return (
    <section aria-labelledby="cohort-title" className="min-w-0 rounded-2xl bg-surface p-4 ring-1 ring-white/[0.06]">
      <h3 id="cohort-title" className="text-sm font-bold text-zinc-200">
        Retenção por coorte semanal
      </h3>
      <p className="mt-0.5 text-xs text-zinc-500">Parcela de quem se cadastrou na semana que gerou algo N semanas depois.</p>
      {rows.length === 0 ? (
        <p className="grid min-h-32 place-items-center text-xs text-zinc-500">Nenhum cadastro nas últimas 8 semanas.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-separate border-spacing-1 text-xs">
            <caption className="sr-only">Retenção por coorte semanal, em porcentagem da coorte</caption>
            <thead className="text-zinc-500">
              <tr>
                <th scope="col" className="text-left font-semibold">Semana do cadastro</th>
                <th scope="col" className="text-right font-semibold">Contas</th>
                {Array.from({ length: weeks }, (_, week) => (
                  <th key={week} scope="col" className="font-semibold">
                    S{week}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.cohort}>
                  <th scope="row" className="whitespace-nowrap text-left font-normal text-zinc-300">
                    {dayFormat.format(new Date(`${row.cohort}T00:00:00Z`))}
                  </th>
                  <td className="text-right tabular-nums text-zinc-400">{row.size}</td>
                  {row.active.map((count, week) => {
                    if (count === null) return <td key={week} aria-label="Semana ainda não chegou" />
                    const share = row.size > 0 ? count / row.size : 0
                    return (
                      <td
                        key={week}
                        className="h-8 rounded-md text-center tabular-nums text-zinc-100"
                        style={{ backgroundColor: `rgb(139 92 246 / ${0.08 + share * 0.62})` }}
                        title={`${count} de ${row.size}`}
                      >
                        {Math.round(share * 100)}%
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
