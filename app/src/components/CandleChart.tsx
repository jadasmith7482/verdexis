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

// Map our internal range to a `selected` index inside Highstock's
// rangeSelector buttons we render below (1m, 4m, 8m, YTD, All).
const RANGE_TO_SELECTED: Record<OhlcRange, number> = {
  '1H': 0,
  '1D': 0,
  '1W': 0,
  '1M': 0,
  '1Y': 4,
}

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
  // OHLC refreshes (which are heavily cached server-side).
  const effectiveLivePrice = tickerPrice ?? livePrice
  const merged = useMemo<Candle[]>(() => {
    if (candles.length === 0 || effectiveLivePrice == null || !isFinite(effectiveLivePrice)) return candles
    const out = candles.slice()
    const last = { ...out[out.length - 1] }
    last.close = effectiveLivePrice
    last.high = Math.max(last.high, effectiveLivePrice)
    last.low = Math.min(last.low, effectiveLivePrice)
    out[out.length - 1] = last
    return out
  }, [candles, effectiveLivePrice])

  const ohlcData = useMemo(
    () => merged.map((c) => [c.time, c.open, c.high, c.low, c.close]),
    [merged],
  )

  const options = useMemo<Highcharts.Options>(() => ({
    chart: {
      backgroundColor: '#0a0f11',
      borderRadius: 12,
      height: 500,
      styledMode: false,
    },
    title: { text: undefined },
    credits: { enabled: false },
    rangeSelector: {
      buttons: [
        { type: 'month', count: 1, text: '1m', title: 'View 1 month' },
        { type: 'month', count: 4, text: '4m', title: 'View 4 months' },
        { type: 'month', count: 8, text: '8m', title: 'View 8 months' },
        { type: 'ytd', text: 'YTD', title: 'View year to date' },
        { type: 'all', count: 1, text: 'All', title: 'View All' },
      ],
      buttonTheme: {
        fill: 'none',
        stroke: 'none',
        'stroke-width': 0,
        r: 8,
        style: { color: '#A0A0A0', fontWeight: 'bold' },
        states: {
          select: { fill: 'transparent', style: { color: '#0C8B44' } },
          hover: { style: { color: '#E5E5E5' } },
        },
      },
      inputBoxBorderColor: '#1f2937',
      inputBoxWidth: 110,
      inputBoxHeight: 18,
      inputStyle: { color: '#A0A0A0', fontWeight: 'bold' },
      labelStyle: { color: '#737373', fontWeight: 'bold' },
      selected: RANGE_TO_SELECTED[range],
    },
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
      },
      {
        top: '80%',
        height: '20%',
        gridLineColor: '#13191c',
        labels: { style: { color: '#737373' } },
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

  if (error || merged.length === 0) {
    return (
      <div className="h-[500px] w-full flex items-center justify-center">
        <div className="text-xs text-[#737373]">No chart data{error ? ` — ${error}` : ''}</div>
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
