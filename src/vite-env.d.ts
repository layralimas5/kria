/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** 'true' quando o login com Google estiver ligado no Supabase. */
  readonly VITE_AUTH_GOOGLE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
