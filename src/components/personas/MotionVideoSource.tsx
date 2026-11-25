import clsx from 'clsx'
import { Lock, RefreshCw, Upload, VolumeX } from 'lucide-react'
import { useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import { maxMotionSeconds } from '@/domain/motionCopy'
import type { PersonaMotion } from '@/hooks/usePersonaMotion'
import { Spinner } from '../ui/Spinner'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const SECTION_TITLE = 'mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500'

/** Copiar movimento (0044): o vídeo de referência, com a autorização antes do envio. */
export function MotionVideoSource({ motion }: { readonly motion: PersonaMotion }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const rightsId = useId()
  const tipsId = useId()
  const maxSeconds = maxMotionSeconds(motion.copyModels) ?? 10

  if (!motion.copyAllowed) {
    return (
      <section className="rounded-2xl bg-surface-2 p-4 text-sm text-zinc-300">
        <p className="flex items-center gap-2 font-bold text-zinc-100">
          <Lock className="size-4 text-accent-soft" aria-hidden="true" /> Copiar movimento é dos planos Pro e Max
        </p>
        <p className="mt-1 text-zinc-400">Seu personagem repete a dança, o gesto ou a fala de um vídeo seu.</p>
        <Link to="/assinatura" className={clsx('mt-3 inline-flex font-semibold text-accent-soft hover:underline', FOCUS)}>
          Ver planos
        </Link>
      </section>
    )
  }

  return (
    <section aria-labelledby={`${tipsId}-title`} className="space-y-3">
      <p id={`${tipsId}-title`} className={SECTION_TITLE}>
        Vídeo com o movimento
      </p>
      <ul id={tipsId} className="space-y-1 rounded-2xl bg-surface-2 px-4 py-3 text-[13px] text-zinc-400">
        <li>Até {maxSeconds} segundos, MP4 ou MOV, até 50 MB.</li>
        <li>Corpo inteiro ou da cintura para cima, com a cabeça aparecendo e nada na frente.</li>
        <li className="flex items-center gap-1.5">
          <VolumeX className="size-3.5 shrink-0" aria-hidden="true" /> O som do vídeo não vai para o resultado.
        </li>
      </ul>

      <label htmlFor={rightsId} className="flex cursor-pointer items-start gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-zinc-200">
        <input
          id={rightsId}
          type="checkbox"
          checked={motion.rightsConfirmed}
          onChange={(event) => motion.setRightsConfirmed(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[#7c3aed]"
        />
        <span>O vídeo é meu ou tenho autorização de quem aparece nele. Ele só empresta o movimento e é apagado depois da geração.</span>
      </label>

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void motion.pickVideo(file)
        }}
      />

      {motion.video ? (
        <div className="overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-white/[0.06]">
          <video src={motion.video.previewUrl} controls muted playsInline className="max-h-72 w-full bg-black object-contain" aria-label="Prévia do vídeo de referência" />
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="text-zinc-300">
              {motion.video.seconds.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s
              {motion.model && <span className="text-zinc-500"> · {motion.model.credits} créditos</span>}
            </span>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={motion.uploading}
              className={clsx('inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-zinc-300 hover:bg-white/[0.05] hover:text-zinc-100', FOCUS)}
            >
              <RefreshCw className="size-3.5" aria-hidden="true" /> Trocar vídeo
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!motion.rightsConfirmed || motion.uploading}
          aria-describedby={tipsId}
          className={clsx(
            'flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 text-sm font-semibold transition-colors',
            FOCUS,
            motion.rightsConfirmed && !motion.uploading
              ? 'border-accent/40 bg-accent/[0.06] text-zinc-100 hover:bg-accent/10'
              : 'cursor-not-allowed border-white/10 bg-surface-2/60 text-zinc-500',
          )}
        >
          {motion.uploading ? (
            <>
              <Spinner className="size-5" /> Enviando e conferindo o vídeo…
            </>
          ) : (
            <>
              <Upload className="size-5" aria-hidden="true" />
              {motion.rightsConfirmed ? 'Escolher vídeo' : 'Confirme a autorização acima para enviar'}
            </>
          )}
        </button>
      )}
    </section>
  )
}
