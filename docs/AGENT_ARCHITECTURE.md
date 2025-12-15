# Arcle Agent-Based Architecture

## Overview

Arcle uses a modular, agent-based architecture with INERA as the core orchestrator. This is a hybrid migration: existing code remains functional while the new structure is scaffolded and migrated gradually.

## Architecture Principles

- **INERA (Core Finance Agent)**: Orchestrates all flows, executes via session keys
- **Specialized Agents**: Payments, Invoice, Remittance, DeFi, Commerce, Insights, FX, Merchant, Compliance
- **Hybrid Security**: Circle MSCA + Custom ERC-6900 session key module
- **Chat-First UX**: All operations accessible via natural language
- **Web2 + Web3 Compatible**: Seamless experience for both user types

## Core Infrastructure

### Folder Structure

```
/agents
  /inera          # Core orchestrator
  /payments       # Payment operations
  /invoice        # Invoice management
  /remittance     # Cross-border payments
  /defi           # DeFi operations
  /fx             # FX operations
  /commerce       # Commerce operations
  /insights       # Analytics and reports
  /merchant       # Merchant operations
  /compliance     # Compliance and KYC

/core
  /sessionKeys    # Agent session key management
  /permissions    # Per-agent permission scopes
  /workflows      # Workflow engine
  /routing        # Agent router
  /aaIntegration  # ERC-4337 UserOp building

/wallet
  /msca           # Circle MSCA integration
  /sessionKeys    # Session key management
```

## INERA Agent (Core Orchestrator)

**Location**: `agents/inera/`

**Responsibilities:**
- Orchestrate all financial flows
- Execute payments, CCTP, bridging, batch transactions
- Sign using delegated session keys
- Handle automation and workflow execution
- Interface with Circle MSCA

**Key Functions:**
```typescript
class INERAAgent {
  async executePayment(params)
  async executeBridge(params)
  async executeBatch(operations)
  async executeWorkflow(workflow)
  async delegateToAgent(agentName, action, params)
}
```

## Agent Router

**Location**: `core/routing/agentRouter.ts`

Routes chat intents to appropriate agents based on:
- Intent keywords (send, pay, invoice, remittance, etc.)
- Entity extraction (amount, address, chain, etc.)
- Context (wallet status, balance, etc.)

## Workflow Engine

**Location**: `core/workflows/workflowEngine.ts`

Executes multi-step workflows:
- Batch operations
- Conditional logic
- Retry policies
- State tracking

## Session Key Integration

Manages agent-specific session keys:
- Per-agent permission scopes
- Spending limits
- Action restrictions

**Location**: `core/sessionKeys/agentSessionKeys.ts`

## Implemented Agents

### Payments Agent

**Location**: `agents/payments/`

**Features:**
- Phone/email payments (placeholder - requires address resolution)
- One-time payment links (24h expiration)
- QR code payment links
- Recurring/subscription payments

**Actions:**
- `send`, `pay`, `transfer` - Execute payment
- `sendToPhone` - Send to phone number
- `sendToEmail` - Send to email
- `createOneTimeLink` - Create payment link
- `createQRPaymentLink` - Create QR payment link
- `createRecurringPayment` - Create subscription

### Invoice Agent

**Location**: `agents/invoice/`

**Features:**
- Dynamic invoice creation
- One-time invoice links
- QR code generation
- Payment tracking

**Actions:**
- `create` - Create invoice
- `generateLink` - Generate invoice link
- `generateQR` - Generate QR code
- `trackPayment` - Track payment status
- `sendInvoice` - Send invoice to recipient

### Remittance Agent

**Location**: `agents/remittance/`

**Features:**
- CCTP cross-border transfers
- FX conversion integration (placeholder)
- Transfer tracking

**Actions:**
- `sendRemittance` - Send cross-border payment
- `executeCCTP` - Execute CCTP transfer
- `convertCurrency` - Convert currency
- `track` - Track remittance status

## Placeholder Agents

The following agents are scaffolded but not yet implemented:
- **DeFi Agent**: Swaps, yield, liquidity
- **FX Agent**: Currency conversion
- **Commerce Agent**: Orders, delivery, marketplace
- **Insights Agent**: Analytics, reports
- **Merchant Agent**: POS, settlements
- **Compliance Agent**: KYC, risk, fraud

## Agent Execution Flow

```
User Chat Message
    ↓
Agent Router (checks if message matches agent keywords)
    ↓
[If matches] → Agent (Payments/Invoice/Remittance/etc.)
    ↓
Agent delegates to INERA
    ↓
INERA uses Session Keys
    ↓
Circle MSCA executes
    ↓
Response to User
```

## Session Key Architecture

### Per-Agent Session Keys

Each agent can have its own session key with specific permissions:

- **INERA Agent**: Full permissions (orchestrator)
- **Payments Agent**: Transfer, approve, bridge permissions
- **Invoice Agent**: Transfer, approve permissions
- **Remittance Agent**: Transfer, bridge, CCTP permissions
- **DeFi Agent**: Swap, approve, contract execution permissions

### Permission Scopes

```typescript
interface AgentPermissions {
  allowedActions: WalletAction[];
  spendingLimit: string;
  maxAmountPerTransaction: string;
  allowedChains: string[];
  allowedTokens: string[];
  duration: number; // seconds
  autoRenew: boolean;
}
```

## Integration Points

### Existing Code Reused

- `lib/wallet/sessionKeys/*` - Session key management
- `lib/wallet/msca/*` - MSCA integration
- `lib/circle-user-sdk.ts` - Circle SDK client
- `lib/ai/intent-classifier.ts` - Intent classification
- `app/api/circle/*` - Circle API routes

### New Code Built

- Agent interfaces and implementations
- Agent router
- Workflow engine
- Agent-specific session key scopes
- Agent API routes

## API Routes

### Agent API Routes

- `POST /api/agents` - Main router (routes to appropriate agent)
- `POST /api/agents/inera` - INERA agent endpoint
- `POST /api/agents/payments` - Payments agent endpoint
- `POST /api/agents/invoice` - Invoice agent endpoint
- `POST /api/agents/remittance` - Remittance agent endpoint

## Migration Strategy

### Hybrid Approach

1. **Keep Working Code**: Existing functionality remains operational
2. **Scaffold New Structure**: Create agent structure in parallel
3. **Gradual Migration**: Migrate features one by one
4. **No Breaking Changes**: Maintain backward compatibility during migration

### Migration Phases

1. **Phase 1**: Core infrastructure (INERA, router, workflows)
2. **Phase 2**: Payments Agent (first high-impact agent)
3. **Phase 3**: Invoice Agent
4. **Phase 4**: Remittance Agent
5. **Phase 5**: Additional agents (DeFi, FX, Commerce, etc.)

## Testing Strategy

1. **Unit Tests**: Each agent independently
2. **Integration Tests**: Agent → INERA → Session Key → Circle
3. **Workflow Tests**: Multi-step workflows
4. **E2E Tests**: Chat → Agent → Execution

## Success Criteria

- ✅ All existing functionality preserved
- ✅ New agent structure operational
- ✅ INERA orchestrating all flows
- ✅ Session keys working with agents
- ✅ Chat routing to agents functional
- ✅ Multi-step workflows executing
- ✅ No breaking changes to existing APIs (during migration)

---

**Last Updated**: January 2025  
**Status**: Core infrastructure implemented, agents in various stages of completion

