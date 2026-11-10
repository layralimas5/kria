/** Limite do `profiles.display_name` (0001), para onde o gatilho de conta nova copia o nome. */
export const FULL_NAME_MAX = 80
export const PASSWORD_MIN = 8

export interface SignupForm {
  readonly fullName: string
  readonly password: string
  readonly confirmPassword: string
}

/** Espaços repetidos viram um só; o banco recebe o nome já limpo. */
export function normalizeFullName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/** Primeiro problema da ficha de cadastro, na ordem em que os campos aparecem; null quando está tudo certo. */
export function signupError({ fullName, password, confirmPassword }: SignupForm): string | null {
  const name = normalizeFullName(fullName)
  if (name.split(' ').filter((part) => part.length >= 2).length < 2) return 'Digite seu nome completo, com sobrenome.'
  if (name.length > FULL_NAME_MAX) return `O nome pode ter até ${FULL_NAME_MAX} caracteres.`
  if (password.length < PASSWORD_MIN) return `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`
  if (password !== confirmPassword) return 'As senhas não são iguais.'
  return null
}
