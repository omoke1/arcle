# Wallet Detection & Duplicate Prevention Solution

## Problem

Users who sign up via email/social authentication were getting duplicate wallets:
1. **Signup flow** creates a Circle user + potentially an embedded wallet
2. **Agent flow** creates a new user + wallet when user asks for one
3. Result: Two wallets for the same user, causing confusion and fragmentation

## Solution

Created a **unified wallet detection service** that checks for existing wallets from multiple sources before creating new ones.

### Architecture

```
User Signs Up (Email/Social)
    ↓
Circle SDK creates user + wallet (embedded)
    ↓
Credentials saved to localStorage + Supabase
    ↓
User interacts with agent
    ↓
Wallet Detection Service checks:
    1. Supabase preferences (agent-created wallets)
    2. Circle API (embedded wallets from signup)
    3. Supabase wallets table (database-backed)
    ↓
If wallet found → Use existing wallet
If not found → Create new wallet
```

### Implementation

#### 1. Wallet Detection Service (`lib/wallet/wallet-detection.ts`)

**Key Functions:**
- `detectExistingWallet()` - Checks all sources for existing wallets
- `getOrDetectWallet()` - Unified entry point for wallet detection

**Detection Strategy:**
1. **Supabase Preferences** - Check for wallets saved by agent or manually
2. **Circle API** - Query Circle directly for embedded wallets from signup
3. **Supabase Database** - Check wallets table for database-backed wallets

**Returns:**
```typescript
{
  hasExistingWallet: boolean;
  wallet?: {
    walletId: string;
    walletAddress: string;
    userId: string;
    userToken: string;
    encryptionKey?: string;
    source: "signup" | "agent" | "supabase" | "circle";
  };
  needsCreation: boolean;
}
```

#### 2. Updated Chat Page (`app/chat/page.tsx`)

**Before creating wallet:**
1. Check localStorage for existing user credentials from signup
2. If credentials exist, call `detectExistingWallet()` to find wallet
3. If wallet found, use it and skip creation
4. If no wallet found, proceed with normal wallet creation flow

**Key Changes:**
- Checks for existing wallets **before** creating new user
- Reuses existing user credentials from signup
- Only creates new wallet if none exists
- Saves detected wallets to Supabase for future lookups

### Benefits

1. **No Duplicate Wallets** - Users get one wallet regardless of signup method
2. **Seamless Experience** - Signup wallets work immediately with agent
3. **Backward Compatible** - Existing agent-created wallets still work
4. **Multi-Source Detection** - Checks all possible wallet sources

### Usage

**In Chat Page:**
```typescript
// Before creating wallet
const walletCheck = await detectExistingWallet(userId, userToken);

if (walletCheck.hasExistingWallet && walletCheck.wallet) {
  // Use existing wallet
  setWalletId(walletCheck.wallet.walletId);
  setWalletAddress(walletCheck.wallet.walletAddress);
  // Skip wallet creation
} else {
  // Create new wallet
  await createWallet(...);
}
```

**In API Routes:**
The wallet API (`/api/circle/wallets`) already checks for existing wallets (lines 160-202), so it works with this system automatically.

### Testing

**Test Scenarios:**
1. ✅ User signs up via email → Wallet created → Agent detects and uses it
2. ✅ User signs up via Google → Wallet created → Agent detects and uses it
3. ✅ User creates wallet via agent → No duplicate on signup
4. ✅ User has wallet in Supabase → Agent detects and uses it
5. ✅ User has no wallet → Agent creates new one

### Files Modified

1. **`lib/wallet/wallet-detection.ts`** (NEW) - Unified detection service
2. **`app/chat/page.tsx`** - Updated to use detection before creation
3. **`.cursor/scratchpad.md`** - Documented fix

### Future Enhancements

1. **Wallet Migration** - Merge multiple wallets if duplicates exist
2. **Wallet Selection** - Allow users to choose which wallet to use
3. **Wallet Linking** - Link wallets from different sources to same user
4. **Analytics** - Track wallet creation sources for insights


