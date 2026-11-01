import { useEffect, useRef, type RefObject } from 'react'

const SCAN_MS = 120
export const NO_CAMERA =
  "La caméra n'est pas accessible. Autorisez-la dans le navigateur, ou utilisez un ordinateur qui en a une."

type Options = {
  /** The camera runs while this is true and is released as soon as it turns false. */
  active: boolean
  onCode(text: string): void
  onError(message: string): void
  /** The camera is showing. */
  onReady?(): void
}

/** Reads QR codes from the camera into `onCode`. Returns the ref of the `<video>` that shows it. */
export function useQrScanner({ active, onCode, onError, onReady }: Options): RefObject<HTMLVideoElement | null> {
  const video = useRef<HTMLVideoElement>(null)
  // Callbacks change on every render; the camera must not restart for that.
  const callbacks = useRef({ onCode, onError, onReady })
  useEffect(() => {
    callbacks.current = { onCode, onError, onReady }
  })

  useEffect(() => {
    if (!active) return
    let stopped = false
    let stream: MediaStream | undefined
    let timer: ReturnType<typeof setInterval> | undefined
    const fail = (message: string) => !stopped && callbacks.current.onError(message)
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (stopped) return stream.getTracks().forEach((t) => t.stop())
        const el = video.current
        if (!el) return
        el.srcObject = stream
        await el.play()
        const { default: jsQR } = await import('jsqr') // only loaded when someone scans
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) return fail(NO_CAMERA)
        if (stopped) return
        callbacks.current.onReady?.()
        timer = setInterval(() => {
          if (!el.videoWidth) return
          canvas.width = el.videoWidth
          canvas.height = el.videoHeight
          context.drawImage(el, 0, 0)
          const image = context.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })
          if (code) callbacks.current.onCode(code.data)
        }, SCAN_MS)
      } catch {
        fail(NO_CAMERA)
      }
    })()
    return () => {
      stopped = true
      clearInterval(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [active])

  return video
}
