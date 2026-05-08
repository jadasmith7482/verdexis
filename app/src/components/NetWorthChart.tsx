import { useMemo } from 'react'
import Highcharts from 'highcharts/highstock'
import HighchartsReact from 'highcharts-react-official'
import type { ChartRange } from './dashboard/TimeRangePicker'

interface Props {
  series: number[]
  benchmark?: number[] | null // optional BTC overlay (same length, same scale baseline)
  range: ChartRange
  isUp: boolean
  height?: number
}

// Returns the millisecond spacing between consecutive points for a range,
// so the x-axis shows real dates instead of bucket indexes.
function bucketMs(range: ChartRange, points: number): { start: number; step: number } {
  const now = Date.now()
  switch (range) {
    case '1D':  return { start: now - 24 * 3_600_000, step: 3_600_000 }
    case '1W':  return { start: now - 7 * 24 * 3_600_000, step: (7 * 24 * 3_600_000) / Math.max(1, points - 1) }
    case '1M':  return { start: now - 30 * 24 * 3_600_000, step: (30 * 24 * 3_600_000) / Math.max(1, points - 1) }
    case '1Y':  return { start: now - 365 * 24 * 3_600_000, step: (365 * 24 * 3_600_000) / Math.max(1, points - 1) }
    case 'ALL': return { start: now - 365 * 24 * 3_600_000, step: (365 * 24 * 3_600_000) / Math.max(1, points - 1) }
  }
}

export default function NetWorthChart({ series, benchmark, range, isUp, height = 192 }: Props) {
  const accent = isUp ? '#0C8B44' : '#f44336'
  const options = useMemo<Highcharts.Options>(() => {
    const { start, step } = bucketMs(range, series.length)
    const data: [number, number][] = series.map((v, i) => [start + i * step, v])
    const benchData: [number, number][] | undefined = benchmark
      ? benchmark.map((v, i) => [start + i * step, v])
      : undefined

    return {
      chart: {
        backgroundColor: 'transparent',
        height,
        spacing: [4, 0, 4, 0],
        animation: false,
        // Disable trackpad/mouse-wheel zoom — on touchpads a stray two-finger
        // gesture would silently zoom the chart and the user has no obvious
        // way to reset it. We render our own range picker for navigation.
        zooming: { mouseWheel: { enabled: false }, type: undefined },
        panning: { enabled: false, type: 'x' },
        pinchType: undefined,
      },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { enabled: false },
      rangeSelector: { enabled: false },
      navigator: { enabled: false },
      scrollbar: { enabled: false },
      tooltip: {
        backgroundColor: '#0a0f11',
        borderColor: '#1f2937',
        borderRadius: 8,
        style: { color: '#E5E5E5' },
        shadow: false,
        xDateFormat: range === '1D' ? '%b %e, %H:%M' : '%b %e, %Y',
        valuePrefix: '$',
        valueDecimals: 2,
        split: false,
        shared: true,
      },
      xAxis: {
        type: 'datetime',
        lineColor: '#ffffff10',
        tickColor: '#ffffff10',
        labels: { style: { color: '#737373', fontSize: '10px' } },
        crosshair: { color: '#ffffff20', dashStyle: 'Dash' },
      },
      yAxis: {
        opposite: false,
        gridLineColor: '#ffffff08',
        // Breathing room so a steady balance ($50,100–$50,300) doesn't look
        // like a roller coaster filling the entire chart height. Highstock's
        // default crops to exact data min/max with zero padding.
        startOnTick: false,
        endOnTick: false,
        minPadding: 0.15,
        maxPadding: 0.15,
        labels: {
          style: { color: '#737373', fontSize: '10px' },
          formatter() {
            const n = this.value as number
            if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
            if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
            return `$${n.toFixed(0)}`
          },
        },
        title: { text: undefined },
      },
      plotOptions: {
        series: { marker: { enabled: false }, animation: false },
        area: {
          fillColor: {
            linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
            stops: [
              [0, accent + '55'],
              [1, accent + '00'],
            ],
          },
          lineWidth: 1.6,
          lineColor: accent,
          states: { hover: { lineWidth: 2 } },
          threshold: null,
        },
      },
      series: [
        {
          type: 'area',
          name: 'Net Worth',
          data,
          color: accent,
        },
        ...(benchData
          ? [{
              type: 'line' as const,
              name: 'BTC',
              data: benchData,
              color: '#FF9800',
              dashStyle: 'Dash' as const,
              lineWidth: 1,
              opacity: 0.85,
            }]
          : []),
      ],
    }
  }, [series, benchmark, range, accent, height])

  return (
    <HighchartsReact
      highcharts={Highcharts}
      constructorType="stockChart"
      options={options}
    />
  )
}
