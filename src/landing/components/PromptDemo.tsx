import clsx from 'clsx'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import { Check, Clapperboard, ImageIcon, PenLine, Sparkles, Wand2, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface DemoPrompt {
  readonly mode: string
  readonly icon: LucideIcon
  readonly model: string
  readonly text: string
  readonly done: string
}

/** Pedidos de exemplo. Os tempos são ilustrativos da animação, não promessa de velocidade. */
const PROMPTS: readonly DemoPrompt[] = [
  { mode: 'Imagem', icon: ImageIcon, model: 'Nano Banana 2', text: 'Mulher de 28 anos tomando café numa varanda em Lisboa, luz de fim de tarde, foto de celular', done: 'Imagem pronta' },
  { mode: 'Vídeo', icon: Clapperboard, model: 'Kling 3.0', text: 'Ela olha para a câmera, sorri e diz "bom dia, gente!"', done: 'Vídeo pronto' },
  { mode: 'Roteiro', icon: PenLine, model: 'Vynkio AI', text: 'Roteiro de Reels de 30 segundos para lançar um sérum de vitamina C', done: 'Roteiro com gancho, cenas e CTA' },
  { mode: 'Formato', icon: Wand2, model: 'Antes e depois', text: 'Sala vazia virando sala decorada, estilo escandinavo, luz natural', done: 'Antes e depois pronto' },
]

type Phase = 'typing' | 'generating' | 'done'

const TYPE_MS = 32
const GENERATE_MS = 1400
const HOLD_MS = 1800

/** Caixa de prompt que escreve, gera e conclui sozinha, em loop. Para quando sai da tela. */
export function PromptDemo() {
  const reduceMotion = useReducedMotion()
  const box = useRef<HTMLDivElement>(null)
  const visible = useInView(box, { margin: '-40px' })
  const [index, setIndex] = useState(0)
  const [typed, setTyped] = useState(0)
  const [phase, setPhase] = useState<Phase>('typing')
  const prompt = PROMPTS[index] ?? PROMPTS[0]!
  const still = reduceMotion ?? false

  useEffect(() => {
    if (still || !visible) return
    let timer: number
    if (phase === 'typing') {
      timer = typed < prompt.text.length ? window.setTimeout(() => setTyped((count) => count + 1), TYPE_MS) : window.setTimeout(() => setPhase('generating'), 500)
    } else if (phase === 'generating') {
      timer = window.setTimeout(() => setPhase('done'), GENERATE_MS)
    } else {
      timer = window.setTimeout(() => {
        setIndex((current) => (current + 1) % PROMPTS.length)
        setTyped(0)
        setPhase('typing')
      }, HOLD_MS)
    }
    return () => window.clearTimeout(timer)
  }, [still, visible, phase, typed, prompt.text.length])

  const text = still ? prompt.text : prompt.text.slice(0, typed)
  const Icon = prompt.icon

  return (
    <div ref={box} aria-hidden="true" className="relative mx-auto mt-12 w-full max-w-2xl text-left">
      <div className="absolute -inset-px rounded-[1.35rem] bg-gradient-to-r from-accent/50 via-[#c4b5fd]/30 to-[#60a5fa]/50 opacity-60 blur-[2px]" />
      <div className="relative rounded-[1.3rem] bg-[#0d0c18]/95 p-3 ring-1 ring-white/[0.08] backdrop-blur-xl sm:p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-soft ring-1 ring-accent/30">
            <Icon className="size-4" />
          </span>
          <p className="min-h-[3.25rem] flex-1 text-[15px] leading-relaxed text-zinc-100 sm:min-h-[3rem]">
            {text}
            {!still && phase === 'typing' && <span className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[3px] animate-pulse bg-accent-soft" />}
          </p>
          <span
            className={clsx(
              'hidden shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all duration-300 sm:inline-flex',
              phase === 'generating' ? 'bg-accent shadow-[0_0_30px_-4px_rgb(124_58_237/0.9)]' : 'bg-accent/85',
            )}
          >
            <Sparkles className={clsx('size-4', phase === 'generating' && 'animate-spin [animation-duration:2s]')} />
            Gerar
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
          {PROMPTS.map((item, position) => (
            <span
              key={item.mode}
              className={clsx('rounded-lg px-2.5 py-1 transition-colors duration-300', position === index ? 'bg-zinc-100 text-zinc-900' : 'bg-white/[0.05] text-zinc-400')}
            >
              {item.mode}
            </span>
          ))}
          <span className="ml-auto text-zinc-500">{prompt.model}</span>
        </div>

        <div className="relative mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            key={`${index}-${phase}`}
            className="h-full rounded-full bg-gradient-to-r from-accent to-[#60a5fa]"
            initial={{ width: phase === 'done' ? '100%' : '0%' }}
            animate={{ width: phase === 'typing' ? '0%' : '100%' }}
            transition={{ duration: phase === 'generating' ? GENERATE_MS / 1000 : 0.2, ease: 'easeInOut' }}
          />
        </div>

        <AnimatePresence>
          {(still || phase === 'done') && (
            <motion.p
              initial={still ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute -bottom-4 right-5 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-[12px] font-semibold text-emerald-300 ring-1 ring-emerald-300/25 backdrop-blur"
            >
              <Check className="size-3.5" />
              {prompt.done}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
