/**
 * Phone/Email Payment Flows
 *
 * Resolves phone numbers and email addresses to wallet addresses via
 * the contacts service, then delegates execution to INERA.
 */

import { INERAAgent } from "@/agents/inera";
import type { ExecutionResult } from "@/lib/wallet/sessionKeys/delegateExecution";
import {
  getContactByEmail,
  getContactByPhone,
} from "@/lib/db/services/contacts";

export interface PhoneEmailPaymentParams {
  walletId: string;
  userId: string;
  userToken: string;
  recipient: string; // phone number or email
  amount: string; // already in smallest unit (toSmallestUnit was applied upstream)
  recipientType: "phone" | "email";
}

/**
 * Core helper: execute a payment once we have a destination address.
 */
async function executeResolvedPayment(params: {
  walletId: string;
  userId: string;
  userToken: string;
  destinationAddress: string;
  amountSmallestUnit: string;
}): Promise<ExecutionResult> {
  const inera = new INERAAgent();

  return inera.executePayment({
    walletId: params.walletId,
    userId: params.userId,
    userToken: params.userToken,
    amount: params.amountSmallestUnit,
    destinationAddress: params.destinationAddress,
    agentId: "payments",
  });
}

/**
 * Normalize phone numbers to a consistent format (basic E.164-style).
 * Assumes contacts are stored using the same normalization.
 */
function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) {
    return "+" + trimmed.replace(/[^\d]/g, "");
  }
  return trimmed.replace(/[^\d]/g, "");
}

/**
 * Send payment to phone number
 */
export async function sendToPhone(
  params: PhoneEmailPaymentParams
): Promise<ExecutionResult> {
  const phone = normalizePhone(params.recipient);

  const contact = await getContactByPhone(params.userId, phone);

  if (!contact) {
    throw new Error(
      `No contact found for phone number ${phone}. Please save this phone number as a contact with a wallet address first.`
    );
  }

  const destinationAddress = contact.wallet_address || contact.address;

  if (!destinationAddress) {
    throw new Error(
      `Contact for ${phone} does not have an associated wallet address. Please update the contact with a wallet address.`
    );
  }

  return executeResolvedPayment({
    walletId: params.walletId,
    userId: params.userId,
    userToken: params.userToken,
    destinationAddress,
    amountSmallestUnit: params.amount,
  });
}

/**
 * Send payment to email address
 */
export async function sendToEmail(
  params: PhoneEmailPaymentParams
): Promise<ExecutionResult> {
  const email = params.recipient.trim().toLowerCase();

  const contact = await getContactByEmail(params.userId, email);

  if (!contact) {
    throw new Error(
      `No contact found for email ${email}. Please save this email as a contact with a wallet address first.`
    );
  }

  const destinationAddress = contact.wallet_address || contact.address;

  if (!destinationAddress) {
    throw new Error(
      `Contact for ${email} does not have an associated wallet address. Please update the contact with a wallet address.`
    );
  }

  return executeResolvedPayment({
    walletId: params.walletId,
    userId: params.userId,
    userToken: params.userToken,
    destinationAddress,
    amountSmallestUnit: params.amount,
  });
}


