/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

declare const __APP_VERSION__: string

/** File Handling API (Chromium): the files an installed app was opened with. */
interface Window {
  launchQueue?: {
    setConsumer(consumer: (params: { files: { getFile(): Promise<File> }[] }) => void): void
  }
}
