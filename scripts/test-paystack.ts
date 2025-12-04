/**
 * Test Paystack Rail Integration
 *
 * Usage:
 *   npm run test:paystack
 *
 * Requires:
 *   PAYSTACK_SECRET_KEY in your environment (.env.local or .env)
 */

import dotenv from "dotenv";
import { PaystackRailProvider } from "@/lib/local-accounts/paystackRailProvider";

// Load env from .env.local first (Next.js style), then fallback to .env
dotenv.config({ path: ".env.local" });
dotenv.config();

async function main() {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    console.error("❌ PAYSTACK_SECRET_KEY is not set. Please add it to your .env.local");
    process.exit(1);
  }

  console.log("🔍 Testing Paystack virtual account creation using PAYSTACK_SECRET_KEY...");

  try {
    const result = await PaystackRailProvider.createVirtualAccount({
      email: "test-paystack@arcle-local.ngn",
      metadata: { test: true },
    });

    console.log("\n✅ Paystack virtual account created successfully!");
    console.log("Bank:", result.bankName);
    console.log("Account Number:", result.accountNumber);
    console.log("Account Name:", result.accountName);
    console.log("Provider Account ID (customer_code):", result.providerAccountId);
    console.log("\n💡 This confirms PAYSTACK_SECRET_KEY is valid and the rail is reachable.");
  } catch (error: any) {
    console.error("\n❌ Failed to create Paystack virtual account:");
    console.error("   Message:", error.message || error);
    console.error(
      "   Check that PAYSTACK_SECRET_KEY is correct and that your Paystack account is in Test mode."
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


