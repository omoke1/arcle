/**
 * Generate 5 New Invite Codes
 * 
 * Usage: npx tsx scripts/generate-5-invite-codes.ts
 */

const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Generate 5 unique codes
const codes = new Set<string>();
while (codes.size < 5) {
  codes.add(generateCode());
}

const codeArray = Array.from(codes);

console.log('╔═══════════════════════════════════════════════════════╗');
console.log('║         5 New Invite Codes Generated                 ║');
console.log('╚═══════════════════════════════════════════════════════╝');
console.log('');

console.log('\n📋 Copy these codes to add to DAILY_INVITE_CODES array:\n');

const today = new Date().toISOString().split('T')[0];
codeArray.forEach((code, index) => {
  console.log(`  '${code}', // Code ${index + 1}`);
});

console.log(`\n// New codes added: ${today}\n`);

console.log('\n📋 Copy-paste ready format:\n');
console.log(codeArray.map((c, i) => `  '${c}', // Code ${i + 1}`).join('\n'));

