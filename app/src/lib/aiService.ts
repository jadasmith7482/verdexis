import { marketData } from './marketData'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
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
          description: `Bitcoin is up ${btc.price_change_percentage_24h.toFixed(2)}% in 24h. Consider taking partial profits above $${(btc.current_price * 1.05).toFixed(0)} resistance.`,
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
          description: `Ethereum has dropped ${Math.abs(eth.price_change_percentage_24h).toFixed(2)}%. This could be a buying opportunity if support holds at $${(eth.current_price * 0.95).toFixed(0)}.`,
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

      // Diversification recommendation
      insights.push({
        type: 'recommendation',
        title: 'Portfolio Diversification',
        description:
          'Based on current market conditions, consider increasing allocation to SOL and DOT for better risk-adjusted returns. Your portfolio is currently overweight in BTC.',
        confidence: 82,
        timestamp: new Date(),
      })

      return insights
    } catch (error) {
      console.error('Error generating insights:', error)
      return this.getMockInsights()
    }
  }

  async processQuery(query: string): Promise<string> {
    const lowerQuery = query.toLowerCase()

    try {
      // Portfolio-related queries
      if (lowerQuery.includes('portfolio') || lowerQuery.includes('net worth')) {
        const cryptoData = await marketData.getCryptoList()
        const totalValue = cryptoData
          .slice(0, 5)
          .reduce((sum, c) => sum + c.current_price * 10, 0)
        return `Your current portfolio is valued at approximately $${totalValue.toLocaleString()}. Based on today's market movements, you're ${totalValue > 50000 ? 'up' : 'down'} ${(Math.random() * 5).toFixed(2)}%. Would you like a detailed breakdown?`
      }

      // Price-related queries
      if (lowerQuery.includes('price') || lowerQuery.includes('bitcoin') || lowerQuery.includes('btc')) {
        const cryptoData = await marketData.getCryptoList()
        const btc = cryptoData.find((c) => c.id === 'bitcoin')
        if (btc) {
          return `Bitcoin is currently trading at $${btc.current_price.toLocaleString()}. It's ${btc.price_change_24h >= 0 ? 'up' : 'down'} ${Math.abs(btc.price_change_percentage_24h).toFixed(2)}% in the last 24 hours. The 24h range is $${btc.low_24h.toLocaleString()} - $${btc.high_24h.toLocaleString()}.`
        }
      }

      if (lowerQuery.includes('ethereum') || lowerQuery.includes('eth')) {
        const cryptoData = await marketData.getCryptoList()
        const eth = cryptoData.find((c) => c.id === 'ethereum')
        if (eth) {
          return `Ethereum is currently at $${eth.current_price.toLocaleString()}. 24h change: ${eth.price_change_percentage_24h >= 0 ? '+' : ''}${eth.price_change_percentage_24h.toFixed(2)}%. Volume: $${(eth.total_volume / 1e9).toFixed(2)}B.`
        }
      }

      // Trading strategy queries
      if (lowerQuery.includes('strategy') || lowerQuery.includes('trade')) {
        return `Based on current market analysis, I'm seeing strong support levels for BTC at $65,000 and ETH at $3,400. A dollar-cost averaging strategy with weekly purchases could be effective in this volatile environment. Would you like me to set up automated trades?`
      }

      // Market analysis
      if (lowerQuery.includes('market') || lowerQuery.includes('analysis')) {
        const news = await marketData.getMarketNews()
        const latestNews = news[0]
        return `Market overview: The crypto market is showing mixed signals today. ${latestNews?.headline || 'Institutional inflows remain strong'}. Key levels to watch: BTC resistance at $68,000, ETH resistance at $3,600. Overall sentiment is cautiously bullish based on on-chain metrics.`
      }

      // Default response
      return `I understand you're asking about "${query}". As your AI financial analyst, I can help with portfolio analysis, market insights, price checks, and trading strategies. Could you provide more details about what specific information you need?`
    } catch (error) {
      console.error('Error processing query:', error)
      return `I apologize, but I'm having trouble accessing real-time market data right now. However, I can tell you that based on recent trends, diversification across BTC, ETH, and SOL remains a solid strategy. What specific aspect of your portfolio would you like to discuss?`
    }
  }

  private getMockInsights(): AIInsight[] {
    return [
      {
        type: 'recommendation',
        title: 'BTC Momentum Alert',
        description:
          'Bitcoin is up 2.4% in 24h. Consider taking partial profits above $70,000 resistance.',
        confidence: 78,
        timestamp: new Date(),
      },
      {
        type: 'alert',
        title: 'ETH Dip Opportunity',
        description:
          'Ethereum has dropped 1.8%. This could be a buying opportunity if support holds at $3,400.',
        confidence: 65,
        timestamp: new Date(),
      },
      {
        type: 'analysis',
        title: 'Market Sentiment Analysis',
        description:
          'Current market sentiment is bullish based on recent news flow. Institutional inflows remain strong.',
        confidence: 72,
        timestamp: new Date(),
      },
      {
        type: 'recommendation',
        title: 'Portfolio Diversification',
        description:
          'Consider increasing SOL allocation by 5% for better risk-adjusted returns. Your portfolio is currently 60% BTC.',
        confidence: 82,
        timestamp: new Date(),
      },
    ]
  }
}

export const aiService = new AIService()
