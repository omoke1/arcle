/**
 * Local Accounts & Fiat Ledger Service
 *
 * Provides an object-oriented interface over the `local_accounts`,
 * `local_ledger_entries`, `local_transactions`, and `local_rails` tables.
 *
 * Responsibility:
 * - Manage local fiat account lifecycle per user + currency
 * - Post double-entry-style ledger entries for credits/debits/reserves
 * - Expose balance queries and high-level transaction records
 *
 * This service intentionally does not know about specific rail providers
 * or FX – those concerns live in higher-level agents.
 */

import { getSupabaseAdmin, getSupabaseClient } from "../supabase";

export type LocalCurrency = "NGN" | string;

export interface LocalAccount {
  id: string;
  user_id: string;
  currency: LocalCurrency;
  provider_account_id: string | null;
  status: "active" | "suspended" | "closed";
  display_name: string | null;
  daily_deposit_limit_minor: number | null;
  daily_withdrawal_limit_minor: number | null;
  created_at: string;
  updated_at: string;
}

export interface LocalLedgerEntry {
  id: string;
  account_id: string;
  entry_type: "credit" | "debit" | "reserve" | "release";
  amount_minor: number;
  balance_after_minor: number;
  reference: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface LocalTransaction {
  id: string;
  account_id: string;
  direction: "in" | "out";
  rail: string;
  status: "pending" | "completed" | "failed";
  amount_minor: number;
  workflow_id: string | null;
  external_id: string | null;
  error_code: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLocalAccountInput {
  userId: string;
  currency: LocalCurrency;
  displayName?: string;
  providerAccountId?: string;
  dailyDepositLimitMinor?: number;
  dailyWithdrawalLimitMinor?: number;
}

export interface PostLedgerEntryInput {
  accountId: string;
  type: "credit" | "debit" | "reserve" | "release";
  amountMinor: number;
  reference: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateLocalTransactionInput {
  accountId: string;
  direction: "in" | "out";
  rail: string;
  amountMinor: number;
  workflowId?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}

export class LocalAccountsService {
  /**
   * Create or return an existing local account for a user + currency.
   */
  static async getOrCreateAccount(
    input: CreateLocalAccountInput,
  ): Promise<LocalAccount> {
    const admin = getSupabaseAdmin();

    const { data: existing, error: fetchError } = await admin
      .from("local_accounts")
      .select("*")
      .eq("user_id", input.userId)
      .eq("currency", input.currency)
      .maybeSingle();

    if (fetchError) {
      console.error("[LocalAccountsService] Error checking existing account:", fetchError);
      throw new Error(`Failed to lookup local account: ${fetchError.message}`);
    }

    if (existing) {
      return existing as LocalAccount;
    }

    const { data: created, error: insertError } = await admin
      .from("local_accounts")
      .insert({
        user_id: input.userId,
        currency: input.currency,
        display_name: input.displayName ?? null,
        provider_account_id: input.providerAccountId ?? null,
        daily_deposit_limit_minor: input.dailyDepositLimitMinor ?? null,
        daily_withdrawal_limit_minor: input.dailyWithdrawalLimitMinor ?? null,
      })
      .select()
      .single();

    if (insertError || !created) {
      console.error("[LocalAccountsService] Error creating local account:", insertError);
      throw new Error(`Failed to create local account: ${insertError?.message ?? "Unknown error"}`);
    }

    return created as LocalAccount;
  }

  /**
   * Fetch a local account by id (client-safe).
   */
  static async getAccountById(id: string): Promise<LocalAccount | null> {
    const client = getSupabaseClient();

    const { data, error } = await client
      .from("local_accounts")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[LocalAccountsService] Error fetching account by id:", error);
      return null;
    }

    return (data as LocalAccount) ?? null;
  }

  /**
   * Get all local accounts for a user.
   */
  static async listUserAccounts(userId: string): Promise<LocalAccount[]> {
    const client = getSupabaseClient();

    const { data, error } = await client
      .from("local_accounts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[LocalAccountsService] Error listing user accounts:", error);
      return [];
    }

    return (data as LocalAccount[]) ?? [];
  }

  /**
   * Find a local account by provider account id (e.g. Paystack customer/virtual id).
   */
  static async findAccountByProviderAccountId(
    providerAccountId: string,
  ): Promise<LocalAccount | null> {
    const admin = getSupabaseAdmin();

    const { data, error } = await admin
      .from("local_accounts")
      .select("*")
      .eq("provider_account_id", providerAccountId)
      .maybeSingle();

    if (error) {
      console.error(
        "[LocalAccountsService] Error finding account by provider_account_id:",
        error,
      );
      return null;
    }

    return (data as LocalAccount) ?? null;
  }

  /**
   * Post a ledger entry and return the resulting entry + new balance.
   *
   * Note: this assumes the database enforces consistency of `balance_after_minor`
   * via application logic. For now, we compute it here using the latest entry.
   */
  static async postLedgerEntry(
    input: PostLedgerEntryInput,
  ): Promise<LocalLedgerEntry> {
    const admin = getSupabaseAdmin();

    // Fetch latest balance
    const { data: latest, error: latestError } = await admin
      .from("local_ledger_entries")
      .select("balance_after_minor")
      .eq("account_id", input.accountId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      console.error("[LocalAccountsService] Error fetching latest ledger entry:", latestError);
      throw new Error(`Failed to read current balance: ${latestError.message}`);
    }

    const currentBalance: number = latest?.balance_after_minor ?? 0;
    const delta = input.type === "debit" || input.type === "reserve" ? -input.amountMinor : input.amountMinor;
    const newBalance = currentBalance + delta;

    if (newBalance < 0) {
      throw new Error("Insufficient local balance for this operation");
    }

    const { data: entry, error: insertError } = await admin
      .from("local_ledger_entries")
      .insert({
        account_id: input.accountId,
        entry_type: input.type,
        amount_minor: input.amountMinor,
        balance_after_minor: newBalance,
        reference: input.reference,
        description: input.description ?? null,
        metadata: input.metadata ?? null,
      })
      .select()
      .single();

    if (insertError || !entry) {
      console.error("[LocalAccountsService] Error inserting ledger entry:", insertError);
      throw new Error(`Failed to post ledger entry: ${insertError?.message ?? "Unknown error"}`);
    }

    return entry as LocalLedgerEntry;
  }

  /**
   * Convenience helper for crediting an account from an external rail event.
   */
  static async creditFromRailEvent(params: {
    accountId: string;
    amountMinor: number;
    reference: string;
    description?: string;
    metadata?: Record<string, unknown>;
    rail: string;
    workflowId?: string;
    externalId?: string;
  }): Promise<{ entry: LocalLedgerEntry; transaction: LocalTransaction }> {
    const entry = await this.postLedgerEntry({
      accountId: params.accountId,
      type: "credit",
      amountMinor: params.amountMinor,
      reference: params.reference,
      description: params.description,
      metadata: params.metadata,
    });

    const transaction = await this.createTransaction({
      accountId: params.accountId,
      direction: "in",
      rail: params.rail,
      amountMinor: params.amountMinor,
      workflowId: params.workflowId,
      externalId: params.externalId,
      metadata: params.metadata,
    });

    return { entry, transaction };
  }

  /**
   * Compute the current balance for a local account.
   */
  static async getAccountBalanceMinor(accountId: string): Promise<number> {
    const client = getSupabaseClient();

    const { data, error } = await client
      .from("local_ledger_entries")
      .select("balance_after_minor")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[LocalAccountsService] Error fetching balance:", error);
      throw new Error(`Failed to fetch local account balance: ${error.message}`);
    }

    return data?.balance_after_minor ?? 0;
  }

  /**
   * Create a high-level transaction record, typically alongside ledger operations.
   */
  static async createTransaction(
    input: CreateLocalTransactionInput,
  ): Promise<LocalTransaction> {
    const admin = getSupabaseAdmin();

    const { data, error } = await admin
      .from("local_transactions")
      .insert({
        account_id: input.accountId,
        direction: input.direction,
        rail: input.rail,
        amount_minor: input.amountMinor,
        workflow_id: input.workflowId ?? null,
        external_id: input.externalId ?? null,
        metadata: input.metadata ?? null,
      })
      .select()
      .single();

    if (error || !data) {
      console.error("[LocalAccountsService] Error creating transaction:", error);
      throw new Error(`Failed to create local transaction: ${error?.message ?? "Unknown error"}`);
    }

    return data as LocalTransaction;
  }

  /**
   * Update transaction status (e.g., after webhook callback).
   */
  static async updateTransactionStatus(
    id: string,
    status: LocalTransaction["status"],
    errorDetails?: { code?: string; message?: string },
  ): Promise<LocalTransaction | null> {
    const admin = getSupabaseAdmin();

    const { data, error } = await admin
      .from("local_transactions")
      .update({
        status,
        error_code: errorDetails?.code ?? null,
        error_message: errorDetails?.message ?? null,
      })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("[LocalAccountsService] Error updating transaction status:", error);
      return null;
    }

    return (data as LocalTransaction) ?? null;
  }
}


