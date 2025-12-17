/**
 * Deploy PaymentEscrow contract to Arc Testnet
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-payment-escrow.ts --network arc-testnet
 * 
 * Requires:
 *   - PRIVATE_KEY in .env.local (for deployment)
 *   - ARC_USDC_TESTNET_ADDRESS in .env.local (USDC token address on Arc Testnet)
 */

const hre = require("hardhat");

async function main() {
  const signers = await hre.ethers.getSigners();
  
  if (signers.length === 0) {
    console.error("❌ No accounts found. Please set PRIVATE_KEY in .env.local");
    process.exit(1);
  }
  
  const deployer = signers[0];
  console.log("🚀 Deploying PaymentEscrow...");
  console.log("   Account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const balanceFormatted = hre.ethers.formatEther(balance);
  console.log("   Balance:", balanceFormatted, "ETH");
  
  if (balance === 0n) {
    console.warn("⚠️  Warning: Account balance is 0. Deployment may fail if gas is required.");
    console.warn("   Get testnet tokens from faucet if needed.");
  }

  // Get USDC token address from env
  const usdcAddress = process.env.ARC_USDC_TESTNET_ADDRESS || process.env.NEXT_PUBLIC_ARC_USDC_TESTNET_ADDRESS;
  
  if (!usdcAddress) {
    console.error("❌ ARC_USDC_TESTNET_ADDRESS not found in .env.local");
    console.error("   Please set ARC_USDC_TESTNET_ADDRESS to the USDC token address on Arc Testnet");
    console.error("   Default Arc Testnet USDC: 0x3600000000000000000000000000000000000000");
    process.exit(1);
  }

  console.log("   USDC Token Address:", usdcAddress);
  console.log("\n📦 Deploying contract...");
  
  // Deploy PaymentEscrow
  const PaymentEscrow = await hre.ethers.getContractFactory("PaymentEscrow");
  const paymentEscrow = await PaymentEscrow.deploy(usdcAddress);

  console.log("   Waiting for deployment confirmation...");
  await paymentEscrow.waitForDeployment();

  const address = await paymentEscrow.getAddress();
  const network = await hre.ethers.provider.getNetwork();
  const networkName = network.name || `chain-${network.chainId}`;
  
  console.log("\n✅ Deployment Successful!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Network:", networkName, `(Chain ID: ${network.chainId})`);
  console.log("Escrow Contract Address:", address);
  console.log("USDC Token Address:", usdcAddress);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n📝 Add this to your .env.local file:");
  
  // Map chain IDs to environment variable names
  const envVarMap = {
    '1337': 'HARDHAT',
    '5042002': 'ARC_TESTNET',
    '11155111': 'SEPOLIA',
  };
  
  const envVarName = envVarMap[network.chainId.toString()] || networkName.toUpperCase().replace(/-/g, '_');
  console.log(`ESCROW_CONTRACT_ADDRESS_${envVarName}=${address}`);
  console.log(`ESCROW_USDC_ADDRESS_${envVarName}=${usdcAddress}`);
  console.log(`ESCROW_RPC_URL_${envVarName}=${process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network'}`);
  
  console.log("\n🔍 Verify on block explorer:");
  if (network.chainId === 5042002n) {
    console.log(`   https://testnet.arcscan.app/address/${address}`);
  } else if (network.chainId === 11155111n) {
    console.log(`   https://sepolia.etherscan.io/address/${address}`);
  } else {
    console.log(`   (Local network - no explorer)`);
  }
  
  console.log("\n✨ Next steps:");
  console.log("   1. Add the environment variables above");
  console.log("   2. Fund the escrow contract if needed (for refunds)");
  console.log("   3. Test deposit and claim flows");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });

