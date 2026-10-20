import { z } from 'zod'
import raw from './testimonials.json'

// Depoimentos reais, no formato de conversa de WhatsApp. Regras:
//   * só entra quem autorizou por escrito (`consent: true`) e com o print/vídeo original guardado;
//   * texto igual ao que a pessoa mandou, sem editar o sentido;
//   * mídia em public/landing/depoimentos/.
// Nunca escrever depoimento inventado: é prova social falsa (CDC e Conar).

const messageSchema = z.object({
  from: z.enum(['cliente', 'kria']),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  text: z.string().min(1).optional(),
  image: z.string().startsWith('/landing/depoimentos/').optional(),
  video: z.string().startsWith('/landing/depoimentos/').optional(),
  poster: z.string().startsWith('/landing/depoimentos/').optional(),
})

const testimonialSchema = z.object({
  id: z.string().min(1),
  author: z.string().min(1),
  consent: z.literal(true),
  messages: z.array(messageSchema).min(1),
})

export type ChatMessage = z.infer<typeof messageSchema>
export type Testimonial = z.infer<typeof testimonialSchema>

/** Lê o arquivo e descarta (com aviso) qualquer item fora do formato ou sem autorização. */
export function parseTestimonials(input: unknown): Testimonial[] {
  if (!Array.isArray(input)) throw new Error('testimonials.json precisa ser uma lista')
  return input.flatMap((item, index) => {
    const parsed = testimonialSchema.safeParse(item)
    if (parsed.success) return [parsed.data]
    console.warn(`depoimento ${index} ignorado: ${parsed.error.issues[0]?.message ?? 'formato inválido'}`)
    return []
  })
}

export const TESTIMONIALS: readonly Testimonial[] = parseTestimonials(raw)
