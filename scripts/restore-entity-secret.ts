/**
 * Restore Original Entity Secret
 * 
 * Restores the Entity Secret that was used to create the wallet
 * Run: npm run restore-entity-secret
 */

import * as path from 'path';
import * as fs from 'fs';

// The original Entity Secret that was used to create the wallet
const ORIGINAL_ENTITY_SECRET = 'c3b11ac22fbb6021c86e0b1a3ecc91ed1907b66ddd2eecae3919549985abd50a';

async function main() {
  try {
    console.log('🔄 Restoring original Entity Secret...\n');

    const envPath = path.join(process.cwd(), '.env');
    
    if (!fs.existsSync(envPath)) {
      throw new Error('.env file not found');
    }

    let envContent = fs.readFileSync(envPath, 'utf-8');

    // Remove any existing CIRCLE_ENTITY_SECRET
    envContent = envContent.replace(/CIRCLE_ENTITY_SECRET=.*/g, '');
    
    // Add original Entity Secret
    if (!envContent.endsWith('\n') && envContent.length > 0) {
      envContent += '\n';
    }
    envContent += `CIRCLE_ENTITY_SECRET=${ORIGINAL_ENTITY_SECRET}\n`;

    // Write updated .env file
    fs.writeFileSync(envPath, envContent, 'utf-8');
    
    console.log(`✅ Restored original Entity Secret to .env file`);
    console.log(`\n⚠️  IMPORTANT:`);
    console.log(`   • Restart your development server to load the restored Entity Secret`);
    console.log(`   • This Entity Secret was used to create your wallet`);
    console.log(`   • If transactions still fail, the Entity Secret may need to be re-registered\n`);

  } catch (error: any) {
    console.error(`\n❌ Error restoring Entity Secret:`);
    console.error(`   ${error.message || error}`);
    process.exit(1);
  }
}

main();




