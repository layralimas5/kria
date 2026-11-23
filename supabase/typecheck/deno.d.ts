/** Superfície mínima do Deno que as funções usam, para `npm run typecheck:functions` checar com tsc. */
declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}
declare module 'npm:@supabase/supabase-js@2' {
  export * from '@supabase/supabase-js'
}
declare module 'npm:zod@3' {
  export * from 'zod'
}
declare module 'npm:nodemailer@6.9.16' {
  interface MailMessage {
    from: string
    to: string
    replyTo?: string
    subject: string
    html: string
    text: string
  }
  interface Transporter {
    sendMail(message: MailMessage): Promise<unknown>
  }
  interface SmtpOptions {
    host: string
    port: number
    secure: boolean
    auth: { user: string; pass: string }
  }
  const nodemailer: { createTransport(options: SmtpOptions): Transporter }
  export default nodemailer
}
declare module 'npm:@anthropic-ai/sdk@0.131.0' {
  export * from '@anthropic-ai/sdk'
  export { default } from '@anthropic-ai/sdk'
}
