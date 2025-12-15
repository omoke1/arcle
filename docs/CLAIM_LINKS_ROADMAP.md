# Arcle Claim-Link Payments Roadmap

**Last Updated:** 2025-12-03  

This document tracks the planned **claim-link / send-to-non-user** payment flow, where a sender can send money to any email or phone number and the recipient can claim it via a secure link, even if they are not yet an Arcle user.

---

## 1. Concept Overview

- **Goal**: Let users send money to **any** email/phone, without requiring the recipient to already have an Arcle wallet or account.
- **Mechanism**:
  - Sender initiates a payment to an email/phone.
  - Backend creates a **claim record** and a **secure, time-limited link**.
  - Funds are held in a controlled account / pending state.
  - Recipient opens the link and **claims** the funds by:
    - Creating / connecting a wallet, or
    - Signing in to Arcle (if they already have a wallet).

This is a **separate rail** from direct wallet-to-wallet and contact-based flows we already support.

---

## 2. Phase 1 – MVP Design

**Status:** Planned  

### 2.1. Data Model (Supabase)

New table (example):

- `payment_claims`
  - `id` (uuid)
  - `created_at`, `updated_at`
  - `sender_user_id`
  - `sender_wallet_id`
  - `amount` (string, USDC small units)
  - `currency` (e.g. `"USDC"`)
  - `recipient_email` (nullable)
  - `recipient_phone` (nullable)
  - `status` (`"pending" | "claimed" | "expired" | "cancelled"`)
  - `expires_at`
  - `claimed_at` (nullable)
  - `claim_token` (secure random string, used in link)
  - `destination_wallet_id` (nullable – filled when claimed)

### 2.2. API Endpoints (MVP Sketch)

- `POST /api/payments/claims`
  - Input: `{ amount, currency, recipientEmail | recipientPhone }`
  - Auth: sender must be logged in with a wallet.
  - Behavior: create `payment_claims` row, optionally initiate funding/escrow, return claim URL.

- `GET /api/payments/claims/[token]`
  - Input: `claim_token` from URL.
  - Behavior: return **public-safe** info (amount, currency, sender display name, status).

- `POST /api/payments/claims/[token]/claim`
  - Input: `claim_token`, plus context for wallet creation/connection.
  - Behavior:
    - If no Arcle wallet: create wallet (via Circle) and associate.
    - If wallet exists: map claim to that wallet.
    - Execute transfer from escrow → recipient wallet.
    - Mark claim as `claimed`.

### 2.3. Frontend Flows

- **Sender flow (inside chat):**
  - User: “Send $50 to alice@example.com as a claim link.”
  - Agent:
    - Confirms amount + recipient.
    - Calls `POST /api/payments/claims`.
    - Returns: “✅ Claim link created and sent to alice@example.com.”

- **Recipient flow (external):**
  - Clicks claim link (e.g. from email/SMS).
  - Sees branded page: “You’ve received $50 from [Sender].”
  - Options:
    - “Create an Arcle wallet and claim.”
    - “Connect an existing compatible wallet” (future).

---

## 3. Phase 2 – Compliance & Limits

**Status:** Planned  

- Add **amount limits** per claim and per sender (daily/monthly).
- Add **basic KYC triggers**:
  - Above threshold → require identity verification before claiming or withdrawing.
- Add **region/jurisdiction checks** if needed.
- Add **logging and audit trails** for all claim events.

---

## 4. Phase 3 – UX & Growth Hooks

**Status:** Planned  

- Deep integration with **Payments Agent**:
  - Agent decides whether to use **direct contact payment** vs **claim link** based on whether the recipient already exists as a contact.
- **Referral hooks**:
  - Optional bonus/reward for first-time claimers.
- **Notifications**:
  - Notify sender when:
    - Claim link is opened.
    - Claim is completed.
    - Claim expires unclaimed (with reclaim option).

---

## 5. Open Questions

- How do we want to **fund** the claim?
  - Fully on-chain escrow vs. off-chain ledger backed by Circle wallet(s)?
- Do we allow claim to an **external non-Arcle wallet**, or require an Arcle wallet for v1?
- Exact **KYC thresholds** and flows, by region.

These will be resolved in collaboration with product, legal, and compliance before implementation.

---

## 6. Current Implementation Status (Dec 2025)

- **Direct wallet/contact flows**:
  - `agents/payments/phoneEmailPayments.ts`:
    - Resolves phone/email to contacts in Supabase.
    - Sends directly to the contact’s wallet address via INERA/session keys.
- **Claim-link flows**:
  - **Not implemented yet** – tracked in this document as a planned feature.


