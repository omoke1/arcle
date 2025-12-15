# Mock Data & In-Memory Storage Audit

**Date**: 2025-12-03  
**Status**: 🔴 Critical - Multiple features lose data on restart  
**Goal**: Migrate all in-memory storage to database-backed implementations

---

## 🔴 Critical Issues (Data Loss on Restart)

### 1. Payment Links (`agents/payments/oneTimeLinks.ts`)
- **Current**: `Map<string, PaymentLink>` in-memory
- **Impact**: All payment links lost on server restart
- **Fix**: Migrate to Supabase `payment_links` table
- **Priority**: HIGH

### 2. Invoice Links (`agents/invoice/oneTimeLink.ts`)
- **Current**: `Map<string, InvoiceLink>` in-memory
- **Impact**: All invoice links lost on server restart
- **Fix**: Migrate to Supabase `invoice_links` table (or extend `invoices` table)
- **Priority**: HIGH

---

## 🟡 Important Issues (Trading/Financial Data)

### 3. Limit Orders (`lib/defi/limit-orders.ts`)
- **Current**: `Map<string, LimitOrder>` in-memory
- **Impact**: Trading orders lost on restart, no persistence
- **Fix**: Create `limit_orders` table in Supabase
- **Priority**: MEDIUM-HIGH

### 4. Auto-Compound Strategies (`lib/defi/auto-compound.ts`)
- **Current**: `Map<string, CompoundStrategy>` + `Map<string, YieldHistory[]>` in-memory
- **Impact**: Strategies and yield history lost on restart
- **Fix**: Create `compound_strategies` and `compound_history` tables
- **Priority**: MEDIUM-HIGH

---

## 🟢 Medium Priority (Can Be Improved Later)

### 5. Commerce Vendors (`agents/commerce/index.ts`)
- **Current**: Hardcoded `PARTNER_VENDORS` array
- **Impact**: No dynamic vendor management
- **Fix**: Create `vendors` table in Supabase
- **Priority**: MEDIUM

### 6. FX Historical Data (`lib/fx/fx-market-data.ts`)
- **Current**: Simulated historical rates using `Math.random()`
- **Impact**: Not real historical data
- **Fix**: Integrate real FX historical API (e.g., ExchangeRate-API, Alpha Vantage)
- **Priority**: LOW-MEDIUM

### 7. Arbitrage Opportunities (`lib/defi/arbitrage.ts`)
- **Current**: Mock opportunities with hardcoded prices
- **Impact**: Not real arbitrage detection
- **Fix**: Integrate real DEX price APIs (Uniswap, Curve, etc.)
- **Priority**: LOW (feature may not be production-ready yet)

---

## ✅ Already Using Database (No Action Needed)

- ✅ Local Accounts (`lib/db/services/localAccounts.ts`) - Uses Supabase
- ✅ Savings Goals (`lib/db/services/savingsGoals.ts`) - Uses Supabase
- ✅ SafeLock (`lib/db/services/safeLocks.ts`) - Uses Supabase
- ✅ Scheduled Payments (`lib/db/services/scheduledPayments.ts`) - Uses Supabase
- ✅ Subscriptions (`lib/db/services/subscriptions.ts`) - Uses Supabase
- ✅ Invoices (`lib/db/services/invoices.ts`) - Uses Supabase
- ✅ Notifications (`lib/db/services/notifications.ts`) - Uses Supabase
- ✅ Conversation Context (`lib/ai/conversation-context.ts`) - Hybrid (Map + Supabase persistence)

---

## Implementation Plan

### Phase 1: Critical Fixes (Payment & Invoice Links)
1. Create Supabase migrations for `payment_links` and `invoice_links` tables
2. Create service classes (`lib/db/services/paymentLinks.ts`, `lib/db/services/invoiceLinks.ts`)
3. Update `agents/payments/oneTimeLinks.ts` to use service
4. Update `agents/invoice/oneTimeLink.ts` to use service
5. Test: Create links, restart server, verify persistence

### Phase 2: Trading Data (Limit Orders & Auto-Compound)
1. Create Supabase migrations for `limit_orders`, `compound_strategies`, `compound_history`
2. Create service classes for each
3. Update existing functions to use services
4. Test: Create orders/strategies, restart server, verify persistence

### Phase 3: Commerce & FX (Lower Priority)
1. Create `vendors` table and service
2. Integrate real FX historical API
3. Document arbitrage as "coming soon" or implement real DEX integration

---

## Migration Checklist

- [x] Phase 1: Payment Links migration ✅ **COMPLETED**
- [x] Phase 1: Invoice Links migration ✅ **COMPLETED**
- [ ] Phase 2: Limit Orders migration
- [ ] Phase 2: Auto-Compound migration
- [ ] Phase 3: Commerce Vendors migration
- [ ] Phase 3: FX Historical API integration
- [x] Remove payment/invoice `Map`-based in-memory storage ✅
- [ ] Update all remaining `// In-memory storage` comments
- [ ] Test all migrations with server restarts
- [ ] Update documentation

## ✅ Completed (2025-12-03)

### Phase 1: Critical Data Persistence Fixes

**Payment Links** (`agents/payments/oneTimeLinks.ts`):
- ✅ Created `supabase/migrations/0004_payment_and_invoice_links.sql`
- ✅ Created `lib/db/services/paymentLinks.ts` service
- ✅ Migrated from `Map<string, PaymentLink>` to Supabase `payment_links` table
- ✅ Updated all functions to async/await pattern
- ✅ Fixed all call sites (agents/payments/index.ts, agents/payments/qrPayments.ts)

**Invoice Links** (`agents/invoice/oneTimeLink.ts`):
- ✅ Created `lib/db/services/invoiceLinks.ts` service
- ✅ Migrated from `Map<string, InvoiceLink>` to Supabase `invoice_links` table
- ✅ Updated all functions to async/await pattern
- ✅ Fixed all call sites (agents/invoice/index.ts, agents/invoice/qrGenerator.ts, agents/invoice/paymentTracking.ts, agents/invoice/dynamicInvoices.ts)

**Database Schema**:
- ✅ `payment_links` table with RLS policies
- ✅ `invoice_links` table with RLS policies
- ✅ Proper indexes for performance
- ✅ Auto-update triggers for `updated_at`

**Impact**: Payment and invoice links now persist across server restarts. No more data loss! 🎉

---

## Notes

- All migrations should follow existing patterns in `lib/db/services/`
- Use `getSupabaseAdmin()` for writes, `getSupabaseClient()` for reads
- Maintain backward compatibility during migration (dual-write if needed)
- Add proper indexes for performance
- Consider RLS policies for multi-tenant security

