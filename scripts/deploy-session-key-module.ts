/**
 * Deploy SessionKeyModule to target networks
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-session-key-module.ts --network arc-testnet
 *   npx hardhat run scripts/deploy-session-key-module.ts --network sepolia
 *   npx hardhat run scripts/deploy-session-key-module.ts --network hardhat (local testing)
 */

const hre = require("hardhat");

async function main() {
  const signers = await hre.ethers.getSigners();
  
  if (signers.length === 0) {
    console.error("❌ No accounts found. Please set PRIVATE_KEY in .env.local");
    console.error("   For local testing, use: --network hardhat");
    process.exit(1);
  }
  
  const deployer = signers[0];
  console.log("🚀 Deploying SessionKeyModule...");
  console.log("   Account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const balanceFormatted = hre.ethers.formatEther(balance);
  console.log("   Balance:", balanceFormatted, "ETH");
  
  if (balance === 0n) {
    console.warn("⚠️  Warning: Account balance is 0. Deployment may fail if gas is required.");
    console.warn("   Get testnet tokens from faucet if needed.");
  }

  console.log("\n📦 Deploying contract...");
  
  // Deploy SessionKeyModule
  // Note: In production, the owner should be the Circle MSCA wallet address
  // For now, we'll use the deployer address as a placeholder
  const SessionKeyModule = await hre.ethers.getContractFactory("SessionKeyModule");
  const sessionKeyModule = await SessionKeyModule.deploy(deployer.address);

  console.log("   Waiting for deployment confirmation...");
  await sessionKeyModule.waitForDeployment();

  const address = await sessionKeyModule.getAddress();
  const network = await hre.ethers.provider.getNetwork();
  const networkName = network.name || `chain-${network.chainId}`;
  
  console.log("\n✅ Deployment Successful!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Network:", networkName, `(Chain ID: ${network.chainId})`);
  console.log("Module Address:", address);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n📝 Add this to your .env.local file:");
  
  // Map chain IDs to environment variable names
  const envVarMap = {
    '1337': 'HARDHAT',
    '5042002': 'ARC_TESTNET',
    '11155111': 'SEPOLIA',
  };
  
  const envVarName = envVarMap[network.chainId.toString()] || networkName.toUpperCase().replace(/-/g, '_');
  console.log(`SESSION_KEY_MODULE_${envVarName}=${address}`);
  
  console.log("\n🔍 Verify on block explorer:");
  if (network.chainId === 5042002n) {
    console.log(`   https://testnet.arcscan.app/address/${address}`);
  } else if (network.chainId === 11155111n) {
    console.log(`   https://sepolia.etherscan.io/address/${address}`);
  } else {
    console.log(`   (Local network - no explorer)`);
  }
  
  console.log("\n✨ Next steps:");
  console.log("   1. Add the environment variable above");
  console.log("   2. Install module on Circle MSCA wallets");
  console.log("   3. Create session keys via API");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
