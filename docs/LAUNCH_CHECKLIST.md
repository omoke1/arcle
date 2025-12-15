## Arcle Launch Checklist (Beta)

**Goal**: Safely launch a limited beta of Arcle with a stable core wallet and payment experience.

**Status Legend**:  
- [ ] Not started  
- [~] In progress / partially done  
- [x] Done  

---

## 1. Core Money Flows

- [~] **Wallet creation & PIN**
  - Circle user + wallet creation working end-to-end on test environment.
  - PIN widget (Circle Web SDK) styled to match brand and tested for:
    - Missing/incorrect `CIRCLE_APP_ID`
    - Missing/invalid encryption key
    - Token expiry / refresh flows
- [~] **Send USDC/EURC**
  - Simple send to wallet address (from chat) works reliably, with:
    - Address validation + risk scoring before send
    - Clear success/failure messaging
- [ ] **Bridge (CCTP/Gateway)**
  - Happy-path bridge transactions succeed on supported networks.
  - Balance verification after bridge is implemented (no false “success”).

---

## 2. Agent‑Based Payments

- [x] **Payments Agent – direct sends**
  - Standard send, scheduled payments, and subscriptions work.
- [x] **Phone/Email Payments**
  - `agents/payments/phoneEmailPayments.ts` resolves phone/email → Supabase contacts → wallet address.
  - Commerce & payments responses clearly explain that recipients need a wallet/contact entry.
- [~] **Commerce Agent – vendors & food ordering**
  - Commerce agent understands: “buy”, “purchase”, “order food”, “order from partner”.
  - Lists partner food vendors and guides user to specify vendor + amount.
  - Next step (post‑launch): back vendor catalog with Supabase instead of in‑memory list.
- [ ] **Claim Links (planned; not for first launch)**
  - Tracked in `docs/CLAIM_LINKS_ROADMAP.md` as a future enhancement.

---

## 3. Data & Persistence (Supabase)

- [~] **Core tables migrated**
  - Users, sessions, wallet data, notifications, contacts, scheduled payments, subscriptions exist in Supabase.
- [~] **RLS policies**
  - RLS enabled and tested for:
    - `notifications`
    - `contacts`
    - Any other user‑scoped tables in active use.
- [ ] **No critical localStorage‑only features**
  - Audit remaining localStorage use and ensure anything user‑critical has a Supabase path.

---

## 4. Security & Reliability

- [x] **Rate limiting**
  - Basic IP-based rate limiting added for:
    - `/api/chat`
    - `/api/circle/users`
    - `/api/circle/wallets`
    - `/api/circle/transactions`
    - `/api/circle/bridge`
- [ ] **CORS & request limits**
  - CORS restricted to allowed origins.
  - Request body size limits configured to prevent abuse.
- [~] **Risk scoring**
  - Address validation and basic risk scoring run before sending.
  - TODO: complete contract age / verification / tx‑count checks (see `lib/security/risk-scoring.ts`).
- [ ] **Error handling**
  - Circle 401/403 errors surfaced as clear, user‑friendly messages (not generic 500s).
  - Common failure cases tested: token expiry, unfinished PIN challenge, network errors.

---

## 5. UX & Onboarding

- [~] **First‑time onboarding**
  - Clear path: landing → invite code → wallet creation → first send.
  - Guardian agent greets new users with:
    - What Arcle is.
    - Why PIN/wallet setup is needed.
    - 2–3 example commands (send, order food, schedule payment).
- [x] **Brand‑consistent chrome**
  - Top bar, sidebar, logo, and PIN widget use Arcle brand tokens (carbon, aurora, graphite).
- [ ] **Empty states & edge cases**
  - No wallet, no contacts, no notifications, no scheduled payments all show friendly guidance, not raw errors.

---

## 6. Beta Rollout & Ops

- [ ] **Invite code gating**
  - Invite‑code flow tested end‑to‑end; limits per code defined.
- [ ] **Monitoring & logging**
  - Centralized logging for:
    - Failed transactions
    - Failed bridge operations
    - PIN/widget errors
  - Simple dashboard or queries to review errors after launch.
- [ ] **Support loop**
  - Clear channel for beta testers (e.g. Slack/Discord/email) + internal process to triage issues.

---

## 7. Compliance & Legal (High‑Level)

- [ ] **Terms & disclosures**
  - Clear language that Arcle is not a bank / no investment advice.
- [ ] **Limits & KYC plan**
  - Document initial limits (per‑tx and per‑day).
  - Decide when KYC is required (especially before adding claim‑links or off‑ramps).

---

## How to Use This Checklist

- Treat this as a **living document** during pre‑launch.
- Update checkboxes as you complete items.
- For deeper technical status, cross‑reference `docs/FEATURE_STATUS_REPORT.md` and `docs/CLAIM_LINKS_ROADMAP.md`.


