/**
 * Paystack Rail Provider
 *
 * Thin wrapper around Paystack APIs used for:
 * - Creating/assigning virtual NGN accounts to users
 * - Handling incoming deposit webhooks (via customer/virtual account metadata)
 *
 * NOTE: This file assumes you will configure:
 * - PAYSTACK_SECRET_KEY
 * - PAYSTACK_BASE_URL (optional, defaults to https://api.paystack.co)
 */

import { LocalAccountsService } from "@/lib/db/services/localAccounts";

const PAYSTACK_BASE_URL =
  process.env.PAYSTACK_BASE_URL || "https://api.paystack.co";

interface PaystackCustomer {
  id: number;
  customer_code: string;
  email: string;
}

interface PaystackDedicatedAccount {
  id: number;
  bank: {
    name: string;
  };
  account_number: string;
  account_name: string;
  customer: PaystackCustomer;
}

export interface CreateVirtualAccountResult {
  providerAccountId: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  raw: any;
}

export class PaystackRailProvider {
  private static getSecretKey(): string {
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) {
      throw new Error("PAYSTACK_SECRET_KEY is not configured");
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
   * Create or assign a virtual NGN account to a given user email.
   *
   * In Paystack's model this is usually:
   * 1. Ensure a Customer exists
   * 2. Assign a Dedicated Virtual Account to that customer
   */
  static async createVirtualAccount(params: {
    email: string;
    metadata?: Record<string, unknown>;
  }): Promise<CreateVirtualAccountResult> {
    const response = await fetch(
      `${PAYSTACK_BASE_URL}/dedicated_account`,
      {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          customer: params.email,
          preferred_bank: "wema-bank", // example; configurable later
          currency: "NGN",
          metadata: params.metadata ?? {},
        }),
      },
    );

    const json = await response.json();

    if (!response.ok || !json.status) {
      console.error("[PaystackRailProvider] Error creating virtual account:", json);
      throw new Error(
        json.message || "Failed to create Paystack virtual account",
      );
    }

    const data = json.data as PaystackDedicatedAccount;

    return {
      providerAccountId: data.customer.customer_code,
      bankName: data.bank.name,
      accountNumber: data.account_number,
      accountName: data.account_name,
      raw: data,
    };
  }

  /**
   * Handle a `charge.success` webhook for a virtual account deposit.
   *
   * This is called from the Paystack webhook route once signature is verified.
   */
  static async handleChargeSuccessWebhook(event: any) {
    const data = event.data;
    const customer: PaystackCustomer = data.customer;

    const providerAccountId = customer.customer_code;
    const amountMinor: number = data.amount; // kobo
    const reference: string = data.reference;

    const account = await LocalAccountsService.findAccountByProviderAccountId(
      providerAccountId,
    );

    if (!account) {
      console.warn(
        "[PaystackRailProvider] No local account found for providerAccountId",
        providerAccountId,
      );
      return;
    }

    await LocalAccountsService.creditFromRailEvent({
      accountId: account.id,
      amountMinor,
      reference,
      description: `Deposit via Paystack from ${data.authorization?.bank ?? "bank transfer"}`,
      metadata: {
        paystack_event_id: event.id,
        paystack_reference: reference,
      },
      rail: "paystack",
      externalId: String(data.id),
      workflowId: undefined,
    });
  }
}


