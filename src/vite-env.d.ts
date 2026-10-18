/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Perfil do Kria no TikTok (tutoriais). Sem ele, a landing mostra "em breve". */
  readonly VITE_TIKTOK_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
