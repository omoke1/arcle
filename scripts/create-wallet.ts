import { 
  initiateDeveloperControlledWalletsClient, 
  generateEntitySecret,
  registerEntitySecretCiphertext 
} from '@circle-fin/developer-controlled-wallets';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Check if we need to generate a new entity secret
if (!process.env.CIRCLE_ENTITY_SECRET) {
  console.log("No entity secret found in environment variables. Generating a new one...");
  console.log("Please save the generated secret in your .env file as CIRCLE_ENTITY_SECRET=<generated_value>");
  generateEntitySecret();
  process.exit(1);
}

async function main() {
  try {
    // Get API key from environment
    const apiKey = process.env.CIRCLE_API_KEY || process.env.NEXT_PUBLIC_CIRCLE_API_KEY || '';
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET || '';

    if (!apiKey) {
      throw new Error("CIRCLE_API_KEY or NEXT_PUBLIC_CIRCLE_API_KEY is required in environment variables");
    }

    if (!entitySecret) {
      throw new Error("CIRCLE_ENTITY_SECRET is required in environment variables");
    }

    // Step 1: Register Entity Secret FIRST (required before creating wallet sets)
    // Follows Circle SDK documentation: https://developers.circle.com/wallets/dev-controlled/register-entity-secret
    console.log("Registering Entity Secret with Circle...");
    
    // Determine baseUrl from API key prefix (TEST_API_KEY = sandbox, LIVE_API_KEY = production)
    const isSandbox = apiKey.startsWith('TEST_API_KEY:');
    const baseUrl = isSandbox ? 'https://api-sandbox.circle.com' : 'https://api.circle.com';
    console.log(`Using ${isSandbox ? 'SANDBOX' : 'PRODUCTION'} environment: ${baseUrl}`);
    
    // Set recovery file directory (SDK expects directory, will create file)
    const recoveryDir = process.cwd();
    
    try {
      // Register Entity Secret using Circle SDK
      // The SDK automatically handles encryption and saves recovery file
      const registrationResponse = await registerEntitySecretCiphertext({
        apiKey: apiKey,
        entitySecret: entitySecret,
        baseUrl: baseUrl,
        recoveryFileDownloadPath: recoveryDir, // SDK expects directory
      });
      
      if (registrationResponse.data?.recoveryFile) {
        // Recovery file is automatically saved by SDK
        const recoveryFilePath = path.join(recoveryDir, 'entity-secret-recovery.dat');
        console.log(`✅ Entity Secret registered successfully!`);
        console.log(`⚠️  Recovery file saved to: ${recoveryFilePath}`);
        console.log(`⚠️  IMPORTANT: Keep this recovery file secure - you'll need it for recovery!`);
      } else {
        console.log("✅ Entity Secret registration successful");
      }
    } catch (regError: any) {
      // Check if already registered
      if (regError?.response?.data?.code === 156016) {
        console.log("⚠️  Entity Secret registration returned error 156016");
        console.log("This might mean it needs to be registered differently or is already registered");
        console.log("Attempting to continue anyway...");
      } else if (regError?.message?.includes("already registered") || 
                 regError?.message?.includes("already exists")) {
        console.log("✅ Entity Secret already registered - continuing...");
      } else {
        // If registration fails, try to continue anyway - might work if already registered
        console.warn("⚠️  Entity Secret registration warning:", regError.message);
        console.log("Attempting to continue - Entity Secret may already be registered...");
        console.log("💡 Tip: Run 'npm run register-entity-secret' separately if needed");
      }
    }

    // Step 2: Initialize the client with API key and entity secret
    const client = initiateDeveloperControlledWalletsClient({
      apiKey: apiKey,
      entitySecret: entitySecret,
    });

    console.log("Creating wallet set...");
    
    // Create a wallet set to contain our wallets
    const walletSetResponse = await client.createWalletSet({
      name: 'ARCLE AI-Managed Wallet Set',
    });

    if (!walletSetResponse.data?.walletSet) {
      throw new Error("Failed to create wallet set");
    }

    const walletSetId = walletSetResponse.data.walletSet.id;
    console.log(`Wallet set created with ID: ${walletSetId}`);

    // Create a Smart Contract Account (SCA) wallet on Arc testnet
    // SCA provides the abstraction layer needed for AI management
    console.log("Creating wallet on ARC-TESTNET...");
    
    const walletResponse = await client.createWallets({
      blockchains: ["ARC-TESTNET"],
      count: 1,
      accountType: "SCA", // Smart Contract Account for programmability
      walletSetId: walletSetId,
      metadata: [
        {
          name: "ARCLE AI-Managed Wallet",
          refId: "arcle-ai-wallet-001"
        }
      ]
    });

    if (!walletResponse.data?.wallets || walletResponse.data.wallets.length === 0) {
      throw new Error("Failed to create wallet");
    }

    const wallet = walletResponse.data.wallets[0];
    console.log("Wallet created successfully:");
    console.log(`- Wallet ID: ${wallet?.id}`);
    console.log(`- Blockchain: ${wallet?.blockchain}`);
    console.log(`- Address: ${wallet?.address}`);
    console.log(`- Account Type: ${wallet?.custodyType}`);

    // Request testnet tokens for the new wallet
    console.log("Requesting testnet tokens...");
    if (wallet?.address) {
      await client.requestTestnetTokens({
        address: wallet.address,
        blockchain: "ARC-TESTNET",
        native: true,
        usdc: true
      });
      console.log("Testnet tokens requested successfully");
    }

    // Save wallet information to a file for future reference
    const walletInfo = {
      walletSetId: walletSetId,
      walletId: wallet.id,
      address: wallet.address,
      blockchain: wallet.blockchain,
      createdAt: wallet.createDate,
      accountType: wallet.custodyType
    };

    const outputPath = path.join(process.cwd(), 'wallet-info.json');
    fs.writeFileSync(outputPath, JSON.stringify(walletInfo, null, 2));
    console.log(`Wallet information saved to ${outputPath}`);

    console.log("\n✅ Setup complete! Your AI-managed wallet is ready to use.");
    console.log("This wallet can now be programmatically controlled by your AI application.");
    console.log("\nNext steps:");
    console.log("1. Update your .env file with the wallet details");
    console.log("2. Use the wallet ID in your API routes");

  } catch (error: any) {
    console.error("Error setting up wallet:", error.message || error);
    if (error.response) {
      console.error("API Response:", error.response.data);
    }
    process.exit(1);
  }
}

main();

