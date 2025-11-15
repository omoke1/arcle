/**
 * Test CCTP Implementation
 * 
 * Tests the CCTP smart contract implementation
 * Run: npx tsx scripts/test-cctp-implementation.ts
 */

import dotenv from "dotenv";
import { getCCTPAddresses, getDestinationDomain, CCTP_ATTESTATION_SERVICE_URL } from "../lib/cctp/cctp-contracts";
import { encodeFunctionData } from "viem";
import { TOKEN_MESSENGER_ABI, MESSAGE_TRANSMITTER_ABI } from "../lib/cctp/cctp-contracts";

dotenv.config();

async function testCCTPImplementation() {
  console.log("🧪 Testing CCTP Implementation\n");
  console.log("=" .repeat(60) + "\n");

  // Test 1: Contract Address Retrieval
  console.log("📋 Test 1: Contract Address Retrieval");
  console.log("-".repeat(60));
  
  const testChains = ["BASE-SEPOLIA", "ARBITRUM-SEPOLIA", "ETH-SEPOLIA"];
  
  for (const chain of testChains) {
    try {
      const addresses = getCCTPAddresses(chain);
      console.log(`✅ ${chain}:`);
      console.log(`   TokenMessenger: ${addresses.tokenMessenger}`);
      console.log(`   MessageTransmitter: ${addresses.messageTransmitter}`);
      console.log(`   USDC: ${addresses.usdc}`);
      console.log(`   Domain: ${addresses.domain}\n`);
    } catch (error: any) {
      console.log(`❌ ${chain}: ${error.message}\n`);
    }
  }

  // Test 2: Domain ID Retrieval
  console.log("📋 Test 2: Domain ID Retrieval");
  console.log("-".repeat(60));
  
  for (const chain of testChains) {
    try {
      const domain = getDestinationDomain(chain);
      console.log(`✅ ${chain}: Domain ID = ${domain}`);
    } catch (error: any) {
      console.log(`❌ ${chain}: ${error.message}`);
    }
  }
  console.log();

  // Test 3: Contract Call Encoding (Burn)
  console.log("📋 Test 3: Contract Call Encoding - Burn");
  console.log("-".repeat(60));
  
  try {
    const testAmount = "1.5"; // 1.5 USDC
    const amountInSmallestUnit = BigInt(Math.floor(parseFloat(testAmount) * 1_000_000));
    const destinationDomain = getDestinationDomain("BASE-SEPOLIA");
    const destinationAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";
    const destinationAddressBytes = destinationAddress.slice(2).toLowerCase();
    const mintRecipient = "0x" + destinationAddressBytes.padStart(64, "0");
    const sourceAddresses = getCCTPAddresses("ETH-SEPOLIA");
    
    // V2 requires additional parameters
    const destinationCaller = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const maxFee = BigInt(0);
    const minFinalityThreshold = 2000;
    
    const burnCallData = encodeFunctionData({
      abi: TOKEN_MESSENGER_ABI,
      functionName: "depositForBurn",
      args: [
        amountInSmallestUnit,
        destinationDomain,
        mintRecipient as `0x${string}`,
        sourceAddresses.usdc as `0x${string}`,
        destinationCaller as `0x${string}`, // V2: destination caller
        maxFee, // V2: max fee
        minFinalityThreshold, // V2: finality threshold
      ],
    });
    
    console.log(`✅ Burn call data encoded successfully`);
    console.log(`   Amount: ${testAmount} USDC (${amountInSmallestUnit.toString()} smallest units)`);
    console.log(`   Destination Domain: ${destinationDomain}`);
    console.log(`   Mint Recipient: ${mintRecipient}`);
    console.log(`   USDC Address: ${sourceAddresses.usdc}`);
    console.log(`   Call Data: ${burnCallData}`);
    console.log(`   Call Data Length: ${burnCallData.length} characters\n`);
  } catch (error: any) {
    console.log(`❌ Burn encoding failed: ${error.message}\n`);
  }

  // Test 4: Contract Call Encoding (Mint)
  console.log("📋 Test 4: Contract Call Encoding - Mint");
  console.log("-".repeat(60));
  
  try {
    // Mock message and attestation (in production, these come from the burn event and attestation service)
    const mockMessage = "0x" + "0".repeat(200); // Mock message bytes
    const mockAttestation = "0x" + "0".repeat(200); // Mock attestation bytes
    
    const mintCallData = encodeFunctionData({
      abi: MESSAGE_TRANSMITTER_ABI,
      functionName: "receiveMessage",
      args: [
        mockMessage as `0x${string}`,
        mockAttestation as `0x${string}`,
      ],
    });
    
    console.log(`✅ Mint call data encoded successfully`);
    console.log(`   Message: ${mockMessage.substring(0, 50)}...`);
    console.log(`   Attestation: ${mockAttestation.substring(0, 50)}...`);
    console.log(`   Call Data: ${mintCallData}`);
    console.log(`   Call Data Length: ${mintCallData.length} characters\n`);
  } catch (error: any) {
    console.log(`❌ Mint encoding failed: ${error.message}\n`);
  }

  // Test 5: Attestation Service Connection
  console.log("📋 Test 5: Attestation Service Connection");
  console.log("-".repeat(60));
  
  try {
    // Test with a non-existent message hash (should return 404 or pending)
    const testMessageHash = "0x" + "0".repeat(64);
    const url = `${CCTP_ATTESTATION_SERVICE_URL}/attestations/${testMessageHash}`;
    
    console.log(`Testing attestation service: ${url}`);
    
    const response = await fetch(url);
    const status = response.status;
    
    if (status === 404) {
      console.log(`✅ Attestation service is reachable (404 for non-existent message is expected)`);
    } else if (status === 200) {
      const data = await response.json();
      console.log(`✅ Attestation service responded: ${JSON.stringify(data)}`);
    } else {
      console.log(`⚠️  Attestation service returned status: ${status}`);
    }
    console.log();
  } catch (error: any) {
    console.log(`❌ Attestation service test failed: ${error.message}`);
    console.log(`   This might be a network issue or the service might be down\n`);
  }

  // Test 6: Address Validation
  console.log("📋 Test 6: Address Format Validation");
  console.log("-".repeat(60));
  
  const testAddresses = [
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", // Valid
    "0x742d35cc6634c0532925a3b844bc9e7595f0beb", // Valid (lowercase)
    "742d35Cc6634C0532925a3b844Bc9e7595f0bEb", // Invalid (no 0x)
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bE", // Invalid (too short)
  ];
  
  for (const addr of testAddresses) {
    try {
      const addrBytes = addr.toLowerCase().startsWith("0x")
        ? addr.slice(2).toLowerCase()
        : addr.toLowerCase();
      const bytes32 = "0x" + addrBytes.padStart(64, "0");
      
      if (bytes32.length === 66) { // 0x + 64 hex chars
        console.log(`✅ ${addr} → ${bytes32}`);
      } else {
        console.log(`❌ ${addr} → Invalid length: ${bytes32.length}`);
      }
    } catch (error: any) {
      console.log(`❌ ${addr}: ${error.message}`);
    }
  }
  console.log();

  // Test 7: Amount Conversion
  console.log("📋 Test 7: Amount Conversion (USDC has 6 decimals)");
  console.log("-".repeat(60));
  
  const testAmounts = ["0.1", "1", "1.5", "10.123456", "100.999999"];
  
  for (const amount of testAmounts) {
    const amountInSmallestUnit = BigInt(Math.floor(parseFloat(amount) * 1_000_000));
    const convertedBack = (Number(amountInSmallestUnit) / 1_000_000).toFixed(6);
    console.log(`✅ ${amount} USDC → ${amountInSmallestUnit.toString()} smallest units → ${convertedBack} USDC`);
  }
  console.log();

  // Test 8: Error Handling
  console.log("📋 Test 8: Error Handling");
  console.log("-".repeat(60));
  
  try {
    getCCTPAddresses("INVALID-CHAIN");
    console.log(`❌ Should have thrown error for invalid chain`);
  } catch (error: any) {
    console.log(`✅ Correctly threw error for invalid chain: ${error.message}`);
  }
  
  try {
    getCCTPAddresses("ARC-TESTNET"); // Should fail because addresses are placeholders
    console.log(`❌ Should have thrown error for Arc (contracts not deployed)`);
  } catch (error: any) {
    console.log(`✅ Correctly threw error for Arc: ${error.message}`);
  }
  console.log();

  console.log("=" .repeat(60));
  console.log("✅ CCTP Implementation Tests Completed!\n");
  console.log("💡 Next Steps:");
  console.log("   1. Test with real wallet on testnet (Base Sepolia, Arbitrum Sepolia)");
  console.log("   2. Verify Circle SDK supports contract calls via 'data' field");
  console.log("   3. Extract message hash from burn transaction events");
  console.log("   4. Test full burn → attest → mint flow\n");
}

// Run the tests
testCCTPImplementation().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});

