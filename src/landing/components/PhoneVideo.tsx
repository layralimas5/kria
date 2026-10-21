import clsx from 'clsx'
import { Heart, MessageCircle, Send } from 'lucide-react'
import type { Clip } from '../content'
import { LoopVideo } from './LoopVideo'

interface PhoneVideoProps {
  readonly clip: Clip
  readonly className?: string
  readonly eager?: boolean
  /** Mostra a interface de vídeo curto (ações e legenda) por cima. */
  readonly social?: boolean
}

export function PhoneVideo({ clip, className, eager = false, social = false }: PhoneVideoProps) {
  return (
    <figure
      className={clsx(
        'relative aspect-[9/19.5] rounded-[2.2rem] bg-[#08071a] p-[6px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.12]',
        className,
      )}
    >
      <div className="relative size-full overflow-hidden rounded-[1.85rem] bg-black">
        <LoopVideo clip={clip} eager={eager} className="size-full object-cover" />
        <span aria-hidden="true" className="absolute left-1/2 top-2 h-[18px] w-[30%] -translate-x-1/2 rounded-full bg-black" />
        {social && (
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent">
            <div className="absolute bottom-16 right-2.5 flex flex-col items-center gap-3 text-white">
              <Heart className="size-5 fill-white" />
              <MessageCircle className="size-5" />
              <Send className="size-5" />
            </div>
            <div className="absolute inset-x-3 bottom-3 text-[10px] leading-snug text-white">
              <p className="font-semibold">@vynkio</p>
              <p className="mt-0.5 line-clamp-2 text-white/80">{clip.title} feito no Vynkio</p>
            </div>
          </div>
        )}
      </div>
    </figure>
  )
}
