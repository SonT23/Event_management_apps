/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHOW_LAB?: string
  readonly VITE_DEV_API?: string
  /** VD: https://your-api.onrender.com — không dấu / cuối, không ghép thêm `/api`; để trống khi dùng proxy dev */
  readonly VITE_API_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
