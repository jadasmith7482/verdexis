import { useEffect, useState, useRef } from 'react'
import Navigation from '../components/Navigation'
import { aiService, PERSONAS, type AIInsight, type ChatMessage, type PersonaId } from '../lib/aiService'
import { Toaster } from 'sonner'
import {
  Bot,
  User,
  Send,
  Sparkles,
  Zap,
  AlertTriangle,
  BrainCircuit,
  RefreshCw,
  Target,
} from 'lucide-react'

const quickPrompts = [
  'Analyze my portfolio performance',
  'What are the best trades today?',
  'BTC price prediction',
  'Risk assessment for ETH',
  'Diversification recommendations',
  'Market sentiment analysis',
]

const PERSONA_KEY = 'verdexis_persona'

export default function AIAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "Hello! I'm your AI financial analyst. I can help with portfolio analysis, market insights, trading strategies, and risk assessment. What would you like to know?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [loading, setLoading] = useState(false)
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [persona, setPersona] = useState<PersonaId>(() => (typeof window !== 'undefined' ? (localStorage.getItem(PERSONA_KEY) as PersonaId | null) || 'verdexis' : 'verdexis'))
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem(PERSONA_KEY, persona) }, [persona])

  useEffect(() => {
    loadInsights()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadInsights = async () => {
    setInsightsLoading(true)
    const data = await aiService.getPortfolioInsights()
    setInsights(data)
    setInsightsLoading(false)
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    const response = await aiService.processQuery(userMessage.content, persona)

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      persona,
    }

    setMessages((prev) => [...prev, assistantMessage])
    setLoading(false)
  }

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt)
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Toaster position="top-right" theme="dark" />
      <Navigation />

      <div className="pt-20 pb-8 h-screen">
        <div className="max-w-[1440px] mx-auto px-4 h-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
            {/* Left Sidebar - Insights */}
            <div className="lg:col-span-3 glass-card overflow-hidden flex flex-col">
              <div className="p-4 border-b border-[#ffffff08]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0C8B44] to-[#00E676] flex items-center justify-center">
                      <BrainCircuit className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#E5E5E5]">AI Insights</p>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#4CAF50] animate-pulse" />
                        <span className="text-xs text-[#737373]">Live</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={loadInsights}
                    className="p-2 rounded-lg text-[#737373] hover:text-[#0C8B44] transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${insightsLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-3">
                {insightsLoading ? (
                  Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="p-4 rounded-xl bg-[#1a1a1a]/50 animate-pulse">
                      <div className="h-4 bg-[#ffffff08] rounded w-3/4 mb-2" />
                      <div className="h-3 bg-[#ffffff08] rounded w-full mb-1" />
                      <div className="h-3 bg-[#ffffff08] rounded w-2/3" />
                    </div>
                  ))
                ) : (
                  insights.map((insight, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05] hover:border-[#0C8B44]/20 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        {insight.type === 'recommendation' && (
                          <div className="w-8 h-8 rounded-lg bg-[#0C8B44]/20 flex items-center justify-center shrink-0">
                            <Sparkles className="w-4 h-4 text-[#0C8B44]" />
                          </div>
                        )}
                        {insight.type === 'alert' && (
                          <div className="w-8 h-8 rounded-lg bg-[#F57C00]/20 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-4 h-4 text-[#F57C00]" />
                          </div>
                        )}
                        {insight.type === 'analysis' && (
                          <div className="w-8 h-8 rounded-lg bg-[#2196F3]/20 flex items-center justify-center shrink-0">
                            <Zap className="w-4 h-4 text-[#2196F3]" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-[#E5E5E5]">{insight.title}</p>
                          <p className="text-xs text-[#A0A0A0] mt-1 leading-relaxed">
                            {insight.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#0C8B44] to-[#00E676]"
                                style={{ width: `${insight.confidence}%` }}
                              />
                            </div>
                            <span className="text-xs text-[#737373]">{insight.confidence}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Stats */}
              <div className="p-4 border-t border-[#ffffff08]">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-[#1a1a1a]/50 text-center">
                    <p className="text-lg font-light text-[#0C8B44]">87%</p>
                    <p className="text-xs text-[#737373]">Accuracy</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#1a1a1a]/50 text-center">
                    <p className="text-lg font-light text-[#2196F3]">2.4x</p>
                    <p className="text-xs text-[#737373]">ROI</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Chat Area */}
            <div className="lg:col-span-9 glass-card overflow-hidden flex flex-col">
              {/* Chat Header */}
              <div className="p-4 border-b border-[#ffffff08]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0C8B44] to-[#00E676] flex items-center justify-center">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#E5E5E5]">VERDEXIS AI</p>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#4CAF50] animate-pulse" />
                        <span className="text-xs text-[#737373]">{PERSONAS.find(p => p.id === persona)?.title} • Online</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={persona}
                      onChange={(e) => setPersona(e.target.value as PersonaId)}
                      className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#ffffff10] text-xs text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]/40"
                      title="Switch investor persona"
                    >
                      {PERSONAS.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <div className="px-3 py-1.5 rounded-lg bg-[#0C8B44]/20 text-xs text-[#0C8B44] flex items-center gap-1.5">
                      <Target className="w-3 h-3" />
                      Pro Mode
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-[#737373] italic">"{PERSONAS.find(p => p.id === persona)?.philosophy}"</p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        msg.role === 'assistant'
                          ? 'bg-gradient-to-br from-[#0C8B44] to-[#00E676]'
                          : 'bg-[#1a1a1a] border border-[#ffffff10]'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <Bot className="w-4 h-4 text-white" />
                      ) : (
                        <User className="w-4 h-4 text-[#A0A0A0]" />
                      )}
                    </div>
                    <div
                      className={`max-w-[70%] p-4 rounded-2xl ${
                        msg.role === 'assistant'
                          ? 'bg-[#0C8B44]/10 border border-[#0C8B44]/20 text-[#E5E5E5] rounded-tl-sm'
                          : 'bg-[#1a1a1a] text-[#E5E5E5] rounded-tr-sm'
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-xs text-[#737373] mt-2">{formatTime(msg.timestamp)}</p>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0C8B44] to-[#00E676] flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="p-4 rounded-2xl bg-[#0C8B44]/10 border border-[#0C8B44]/20 rounded-tl-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#0C8B44] animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-[#0C8B44] animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-[#0C8B44] animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompts — persona-aware */}
              {messages.length <= 2 && (() => {
                const personaObj = PERSONAS.find(p => p.id === persona)
                const prompts = personaObj?.prompts ?? quickPrompts
                return (
                  <div className="px-4 pb-2">
                    <p className="text-xs text-[#737373] mb-2">Try with <span style={{ color: personaObj?.color }}>{personaObj?.name}</span>:</p>
                    <div className="flex flex-wrap gap-2">
                      {prompts.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => handleQuickPrompt(prompt)}
                          className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#ffffff08] text-xs text-[#A0A0A0] hover:text-[#0C8B44] hover:border-[#0C8B44]/30 transition-colors"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Input Area */}
              <div className="p-4 border-t border-[#ffffff08]">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask about your portfolio, market trends, or trading strategies..."
                    className="flex-1 px-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44] transition-colors"
                  />
                  <button
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    className="w-10 h-10 rounded-xl bg-[#0C8B44] flex items-center justify-center hover:bg-[#0a7539] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
