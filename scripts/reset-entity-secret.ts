/**
 * Reset Entity Secret - Generate New and Register
 * 
 * This script will:
 * 1. Generate a new Entity Secret
 * 2. Register it with Circle
 * 3. Save it to .env file
 * 
 * Run: npm run reset-entity-secret
 */

import { generateEntitySecret, registerEntitySecretCiphertext } from '@circle-fin/developer-controlled-wallets';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function main() {
  try {
    console.log('🔄 Resetting Entity Secret...\n');

    // Step 1: Get API Key
    const apiKey = process.env.CIRCLE_API_KEY || process.env.NEXT_PUBLIC_CIRCLE_API_KEY || '';
    
    if (!apiKey) {
      throw new Error("CIRCLE_API_KEY or NEXT_PUBLIC_CIRCLE_API_KEY is required in environment variables");
    }

    console.log(`✅ API Key found: ${apiKey.substring(0, 20)}...`);
    
    // Step 2: Generate new Entity Secret
    console.log('\n📝 Generating new Entity Secret...');
    const entitySecret = crypto.randomBytes(32).toString('hex');
    console.log(`✅ Generated Entity Secret: ${entitySecret.substring(0, 20)}...`);
    console.log(`   Full secret: ${entitySecret}\n`);

    // Step 3: Determine environment
    const isSandbox = apiKey.startsWith('TEST_API_KEY:');
    const baseUrl = isSandbox ? 'https://api-sandbox.circle.com' : 'https://api.circle.com';
    
    console.log(`🔐 Registering new Entity Secret with Circle...`);
    console.log(`📡 Environment: ${isSandbox ? 'SANDBOX' : 'PRODUCTION'}`);
    console.log(`🌐 Base URL: ${baseUrl}\n`);

    // Step 4: Register Entity Secret
    const recoveryDir = process.cwd();
    
    try {
      const response = await registerEntitySecretCiphertext({
        apiKey: apiKey,
        entitySecret: entitySecret,
        baseUrl: baseUrl,
        recoveryFileDownloadPath: recoveryDir,
      });

      console.log(`✅ Entity Secret registered successfully!`);
      
      if (response.data?.recoveryFile) {
        const recoveryFilePath = path.join(recoveryDir, 'entity-secret-recovery.dat');
        console.log(`📁 Recovery file saved to: ${recoveryFilePath}`);
      }

      // Step 5: Update .env file
      const envPath = path.join(process.cwd(), '.env');
      let envContent = '';
      
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
      }

      // Remove old CIRCLE_ENTITY_SECRET if exists
      envContent = envContent.replace(/CIRCLE_ENTITY_SECRET=.*/g, '');
      
      // Add new Entity Secret
      if (!envContent.endsWith('\n') && envContent.length > 0) {
        envContent += '\n';
      }
      envContent += `CIRCLE_ENTITY_SECRET=${entitySecret}\n`;

      // Write updated .env file
      fs.writeFileSync(envPath, envContent, 'utf-8');
      console.log(`\n✅ Updated .env file with new Entity Secret`);

      console.log(`\n⚠️  IMPORTANT SECURITY NOTES:`);
      console.log(`   • Your new Entity Secret is saved in .env file`);
      console.log(`   • Store your Entity Secret securely (e.g., password manager)`);
      console.log(`   • Save the recovery file in a safe, separate location`);
      console.log(`   • Circle does NOT store your Entity Secret - you are responsible for it`);
      console.log(`   • If you lose both, you will lose access to your wallets permanently\n`);

      console.log(`\n✅ Reset complete! Your new Entity Secret is registered and saved.`);
      console.log(`\nNext steps:`);
      console.log(`   1. Restart your development server to load the new Entity Secret`);
      console.log(`   2. Try creating a transaction again\n`);

    } catch (regError: any) {
      console.error(`\n❌ Error registering Entity Secret:`);
      
      if (regError?.response?.status === 401) {
        console.error(`   Error 401: Invalid credentials.`);
        console.error(`   This might mean:`);
        console.error(`   • The API key is invalid or expired`);
        console.error(`   • The API key doesn't have permission to register Entity Secrets`);
        console.error(`   • The API key is from a different Circle account\n`);
      } else {
        console.error(`   ${regError.message || regError}`);
        if (regError.response?.data) {
          console.error(`   API Response:`, JSON.stringify(regError.response.data, null, 2));
        }
      }
      
      // Still save the Entity Secret to .env even if registration fails
      // User can try registering manually later
      const envPath = path.join(process.cwd(), '.env');
      let envContent = '';
      
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
      }

      envContent = envContent.replace(/CIRCLE_ENTITY_SECRET=.*/g, '');
      
      if (!envContent.endsWith('\n') && envContent.length > 0) {
        envContent += '\n';
      }
      envContent += `CIRCLE_ENTITY_SECRET=${entitySecret}\n`;

      fs.writeFileSync(envPath, envContent, 'utf-8');
      console.log(`\n⚠️  Entity Secret saved to .env file, but registration failed.`);
      console.log(`   You may need to register it manually or check your API key permissions.\n`);
      
      throw regError;
    }

  } catch (error: any) {
    console.error(`\n❌ Error resetting Entity Secret:`);
    console.error(`   ${error.message || error}`);
    process.exit(1);
  }
}

main();




