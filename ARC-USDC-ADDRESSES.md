# Arc Network USDC Contract Addresses

## Status: ⚠️ Not Found in Circle's General USDC Addresses List

According to Circle's official USDC contract addresses documentation:
https://developers.circle.com/stablecoins/usdc-contract-addresses

**Arc network is NOT currently listed** in either the mainnet or testnet sections.

### Possible Reasons:
1. **Arc Mainnet hasn't launched yet** - USDC mainnet address will be added when Arc mainnet goes live
2. **Arc-specific deployment** - USDC on Arc may be documented separately in Arc-specific docs
3. **Different token structure** - Arc might use a different USDC deployment method

## How to Find Arc USDC Addresses

### Option 1: Check Arc Network Documentation
- Arc documentation: https://docs.arc.network/
- Arc contract addresses: Check Arc-specific contract reference docs
- Arc Explorer: https://testnet.arcscan.app - Search for USDC token

### Option 2: Check Circle Developer Console
- Circle Developer Services Console
- Arc network settings/configuration
- Token addresses for Arc network

### Option 3: Query Arc Network Directly
- Use Arc RPC to query for USDC contract
- Check token registry on Arc
- Query Circle's API for Arc-specific token addresses

### Option 4: Contact Circle Support
- If Arc is supported but not documented, contact Circle support
- Ask for USDC contract address on Arc testnet/mainnet

## Current Configuration

We have placeholders that will throw errors if used without proper addresses:

```typescript
// lib/arc.ts
export const USDC_ADDRESSES = {
  mainnet: process.env.NEXT_PUBLIC_ARC_USDC_ADDRESS || "0x...",
  testnet: process.env.NEXT_PUBLIC_ARC_USDC_TESTNET_ADDRESS || "0x...",
};
```

## Recommended Next Steps

1. **Check Arc Explorer**: Visit https://testnet.arcscan.app and search for "USDC" or check verified tokens
2. **Circle API**: Try querying Circle's API for token addresses on Arc network
3. **Arc Documentation**: Check Arc docs for a contract addresses section
4. **Temporary Workaround**: Use Circle Wallets API to get token addresses dynamically

## Notes

- Arc is Circle's own blockchain, so USDC deployment should exist
- Since Arc uses USDC for gas, the address must exist
- The address might be different from other EVM chains due to Arc's unique architecture

---

**Reference**: https://developers.circle.com/stablecoins/usdc-contract-addresses
**Last Updated**: After checking Circle USDC addresses documentation
**Status**: Arc not found in general list, need Arc-specific documentation

