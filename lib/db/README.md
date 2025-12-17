# Supabase Database Layer

## Setup Instructions

### 1. Create Supabase Project

1. Go to https://supabase.com
2. Create a new project
3. Note your project URL and API keys

### 2. Set Environment Variables

Add to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Run Database Migrations

1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `lib/db/migrations/001_core_tables.sql`
3. Run the migration
4. Verify tables are created

### 4. Test Connection

```typescript
import { isSupabaseConfigured, getSupabaseClient } from '@/lib/db/supabase';

if (isSupabaseConfigured()) {
  const supabase = getSupabaseClient();
  // Test query
}
```

## Service Layer

### Available Services

- `lib/db/services/users.ts` - User management
- `lib/db/services/wallets.ts` - Wallet management
- `lib/db/services/sessionKeys.ts` - Session key management
- `lib/db/services/transactions.ts` - Transaction history

### Usage Example

```typescript
import { createUser, getUserByCircleId } from '@/lib/db/services/users';
import { createWallet } from '@/lib/db/services/wallets';

// Create user
const user = await createUser({
  circle_user_id: 'circle-user-id',
  email: 'user@example.com',
});

// Create wallet
const wallet = await createWallet({
  user_id: user.id,
  circle_wallet_id: 'circle-wallet-id',
  address: '0x...',
  chain: 'ARC-TESTNET',
});
```

## Migration Status

- ✅ Core tables SQL created
- ✅ Service layer implemented
- ⏳ Database migration pending (run SQL in Supabase)
- ⏳ Integration with existing services pending

