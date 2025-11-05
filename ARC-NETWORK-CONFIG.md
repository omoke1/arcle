# Arc Network Configuration

## Arc Network Details

### Arc Testnet ✅

**Network Information:**
- **Network Name**: Arc Testnet
- **RPC Endpoint**: `https://rpc.testnet.arc.network`
- **Chain ID**: `5042002`
- **Currency Symbol**: USDC (for gas)
- **Block Explorer**: `https://testnet.arcscan.app`

**Alternative RPC Endpoints:**
- `https://rpc.quicknode.testnet.arc.network`
- `https://rpc.blockdaemon.testnet.arc.network`

### Arc Mainnet ⚠️

**Note**: Arc mainnet may not be launched yet. When available:
- **Network Name**: Arc
- **RPC Endpoint**: `https://rpc.arc.network` (to be confirmed)
- **Chain ID**: TBD
- **Block Explorer**: `https://arcscan.app`

## Environment Configuration

### For Testnet Development:

```env
# Arc Testnet
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_ARC_CHAIN_ID=5042002
NEXT_PUBLIC_ARC_USDC_TESTNET_ADDRESS=0x3600000000000000000000000000000000000000  # Default, can override
NEXT_PUBLIC_ENV=sandbox
```

**Note**: The USDC testnet address is set by default. You can override it via `NEXT_PUBLIC_ARC_USDC_TESTNET_ADDRESS` if needed.

### For Mainnet (when available):

```env
# Arc Mainnet
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.arc.network
NEXT_PUBLIC_ARC_CHAIN_ID=<mainnet-chain-id>
NEXT_PUBLIC_ARC_USDC_ADDRESS=0x...  # Get from Circle/Arc docs
NEXT_PUBLIC_ENV=production
```

## USDC Contract Addresses

✅ **Arc Testnet USDC**: `0x3600000000000000000000000000000000000000`
- Found on Arc Explorer: https://testnet.arcscan.app/address/0x3600000000000000000000000000000000000000
- This is the default testnet address (can be overridden via env variable)

⚠️ **Arc Mainnet USDC**: TBD (when Arc mainnet launches)

These addresses are required for:
- Balance queries
- Transaction creation
- Token transfers

## How to Find Arc Network Details

1. **Arc Documentation**: https://docs.arc.network/
2. **Connect to Arc**: https://docs.arc.network/arc/references/connect-to-arc
3. **Circle Developer Services**: Check contract addresses in Circle console

## Current Configuration Status

✅ **Testnet RPC URL**: Configured (`https://rpc.testnet.arc.network`)
✅ **Testnet Chain ID**: Configured (`5042002`)
✅ **Testnet Explorer**: Configured (`https://testnet.arcscan.app`)
⚠️ **USDC Addresses**: Need to be added from Circle/Arc documentation
⚠️ **Mainnet Details**: Not yet available (Arc mainnet may not be launched)

---

**Last Updated**: After Arc documentation review
**Status**: Testnet configured, mainnet pending launch

