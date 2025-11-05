# Arc Blockchain Integration Guide

## How ARCLE Uses Arc Blockchain

### ✅ Currently Implemented

#### 1. **Arc Network Configuration**
- ✅ Arc Testnet RPC: `https://rpc.testnet.arc.network`
- ✅ Chain ID: `5042002`
- ✅ USDC Contract Address: `0x3600000000000000000000000000000000000000`
- ✅ Arc Explorer: `https://testnet.arcscan.app`
- ✅ Viem client configured for Arc

#### 2. **Wallet Creation on Arc**
- ✅ Wallets created with `blockchains: ["ARC-TESTNET"]`
- ✅ Circle Programmable Wallets deployed on Arc network
- ✅ Arc-specific wallet addresses generated

#### 3. **USDC Transactions on Arc**
- ✅ All transactions use Arc USDC contract address
- ✅ USDC amount formatting (6 decimals) for Arc
- ✅ Transaction network set to "ARC"
- ✅ Arc address validation

#### 4. **Direct Arc Blockchain Queries**
- ✅ Balance queries via Arc RPC (`getArcClient()`)
- ✅ Direct contract calls to USDC on Arc
- ✅ Fallback to blockchain when Circle API unavailable

### 🎯 Arc's Unique Features We Should Leverage

#### 1. **USDC for Gas (Not ETH)**
**Current Status**: ⚠️ Partially Implemented
- Arc uses USDC for gas fees, not ETH
- This means users pay fees in stable, predictable USDC amounts
- We should display gas fees in USDC and highlight this benefit

**Enhancement Needed**:
- Show gas fees in USDC terms (e.g., "$0.01 USDC gas fee")
- Explain to users that Arc uses USDC for gas (no ETH needed)
- Display this as a key advantage

#### 2. **Sub-Second Finality**
**Current Status**: ⚠️ Not Leveraged
- Arc offers sub-second transaction finality
- Much faster than Ethereum (12-15 seconds)
- We should highlight this speed advantage

**Enhancement Needed**:
- Show estimated confirmation time ("~1 second on Arc")
- Display transaction speed as a feature
- Update transaction status faster (poll more frequently)

#### 3. **Native Stablecoin Infrastructure**
**Current Status**: ✅ Using USDC
- Arc is stablecoin-native
- USDC is first-class on Arc
- We're already using this, but should highlight it

**Enhancement Needed**:
- Emphasize Arc's stablecoin-native design
- Show that USDC is native (not a wrapped token)
- Highlight lower fees and better UX

#### 4. **Opt-In Privacy**
**Current Status**: ❌ Not Implemented
- Arc supports opt-in privacy features
- Users can choose private transactions
- Enterprise-grade privacy controls

**Future Enhancement**:
- Add privacy toggle for transactions
- Explain privacy options to users
- Integrate Arc's privacy features when available

#### 5. **Circle Gas Station & Paymaster**
**Current Status**: ❌ Not Implemented
- Circle Gas Station allows gas sponsorship
- Circle Paymaster allows USDC gas payments
- Can reduce user friction significantly

**Future Enhancement**:
- Integrate Circle Gas Station for gasless transactions
- Use Circle Paymaster for USDC gas payments
- Sponsor user transactions (if applicable)

### 📊 Current Arc Usage Summary

| Feature | Status | Implementation |
|---------|--------|----------------|
| Arc Network Config | ✅ | `lib/arc.ts` |
| Arc RPC Connection | ✅ | `getArcClient()` |
| Arc Wallet Creation | ✅ | Circle API with `blockchains: ["ARC-TESTNET"]` |
| Arc USDC Address | ✅ | `0x3600000000000000000000000000000000000000` |
| Arc Transaction Creation | ✅ | Circle API with Arc tokenId |
| Arc Balance Queries | ✅ | Direct RPC + Circle API |
| USDC Gas Display | ⚠️ | Show as "USDC" but not emphasized |
| Sub-Second Finality | ⚠️ | Fast polling but not highlighted |
| Privacy Features | ❌ | Not implemented |
| Gas Station/Paymaster | ❌ | Not implemented |

### 🚀 Recommended Enhancements

1. **Emphasize USDC Gas**
   - Update UI to show "Gas: $0.01 USDC" instead of generic fee
   - Add explanation: "Arc uses USDC for gas - no ETH needed!"
   - Highlight this as a key advantage

2. **Show Arc Speed**
   - Display "~1 second confirmation" for Arc transactions
   - Compare to Ethereum's 12-15 seconds
   - Update transaction status polling to be faster (1-2 seconds)

3. **Arc-Specific Transaction Links**
   - Use Arc Explorer links: `https://testnet.arcscan.app/tx/{hash}`
   - Show Arc network badge in transaction details
   - Highlight that transactions are on Arc

4. **USDC Native Messaging**
   - Explain that USDC is native on Arc (not wrapped)
   - Show lower fees compared to other networks
   - Emphasize stablecoin-first design

5. **Network-Specific Features**
   - Add Arc network info to wallet creation flow
   - Show Arc chain ID in wallet details
   - Display Arc network status

### 💡 Key Arc Advantages to Highlight

1. **USDC for Gas**: No need for separate ETH holdings
2. **Sub-Second Finality**: Transactions confirm in ~1 second
3. **Stablecoin-Native**: Built for USDC from the ground up
4. **Lower Fees**: More cost-effective than Ethereum mainnet
5. **Circle Integration**: Native Circle services support
6. **Enterprise-Grade**: Security and compliance features

### 🔧 Implementation Files

- `lib/arc.ts` - Arc network configuration
- `app/api/circle/wallets/route.ts` - Arc wallet creation
- `app/api/circle/transactions/route.ts` - Arc transactions
- `app/api/circle/balance/route.ts` - Arc balance queries
- `app/api/arc/balance/route.ts` - Direct Arc RPC queries

