/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 可选：本地覆盖 `supabasePublicConfig` 中的默认项目地址 */
  readonly VITE_SUPABASE_URL?: string
  /** 可选：本地覆盖默认 Publishable Key */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.glb' {
  const src: string
  export default src
}
