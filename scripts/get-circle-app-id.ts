/**
 * Get Circle App ID from Circle API
 * 
 * This script fetches the correct App ID that matches your API key
 * Run: npx tsx scripts/get-circle-app-id.ts
 */

import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function getCircleAppId() {
  console.log("\n🔍 Fetching Circle App ID from API...\n");

  const apiKey = process.env.CIRCLE_API_KEY;
  
  if (!apiKey) {
    console.error("❌ CIRCLE_API_KEY not found in .env.local");
    console.log("\n💡 Make sure you have CIRCLE_API_KEY set in .env.local");
    process.exit(1);
  }

  const apiKeyType = apiKey.startsWith("TEST_API_KEY") ? "TESTNET" : "PRODUCTION";
  console.log(`✅ API Key found: ${apiKeyType}`);
  console.log(`   Key: ${apiKey.substring(0, 20)}...\n`);

  try {
    // Fetch entity config to get App ID
    // Endpoint: GET /v1/w3s/config/entity
    console.log("📡 Calling Circle API: GET /v1/w3s/config/entity\n");
    
    const url = "https://api.circle.com/v1/w3s/config/entity";
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "accept": "application/json",
        "authorization": `Bearer ${apiKey}`,
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const responseData = await response.json() as { data: { appId: string } };

    if (responseData.data?.appId) {
      const appId = responseData.data.appId;
      
      console.log("✅ App ID retrieved successfully!\n");
      console.log("═══════════════════════════════════════════════════════════");
      console.log(`📱 Your Circle App ID: ${appId}`);
      console.log("═══════════════════════════════════════════════════════════\n");
      
      console.log("📝 Add this to your .env.local file:\n");
      console.log(`NEXT_PUBLIC_CIRCLE_APP_ID=${appId}\n`);
      
      console.log("💡 Or update your existing .env.local file with:");
      console.log(`   NEXT_PUBLIC_CIRCLE_APP_ID=${appId}\n`);
      
      return appId;
    } else {
      console.error("❌ App ID not found in response");
      console.log("Response:", JSON.stringify(responseData, null, 2));
      return null;
    }
  } catch (error: any) {
    console.error("\n❌ Error fetching App ID:");
    console.error(`   ${error.message}`);
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
    }
    
    console.log("\n💡 Troubleshooting:");
    console.log("   1. Verify your API key is correct");
    console.log("   2. Check if API key matches environment (TEST vs LIVE)");
    console.log("   3. Get App ID from Circle Console:");
    console.log("      → https://console.circle.com");
    console.log("      → Wallets > User Controlled > Configurator");
    console.log("      → Copy the App ID shown there\n");
    
    return null;
  }
}

getCircleAppId().catch(console.error);

