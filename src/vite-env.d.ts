/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CF_WEB_ANALYTICS_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
