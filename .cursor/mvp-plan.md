# ARCLE MVP - Phased Development Plan

## MVP Goal

**Core Value Proposition to Demonstrate:**
Users can interact with their blockchain wallet through natural language chat. The AI translates conversational commands into blockchain transactions on Circle's Arc network.

**MVP Success Criteria:**
- ✅ User creates wallet via chat/AI interaction
- ✅ User can send USDC via natural language ("Send $50 to 0x...")
- ✅ User can check balance via chat
- ✅ Basic scam detection blocks high-risk transactions
- ✅ Mobile chat-first UI functional

---

## MVP Scope (What's Included vs. Deferred)

### ✅ Included in MVP:
- Basic wallet creation (Circle Programmable Wallets)
- Send/receive USDC on Arc
- Natural language chat interface (basic commands)
- Basic risk scoring (simple address check)
- Mobile chat UI
- Transaction status tracking
- Basic onboarding (simplified)

### ⏸️ Deferred to Post-MVP:
- Sub-accounts (too complex for MVP)
- Cross-chain bridging (CCTP)
- Scheduled payments
- Advanced scam detection (contract analysis)
- Portfolio dashboard
- Social recovery
- Bill splitting
- Contact book
- ENS support

---

## MVP Phases (5 Phases)

### **MVP Phase 1: Foundation & Setup** (Week 1)
**Goal**: Get basic infrastructure running

**Tasks:**
- [x] **MVP1-T1**: Project structure setup ✅
  - Next.js + TypeScript project ✅
  - Mobile-responsive setup ✅
  - Tailwind CSS + shadcn/ui configured ✅
  - Basic folder structure ✅

- [x] **MVP1-T2**: Circle Developer Services setup ✅
  - Create Circle Developer account ✅
  - Generate testnet API keys ✅
  - Install Circle Wallets SDK (`@circle-fin/developer-controlled-wallets`) ✅
  - Environment variables setup (.env) ✅

- [x] **MVP1-T3**: Arc network connection ✅
  - Arc testnet RPC endpoint setup ✅
  - Viem/Ethers.js configuration ✅
  - Test connection to Arc testnet ✅

- [x] **MVP1-T4**: Basic backend setup ✅
  - Node.js + Next.js API routes ✅
  - TypeScript configuration ✅
  - Basic API routes structure ✅
  - Environment configuration ✅

**Deliverable**: ✅ **COMPLETE** - Project runs locally, can connect to Arc testnet, Circle API keys configured

---

### **MVP Phase 2: Wallet Creation & Core Operations** (Week 2)
**Goal**: Users can create wallets and perform basic operations

**Tasks:**
- [x] **MVP2-T5**: Wallet creation API ✅
  - Circle API integration for wallet creation ✅
  - Master wallet creation flow ✅
  - Store wallet info (localStorage) ✅
  - Return wallet address to frontend ✅

- [x] **MVP2-T6**: Get balance functionality ✅
  - Query USDC balance on Arc ✅
  - Return balance to frontend ✅
  - Format as USD amount ✅
  - Real-time balance updates ✅

- [x] **MVP2-T7**: Send USDC transaction ✅
  - Build transaction via Circle API ✅
  - Estimate gas fees ✅
  - Execute transaction ✅
  - Return transaction hash ✅
  - Transaction preview with risk scoring ✅

- [x] **MVP2-T8**: Transaction status tracking ✅
  - Poll transaction status ✅
  - Return pending/confirmed status ✅
  - Display transaction receipt ✅
  - Auto-refresh balance on confirmation ✅

- [x] **MVP2-T9**: Receive functionality ✅
  - Generate QR code for wallet address ✅
  - Display wallet address ✅
  - Enhanced QR code with instructions ✅

**Deliverable**: ✅ **COMPLETE** - Backend API can create wallets, send/receive USDC, track transactions

---

### **MVP Phase 3: Basic AI Chat Interface** (Week 3)
**Goal**: Basic NLP that understands simple wallet commands

**Tasks:**
- [x] **MVP3-T10**: AI/NLP setup ✅
  - Rule-based AI service implemented ✅
  - Basic prompt engineering ✅
  - Ready for OpenAI/Ollama integration ✅

- [x] **MVP3-T11**: Intent classification ✅
  - Parse user commands ✅:
    - "Send $50 to 0x..." ✅
    - "What's my balance?" ✅
    - "Send 10 USDC to..." ✅
    - "Show my address" ✅
    - Greetings (hi, hello, hey) ✅
  - Extract entities (amount, address, action) ✅

- [x] **MVP3-T12**: Command → API mapping ✅
  - Map parsed intents to backend API calls ✅
  - Send balance → getBalance() ✅
  - Send command → sendTransaction() ✅
  - Show address → getAddress() ✅
  - Transaction history → getTransactions() ✅

- [x] **MVP3-T13**: Response formatting ✅
  - Format AI responses naturally ✅
  - Include transaction confirmations ✅
  - Error messages in conversational tone ✅
  - Natural language greetings ✅

**Deliverable**: ✅ **COMPLETE** - AI can understand basic commands and execute wallet operations

---

### **MVP Phase 4: Basic Scam Protection** (Week 4)
**Goal**: Simple risk detection for transactions

**Tasks:**
- [x] **MVP4-T14**: Basic address validation ✅
  - Check if address is valid format ✅
  - EIP-55 checksum validation ✅
  - Zero address detection ✅

- [x] **MVP4-T15**: Simple risk scoring ✅
  - Risk factors implemented ✅:
    - New address (never seen before) = +20 ✅
    - Zero transaction history = +30 ✅
    - Known scam database check = +50 ✅
    - Large transaction amounts = +10 ✅
  - Simple 0-100 risk score ✅
  - Address history tracking with localStorage ✅

- [x] **MVP4-T16**: Block/warn system ✅
  - Risk > 80: Block transaction ✅
  - Risk 40-80: Warn user, require confirmation ✅
  - Risk < 40: Allow with confirmation ✅
  - Multi-layer safety checks ✅

- [x] **MVP4-T17**: Warning UI ✅
  - Display risk score ✅
  - Show why it's risky (risk reasons) ✅
  - Block button for high-risk (disabled) ✅
  - Confirm button for medium-risk ✅
  - Enhanced warning banners ✅

**Deliverable**: ✅ **COMPLETE** - Basic scam protection blocks high-risk transactions, warns on medium-risk

---

### **MVP Phase 5: Mobile Chat UI** (Week 5)
**Goal**: Functional mobile chat interface

**Tasks:**
- [x] **MVP5-T18**: Chat UI components ✅
  - Message bubble component (user/AI) ✅
  - Chat input field ✅
  - Message history display ✅
  - Mobile-responsive layout ✅

- [x] **MVP5-T19**: Onboarding flow (simplified) ✅
  - Welcome screen with spiral animation ✅
  - "Create Wallet" button ✅
  - Loading state during wallet creation ✅
  - Wallet created confirmation ✅
  - Auto-login on return ✅

- [x] **MVP5-T20**: Transaction preview cards ✅
  - Show transaction details before confirmation ✅
  - Risk score display ✅
  - Risk reasons display ✅
  - Confirm/Cancel buttons ✅
  - Blocked state for high-risk ✅

- [x] **MVP5-T21**: Balance display ✅
  - Show balance in header ✅
  - Update after transactions ✅
  - Real-time balance refresh (30s interval) ✅

- [x] **MVP5-T22**: Transaction status ✅
  - Show pending transactions ✅
  - Update to confirmed ✅
  - Display transaction hash ✅
  - Transaction polling ✅

- [x] **MVP5-T23**: QR code display ✅
  - Generate QR for wallet address ✅
  - Display in chat when user asks for address ✅
  - Enhanced with copy and instructions ✅
  - Transaction history component ✅

**Deliverable**: ✅ **COMPLETE** - Complete mobile chat interface, users can interact via chat

---

### **MVP Phase 6: Integration & Testing** (Week 6)
**Goal**: End-to-end testing and polish

**Tasks:**
- [ ] **MVP6-T24**: End-to-end integration
  - Connect all components
  - Test full flows:
    - Create wallet → Check balance → Send → Confirm
    - Chat commands working end-to-end

- [ ] **MVP6-T25**: Error handling
  - Network errors
  - Invalid commands
  - Transaction failures
  - Friendly error messages

- [ ] **MVP6-T26**: Testing
  - Manual testing of all flows
  - Fix bugs
  - Performance optimization

- [ ] **MVP6-T27**: Polish & Demo prep
  - UI polish
  - Demo script
  - Testnet USDC for demo
  - Demo video/screenshots

**Deliverable**: Complete, working MVP ready for demo

---

## MVP Feature Matrix

| Feature | MVP Phase | Status |
|---------|-----------|--------|
| Wallet Creation | Phase 2 | ✅ Complete |
| Send USDC | Phase 2 | ✅ Complete |
| Receive USDC | Phase 2 | ✅ Complete |
| Check Balance | Phase 2 | ✅ Complete |
| Natural Language Chat | Phase 3 | ✅ Complete |
| Basic Scam Detection | Phase 4 | ✅ Complete |
| Mobile Chat UI | Phase 5 | ✅ Complete |
| Transaction Tracking | Phase 2 | ✅ Complete |
| QR Code Generation | Phase 2 | ✅ Complete |
| Address History Tracking | Phase 4 | ✅ Complete |
| Normalized Addresses | Phase 4 | ✅ Complete |
| Safety Checks | Phase 4 | ✅ Complete |

---

## MVP User Flows

### Flow 1: First-Time User (MVP)
1. Open ARCLE app
2. See welcome screen
3. Tap "Create Wallet"
4. Wait for wallet creation (loading)
5. Wallet created → See balance (0 USDC)
6. AI: "Hi! I'm your wallet assistant. Try: 'Send $10 to 0x...' or 'What's my balance?'"
7. User can start chatting

### Flow 2: Send Money (MVP)
1. User: "Send $50 to 0x1234567890abcdef..."
2. AI parses: amount = $50, address = 0x1234...
3. Risk check: address is new → risk score 30
4. Show preview card: "Send $50 USDC to 0x1234... Risk: 30/100 (Low)"
5. User confirms
6. Transaction executes
7. AI: "✅ Sent! Transaction confirmed. Hash: 0x..."
8. Balance updates

### Flow 3: Check Balance (MVP)
1. User: "What's my balance?" or "Show balance"
2. AI queries balance
3. AI: "Your balance is $1,450.32 USDC on Arc"

### Flow 4: Scam Block (MVP)
1. User: "Send $100 to 0xSCAMADDRESS..."
2. Risk check: Known scam address → risk score 95
3. Warning card: "⚠️ High Risk Transaction (95/100) - Known scam address"
4. Transaction blocked
5. User cannot override

---

## Technical Stack (MVP)

### Frontend:
- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui components
- React hooks for state

### Backend:
- Node.js + Express/Fastify
- TypeScript
- Circle Wallets SDK
- Viem for Arc interactions
- PostgreSQL (simple schema)

### AI/NLP:
- OpenAI API (or Ollama for open-source)
- Basic prompt engineering
- Simple intent classification

### Blockchain:
- Arc Testnet
- Circle Programmable Wallets (testnet)
- USDC on Arc testnet

### Database:
- PostgreSQL (minimal schema):
  - users
  - wallets
  - transactions

---

## MVP Success Metrics

**Technical:**
- ✅ Wallet creation works (100% success rate)
- ✅ Send transactions execute successfully (>95%)
- ✅ AI parses commands correctly (>90%)
- ✅ Scam detection blocks high-risk (>80% accuracy)

**User Experience:**
- ✅ Users can complete send flow in < 2 minutes
- ✅ AI responses feel natural
- ✅ Mobile UI is responsive and smooth

**Demo Ready:**
- ✅ All core flows working
- ✅ Demo script prepared
- ✅ Testnet USDC available
- ✅ No critical bugs

---

## Post-MVP Roadmap

After MVP is complete and validated, add:
1. **Enhanced AI** - Better NLP, more commands
2. **Advanced Scam Detection** - Contract analysis, community signals
3. **Cross-Chain** - CCTP integration
4. **Sub-Accounts** - Budget management
5. **Scheduled Payments** - Recurring transactions
6. **Portfolio Dashboard** - Analytics and visualization
7. **Social Recovery** - Guardian-based recovery

---

## Current Status

**Current Phase**: MVP Phase 6 - Integration & Testing
**Last Updated**: Phase 4 (Scam Protection) completed

**Completed Phases:**
- ✅ **MVP Phase 1**: Foundation & Setup - COMPLETE
- ✅ **MVP Phase 2**: Wallet Creation & Core Operations - COMPLETE
- ✅ **MVP Phase 3**: Basic AI Chat Interface - COMPLETE
- ✅ **MVP Phase 4**: Basic Scam Protection - COMPLETE
- ✅ **MVP Phase 5**: Mobile Chat UI - COMPLETE

**Next Phase:**
- 🔄 **MVP Phase 6**: Integration & Testing - IN PROGRESS

**Team Focus:**
- Complete MVP Phase 6 (Integration & Testing)
- End-to-end testing
- Error handling improvements
- UI polish
- Demo preparation

---

## Quick Start Checklist

Before starting development:
- [ ] Circle Developer account created
- [ ] Arc testnet access confirmed
- [ ] Development environment set up
- [ ] Project repository initialized
- [ ] Team aligned on MVP scope

---

**Note**: This MVP plan focuses on proving the core concept: **"Chat with AI to perform blockchain transactions"**. Additional features will be added incrementally after MVP validation.

