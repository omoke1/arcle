import { generateEntitySecret } from '@circle-fin/developer-controlled-wallets';

/**
 * Generate Entity Secret for Circle Developer-Controlled Wallets
 * 
 * Run this script to generate a new Entity Secret:
 * npm run generate-entity-secret
 * 
 * Then add it to your .env file:
 * CIRCLE_ENTITY_SECRET=<generated_secret>
 */

console.log("Generating Entity Secret for Developer-Controlled Wallets...");
console.log("");

try {
  generateEntitySecret();
  console.log("");
  console.log("✅ Entity Secret generated successfully!");
  console.log("📝 Copy the secret above and add it to your .env file as:");
  console.log("   CIRCLE_ENTITY_SECRET=<generated_secret>");
  console.log("");
  console.log("⚠️  IMPORTANT: Keep this secret secure and never commit it to version control!");
} catch (error: any) {
  console.error("❌ Error generating Entity Secret:", error.message || error);
  process.exit(1);
}

