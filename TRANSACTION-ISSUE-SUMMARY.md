# Transaction Creation Issue Summary

## Problem
Transactions fail with a 401 error when the Circle SDK tries to fetch the entity public key (`/v1/w3s/config/entity/publicKey`).

## Root Cause
The Circle SDK requires the entity public key to encrypt the Entity Secret for each transaction. However, the API key cannot access this endpoint (401 Unauthorized), even though:
- ✅ Wallet creation works (Entity Secret IS registered)
- ✅ Standard API keys don't have permission restrictions
- ✅ Entity Secret is properly configured

## What We've Tried
1. ✅ **SDK approach (initial)**: Using `client.createTransaction()` with `tokenAddress` + `blockchain` - fails with 401 on public key fetch
2. ✅ **REST API fallback**: Tried `/v1/w3s/developer/wallets/{walletId}/transactions` - returns "Resource not found"
3. ✅ **Regular endpoint**: Tried `/v1/w3s/wallets/{walletId}/transactions` - returns "Resource not found"
4. ✅ **Explicit public key fetch**: Using `client.getPublicKey()` - also fails with 401
5. ✅ **Validation**: Added same-address validation (working correctly)
6. ✅ **Updated SDK approach (per Circle docs)**: 
   - Fetch `tokenId` from wallet balance query
   - Use `tokenId` instead of `tokenAddress` + `blockchain`
   - Use correct fee structure: `{ type: "level", config: { feeLevel: "MEDIUM" } }`
   - Use `amounts` array with decimal format strings

## Current Status
- ✅ **Validation working**: Same-address transactions are correctly rejected
- 🔄 **Transaction creation**: Updated to use `tokenId` approach per Circle documentation
  - Now fetches `tokenId` from wallet balance before creating transaction
  - Uses correct SDK format: `walletId`, `tokenId`, `destinationAddress`, `amounts`, `fee`
  - **Testing needed**: This should resolve the issue if the problem was incorrect parameter format
- ✅ **Wallet creation**: Working correctly
- ✅ **Balance queries**: Working correctly

## Possible Solutions

### Option 1: Contact Circle Support (Recommended)
This appears to be an API/SDK limitation. Contact Circle support with:
- Your API key prefix (TEST_API_KEY:...)
- The error: "401 Unauthorized on /v1/w3s/config/entity/publicKey"
- That wallet creation works but transactions fail
- Request access to the entity public key endpoint

### Option 2: Verify Entity Secret Registration
1. Run: `npm run register-entity-secret`
2. Check Circle Console: https://console.circle.com/
3. Verify Entity Secret is registered in Entity Settings

### Option 3: Create New API Key
1. Go to Circle Console: https://console.circle.com/
2. Create a new Standard API key
3. Update `.env` with the new key
4. Test again

### Option 4: Use Correct SDK Format (✅ IMPLEMENTED)
Based on Circle documentation review:
- ✅ Fetch `tokenId` from wallet balance query (`GET /v1/w3s/wallets/{id}/balances`)
- ✅ Use `tokenId` instead of `tokenAddress` + `blockchain` in SDK call
- ✅ Use correct fee structure: `{ type: "level", config: { feeLevel: "MEDIUM" } }`
- ✅ Use `amounts` array with decimal format strings (e.g., `["0.01"]`)

**Reference**: https://developers.circle.com/wallets/dev-controlled/transfer-tokens-across-wallets

## Error Details
```
SDK Error: Request failed with status code 401
URL: https://api-sandbox.circle.com/v1/w3s/config/entity/publicKey
Response: { code: 401, message: 'Invalid credentials.' }
```

## Next Steps
1. Contact Circle Support with the above information
2. Check Circle Console for any API key restrictions
3. Verify Entity Secret registration status
4. Monitor Circle documentation for updates

