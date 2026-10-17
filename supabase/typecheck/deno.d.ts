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
