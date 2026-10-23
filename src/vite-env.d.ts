/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_PATH?: string;
  readonly VITE_ADMIN_EMAIL?: string;
  readonly VITE_ADMIN_PASSWORD_SALT?: string;
  readonly VITE_ADMIN_PASSWORD_HASH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
