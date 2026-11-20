// Parcelamento no cartão com juros visíveis (tabela Price). Puro, testado em installments.test.ts.
// À vista nunca tem juros. Com juros, a parcela é arredondada para cima no centavo e o total é parcela × vezes,
// então o que aparece no checkout é exatamente o que o Asaas cobra. Sem juros, o total é o preço (o Asaas põe a
// diferença de centavo na última parcela).

export interface InstallmentOption {
  readonly count: number
  readonly installmentCents: number
  readonly totalCents: number
  readonly interestFree: boolean
}

/** Parcela de `principalCents` em `count` vezes com juro `monthlyRate` (0.0299 = 2,99% ao mês). */
export function installmentOption(principalCents: number, count: number, monthlyRate: number): InstallmentOption {
  if (!Number.isInteger(principalCents) || principalCents <= 0) throw new Error('valor inválido')
  if (!Number.isInteger(count) || count < 1 || count > 12) throw new Error('parcelas inválidas')
  if (count === 1 || monthlyRate <= 0) {
    const installmentCents = Math.ceil(principalCents / count)
    return { count, installmentCents, totalCents: principalCents, interestFree: true }
  }
  const factor = monthlyRate / (1 - (1 + monthlyRate) ** -count)
  const installmentCents = Math.ceil(principalCents * factor - 1e-9)
  return { count, installmentCents, totalCents: installmentCents * count, interestFree: false }
}

/** Parcela mínima de R$ 5,00: abaixo disso o Asaas recusa e não faz sentido para quem compra. */
const MIN_INSTALLMENT_CENTS = 500

export function installmentTable(principalCents: number, maxInstallments: number, monthlyRate: number): InstallmentOption[] {
  const options: InstallmentOption[] = []
  for (let count = 1; count <= maxInstallments; count += 1) {
    const option = installmentOption(principalCents, count, monthlyRate)
    if (count > 1 && option.installmentCents < MIN_INSTALLMENT_CENTS) break
    options.push(option)
  }
  return options
}
