import { z } from 'zod'
import { supabase } from '@/lib/supabase'

// Depoimentos de clientes reais (0041): só de quem pagou, só aparecem depois de aprovados no admin.

const testimonialSchema = z.object({
  name: z.string(),
  role: z.string().nullable(),
  body: z.string(),
  rating: z.number().int().min(1).max(5),
})

export type Testimonial = z.infer<typeof testimonialSchema>

export type TestimonialScope = { readonly kind: 'vynkio' } | { readonly kind: 'store'; readonly product: string }

export async function fetchTestimonials(scope: TestimonialScope): Promise<Testimonial[]> {
  const { data, error } = await supabase.rpc('public_testimonials', {
    p_scope: scope.kind,
    p_product: scope.kind === 'store' ? scope.product : null,
  })
  if (error) throw new Error(`public_testimonials: ${error.message}`)
  return z.array(testimonialSchema).parse(data)
}

const mineSchema = z.object({ eligible: z.boolean(), status: z.enum(['pending', 'approved', 'hidden']).nullable() })

export type MyTestimonial = z.infer<typeof mineSchema>

export async function fetchMyTestimonial(): Promise<MyTestimonial> {
  const { data, error } = await supabase.rpc('my_testimonial')
  if (error) throw new Error(`my_testimonial: ${error.message}`)
  return mineSchema.parse(data)
}

export interface TestimonialDraft {
  readonly authorName: string
  readonly authorRole: string
  readonly body: string
  readonly rating: number
}

export async function submitTestimonial(draft: TestimonialDraft): Promise<void> {
  const { error } = await supabase.rpc('submit_testimonial', {
    p_author_name: draft.authorName,
    p_author_role: draft.authorRole,
    p_body: draft.body,
    p_rating: draft.rating,
    p_consent: true,
  })
  if (error) throw new Error(error.message.includes('not_a_customer') ? 'Só quem já pagou uma mensalidade pode avaliar.' : 'Não deu para enviar agora. Tente de novo.')
}
