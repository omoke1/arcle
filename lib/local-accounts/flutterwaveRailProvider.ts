/**
 * Flutterwave Rail Provider
 *
 * Thin wrapper around Flutterwave APIs used for:
 * - Creating customers and static virtual NGN/GHS accounts per user
 * - Handling incoming deposit webhooks (virtual_account_credit events)
 * - Initiating payouts/transfers to bank accounts
 *
 * NOTE: This file assumes you will configure:
 * - FLW_SECRET_KEY
 * - FLW_PUBLIC_KEY (optional, for client-side if needed)
 * - FLW_BASE_URL (optional, defaults to https://api.flutterwave.com/v3)
 */

import { LocalAccountsService } from "@/lib/db/services/localAccounts";

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY;
const FLW_BASE_URL =
  process.env.FLW_BASE_URL || "https://api.flutterwave.com/v3";

if (!FLW_SECRET_KEY) {
  console.warn(
    "[FlutterwaveRailProvider] FLW_SECRET_KEY is not set. Rail operations will fail until configured.",
  );
}

interface FlutterwaveCustomer {
  id: number;
  email: string;
  phone_number: string;
  full_name: string;
  customer_code: string;
  created_at: string;
}

interface FlutterwaveVirtualAccount {
  order_ref: string;
  account_number: string;
  bank_name: string;
  account_name: string;
  created_at: string;
}

export interface CreateVirtualAccountResult {
  providerAccountId: string; // customer_code or virtual account id
  bankName: string;
  accountNumber: string;
  accountName: string;
  raw: any;
}

export class FlutterwaveRailProvider {
  private static getSecretKey(): string {
    const key = FLW_SECRET_KEY;
    if (!key) {
      throw new Error("FLW_SECRET_KEY is not configured");
    }
    return key;
  }

  private static getHeaders() {
    return {
      Authorization: `Bearer ${this.getSecretKey()}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Create a customer in Flutterwave (required before creating virtual account).
   */
  static async createCustomer(params: {
    email: string;
    fullName: string;
    phoneNumber?: string;
    metadata?: Record<string, unknown>;
  }): Promise<FlutterwaveCustomer> {
    const response = await fetch(`${FLW_BASE_URL}/customers`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        email: params.email,
        fullname: params.fullName,
        phone_number: params.phoneNumber || "",
        metadata: params.metadata ?? {},
      }),
    });

    const json = await response.json();

    if (!response.ok || json.status !== "success") {
      console.error("[FlutterwaveRailProvider] Error creating customer:", json);
      throw new Error(
        json.message || "Failed to create Flutterwave customer",
      );
    }

    return json.data as FlutterwaveCustomer;
  }

  /**
   * Create a static virtual account for a customer (NGN or GHS).
   *
   * For Nigeria (NGN): requires BVN or NIN in metadata
   * For Ghana (GHS): may require additional ID verification
   */
  static async createVirtualAccount(params: {
    customerId: number; // Flutterwave customer ID
    currency: "NGN" | "GHS";
    bvn?: string; // For NGN
    nin?: string; // For NGN (alternative to BVN)
    metadata?: Record<string, unknown>;
  }): Promise<CreateVirtualAccountResult> {
    const payload: any = {
      email: "", // Will be filled from customer lookup if needed
      is_permanent: true, // Static account
      tx_ref: `arcle-va-${Date.now()}-${params.customerId}`,
      currency: params.currency,
      amount: 0, // Required for static accounts
      ...(params.bvn && { bvn: params.bvn }),
      ...(params.nin && { nin: params.nin }),
      ...(params.metadata && { meta: params.metadata }),
    };

    const response = await fetch(`${FLW_BASE_URL}/virtual-account-numbers`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    const json = await response.json();

    if (!response.ok || json.status !== "success") {
      console.error(
        "[FlutterwaveRailProvider] Error creating virtual account:",
        json,
      );
      throw new Error(
        json.message || "Failed to create Flutterwave virtual account",
      );
    }

    const data = json.data as FlutterwaveVirtualAccount;

    return {
      providerAccountId: String(params.customerId), // Use customer ID as provider account ID
      bankName: data.bank_name,
      accountNumber: data.account_number,
      accountName: data.account_name,
      raw: data,
    };
  }

  /**
   * Create customer + virtual account in one flow (convenience method).
   */
  static async createCustomerWithVirtualAccount(params: {
    email: string;
    fullName: string;
    phoneNumber?: string;
    currency: "NGN" | "GHS";
    bvn?: string;
    nin?: string;
    metadata?: Record<string, unknown>;
  }): Promise<CreateVirtualAccountResult & { customer: FlutterwaveCustomer }> {
    const customer = await this.createCustomer({
      email: params.email,
      fullName: params.fullName,
      phoneNumber: params.phoneNumber,
      metadata: params.metadata,
    });

    const virtualAccount = await this.createVirtualAccount({
      customerId: customer.id,
      currency: params.currency,
      bvn: params.bvn,
      nin: params.nin,
      metadata: params.metadata,
    });

    return {
      ...virtualAccount,
      customer,
    };
  }

  /**
   * Handle a `virtual_account_credit` webhook for a deposit.
   *
   * This is called from the Flutterwave webhook route once signature is verified.
   */
  static async handleVirtualAccountCreditWebhook(event: any) {
    const data = event.data;

    // Flutterwave virtual account credit webhook structure
    const accountNumber = data.account_number;
    const amountMinor: number = data.amount; // Amount in minor units (kobo/pesewas)
    const reference: string = data.tx_ref || data.flw_ref;
    const customerId = data.customer?.id || data.customer_id;

    // Find account by provider_account_id (customer ID) or account number
    let account = null;
    if (customerId) {
      account = await LocalAccountsService.findAccountByProviderAccountId(
        String(customerId),
      );
    }

    // Fallback: try to find by account number in metadata if we store it
    if (!account && accountNumber) {
      // This would require a helper to search by metadata.accountNumber
      // For now, we rely on provider_account_id (customer ID)
      console.warn(
        "[FlutterwaveRailProvider] Could not find account by customer ID, account number lookup not implemented",
        { customerId, accountNumber },
      );
    }

    if (!account) {
      console.warn(
        "[FlutterwaveRailProvider] No local account found for Flutterwave customer",
        { customerId, accountNumber },
      );
      return;
    }

    await LocalAccountsService.creditFromRailEvent({
      accountId: account.id,
      amountMinor,
      reference: reference || `flw-${Date.now()}`,
      description: `Deposit via Flutterwave to ${accountNumber} (${data.bank_name || "bank transfer"})`,
      metadata: {
        flutterwave_event_id: event.id,
        flutterwave_reference: reference,
        account_number: accountNumber,
        bank_name: data.bank_name,
      },
      rail: "flutterwave",
      externalId: String(data.id || reference),
      workflowId: undefined,
    });
  }

  /**
   * Verify Flutterwave webhook signature.
   *
   * Flutterwave signs webhooks with SHA-256 HMAC using your secret key.
   */
  static verifyWebhookSignature(
    payload: string,
    signature: string,
  ): boolean {
    if (!FLW_SECRET_KEY) {
      console.warn(
        "[FlutterwaveRailProvider] Cannot verify webhook: FLW_SECRET_KEY not set",
      );
      return false;
    }

    // Flutterwave uses SHA-256 HMAC
    const crypto = require("crypto");
    const hash = crypto
      .createHmac("sha256", FLW_SECRET_KEY)
      .update(payload)
      .digest("hex");

    return hash === signature;
  }

  /**
   * Initiate a payout/transfer to a bank account (for withdrawals).
   *
   * This uses Flutterwave's Transfer API to send money from your Flutterwave balance
   * to a user's external bank account.
   */
  static async initiatePayout(params: {
    accountBank: string; // Bank code (e.g., "044" for Access Bank)
    accountNumber: string;
    amountMinor: number;
    currency: "NGN" | "GHS";
    narration?: string;
    reference?: string;
  }): Promise<{ transferId: string; status: string; raw: any }> {
    const response = await fetch(`${FLW_BASE_URL}/transfers`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        account_bank: params.accountBank,
        account_number: params.accountNumber,
        amount: params.amountMinor,
        currency: params.currency,
        narration: params.narration || "ARCLE withdrawal",
        reference: params.reference || `arcle-payout-${Date.now()}`,
        callback_url: process.env.FLW_WEBHOOK_URL
          ? `${process.env.FLW_WEBHOOK_URL}/transfers`
          : undefined,
      }),
    });

    const json = await response.json();

    if (!response.ok || json.status !== "success") {
      console.error("[FlutterwaveRailProvider] Error initiating payout:", json);
      throw new Error(json.message || "Failed to initiate Flutterwave payout");
    }

    const data = json.data;

    return {
      transferId: String(data.id),
      status: data.status,
      raw: data,
    };
  }
}

