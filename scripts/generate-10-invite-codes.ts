/**
 * Generate 10 New Invite Codes
 * 
 * Usage: npx tsx scripts/generate-10-invite-codes.ts
 */

const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Generate 10 unique codes
const codes = new Set<string>();
while (codes.size < 10) {
  codes.add(generateCode());
}

const codeArray = Array.from(codes);

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║         10 New Invite Codes Generated              ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

codeArray.forEach((code, i) => {
  console.log(`  ${i + 1}. ${code}`);
});

console.log('\n📋 Copy these codes to add to DAILY_INVITE_CODES array:\n');
console.log(codeArray.map(c => `  '${c}'`).join(',\n'));

console.log('\n📝 Or use this format for easy copy:\n');
console.log(codeArray.join(', '));

console.log('\n✅ All codes are unique and ready to use!');

