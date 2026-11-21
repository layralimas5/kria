import { Star } from 'lucide-react'
import { useCallback } from 'react'
import { useQuery } from '@/hooks/useQuery'
import { fetchTestimonials, type Testimonial, type TestimonialScope } from '@/lib/testimonialsApi'

function Stars({ rating }: { readonly rating: number }) {
  return (
    <span className="flex gap-0.5" role="img" aria-label={`${rating} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star key={value} className={value <= rating ? 'size-4 fill-amber-400 text-amber-400' : 'size-4 text-zinc-300'} aria-hidden="true" />
      ))}
    </span>
  )
}

function TestimonialCard({ testimonial }: { readonly testimonial: Testimonial }) {
  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <Stars rating={testimonial.rating} />
      <blockquote className="mt-2.5 text-sm leading-relaxed text-zinc-700">"{testimonial.body}"</blockquote>
      <p className="mt-3 text-[13px] font-semibold text-zinc-900">
        {testimonial.name}
        {testimonial.role && <span className="font-normal text-zinc-500"> · {testimonial.role}</span>}
      </p>
    </li>
  )
}

/**
 * Depoimentos de clientes reais (0041), aprovados no admin. Sem nenhum aprovado, o bloco não aparece:
 * nunca existe depoimento de exemplo nem de mentira.
 */
export function TestimonialsBlock({ scope }: { readonly scope: TestimonialScope }) {
  const product = scope.kind === 'store' ? scope.product : null
  const load = useCallback(() => fetchTestimonials(product ? { kind: 'store', product } : { kind: 'vynkio' }), [product])
  const { data } = useQuery(load, 'Não deu para carregar os depoimentos.')
  if (!data || data.length === 0) return null

  return (
    <section aria-labelledby="testimonials-title" className="space-y-3">
      <h2 id="testimonials-title" className="text-base font-semibold text-zinc-900">
        Quem já comprou
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {data.map((testimonial) => (
          <TestimonialCard key={`${testimonial.name}-${testimonial.body.slice(0, 24)}`} testimonial={testimonial} />
        ))}
      </ul>
    </section>
  )
}
