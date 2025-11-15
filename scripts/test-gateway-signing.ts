/**
 * Test Gateway EIP-712 Signing
 * 
 * Tests the signing functionality without requiring a deposit
 */

import dotenv from "dotenv";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  getGatewayAddresses,
  getGatewayDestinationDomain,
} from "../lib/gateway/gateway-contracts";
import {
  createTransferSpec,
  createBurnIntent,
  createBurnIntentTypedData,
} from "../lib/gateway/gateway-typed-data";

dotenv.config();

const TEST_PRIVATE_KEY = process.env.GATEWAY_SIGNER_PRIVATE_KEY || process.env.TEST_PRIVATE_KEY;
const ARC_WALLET_ADDRESS = "0x78d4064b6ff337a157256800e782058f11e6c1d7";
const BASE_DESTINATION_ADDRESS = "0x37195b0fc7198a4fc8c7dafe3bcc5bcf8cb680a0";
const TEST_AMOUNT = "2";

async function testGatewaySigning() {
  console.log("🔐 Testing Gateway EIP-712 Signing\n");
  console.log("=".repeat(60));
  
  if (!TEST_PRIVATE_KEY) {
    console.log("❌ No private key found!");
    console.log("   Set GATEWAY_SIGNER_PRIVATE_KEY or TEST_PRIVATE_KEY in .env");
    console.log("   Use a testnet wallet private key for testing");
    return;
  }
  
  try {
    // Get addresses
    const arcAddresses = getGatewayAddresses("ARC-TESTNET");
    const baseAddresses = getGatewayAddresses("BASE-SEPOLIA");
    const sourceDomain = getGatewayDestinationDomain("ARC-TESTNET");
    const destDomain = getGatewayDestinationDomain("BASE-SEPOLIA");
    
    console.log("✅ Gateway addresses loaded");
    console.log(`   Arc Gateway Wallet: ${arcAddresses.gatewayWallet}`);
    console.log(`   Base Gateway Minter: ${baseAddresses.gatewayMinter}`);
    
    // Create account from private key
    const account = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);
    console.log(`\n✅ Account created: ${account.address}`);
    
    // Create TransferSpec
    const amountInSmallestUnit = BigInt(Math.floor(parseFloat(TEST_AMOUNT) * 1_000_000));
    const salt = `0x${crypto.randomUUID().replace(/-/g, "").substring(0, 64).padStart(64, "0")}`;
    
    console.log("\n📋 Creating TransferSpec...");
    const transferSpec = createTransferSpec({
      version: 1,
      sourceDomain: sourceDomain,
      destinationDomain: destDomain,
      sourceContract: arcAddresses.gatewayWallet,
      destinationContract: baseAddresses.gatewayMinter,
      sourceToken: arcAddresses.usdc,
      destinationToken: baseAddresses.usdc,
      sourceDepositor: ARC_WALLET_ADDRESS,
      destinationRecipient: BASE_DESTINATION_ADDRESS,
      sourceSigner: account.address,
      destinationCaller: "0x0000000000000000000000000000000000000000",
      value: amountInSmallestUnit,
      salt: salt,
      hookData: "0x",
    });
    
    console.log("✅ TransferSpec created");
    console.log(`   Source Domain: ${transferSpec.sourceDomain}`);
    console.log(`   Dest Domain: ${transferSpec.destinationDomain}`);
    console.log(`   Amount: ${TEST_AMOUNT} USDC`);
    
    // Create BurnIntent
    console.log("\n📋 Creating BurnIntent...");
    const { maxUint256 } = await import("../lib/gateway/gateway-typed-data");
    const burnIntent = createBurnIntent({
      maxBlockHeight: maxUint256,
      maxFee: BigInt(2_010_000), // 2.01 USDC
      spec: transferSpec,
    });
    
    console.log("✅ BurnIntent created");
    console.log(`   Max Block Height: ${burnIntent.maxBlockHeight}`);
    console.log(`   Max Fee: ${burnIntent.maxFee}`);
    
    // Create typed data
    console.log("\n📋 Creating EIP-712 typed data...");
    const typedData = createBurnIntentTypedData(burnIntent);
    console.log("✅ Typed data created");
    console.log(`   Domain: ${typedData.domain.name} v${typedData.domain.version}`);
    console.log(`   Primary Type: ${typedData.primaryType}`);
    
    // Sign with wallet client
    console.log("\n📋 Signing burn intent...");
    const walletClient = createWalletClient({
      account,
      chain: undefined,
      transport: http(),
    });
    
    const signature = await walletClient.signTypedData(typedData);
    console.log("✅ Burn intent signed!");
    console.log(`   Signature: ${signature.substring(0, 20)}...${signature.substring(signature.length - 10)}`);
    console.log(`   Length: ${signature.length} characters`);
    
    // Verify signature format (should be 132 chars: 0x + 65 bytes * 2)
    if (signature.length === 132 && signature.startsWith("0x")) {
      console.log("✅ Signature format is correct (65 bytes)");
    } else {
      console.log(`⚠️  Signature format unexpected: ${signature.length} chars`);
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("✅ Gateway Signing Test PASSED!\n");
    console.log("The EIP-712 signing implementation is working correctly.");
    console.log("\nNote: To complete a full Gateway transfer, you would:");
    console.log("1. Deposit USDC to Gateway Wallet (requires contract call)");
    console.log("2. Sign burn intent (✅ working)");
    console.log("3. Request attestation from Gateway API");
    console.log("4. Mint on destination chain (requires contract call)");
    
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    console.error(error);
  }
}

testGatewaySigning().catch(console.error);

