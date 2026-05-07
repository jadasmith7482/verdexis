import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

interface QrCodeProps {
  value: string
  size?: number
  /** Foreground (dark module) colour. Defaults to white for our dark theme. */
  fg?: string
  /** Background colour. Defaults to transparent. */
  bg?: string
  className?: string
}

/**
 * Renders a QR code into a <canvas> via the `qrcode` package. Uses error
 * correction level "M" (15% recovery) which is the standard for crypto
 * deposit addresses. Re-renders whenever `value` changes.
 */
export default function QrCode({ value, size = 192, fg = '#E5E5E5', bg = '#0a0f11', className }: QrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !value) return
    QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: fg, light: bg },
    }).catch(() => {
      // QR encoding can fail for inputs over ~2,953 characters. Crypto
      // addresses are well under that — log only in dev.
      if (import.meta.env.DEV) console.warn('QR render failed for', value)
    })
  }, [value, size, fg, bg])

  return <canvas ref={canvasRef} className={className} aria-label={`QR code for ${value}`} />
}
