import { z } from 'zod'

// Suporte por plano (0028): o banco decide o canal e só devolve o contato desse canal.

export const SUPPORT_CHANNELS = ['none', 'email', 'whatsapp', 'whatsapp_priority'] as const
export type SupportChannel = (typeof SUPPORT_CHANNELS)[number]

export const mySupportSchema = z.object({
  plan_name: z.string().nullable(),
  channel: z.enum(SUPPORT_CHANNELS),
  email: z.string().nullable(),
  whatsapp: z.string().nullable(),
  priority: z.boolean(),
  community: z.boolean(),
  community_url: z.string().nullable(),
})
export type MySupport = z.infer<typeof mySupportSchema>

export const supportSettingsSchema = z.object({
  email: z.string().nullable(),
  whatsapp: z.string().nullable(),
  community_url: z.string().nullable(),
  updated_at: z.string(),
})
export type SupportSettings = z.infer<typeof supportSettingsSchema>

/** Link do WhatsApp com a mensagem inicial preenchida (número só com dígitos e DDI). */
export function whatsappLink(number: string, planName: string | null): string {
  const text = `Olá! Sou assinante${planName ? ` do plano ${planName}` : ''} do Vynkio e preciso de ajuda.`
  return `https://wa.me/${number.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
}

/** "5511999990000" vira "+55 (11) 99999-0000"; outro formato volta como veio. */
export function formatWhatsapp(number: string): string {
  const match = /^(\d{2})(\d{2})(\d{4,5})(\d{4})$/.exec(number.replace(/\D/g, ''))
  return match ? `+${match[1]} (${match[2]}) ${match[3]}-${match[4]}` : number
}

export function mailtoLink(email: string, planName: string | null): string {
  const subject = encodeURIComponent(`Suporte Vynkio${planName ? ` (${planName})` : ''}`)
  return `mailto:${email}?subject=${subject}`
}
