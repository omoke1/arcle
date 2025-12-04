/**
 * Local Accounts Agent
 *
 * High-level AI-facing interface for local fiat accounts (e.g. NGN).
 * Delegates storage and ledger math to `LocalAccountsService`.
 */

import type { AgentRequest, AgentResponse } from "@/core/routing/types";
import {
  LocalAccountsService,
  type CreateLocalAccountInput,
} from "@/lib/db/services/localAccounts";
import { FlutterwaveRailProvider } from "@/lib/local-accounts/flutterwaveRailProvider";
import { getUserById } from "@/lib/db/services/users";
import { loadPreference } from "@/lib/supabase-data";

class LocalAccountsAgent {
  /**
   * Create or fetch a local account for the current user and currency.
   */
  async getOrCreateAccountForUser(
    userId: string,
    currency: string = "NGN",
  ) {
    const input: CreateLocalAccountInput = {
      userId,
      currency,
    };

    const account = await LocalAccountsService.getOrCreateAccount(input);

    // If no provider account is attached yet, create a Flutterwave virtual account
    if (!account.provider_account_id && (currency === "NGN" || currency === "GHS")) {
      // Try to get user's actual display name or email from database
      let fullName = "User"; // Default fallback
      
      try {
        // First try to get from user settings/preferences
        const userSettings = await loadPreference({ userId, key: "user_settings" });
        if (userSettings?.value?.displayName) {
          fullName = userSettings.value.displayName;
        } else if (userSettings?.value?.email) {
          fullName = userSettings.value.email.split("@")[0]; // Use email username part
        } else {
          // Fallback: try to get from users table
          const user = await getUserById(userId);
          if (user?.display_name) {
            fullName = user.display_name;
          } else if (user?.email) {
            fullName = user.email.split("@")[0]; // Use email username part
          }
        }
      } catch (error) {
        console.warn("[LocalAccountsAgent] Could not fetch user name, using default:", error);
        // Keep default "User" name
      }
      
      // Derive email-like identifier from user id
      const virtualEmail = `${userId}@arcle-local.${currency.toLowerCase()}`;

      const result = await FlutterwaveRailProvider.createCustomerWithVirtualAccount({
        email: virtualEmail,
        fullName,
        currency: currency as "NGN" | "GHS",
        metadata: { userId, currency },
        // Note: BVN/NIN would be required for NGN in production; for now we skip
        // and let Flutterwave handle validation/requirements
      });

      // Persist provider account id (customer ID) on the local account
      await LocalAccountsService.getOrCreateAccount({
        userId,
        currency,
        providerAccountId: result.providerAccountId,
      });

      // Reflect latest view for the caller (includes provider_account_id)
      const refreshed = await LocalAccountsService.getOrCreateAccount({
        userId,
        currency,
      });

      return refreshed;
    }

    return account;
  }

  /**
   * Get the current balance (minor units) for a user's local account.
   */
  async getUserBalanceMinor(userId: string, currency: string = "NGN") {
    const account = await this.getOrCreateAccountForUser(userId, currency);
    const balanceMinor = await LocalAccountsService.getAccountBalanceMinor(
      account.id,
    );
    return { account, balanceMinor };
  }

  /**
   * Execute an action via explicit API (e.g. from INERA).
   */
  async execute(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case "getOrCreateAccount":
        return await this.getOrCreateAccountForUser(
          params.userId,
          params.currency,
        );
      case "getBalanceMinor":
        return await this.getUserBalanceMinor(params.userId, params.currency);
      default:
        throw new Error(`Unknown LocalAccountsAgent action: ${action}`);
    }
  }

  /**
   * Handle routed chat requests.
   */
  async handle(request: AgentRequest): Promise<AgentResponse> {
    const { intent, context } = request;

    if (!context?.userId) {
      return {
        success: false,
        message: "You need to be signed in to use local accounts.",
        agent: "local-accounts",
        error: "Missing user context",
      };
    }

    const lowerIntent = intent.toLowerCase();

    // Simple v1 flows: open account, show balance
    if (
      lowerIntent.includes("open") &&
      lowerIntent.includes("account") &&
      (lowerIntent.includes("ngn") || lowerIntent.includes("local"))
    ) {
      await this.getOrCreateAccountForUser(context.userId, "NGN");

      return {
        success: true,
        message:
          "Your local NGN account is ready. You can now receive deposits and use it for local payments and conversions.",
        agent: "local-accounts",
        action: "create-account",
      };
    }

    if (
      lowerIntent.includes("balance") &&
      (lowerIntent.includes("ngn") ||
        lowerIntent.includes("local account") ||
        lowerIntent.includes("bank account"))
    ) {
      const { account, balanceMinor } = await this.getUserBalanceMinor(
        context.userId,
        "NGN",
      );

      const balanceMajor = balanceMinor / 100; // assume 2 decimal places for v1

      return {
        success: true,
        message: `Your NGN account balance is approximately ₦${balanceMajor.toLocaleString(
          "en-NG",
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          },
        )}.`,
        agent: "local-accounts",
        action: "show-balance",
        data: {
          accountId: account.id,
          balanceMinor,
        },
      };
    }

    return {
      success: true,
      message:
        "I can help you open and manage a local NGN account. Try saying “Open a local NGN account” or “Show my NGN balance”.",
      agent: "local-accounts",
      action: "help",
    };
  }

  canHandle(intent: string): boolean {
    const lower = intent.toLowerCase();
    const keywords = [
      "local account",
      "ngn account",
      "bank account",
      "ngn balance",
      "local balance",
    ];
    return keywords.some((keyword) => lower.includes(keyword));
  }
}

const localAccountsAgent = new LocalAccountsAgent();

export default localAccountsAgent;
export { LocalAccountsAgent };


