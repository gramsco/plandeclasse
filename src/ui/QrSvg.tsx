import { useMemo } from 'react'
import { encodeQr } from '../model/qr'

const QUIET_ZONE = 4

/** A QR code, always black on white whatever the theme: readers expect that contrast. */
export function QrSvg({ text, label }: { text: string; label: string }) {
  const { path, side } = useMemo(() => {
    const modules = encodeQr(text)
    const cells = modules.flatMap((row, y) =>
      row.flatMap((dark, x) => (dark ? [`M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`] : [])),
    )
    return { path: cells.join(''), side: modules.length + QUIET_ZONE * 2 }
  }, [text])
  return (
    <svg className="qr" viewBox={`0 0 ${side} ${side}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={side} height={side} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  )
}
