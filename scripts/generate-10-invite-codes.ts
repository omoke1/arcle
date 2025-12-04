/**
 * Generate 10 New Invite Codes and Update invite-codes.ts
 * 
 * Usage: npx tsx scripts/generate-10-invite-codes.ts
 */

import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

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
const now = new Date().toISOString();

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║         10 New Invite Codes Generated              ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

codeArray.forEach((code, i) => {
  console.log(`  ${i + 1}. ${code}`);
});

// Update the invite-codes.ts file
const inviteCodesPath = join(process.cwd(), 'lib', 'auth', 'invite-codes.ts');
const fileContent = readFileSync(inviteCodesPath, 'utf-8');

// Update INVITE_BATCH_CREATED_AT
const updatedBatchDate = fileContent.replace(
  /const INVITE_BATCH_CREATED_AT = ".*";/,
  `const INVITE_BATCH_CREATED_AT = "${now}";`
);

// Update DAILY_INVITE_CODES array
const codesString = codeArray.map((code, i) => `  "${code}", // Code ${i + 1}`).join('\n');
const updatedCodes = updatedBatchDate.replace(
  /export const DAILY_INVITE_CODES: string\[\] = \[[\s\S]*?\];/,
  `export const DAILY_INVITE_CODES: string[] = [\n${codesString}\n];`
);

writeFileSync(inviteCodesPath, updatedCodes, 'utf-8');

console.log('\n✅ Updated lib/auth/invite-codes.ts with new codes!');
console.log(`✅ Batch timestamp updated to: ${now}`);
console.log('\n📋 Codes for easy copy:\n');
console.log(codeArray.join(', '));
console.log('\n🚀 Ready to deploy! These codes will work on Vercel after you push.');

