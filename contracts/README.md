# Session Key Module - Smart Contracts

## Overview

This directory contains the custom ERC-6900 Session Key Module that integrates with Circle's MSCA infrastructure.

## Files

- `interfaces/IERC6900Module.sol` - ERC-6900 standard interface
- `interfaces/ISessionKeyModule.sol` - Session key module interface
- `modules/SessionKeyModule.sol` - Main implementation
- `utils/ActionTypes.sol` - Action encoding/decoding utilities

## Compilation Note

Hardhat 3.x requires ESM (`"type": "module"` in package.json), but this Next.js project uses CommonJS.

### Option 1: Use Foundry (Recommended)
```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Compile
forge build

# Test
forge test
```

### Option 2: Separate Contract Package
Create a separate `contracts/` directory with its own `package.json`:
```json
{
  "name": "arcle-contracts",
  "type": "module",
  "scripts": {
    "compile": "hardhat compile",
    "test": "hardhat test"
  }
}
```

### Option 3: Use Hardhat 2.x
Downgrade to Hardhat 2.x which supports CommonJS:
```bash
npm install --save-dev hardhat@^2.19.0
```

## Deployment

After compilation, deploy to networks:

```bash
# Arc Testnet
npx hardhat run scripts/deploy-session-key-module.ts --network arc-testnet

# Sepolia
npx hardhat run scripts/deploy-session-key-module.ts --network sepolia
```

## Integration with Circle MSCA

The module integrates with Circle's MSCA by:

1. **Implementing IERC6900Module** - Standard module interface
2. **validateUserOp()** - Validates transactions signed by session keys
3. **executeUserOp()** - Executes validated transactions
4. **On-chain enforcement** - Spending limits, time windows, action scopes

## Next Steps

1. ✅ Smart contracts written
2. ⏳ Compile contracts (choose option above)
3. ⏳ Deploy to testnet
4. ⏳ Integrate with Circle MSCA backend
5. ⏳ Update session key management APIs

