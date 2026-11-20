import { describe, expect, it } from 'vitest'
import { deliveryEmail } from './storeEmail.ts'

const base = { to: 'ana@x.com', productName: 'Kria Personagens', accessUrl: 'https://vynkio-ia.com.br/pedido/abc' }

describe('deliveryEmail', () => {
  it('cumprimenta pelo primeiro nome e leva o link no texto e no botão', () => {
    const email = deliveryEmail({ ...base, buyerName: 'Ana Souza' })
    expect(email.subject).toBe('Seu acesso: Kria Personagens')
    expect(email.text).toContain('Oi, Ana!')
    expect(email.text).toContain(base.accessUrl)
    expect(email.html).toContain(`href="${base.accessUrl}"`)
  })

  it('sem nome confiável, cumprimenta sem nome', () => {
    expect(deliveryEmail({ ...base, buyerName: null }).text.startsWith('Oi!')).toBe(true)
    expect(deliveryEmail({ ...base, buyerName: '<script>' }).text.startsWith('Oi!')).toBe(true)
  })

  it('escapa HTML vindo do nome do produto', () => {
    const email = deliveryEmail({ ...base, buyerName: 'Ana', productName: 'Kit <b>&</b>' })
    expect(email.html).toContain('Kit &lt;b&gt;&amp;&lt;/b&gt;')
    expect(email.html).not.toContain('<b>&</b>')
  })
})
