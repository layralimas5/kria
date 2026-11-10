/**
 * Cadastro público. Fechado por padrão desde 10/11/2026: só entra quem já tem conta ou
 * recebeu convite pelo admin. `VITE_SIGNUP_OPEN=true` reabre a tela; a trava de verdade é
 * "Allow new users to sign up" em Supabase > Authentication > Sign In / Providers.
 */
export const SIGNUP_OPEN = import.meta.env.VITE_SIGNUP_OPEN === 'true'

export const ACCESS_EMAIL = 'vynkio.suporte@gmail.com'
