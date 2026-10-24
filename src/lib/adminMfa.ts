// Segundo fator (TOTP) do Supabase Auth para a operação. O cadastro e o código acontecem na
// própria conta da pessoa; o banco só libera as funções admin com a sessão em aal2.

import { ApiError } from './api'
import { supabase } from './supabase'

export interface TotpEnrollment {
  readonly factorId: string
  /** QR code em data URL (SVG) gerado pelo Supabase. */
  readonly qrCode: string
  readonly secret: string
}

/** Id do autenticador já confirmado, ou nulo se ainda não tem. */
export async function fetchTotpFactor(): Promise<string | null> {
  return (await listTotpFactors())[0]?.id ?? null
}

/** Cadastra um autenticador novo, descartando tentativas que ficaram sem confirmar. */
export async function enrollTotp(): Promise<TotpEnrollment> {
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
  if (listError) throw new ApiError('mfa_unavailable', 'Não deu para conferir o segundo fator.')
  for (const stale of factors.all.filter((factor) => factor.factor_type === 'totp' && factor.status === 'unverified')) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: stale.id })
    if (error) throw new ApiError('mfa_unavailable', 'Não deu para limpar um cadastro anterior do autenticador.')
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Vynkio operação ${new Date().toISOString()}` })
  if (error) throw new ApiError('mfa_enroll_failed', 'O Supabase não liberou o cadastro do autenticador. Confira se o MFA está ativo no projeto.')
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

/** Confere o código e sobe a sessão para aal2. */
export async function confirmTotp(factorId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
  if (error) throw new ApiError('mfa_invalid_code', 'Código inválido ou vencido. Use o código que está aparecendo agora.')
}

export interface TotpFactor {
  readonly id: string
  readonly name: string | null
  readonly createdAt: string
}

/** Autenticadores confirmados da conta, para a tela de segurança. */
export async function listTotpFactors(): Promise<TotpFactor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw new ApiError('mfa_unavailable', 'Não deu para conferir o segundo fator.')
  return data.totp
    .filter((factor) => factor.status === 'verified')
    .map((factor) => ({ id: factor.id, name: factor.friendly_name ?? null, createdAt: factor.created_at }))
}

/** Encerra a sessão em todos os aparelhos (revoga os refresh tokens no Supabase). */
export async function signOutEverywhere(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'global' })
  if (error) throw new ApiError('sign_out_failed', 'Não deu para encerrar as sessões. Tente de novo.')
}
