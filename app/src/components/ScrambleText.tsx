import { useEffect, useRef } from 'react'

interface ScrambleTextProps {
  text: string
  className?: string
}

export default function ScrambleText({ text, className }: ScrambleTextProps) {
  const displayRef = useRef<HTMLSpanElement>(null)
  const currentIndex = useRef(0)

  useEffect(() => {
    if (!displayRef.current) return

    displayRef.current.textContent = ''
    currentIndex.current = 0

    const interval = setInterval(() => {
      if (!displayRef.current) return

      if (currentIndex.current <= text.length) {
        const resolved = text.slice(0, currentIndex.current)
        const scrambleLength = text.length - currentIndex.current
        const scrambled = Array.from(
          { length: scrambleLength },
          () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charAt(Math.floor(Math.random() * 36))
        ).join('')
        displayRef.current.textContent = resolved + scrambled
        currentIndex.current++
      } else {
        clearInterval(interval)
      }
    }, 30)

    return () => clearInterval(interval)
  }, [text])

  return <span ref={displayRef} className={className} />
}
