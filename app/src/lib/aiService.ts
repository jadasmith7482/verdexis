import { marketData } from './marketData'
import { portfolioStore } from './portfolioStore'
import { api } from './api'

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

class AIService {
  async getPortfolioInsights(): Promise<AIInsight[]> {
    try {
      const cryptoData = await marketData.getCryptoList()
      const news = await marketData.getMarketNews()

      const insights: AIInsight[] = []

      // Analyze BTC trend
      const btc = cryptoData.find((c) => c.id === 'bitcoin')
      if (btc && btc.price_change_percentage_24h > 2) {
        insights.push({
          type: 'recommendation',
          title: 'BTC Momentum Alert',
          description: `Bitcoin is up ${btc.price_change_percentage_24h.toFixed(2)}% in 24h. Consider taking partial profits above $${(btc.current_price * 1.05).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} resistance.`,
          confidence: 78,
          timestamp: new Date(),
        })
      }

      // Analyze ETH
      const eth = cryptoData.find((c) => c.id === 'ethereum')
      if (eth && eth.price_change_percentage_24h < -3) {
        insights.push({
          type: 'alert',
          title: 'ETH Dip Opportunity',
          description: `Ethereum has dropped ${Math.abs(eth.price_change_percentage_24h).toFixed(2)}%. This could be a buying opportunity if support holds at $${(eth.current_price * 0.95).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
          confidence: 65,
          timestamp: new Date(),
        })
      }

      // Market sentiment from news
      if (news.length > 0) {
        const bullishNews = news.filter(
          (n) =>
            n.headline.toLowerCase().includes('surge') ||
            n.headline.toLowerCase().includes('rally') ||
            n.headline.toLowerCase().includes('growth')
        )
        const sentiment = bullishNews.length / news.length

        insights.push({
          type: 'analysis',
          title: 'Market Sentiment Analysis',
          description: `Current market sentiment is ${sentiment > 0.5 ? 'bullish' : 'neutral'} based on recent news flow. ${bullishNews.length} of ${news.length} headlines indicate positive momentum.`,
          confidence: Math.round(sentiment * 100),
          timestamp: new Date(),
        })
      }

      // Diversification recommendation — derived from the user's actual
      // holdings rather than a static "60% BTC" assumption.
      try {
        const holdings = portfolioStore.getHoldings()
        const totalValue = holdings.reduce((s, h) => s + h.value, 0)
        if (totalValue > 0 && holdings.length > 0) {
          const top = holdings.slice().sort((a, b) => b.value - a.value)[0]
          const topPct = (top.value / totalValue) * 100
          if (topPct >= 50) {
            insights.push({
              type: 'recommendation',
              title: 'Portfolio Diversification',
              description: `${top.symbol} is ${topPct.toFixed(0)}% of your portfolio. Concentration above 50% in a single asset increases idiosyncratic risk — consider rebalancing into uncorrelated positions.`,
              confidence: Math.min(95, Math.round(topPct + 20)),
              timestamp: new Date(),
            })
          }
        }
      } catch { /* ignore */ }

      return insights
    } catch (error) {
      console.error('Error generating insights:', error)
      return this.getMockInsights()
    }
  }

  async processQuery(query: string, persona: PersonaId = 'verdexis'): Promise<string> {
    // Try the backend LLM proxy first. It returns 503 when no key is configured;
    // any error falls through to the rule-based answer so the UI still works
    // offline / without an OPENAI_API_KEY on the server.
    try {
      const context = this.buildPortfolioContext()
      const r = await api.aiChat({ query, persona, context })
      if (r.answer) return r.answer
    } catch {
      /* fall back to local rules */
    }
    const lowerQuery = query.toLowerCase()
    const baseAnswer = await this.baseAnswer(lowerQuery)
    return this.flavour(baseAnswer, persona)
  }

  private buildPortfolioContext(): string {
    try {
      const holdings = portfolioStore.getHoldings()
      const cash = portfolioStore.getWalletValueUsd()
      const positions = holdings.reduce((s, h) => s + h.value, 0)
      const total = cash + positions
      const pnl = holdings.reduce((s, h) => s + h.pnl, 0)
      const txs = portfolioStore.getTransactions()
      const deposits = txs
        .filter((t) => t.type === 'deposit')
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 10)
      const totalDeposited = txs
        .filter((t) => t.type === 'deposit')
        .reduce((s, t) => s + Math.abs(t.amount), 0)
      const lines = [
        `Total value: $${total.toFixed(2)} (positions $${positions.toFixed(2)}, cash $${cash.toFixed(2)})`,
        `Unrealized P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
        `Total deposited (lifetime): $${totalDeposited.toFixed(2)}`,
        'Holdings:',
        ...holdings.map((h) => `  - ${h.symbol} ${h.quantity} @ avg $${(h.avgBuyPrice ?? 0).toFixed(2)} | now $${(h.currentPrice ?? 0).toFixed(2)} | value $${(h.value ?? 0).toFixed(2)} | ${h.allocation}%`),
      ]
      if (deposits.length > 0) {
        lines.push('Recent deposits (newest first):')
        for (const d of deposits) {
          const when = d.timestamp.toISOString().slice(0, 10)
          const amt = Math.abs(d.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          const reason = d.description || 'no reason recorded'
          lines.push(`  - ${when} · +${amt} ${d.currency} · ${reason} · ${d.status}`)
        }
      }
      return lines.join('\n')
    } catch {
      return ''
    }
  }

  private flavour(answer: string, persona: PersonaId): string {
    const p = PERSONAS.find((x) => x.id === persona) || PERSONAS[0]
    if (p.id === 'verdexis') return answer
    const tagline: Record<PersonaId, string> = {
      verdexis: '',
      buffett: '\n\n— Be fearful when others are greedy. Look for businesses with durable moats and predictable cash flows.',
      graham: '\n\n— Remember: the market is there to serve you, not instruct you. Demand a margin of safety.',
      lynch: '\n\n— Know what you own and why. The simpler the story, the better the trade.',
      munger: '\n\n— Invert, always invert. What would make this position fail?',
      klarman: '\n\n— Cash is an option on opportunity. Patience compounds.',
      wood: '\n\n— Truly disruptive technologies follow exponential curves. Size the position to your conviction.',
    }
    return `${answer}${tagline[p.id]}`
  }

  private async baseAnswer(lowerQuery: string): Promise<string> {
    try {
      // Portfolio-related queries
      if (lowerQuery.includes('portfolio') || lowerQuery.includes('net worth')) {
        const holdings = portfolioStore.getHoldings()
        const cash = portfolioStore.getWalletValueUsd()
        const positions = holdings.reduce((s, h) => s + h.value, 0)
        const totalValue = cash + positions
        const totalPnl = holdings.reduce((s, h) => s + h.pnl, 0)
        const totalCost = holdings.reduce((s, h) => s + h.avgBuyPrice * h.quantity, 0)
        const pnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0
        const direction = totalPnl >= 0 ? 'up' : 'down'
        const top = holdings.slice().sort((a, b) => b.value - a.value)[0]
        const lines = [
          `Your portfolio is currently worth $${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ($${positions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in positions, $${cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} cash).`,
          `Unrealized P&L is ${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${direction} ${Math.abs(pnlPct).toFixed(2)}%) across ${holdings.length} holding${holdings.length === 1 ? '' : 's'}.`,
        ]
        if (top) lines.push(`Largest position: ${top.name} (${top.symbol}) at ${top.allocation}% of portfolio.`)
        return lines.join(' ')
      }

      // Price-related queries
      if (lowerQuery.includes('price') || lowerQuery.includes('bitcoin') || lowerQuery.includes('btc')) {
        const cryptoData = await marketData.getCryptoList()
        const btc = cryptoData.find((c) => c.id === 'bitcoin')
        if (btc) {
          return `Bitcoin is currently trading at $${btc.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. It's ${btc.price_change_24h >= 0 ? 'up' : 'down'} ${Math.abs(btc.price_change_percentage_24h).toFixed(2)}% in the last 24 hours. The 24h range is $${btc.low_24h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - $${btc.high_24h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
        }
      }

      if (lowerQuery.includes('ethereum') || lowerQuery.includes('eth')) {
        const cryptoData = await marketData.getCryptoList()
        const eth = cryptoData.find((c) => c.id === 'ethereum')
        if (eth) {
          return `Ethereum is currently at $${eth.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. 24h change: ${eth.price_change_percentage_24h >= 0 ? '+' : ''}${eth.price_change_percentage_24h.toFixed(2)}%. Volume: $${(eth.total_volume / 1e9).toFixed(2)}B.`
        }
      }

      // Trading strategy queries
      if (lowerQuery.includes('strategy') || lowerQuery.includes('trade')) {
        return `Without a specific strategy in mind, dollar-cost averaging into your core convictions tends to outperform timing the market for most investors. Tell me which assets you're focused on and I can suggest entry rules, position sizing, and risk caps.`
      }

      // Deposit / funding history — pulls from the wallet transactions which
      // are server-synced from whatever the admin posted (amount, currency,
      // reference/reason, status).
      if (lowerQuery.includes('deposit') || lowerQuery.includes('funded') || lowerQuery.includes('funding') || lowerQuery.includes('top up') || lowerQuery.includes('topped up') || lowerQuery.includes('top-up')) {
        const txs = portfolioStore.getTransactions()
        const deposits = txs
          .filter((t) => t.type === 'deposit')
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        if (deposits.length === 0) {
          return `I don't see any deposits on the account yet. Once admin posts a deposit (or you fund the wallet via the Wallet page), it'll show up here with the date and reason.`
        }
        const total = deposits.reduce((s, d) => s + Math.abs(d.amount), 0)
        const lines = [
          `You've deposited a total of $${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} across ${deposits.length} deposit${deposits.length === 1 ? '' : 's'}.`,
          'Most recent deposits:',
        ]
        for (const d of deposits.slice(0, 6)) {
          const when = d.timestamp.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
          const amt = Math.abs(d.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          const reason = d.description?.trim() ? d.description : 'no reason recorded'
          lines.push(`  • ${when} — +${amt} ${d.currency} — ${reason} (${d.status})`)
        }
        return lines.join('\n')
      }

      // Market analysis
      if (lowerQuery.includes('market') || lowerQuery.includes('analysis')) {
        const news = await marketData.getMarketNews()
        const latestNews = news[0]
        return `Market overview: pulling the latest from real-time feeds.${latestNews?.headline ? ` Top headline right now: "${latestNews.headline}".` : ''} Ask me about a specific asset (e.g. "BTC", "ETH", "AAPL") for live price, 24h range and volume.`
      }

      // Default response
      return `I can help with portfolio analysis, market insights, price checks, and trading strategies. Could you provide more details about what you need? You can also switch personas to see how Buffett, Graham, Lynch, Munger, Klarman, or Wood would frame the same question.`
    } catch (error) {
      console.error('Error processing query:', error)
      return `I'm having trouble reaching live market data right now. Please try again shortly.`
    }
  }

  private getMockInsights(): AIInsight[] {
    // Returning an empty list keeps the UI honest when the live data path
    // fails — we'd rather show "no insights available" than fabricated
    // numbers that could mislead a user's decisions.
    return []
  }
}

export const aiService = new AIService()
