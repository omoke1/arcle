# Arcle Platform Stabilization - Team TODO

## Overview
This document outlines the critical tasks needed to stabilize the Arcle platform for production readiness. The platform currently has ~60% fully working features, ~25% partially working, and ~15% not working. This plan addresses the most critical issues.

## Current Status Analysis
Based on comprehensive feature audit (docs/FEATURE_STATUS_REPORT.md):

### ✅ 25 Features Working (60%)
- Core wallet, payments, invoices, remittances, scheduling, contacts, agent architecture

### ⚠️ 13 Partially Working Features (25%) - **PRIORITY FIXES**
- **DeFi Features**: Savings Goals & SafeLocks use localStorage instead of Supabase database
- **Template Files**: Incorrectly reference Prisma instead of Supabase (project uses Supabase migrations)
- **Bridge Operations**: False positive completions, no balance verification
- **Transaction Errors**: Circle 401/403 errors masked as generic 500 errors
- **Security**: Risk scoring returns placeholder data (always false/null/0)
- **Notifications**: Supabase code exists but commented out, uses localStorage
- **Performance**: Aggressive 3-second polling may cause rate limiting
- **Agent Implementations**: DeFi, FX, Commerce agents are scaffolded placeholders

### ❌ 14 Missing Features (15%) - **IMPLEMENT FROM SCRATCH**
- **Infrastructure**: No rate limiting, CORS, request size limits
- **Missing Agents**: Insights, Merchant, Compliance agents not implemented
- **Multi-user Support**: No user accounts system
- **Notifications**: No email or push notifications
- **Data Management**: No backup/export capabilities
- **Transaction Limits**: No configurable amount limits

### 🔧 **Database Architecture Note**
- **Current**: Project uses Supabase with migrations (supabase/migrations/)
- **Issue**: Template files incorrectly reference Prisma client
- **Fix**: Rewrite template files to use Supabase client pattern

## Priority Tasks (Start Here)

### Phase 1: Fix Database Architecture Issues (Critical)
- [x] **1.1** Fix Template Files Database Approach
  - **Issue**: Template files use Prisma but project uses Supabase migrations
  - **Fix**: Rewrite all .template files to use Supabase client pattern
  - Reference existing Supabase setup in `lib/supabase.ts`
  - Use `getSupabaseClient()` for client-side operations
  - Use `getSupabaseAdmin()` for server-side operations

- [x] **1.2** Fix DeFi localStorage Dependencies  
  - **Issue**: Savings Goals & SafeLocks use localStorage, data lost on browser clear
  - **Fix**: Create Supabase-based implementations
  - Rewrite `lib/defi/goal-based-savings-db.ts.template` using Supabase queries
  - Rewrite `lib/defi/safelock-db.ts.template` using Supabase queries
  - Create Supabase migrations for savings_goals and safelocks tables

- [x] **1.3** Fix Notification Service Database Integration
  - **Issue**: Database code exists but commented out, uses localStorage fallback
  - **Fix**: Replace commented Prisma imports with Supabase client
  - Convert placeholder functions to use Supabase queries against existing notifications table
  - Update all notification-related API endpoints

- [x] **1.3** Fix Bridge False Positives
  - **Issue**: Bridge monitoring assumes completion after timeout, causing false positives
  - **Fix**: Implement balance-based verification before marking complete
  - Add post-bridge balance check to confirm funds actually arrived

### Phase 2: Fix Transaction Error Handling (High Priority)
- [x] **2.1** Fix Circle SDK Error Masking
  - **Issue**: Circle 401/403 errors rethrown as generic 500 errors, masks root cause
  - **Fix**: Propagate actual Circle status codes (401/403) with actionable guidance
  - Add specific error message mapping for expired userToken/unfinished PIN challenge

- [x] **2.2** Fix Transaction Retry Logic
  - **Issue**: Client blindly retries on 500, no logic to refresh stale credentials
  - **Fix**: Detect 401/403 and trigger user recreation + PIN widget
  - Implement automatic token refresh with retry logic

- [x] **2.3** Fix Aggressive Transaction Polling
  - **Issue**: 3-second polling interval may cause rate limiting in production
  - **Fix**: Implement adaptive polling (faster when active, slower when idle)
  - Add intelligent polling frequency management

### Phase 3: Fix Security Placeholder Implementations (High Priority)
- [ ] **3.1** Fix Risk Scoring Placeholders
  - **Issue**: Contract verification always returns `false`, age returns `null`, transaction count returns `0`
  - **Fix**: Integrate ArcScan API for actual blockchain data
  - Replace all placeholder implementations with real data queries

- [ ] **3.2** Add Missing Security Infrastructure
  - **Issue**: No rate limiting, CORS, or request size limits exist
  - **Fix**: Implement rate limiting middleware to prevent DoS attacks
  - Add CORS configuration (any origin can currently call APIs)
  - Add request size limits to prevent memory issues

### Phase 4: Complete Scaffolded Agent Implementations (Medium Priority)
- [ ] **4.1** Complete DeFi Agent
  - **Issue**: agents/defi/ is scaffolded placeholder only
  - **Fix**: Implement real DEX protocol integrations or add "DEMO MODE" warnings
  - Replace placeholder yield farming and trading execution with real implementations

- [ ] **4.2** Complete FX Agent
  - **Issue**: agents/fx/ is scaffolded placeholder only
  - **Fix**: Implement functional FX operations with real market data
  - Verify FX rates use actual data instead of mock data

- [ ] **4.3** Complete Missing Agents
  - **Issue**: Commerce, Insights, Merchant, Compliance agents are scaffolded only
  - **Fix**: Implement functional agent operations for each
  - Add vendor management, analytics, merchant operations, KYC/risk features

### Phase 5: Implement Missing Infrastructure Features (Lower Priority)
- [ ] **5.1** Add Transaction Amount Limits
  - **Issue**: No configurable limits, users could accidentally send large amounts
  - **Fix**: Implement configurable transaction amount limits
  - Add user-configurable daily/weekly spending limits

- [ ] **5.2** Add Multi-User Support Foundation
  - **Issue**: No user accounts system, single-user only
  - **Fix**: Design and implement user accounts and authentication system
  - Create user registration, login flows, and session management

- [ ] **5.3** Add Data Backup/Export
  - **Issue**: No data export/import capabilities
  - **Fix**: Implement comprehensive data export functionality
  - Add backup validation and user data portability

- [ ] **5.4** Add Email/Push Notifications
  - **Issue**: No email or push notification systems
  - **Fix**: Implement email notification system integration
  - Add push notification infrastructure and preference management

### Phase 6: Performance & Monitoring (Lower Priority)
- [ ] **6.1** Adaptive polling system
  - Implement activity-based polling intervals
  - Add intelligent frequency management
  - Create polling pause during inactivity

- [ ] **6.2** Centralized error logging
  - Implement structured logging with context
  - Add error categorization and severity levels
  - Create error aggregation and reporting

- [ ] **6.3** Performance monitoring
  - Add response time and throughput monitoring
  - Create performance alerting
  - Implement health check endpoints

## Team Assignments

### Backend Team
- Database migration (Phase 1)
- Transaction reliability (Phase 2)
- Bridge operations (Phase 3)
- Security hardening (Phase 4)

### Frontend Team
- Error message improvements
- User feedback for failed operations
- Notification UI updates
- Performance optimization

### DevOps Team
- Monitoring setup (Phase 6)
- Performance tracking
- Alert configuration
- Health check implementation

## Testing Strategy
- **Unit Tests**: Focus on core business logic and error handling
- **Integration Tests**: Test database operations and external API calls
- **Property-Based Tests**: Validate correctness properties across all inputs
- **End-to-End Tests**: Test complete user workflows

## Success Metrics
- [ ] All template files activated and working
- [ ] Zero localStorage dependencies for critical features
- [ ] Transaction success rate > 95%
- [ ] Bridge operation accuracy > 99%
- [ ] Error messages are actionable and user-friendly
- [ ] All agents provide functional responses (no placeholders)
- [ ] Comprehensive monitoring and alerting in place

## Notes
- Start with Phase 1 (Database Migration) as other phases depend on it
- Test each phase thoroughly before moving to the next
- Maintain backward compatibility during migration
- Document any breaking changes or new dependencies
- Regular team sync on progress and blockers

---
**Last Updated**: December 15, 2025
**Status**: Ready for implementation