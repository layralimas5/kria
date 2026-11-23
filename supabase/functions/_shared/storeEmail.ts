// Texto do e-mail de entrega da loja. O envio fica em ./storeMailer.ts.

export interface DeliveryEmailInput {
  readonly to: string
  readonly buyerName: string | null
  readonly productName: string
  readonly accessUrl: string
}

export interface EmailContent {
  readonly subject: string
  readonly html: string
  readonly text: string
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)
}

/** Primeiro nome, para o "Oi, Ana". Nome vazio ou estranho vira só "Oi". */
function greeting(buyerName: string | null): string {
  const first = buyerName?.trim().split(/\s+/)[0] ?? ''
  return /^[\p{L}'-]{2,30}$/u.test(first) ? `Oi, ${first}` : 'Oi'
}

export function deliveryEmail(input: DeliveryEmailInput): EmailContent {
  const hello = greeting(input.buyerName)
  const product = escapeHtml(input.productName)
  const url = escapeHtml(input.accessUrl)
  return {
    subject: `Seu acesso: ${input.productName}`,
    text: [
      `${hello}!`,
      '',
      `O pagamento do ${input.productName} foi confirmado. Baixe por este link:`,
      input.accessUrl,
      '',
      'Guarde este e-mail: o link continua valendo para baixar de novo.',
      'Qualquer problema, é só responder.',
    ].join('\n'),
    html: `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#0b0a1a;font-family:Arial,sans-serif;color:#e4e4e7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#15132b;border-radius:16px;padding:32px">
<tr><td>
<p style="margin:0 0 16px;font-size:18px;font-weight:bold;color:#fafafa">${escapeHtml(hello)}!</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6">O pagamento do <strong>${product}</strong> foi confirmado. Seu acesso já está liberado.</p>
<p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 24px;border-radius:12px">Baixar agora</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#a1a1aa">Guarde este e-mail: o link continua valendo para baixar de novo.</p>
<p style="margin:0;font-size:13px;color:#a1a1aa">Qualquer problema, é só responder.</p>
</td></tr></table></td></tr></table></body></html>`,
  }
}
