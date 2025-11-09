/**
 * Register Entity Secret with Circle
 * 
 * Follows official Circle SDK documentation:
 * https://developers.circle.com/wallets/dev-controlled/register-entity-secret
 * 
 * Run: npm run register-entity-secret
 */

import { registerEntitySecretCiphertext } from '@circle-fin/developer-controlled-wallets';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function main() {
  try {
    // Use server-side key first, fallback to public key
    const apiKey = process.env.CIRCLE_API_KEY || process.env.NEXT_PUBLIC_CIRCLE_API_KEY || '';
    
    console.log(`API Key found: ${apiKey ? 'Yes' : 'No'}`);
    console.log(`API Key prefix: ${apiKey.split(':')[0] || 'N/A'}`);
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET || '';

    if (!apiKey) {
      throw new Error("CIRCLE_API_KEY or NEXT_PUBLIC_CIRCLE_API_KEY is required in environment variables");
    }

    if (!entitySecret) {
      throw new Error("CIRCLE_ENTITY_SECRET is required in environment variables.\n\nRun 'npm run generate-entity-secret' first to generate one.");
    }

    // Determine environment from API key
    const isSandbox = apiKey.startsWith('TEST_API_KEY:');
    const baseUrl = isSandbox ? 'https://api-sandbox.circle.com' : 'https://api.circle.com';
    
    console.log(`\n🔐 Registering Entity Secret with Circle...`);
    console.log(`📡 Environment: ${isSandbox ? 'SANDBOX' : 'PRODUCTION'}`);
    console.log(`🌐 Base URL: ${baseUrl}\n`);

    // Set recovery file directory (SDK expects directory, not file path)
    const recoveryDir = process.cwd();
    
    // Register Entity Secret using Circle SDK
    // The SDK automatically handles encryption and creates the recovery file
    const response = await registerEntitySecretCiphertext({
      apiKey: apiKey,
      entitySecret: entitySecret,
      baseUrl: baseUrl,
      recoveryFileDownloadPath: recoveryDir, // SDK expects directory, will create file
    });

    if (response.data?.recoveryFile) {
      // Recovery file is automatically saved by SDK
      const recoveryFilePath = path.join(recoveryDir, 'entity-secret-recovery.dat');
      console.log(`✅ Entity Secret registered successfully!`);
      console.log(`\n📁 Recovery file saved to: ${recoveryFilePath}`);
      console.log(`\n⚠️  IMPORTANT SECURITY NOTES:`);
      console.log(`   • Store your Entity Secret securely (e.g., password manager)`);
      console.log(`   • Save the recovery file in a safe, separate location`);
      console.log(`   • Circle does NOT store your Entity Secret - you are responsible for it`);
      console.log(`   • If you lose both, you will lose access to your wallets permanently\n`);
    } else {
      console.log(`✅ Entity Secret registration successful`);
    }

    console.log(`\n✅ Registration complete! You can now create developer-controlled wallets.`);
    console.log(`\nNext steps:`);
    console.log(`   1. Keep the recovery file safe`);
    console.log(`   2. Run 'npm run create-wallet' to create your first wallet\n`);

  } catch (error: any) {
    console.error(`\n❌ Error registering Entity Secret:`);
    
    // Handle specific error cases
    if (error?.response?.data?.code === 156016) {
      console.error(`   Error 156016: Entity Secret may already be registered or needs different handling.`);
      console.error(`   Check Circle Console: https://console.circle.com/`);
    } else if (error?.response?.status === 401) {
      console.error(`   Error 401: Invalid credentials.`);
      console.error(`   This might mean:`);
      console.error(`   • The Entity Secret is already registered (try creating a wallet to verify)`);
      console.error(`   • The API key doesn't have registration permissions`);
      console.error(`   • The API key is invalid or expired`);
      console.error(`   \n💡 Try running 'npm run create-wallet' - if it works, Entity Secret is already registered.`);
    } else if (error?.message?.includes("already registered") || 
               error?.message?.includes("already exists")) {
      console.log(`   ✅ Entity Secret appears to already be registered`);
      console.log(`   You can proceed with wallet creation.`);
    } else {
      console.error(`   ${error.message || error}`);
      if (error.response?.data) {
        console.error(`   API Response:`, JSON.stringify(error.response.data, null, 2));
      }
    }
    
    process.exit(1);
  }
}

main();

