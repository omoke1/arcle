require("@nomicfoundation/hardhat-toolbox");
// Load from both .env and .env.local (.env.local takes precedence)
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    // Arc Testnet
    "arc-testnet": {
      url: process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network",
      chainId: 5042002,
      accounts: (() => {
        const key = process.env.PRIVATE_KEY;
        if (!key) return [];
        const trimmed = key.trim();
        // Ensure it's 64 hex chars (32 bytes) or 66 with 0x
        if (trimmed.length === 64) {
          return ['0x' + trimmed];
        } else if (trimmed.length === 66 && trimmed.startsWith('0x')) {
          return [trimmed];
        }
        return [];
      })(),
    },
    // Ethereum Sepolia (for testing Circle MSCA)
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      chainId: 11155111,
      accounts: process.env.PRIVATE_KEY && (process.env.PRIVATE_KEY.length === 66 || process.env.PRIVATE_KEY.length === 64)
        ? [process.env.PRIVATE_KEY.startsWith('0x') ? process.env.PRIVATE_KEY : '0x' + process.env.PRIVATE_KEY]
        : [],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

