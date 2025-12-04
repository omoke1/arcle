/**
 * Generate New Invite Codes
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

console.log('\n🎫 10 New Invite Codes Generated:\n');
console.log('Add these to lib/auth/invite-codes.ts:\n');

codeArray.forEach((code, index) => {
  console.log(`  '${code}', // Code ${index + 21}`);
});

console.log('\n📋 Copy-paste ready format:\n');
console.log(codeArray.map((c, i) => `  '${c}', // Code ${i + 21}`).join('\n'));














