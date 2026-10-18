import { useId, useState } from 'react'
import { GOALS } from '@/domain/goals'
import { goalSchema } from '@/domain/types'
import { useAccount } from '@/hooks/useAccount'
import { errorMessage } from '@/lib/api'
import { Notice } from '../ui/Notice'

/** O objetivo escolhido no primeiro acesso; muda os atalhos do início. */
export function GoalSelect() {
  const id = useId()
  const { preferences, setGoal } = useAccount()
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  async function handleChange(value: string) {
    const parsed = goalSchema.safeParse(value)
    if (!parsed.success) return
    setMessage(null)
    try {
      await setGoal(parsed.data)
      setMessage({ tone: 'success', text: 'Atalhos do início atualizados.' })
    } catch (saveError) {
      setMessage({ tone: 'error', text: errorMessage(saveError) })
    }
  }

  return (
    <div className="space-y-3">
      <label htmlFor={id} className="block text-[13px] font-semibold text-zinc-300">
        Principal objetivo
      </label>
      <select
        id={id}
        value={preferences?.goal ?? 'all_tools'}
        onChange={(event) => void handleChange(event.target.value)}
        className="w-full rounded-xl border border-white/[0.08] bg-surface-2 px-3.5 py-2.5 text-[15px] text-zinc-100 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20 sm:max-w-sm"
      >
        {GOALS.map((goal) => (
          <option key={goal.value} value={goal.value}>
            {goal.label}
          </option>
        ))}
      </select>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </div>
  )
}
