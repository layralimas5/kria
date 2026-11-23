// Envio do e-mail de entrega da loja pelo Gmail do Vynkio, o mesmo SMTP dos e-mails de login (supabase/config.toml).
//   STORE_SMTP_USER  conta do Gmail, ex.: vynkio.suporte@gmail.com
//   STORE_SMTP_PASS  senha de app do Google (16 letras); sem ela o e-mail não sai e a entrega fica só na página
// Porta 465 (TLS direto): as Edge Functions bloqueiam 25 e 587. O Gmail limita a 500 envios por dia,
// somados aos de login. O endereço do remetente é sempre o da conta; o nome é nosso.

import nodemailer from 'npm:nodemailer@6.9.16'
import { deliveryEmail, type DeliveryEmailInput } from './storeEmail.ts'

const SENDER_NAME = 'Vynkio'

/** Manda o e-mail. Devolve `false` sem credencial configurada; erro do SMTP sobe para quem chamou registrar. */
export async function sendDeliveryEmail(input: DeliveryEmailInput): Promise<boolean> {
  const user = Deno.env.get('STORE_SMTP_USER')?.trim()
  // O Google mostra a senha de app em blocos com espaço ("abcd efgh ..."): o SMTP quer as 16 letras juntas.
  const pass = Deno.env.get('STORE_SMTP_PASS')?.replace(/\s+/g, '')
  if (!user || !pass) return false
  const content = deliveryEmail(input)
  const transport = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass } })
  await transport.sendMail({
    from: `"${SENDER_NAME}" <${user}>`,
    to: input.to,
    subject: content.subject,
    html: content.html,
    text: content.text,
  })
  return true
}
