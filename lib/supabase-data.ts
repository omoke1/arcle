import { getSupabaseAdmin, getSupabaseClient } from "@/lib/supabase";

type UserRow = {
  id: string;
  wallet_address: string;
  email: string | null;
  created_at: string;
};

type SessionRow = {
  id: string;
  user_id: string;
  agent_state: Record<string, any> | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
};

type PreferenceRow = {
  id: string;
  user_id: string;
  key: string;
  value: any;
  created_at: string;
};

export type SupabaseUser = {
  id: string;
  walletAddress: string;
  email: string | null;
  createdAt: string;
};

export type SupabaseSession = {
  id: string;
  userId: string;
  agentState: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
};

export type SupabaseMessage = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: string;
};

export type SupabasePreference = {
  id: string;
  userId: string;
  key: string;
  value: any;
  createdAt: string;
};

function mapUser(row: UserRow): SupabaseUser {
  return {
    id: row.id,
    walletAddress: row.wallet_address,
    email: row.email,
    createdAt: row.created_at,
  };
}

function mapSession(row: SessionRow): SupabaseSession {
  return {
    id: row.id,
    userId: row.user_id,
    agentState: row.agent_state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: MessageRow): SupabaseMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}

function mapPreference(row: PreferenceRow): SupabasePreference {
  return {
    id: row.id,
    userId: row.user_id,
    key: row.key,
    value: row.value,
    createdAt: row.created_at,
  };
}

export async function saveUser(input: { id?: string; walletAddress: string; email?: string | null }): Promise<SupabaseUser> {
  const supabase = typeof window === "undefined" ? getSupabaseAdmin() : getSupabaseClient();
  const payload = {
    id: input.id,
    wallet_address: input.walletAddress.toLowerCase(),
    email: input.email ?? null,
  };

  const { data, error } = await supabase
    .from("users")
    .upsert(payload, { onConflict: "wallet_address" })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`[Supabase] Failed to save user: ${error?.message ?? "unknown error"}`);
  }

  return mapUser(data);
}

export async function loadUser(filters: { id?: string; walletAddress?: string }): Promise<SupabaseUser | null> {
  if (!filters.id && !filters.walletAddress) {
    throw new Error("[Supabase] loadUser requires either id or walletAddress");
  }

  const supabase = typeof window === "undefined" ? getSupabaseAdmin() : getSupabaseClient();
  let query = supabase.from("users").select("*");

  if (filters.id) {
    query = query.eq("id", filters.id);
  } else if (filters.walletAddress) {
    query = query.eq("wallet_address", filters.walletAddress.toLowerCase());
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`[Supabase] Failed to load user: ${error.message}`);
  }

  return data ? mapUser(data) : null;
}

export async function createSession(input: {
  id?: string;
  userId: string;
  agentState?: Record<string, any> | null;
}): Promise<SupabaseSession> {
  const supabase = typeof window === "undefined" ? getSupabaseAdmin() : getSupabaseClient();

  // Convert Circle user ID to Supabase UUID if needed
  // UUID format: 8-4-4-4-12 hex characters
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.userId);
  let supabaseUserId = input.userId;

  if (!isUUID) {
    // This is a Circle user ID, convert it to Supabase UUID
    try {
      supabaseUserId = await getOrCreateSupabaseUser(input.userId);
    } catch (error) {
      console.error('[Supabase] Failed to get/create Supabase user:', error);
      throw new Error(`[Supabase] Failed to resolve user ID: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      id: input.id,
      user_id: supabaseUserId,
      agent_state: input.agentState ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`[Supabase] Failed to create session: ${error?.message ?? "unknown error"}`);
  }

  return mapSession(data);
}

export async function loadSession(sessionId: string): Promise<SupabaseSession | null> {
  const supabase = typeof window === "undefined" ? getSupabaseAdmin() : getSupabaseClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(`[Supabase] Failed to load session: ${error.message}`);
  }

  return data ? mapSession(data) : null;
}

export async function updateSession(sessionId: string, agentState: Record<string, any> | null): Promise<SupabaseSession> {
  const supabase = typeof window === "undefined" ? getSupabaseAdmin() : getSupabaseClient();
  const { data, error } = await supabase
    .from("sessions")
    .update({ agent_state: agentState ?? null })
    .eq("id", sessionId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`[Supabase] Failed to update session: ${error?.message ?? "unknown error"}`);
  }

  return mapSession(data);
}

export async function getLastSessionForUser(userId: string): Promise<SupabaseSession | null> {
  const supabase = typeof window === "undefined" ? getSupabaseAdmin() : getSupabaseClient();

  // Resolve Supabase UUID (read-only, no creation)
  let supabaseUserId = userId;
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
  if (!isUUID) {
    try {
      supabaseUserId = await resolveSupabaseUserId(userId);
    } catch (e) {
      console.warn("[Supabase] Failed to resolve user for session lookup:", e);
      return null;
    }
  }

  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", supabaseUserId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(`[Supabase] Failed to load last session: ${error.message}`);
    return null;
  }

  return data ? mapSession(data) : null;
}

export async function saveMessage(input: { sessionId: string; role: string; content: string }): Promise<SupabaseMessage> {
  const supabase = typeof window === "undefined" ? getSupabaseAdmin() : getSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      session_id: input.sessionId,
      role: input.role,
      content: input.content,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`[Supabase] Failed to save message: ${error?.message ?? "unknown error"}`);
  }

  return mapMessage(data);
}

export async function loadMessages(sessionId: string, options: { limit?: number } = {}): Promise<SupabaseMessage[]> {
  const supabase = typeof window === "undefined" ? getSupabaseAdmin() : getSupabaseClient();
  const limit = options.limit ?? 100;

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`[Supabase] Failed to load messages: ${error.message}`);
  }
  return (data ?? []).map(mapMessage);
}

/**
 * Resolve a Supabase user ID from a Circle userId (read-only, no creation)
 * This maps Circle's string userId to Supabase's UUID user_id
 * Returns the Supabase user ID if found, throws an error if not found
 */
export async function resolveSupabaseUserId(userId: string): Promise<string> {
  // If already a UUID, return it
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
  if (isUUID) {
    return userId;
  }

  // Query by Circle user ID
  const supabase = typeof window === "undefined" ? getSupabaseAdmin() : getSupabaseClient();
  const { data: existingUser, error } = await supabase
    .from("users")
    .select("id")
    .eq("circle_user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`[Supabase] Failed to resolve user ID: ${error.message}`);
  }

  if (!existingUser) {
    throw new Error(`[Supabase] User not found for Circle userId: ${userId}`);
  }

  return existingUser.id;
}

/**
 * Get or create a Supabase user record from a Circle userId
 * This maps Circle's string userId to Supabase's UUID user_id
 * 
 * Note: User creation must go through an API route to bypass RLS, or we use admin client
 */
export async function getOrCreateSupabaseUser(
  circleUserId: string,
  walletAddress?: string,
  authUserId?: string,
  email?: string
): Promise<string> {
  const supabase = typeof window === "undefined" ? getSupabaseAdmin() : getSupabaseClient();

  // 1. If we have an authenticated Supabase User ID (from Auth), use it to link
  if (authUserId) {
    const { error } = await supabase
      .from("users")
      .upsert({
        id: authUserId, // Link to Auth User
        circle_user_id: circleUserId,
        wallet_address: walletAddress || null,
        email: email || null,
        created_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) {
      throw new Error(`[Supabase] Failed to link Auth User to Public User: ${error.message}`);
    }
    return authUserId;
  }

  // 2. Legacy/Fallback: Find by Circle ID
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("circle_user_id", circleUserId)
    .maybeSingle();

  if (existingUser) return existingUser.id;

  // 3. Create new unlinked user
  const placeholderAddress = walletAddress || `pending-${circleUserId}`;
  const { data: newUser, error } = await supabase
    .from("users")
    .insert({
      circle_user_id: circleUserId,
      wallet_address: placeholderAddress.toLowerCase(),
      email: null,
    })
    .select("id")
    .single();

  if (error || !newUser) {
    throw new Error("Failed to create user record: " + (error?.message || "Unknown error"));
  }

  // Store circle_user_id preference for future lookups (Backward Compat)
  await supabase
    .from("preferences")
    .upsert({
      user_id: newUser.id,
      key: "circle_user_id",
      value: circleUserId,
    }, { onConflict: "user_id,key" });

  return newUser.id;
}

export async function savePreference(input: { userId: string; key: string; value: any }): Promise<SupabasePreference> {
  const supabase = typeof window === "undefined" ? getSupabaseAdmin() : getSupabaseClient();

  // Handle special case: "current" userId - this requires a system user or we skip the user_id requirement
  // For now, we'll create a system user with a special UUID or handle it differently
  if (input.userId === "current") {
    // For "current", we need a system user ID - create one if it doesn't exist
    // We'll use a fixed system user UUID or create one
    const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";

    // Try to ensure system user exists
    const { data: sysUser } = await supabase
      .from("users")
      .select("id")
      .eq("id", SYSTEM_USER_ID)
      .maybeSingle();

    if (!sysUser) {
      // Create system user
      // The users table has circle_user_id as NOT NULL, so we must include it
      await supabase
        .from("users")
        .insert({
          id: SYSTEM_USER_ID,
          circle_user_id: "system",
          wallet_address: "system",
          email: null,
        });
    }

    const { data, error } = await supabase
      .from("preferences")
      .upsert({
        user_id: SYSTEM_USER_ID,
        key: input.key,
        value: input.value,
      }, {
        onConflict: "user_id,key"
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`[Supabase] Failed to save preference: ${error?.message ?? "unknown error"}`);
    }

    return mapPreference(data);
  }

  // Check if userId is a UUID (valid UUID format)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.userId);

  let supabaseUserId: string;

  if (isUUID) {
    // Already a UUID, use it directly
    supabaseUserId = input.userId;
  } else {
    // Circle userId (string), need to get/create Supabase user
    // Try to get wallet address from preferences if available
    let walletAddress: string | undefined;
    try {
      // This is a chicken-and-egg problem, so we'll create user without wallet first
      // and update it later when wallet is created
      supabaseUserId = await getOrCreateSupabaseUser(input.userId);
    } catch (error) {
      throw new Error(`[Supabase] Failed to get/create user for Circle userId ${input.userId}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  // Use upsert with conflict resolution on the unique constraint (user_id, key)
  const { data, error } = await supabase
    .from("preferences")
    .upsert({
      user_id: supabaseUserId,
      key: input.key,
      value: input.value,
    }, {
      onConflict: "user_id,key"
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`[Supabase] Failed to save preference: ${error?.message ?? "unknown error"}`);
  }

  return mapPreference(data);
}

export async function loadPreference(filters: { userId: string; key: string }): Promise<SupabasePreference | null> {
  const supabase = typeof window === "undefined" ? getSupabaseAdmin() : getSupabaseClient();

  // Handle special case: "current" userId - this is used for system-wide preferences
  if (filters.userId === "current") {
    // For "current", we'll try to find it directly (this is a special system preference)
    const { data, error } = await supabase
      .from("preferences")
      .select("*")
      .eq("key", filters.key)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      throw new Error(`[Supabase] Failed to load preference: ${error.message}`);
    }

    return data ? mapPreference(data) : null;
  }

  // Check if userId is a UUID
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.userId);

  let supabaseUserId: string;

  if (isUUID) {
    supabaseUserId = filters.userId;
  } else {
    // Circle userId, need to find Supabase user
    // JSONB value query: need to fetch all and filter, or use JSONB operators
    const { data: allPrefs } = await supabase
      .from("preferences")
      .select("user_id, value")
      .eq("key", "circle_user_id");

    // Filter in JavaScript since JSONB eq doesn't work for string values
    const matching = allPrefs?.find(p => {
      // value is JSONB, so it might be stored as a string or JSON
      const val = typeof p.value === 'string' ? p.value : JSON.stringify(p.value);
      // Remove quotes if JSON stringified
      const cleanVal = val.replace(/^"|"$/g, '');
      return cleanVal === filters.userId;
    });

    if (!matching?.user_id) {
      // User doesn't exist yet, return null
      return null;
    }

    supabaseUserId = matching.user_id;
  }

  const { data, error } = await supabase
    .from("preferences")
    .select("*")
    .eq("user_id", supabaseUserId)
    .eq("key", filters.key)
    .maybeSingle();

  if (error) {
    throw new Error(`[Supabase] Failed to load preference: ${error.message}`);
  }

  return data ? mapPreference(data) : null;
}

// Helper functions for user credentials (userId, userToken, encryptionKey)
export async function saveUserCredentials(userId: string, credentials: { userToken: string; encryptionKey?: string }, walletAddress?: string): Promise<void> {
  // Get or create Supabase user for this Circle userId
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
  let supabaseUserId: string;

  if (!isUUID) {
    try {
      supabaseUserId = await getOrCreateSupabaseUser(userId, walletAddress);
    } catch (error) {
      throw new Error(`[Supabase] Failed to get/create user for credentials: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  } else {
    supabaseUserId = userId;
  }

  await savePreference({ userId: supabaseUserId, key: "user_token", value: credentials.userToken });
  if (credentials.encryptionKey) {
    await savePreference({ userId: supabaseUserId, key: "encryption_key", value: credentials.encryptionKey });
  }
}

export async function loadUserCredentials(userId: string): Promise<{ userToken: string | null; encryptionKey: string | null }> {
  const [tokenPref, keyPref] = await Promise.all([
    loadPreference({ userId, key: "user_token" }),
    loadPreference({ userId, key: "encryption_key" }),
  ]);
  return {
    userToken: tokenPref?.value ?? null,
    encryptionKey: keyPref?.value ?? null,
  };
}

export async function clearUserCredentials(userId: string): Promise<void> {
  const supabase = typeof window === "undefined" ? getSupabaseAdmin() : getSupabaseClient();
  await supabase
    .from("preferences")
    .delete()
    .eq("user_id", userId)
    .in("key", ["user_token", "encryption_key"]);
}

// Helper functions for wallet data (walletId, walletAddress)
// --- Wallets (Migrated to public.wallets) ---

export async function saveWalletData(userId: string, data: { walletId: string; walletAddress: string }): Promise<void> {
  // Use client-side auth when on client, admin when on server
  const supabase = typeof window === "undefined" ? getSupabaseAdmin() : getSupabaseClient();

  // Resolve UUID if necessary
  let supabaseUserId = userId;
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
  if (!isUUID) {
    try {
      supabaseUserId = await getOrCreateSupabaseUser(userId);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "unknown error";
      throw new Error(`[Supabase] Failed to resolve UUID for saveWalletData: ${errorMessage}`);
    }
  }

  // 1. Save to new 'wallets' table
  const { error } = await supabase
    .from("wallets")
    .upsert({
      user_id: supabaseUserId,
      wallet_id: data.walletId,
      address: data.walletAddress,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (error) {
    console.error("[Supabase] Failed to save to wallets table:", error);
    // Fallback? No, we want to enforce new table usage. But maybe log and try preference as backup?
    // Let's stick to new table as primary.
  }

  // 2. Legacy Sync: Update users table wallet_address (for backward compat)
  await supabase
    .from("users")
    .update({ wallet_address: data.walletAddress })
    .eq("id", supabaseUserId);

  // 3. Legacy Sync: Save as preference (Double write for safety during migration)
  await savePreference({ userId, key: "wallet_data", value: data });
}

export async function loadWalletData(userId: string): Promise<{ walletId: string | null; walletAddress: string | null }> {
  const supabase = typeof window === "undefined" ? getSupabaseAdmin() : getSupabaseClient();

  // 1. Try new 'wallets' table
  let supabaseUserId = userId;
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
  if (!isUUID) {
    try {
      supabaseUserId = await getOrCreateSupabaseUser(userId);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "unknown error";
      console.error(`[Supabase] Failed to resolve UUID for loadWalletData (userId: ${userId}):`, errorMessage);
      console.warn("[Supabase] UUID resolution failed - returning empty result without querying database");
      return { walletId: null, walletAddress: null };
    }
  }

  // Validate that supabaseUserId is a UUID before querying
  const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(supabaseUserId);
  if (!isValidUUID) {
    console.error(`[Supabase] Invalid UUID after resolution (userId: ${userId}, supabaseUserId: ${supabaseUserId}) - returning empty result without querying database`);
    return { walletId: null, walletAddress: null };
  }

  const { data: wallet } = await supabase
    .from("wallets")
    .select("wallet_id, address")
    .eq("user_id", supabaseUserId)
    .maybeSingle();

  if (wallet) {
    return { walletId: wallet.wallet_id, walletAddress: wallet.address };
  }

  // 2. Migration: Check legacy preferences
  const legacyPref = await loadPreference({ userId, key: "wallet_data" });
  if (legacyPref?.value && legacyPref.value.walletId) {
    console.log(`[Migration] Found legacy wallet for user ${userId}, migrating to 'wallets' table...`);
    const legacyData = legacyPref.value;

    // Perform Migration
    try {
      await saveWalletData(userId, {
        walletId: legacyData.walletId,
        walletAddress: legacyData.walletAddress
      });
    } catch (error) {
      console.warn(`[Migration] Failed to migrate wallet data for user ${userId}:`, error);
      // Continue and return legacy data even if migration fails
    }

    return { walletId: legacyData.walletId, walletAddress: legacyData.walletAddress };
  }

  // 3. Fallback: Check older individual keys
  const [idPref, addressPref] = await Promise.all([
    loadPreference({ userId, key: "wallet_id" }),
    loadPreference({ userId, key: "wallet_address" }),
  ]);

  if (idPref?.value && addressPref?.value) {
    return { walletId: idPref.value, walletAddress: addressPref.value };
  }

  return { walletId: null, walletAddress: null };
}

export async function clearWalletData(userId: string): Promise<void> {
  const supabase = typeof window === "undefined" ? getSupabaseAdmin() : getSupabaseClient();

  let supabaseUserId = userId;
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
  if (!isUUID) {
    try {
      supabaseUserId = await getOrCreateSupabaseUser(userId);
    } catch (e) {
      console.error("[Supabase] Failed to resolve UUID for clearWalletData:", e);
      return;
    }
  }

  // Delete from wallets table
  const { error: walletsError } = await supabase
    .from("wallets")
    .delete()
    .eq("user_id", supabaseUserId);

  if (walletsError) {
    console.error("[Supabase] Failed to delete wallet from wallets table:", walletsError);
  }

  // Delete from preferences table (legacy data)
  const { error: preferencesError } = await supabase
    .from("preferences")
    .delete()
    .eq("user_id", supabaseUserId)
    .in("key", ["wallet_id", "wallet_address"]);

  if (preferencesError) {
    console.error("[Supabase] Failed to delete wallet preferences:", preferencesError);
  }
}

// Helper function for session ID (stored in session's agent_state or as a preference)
export async function getOrCreateSessionId(userId: string): Promise<string> {
  // Try to get existing session ID from preferences
  const sessionPref = await loadPreference({ userId, key: "session_id" });
  if (sessionPref?.value) {
    return sessionPref.value;
  }

  // Create new session ID
  const newSessionId = crypto.randomUUID();
  await savePreference({ userId, key: "session_id", value: newSessionId });
  return newSessionId;
}

