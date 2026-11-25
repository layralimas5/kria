// Texto das notificações no aparelho. A tela de bloqueio é pública: nada de nome, e-mail ou CPF de quem
// comprou; só o que foi vendido e o valor.

export type PushTopic = 'generations' | 'sales'

export interface PushMessage {
  readonly title: string
  readonly body: string
  /** Rota do app aberta no toque. */
  readonly url: string
  /** Notificações com a mesma tag se substituem em vez de empilhar. */
  readonly tag: string
  /** `sales` e `test` sempre aparecem; `generations` some se o app já estiver aberto na tela. */
  readonly topic: PushTopic | 'test'
}

export type Sale =
  | { readonly kind: 'plan'; readonly planName: string; readonly amountCents: number; readonly firstPayment: boolean; readonly id: string }
  | { readonly kind: 'pack'; readonly packName: string; readonly credits: number; readonly amountCents: number; readonly id: string }
  | { readonly kind: 'store'; readonly products: readonly string[]; readonly amountCents: number; readonly id: string }

export function formatBrl(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(cents / 100)
    .replace(/ /g, ' ')
}

function listProducts(products: readonly string[]): string {
  if (products.length === 0) return 'Pedido na loja'
  if (products.length === 1) return products[0] ?? ''
  return `${products[0]} + ${products.length - 1}`
}

/** O valor vai no título: é a linha que todo celular mostra, mesmo com a notificação recolhida. */
export function saleMessage(sale: Sale): PushMessage {
  const title = `Parabéns, Vynkio! Venda de ${formatBrl(sale.amountCents)}`
  switch (sale.kind) {
    case 'plan':
      return {
        title,
        body: sale.firstPayment
          ? `Mais um usuário do plano ${sale.planName}.`
          : `Mais um mês do plano ${sale.planName} renovado.`,
        url: '/admin/assinaturas',
        tag: `sale-${sale.id}`,
        topic: 'sales',
      }
    case 'pack':
      return {
        title,
        body: `Mais um pacote ${sale.packName} vendido: ${sale.credits.toLocaleString('pt-BR')} créditos.`,
        url: '/admin/financeiro',
        tag: `sale-${sale.id}`,
        topic: 'sales',
      }
    case 'store':
      return {
        title,
        body: `Mais uma venda na loja: ${listProducts(sale.products)}.`,
        url: '/admin/financeiro',
        tag: `sale-${sale.id}`,
        topic: 'sales',
      }
  }
}

export function generationMessage(generation: { readonly id: string; readonly kind: 'image' | 'video'; readonly succeeded: boolean }): PushMessage {
  const video = generation.kind === 'video'
  if (generation.succeeded) {
    return {
      title: video ? 'Seu vídeo ficou pronto' : 'Sua imagem ficou pronta',
      body: 'Toque para ver na galeria.',
      url: '/galeria',
      tag: `generation-${generation.id}`,
      topic: 'generations',
    }
  }
  return {
    title: video ? 'O vídeo não saiu' : 'A imagem não saiu',
    body: 'Os créditos voltaram para a sua conta. Tente de novo no Studio.',
    url: `/estudio?modo=${video ? 'video' : 'imagem'}`,
    tag: `generation-${generation.id}`,
    topic: 'generations',
  }
}

export function testMessage(): PushMessage {
  return {
    title: 'Notificações ligadas',
    body: 'É assim que o Vynkio vai te avisar neste aparelho.',
    url: '/conta/configuracoes',
    tag: 'test',
    topic: 'test',
  }
}
