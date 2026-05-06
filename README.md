# VERDEXIS - AI-Powered Fintech Platform

## Live URL
**https://6ourstyon7pic.kimi.page**

## Overview
VERDEXIS is a premium fintech platform that combines AI-powered trading, portfolio management, net-worth tracking, and intelligent financial analysis. Built with a dark-mode glassmorphic UI featuring a 3D animated Sierpinski tetrahedron hero effect.

## Brand Identity

### Logo & Visual Assets
- **Primary Logo**: Geometric crystalline "V" symbol with emerald green gradient
- **Icon-Only**: Standalone diamond-facet "V" for app icon usage
- **Color Palette**: Dark canvas (#070C0E) with emerald green accents (#0C8B44)
- **Typography**: Inter font family, ultra-light weights for premium feel

### Generated Assets (in `/design/` and `/public/assets/`)
- `logo-primary-dark.png` - Main logo on dark background
- `logo-icon-dark.png` - Icon-only version
- `logo-primary-light.png` - Light mode variant
- `ui-dashboard.png` - Dashboard UI mockup
- `ui-trading.png` - Trading screen mockup
- `ui-ai-assistant.png` - AI chat interface mockup
- `ui-mobile-wallet.png` - Mobile wallet screen mockup

## Features

### 1. Home Page (Landing)
- **3D Hero**: Sierpinski tetrahedron rendered in Three.js with custom shaders
- **Text Scramble Effect**: Animated character decoding for hero title
- **ASCII Grain Overlay**: Subtle dot-matrix texture for analog warmth
- **Dashboard Preview**: Bento grid with liquid card fill hover effects
- **AI Chat Preview**: Interactive chat interface preview
- **Features Grid**: 6 key feature cards with hover animations

### 2. Dashboard (Full)
- **Net Worth Card**: Large balance display with 30-day chart
- **AI Insights Panel**: Real-time AI-generated recommendations with confidence scores
- **Portfolio Breakdown**: Interactive pie chart with allocation percentages
- **Market Overview**: Live crypto prices with sparkline charts
- **Quick Actions**: Deposit, Withdraw, Transfer, Trade buttons

### 3. Trading Interface
- **Symbol Search**: Real-time crypto search and selection
- **Candlestick Chart**: OHLC visualization with time range selection (1H to 1Y)
- **Order Book**: Asks/Bids display with depth visualization
- **Recent Trades**: Live trade history feed
- **Order Form**: Market/Limit/Stop orders with buy/sell toggle
- **Watchlist**: Star favorites for quick access

### 4. AI Financial Assistant
- **Chat Interface**: Full-screen chat with message history
- **Quick Prompts**: Pre-built queries for common requests
- **AI Insights Panel**: Sidebar with live recommendations
- **Confidence Scoring**: Visual confidence indicators for each insight
- **Real-time Analysis**: Portfolio analysis using live market data

### 5. Wallet / Banking
- **Multi-Currency**: USD, BTC, ETH, SOL balances
- **Transaction History**: Filtered by type with status indicators
- **Deposit**: Bank transfer (ACH) and crypto address deposit
- **Withdraw**: Fiat and crypto withdrawals with fee display
- **Transfer**: Cross-currency transfers with exchange rates

## Real Market Data Integration

### Free APIs Used
| API | Free Tier | Data |
|-----|-----------|------|
| Alpha Vantage | 25 calls/day | Stock quotes, search |
| Finnhub | 60 calls/min | News, WebSocket |
| CoinGecko | 30 calls/min | Crypto prices, charts |

### Caching Strategy
- In-memory cache with 60-second TTL
- Graceful fallback to mock data on API failure
- Rate limit tracking per API

## Tech Stack
- **React 19** + TypeScript
- **Vite 7** (build tool)
- **Tailwind CSS 3.4** + shadcn/ui
- **Three.js** + @react-three/fiber (3D hero)
- **GSAP** + ScrollTrigger (animations)
- **Lucide React** (icons)
- **React Router DOM** (routing)

## Database Schema
Full PostgreSQL schema in `ARCHITECTURE.md` including:
- Users (auth, 2FA, KYC)
- Wallets (multi-currency)
- Transactions (deposit/withdraw/transfer)
- Orders (trading)
- Portfolio Holdings
- AI Chat History & Insights
- Watchlists & Alerts
- Audit Log

## API Endpoints
Complete REST API specification in `ARCHITECTURE.md`:
- Authentication (register, login, 2FA, password reset)
- Market Data (stocks, crypto, news)
- Trading (orders, orderbook)
- Portfolio (holdings, performance, allocation)
- Wallet (deposit, withdraw, transfer)
- AI Assistant (chat, insights)
- Alerts (price alerts)

## File Structure
```
verdexis/
├── public/
│   └── assets/           # Generated logos and UI mockups
├── src/
│   ├── components/
│   │   ├── Navigation.tsx
│   │   ├── ScrambleText.tsx
│   │   └── Tetrahedron.tsx
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Trading.tsx
│   │   ├── AIAssistant.tsx
│   │   └── Wallet.tsx
│   ├── lib/
│   │   ├── marketData.ts
│   │   └── aiService.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── design/               # Design assets and PRD
├── ARCHITECTURE.md       # Full system architecture
└── README.md
```

## Getting Started
```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Variables
Copy [`app/.env.example`](app/.env.example) to `app/.env.local` and fill in your free API keys:

```env
# Vite client-side keys (must be prefixed with VITE_)
VITE_ALPHA_VANTAGE_KEY=your_key
VITE_FINNHUB_KEY=your_key
```

CoinGecko public endpoints work without a key. Without keys, the app falls back to realistic demo data.

## Deployment
The platform is deployed at: **https://6ourstyon7pic.kimi.page**

## License
MIT
