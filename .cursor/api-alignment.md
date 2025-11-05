# API Alignment Documentation

## Circle API Implementation Status

This document tracks the alignment of ARCLE's implementation with Circle's actual API documentation.

### ✅ Implemented and Aligned

#### 1. **Circle Wallets API**
- ✅ `POST /v1/w3s/wallets` - Create wallet
- ✅ `GET /v1/w3s/wallets` - List wallets
- ✅ `GET /v1/w3s/wallets/{walletId}` - Get wallet details
- ✅ Support for Arc network (`blockchains: ["ARC"]`)
- ✅ Idempotency key support

#### 2. **Circle Balance API**
- ✅ `GET /v1/w3s/wallets/{walletId}/balances` - Get wallet balances
- ✅ Direct blockchain query fallback (via Viem)
- ✅ USDC balance formatting (6 decimals)

#### 3. **Circle Transactions API**
- ✅ `POST /v1/w3s/wallets/{walletId}/transactions` - Create transaction
- ✅ `GET /v1/w3s/transactions/{transactionId}` - Get transaction status
- ✅ `GET /v1/w3s/wallets/{walletId}/transactions` - List transactions
- ✅ USDC amount conversion (6 decimals)
- ✅ Fee level support (LOW, MEDIUM, HIGH)

### ⚠️ Requires Configuration

#### 1. **Environment Variables**
Add to `.env`:
```env
# Circle API
NEXT_PUBLIC_CIRCLE_APP_ID=your_app_id
NEXT_PUBLIC_CIRCLE_API_KEY=your_api_key
CIRCLE_ENTITY_SECRET=your_entity_secret
NEXT_PUBLIC_ENV=sandbox  # or "production"

# Arc Network (Testnet)
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_ARC_CHAIN_ID=5042002  # Arc Testnet Chain ID
NEXT_PUBLIC_ARC_USDC_TESTNET_ADDRESS=0x...  # Testnet USDC (get from Circle/Arc docs)

# Arc Mainnet (when available)
NEXT_PUBLIC_ARC_MAINNET_RPC_URL=https://rpc.arc.network
NEXT_PUBLIC_ARC_MAINNET_CHAIN_ID=TBD  # Mainnet chain ID when launched
NEXT_PUBLIC_ARC_USDC_ADDRESS=0x...  # Mainnet USDC (when available)
```

#### 2. **Arc Network Configuration**
- ✅ **Arc Testnet Chain ID**: `5042002` (configured)
- ✅ **Arc Testnet RPC URL**: `https://rpc.testnet.arc.network` (configured)
- ✅ **Arc Testnet Explorer**: `https://testnet.arcscan.app` (configured)
- ✅ **USDC Testnet Address**: `0x3600000000000000000000000000000000000000` (found on Arc Explorer: https://testnet.arcscan.app/address/0x3600000000000000000000000000000000000000)
- ⚠️ **USDC Mainnet Address**: TBD (when Arc mainnet launches)
- ℹ️ **Note**: Arc is NOT listed in Circle's general USDC addresses documentation, but address found via Arc Explorer
- ⚠️ **Arc Mainnet**: Not yet launched (details TBD)

### 🔄 To Be Implemented (Post-MVP)

#### 1. **User-Controlled Wallets (ERC-4337)**
- [ ] UserController SDK integration (`@circle-fin/w3sdk-web`)
- [ ] User token generation
- [ ] Encryption key management
- [ ] User operation signing (ERC-4337)

#### 2. **Bundler Client**
- [ ] ERC-4337 bundler client setup
- [ ] User operation submission
- [ ] Gas estimation for user operations

#### 3. **Paymaster Integration**
- [ ] Circle Paymaster setup
- [ ] Gas sponsorship configuration
- [ ] USDC gas payment

#### 4. **CCTP (Cross-Chain)**
- [ ] CCTP SDK integration (`@circle-fin/cctp-sdk`)
- [ ] Cross-chain transfer initiation
- [ ] Attestation monitoring
- ⚠️ Note: Arc may not be supported in CCTP yet

#### 5. **Advanced Features**
- [ ] Batch transactions
- [ ] Transaction estimation
- [ ] Smart contract interactions
- [ ] Token approvals

### 📋 API Endpoint Reference

#### Base URLs
- **Sandbox**: `https://api-sandbox.circle.com`
- **Production**: `https://api.circle.com`

#### Authentication
- **Method**: Bearer token
- **Header**: `Authorization: Bearer {API_KEY}`
- **API Key**: Set in `NEXT_PUBLIC_CIRCLE_API_KEY`

#### Common Headers
```
Content-Type: application/json
Authorization: Bearer {API_KEY}
```

### 🔍 Testing Checklist

Before deploying:
- [ ] Circle API key configured and tested
- [ ] Arc RPC URL configured and accessible
- [ ] USDC contract addresses verified
- [ ] Wallet creation tested on Arc
- [ ] Balance queries working
- [ ] Transaction creation working
- [ ] Transaction status tracking working

### 📚 Documentation References

- Circle Wallets API: https://developers.circle.com/wallets/docs
- Circle CCTP: https://developers.circle.com/stablecoin/docs/cctp-technical-reference
- Arc Network: https://docs.arc.network/

---

**Last Updated**: Initial API alignment
**Status**: ✅ Core APIs aligned, configuration needed

