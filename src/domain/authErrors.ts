/** Mensagens do Supabase Auth traduzidas para quem está entrando ou criando conta. */
const AUTH_ERRORS: Readonly<Record<string, string>> = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'User already registered': 'Já existe conta com esse e-mail. Entre com sua senha.',
  'Email not confirmed': 'Confirme seu e-mail pelo link que enviamos antes de entrar.',
  'Signups not allowed for this instance': 'Novos cadastros estão pausados no momento.',
}

export function authErrorMessage(message: string): string {
  return AUTH_ERRORS[message] ?? 'Não deu para continuar. Confira os dados e tente de novo.'
}
