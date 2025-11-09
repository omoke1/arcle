/**
 * Test SDK URL Configuration
 * 
 * This script tests what URL the SDK is actually using
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { getCircleClient, clearCircleClient } from '../lib/circle-sdk';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function testSDKUrl() {
  try {
    console.log('🧪 Testing SDK URL Configuration\n');
    
    // Clear any cached client
    clearCircleClient();
    
    console.log('Environment variables:');
    console.log(`  NEXT_PUBLIC_ENV: ${process.env.NEXT_PUBLIC_ENV || 'not set'}`);
    console.log(`  CIRCLE_ENV: ${process.env.CIRCLE_ENV || 'not set'}`);
    console.log('');
    
    // Get the client (this will initialize it and log the URL)
    console.log('Initializing SDK client...\n');
    const client = getCircleClient();
    
    // Try to get public key to see what URL is actually called
    console.log('Attempting to fetch entity public key...\n');
    try {
      const response = await client.getPublicKey();
      console.log('✅ Success! Public key fetched.');
      console.log('Response:', response.data);
    } catch (error: any) {
      console.error('❌ Failed to fetch public key');
      console.error('Error:', error.message);
      console.error('Error URL:', error.config?.url || error.request?.url || 'unknown');
      console.error('Error baseURL:', error.config?.baseURL || 'unknown');
      console.error('Full error:', JSON.stringify(error, null, 2));
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

testSDKUrl();

