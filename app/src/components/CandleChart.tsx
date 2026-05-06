import { useEffect, useMemo, useRef, useState } from 'react'
import { marketData, type Candle, type OhlcRange } from '../lib/marketData'

interface Props {
  coinId: string
  symbol: string
  livePrice?: number
  range: OhlcRange
}

const RANGE_REFRESH_MS: Record<OhlcRange, number> = {
  '1H': 30_000,
  '1D': 60_000,
  '1W': 5 * 60_000,
  '1M': 15 * 60_000,
  '1Y': 60 * 60_000,
}

export default function CandleChart({ coinId, symbol, livePrice, range }: Props) {
  const [candles, setCandles] = useState<Candle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hover, setHover] = useState<{ x: number; y: number; candle: Candle } | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  // Fetch + auto-refresh per range.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const data = await marketData.getOhlc(coinId, range)
        if (!cancelled) {
          setCandles(data)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load chart')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, RANGE_REFRESH_MS[range])
    return () => { cancelled = true; clearInterval(interval) }
  }, [coinId, range])

  // Splice the live price onto the last candle so it visibly ticks between
  // CoinGecko refreshes (which are heavily cached server-side).
  const merged = useMemo<Candle[]>(() => {
    if (candles.length === 0 || livePrice == null || !isFinite(livePrice)) return candles
    const out = candles.slice()
    const last = { ...out[out.length - 1] }
    last.close = livePrice
    last.high = Math.max(last.high, livePrice)
    last.low = Math.min(last.low, livePrice)
    out[out.length - 1] = last
    return out
  }, [candles, livePrice])

  const stats = useMemo(() => {
    if (merged.length === 0) return null
    const highs = merged.map((c) => c.high)
    const lows = merged.map((c) => c.low)
    const max = Math.max(...highs)
    const min = Math.min(...lows)
    const padding = (max - min) * 0.08 || max * 0.005 || 1
    return { max: max + padding, min: Math.max(0, min - padding), span: max - min + 2 * padding }
  }, [merged])

  // Layout in viewBox units. Padding on right reserves room for price axis.
  const VB_W = 1000
  const VB_H = 320
  const PAD_R = 56
  const PAD_B = 22
  const PAD_T = 8
  const plotW = VB_W - PAD_R
  const plotH = VB_H - PAD_T - PAD_B

  const fmtPrice = (p: number) => {
    if (p >= 1000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    if (p >= 1) return `$${p.toFixed(2)}`
    return `$${p.toFixed(4)}`
  }

  const fmtTime = (ms: number) => {
    const d = new Date(ms)
    if (range === '1H' || range === '1D') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (range === '1W') return d.toLocaleDateString([], { weekday: 'short' })
    if (range === '1M') return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    return d.toLocaleDateString([], { month: 'short', year: '2-digit' })
  }

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!stats || merged.length === 0) return
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const xPx = e.clientX - rect.left
    const xRatio = xPx / rect.width
    const idx = Math.max(0, Math.min(merged.length - 1, Math.round(xRatio * (merged.length - 1))))
    const candle = merged[idx]
    setHover({ x: xRatio * plotW, y: ((stats.max - candle.close) / stats.span) * plotH + PAD_T, candle })
  }

  if (loading && candles.length === 0) {
    return (
      <div className="h-80 w-full flex items-center justify-center">
        <div className="text-xs text-[#737373] animate-pulse">Loading {symbol.toUpperCase()} market data…</div>
      </div>
    )
  }

  if (error || !stats || merged.length === 0) {
    return (
      <div className="h-80 w-full flex items-center justify-center">
        <div className="text-xs text-[#737373]">No chart data{error ? ` — ${error}` : ''}</div>
      </div>
    )
  }

  // Y grid lines (4 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => stats.min + (stats.span * i) / 4)
  // X labels (5 evenly spaced)
  const xLabelIdx = Array.from({ length: 5 }, (_, i) => Math.round((merged.length - 1) * (i / 4)))

  const lastClose = merged[merged.length - 1].close
  const firstClose = merged[0].open
  const isUp = lastClose >= firstClose
  const candleWidth = (plotW / merged.length) * 0.65

  return (
    <div ref={wrapRef} className="h-80 w-full relative">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        className="w-full h-full"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="chart-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0C8B44" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#0C8B44" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y grid + price axis labels */}
        {yTicks.map((tick, i) => {
          const y = ((stats.max - tick) / stats.span) * plotH + PAD_T
          return (
            <g key={`yt-${i}`}>
              <line x1={0} x2={plotW} y1={y} y2={y} stroke="#ffffff10" strokeWidth={0.5} />
              <text x={plotW + 6} y={y + 3} fontSize={10} fill="#737373">{fmtPrice(tick)}</text>
            </g>
          )
        })}

        {/* X axis labels */}
        {xLabelIdx.map((idx, i) => {
          const x = (idx / (merged.length - 1 || 1)) * plotW
          return (
            <text key={`xt-${i}`} x={x} y={VB_H - 4} fontSize={10} fill="#737373" textAnchor={i === 0 ? 'start' : i === xLabelIdx.length - 1 ? 'end' : 'middle'}>
              {fmtTime(merged[idx].time)}
            </text>
          )
        })}

        {/* Filled area under closes, for that real-chart feel */}
        {(() => {
          const closes = merged.map((c, i) => {
            const x = (i / (merged.length - 1 || 1)) * plotW
            const y = ((stats.max - c.close) / stats.span) * plotH + PAD_T
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
          }).join(' ')
          const baseY = PAD_T + plotH
          const area = `${closes} L${plotW.toFixed(2)},${baseY} L0,${baseY} Z`
          return (
            <>
              <path d={area} fill="url(#chart-bg)" />
              <path d={closes} fill="none" stroke={isUp ? '#0C8B44' : '#f44336'} strokeWidth={1.2} strokeOpacity={0.45} />
            </>
          )
        })()}

        {/* Candles */}
        {merged.map((c, i) => {
          const x = (i / (merged.length - 1 || 1)) * plotW
          const isGreen = c.close >= c.open
          const color = isGreen ? '#0C8B44' : '#f44336'
          const yOpen = ((stats.max - c.open) / stats.span) * plotH + PAD_T
          const yClose = ((stats.max - c.close) / stats.span) * plotH + PAD_T
          const yHigh = ((stats.max - c.high) / stats.span) * plotH + PAD_T
          const yLow = ((stats.max - c.low) / stats.span) * plotH + PAD_T
          const bodyTop = Math.min(yOpen, yClose)
          const bodyHeight = Math.max(1, Math.abs(yClose - yOpen))
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={yHigh} y2={yLow} stroke={color} strokeWidth={1} opacity={0.85} />
              <rect
                x={x - candleWidth / 2}
                y={bodyTop}
                width={candleWidth}
                height={bodyHeight}
                fill={color}
                opacity={0.95}
                rx={1}
              />
            </g>
          )
        })}

        {/* Last-price horizontal line + label */}
        {(() => {
          const y = ((stats.max - lastClose) / stats.span) * plotH + PAD_T
          return (
            <g>
              <line x1={0} x2={plotW} y1={y} y2={y} stroke={isUp ? '#0C8B44' : '#f44336'} strokeWidth={0.6} strokeDasharray="3 3" opacity={0.7} />
              <rect x={plotW + 2} y={y - 9} width={PAD_R - 4} height={18} rx={3} fill={isUp ? '#0C8B44' : '#f44336'} />
              <text x={plotW + PAD_R / 2} y={y + 3} fontSize={11} fontWeight={600} fill="#fff" textAnchor="middle">{fmtPrice(lastClose)}</text>
            </g>
          )
        })()}

        {/* Hover crosshair */}
        {hover && (
          <g pointerEvents="none">
            <line x1={hover.x} x2={hover.x} y1={PAD_T} y2={PAD_T + plotH} stroke="#ffffff30" strokeWidth={0.5} strokeDasharray="2 2" />
            <line x1={0} x2={plotW} y1={hover.y} y2={hover.y} stroke="#ffffff30" strokeWidth={0.5} strokeDasharray="2 2" />
          </g>
        )}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute bg-[#0a0f11] border border-[#ffffff15] rounded-lg p-2 text-[10px] text-[#A0A0A0] shadow-xl"
          style={{ left: `min(calc(${(hover.x / VB_W) * 100}% + 12px), calc(100% - 160px))`, top: 8 }}
        >
          <div className="text-[#E5E5E5] mb-1">{new Date(hover.candle.time).toLocaleString()}</div>
          <div className="grid grid-cols-2 gap-x-3">
            <span>O</span><span className="text-[#E5E5E5]">{fmtPrice(hover.candle.open)}</span>
            <span>H</span><span className="text-[#E5E5E5]">{fmtPrice(hover.candle.high)}</span>
            <span>L</span><span className="text-[#E5E5E5]">{fmtPrice(hover.candle.low)}</span>
            <span>C</span><span className={hover.candle.close >= hover.candle.open ? 'text-[#0C8B44]' : 'text-[#f44336]'}>{fmtPrice(hover.candle.close)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
