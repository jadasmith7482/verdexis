import { useEffect, useMemo, useRef, useState } from 'react'
import Highcharts from 'highcharts/highstock'
import HighchartsReact from 'highcharts-react-official'
// Auto-registering ESM modules — Highcharts 12 attaches them on import.
import 'highcharts/indicators/indicators-all'
import { marketData, type Candle, type OhlcRange } from '../lib/marketData'
import { liveTicker } from '../lib/liveTicker'

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

// (We render our own range picker; Highstock's rangeSelector buttons are
// disabled — see options.rangeSelector below.)

/**
 * Highstock candlestick chart with Acceleration Bands overlay and Awesome
 * Oscillator panel — based on the Highcharts demo the user supplied. Data
 * still comes from our backend proxy (`marketData.getOhlc`) so we benefit
 * from the rate-limited CoinGecko cache and never expose API keys client-side.
 */
export default function CandleChart({ coinId, symbol, livePrice, range }: Props) {
  const [candles, setCandles] = useState<Candle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tickerPrice, setTickerPrice] = useState<number | null>(() => liveTicker.getPrice(coinId))
  const chartRef = useRef<HighchartsReact.RefObject | null>(null)

  // Sub-second live price.
  useEffect(() => {
    setTickerPrice(liveTicker.getPrice(coinId))
    const unsub = liveTicker.subscribe(coinId, (p) => setTickerPrice(p))
    return unsub
  }, [coinId])

  // Fetch + auto-refresh per range. `reloadKey` lets the user force a reload
  // from the error UI without remounting the whole chart.
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const data = await marketData.getOhlc(coinId, range)
        if (!cancelled) {
          setCandles(data)
          setError(data.length === 0 ? 'No candles returned for this market' : null)
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
  }, [coinId, range, reloadKey])

  // The static OHLC frame — only rebuilt when the user changes coin/range or
  // the upstream OHLC fetch lands. Live ticks update the chart imperatively
  // (see effect below) so we don't pay a full options-rebuild every 2s.
  const effectiveLivePrice = tickerPrice ?? livePrice
  const ohlcData = useMemo(
    () => candles.map((c) => [c.time, c.open, c.high, c.low, c.close]),
    [candles],
  )

  // Imperative live-price update: redraw the last candle's close and move
  // the horizontal price line to the new value. This is the standard
  // Highstock pattern for sub-second updates and is what actually makes the
  // chart visibly tick (a 1¢ change spliced onto a $79k candle is invisible
  // by itself).
  useEffect(() => {
    const chart = chartRef.current?.chart
    if (!chart || candles.length === 0 || effectiveLivePrice == null || !isFinite(effectiveLivePrice)) return
    const series = chart.get('price') as Highcharts.Series | undefined
    const yAxis = chart.yAxis?.[0]
    if (series && series.points && series.points.length > 0) {
      const last = series.points[series.points.length - 1]
      const lastCandle = candles[candles.length - 1]
      const newHigh = Math.max(lastCandle.high, effectiveLivePrice)
      const newLow = Math.min(lastCandle.low, effectiveLivePrice)
      try {
        // Update without redraw=true twice; the addPlotLine below will redraw.
        last.update(
          [lastCandle.time, lastCandle.open, newHigh, newLow, effectiveLivePrice],
          false,
          false,
        )
      } catch { /* point may have been disposed mid-update */ }
    }
    if (yAxis) {
      try {
        yAxis.removePlotLine('live-price')
        yAxis.addPlotLine({
          id: 'live-price',
          value: effectiveLivePrice,
          color: '#0C8B44',
          width: 1,
          dashStyle: 'ShortDash',
          zIndex: 5,
          label: {
            text: `$${effectiveLivePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            align: 'right',
            x: -8,
            y: -4,
            style: { color: '#0C8B44', fontSize: '10px', fontWeight: 'bold' },
          },
        })
      } catch { /* axis disposed */ }
    }
    chart.redraw(false)
  }, [effectiveLivePrice, candles])

  const options = useMemo<Highcharts.Options>(() => ({
    chart: {
      backgroundColor: '#0a0f11',
      borderRadius: 12,
      height: 500,
      styledMode: false,
      // Don't let trackpad/mouse-wheel gestures zoom the chart — users
      // navigate via our range picker + the navigator strip below.
      zooming: { mouseWheel: { enabled: false }, type: undefined },
      pinchType: undefined,
    },
    title: { text: undefined },
    credits: { enabled: false },
    // We render our own range picker above the chart; Highstock's built-in
    // rangeSelector buttons (1m, 4m, 8m, YTD, All) didn't match our 1H/1D/
    // 1W/1M/1Y data ranges and would auto-clip the visible window away from
    // the live tail.
    rangeSelector: { enabled: false },
    plotOptions: {
      series: { marker: { enabled: false } },
      candlestick: {
        lineColor: '#f44336',
        color: '#f44336',
        upColor: '#0C8B44',
        upLineColor: '#0C8B44',
      },
      abands: {
        lineWidth: 1,
        lineColor: '#20a0b1',
        bottomLine: { styles: { lineWidth: 0.5, lineColor: '#fcfc27' } },
        topLine: { styles: { lineWidth: 0.5, lineColor: '#2efc27' } },
      },
    },
    xAxis: {
      lineWidth: 0.1,
      tickColor: '#1f2937',
      crosshair: { color: '#8e8aac', dashStyle: 'Dash' },
    },
    yAxis: [
      {
        labels: { align: 'right', x: -2, style: { color: '#737373' } },
        height: '80%',
        crosshair: { dashStyle: 'Dash', snap: false, color: '#696777' },
        resize: { enabled: true, lineWidth: 2, lineColor: '#1d1c30' },
        gridLineColor: '#13191c',
        lineWidth: 0,
        visible: true,
        // Pad the price axis so candles don't touch the top/bottom edges —
        // makes price action readable instead of looking maxed-out.
        startOnTick: false,
        endOnTick: false,
        minPadding: 0.08,
        maxPadding: 0.08,
      },
      {
        top: '80%',
        height: '20%',
        gridLineColor: '#13191c',
        labels: { style: { color: '#737373' } },
        startOnTick: false,
        endOnTick: false,
        minPadding: 0.05,
        maxPadding: 0.05,
      },
    ],
    tooltip: {
      split: true,
      shape: 'rect',
      shadow: false,
      valueDecimals: 2,
    },
    stockTools: { gui: { enabled: false } },
    navigator: {
      enabled: true,
      height: 50,
      margin: 10,
      outlineColor: '#1f2937',
      handles: { backgroundColor: '#1f2937', borderColor: '#0C8B44' },
      xAxis: { gridLineColor: '#1f2937' },
    },
    scrollbar: {
      barBackgroundColor: '#1f2937',
      barBorderColor: '#1f2937',
      barBorderRadius: 8,
      buttonArrowColor: '#fff',
      buttonBackgroundColor: '#0a0f11',
      rifleColor: '#fff',
      trackBackgroundColor: '#13191c',
      trackBorderColor: '#13191c',
    },
    series: [
      {
        type: 'candlestick',
        name: symbol.toUpperCase(),
        id: 'price',
        data: ohlcData,
      },
      {
        type: 'abands',
        id: 'abands-overlay',
        linkedTo: 'price',
        yAxis: 0,
        tooltip: { valueDecimals: 2 },
      },
      {
        type: 'ao',
        id: 'ao-oscillator',
        linkedTo: 'price',
        yAxis: 1,
      },
    ] as Highcharts.SeriesOptionsType[],
  }), [ohlcData, symbol, range])

  if (loading && candles.length === 0) {
    return (
      <div className="h-[500px] w-full flex items-center justify-center">
        <div className="text-xs text-[#737373] animate-pulse">Loading {symbol.toUpperCase()} market data…</div>
      </div>
    )
  }

  if (error || candles.length === 0) {
    return (
      <div className="h-[500px] w-full flex flex-col items-center justify-center gap-3">
        <div className="text-xs text-[#737373] text-center max-w-sm">
          Couldn’t load {symbol.toUpperCase()} candles{error ? ` — ${error}` : ''}.
          <br />The market data provider may be rate-limiting. We’ll keep trying in the background.
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="px-3 py-1.5 text-[11px] rounded-md bg-[#0C8B44]/15 text-[#0C8B44] hover:bg-[#0C8B44]/25 transition-colors"
        >
          Retry now
        </button>
      </div>
    )
  }

  return (
    <div className="w-full">
      <HighchartsReact
        ref={chartRef}
        highcharts={Highcharts}
        constructorType="stockChart"
        options={options}
      />
    </div>
  )
}
