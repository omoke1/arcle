# Entity Secret Setup Guide

## The Problem

You're seeing this error:
```
code: 156016
message: 'The entity secret has not been set yet. Please provide encrypted ciphertext in the console.'
```

This means your Entity Secret needs to be **registered in Circle Console** before it can be used.

## Solution Options

### Option 1: Register Entity Secret in Circle Console (Recommended)

1. **Go to Circle Developer Console**: https://console.circle.com/
2. **Navigate to Entity Settings**:
   - Find your Entity/Account
   - Look for "Entity Secret" or "Security" section
3. **Register the Entity Secret**:
   - The SDK automatically encrypts your Entity Secret
   - You may need to copy the encrypted ciphertext from the error logs
   - Or Circle Console may provide a way to upload/register it

### Option 2: Use Standalone Script (May Work Differently)

The standalone script (`npm run create-wallet`) might handle Entity Secret registration differently:

```bash
npm run create-wallet
```

This script:
- Generates Entity Secret if needed
- Creates wallet set
- Creates wallet
- May handle Entity Secret registration automatically

### Option 3: Check API Environment

The error shows the request is going to `api.circle.com` (production) instead of `api-sandbox.circle.com` (sandbox).

**Verify your API key**:
- Sandbox API keys start with `TEST_API_KEY:`
- Production API keys start with `LIVE_API_KEY:`

Your current API key appears to be a test key (`TEST_API_KEY:...`), so the SDK should automatically use sandbox, but ensure:
- Your `.env` has `NEXT_PUBLIC_ENV=sandbox`
- The SDK is detecting the environment correctly

## Next Steps

1. **Check Circle Console** for Entity Secret registration
2. **Try the standalone script** first: `npm run create-wallet`
3. **Verify API key** is for sandbox (TEST_API_KEY prefix)
4. **Check Circle documentation** for Entity Secret registration process

## Reference

- Circle Developer Console: https://console.circle.com/
- Circle Docs: https://developers.circle.com/developer-controlled-wallets/docs

