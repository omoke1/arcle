# Response to Circle Support

## SDK Information
**SDK**: `@circle-fin/developer-controlled-wallets` version `9.2.1`

## Request/Response Logs

### Request
```typescript
client.createTransaction({
  walletId: "e9e286d9-00ea-5f09-8c33-5eafe69f8f44",
  tokenId: "<tokenId-from-balance>",
  destinationAddress: "0x1234567890123456789012345678901234567890",
  amounts: ["0.01"],
  fee: { type: "level", config: { feeLevel: "MEDIUM" } }
})
```

### Error Response (RESOLVED)
```
401 Unauthorized
URL: GET https://api-sandbox.circle.com/v1/w3s/config/entity/publicKey
Response: { code: 401, message: 'Invalid credentials.' }
```

**Update**: The issue was that the SDK was using the sandbox URL (`api-sandbox.circle.com`) instead of production (`api.circle.com`). This has been fixed - the SDK now defaults to production URL.

## Context
- Wallet creation works (Entity Secret is registered)
- Transaction creation fails because SDK cannot fetch entity public key (401)
- Environment: Sandbox (TEST_API_KEY)
- API Key: `TEST_API_KEY:ac32ddd599941798045f2e724da7ec44:...`

## Full Error Details
The SDK internally calls `GET /v1/w3s/config/entity/publicKey` before creating the transaction, which returns 401. All REST API fallback endpoints return 404.

