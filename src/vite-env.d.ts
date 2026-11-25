/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** 'true' quando o login com Google estiver ligado no Supabase. */
  readonly VITE_AUTH_GOOGLE?: string
  /** ID do GA4 (G-XXXX). Sem ele, os eventos de conversão não saem do navegador. */
  readonly VITE_GA_MEASUREMENT_ID?: string
  /** E-mail de contato no rodapé da landing. Sem ele, o rodapé não mostra contato. */
  readonly VITE_CONTACT_EMAIL?: string
  /** 'true' mostra os preços v2 (Creator e Business) na landing. Só junto com a virada no admin. */
  readonly VITE_PRICING_V2?: string
  /** Chave pública VAPID das notificações (`npm run vapid:keys`). Sem ela, o botão de notificação explica que está desligado. */
  readonly VITE_VAPID_PUBLIC_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
