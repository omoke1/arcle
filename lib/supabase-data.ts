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
 * Get or create a Supabase user record from a Circle userId
 * This maps Circle's string userId to Supabase's UUID user_id
 * 
 * Note: User creation must go through an API route to bypass RLS, or we use admin client
 */
export async function getOrCreateSupabaseUser(circleUserId: string, walletAddress?: string): Promise<string> {
  // Always use API route for user creation to bypass RLS (secure)
  if (typeof window !== "undefined") {
    // Client-side: use API route to create user (bypasses RLS)
    const response = await fetch("/api/supabase/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ circleUserId, walletAddress }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create user");
    }
    
    const data = await response.json();
    return data.userId;
  }
  
  // Server-side: use admin client directly
  const supabase = getSupabaseAdmin();
  
  // First, try to find existing user by circle_user_id directly (if column exists)
  const { data: existingUserByCircleId } = await supabase
    .from("users")
    .select("id")
    .eq("circle_user_id", circleUserId)
    .maybeSingle();
  
  if (existingUserByCircleId?.id) {
    return existingUserByCircleId.id;
  }
  
  // Fallback: try to find by preferences (for backwards compatibility)
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
    return cleanVal === circleUserId;
  });
  
  if (matching?.user_id) {
    return matching.user_id;
  }
  
  // If we have a wallet address, try to find user by wallet_address
  if (walletAddress) {
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("wallet_address", walletAddress.toLowerCase())
      .maybeSingle();
    
    if (existingUser?.id) {
      // Store circle_user_id preference for future lookups
      await supabase
        .from("preferences")
        .upsert({
          user_id: existingUser.id,
          key: "circle_user_id",
          value: circleUserId,
        }, {
          onConflict: "user_id,key"
        });
      return existingUser.id;
    }
  }
  
  // Create new user record using admin client (bypasses RLS)
  // The users table has circle_user_id as NOT NULL, so we must include it
  const placeholderAddress = walletAddress || `pending-${circleUserId}`;
  const { data: newUser, error: createError } = await supabase
    .from("users")
    .insert({
      circle_user_id: circleUserId,
      wallet_address: placeholderAddress.toLowerCase(),
      email: null,
    })
    .select("id")
    .single();
  
  if (createError || !newUser) {
    throw new Error(`[Supabase] Failed to create user: ${createError?.message ?? "unknown error"}`);
  }
  
  // Store circle_user_id preference for future lookups
  await supabase
    .from("preferences")
    .upsert({
      user_id: newUser.id,
      key: "circle_user_id",
      value: circleUserId,
    }, {
      onConflict: "user_id,key"
    });
  
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
    supabaseUserId = await getOrCreateSupabaseUser(userId, walletAddress);
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
export async function saveWalletData(userId: string, walletData: { walletId: string; walletAddress: string }): Promise<void> {
  // Get or create Supabase user for this Circle userId, and update wallet_address if needed
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
  let supabaseUserId: string;
  
  if (!isUUID) {
    supabaseUserId = await getOrCreateSupabaseUser(userId, walletData.walletAddress);
    
    // Update user's wallet_address if it was a placeholder
    const supabase = typeof window === "undefined" ? getSupabaseAdmin() : getSupabaseClient();
    const { data: user } = await supabase
      .from("users")
      .select("wallet_address")
      .eq("id", supabaseUserId)
      .single();
    
    if (user && user.wallet_address && user.wallet_address.startsWith("pending-")) {
      await supabase
        .from("users")
        .update({ wallet_address: walletData.walletAddress.toLowerCase() })
        .eq("id", supabaseUserId);
    }
  } else {
    supabaseUserId = userId;
  }
  
  await Promise.all([
    savePreference({ userId: supabaseUserId, key: "wallet_id", value: walletData.walletId }),
    savePreference({ userId: supabaseUserId, key: "wallet_address", value: walletData.walletAddress }),
  ]);
}

export async function loadWalletData(userId: string): Promise<{ walletId: string | null; walletAddress: string | null }> {
  const [idPref, addressPref] = await Promise.all([
    loadPreference({ userId, key: "wallet_id" }),
    loadPreference({ userId, key: "wallet_address" }),
  ]);
  return {
    walletId: idPref?.value ?? null,
    walletAddress: addressPref?.value ?? null,
  };
}

export async function clearWalletData(userId: string): Promise<void> {
  const supabase = typeof window === "undefined" ? getSupabaseAdmin() : getSupabaseClient();
  await supabase
    .from("preferences")
    .delete()
    .eq("user_id", userId)
    .in("key", ["wallet_id", "wallet_address"]);
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

