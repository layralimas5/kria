import { describe, expect, it } from 'vitest'
import { formatWhatsapp, mailtoLink, whatsappLink } from './support'

describe('suporte', () => {
  it('monta o link do WhatsApp só com dígitos e a mensagem do plano', () => {
    expect(whatsappLink('+55 (11) 99999-0000', 'Pro')).toBe(
      `https://wa.me/5511999990000?text=${encodeURIComponent('Olá! Sou assinante do plano Pro do Vynkio e preciso de ajuda.')}`,
    )
  })

  it('formata o número para leitura e deixa formato desconhecido como veio', () => {
    expect(formatWhatsapp('5511999990000')).toBe('+55 (11) 99999-0000')
    expect(formatWhatsapp('551133330000')).toBe('+55 (11) 3333-0000')
    expect(formatWhatsapp('123')).toBe('123')
  })

  it('assunto do e-mail leva o plano', () => {
    expect(mailtoLink('vynkio.suporte@gmail.com', 'Starter')).toBe('mailto:vynkio.suporte@gmail.com?subject=Suporte%20Vynkio%20(Starter)')
  })
})
