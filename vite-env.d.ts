/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_TRANSCRIPTION_API_KEY: string
    readonly VITE_ASSISTANT_API_KEY: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
