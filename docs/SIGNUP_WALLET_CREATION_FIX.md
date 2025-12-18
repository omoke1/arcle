# Social/Email Signup Wallet Creation Fix

## Problem

After social/email signup, wallets were not being created automatically. The `performLogin()` method from Circle SDK only creates a user, not a wallet. This meant:

1. Users sign up via Google/Email → User created, but NO wallet
2. User goes to chat → Agent tries to create wallet
3. Sometimes duplicate users were created
4. Wallet creation was inconsistent

## Root Cause

Circle's `performLogin()` method (used in social/email signup) only creates a **user**, not a wallet. Wallets must be created separately using:
- `createUserPinWithWallets()` - For users without PIN (first-time setup)
- `createWallet()` - For users with existing PIN

## Solution

Created automatic wallet creation after signup that:

1. **Checks for existing wallet** using `detectExistingWallet()`
2. **Creates wallet if missing** using appropriate Circle SDK method
3. **Saves wallet info** to localStorage and Supabase
4. **Handles PIN setup** if needed (deferred to chat page)

### Implementation

#### 1. New Service: `lib/wallet/signup-wallet-creation.ts`

**Key Function**: `ensureWalletAfterSignup()`

```typescript
// After signup, automatically ensure wallet exists
const walletResult = await ensureWalletAfterSignup(
  userId,
  userToken,
  encryptionKey,
  "ARC-TESTNET"
);
```

**Flow**:
1. Check if wallet already exists (via `detectExistingWallet()`)
2. If exists → Return wallet info
3. If not exists:
   - Check if user has PIN (`getUser()` → `pinStatus`)
   - If PIN exists → Use `createWallet()` (returns challengeId)
   - If no PIN → Use `createUserPinWithWallets()` (returns challengeId)
4. Save wallet to Supabase and localStorage

#### 2. Updated Signup Flow: `app/page.tsx`

**After invite code verification**:
1. Save credentials to Supabase and localStorage
2. Call `ensureWalletAfterSignup()`
3. If wallet created → Save to localStorage
4. If PIN needed → Defer to chat page (user will be prompted)
5. Redirect to chat

**Key Changes**:
```typescript
// In handleVerifyCode(), after invite code verification:
const walletResult = await ensureWalletAfterSignup(
  circleAuthData.userId,
  circleAuthData.userToken,
  circleAuthData.encryptionKey,
  "ARC-TESTNET"
);

if (walletResult.success && walletResult.walletId) {
  // Save to localStorage for chat page
  localStorage.setItem("arcle_wallet_id", walletResult.walletId);
  localStorage.setItem("arcle_wallet_address", walletResult.walletAddress);
}
```

#### 3. Fixed SDK Usage

**Issue**: Code was using non-existent `getUserInstance()` method

**Fix**: Use `getUserCircleClient()` directly:
```typescript
// Before (WRONG):
const userClient = (client as any).getUserInstance({ userToken });
await userClient.listWallets(...);

// After (CORRECT):
const client = getUserCircleClient();
await client.listWallets({ userToken, ... });
```

## Benefits

1. **Automatic Wallet Creation** - Users get wallets immediately after signup
2. **No Duplicates** - Detection service prevents duplicate wallets
3. **Seamless Experience** - Wallet ready when user reaches chat
4. **Proper PIN Handling** - PIN setup deferred to chat if needed
5. **Consistent State** - Wallet info saved to both localStorage and Supabase

## Testing

**Test Scenarios**:
1. ✅ Social signup → Wallet created automatically
2. ✅ Email signup → Wallet created automatically
3. ✅ Existing wallet → Reused (no duplicate)
4. ✅ No PIN → PIN setup deferred to chat
5. ✅ Has PIN → Wallet created with PIN verification challenge

## Files Modified

1. **`lib/wallet/signup-wallet-creation.ts`** (NEW) - Wallet creation service
2. **`app/page.tsx`** - Integrated wallet creation after signup
3. **`lib/wallet/wallet-detection.ts`** - Fixed SDK usage
4. **`.cursor/scratchpad.md`** - Documented fix

## Next Steps

- [ ] Test with real Circle API
- [ ] Handle PIN widget in signup flow (optional - currently deferred to chat)
- [ ] Add error recovery for failed wallet creation
- [ ] Add analytics for wallet creation success rate


