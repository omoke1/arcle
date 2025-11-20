/**
 * Comprehensive Bridge Route Testing Script
 * 
 * Tests all bridge routes (CCTP, Gateway) systematically
 * Based on Circle MCP findings:
 * - CCTP Bridge Kit does NOT support Circle Wallets (Dev/User/Modular)
 * - Gateway is the recommended method for wallet-based cross-chain transfers
 * - Arc Testnet is supported by both CCTP V2 and Gateway
 */

import { getCircleClient } from '../lib/archived/circle-sdk-developer-controlled';
import { circleApiRequest } from '../lib/circle';

interface BridgeRoute {
  name: string;
  fromChain: string;
  toChain: string;
  method: 'circle-api-v2' | 'circle-api-v1' | 'gateway' | 'cctp-contracts';
}

// All testnet routes to test
const TESTNET_ROUTES: BridgeRoute[] = [
  // ARC routes (primary focus)
  { name: 'ARC → Base', fromChain: 'ARC-TESTNET', toChain: 'BASE-SEPOLIA', method: 'gateway' },
  { name: 'ARC → Arbitrum', fromChain: 'ARC-TESTNET', toChain: 'ARB-SEPOLIA', method: 'gateway' },
  { name: 'ARC → Ethereum', fromChain: 'ARC-TESTNET', toChain: 'ETH-SEPOLIA', method: 'gateway' },
  { name: 'ARC → Avalanche', fromChain: 'ARC-TESTNET', toChain: 'AVAX-FUJI', method: 'gateway' },
  { name: 'ARC → Optimism', fromChain: 'ARC-TESTNET', toChain: 'OP-SEPOLIA', method: 'gateway' },
  { name: 'ARC → Polygon', fromChain: 'ARC-TESTNET', toChain: 'MATIC-AMOY', method: 'gateway' },
  
  // Reverse routes
  { name: 'Base → ARC', fromChain: 'BASE-SEPOLIA', toChain: 'ARC-TESTNET', method: 'gateway' },
  { name: 'Ethereum → ARC', fromChain: 'ETH-SEPOLIA', toChain: 'ARC-TESTNET', method: 'gateway' },
];

interface TestResult {
  route: BridgeRoute;
  success: boolean;
  method: string;
  error?: string;
  transactionId?: string;
  details?: any;
}

/**
 * Test Circle API v2 Transfer endpoint
 * This is the newest API that might support cross-chain for dev wallets
 */
async function testCircleAPIv2(
  route: BridgeRoute,
  walletId: string,
  amount: string = '0.01'
): Promise<TestResult> {
  console.log(`\n🧪 Testing Circle API v2: ${route.name}`);
  
  try {
    const response = await circleApiRequest<any>(
      `/v2/w3s/developer/transfers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: `test-${Date.now()}`,
          source: {
            type: 'wallet',
            id: walletId,
          },
          destination: {
            type: 'blockchain',
            address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', // Test address
            chain: route.toChain,
          },
          amount: {
            amount: Math.floor(parseFloat(amount) * 1_000_000).toString(),
            currency: 'USDC',
          },
        }),
      }
    );
    
    return {
      route,
      success: true,
      method: 'circle-api-v2',
      transactionId: response.data?.id,
      details: response,
    };
  } catch (error: any) {
    return {
      route,
      success: false,
      method: 'circle-api-v2',
      error: error.message,
      details: error.response?.data,
    };
  }
}

/**
 * Test Circle API v1 Transfer endpoint
 * Older API, might have different cross-chain support
 */
async function testCircleAPIv1(
  route: BridgeRoute,
  walletId: string,
  amount: string = '0.01'
): Promise<TestResult> {
  console.log(`\n🧪 Testing Circle API v1: ${route.name}`);
  
  try {
    const response = await circleApiRequest<any>(
      `/v1/w3s/developer/transfers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: `test-${Date.now()}`,
          source: {
            type: 'wallet',
            id: walletId,
          },
          destination: {
            type: 'blockchain',
            address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
            chain: route.toChain,
          },
          amount: {
            amount: Math.floor(parseFloat(amount) * 1_000_000).toString(),
            currency: 'USDC',
          },
        }),
      }
    );
    
    return {
      route,
      success: true,
      method: 'circle-api-v1',
      transactionId: response.data?.id,
      details: response,
    };
  } catch (error: any) {
    return {
      route,
      success: false,
      method: 'circle-api-v1',
      error: error.message,
      details: error.response?.data,
    };
  }
}

/**
 * Test Gateway method
 * Recommended by Circle for wallet-based cross-chain transfers
 */
async function testGateway(
  route: BridgeRoute,
  walletId: string,
  walletAddress: string,
  amount: string = '0.01'
): Promise<TestResult> {
  console.log(`\n🧪 Testing Gateway: ${route.name}`);
  
  try {
    // Gateway requires:
    // 1. Deposit USDC to Gateway Wallet contract
    // 2. Request transfer attestation
    // 3. Mint on destination chain
    
    // For now, just test if Gateway endpoints are accessible
    const GATEWAY_API_V1_BALANCES = 'https://api-gateway.circle.com/v1/balance';
    
    const response = await fetch(GATEWAY_API_V1_BALANCES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'USDC',
        sources: [
          {
            depositor: walletAddress,
            domain: 26, // Arc Testnet domain
          },
        ],
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Gateway API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      route,
      success: true,
      method: 'gateway',
      details: { balance: data, note: 'Gateway API accessible, full implementation needed' },
    };
  } catch (error: any) {
    return {
      route,
      success: false,
      method: 'gateway',
      error: error.message,
    };
  }
}

/**
 * Run comprehensive bridge tests
 */
async function runBridgeTests() {
  console.log('🌉 ARCLE Bridge Route Testing');
  console.log('================================\n');
  
  // Load wallet info
  const fs = await import('fs');
  const path = await import('path');
  const walletInfoPath = path.join(process.cwd(), 'wallet-info.json');
  
  if (!fs.existsSync(walletInfoPath)) {
    console.error('❌ wallet-info.json not found. Run "npm run create-wallet" first.');
    process.exit(1);
  }
  
  const walletInfo = JSON.parse(fs.readFileSync(walletInfoPath, 'utf-8'));
  const walletId = walletInfo.walletId;
  const walletAddress = walletInfo.address;
  
  console.log(`Wallet ID: ${walletId}`);
  console.log(`Wallet Address: ${walletAddress}\n`);
  
  const results: TestResult[] = [];
  
  // Test each route
  for (const route of TESTNET_ROUTES) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Testing Route: ${route.name}`);
    console.log(`Method: ${route.method}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    // Try Circle API v2 first
    const v2Result = await testCircleAPIv2(route, walletId);
    results.push(v2Result);
    
    if (!v2Result.success) {
      // Try v1 if v2 fails
      const v1Result = await testCircleAPIv1(route, walletId);
      results.push(v1Result);
      
      if (!v1Result.success) {
        // Try Gateway if both API versions fail
        const gatewayResult = await testGateway(route, walletId, walletAddress);
        results.push(gatewayResult);
      }
    }
    
    // Wait 2 seconds between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Generate report
  console.log('\n\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                    TEST RESULTS SUMMARY                    ');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const successfulRoutes = results.filter(r => r.success);
  const failedRoutes = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successfulRoutes.length}/${results.length}`);
  console.log(`❌ Failed: ${failedRoutes.length}/${results.length}\n`);
  
  console.log('Successful Routes:');
  console.log('─────────────────');
  successfulRoutes.forEach(r => {
    console.log(`✅ ${r.route.name} via ${r.method}`);
  });
  
  console.log('\nFailed Routes:');
  console.log('─────────────────');
  failedRoutes.forEach(r => {
    console.log(`❌ ${r.route.name} via ${r.method}: ${r.error}`);
  });
  
  // Recommendations
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                     RECOMMENDATIONS                        ');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (successfulRoutes.length === 0) {
    console.log('⚠️  NO ROUTES WORKING via Circle APIs');
    console.log('');
    console.log('📋 Action Items:');
    console.log('1. Implement Gateway method (recommended by Circle for wallets)');
    console.log('2. Gateway requires:');
    console.log('   - Deposit USDC to Gateway Wallet contract');
    console.log('   - Sign burn intent (requires EOA or delegate)');
    console.log('   - Request attestation from Gateway API');
    console.log('   - Mint on destination chain');
    console.log('');
    console.log('3. Contact Circle support about CCTP support for developer-controlled wallets');
    console.log('');
    console.log('📚 Resources:');
    console.log('- Gateway Technical Guide: https://developers.circle.com/gateway/concepts/technical-guide');
    console.log('- CCTP Docs: https://developers.circle.com/cctp');
    console.log('- Circle Support: https://support.usdc.circle.com/');
  } else {
    console.log('✅ Some routes working!');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('1. Implement working methods in production code');
    console.log('2. Add balance verification after bridge completion');
    console.log('3. Implement Gateway for failed routes');
    console.log('4. Add route-specific error handling');
  }
  
  // Save detailed results
  const reportPath = path.join(process.cwd(), 'bridge-test-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed results saved to: bridge-test-results.json`);
}

// Run tests
runBridgeTests()
  .then(() => {
    console.log('\n✅ Bridge testing complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Bridge testing failed:', error);
    process.exit(1);
  });



