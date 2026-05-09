import { useEffect, useRef, useState } from 'react'

interface CountUpProps {
  /** Target numeric value to animate to. */
  value: number
  /** ms duration of the tween. Default 700. */
  duration?: number
  /** Function that turns the in-flight number into the displayed string.
   *  Pass your `fmtMoney` here so you keep currency formatting. */
  format: (n: number) => string
  /** Optional className for the wrapping span. */
  className?: string
}

/**
 * Lightweight number tween. Animates from the previously-rendered value to
 * the new value using requestAnimationFrame and easeOutCubic. Falls back to
 * the final value when the user has prefers-reduced-motion.
 */
export default function CountUp({ value, duration = 700, format, className }: CountUpProps) {
  const [display, setDisplay] = useState<number>(value)
  const fromRef = useRef<number>(value)
  const startRef = useRef<number>(0)
  const rafRef = useRef<number | null>(null)
  const reduce = typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (reduce || !Number.isFinite(value)) {
      setDisplay(value)
      fromRef.current = value
      return
    }
    const from = fromRef.current
    const to = value
    if (from === to) return
    startRef.current = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const current = from + (to - from) * eased
      setDisplay(current)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      fromRef.current = display
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  return <span className={className}>{format(display)}</span>
}
