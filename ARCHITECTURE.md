# VERDEXIS - System Architecture

## Overview
VERDEXIS is a premium AI-powered fintech platform combining trading, portfolio management, banking, and AI financial analysis. Built with React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui.

## Brand Identity

### Name Meaning
**VERDEXIS** = "Verde" (Green/Italian for prosperity) + "Nexus" (Connection point)
- Represents the intersection of financial growth and technological connectivity
- Embodies the platform's mission: connecting users to wealth-building opportunities through AI

### Color Palette
| Token | Hex | Usage |
|-------|-----|-------|
| Canvas | #070C0E | Primary background |
| Surface | rgba(15, 22, 25, 0.85) | Card backgrounds |
| Text Primary | #E5E5E5 | Headlines, key data |
| Text Secondary | #A0A0A0 | Body text |
| Text Muted | #737373 | Labels, captions |
| Accent | #0C8B44 | CTAs, positive indicators |
| Accent Glow | rgba(12, 139, 68, 0.3) | Glow effects |
| Card Purple | #6A0DAD | AI feature cards |
| Card Teal | #00838F | Portfolio cards |
| Chart Line | #00E676 | Chart highlights |

### Typography
- **Font**: Inter (Google Fonts)
- **Hero Title**: 80px / weight 300 / -0.04em tracking
- **Section Title**: 48px / weight 300 / -0.03em tracking
- **Body**: 16px / weight 400 / 0.01em tracking
- **Micro**: 12px / weight 400 / 0.05em tracking uppercase

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19 | UI framework |
| TypeScript | 5.7 | Type safety |
| Vite | 7.2 | Build tool |
| Tailwind CSS | 3.4 | Styling |
| shadcn/ui | latest | UI components |
| Three.js | latest | 3D hero effect |
| @react-three/fiber | latest | React Three.js renderer |
| @react-three/drei | latest | Three.js utilities |
| GSAP | latest | Animations |
| Lenis | latest | Smooth scroll |
| Lucide React | latest | Icons |
| React Router DOM | latest | Routing |

### Data Sources (Free APIs)
| API | Free Tier | Purpose |
|-----|-----------|---------|
| Alpha Vantage | 25 calls/day | Stock quotes, fundamentals |
| Finnhub | 60 calls/min | News, WebSocket |
| CoinGecko | 30 calls/min | Crypto prices, market data |
| Twelve Data | 800/day | Backup market data |

## Project Structure
```
src/
├── components/
│   ├── Navigation.tsx      # Global nav with glassmorphism
│   ├── ScrambleText.tsx    # Text scramble animation
│   └── Tetrahedron.tsx     # 3D Sierpinski tetrahedron
├── pages/
│   ├── Home.tsx            # Landing page (hero + dashboard preview)
│   ├── Dashboard.tsx       # Full dashboard (bento grid)
│   ├── Trading.tsx         # Trading interface (chart + order book)
│   ├── AIAssistant.tsx     # AI chat interface
│   └── Wallet.tsx          # Banking/wallet module
├── lib/
│   ├── marketData.ts       # Market data service (API integration)
│   └── aiService.ts        # AI assistant service
├── hooks/                  # Custom React hooks
├── types/                  # TypeScript type definitions
├── App.tsx                 # Root component with routing
├── main.tsx               # Entry point
└── index.css              # Global styles + design tokens
```

## Database Schema (PostgreSQL/Superbase)

### Tables

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  avatar_url TEXT,
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret VARCHAR(255),
  kyc_status VARCHAR(20) DEFAULT 'pending', -- pending, verified, rejected
  kyc_verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'active' -- active, suspended, deleted
);

-- Wallets
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  currency VARCHAR(10) NOT NULL,
  balance DECIMAL(18, 8) DEFAULT 0,
  available_balance DECIMAL(18, 8) DEFAULT 0,
  locked_balance DECIMAL(18, 8) DEFAULT 0,
  address VARCHAR(255), -- for crypto wallets
  network VARCHAR(50), -- for crypto (ERC20, BEP20, etc.)
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, currency)
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES wallets(id),
  type VARCHAR(20) NOT NULL, -- deposit, withdraw, transfer, trade
  status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed, cancelled
  amount DECIMAL(18, 8) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  fee DECIMAL(18, 8) DEFAULT 0,
  from_address VARCHAR(255),
  to_address VARCHAR(255),
  tx_hash VARCHAR(255), -- blockchain transaction hash
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  failed_at TIMESTAMP,
  fail_reason TEXT
);

-- Trading Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL, -- BTC/USD, ETH/USD
  side VARCHAR(10) NOT NULL, -- buy, sell
  type VARCHAR(20) NOT NULL, -- market, limit, stop
  status VARCHAR(20) DEFAULT 'open', -- open, filled, cancelled, expired
  price DECIMAL(18, 8),
  amount DECIMAL(18, 8) NOT NULL,
  filled_amount DECIMAL(18, 8) DEFAULT 0,
  remaining_amount DECIMAL(18, 8),
  total DECIMAL(18, 8),
  fee DECIMAL(18, 8) DEFAULT 0,
  stop_price DECIMAL(18, 8),
  time_in_force VARCHAR(10) DEFAULT 'GTC', -- GTC, IOC, FOK
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  filled_at TIMESTAMP,
  cancelled_at TIMESTAMP
);

-- Portfolio Holdings
CREATE TABLE portfolio_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  asset_symbol VARCHAR(20) NOT NULL,
  asset_name VARCHAR(100),
  asset_type VARCHAR(20) NOT NULL, -- crypto, stock, fiat
  quantity DECIMAL(18, 8) NOT NULL DEFAULT 0,
  average_buy_price DECIMAL(18, 8) NOT NULL DEFAULT 0,
  current_price DECIMAL(18, 8),
  total_value DECIMAL(18, 8),
  unrealized_pnl DECIMAL(18, 8),
  unrealized_pnl_percent DECIMAL(8, 4),
  allocation_percent DECIMAL(5, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, asset_symbol)
);

-- Watchlists
CREATE TABLE watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Watchlist Items
CREATE TABLE watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id UUID REFERENCES watchlists(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  asset_type VARCHAR(20) NOT NULL, -- crypto, stock
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(watchlist_id, symbol)
);

-- AI Chat History
CREATE TABLE ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- user, assistant
  content TEXT NOT NULL,
  model VARCHAR(50),
  tokens_used INTEGER,
  context JSONB, -- portfolio snapshot, market data used
  created_at TIMESTAMP DEFAULT NOW()
);

-- AI Insights
CREATE TABLE ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- recommendation, alert, analysis
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
  asset_symbols VARCHAR(20)[],
  is_read BOOLEAN DEFAULT false,
  is_actioned BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- Price Alerts
CREATE TABLE price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  alert_type VARCHAR(20) NOT NULL, -- above, below, percent_change
  target_price DECIMAL(18, 8),
  percent_threshold DECIMAL(5, 2),
  is_active BOOLEAN DEFAULT true,
  triggered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- API Keys (for external integrations)
CREATE TABLE user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  service VARCHAR(50) NOT NULL, -- alphavantage, finnhub, coingecko
  api_key_encrypted TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  rate_limit_remaining INTEGER,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit Log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50), -- order, wallet, transaction
  resource_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

### Authentication
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
POST /api/auth/2fa/setup
POST /api/auth/2fa/verify
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

### User
```
GET /api/user/profile
PUT /api/user/profile
PUT /api/user/password
GET /api/user/settings
PUT /api/user/settings
POST /api/user/avatar
```

### Market Data
```
GET /api/market/stocks/quote/:symbol
GET /api/market/stocks/search?q=:query
GET /api/market/crypto/list
GET /api/market/crypto/price/:ids
GET /api/market/crypto/chart/:id?days=:days
GET /api/market/news
GET /api/market/trending
```

### Trading
```
POST /api/orders
GET /api/orders
GET /api/orders/:id
DELETE /api/orders/:id
GET /api/orders/history
GET /api/orderbook/:symbol
```

### Portfolio
```
GET /api/portfolio
GET /api/portfolio/holdings
GET /api/portfolio/performance?period=:period
GET /api/portfolio/allocation
GET /api/portfolio/transactions
```

### Wallet
```
GET /api/wallets
POST /api/wallets
GET /api/wallets/:id/balance
POST /api/wallets/:id/deposit
POST /api/wallets/:id/withdraw
POST /api/wallets/transfer
GET /api/wallets/:id/transactions
GET /api/wallets/:id/address
```

### Watchlist
```
GET /api/watchlists
POST /api/watchlists
PUT /api/watchlists/:id
DELETE /api/watchlists/:id
POST /api/watchlists/:id/items
DELETE /api/watchlists/:id/items/:symbol
```

### AI Assistant
```
POST /api/ai/chat
GET /api/ai/insights
GET /api/ai/insights/:id
PUT /api/ai/insights/:id/read
POST /api/ai/insights/:id/action
DELETE /api/ai/chat/history
```

### Alerts
```
GET /api/alerts
POST /api/alerts
PUT /api/alerts/:id
DELETE /api/alerts/:id
GET /api/alerts/history
```

## External API Integration

### Alpha Vantage
```
GET https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={SYMBOL}&apikey={KEY}
GET https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords={QUERY}&apikey={KEY}
GET https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol={SYMBOL}&apikey={KEY}
```

### Finnhub
```
GET https://finnhub.io/api/v1/quote?symbol={SYMBOL}&token={KEY}
GET https://finnhub.io/api/v1/news?category=general&token={KEY}
GET wss://ws.finnhub.io?token={KEY}
```

### CoinGecko
```
GET https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids={IDS}
GET https://api.coingecko.com/api/v3/coins/{ID}/market_chart?days={DAYS}
GET https://api.coingecko.com/api/v3/search?query={QUERY}
```

### Plaid (Sandbox)
```
POST /link/token/create
POST /item/public_token/exchange
GET /accounts/balance/get
GET /transactions/get
```

### Stripe (Test Mode)
```
POST /v1/customers
POST /v1/payment_intents
POST /v1/refunds
GET /v1/balance
```

## Deployment

### Environment Variables
```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/verdexis

# APIs
ALPHA_VANTAGE_API_KEY=your_key
FINNHUB_API_KEY=your_key
COINGECKO_API_KEY=your_key

# Plaid
PLAID_CLIENT_ID=your_id
PLAID_SECRET=your_secret
PLAID_ENV=sandbox

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# AI
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key

# Auth
JWT_SECRET=your_secret
JWT_EXPIRES_IN=7d

# App
VITE_APP_URL=http://localhost:5173
API_URL=http://localhost:3000
```

### Docker Compose
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/verdexis
      - JWT_SECRET=your-secret
    depends_on:
      - db
      - redis

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=verdexis
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

## Security
- JWT-based authentication with refresh tokens
- bcrypt password hashing (12 rounds)
- Rate limiting per IP and user
- Input validation with Zod
- SQL injection prevention via parameterized queries
- XSS protection via Content Security Policy
- CORS configuration
- API key encryption at rest
- Audit logging for all sensitive operations

## Performance
- React.lazy() for code splitting
- API response caching (Redis)
- Image optimization via CDN
- Database indexing on user_id, symbol, created_at
- Connection pooling (PgBouncer)
- WebSocket for real-time price updates
