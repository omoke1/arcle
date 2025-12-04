require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: ".env.local" });

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
      accounts: process.env.PRIVATE_KEY && (process.env.PRIVATE_KEY.length === 66 || process.env.PRIVATE_KEY.length === 64)
        ? [process.env.PRIVATE_KEY.startsWith('0x') ? process.env.PRIVATE_KEY : '0x' + process.env.PRIVATE_KEY]
        : [],
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

