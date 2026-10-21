/** Tamanho do código de recuperação. Espelha `otp_length` em supabase/config.toml. */
export const RESET_CODE_LENGTH = 6

/** Espera entre um envio de código e outro, para não estourar o limite de e-mails do Supabase. */
export const RESEND_COOLDOWN_SECONDS = 60

/** Só os dígitos, no máximo o tamanho do código: aceita colar "123 456" ou "123-456". */
export function sanitizeCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, RESET_CODE_LENGTH)
}

export function isCompleteCode(code: string): boolean {
  return new RegExp(`^\\d{${RESET_CODE_LENGTH}}$`).test(code)
}
