/**
 * Test Flutterwave Integration Script
 *
 * This script tests the Flutterwave rail provider by:
 * 1. Creating a test customer
 * 2. Creating a static virtual account (NGN)
 * 3. Verifying the account details are returned
 *
 * Usage:
 *   npm run test:flutterwave
 *
 * Requires:
 *   FLW_SECRET_KEY in .env.local
 */

import "dotenv/config";
import { FlutterwaveRailProvider } from "@/lib/local-accounts/flutterwaveRailProvider";

async function main() {
  console.log("🔍 Testing Flutterwave virtual account creation using FLW_SECRET_KEY...\n");

  if (!process.env.FLW_SECRET_KEY) {
    console.error("❌ FLW_SECRET_KEY is not set. Please add it to your .env.local");
    console.error("\nGet your key from:");
    console.error("  https://dashboard.flutterwave.com/settings/apis");
    process.exit(1);
  }

  try {
    const testEmail = `test-${Date.now()}@arcle-test.ngn`;
    const testName = "ARCLE Test User";

    console.log("📝 Creating Flutterwave customer + virtual account...");
    console.log(`   Email: ${testEmail}`);
    console.log(`   Name: ${testName}`);
    console.log(`   Currency: NGN\n`);

    const result = await FlutterwaveRailProvider.createCustomerWithVirtualAccount({
      email: testEmail,
      fullName: testName,
      currency: "NGN",
      metadata: { test: true, timestamp: Date.now() },
    });

    console.log("✅ Flutterwave virtual account created successfully!");
    console.log("=".repeat(80));
    console.log("Account Details:");
    console.log(`  Bank Name: ${result.bankName}`);
    console.log(`  Account Number: ${result.accountNumber}`);
    console.log(`  Account Name: ${result.accountName}`);
    console.log(`  Customer Code: ${result.customer.customer_code}`);
    console.log(`  Provider Account ID: ${result.providerAccountId}`);
    console.log("=".repeat(80));

    console.log("\n💡 Next steps:");
    console.log("  1. Send money to this account number from any bank app");
    console.log("  2. Configure webhook URL in Flutterwave dashboard:");
    console.log("     https://your-domain/api/webhooks/flutterwave");
    console.log("  3. When deposit arrives, webhook will credit the user's ledger");
    console.log("\n📋 To use in production:");
    console.log(`   - Store providerAccountId: ${result.providerAccountId}`);
    console.log(`   - Store accountNumber: ${result.accountNumber}`);
    console.log(`   - Show these details to the user in your app`);
  } catch (error: any) {
    console.error("\n❌ Failed to create Flutterwave virtual account:");
    const message = error.message || "Unknown error";
    console.error(`   Message: ${message}`);

    if (message.includes("BVN") || message.includes("NIN")) {
      console.error("\n💡 Note: NGN virtual accounts may require BVN or NIN verification.");
      console.error("   For test mode, Flutterwave may allow accounts without BVN.");
      console.error("   For production, you'll need to collect BVN/NIN from users.");
    }

    if (message.includes("not configured") || message.includes("FLW_SECRET_KEY")) {
      console.error("\n💡 Check that:");
      console.error("   1. FLW_SECRET_KEY is set in .env.local");
      console.error("   2. Your Flutterwave account is in Test mode (or Live mode if using live key)");
      console.error("   3. Virtual Accounts feature is enabled for your account");
    }

    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

