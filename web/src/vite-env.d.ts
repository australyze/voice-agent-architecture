/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VAPI_PUBLIC_KEY?: string;
  readonly VITE_VAPI_ASSISTANT_ID?: string;
  readonly VITE_PUBLIC_API_BASE_URL?: string;
  readonly VITE_DEMO_ORCHESTRATE_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
