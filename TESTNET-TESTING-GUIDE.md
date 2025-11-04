# Arc Testnet Testing Guide

## How to Test ARCLE on Arc Testnet

This guide will help you test all ARCLE features with real testnet USDC on Arc testnet.

### Prerequisites

1. ✅ Circle Developer Account with API keys
2. ✅ Arc Testnet configured
3. ✅ Wallet created on Arc testnet
4. ✅ Testnet tokens requested

---

## Step 1: Get Testnet USDC

### Option A: Automatic (Recommended)
When you create a wallet via the web app, testnet tokens are automatically requested from Circle's faucet.

### Option B: Manual Request via Script
Run the wallet creation script which automatically requests testnet tokens:

```bash
npm run create-wallet
```

This script will:
1. Create a wallet on Arc testnet
2. Automatically request testnet tokens (native + USDC)
3. Save wallet info to `wallet-info.json`

### Option C: Request Tokens via API
If you already have a wallet, you can request tokens via the API:

```bash
curl -X POST http://localhost:3000/api/circle/faucet \
  -H "Content-Type: application/json" \
  -d '{
    "address": "YOUR_WALLET_ADDRESS",
    "blockchain": "ARC-TESTNET",
    "native": true,
    "usdc": true
  }'
```

### Option D: Request via Chat (Available Now)
In the ARCLE chat interface, you can request testnet tokens by typing:
- "Request testnet tokens"
- "Get testnet USDC"
- "Faucet"
- "Request tokens"

The AI will automatically request tokens for your wallet.

---

## Step 2: Verify You Have Testnet USDC

### Check Balance
1. Open ARCLE app
2. Log in (or create wallet)
3. Ask in chat: **"What's my balance?"**
4. Should show your USDC balance (should be > 0 if tokens were received)

### Or Check via API
```bash
curl "http://localhost:3000/api/circle/balance?walletId=YOUR_WALLET_ID"
```

### Or Check on Arc Explorer
Visit: `https://testnet.arcscan.app/address/YOUR_WALLET_ADDRESS`

---

## Step 3: Test All Services

### ✅ 1. Send USDC (Test Transaction)
**In Chat:**
```
Send $1 to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

**What to Test:**
- ✅ Transaction preview shows correctly
- ✅ Risk scoring works
- ✅ Transaction executes on Arc testnet
- ✅ Balance updates after transaction
- ✅ Transaction appears in history
- ✅ Transaction link works on Arc Explorer

**Expected Result:**
- Transaction hash generated
- Status: "confirmed" (sub-second on Arc)
- Balance decreases by $1 + gas fee
- Transaction visible on Arc Explorer

---

### ✅ 2. Receive USDC (QR Code)
**In Chat:**
```
Show my address
```
or click **"Receive"** button

**What to Test:**
- ✅ QR code displays correctly
- ✅ Address is valid Arc address
- ✅ Can copy address
- ✅ QR code scans correctly

**To Test Receiving:**
1. Get your wallet address
2. Send USDC to it from another wallet (or use faucet)
3. Check balance updates

---

### ✅ 3. Check Balance
**In Chat:**
```
What's my balance?
```
or click balance in header

**What to Test:**
- ✅ Balance displays correctly
- ✅ Updates after transactions
- ✅ Shows "Native USDC" badge
- ✅ Real-time updates (every 30 seconds)

---

### ✅ 4. Transaction History
**In Chat:**
```
Show transaction history
```

**What to Test:**
- ✅ Lists all transactions
- ✅ Shows transaction details
- ✅ Links to Arc Explorer work
- ✅ Status updates correctly
- ✅ Shows "~1s finality" badge

---

### ✅ 5. Pay (Same as Send)
**In Chat:**
```
Pay $2 to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

**What to Test:**
- ✅ Works same as send
- ✅ Transaction executes
- ✅ Payment-specific messaging

---

### ⏳ 6. Bridge (Coming Soon)
**In Chat:**
```
Bridge $5 to Ethereum
```

**Status:** Placeholder - Coming soon

---

### ⏳ 7. Withdraw (Coming Soon)
**In Chat:**
```
Withdraw $10 to bank account
```

**Status:** Placeholder - Coming soon

---

### ⏳ 8. Yield (Coming Soon)
**In Chat:**
```
Show yield options
```

**Status:** Placeholder - Coming soon

---

## Step 4: Verify Transactions on Arc Explorer

After each transaction:

1. **Get Transaction Hash** from chat confirmation
2. **Visit Arc Explorer**: `https://testnet.arcscan.app/tx/YOUR_TX_HASH`
3. **Verify**:
   - ✅ Transaction status: "Success"
   - ✅ From address: Your wallet
   - ✅ To address: Recipient
   - ✅ Amount: Matches what you sent
   - ✅ Gas paid in USDC
   - ✅ Finality time: ~1 second

---

## Step 5: Test Edge Cases

### Test 1: Insufficient Balance
- Try sending more than your balance
- Should show error message

### Test 2: Invalid Address
- Try sending to invalid address
- Should show validation error

### Test 3: High Risk Address
- Try sending to known scam address (if configured)
- Should show risk warning or block

### Test 4: Zero Balance
- Check balance with 0 USDC
- Should show $0.00 correctly

### Test 5: Transaction Status
- Send a transaction
- Check status updates from "pending" → "confirmed"

---

## Step 6: Monitor Real Transactions

### Check Arc Explorer
- View all your transactions: `https://testnet.arcscan.app/address/YOUR_ADDRESS`
- Verify transaction details
- Check gas fees (should be in USDC)

### Check Balance Updates
- Send transaction
- Wait ~1 second (Arc finality)
- Check balance updates automatically
- Verify amount deducted correctly

---

## Troubleshooting

### Problem: "Failed to request testnet tokens"
**Solution:**
- Check API key is valid
- Verify wallet address is correct
- Wait a few minutes (rate limiting)
- Try again

### Problem: "Balance is 0.00"
**Solution:**
- Request testnet tokens again
- Wait 1-2 minutes for tokens to arrive
- Check Arc Explorer for token balance
- Verify wallet address is correct

### Problem: "Transaction failed"
**Solution:**
- Check you have enough USDC for gas
- Verify recipient address is valid
- Check Arc testnet status
- View transaction on Arc Explorer for details

### Problem: "Transaction stuck pending"
**Solution:**
- Arc has sub-second finality, so this shouldn't happen
- Check Arc testnet status
- View transaction hash on Arc Explorer
- Transaction should confirm quickly

---

## Expected Testnet Token Amounts

When requesting testnet tokens from Circle:
- **Native Tokens**: For gas fees (if needed)
- **USDC**: Typically 100-1000 USDC testnet tokens

**Note:** These are testnet tokens with no real value.

---

## Testing Checklist

- [ ] Wallet created on Arc testnet
- [ ] Testnet USDC received (balance > 0)
- [ ] Send transaction works
- [ ] Transaction confirmed on Arc Explorer
- [ ] Balance updates after transaction
- [ ] Transaction history shows transactions
- [ ] QR code displays correctly
- [ ] Risk scoring works
- [ ] Address validation works
- [ ] Transaction links work
- [ ] All buttons functional (Send, Receive, Pay, Bridge, Withdraw, Yield)
- [ ] Error handling works
- [ ] Real-time balance updates

---

## Next Steps After Testing

1. ✅ Fix any bugs found
2. ✅ Improve error messages
3. ✅ Optimize transaction confirmation speed
4. ✅ Add more testnet token request options
5. ✅ Prepare for mainnet deployment (when Arc mainnet launches)

---

## Useful Links

- **Arc Testnet Explorer**: https://testnet.arcscan.app
- **Arc Documentation**: https://docs.arc.network/
- **Circle Developer Console**: https://console.circle.com/
- **Arc RPC**: https://rpc.testnet.arc.network

---

## Notes

- All transactions are on **Arc Testnet** (not mainnet)
- Testnet tokens have **no real value**
- Transactions are **real** on testnet (not mocked)
- Arc has **sub-second finality** - transactions confirm quickly
- Gas fees are paid in **USDC** (not ETH)

