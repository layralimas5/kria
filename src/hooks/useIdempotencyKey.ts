import { useMemo, useRef } from 'react'

export interface IdempotencyKey {
  readonly current: () => string
  readonly rotate: () => void
}

/**
 * Uma chave por pedido de geração. Se a rede falhar e a pessoa clicar de novo
 * sem mudar nada, a mesma chave vai junto e o servidor não cobra duas vezes.
 * `rotate` troca a chave depois de um envio que deu certo ou quando o pedido muda.
 * O objeto devolvido é estável entre renders (pode ir em dependência de efeito).
 */
export function useIdempotencyKey(): IdempotencyKey {
  const key = useRef<string>(crypto.randomUUID())
  return useMemo(
    () => ({
      current: () => key.current,
      rotate: () => {
        key.current = crypto.randomUUID()
      },
    }),
    [],
  )
}
