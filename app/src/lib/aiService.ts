import { marketData, type CryptoQuote, type MarketNews } from './marketData'
import { portfolioStore } from './portfolioStore'
import { api } from './api'
import { computePortfolioHealth } from './portfolioHealth'
import { stakingStore, pendingRewardFor } from './stakingStore'
import { dcaStore, nextRunMs } from './dcaStore'
import { goalsStore, progressFor } from './goalsStore'
import {
  classifyIntent, computeStats, computePortfolioRisk, computeSignals,
  computeTradeStats, computeMarketRegime, btcCorrelation,
  extractMentionedAssets, findHolding, describeRsi, totalCashFromWallet,
  fmtUsd, fmtPct, fmtBig, fmtNum,
  type Intent, type PortfolioStats,
} from './aiBrain'

export type PersonaId = 'verdexis' | 'buffett' | 'graham' | 'lynch' | 'munger' | 'klarman' | 'wood'

export interface Persona {
  id: PersonaId
  name: string
  title: string
  philosophy: string
  bias: 'value' | 'growth' | 'contrarian' | 'momentum' | 'balanced'
  color: string
  prompts: string[]
}

// Inspired by the 37-agent system in Fincept Terminal — distilled to 7 distinct
// investor personas that flavour AI responses without needing a remote LLM.
export const PERSONAS: Persona[] = [
  { id: 'verdexis', name: 'Verdexis Analyst', title: 'Default · Balanced', bias: 'balanced', color: '#0C8B44', philosophy: 'Diversified, data-driven, risk-aware.', prompts: ['Analyze my portfolio', 'Best trades today?', 'Diversification ideas', 'Market sentiment'] },
  { id: 'buffett', name: 'Warren Buffett', title: 'Long-term value', bias: 'value', color: '#D4AF37', philosophy: 'Buy wonderful businesses at fair prices. Hold forever.', prompts: ['Is BTC a wonderful business?', 'Margin of safety on ETH', 'Should I trim my position?'] },
  { id: 'graham', name: 'Benjamin Graham', title: 'Defensive value', bias: 'value', color: '#7B9CFF', philosophy: 'Margin of safety. Mr. Market is moody — exploit, don\'t follow.', prompts: ['Calculate intrinsic value', 'Is this a defensive position?', 'Find oversold names'] },
  { id: 'lynch', name: 'Peter Lynch', title: 'Growth at reasonable price', bias: 'growth', color: '#52C8A7', philosophy: 'Invest in what you understand. Tenbaggers hide in plain sight.', prompts: ['Spot a tenbagger setup', 'PEG ratio for SOL', 'What\'s the growth story?'] },
  { id: 'munger', name: 'Charlie Munger', title: 'Mental models', bias: 'balanced', color: '#A78BFA', philosophy: 'Invert. All I want to know is where I\'m going to die so I\'ll never go there.', prompts: ['What can go wrong here?', 'Inverted analysis of my portfolio', 'Mental models check'] },
  { id: 'klarman', name: 'Seth Klarman', title: 'Margin of safety', bias: 'contrarian', color: '#F59E0B', philosophy: 'Risk is what you didn\'t see. Cash is a position.', prompts: ['Where\'s the asymmetric upside?', 'Should I hold more cash?', 'Tail-risk check'] },
  { id: 'wood', name: 'Cathie Wood', title: 'Disruptive innovation', bias: 'growth', color: '#EC4899', philosophy: 'Bet on exponential change. Conviction over consensus.', prompts: ['Innovation thesis for ETH', 'Disruptive momentum signals', 'Long-duration bets'] },
]

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  persona?: PersonaId
}

export interface AIInsight {
  type: 'recommendation' | 'alert' | 'analysis'
  title: string
  description: string
  confidence: number
  timestamp: Date
}

// ---------------------------------------------------------------------------
// AIService — local intelligent assistant. Tries the server LLM proxy first;
// when it's not available (no OPENAI_API_KEY, offline, etc.) the rule engine
// below answers with rich, data-grounded responses computed from
// portfolioStore + marketData + the local stores (staking, dca, goals).
//
// Capabilities (intent-routed via aiBrain.classifyIntent):
//
//   greeting / help / thanks
//   portfolio_overview / portfolio_health / portfolio_risk
//   concentration / diversification / allocation / cash_balance / rebalance
//   pnl / best_worst / win_rate / tax_estimate
//   asset_quote / asset_signals / compare_assets
//   market_regime / market_news / top_movers
//   deposit_history / withdraw_history / transaction_history
//   staking / yield / goals / dca / alerts / watchlist
//   whatif_buy / whatif_sell
//   strategy / recommendation / fundamentals
//
// Each persona reframes the same data through a distinct analytical lens
// (value, growth, contrarian, momentum, mental-model, etc.) — not just an
// appended tagline like the previous build.
// ---------------------------------------------------------------------------

class AIService {
  // Lightweight in-memory conversation history. We keep up to 8 turns per
  // session so follow-ups like "what about ETH then?" or "tell me more"
  // can pick up the previously-discussed asset / topic without the user
  // repeating themselves.
  private history: ChatMessage[] = []
  private lastTopicAsset: string | null = null   // symbol of last asset discussed

  /** Reset the assistant's short-term memory (e.g. on persona switch). */
  resetMemory(): void {
    this.history = []
    this.lastTopicAsset = null
  }

  /** Public hook so callers can tell the assistant about a turn it generated. */
  recordTurn(msg: ChatMessage): void {
    this.history.push(msg)
    if (this.history.length > 16) this.history = this.history.slice(-16)
  }

  async getPortfolioInsights(): Promise<AIInsight[]> {
    try {
      const market = await marketData.getCryptoList().catch(() => [] as CryptoQuote[])
      const news = await marketData.getMarketNews().catch(() => [] as MarketNews[])
      const holdings = portfolioStore.getHoldings()
      const wallet = portfolioStore.getWallet()
      const txs = portfolioStore.getTransactions()
      const trades = portfolioStore.getTrades()
      const cash = portfolioStore.getWalletValueUsd()

      const stats = computeStats(holdings, cash, txs, trades)
      const risk = computePortfolioRisk(holdings, market, stats.netWorth)
      const regime = computeMarketRegime(market)
      const health = computePortfolioHealth({ holdings, wallet, market, netWorth: stats.netWorth })
      const corr = btcCorrelation(holdings, market)
      const tradeStats = computeTradeStats(trades, holdings)

      const insights: AIInsight[] = []
      const now = new Date()

      // 1) Health grade
      if (health) {
        insights.push({
          type: 'analysis',
          title: `Portfolio Health: Grade ${health.grade} (${health.overall}/100)`,
          description: health.subScores
            .sort((a, b) => a.score - b.score)
            .slice(0, 2)
            .map((s) => `${s.label} ${s.score}/100 — ${s.detail}`)
            .join(' • ') || 'All sub-scores look balanced.',
          confidence: 90,
          timestamp: now,
        })
      }

      // 2) Concentration warning
      if (stats.topHolding && stats.positionsValue > 0) {
        const topPct = (stats.topHolding.value / stats.netWorth) * 100
        if (topPct >= 40) {
          insights.push({
            type: topPct >= 60 ? 'alert' : 'recommendation',
            title: 'Concentration Risk',
            description: `${stats.topHolding.symbol} is ${topPct.toFixed(0)}% of net worth (effective positions ${stats.effectivePositions.toFixed(1)}). A rebalance into 2-3 uncorrelated names would lower idiosyncratic risk meaningfully.`,
            confidence: Math.min(95, Math.round(topPct + 20)),
            timestamp: now,
          })
        }
      }

      // 3) Cash buffer
      const cashPct = stats.netWorth > 0 ? (cash / stats.netWorth) * 100 : 0
      if (stats.netWorth > 0) {
        if (cashPct < 5 && stats.positionsValue > 0) {
          insights.push({
            type: 'recommendation',
            title: 'Low Dry Powder',
            description: `Only ${cashPct.toFixed(1)}% of net worth is in USD cash. Holding ~10-20% lets you scale into pullbacks instead of forced selling.`,
            confidence: 80,
            timestamp: now,
          })
        } else if (cashPct > 50) {
          insights.push({
            type: 'recommendation',
            title: 'Idle Cash Drag',
            description: `${cashPct.toFixed(0)}% of net worth is sitting in cash. Even a USDC stable position earns ~4-5% APY via Aave/Compound — consider parking some.`,
            confidence: 70,
            timestamp: now,
          })
        }
      }

      // 4) Drawdown vs deposits
      if (stats.netDeposited > 0 && stats.lifetimeReturn < -10) {
        insights.push({
          type: 'alert',
          title: 'Lifetime Drawdown',
          description: `Net worth is ${fmtPct(stats.lifetimeReturn)} vs ${fmtUsd(stats.netDeposited)} deposited. Review whether the original thesis still holds before averaging down.`,
          confidence: 85,
          timestamp: now,
        })
      } else if (stats.netDeposited > 0 && stats.lifetimeReturn > 25) {
        insights.push({
          type: 'analysis',
          title: 'Strong Lifetime Return',
          description: `Up ${fmtPct(stats.lifetimeReturn)} on ${fmtUsd(stats.netDeposited)} deposited (current value ${fmtUsd(stats.netWorth)}). Consider locking in a portion to reduce path-dependency.`,
          confidence: 80,
          timestamp: now,
        })
      }

      // 5) Best & worst position spotlight
      if (stats.bestHolding && stats.bestHolding.pnlPercent > 15) {
        insights.push({
          type: 'analysis',
          title: `${stats.bestHolding.symbol} Outperformer`,
          description: `${stats.bestHolding.name} is up ${fmtPct(stats.bestHolding.pnlPercent)} from your avg cost (${fmtUsd(stats.bestHolding.avgBuyPrice)} → ${fmtUsd(stats.bestHolding.currentPrice)}). Trim a slice into strength?`,
          confidence: 72,
          timestamp: now,
        })
      }
      if (stats.worstHolding && stats.worstHolding.pnlPercent < -15) {
        insights.push({
          type: 'alert',
          title: `${stats.worstHolding.symbol} Underwater`,
          description: `${stats.worstHolding.name} is ${fmtPct(stats.worstHolding.pnlPercent)} from your avg cost. Decide: reload, hold, or rotate — stale red positions silently compound.`,
          confidence: 75,
          timestamp: now,
        })
      }

      // 6) Risk grade
      if (risk) {
        insights.push({
          type: risk.riskGrade === 'High' || risk.riskGrade === 'Extreme' ? 'alert' : 'analysis',
          title: `Risk: ${risk.riskGrade}`,
          description: `Annualised vol ~${risk.weightedVolPct.toFixed(0)}%, weighted Sharpe ${risk.weightedSharpe.toFixed(2)}, 95% daily VaR ~${risk.var95Daily.toFixed(2)}%, 7d max drawdown ${risk.weightedDrawdownPct.toFixed(1)}%.`,
          confidence: 78,
          timestamp: now,
        })
      }

      // 7) Correlation
      if (corr !== null && Math.abs(corr) > 0.7) {
        insights.push({
          type: 'analysis',
          title: 'High BTC Correlation',
          description: `Portfolio moves ~${(corr * 100).toFixed(0)}% with BTC. Diversifying into uncorrelated assets (real-world equities, gold proxies, market-neutral stables) would smooth equity curve.`,
          confidence: 70,
          timestamp: now,
        })
      }

      // 8) Per-holding momentum on actually-held assets
      for (const h of holdings.slice(0, 6)) {
        const m = market.find((x) => x.id === h.id || x.symbol.toLowerCase() === h.symbol.toLowerCase())
        if (!m) continue
        const sig = computeSignals(m.sparkline_in_7d?.price)
        if (!sig) continue
        if (sig.rsi >= 75) {
          insights.push({
            type: 'recommendation',
            title: `${h.symbol} Overbought`,
            description: `${describeRsi(sig.rsi)}, ${sig.vsHigh.toFixed(1)}% from 7d high. Trim discipline: scale out 10-25% above current price.`,
            confidence: 70, timestamp: now,
          })
        } else if (sig.rsi <= 28) {
          insights.push({
            type: 'recommendation',
            title: `${h.symbol} Oversold`,
            description: `${describeRsi(sig.rsi)}, ${sig.vsLow.toFixed(1)}% off 7d low. Possible mean-reversion bounce — set a small bid below current.`,
            confidence: 68, timestamp: now,
          })
        } else if (sig.smaCross === 'bullish') {
          insights.push({
            type: 'analysis',
            title: `${h.symbol} Bullish Cross`,
            description: `Short SMA crossed above long SMA on the 7d series. Trend follower setup — confirm with volume on next breakout.`,
            confidence: 60, timestamp: now,
          })
        } else if (sig.smaCross === 'bearish') {
          insights.push({
            type: 'alert',
            title: `${h.symbol} Bearish Cross`,
            description: `Short SMA crossed below long SMA. Lower-high pattern forming — protect with a stop ${(sig.vsLow * 0.5).toFixed(1)}% below recent low.`,
            confidence: 60, timestamp: now,
          })
        }
      }

      // 9) Market regime
      if (regime) {
        insights.push({
          type: 'analysis',
          title: `Market Regime: ${regime.label}`,
          description: `Fear/Greed proxy ${regime.fearGreed}/100, breadth ${regime.breadth.toFixed(0)}% advancers in top 30. Top gainer ${regime.topGainer?.symbol.toUpperCase() ?? '—'} ${regime.topGainer ? fmtPct(regime.topGainer.price_change_percentage_24h) : ''}.`,
          confidence: 65,
          timestamp: now,
        })
      }

      // 10) Trade win rate
      if (tradeStats.sells > 2) {
        insights.push({
          type: 'analysis',
          title: `Trading Win Rate ${tradeStats.winRate.toFixed(0)}%`,
          description: `${tradeStats.buys} buys / ${tradeStats.sells} sells, avg hold ${tradeStats.avgHoldDays.toFixed(0)}d, total volume ${fmtBig(tradeStats.totalVolume)}. ${tradeStats.winRate < 45 ? 'Below 50% — review entry/exit rules.' : 'Healthy hit rate; double down on what works.'}`,
          confidence: 70, timestamp: now,
        })
      }

      // 11) News headlines mentioning held assets
      if (news.length > 0 && holdings.length > 0) {
        const heldSyms = new Set(holdings.map((h) => h.symbol.toLowerCase()))
        const heldNews = news.filter((n) => {
          const txt = `${n.headline} ${n.summary}`.toLowerCase()
          return [...heldSyms].some((s) => txt.includes(s))
        }).slice(0, 1)
        for (const n of heldNews) {
          insights.push({
            type: 'analysis',
            title: 'News on a Held Asset',
            description: `"${n.headline}" — ${n.source}. Worth a 30-second skim before next trade decision.`,
            confidence: 55, timestamp: now,
          })
        }
      }

      // 12) Goals nearing deadline
      try {
        const goals = goalsStore.list()
        for (const g of goals) {
          const p = progressFor(g, stats.netWorth)
          if (!p.onTrack && p.daysLeft < 90 && p.pct < 90) {
            insights.push({
              type: 'recommendation',
              title: `Goal Off Track: ${g.title}`,
              description: `${p.pct.toFixed(0)}% of ${fmtUsd(g.target)} with ${p.daysLeft}d left. Need ${fmtUsd(p.remaining)} more — bump DCA or reduce timeline.`,
              confidence: 75, timestamp: now,
            })
            break // one goal alert is enough
          }
        }
      } catch { /* goals optional */ }

      // 13) Stable buffer too thin (< 5%)
      const stableValue = wallet
        .filter((w) => ['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD'].includes((w.currency || '').toUpperCase()))
        .reduce((s, w) => s + (w.balance || 0), 0)
      const stablePct = stats.netWorth > 0 ? (stableValue / stats.netWorth) * 100 : 0
      if (stats.netWorth > 1000 && stablePct < 3 && stats.positionsValue > 0) {
        insights.push({
          type: 'recommendation',
          title: 'No Stablecoin Cushion',
          description: `Stables = ${stablePct.toFixed(1)}% of net worth. A 5-15% USDC bucket lets you bid drawdowns without leaving the platform.`,
          confidence: 65, timestamp: now,
        })
      }

      return insights.slice(0, 12)
    } catch (error) {
      console.error('Error generating insights:', error)
      return this.getMockInsights()
    }
  }

  async processQuery(query: string, persona: PersonaId = 'verdexis'): Promise<string> {
    const trimmed = (query || '').trim()
    if (!trimmed) return 'Ask me anything about your portfolio, the market, or a specific asset.'

    // Try server-side LLM first. If it answers we use that; else fall back
    // to the rich local engine below — never silently fail to the user.
    try {
      const context = this.buildPortfolioContext()
      const r = await api.aiChat({ query: trimmed, persona, context })
      if (r.answer) {
        this.history.push({ role: 'user', content: trimmed, timestamp: new Date(), persona })
        this.history.push({ role: 'assistant', content: r.answer, timestamp: new Date(), persona })
        if (this.history.length > 16) this.history = this.history.slice(-16)
        return r.answer
      }
    } catch { /* fall back to local rules */ }

    const intent = classifyIntent(trimmed)
    let answer = ''
    try {
      answer = await this.handleIntent(intent, trimmed, persona)
    } catch (e) {
      console.error('AI handler error:', { intent, prompt: trimmed.slice(0, 200), error: e instanceof Error ? e.message : String(e) })
      answer = "Something went wrong while crunching that — try rephrasing or ask about a specific asset (e.g. 'how is my BTC doing')."
    }

    // Persona-specific framing layered on top of the data answer.
    const styled = this.styleForPersona(answer, persona, intent)

    this.history.push({ role: 'user', content: trimmed, timestamp: new Date(), persona })
    this.history.push({ role: 'assistant', content: styled, timestamp: new Date(), persona })
    if (this.history.length > 16) this.history = this.history.slice(-16)
    return styled
  }

  // -------------------- intent dispatch --------------------

  private async handleIntent(intent: Intent, query: string, _persona: PersonaId): Promise<string> {
    void _persona
    // For most intents we need market + portfolio together
    const needsMarket: Intent[] = [
      'portfolio_overview','portfolio_health','portfolio_risk','allocation','concentration',
      'diversification','asset_quote','asset_signals','compare_assets','market_regime','top_movers',
      'whatif_buy','whatif_sell','rebalance','recommendation','strategy','fundamentals','best_worst',
      'pnl','market_news',
    ]
    const market: CryptoQuote[] = needsMarket.includes(intent)
      ? await marketData.getCryptoList().catch(() => [])
      : []

    switch (intent) {
      case 'greeting':            return this.replyGreeting()
      case 'thanks':              return `Anytime. Want me to ${this.suggestNextStep()}?`
      case 'help':                return this.replyHelp()
      case 'portfolio_overview':  return this.replyPortfolio(market)
      case 'portfolio_health':    return this.replyHealth(market)
      case 'portfolio_risk':      return this.replyRisk(market)
      case 'allocation':          return this.replyAllocation()
      case 'concentration':       return this.replyConcentration()
      case 'diversification':     return this.replyDiversification(market)
      case 'pnl':                 return this.replyPnl()
      case 'best_worst':          return this.replyBestWorst()
      case 'win_rate':            return this.replyWinRate()
      case 'cash_balance':        return this.replyCash()
      case 'rebalance':           return this.replyRebalance(market)
      case 'tax_estimate':        return this.replyTax()
      case 'asset_quote':         return this.replyAssetQuote(query, market)
      case 'asset_signals':       return this.replyAssetSignals(query, market)
      case 'compare_assets':      return this.replyCompare(query, market)
      case 'market_regime':       return this.replyMarketRegime(market)
      case 'market_news':         return this.replyMarketNews()
      case 'top_movers':          return this.replyTopMovers(market)
      case 'deposit_history':     return this.replyDeposits()
      case 'withdraw_history':    return this.replyWithdrawals()
      case 'transaction_history': return this.replyTransactions()
      case 'staking':             return this.replyStaking()
      case 'yield':               return this.replyYield()
      case 'goals':               return this.replyGoals()
      case 'dca':                 return this.replyDca()
      case 'alerts':              return this.replyAlerts()
      case 'watchlist':           return this.replyWatchlist()
      case 'whatif_buy':          return this.replyWhatIfBuy(query, market)
      case 'whatif_sell':         return this.replyWhatIfSell(query, market)
      case 'recommendation':      return this.replyRecommendation(market)
      case 'strategy':            return this.replyStrategy(market)
      case 'fundamentals':        return this.replyFundamentals(query, market)
      case 'unknown':
      default:                    return this.replyFallback(query, market)
    }
  }

  // -------------------- handlers --------------------

  private replyGreeting(): string {
    const h = new Date().getHours()
    const slot = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night'
    const stats = this.snapshot()
    return `Good ${slot.toLowerCase()}. Net worth is **${fmtUsd(stats.netWorth)}** (${fmtPct(stats.lifetimeReturn)} lifetime). Ask me anything — try *"how risky is my portfolio?"*, *"compare BTC vs ETH"*, or *"what if I sell 50% of my BTC?"*`
  }

  private replyHelp(): string {
    return [
      `Here's what I can do — most answers use **your** live data:`,
      ``,
      `**Portfolio**`,
      `• overview, health score, risk metrics (vol, Sharpe, VaR, drawdown)`,
      `• concentration / HHI / effective positions`,
      `• allocation breakdown · cash buffer · stable cushion`,
      `• best & worst performers · win rate · rebalance plan`,
      ``,
      `**Markets**`,
      `• live quote for any asset ("price of SOL")`,
      `• technical signals (RSI, SMA cross, support/resistance)`,
      `• market regime (fear/greed, breadth, BTC dominance)`,
      `• top movers · news headlines`,
      ``,
      `**Money**`,
      `• deposit & withdrawal history (with admin reasons)`,
      `• staking positions & projected yield`,
      `• DCA schedules · goal progress · alerts · watchlist`,
      ``,
      `**What-ifs**`,
      `• "what if I sell 50% of my BTC?"`,
      `• "what if I add $5k to ETH?"`,
      ``,
      `Switch personas in the sidebar to see how Buffett, Munger, Klarman, Wood, Graham or Lynch would frame the same question.`,
    ].join('\n')
  }

  private replyPortfolio(market: CryptoQuote[]): string {
    const s = this.snapshot()
    const regime = computeMarketRegime(market)
    const lines: string[] = []
    lines.push(`**Net worth ${fmtUsd(s.netWorth)}** — positions ${fmtUsd(s.positionsValue)}, cash ${fmtUsd(s.cash)}.`)
    lines.push(`Unrealized P&L **${s.unrealizedPnl >= 0 ? '+' : ''}${fmtUsd(s.unrealizedPnl)}** (${fmtPct(s.unrealizedPnlPct)}) on cost basis ${fmtUsd(s.totalCost)}.`)
    if (s.netDeposited > 0) lines.push(`Lifetime: ${fmtPct(s.lifetimeReturn)} on ${fmtUsd(s.netDeposited)} net deposited.`)
    if (s.topHolding) {
      const w = s.netWorth > 0 ? (s.topHolding.value / s.netWorth) * 100 : 0
      lines.push(`Largest position: **${s.topHolding.symbol}** at ${w.toFixed(0)}% of net worth.`)
    }
    lines.push(`Effective positions ${s.effectivePositions.toFixed(1)} (HHI ${s.hhi.toFixed(0)} — lower is more diversified).`)
    if (regime) lines.push(`Market regime today: **${regime.label}** (F/G ${regime.fearGreed}, breadth ${regime.breadth.toFixed(0)}%).`)
    return lines.join('\n')
  }

  private replyHealth(market: CryptoQuote[]): string {
    const holdings = portfolioStore.getHoldings()
    const wallet = portfolioStore.getWallet()
    const cash = portfolioStore.getWalletValueUsd()
    const positions = holdings.reduce((s, h) => s + (h.value || 0), 0)
    const netWorth = positions + cash
    const h = computePortfolioHealth({ holdings, wallet, market, netWorth })
    if (!h) return `Need at least one position or some cash to score health. Fund the wallet or add a holding first.`
    const lines = [`**Health: ${h.grade} (${h.overall}/100)**`, '']
    for (const sub of h.subScores) {
      lines.push(`• **${sub.label}** ${sub.score}/100 — ${sub.detail}`)
    }
    const weakest = [...h.subScores].sort((a, b) => a.score - b.score)[0]
    if (weakest && weakest.score < 70) {
      lines.push('', `Quick win: improve **${weakest.label.toLowerCase()}** first — biggest score uplift per dollar of work.`)
    }
    return lines.join('\n')
  }

  private replyRisk(market: CryptoQuote[]): string {
    const s = this.snapshot()
    const r = computePortfolioRisk(portfolioStore.getHoldings(), market, s.netWorth)
    if (!r) return `Risk metrics need at least one risk asset with 7d price data. Add a position or wait for the market feed to refresh.`
    const lines = [
      `**Risk grade: ${r.riskGrade}**`,
      `• Annualised volatility (weighted) ~**${r.weightedVolPct.toFixed(0)}%**`,
      `• Weighted Sharpe (rf 4%) **${r.weightedSharpe.toFixed(2)}** — ${r.weightedSharpe > 1 ? 'good' : r.weightedSharpe > 0 ? 'modest' : 'negative — returns not paying for risk'}`,
      `• 95% daily VaR ~**${r.var95Daily.toFixed(2)}%** of portfolio (${fmtUsd(s.netWorth * r.var95Daily / 100)} on a typical bad day)`,
      `• 7d max drawdown (weighted) **${r.weightedDrawdownPct.toFixed(1)}%**`,
    ]
    const corr = btcCorrelation(portfolioStore.getHoldings(), market)
    if (corr !== null) lines.push(`• Correlation to BTC: **${(corr * 100).toFixed(0)}%** ${corr > 0.7 ? '— moves with BTC, low diversification benefit' : corr < 0.3 ? '— meaningfully decoupled' : ''}`)
    return lines.join('\n')
  }

  private replyAllocation(): string {
    const s = this.snapshot()
    const holdings = portfolioStore.getHoldings()
    if (holdings.length === 0) return `No positions yet. Cash balance ${fmtUsd(s.cash)}. Add a holding from the Trade page to see allocation.`
    const sorted = [...holdings].sort((a, b) => b.value - a.value)
    const lines = ['**Current allocation**']
    for (const h of sorted) {
      const w = s.netWorth > 0 ? (h.value / s.netWorth) * 100 : 0
      const bar = '█'.repeat(Math.max(1, Math.round(w / 4))).padEnd(25, '░')
      lines.push(`• ${h.symbol.padEnd(6)} ${w.toFixed(1).padStart(5)}%  ${bar}  ${fmtUsd(h.value)}`)
    }
    if (s.netWorth > 0) {
      const cashW = (s.cash / s.netWorth) * 100
      lines.push(`• ${'CASH'.padEnd(6)} ${cashW.toFixed(1).padStart(5)}%  ${'█'.repeat(Math.max(1, Math.round(cashW / 4))).padEnd(25, '░')}  ${fmtUsd(s.cash)}`)
    }
    return lines.join('\n')
  }

  private replyConcentration(): string {
    const s = this.snapshot()
    if (!s.topHolding) return `No risk assets to be concentrated in — book is all cash.`
    const w = s.netWorth > 0 ? (s.topHolding.value / s.netWorth) * 100 : 0
    let verdict = 'healthy'
    if (w >= 60) verdict = 'extremely concentrated — single point of failure'
    else if (w >= 40) verdict = 'concentrated — meaningful idiosyncratic risk'
    else if (w >= 25) verdict = 'modestly concentrated'
    return [
      `**${s.topHolding.symbol}** is **${w.toFixed(1)}%** of net worth — ${verdict}.`,
      `HHI ${s.hhi.toFixed(0)} · effective positions ${s.effectivePositions.toFixed(1)} (rule of thumb: <2 is fragile, >5 is robust).`,
      w >= 40 ? `To hit 25% target: trim **${fmtUsd(s.topHolding.value - s.netWorth * 0.25)}** of ${s.topHolding.symbol} into 2-3 uncorrelated names.` : '',
    ].filter(Boolean).join('\n')
  }

  private replyDiversification(market: CryptoQuote[]): string {
    const holdings = portfolioStore.getHoldings()
    if (holdings.length === 0) return `Zero risk assets. Start with a 60/40 BTC+ETH split, then layer one or two themes you actually understand.`
    const corr = btcCorrelation(holdings, market)
    const lines = [
      `You hold **${holdings.length}** positions${holdings.length < 4 ? ' — light' : ' — reasonable spread'}.`,
    ]
    if (corr !== null) lines.push(`Portfolio↔BTC correlation: **${(corr * 100).toFixed(0)}%** ${corr > 0.7 ? '(crypto-heavy, single-factor risk)' : corr < 0.3 ? '(well decoupled)' : '(moderate)'}.`)
    lines.push(`Add diversification by mixing: large-cap (BTC/ETH), L1 alts (SOL/AVAX), DeFi (UNI/AAVE), stables (USDC), and ideally a real-world asset bucket.`)
    return lines.join('\n')
  }

  private replyPnl(): string {
    const s = this.snapshot()
    const lines = [
      `**Unrealized P&L: ${s.unrealizedPnl >= 0 ? '+' : ''}${fmtUsd(s.unrealizedPnl)}** (${fmtPct(s.unrealizedPnlPct)}) on ${fmtUsd(s.totalCost)} cost basis.`,
    ]
    if (s.realizedPnl !== 0) lines.push(`Realized (estimate from sell trades): ${s.realizedPnl >= 0 ? '+' : ''}${fmtUsd(s.realizedPnl)} (${fmtPct(s.realizedPnlPct)}).`)
    if (s.netDeposited > 0) lines.push(`Lifetime return on net deposited (${fmtUsd(s.netDeposited)}): **${fmtPct(s.lifetimeReturn)}**.`)
    if (s.bestHolding) lines.push(`Best: ${s.bestHolding.symbol} ${fmtPct(s.bestHolding.pnlPercent)}.`)
    if (s.worstHolding && s.worstHolding !== s.bestHolding) lines.push(`Worst: ${s.worstHolding.symbol} ${fmtPct(s.worstHolding.pnlPercent)}.`)
    return lines.join('\n')
  }

  private replyBestWorst(): string {
    const holdings = portfolioStore.getHoldings()
    if (holdings.length === 0) return 'No holdings yet.'
    const sorted = [...holdings].sort((a, b) => (b.pnlPercent || 0) - (a.pnlPercent || 0))
    const lines = ['**Performance ranking**']
    for (const h of sorted) {
      lines.push(`• ${h.symbol.padEnd(6)} ${fmtPct(h.pnlPercent).padStart(8)}  (${fmtUsd(h.pnl)} on ${fmtUsd(h.value)})`)
    }
    return lines.join('\n')
  }

  private replyWinRate(): string {
    const trades = portfolioStore.getTrades()
    const stats = computeTradeStats(trades, portfolioStore.getHoldings())
    if (stats.count === 0) return `No trades on record yet.`
    return [
      `**${stats.count}** trades · ${stats.buys} buys / ${stats.sells} sells`,
      `Volume: ${fmtBig(stats.totalVolume)} · most-traded: **${stats.mostTradedSymbol ?? 'n/a'}**`,
      stats.sells > 0 ? `Win rate (sells priced above avg cost): **${stats.winRate.toFixed(0)}%**` : '',
      stats.avgHoldDays > 0 ? `Avg hold: **${stats.avgHoldDays.toFixed(1)} days**` : '',
    ].filter(Boolean).join('\n')
  }

  private replyCash(): string {
    const s = this.snapshot()
    const wallet = portfolioStore.getWallet()
    const usd = totalCashFromWallet(wallet)
    const stableValue = wallet
      .filter((w) => ['USDC', 'USDT', 'DAI'].includes((w.currency || '').toUpperCase()))
      .reduce((s2, w) => s2 + (w.balance || 0), 0)
    const cashPct = s.netWorth > 0 ? (s.cash / s.netWorth) * 100 : 0
    const lines = [
      `**Cash: ${fmtUsd(usd)} USD** (${cashPct.toFixed(1)}% of net worth).`,
      stableValue > 0 ? `Stablecoins: ${fmtUsd(stableValue)} (${(s.netWorth > 0 ? stableValue / s.netWorth * 100 : 0).toFixed(1)}%).` : 'No stablecoin position.',
    ]
    if (cashPct < 5) lines.push(`Below 5% — limited optionality if a quality dip appears.`)
    else if (cashPct > 40) lines.push(`Above 40% — capital is idle. Consider parking in USDC at ~4-5% APY or scaling into core convictions on weakness.`)
    else lines.push(`Within the typical 5-30% comfort band.`)
    return lines.join('\n')
  }

  private replyRebalance(market: CryptoQuote[]): string {
    const s = this.snapshot()
    if (s.netWorth === 0) return `Need a funded book to suggest a rebalance. Deposit cash first.`
    const holdings = [...portfolioStore.getHoldings()].sort((a, b) => b.value - a.value)
    if (holdings.length === 0) return `No positions to rebalance. Start by allocating ~60% to your highest-conviction core (often BTC+ETH).`

    // Suggested target: largest position capped at 35%, others scaled proportionally, leave 15% cash.
    const lines = ['**Rebalance plan** (target: top position ≤35%, ~15% cash buffer)']
    const targetCash = s.netWorth * 0.15
    const targetEquity = s.netWorth - targetCash
    const cap = s.netWorth * 0.35

    const trims: string[] = []
    const adds: string[] = []
    let usedEquity = 0
    for (const h of holdings) {
      const target = Math.min(cap, h.value)
      usedEquity += target
      const diff = target - h.value
      if (diff < -1) trims.push(`• Trim **${h.symbol}** by ${fmtUsd(-diff)} (${fmtUsd(h.value)} → ${fmtUsd(target)}).`)
    }
    const remaining = targetEquity - usedEquity
    if (remaining > 50 && holdings.length < 6) {
      const market7 = market
        .filter((m) => !holdings.some((h) => h.symbol.toLowerCase() === m.symbol.toLowerCase()))
        .slice(0, 3)
      for (const m of market7) {
        adds.push(`• Add ~${fmtUsd(remaining / market7.length)} of **${m.symbol.toUpperCase()}** (${m.name}) to broaden exposure.`)
      }
    }
    const cashDiff = targetCash - s.cash
    if (Math.abs(cashDiff) > 25) lines.push(`• ${cashDiff > 0 ? 'Raise' : 'Deploy'} cash by **${fmtUsd(Math.abs(cashDiff))}** (current ${fmtUsd(s.cash)} → target ${fmtUsd(targetCash)}).`)
    lines.push(...trims, ...adds)
    if (trims.length === 0 && adds.length === 0) lines.push(`Allocation already inside the rule-of-thumb bands. No rebalance needed.`)
    return lines.join('\n')
  }

  private replyTax(): string {
    const trades = portfolioStore.getTrades()
    const sells = trades.filter((t) => t.side === 'sell')
    if (sells.length === 0) return `No realized sells this session — nothing to estimate. (I can't see prior tax years; export from /activity for an accountant.)`
    const stats = computeTradeStats(trades, portfolioStore.getHoldings())
    const grossSells = sells.reduce((s, t) => s + (t.total || t.price * t.quantity), 0)
    return [
      `Rough realized P&L estimate: **${stats.count > 0 ? fmtUsd(computeStats(portfolioStore.getHoldings(), 0, [], trades).realizedPnl) : '$0'}** across ${sells.length} sells (gross ${fmtBig(grossSells)}).`,
      `Short-term (held <1y) is taxed as ordinary income; long-term gets the lower long-term rate. I'm not your accountant — export a CSV from Activity for cost-basis-accurate reporting.`,
    ].join('\n')
  }

  private replyAssetQuote(query: string, market: CryptoQuote[]): string {
    const assets = extractMentionedAssets(query, market)
    const target = assets[0] || (this.lastTopicAsset ? market.find((m) => m.symbol.toLowerCase() === this.lastTopicAsset) : null)
    if (!target) return `Tell me which asset — e.g. "price of BTC", "how is SOL doing", "AVAX quote". I cover the top 250 by market cap.`
    this.lastTopicAsset = target.symbol.toLowerCase()
    const sig = computeSignals(target.sparkline_in_7d?.price)
    const lines = [
      `**${target.name} (${target.symbol.toUpperCase()})** — ${fmtUsd(target.current_price)}`,
      `24h: ${fmtPct(target.price_change_percentage_24h)} · range ${fmtUsd(target.low_24h)} – ${fmtUsd(target.high_24h)}`,
      `Volume ${fmtBig(target.total_volume)} · market cap ${fmtBig(target.market_cap)}`,
    ]
    if (sig) lines.push(`7d: trend **${sig.trend}** · ${describeRsi(sig.rsi)} · vol ${sig.vol7d.toFixed(0)}% ann · ${sig.smaCross !== 'none' ? `**${sig.smaCross} SMA cross**` : 'no SMA cross'}`)
    const h = findHolding(portfolioStore.getHoldings(), target.symbol)
    if (h) lines.push(`You hold **${fmtNum(h.quantity, 6)} ${h.symbol}** worth ${fmtUsd(h.value)} (avg ${fmtUsd(h.avgBuyPrice)} · ${fmtPct(h.pnlPercent)}).`)
    return lines.join('\n')
  }

  private replyAssetSignals(query: string, market: CryptoQuote[]): string {
    const assets = extractMentionedAssets(query, market)
    const target = assets[0] || (this.lastTopicAsset ? market.find((m) => m.symbol.toLowerCase() === this.lastTopicAsset) : null)
    if (!target) return `Which asset's signals? Try "RSI on ETH" or "BTC trend".`
    this.lastTopicAsset = target.symbol.toLowerCase()
    const sig = computeSignals(target.sparkline_in_7d?.price)
    if (!sig) return `Not enough sparkline data for ${target.symbol.toUpperCase()} yet — try again in a few minutes.`
    return [
      `**${target.symbol.toUpperCase()} technicals (7d)**`,
      `• Trend: **${sig.trend}** (strength ${sig.trendStrength}/100)`,
      `• ${describeRsi(sig.rsi)}`,
      `• SMA cross: **${sig.smaCross}** (short ${fmtUsd(sig.sma_short)} vs long ${fmtUsd(sig.sma_long)})`,
      `• Annualised vol ~${sig.vol7d.toFixed(0)}% · 7d max drawdown ${sig.drawdown7d.toFixed(1)}%`,
      `• ${Math.abs(sig.vsHigh).toFixed(1)}% from 7d high · ${sig.vsLow.toFixed(1)}% off 7d low`,
    ].join('\n')
  }

  private replyCompare(query: string, market: CryptoQuote[]): string {
    const assets = extractMentionedAssets(query, market)
    if (assets.length < 2) return `Name two assets to compare, e.g. "BTC vs ETH" or "compare SOL and AVAX".`
    const [a, b] = assets
    const sa = computeSignals(a.sparkline_in_7d?.price)
    const sb = computeSignals(b.sparkline_in_7d?.price)
    const lines = [`**${a.symbol.toUpperCase()} vs ${b.symbol.toUpperCase()}**`, '']
    const row = (label: string, va: string, vb: string) => `• ${label.padEnd(18)} ${va.padEnd(20)} ${vb}`
    lines.push(row('Price',          fmtUsd(a.current_price), fmtUsd(b.current_price)))
    lines.push(row('24h change',     fmtPct(a.price_change_percentage_24h), fmtPct(b.price_change_percentage_24h)))
    lines.push(row('Market cap',     fmtBig(a.market_cap), fmtBig(b.market_cap)))
    lines.push(row('24h volume',     fmtBig(a.total_volume), fmtBig(b.total_volume)))
    if (sa && sb) {
      lines.push(row('RSI',          sa.rsi.toFixed(0), sb.rsi.toFixed(0)))
      lines.push(row('Vol (ann)',    `${sa.vol7d.toFixed(0)}%`, `${sb.vol7d.toFixed(0)}%`))
      lines.push(row('SMA cross',    sa.smaCross, sb.smaCross))
      lines.push(row('Trend',        sa.trend, sb.trend))
    }
    return lines.join('\n')
  }

  private replyMarketRegime(market: CryptoQuote[]): string {
    const r = computeMarketRegime(market)
    if (!r) return `Market data not available right now.`
    return [
      `**Regime: ${r.label}** · Fear/Greed proxy **${r.fearGreed}/100**`,
      `• Breadth: ${r.breadth.toFixed(0)}% of top-30 advancing`,
      `• BTC dominance (top-30): ${r.btcDominance.toFixed(1)}%`,
      r.topGainer ? `• Top gainer: **${r.topGainer.symbol.toUpperCase()}** ${fmtPct(r.topGainer.price_change_percentage_24h)}` : '',
      r.topLoser  ? `• Top loser:  **${r.topLoser.symbol.toUpperCase()}** ${fmtPct(r.topLoser.price_change_percentage_24h)}` : '',
      '',
      r.fearGreed < 30 ? 'Fear regimes historically precede the best risk-adjusted entries — but only for assets with surviving fundamentals.'
        : r.fearGreed > 70 ? 'Greed regimes pay for discipline: tighten stops, scale out into euphoria, keep dry powder.'
          : 'Neutral tape — neither aggressive accumulation nor defensive de-risking is obviously right.',
    ].filter(Boolean).join('\n')
  }

  private async replyMarketNews(): Promise<string> {
    const news = await marketData.getMarketNews().catch(() => [] as MarketNews[])
    if (news.length === 0) return `News feed is quiet right now (or offline). Try again in a moment.`
    const top = news.slice(0, 5)
    const lines = ['**Top headlines**']
    for (const n of top) lines.push(`• ${n.headline} *(${n.source})*`)
    return lines.join('\n')
  }

  private replyTopMovers(market: CryptoQuote[]): string {
    if (market.length === 0) return `Market data unavailable.`
    const sorted = [...market].slice(0, 100).sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0))
    const gainers = sorted.slice(0, 5)
    const losers = sorted.slice(-5).reverse()
    const lines = ['**Top gainers (24h)**']
    for (const m of gainers) lines.push(`• ${m.symbol.toUpperCase().padEnd(6)} ${fmtPct(m.price_change_percentage_24h).padStart(8)}  ${fmtUsd(m.current_price)}`)
    lines.push('', '**Top losers (24h)**')
    for (const m of losers) lines.push(`• ${m.symbol.toUpperCase().padEnd(6)} ${fmtPct(m.price_change_percentage_24h).padStart(8)}  ${fmtUsd(m.current_price)}`)
    return lines.join('\n')
  }

  private replyDeposits(): string {
    const txs = portfolioStore.getTransactions()
    const deposits = txs.filter((t) => t.type === 'deposit').sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    if (deposits.length === 0) return `No deposits on record yet. Once admin posts a deposit (or you fund via the Wallet page), it'll appear here with the date and reason.`
    const total = deposits.reduce((s, d) => s + Math.abs(d.amount), 0)
    const avg = total / deposits.length
    const first = deposits[deposits.length - 1].timestamp
    const lines = [
      `**${deposits.length} deposits totalling ${fmtUsd(total)}** (avg ${fmtUsd(avg)} · first on ${first.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}).`,
      '',
      'Most recent:',
    ]
    for (const d of deposits.slice(0, 8)) {
      const when = d.timestamp.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
      const reason = d.description?.trim() ? d.description : 'no reason recorded'
      lines.push(`• ${when} — **+${fmtUsd(Math.abs(d.amount))} ${d.currency}** — ${reason} *(${d.status})*`)
    }
    return lines.join('\n')
  }

  private replyWithdrawals(): string {
    const txs = portfolioStore.getTransactions()
    const w = txs.filter((t) => t.type === 'withdraw').sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    if (w.length === 0) return `No withdrawals on record.`
    const total = w.reduce((s, d) => s + Math.abs(d.amount), 0)
    const lines = [`**${w.length} withdrawals totalling ${fmtUsd(total)}**`, '', 'Most recent:']
    for (const d of w.slice(0, 8)) {
      const when = d.timestamp.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
      lines.push(`• ${when} — **-${fmtUsd(Math.abs(d.amount))} ${d.currency}** — ${d.description || 'no note'} *(${d.status})*`)
    }
    return lines.join('\n')
  }

  private replyTransactions(): string {
    const txs = [...portfolioStore.getTransactions()].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10)
    if (txs.length === 0) return `No wallet transactions yet.`
    const lines = ['**Last 10 wallet transactions**']
    for (const t of txs) {
      const sign = t.type === 'deposit' || t.type === 'dividend' || t.type === 'interest' ? '+' : '-'
      lines.push(`• ${t.timestamp.toLocaleDateString()} — ${t.type.padEnd(8)} ${sign}${fmtUsd(Math.abs(t.amount))} ${t.currency} — ${t.description || '—'}`)
    }
    return lines.join('\n')
  }

  private replyStaking(): string {
    let positions = [] as ReturnType<typeof stakingStore.list>
    try { positions = stakingStore.list() } catch { /* */ }
    if (positions.length === 0) return `No staking positions yet. The Staking page lets you simulate ETH (Lido), SOL (Marinade), USDC (Aave) and more.`
    const lines = ['**Active staking positions**']
    let yearlyUsd = 0
    for (const p of positions) {
      const reward = pendingRewardFor(p)
      const quote = portfolioStore.getQuote(p.asset) || 0
      const yearly = p.principal * p.apy * quote
      yearlyUsd += yearly
      lines.push(`• **${p.asset}** ${fmtNum(p.principal, 4)} @ ${(p.apy * 100).toFixed(2)}% APY on ${p.protocol}`)
      lines.push(`  Pending reward ${fmtNum(reward.rewardAsset, 6)} ${p.asset} · next payout in ${reward.nextPayoutInDays.toFixed(1)}d`)
      if (yearly > 0) lines.push(`  Projected yearly yield: **${fmtUsd(yearly)}**`)
    }
    if (yearlyUsd > 0) lines.push('', `**Total projected yearly yield: ${fmtUsd(yearlyUsd)}**`)
    return lines.join('\n')
  }

  private replyYield(): string {
    return this.replyStaking() // they're effectively the same view
  }

  private replyGoals(): string {
    let goals = [] as ReturnType<typeof goalsStore.list>
    try { goals = goalsStore.list() } catch { return `Goals not loaded.` }
    if (goals.length === 0) return `No goals set. The Goals page lets you define targets like "$100k by next December".`
    const s = this.snapshot()
    const lines = ['**Goals progress**']
    for (const g of goals) {
      const p = progressFor(g, s.netWorth)
      const status = p.onTrack ? '✓ on track' : '! behind pace'
      lines.push(`• **${g.title}** — ${p.pct.toFixed(0)}% of ${fmtUsd(g.target)} · ${p.daysLeft}d left · ${status}`)
      if (!p.onTrack && p.daysLeft > 0) {
        const monthlyNeeded = p.remaining / Math.max(1, p.daysLeft / 30)
        lines.push(`  Need ~${fmtUsd(monthlyNeeded)}/month from here to catch up.`)
      }
    }
    return lines.join('\n')
  }

  private replyDca(): string {
    let schedules = [] as ReturnType<typeof dcaStore.list>
    try { schedules = dcaStore.list() } catch { return `DCA store not loaded.` }
    if (schedules.length === 0) return `No DCA schedules. Try "buy $100 of BTC every 7 days" — set it up on the DCA page.`
    const lines = ['**Active DCA schedules**']
    let weeklyUsd = 0
    for (const s of schedules) {
      const next = nextRunMs(s)
      const inDays = Math.max(0, (next - Date.now()) / 86_400_000)
      const weekly = (s.amountUsd * 7) / s.intervalDays
      if (s.active) weeklyUsd += weekly
      lines.push(`• **${s.asset}** ${fmtUsd(s.amountUsd)} every ${s.intervalDays}d ${s.active ? '' : '(paused)'}`)
      lines.push(`  Next run: ${inDays < 0.04 ? 'imminent' : `in ${inDays.toFixed(1)}d`}${s.lastRun ? ` · last ${new Date(s.lastRun).toLocaleDateString()}` : ''}`)
    }
    lines.push('', `Effective deployment: **${fmtUsd(weeklyUsd)}/week** (${fmtUsd(weeklyUsd * 52)}/year).`)
    return lines.join('\n')
  }

  private async replyAlerts(): Promise<string> {
    try {
      const r = await api.listAlerts()
      if (!r.alerts || r.alerts.length === 0) return `No price alerts set. Add one from the Alerts page (e.g. "BTC above $80k").`
      const active = r.alerts.filter((a) => a.active)
      const lines = [`**${active.length} active alerts** (${r.alerts.length} total)`]
      for (const a of active.slice(0, 8)) {
        lines.push(`• **${a.symbol}** ${a.direction} ${fmtUsd(a.target)}${a.triggered ? ' *(triggered)*' : ''}`)
      }
      return lines.join('\n')
    } catch {
      return `Couldn't reach the alerts service. Check the Alerts page directly.`
    }
  }

  private async replyWatchlist(): Promise<string> {
    try {
      const r = await api.listWatchlist()
      if (!r.watchlist || r.watchlist.length === 0) return `Watchlist is empty. Star assets from the Markets page to track them here.`
      const market = await marketData.getCryptoList().catch(() => [] as CryptoQuote[])
      const lines = [`**Watchlist (${r.watchlist.length})**`]
      for (const w of r.watchlist.slice(0, 10)) {
        const m = market.find((x) => x.symbol.toLowerCase() === w.symbol.toLowerCase())
        if (m) lines.push(`• **${w.symbol}** ${fmtUsd(m.current_price)} (${fmtPct(m.price_change_percentage_24h)})`)
        else lines.push(`• **${w.symbol}** — no live quote`)
      }
      return lines.join('\n')
    } catch {
      return `Couldn't reach the watchlist service.`
    }
  }

  private replyWhatIfBuy(query: string, market: CryptoQuote[]): string {
    const assets = extractMentionedAssets(query, market)
    if (assets.length === 0) return `Tell me which asset and how much, e.g. "what if I buy $5,000 of ETH?".`
    const target = assets[0]
    const amountMatch = query.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*([kKmM])?/)
    let amount = 0
    if (amountMatch) {
      amount = parseFloat(amountMatch[1].replace(/,/g, ''))
      const suf = (amountMatch[2] || '').toLowerCase()
      if (suf === 'k') amount *= 1_000
      else if (suf === 'm') amount *= 1_000_000
    }
    const s = this.snapshot()
    if (amount <= 0) amount = Math.min(s.cash * 0.5, 1000)
    const qty = amount / target.current_price
    const newPositionsValue = s.positionsValue + amount
    const newWeight = (newPositionsValue > 0 ? amount / (newPositionsValue + (s.cash - amount)) : 0) * 100
    return [
      `**Hypothetical buy: ${fmtUsd(amount)} of ${target.symbol.toUpperCase()} @ ${fmtUsd(target.current_price)}**`,
      `• You'd acquire **${fmtNum(qty, 6)} ${target.symbol.toUpperCase()}**`,
      `• New ${target.symbol.toUpperCase()} weight ≈ **${newWeight.toFixed(1)}%** of net worth`,
      `• Cash drops from ${fmtUsd(s.cash)} → ${fmtUsd(Math.max(0, s.cash - amount))} (${((Math.max(0, s.cash - amount) / s.netWorth) * 100).toFixed(1)}%)`,
      amount > s.cash ? `• ⚠️ You don't have enough cash on hand (${fmtUsd(s.cash)}). Deposit first or pick a smaller size.` : '',
    ].filter(Boolean).join('\n')
  }

  private replyWhatIfSell(query: string, market: CryptoQuote[]): string {
    const assets = extractMentionedAssets(query, market)
    const target = assets[0]
    const holding = target ? findHolding(portfolioStore.getHoldings(), target.symbol) : null
    if (!target || !holding) return `Name an asset you actually hold, e.g. "what if I sell 50% of my BTC?".`
    const pctMatch = query.match(/(\d+(?:\.\d+)?)\s*%/)
    const allMatch = /\b(all|everything|full|100)\b/.test(query.toLowerCase())
    let fraction = 0.5
    if (pctMatch) fraction = Math.min(1, Math.max(0, parseFloat(pctMatch[1]) / 100))
    else if (allMatch) fraction = 1
    const qtySold = holding.quantity * fraction
    const proceeds = qtySold * target.current_price
    const costSold = qtySold * holding.avgBuyPrice
    const realized = proceeds - costSold
    const s = this.snapshot()
    return [
      `**Hypothetical sell: ${(fraction * 100).toFixed(0)}% of ${holding.symbol}** (${fmtNum(qtySold, 6)} units)`,
      `• Proceeds **${fmtUsd(proceeds)}** at current ${fmtUsd(target.current_price)}`,
      `• Estimated realized P&L: **${realized >= 0 ? '+' : ''}${fmtUsd(realized)}** vs avg cost ${fmtUsd(holding.avgBuyPrice)}`,
      `• New ${holding.symbol} weight ≈ ${(((holding.value - proceeds) / (s.netWorth)) * 100).toFixed(1)}% of net worth`,
      `• Cash rises ${fmtUsd(s.cash)} → ${fmtUsd(s.cash + proceeds)} (${(((s.cash + proceeds) / s.netWorth) * 100).toFixed(1)}%)`,
      realized > 0 ? `• Tax: short-term gains taxed as ordinary income; >1y holds get long-term rates.` : '',
    ].filter(Boolean).join('\n')
  }

  private replyRecommendation(market: CryptoQuote[]): string {
    const s = this.snapshot()
    const r = computePortfolioRisk(portfolioStore.getHoldings(), market, s.netWorth)
    const regime = computeMarketRegime(market)
    const lines = ['**Recommendations** (data-driven, not financial advice)']

    if (s.netWorth > 0 && (s.cash / s.netWorth) < 0.05 && s.positionsValue > 0)
      lines.push(`• Build cash to 10% (~${fmtUsd(s.netWorth * 0.10 - s.cash)}) — gives you bid-side optionality.`)
    if (s.topHolding && (s.topHolding.value / s.netWorth) > 0.45)
      lines.push(`• Trim **${s.topHolding.symbol}** down toward 30%; rotate proceeds into 2 uncorrelated names.`)
    if (r && r.weightedSharpe < 0)
      lines.push(`• Weighted Sharpe is negative — current positions aren't compensating for their volatility. Cull the worst-Sharpe names.`)
    if (regime && regime.fearGreed < 25)
      lines.push(`• Extreme fear regime (F/G ${regime.fearGreed}). Consider scaling **into** quality on weakness.`)
    if (regime && regime.fearGreed > 80)
      lines.push(`• Extreme greed regime (F/G ${regime.fearGreed}). Tighten stops, take partial profits on overextended positions.`)
    if (s.bestHolding && s.bestHolding.pnlPercent > 30)
      lines.push(`• Lock in part of **${s.bestHolding.symbol}** (+${s.bestHolding.pnlPercent.toFixed(0)}%) — selling 20% pays for the next pullback.`)
    if (s.worstHolding && s.worstHolding.pnlPercent < -25)
      lines.push(`• Re-evaluate **${s.worstHolding.symbol}** (${s.worstHolding.pnlPercent.toFixed(0)}%): does the original thesis still hold? If not, take the loss for tax offset.`)

    if (lines.length === 1) lines.push(`• Book is in good shape — keep DCAing the core, harvest small wins, leave 15% dry powder.`)
    return lines.join('\n')
  }

  private replyStrategy(market: CryptoQuote[]): string {
    void market
    return [
      `**A defensible default playbook** (adapt to your risk tolerance):`,
      `1. **Core (60%)** — BTC + ETH split 60/40, accumulated via weekly DCA.`,
      `2. **Satellites (25%)** — 2-4 high-conviction L1/DeFi names sized 5-8% each, with explicit invalidation levels.`,
      `3. **Yield (10%)** — USDC/USDT in Aave or staked ETH (Lido) for ~4-7% APY drag-reducing cash.`,
      `4. **Cash (5%)** — true dry powder for forced-seller dislocations.`,
      ``,
      `Rules of engagement:`,
      `• Never let one position exceed **35%**.`,
      `• Trim winners by 20% above +50% gain; don't average down without a written thesis.`,
      `• Reassess monthly; rebalance only when a position drifts >10% from target.`,
    ].join('\n')
  }

  private replyFundamentals(query: string, market: CryptoQuote[]): string {
    const assets = extractMentionedAssets(query, market)
    const t = assets[0]
    if (!t) return `Tell me which asset's fundamentals — I'll comment on market cap, volume profile, supply mechanics, and category.`
    return [
      `**${t.name} (${t.symbol.toUpperCase()}) — fundamentals snapshot**`,
      `• Market cap: ${fmtBig(t.market_cap)} · 24h volume: ${fmtBig(t.total_volume)} (turnover ratio ${t.market_cap > 0 ? ((t.total_volume / t.market_cap) * 100).toFixed(2) : '0'}%)`,
      `• 24h range: ${fmtUsd(t.low_24h)} – ${fmtUsd(t.high_24h)}`,
      `• Note: I'm reading market structure, not on-chain fundamentals. For deep-dive I'd cross-check tokenomics (supply schedule, vesting), real revenue (fees, MEV), and category competition.`,
    ].join('\n')
  }

  private replyFallback(query: string, market: CryptoQuote[]): string {
    const assets = extractMentionedAssets(query, market)
    if (assets.length === 1) return this.replyAssetQuote(query, market)
    if (assets.length >= 2) return this.replyCompare(query, market)
    return [
      `I'm not sure what you're asking. Some things I'm great at:`,
      `• "How is my portfolio doing?"  ·  "What's my risk?"`,
      `• "RSI on ETH"  ·  "Compare SOL and AVAX"`,
      `• "Top movers"  ·  "Market regime"`,
      `• "What if I sell 50% of my BTC?"  ·  "Rebalance plan"`,
      `• "Show my deposits"  ·  "Goal progress"  ·  "Staking yield"`,
    ].join('\n')
  }

  // -------------------- shared utilities --------------------

  private snapshot(): PortfolioStats {
    const holdings = portfolioStore.getHoldings()
    const cash = portfolioStore.getWalletValueUsd()
    const txs = portfolioStore.getTransactions()
    const trades = portfolioStore.getTrades()
    return computeStats(holdings, cash, txs, trades)
  }

  private suggestNextStep(): string {
    const opts = ['run a health check', 'show top movers', 'review your concentration', 'check goal progress', 'look at staking yield']
    return opts[Math.floor(Math.random() * opts.length)]
  }

  private buildPortfolioContext(): string {
    try {
      const s = this.snapshot()
      const holdings = portfolioStore.getHoldings()
      const txs = portfolioStore.getTransactions()
      const deposits = txs
        .filter((t) => t.type === 'deposit')
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 10)
      const lines = [
        `Net worth: $${s.netWorth.toFixed(2)} (positions $${s.positionsValue.toFixed(2)}, cash $${s.cash.toFixed(2)})`,
        `Unrealized P&L: ${s.unrealizedPnl >= 0 ? '+' : ''}$${s.unrealizedPnl.toFixed(2)} (${s.unrealizedPnlPct.toFixed(2)}%)`,
        `Lifetime: ${s.lifetimeReturn.toFixed(2)}% on $${s.netDeposited.toFixed(2)} net deposited`,
        `Effective positions: ${s.effectivePositions.toFixed(2)} (HHI ${s.hhi.toFixed(0)})`,
        'Holdings:',
        ...holdings.map((h) => `  - ${h.symbol} ${h.quantity} @ avg $${(h.avgBuyPrice ?? 0).toFixed(2)} | now $${(h.currentPrice ?? 0).toFixed(2)} | value $${(h.value ?? 0).toFixed(2)} | ${h.allocation}% | pnl ${h.pnlPercent.toFixed(1)}%`),
      ]
      if (deposits.length > 0) {
        lines.push('Recent deposits:')
        for (const d of deposits) {
          const when = d.timestamp.toISOString().slice(0, 10)
          lines.push(`  - ${when} +${Math.abs(d.amount).toFixed(2)} ${d.currency} · ${d.description || 'no reason'} · ${d.status}`)
        }
      }
      // Add a brief recent-history slice so the model knows the conversation arc.
      if (this.history.length > 0) {
        lines.push('Recent dialogue (oldest first):')
        for (const m of this.history.slice(-6)) {
          lines.push(`  ${m.role}: ${m.content.slice(0, 200).replace(/\n/g, ' ')}`)
        }
      }
      return lines.join('\n')
    } catch {
      return ''
    }
  }

  // -------------------- persona styling --------------------
  // Layer a persona-specific frame around the data answer instead of just
  // appending a tagline. The data block stays intact; we add a short prelude
  // and (for some intents) a closing rule-of-thumb that matches the lens.

  private styleForPersona(answer: string, persona: PersonaId, intent: Intent): string {
    if (persona === 'verdexis') return answer

    const PRELUDES: Record<Exclude<PersonaId, 'verdexis'>, Partial<Record<Intent, string>>> = {
      buffett: {
        portfolio_overview:  `**Lens — Buffett:** *Forget the ticker tape, look at the business.* Here's your book through that lens:\n\n`,
        recommendation:      `**Lens — Buffett:** *Be fearful when others are greedy. The first rule is don't lose money; the second rule is don't forget the first.*\n\n`,
        whatif_buy:          `**Lens — Buffett:** *Price is what you pay; value is what you get.*\n\n`,
        whatif_sell:         `**Lens — Buffett:** *Our favourite holding period is forever — but never argue with arithmetic.*\n\n`,
        portfolio_risk:      `**Lens — Buffett:** *Risk comes from not knowing what you're doing.* Here are the numbers:\n\n`,
        market_regime:       `**Lens — Buffett:** *The stock market is a device for transferring money from the impatient to the patient.*\n\n`,
        fundamentals:        `**Lens — Buffett:** *Price is what you pay; value is what you get.*\n\n`,
      },
      graham: {
        portfolio_overview:  `**Lens — Graham:** *In the short run the market is a voting machine; in the long run it's a weighing machine.*\n\n`,
        portfolio_risk:      `**Lens — Graham:** *The essence of investment management is the management of risks, not the management of returns.*\n\n`,
        recommendation:      `**Lens — Graham:** *The investor's chief problem — and even his worst enemy — is likely to be himself.*\n\n`,
        whatif_buy:          `**Lens — Graham:** *Demand a margin of safety against your own miscalculation.*\n\n`,
        market_regime:       `**Lens — Graham:** *Mr. Market is moody. Use his prices; ignore his moods.*\n\n`,
      },
      lynch: {
        portfolio_overview:  `**Lens — Lynch:** *Know what you own, and know why you own it.*\n\n`,
        recommendation:      `**Lens — Lynch:** *Behind every stock is a company. Find out what it's doing.*\n\n`,
        asset_signals:       `**Lens — Lynch:** *Charts are great for predicting the past.* Use them as one input, not the thesis.\n\n`,
        fundamentals:        `**Lens — Lynch:** *Tenbaggers hide in plain sight — usually in something you already use.*\n\n`,
        portfolio_risk:      `**Lens — Lynch:** *The real key to making money in stocks is not to get scared out of them.*\n\n`,
      },
      munger: {
        portfolio_overview:  `**Lens — Munger:** *Invert, always invert.* What would have to be true for this book to fail?\n\n`,
        recommendation:      `**Lens — Munger:** *All I want to know is where I'm going to die so I'll never go there.*\n\n`,
        whatif_sell:         `**Lens — Munger:** *The big money is not in the buying or the selling, but in the waiting.*\n\n`,
        portfolio_risk:      `**Lens — Munger:** *It's remarkable how much long-term advantage people like us have gotten by trying to be consistently not stupid.*\n\n`,
      },
      klarman: {
        portfolio_overview:  `**Lens — Klarman:** *Risk is what you didn't see coming. Cash is a position.*\n\n`,
        portfolio_risk:      `**Lens — Klarman:** *The avoidance of loss is the surest way to ensure a profitable outcome.*\n\n`,
        cash_balance:        `**Lens — Klarman:** *Cash is an option on opportunity. Patience compounds.*\n\n`,
        recommendation:      `**Lens — Klarman:** *Where's the asymmetric upside? If you can't articulate it, don't buy it.*\n\n`,
        whatif_buy:          `**Lens — Klarman:** *The single greatest edge is patience.*\n\n`,
      },
      wood: {
        portfolio_overview:  `**Lens — Wood:** *Truly disruptive technologies follow exponential curves. Where's the convexity?*\n\n`,
        asset_signals:       `**Lens — Wood:** *Volatility is the price of admission for outsized returns in innovation.*\n\n`,
        recommendation:      `**Lens — Wood:** *Conviction over consensus. Size the position to your conviction, not the noise.*\n\n`,
        fundamentals:        `**Lens — Wood:** *Look at the S-curve, not the quarterly print.*\n\n`,
      },
    }

    const TAGLINES: Record<Exclude<PersonaId, 'verdexis'>, string> = {
      buffett: '\n\n— *Time is the friend of the wonderful business and the enemy of the mediocre one.*',
      graham:  '\n\n— *Margin of safety, every time.*',
      lynch:   '\n\n— *The simpler the story, the better the trade.*',
      munger:  '\n\n— *Take a simple idea and take it seriously.*',
      klarman: '\n\n— *Cash is an option on opportunity.*',
      wood:    '\n\n— *Bet on exponential change. Conviction over consensus.*',
    }

    const p = persona as Exclude<PersonaId, 'verdexis'>
    const prelude = PRELUDES[p]?.[intent] ?? ''
    const tagline = TAGLINES[p]
    return `${prelude}${answer}${tagline}`
  }

  private getMockInsights(): AIInsight[] {
    return []
  }
}

export const aiService = new AIService()
