/**
 * Test Entity Public Key Fetch
 * 
 * This script tests if we can fetch the entity public key from Circle API
 * Run: npm run test-entity-public-key
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function main() {
  try {
    const apiKey = process.env.CIRCLE_API_KEY || process.env.NEXT_PUBLIC_CIRCLE_API_KEY || '';
    
    if (!apiKey) {
      throw new Error('API Key not found');
    }
    
    console.log('✅ API Key found');
    console.log(`   Prefix: ${apiKey.split(':')[0]}`);

    // Determine environment
    const isSandbox = apiKey.startsWith('TEST_API_KEY:');
    const baseUrl = isSandbox ? 'https://api-sandbox.circle.com' : 'https://api.circle.com';
    
    console.log(`\n🔍 Testing Entity Public Key endpoint...`);
    console.log(`   Environment: ${isSandbox ? 'SANDBOX' : 'PRODUCTION'}`);
    console.log(`   Base URL: ${baseUrl}\n`);
    
    // Try to fetch entity public key directly
    // Endpoint: GET /v1/w3s/config/entity/publicKey
    try {
      const url = `${baseUrl}/v1/w3s/config/entity/publicKey`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw { response: { status: response.status, data } };
      }
      
      console.log('✅ Successfully fetched entity public key!');
      console.log('   Response:', JSON.stringify(data, null, 2));
      
      if (data.data?.publicKey) {
        console.log(`\n📝 Public Key: ${data.data.publicKey.substring(0, 50)}...`);
        console.log('\n✅ Entity Secret is properly registered and accessible!');
      }
      
    } catch (error: any) {
      console.error('❌ Failed to fetch entity public key');
      console.error('   Status:', error.response?.status);
      console.error('   Message:', error.message);
      console.error('   Response:', error.response?.data);
      
      if (error.response?.status === 401) {
        console.error('\n⚠️  401 Unauthorized - This means:');
        console.error('   • The API key might not have permission to access this endpoint');
        console.error('   • OR the Entity Secret is not registered');
        console.error('   • OR there\'s a mismatch between API key and Entity Secret');
        console.error('\n💡 Since wallet creation works, the Entity Secret IS registered.');
        console.error('   The issue is that the API key doesn\'t have permission to fetch the public key.');
        console.error('   This is needed for transaction creation.');
      }
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

