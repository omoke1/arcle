# ARCLE Agent System - Complete Flow & Architecture

## 🎯 Overview

ARCLE uses a **multi-agent architecture** where specialized agents handle different financial and commerce operations. All agents work together through a central **Agent Router** that intelligently routes user requests to the right agent.

---

## 📊 System Flow Diagram

```
User Message (Chat UI)
    ↓
Intent Classifier (extracts: intent, entities, amount, address, etc.)
    ↓
Agent Router (matches intent to agent)
    ↓
┌─────────────────────────────────────────┐
│  Specialized Agent (handles request)    │
│  - Payments Agent                       │
│  - Commerce Agent                       │
│  - Dispatch Agent                       │
│  - Vendor Agent                         │
│  - etc.                                 │
└─────────────────────────────────────────┘
    ↓
INERA Agent (orchestrates execution)
    ↓
Circle SDK (actual blockchain operations)
    ↓
Response back to User
```

---

## 🔄 Complete Message Flow

### Step 1: User Sends Message
- User types in `ChatInput` component
- Message sent to `/api/chat` or processed in `app/chat/page.tsx`

### Step 2: Intent Classification
- `IntentClassifier.classify(message)` extracts:
  - **Intent**: "send", "order", "bridge", "balance", etc.
  - **Entities**: amount, address, currency, vendor, etc.

### Step 3: Agent Router Decision
- `routeToAgent()` checks `AGENT_ROUTES` array
- Matches intent keywords to agent (priority-based)
- Example: "order pizza" → `commerce` agent

### Step 4: Agent Processing
- Agent's `handle()` method processes request
- Agent can:
  - Return immediate response
  - Request confirmation (`requiresConfirmation: true`)
  - Delegate to INERA for execution
  - Call other agents

### Step 5: Execution (if needed)
- If action requires blockchain operation:
  - Agent calls `INERAAgent.executePayment()` or similar
  - INERA uses **session keys** for automatic execution
  - Or falls back to user PIN approval

### Step 6: Response
- Agent returns `AgentResponse` with:
  - `message`: User-friendly text
  - `success`: Boolean
  - `data`: Structured data (order ID, tx hash, etc.)
  - `requiresConfirmation`: If user needs to confirm

---

## 🤖 All Agents & Their Roles

### 1. **INERA Agent** (`agents/inera/`)
**Role**: Core orchestration agent - executes all financial operations

**Responsibilities**:
- Executes payments via Circle SDK
- Manages session keys for automatic transactions
- Handles bridge/cross-chain operations
- Orchestrates batch operations
- Default fallback for unmatched intents

**Keywords**: Default catch-all, orchestration

**Flow**:
```
User: "Send $50 to 0x123..."
→ Payments Agent → INERA Agent
→ INERA.executePayment()
→ Circle SDK transaction
→ Success response
```

---

### 2. **Payments Agent** (`agents/payments/`)
**Role**: Handles all payment operations

**Responsibilities**:
- Direct wallet-to-wallet transfers
- Phone number payments (resolves to wallet via contacts)
- Email payments (resolves to wallet via contacts)
- One-time payment links (24h expiration)
- QR code payment links
- Recurring payments

**Keywords**: `send`, `pay`, `transfer`, `payment`, `send money`

**Flow**:
```
User: "Send $25 to +1234567890"
→ Payments Agent
→ Resolves phone to wallet (contacts service)
→ INERA.executePayment()
→ Transaction executed
```

**Special Features**:
- Phone/Email resolution via Supabase contacts
- Payment link generation with QR codes
- Recurring payment scheduling

---

### 3. **Commerce Agent** (`agents/commerce/`)
**Role**: Handles order placement and vendor interactions

**Responsibilities**:
- Lists partner vendors (from Supabase or fallback)
- Guides users through order placement
- Creates vendor orders in database
- Integrates with payment flow
- Works with Dispatch Agent for delivery

**Keywords**: `order`, `purchase`, `buy`, `delivery`, `shipment`

**Flow**:
```
User: "Order pizza from Night Owl Pizza for $25"
→ Commerce Agent
→ Fetches vendors from Supabase
→ Validates order details
→ Creates order in vendor_orders table
→ Requests confirmation
→ On confirm: Creates order + processes payment
```

**Integration**:
- Works with **Vendor Agent** for order status
- Works with **Dispatch Agent** for delivery
- Creates orders via `/api/commerce/orders`

---

### 4. **Dispatch Agent** (`agents/dispatch/`) ⭐ NEW
**Role**: Manages order delivery and rider assignment

**Responsibilities**:
- Assigns dispatchers/riders to orders
- Tracks delivery status
- Updates dispatch job status
- Calculates ETAs
- Manages dispatcher availability

**Keywords**: `dispatch`, `assign rider`, `track delivery`, `rider`, `courier`, `delivery status`

**Flow**:
```
Order status: "ready"
→ Dispatch Agent
→ findAvailableDispatcher()
→ createDispatchJob()
→ Updates order to "dispatched"
→ Assigns rider
→ Tracks delivery until "delivered"
```

**Database**:
- Uses `dispatchers` table (riders)
- Uses `dispatch_jobs` table (delivery assignments)
- Updates `vendor_orders` with dispatcher_id

---

### 5. **Vendor Agent** (`agents/vendor/`) ⭐ NEW
**Role**: Handles vendor operations (inventory, order management)

**Responsibilities**:
- Queries vendor inventory/menu
- Gets order status
- Accepts orders (changes status: pending → accepted)
- Marks orders as ready (accepted → ready)
- Updates order metadata

**Keywords**: `vendor inventory`, `vendor menu`, `accept order`, `mark ready`, `order status`, `vendor order`

**Flow**:
```
Vendor: "Accept order #ORD-123"
→ Vendor Agent
→ updateVendorOrderStatus({ status: 'accepted' })
→ Order status updated in database
→ User gets notification
```

**API Integration**:
- Uses `/api/vendors/orders` for order management
- Uses `/api/vendors/inventory` for inventory CRUD

---

### 6. **Invoice Agent** (`agents/invoice/`)
**Role**: Creates and manages invoices

**Responsibilities**:
- Creates invoices
- Generates payment links
- Tracks invoice payments
- QR code generation for invoices

**Keywords**: `invoice`, `bill`, `create invoice`, `payment link`, `invoice link`

---

### 7. **Remittance Agent** (`agents/remittance/`)
**Role**: Handles cross-chain transfers and remittances

**Responsibilities**:
- Cross-chain USDC transfers (CCTP)
- Bridge operations (Gateway fallback)
- FX integration for currency conversion
- Remittance workflows

**Keywords**: `remittance`, `send remittance`, `cross-border`, `cctp`, `bridge`

**Flow**:
```
User: "Bridge $100 from Arc to Base"
→ Remittance Agent
→ Checks CCTP availability
→ Falls back to Gateway if needed
→ Executes bridge via INERA
→ Monitors completion
```

---

### 8. **DeFi Agent** (`agents/defi/`)
**Role**: Handles DeFi operations (yield, swaps, liquidity)

**Responsibilities**:
- Yield farming strategies
- Token swaps
- Liquidity provision
- Arbitrage opportunities
- Limit orders

**Keywords**: `swap`, `trade`, `yield`, `earn`, `liquidity`, `arbitrage`, `rebalance`

---

### 9. **FX Agent** (`agents/fx/`)
**Role**: Currency conversion and FX operations

**Responsibilities**:
- Currency conversion rates
- FX swaps
- Market data
- Rate alerts

**Keywords**: `convert`, `fx`, `currency`, `exchange rate`, `fx rate`

---

### 10. **Insights Agent** (`agents/insights/`)
**Role**: Analytics and reporting

**Responsibilities**:
- Balance summaries
- Transaction history analysis
- Spending reports
- Dashboard data

**Keywords**: `balance`, `analytics`, `report`, `spending`, `transactions`, `history`, `dashboard`, `summary`

---

### 11. **Merchant Agent** (`agents/merchant/`)
**Role**: Point-of-sale and merchant operations

**Responsibilities**:
- POS transactions
- Merchant settlements
- Payment processing

**Keywords**: `pos`, `point of sale`, `merchant`, `settlement`, `merchant settlement`

---

### 12. **Compliance Agent** (`agents/compliance/`)
**Role**: Security and compliance checks

**Responsibilities**:
- KYC verification
- Risk scoring
- Fraud detection
- Address validation

**Keywords**: `kyc`, `verify`, `compliance`, `risk`, `fraud`

---

### 13. **Local Accounts Agent** (`agents/local-accounts/`)
**Role**: Fiat account management (NGN, etc.)

**Responsibilities**:
- Local fiat balances
- Bank account integration
- Fiat ↔ USDC conversion

**Keywords**: `local account`, `ngn account`, `bank account`, `ngn balance`, `local balance`

---

## 🔗 Agent Interactions & Workflows

### Example 1: Complete Order → Delivery Flow

```
1. User: "Order pizza from Night Owl Pizza for $25"
   → Commerce Agent
   → Lists vendors, asks for confirmation

2. User: "Yes, confirm"
   → Commerce Agent
   → Creates order in vendor_orders (status: "pending")
   → Processes payment via Payments Agent → INERA
   → Order created with payment_hash

3. Vendor: "Accept order #ORD-123"
   → Vendor Agent
   → Updates order status: "pending" → "accepted"

4. Vendor: "Mark order #ORD-123 as ready"
   → Vendor Agent
   → Updates order status: "accepted" → "ready"

5. System: Auto-assigns rider
   → Dispatch Agent
   → findAvailableDispatcher()
   → createDispatchJob()
   → Updates order: "ready" → "dispatched"
   → Assigns dispatcher_id

6. User: "Track my order"
   → Dispatch Agent
   → Returns delivery status, ETA, rider info

7. Rider delivers
   → Dispatch Agent (via API or chat)
   → Updates dispatch_job: "in_transit" → "delivered"
   → Updates order: "dispatched" → "delivered"
```

### Example 2: Payment Flow

```
1. User: "Send $50 to john@example.com"
   → Payments Agent
   → Resolves email to wallet via contacts service
   → INERA.executePayment()
   → Circle SDK transaction
   → Success: Transaction hash returned
```

### Example 3: Bridge Flow

```
1. User: "Bridge $100 from Arc to Base"
   → Remittance Agent
   → Validates route
   → Checks CCTP availability
   → Falls back to Gateway if needed
   → INERA.executeBridge()
   → Monitors completion
   → Updates user on status
```

---

## 🗄️ Data Flow & Persistence

### Supabase Tables Used

1. **Users** (`users`)
   - Maps Circle user IDs → Supabase UUIDs
   - Stores wallet addresses

2. **Sessions** (`sessions`)
   - Conversation sessions
   - Agent state storage

3. **Messages** (`messages`)
   - Chat history per session

4. **Vendors** (`vendors`) ⭐ NEW
   - Partner businesses
   - Wallet addresses for payments

5. **Vendor Items** (`vendor_items`) ⭐ NEW
   - Inventory/menu items
   - Prices, availability

6. **Vendor Orders** (`vendor_orders`) ⭐ NEW
   - Customer orders
   - Status tracking
   - Payment info

7. **Dispatchers** (`dispatchers`) ⭐ NEW
   - Riders/couriers
   - Availability status
   - Current location

8. **Dispatch Jobs** (`dispatch_jobs`) ⭐ NEW
   - Order → Dispatcher assignments
   - Real-time tracking
   - Location updates

9. **Contacts** (`contacts`)
   - Phone/email → wallet mappings
   - Used by Payments Agent

10. **Notifications** (`notifications`)
    - User notifications
    - Order updates, payments, etc.

---

## 🔐 Security & Session Keys

### Session Key System
- **INERA Agent** manages session keys
- Each agent can have its own session key (`agentId`)
- Session keys allow automatic execution without PIN
- Falls back to PIN approval if session expired

### Flow:
```
Agent needs to execute payment
→ Checks for session key
→ If valid: Execute automatically
→ If expired: Request PIN approval
→ After PIN: Create new session key
```

---

## 📱 Location Sharing Integration

### Enhanced Location Flow
```
User clicks map icon in ChatInput
→ handleShareLocation()
→ Gets GPS coordinates
→ Sends structured message:
   "📍 Delivery location shared
   - latitude: 6.5244
   - longitude: 3.3792
   [Google Maps link]
   Use this location for delivery or order tracking."

→ Commerce Agent or Dispatch Agent
→ Extracts coordinates
→ Stores in vendor_orders.delivery_latitude/longitude
→ Used for dispatch assignment and tracking
```

---

## 🎯 Agent Priority System

Agents are matched by **priority** (higher = checked first):

1. **Priority 1**: Specific intents (payments, orders, etc.)
2. **Priority 2**: Secondary keywords (delivery, invoice link)
3. **Priority 0**: Default fallback (INERA)

**Example**:
- "order pizza" → Commerce Agent (priority 1)
- "delivery status" → Dispatch Agent (priority 1)
- "track my order" → Dispatch Agent (priority 2)
- Random message → INERA Agent (priority 0, default)

---

## 🔄 Confirmation Flow

Many agents support `requiresConfirmation: true`:

```
1. Agent processes request
2. Returns response with requiresConfirmation: true
3. User sees confirmation prompt
4. User says "yes" or "confirm"
5. IntentClassifier detects "confirm" intent
6. AIService.handleConfirmIntent() executes pending action
7. Agent's execute() method runs
8. Result returned to user
```

---

## 📊 Complete Order Lifecycle

```
1. ORDER CREATION
   User → Commerce Agent → Order in "pending" status

2. PAYMENT PROCESSING
   Commerce Agent → Payments Agent → INERA → Circle SDK
   → Payment hash stored in order

3. VENDOR ACCEPTANCE
   Vendor → Vendor Agent → Order: "pending" → "accepted"

4. PREPARATION
   Vendor → Vendor Agent → Order: "accepted" → "preparing"

5. READY FOR DISPATCH
   Vendor → Vendor Agent → Order: "preparing" → "ready"

6. RIDER ASSIGNMENT
   System → Dispatch Agent → Finds available dispatcher
   → Creates dispatch_job
   → Order: "ready" → "dispatched"

7. PICKUP
   Rider → Dispatch Agent → dispatch_job: "assigned" → "picked_up"

8. IN TRANSIT
   Rider → Dispatch Agent → dispatch_job: "picked_up" → "in_transit"
   → Location updates tracked

9. DELIVERY
   Rider → Dispatch Agent → dispatch_job: "in_transit" → "delivered"
   → Order: "dispatched" → "delivered"
```

---

## 🛠️ API Routes

### Commerce
- `POST /api/commerce/orders` - Create order
- `GET /api/commerce/orders?user_id=...` - Get user orders

### Vendors
- `GET /api/vendors/orders` - Get vendor orders
- `PATCH /api/vendors/orders` - Update order status
- `GET /api/vendors/inventory` - Get inventory
- `POST /api/vendors/inventory` - Create item
- `PATCH /api/vendors/inventory` - Update item

### Dispatch
- (Handled via agents, can add API routes later)

---

## 🎨 User Experience Flow

### Chat Interface
1. User types message
2. `ChatInput` sends to `/api/chat`
3. `AIService` or `AgentRouter` processes
4. Response displayed in chat
5. If confirmation needed, shows prompt
6. User confirms → Action executes

### Location Sharing
1. User clicks map icon
2. Browser requests GPS permission
3. Coordinates sent as structured message
4. Agent extracts and stores location
5. Used for delivery tracking

---

## 🔧 Key Components

### Core Routing
- `core/routing/agentRouter.ts` - Routes intents to agents
- `core/routing/types.ts` - Type definitions

### Agents
- All in `agents/` directory
- Each agent exports `handle()` and `canHandle()`

### Services
- `lib/db/services/vendors.ts` - Vendor/order operations
- `lib/db/services/dispatch.ts` - Dispatch operations
- `lib/db/services/contacts.ts` - Contact resolution

### Integration
- `lib/ai/agentIntegration.ts` - Bridges AI service and agents
- `lib/ai/ai-service.ts` - Fallback AI processing

---

## 🚀 Future Enhancements

1. **Real-time Tracking**: WebSocket for live dispatcher location
2. **Payment Integration**: Auto-pay on order creation
3. **Notifications**: Push notifications for order updates
4. **Vendor Dashboard UI**: Web interface for vendors
5. **Multi-agent Workflows**: Agents calling other agents
6. **Agent Permissions**: Per-agent spending limits

---

This architecture allows ARCLE to handle complex financial and commerce operations through specialized, focused agents while maintaining a unified user experience through natural language chat.

