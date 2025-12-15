# Local Accounts & Dual-Funding Card Roadmap
*Last updated: 2025-11-24*

## Objective
Give Arcle users hybrid custody: a local fiat account (e.g., NGN) they can fund/withdraw, plus a single debit card that can spend from both the fiat ledger and the USDC wallet. Agents/INERA leverage these balances for commerce orders, FX conversions, and yield automation.

---

## 1. Local Account System

### 1.1 Capabilities
- Issue local accounts per user and currency (starting with NGN).
- Accept deposits via bank transfer/mobile money.
- Provide instant balance to AI agents for commerce or conversion.
- Allow withdrawals back to a user’s external bank.
- Maintain full ledger + audit trail with per-agent permissions.

### 1.2 Architecture
| Layer | Responsibilities |
| --- | --- |
| `LocalAccountsAgent` | Handles account lifecycle, reserves, payout requests. |
| `LocalLedger` | Double-entry ledger storing credits/debits/reserves. |
| `Rail Integrations` | Virtual account providers or bank partners. |
| `APIs/UI` | `app/api/local-accounts/*`, dashboard + chat commands. |
| `INERA` | Orchestrates fiat ↔ crypto workflows (e.g., convert to USDC). |

### 1.3 Data Models
- `LocalAccount`: userId, currency, providerAccountId, status, limits.
- `LocalLedgerEntry`: accountId, type (credit/debit/reserve), amountMinor, reference, metadata.
- `LocalTransaction`: direction (in/out), rail, status, workflowId, timestamps.
- `LocalRail`: provider, supported currencies, fees, limits.

Split schema across multiple files/migrations to keep each under 500 lines and respect SRP (repositories per entity).

### 1.4 Core Workflows
1. **Account Creation**
   - Chat intent triggers `LocalAccountsAgent.createAccount`.
   - Runs KYC via Compliance Agent.
   - Calls rail provider API for virtual account number.
   - Stores metadata; returns account details to user.

2. **Deposit**
   - User transfers funds to their assigned bank account.
   - Provider webhook → `app/api/local-accounts/webhooks/rail`.
   - Agent validates reference, posts ledger credit, emits notification.
   - Commerce/DeFi agents can now consume balance.

3. **Spend (Commerce)**
   - Commerce Agent requests `reserve` on Local Account.
   - Once vendor payment confirmed, Agent `debit`s ledger and releases reserve.
   - If payment fails, reserve released automatically.

4. **Convert to USDC / Yield**
   - FX Agent quotes NGN→USDC.
   - Local Accounts Agent debits ledger.
   - INERA mints USDC via Circle, credits wallet, optionally moves into USYC via DeFi Agent.

5. **Withdrawal**
   - User requests payout; Agent checks balance + daily limits.
   - Initiates transfer via rail provider; posts `pending` ledger entry.
   - On success, finalizes debit and notifies user.

### 1.5 Security & Compliance
- Permission scopes in `core/permissions/agentPermissions.ts` (max spend per agent/currency).
- AML rules: large deposits trigger Compliance workflows.
- Auditable ledger with immutable entries; no deletes.
- Provider secrets stored server-side; never exposed to client.

---

## 2. Dual-Funding Debit Card

### 2.1 Goal
Provision one debit card per user that can dynamically pull from:
1. Local fiat ledger (default for domestic spends).
2. USDC wallet (converted to fiat on the fly or settled in USD).

### 2.2 Components
| Component | Description |
| --- | --- |
| `CardAgent` | Interfaces with issuer (Marqeta/Unit/etc.), manages funding priorities and auth decisions. |
| `Issuer Webhooks` | Authorization, clearing, settlement events. |
| `Funding Rules Engine` | Chooses fiat vs USDC, handles auto-conversion via FX Agent. |
| `Risk Controls` | Per-MCC limits, geofencing, freeze/unfreeze via chat. |

### 2.3 Auth Flow
1. Merchant swipe triggers issuer auth webhook → `CardAgent.handleAuthorization`.
2. CardAgent evaluates:
   - Available fiat ledger balance.
   - Available USDC balance (or convertible amount).
3. Decision tree:
   - If fiat sufficient → place reserve via Local Accounts Agent, approve auth.
   - Else if USDC sufficient → instruct FX Agent/INERA to convert or guarantee USD settlement, then approve.
   - Else → decline with insufficient funds reason.
4. Clearing event finalizes ledger debits and USDC transfers.

### 2.4 Features
- **Priority Settings**: User chooses “spend NGN first” or “spend USDC first”.
- **FX Guardrails**: Live quote + slippage tolerance before approving cross-currency spend.
- **Controls via Chat**: “Freeze my card”, “Raise weekend limit”, “Switch to USDC”.
- **Spending Insights**: Card transactions feed into Insights Agent for reports.

### 2.5 Dependencies
- Local Accounts system live (for fiat source).
- Circle wallet + INERA session keys (for crypto source).
- Compliance Agent for card issuance eligibility.
- Notifications Agent for card events.

---

## 3. Implementation Plan

1. **Planner Phase**
   - Add tasks to `.cursor/scratchpad.md`: Local Accounts Agent, ledger schema, rail integration, CardAgent scaffolding.
2. **Executor Phase (Local Accounts)**
   - Build schemas & repositories (split files).
   - Implement LocalAccountsAgent + APIs + webhook handlers.
   - Create mock rail provider for dev/testing; document real provider requirements.
   - Add tests for ledger math + workflows.
3. **Executor Phase (Dual Card)**
   - Integrate issuer sandbox; create CardAgent with auth + clearing handlers.
   - Implement funding rules + FX fallback.
   - Add configuration UI/chat commands.
4. **Auditor Phase**
   - Review security of ledger, webhook auth, card funding logic.
   - Ensure no agent can drain funds beyond permissions.

---

## 4. Open Questions
1. Preferred rail provider for NGN virtual accounts?
2. Card issuer shortlist + required jurisdictions?
3. Daily/monthly limits for fiat vs USDC balances?
4. SLA for FX conversions during card auth (pre-fund USD buffer or convert on demand)?

---

## 5. Next Steps
- Once approved, switch to **Planner mode** to log detailed tasks and success criteria.
- After planning, move to **Executor mode** to scaffold Local Accounts Agent and ledger.
- Keep this document updated as architecture evolves.

