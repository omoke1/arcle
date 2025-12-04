import { NextResponse } from "next/server";
import { FlutterwaveRailProvider } from "@/lib/local-accounts/flutterwaveRailProvider";

/**
 * Flutterwave Webhook Handler
 *
 * Handles incoming webhooks from Flutterwave for:
 * - virtual_account_credit: When money is deposited to a user's virtual account
 * - transfer.completed / transfer.failed: When payouts complete or fail
 *
 * Security: Verifies webhook signature using FLW_SECRET_KEY
 */

export async function POST(request: Request) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const payload = JSON.parse(rawBody);

    // Verify webhook signature
    const signature = request.headers.get("verif-hash") || request.headers.get("x-flutterwave-signature");
    
    if (signature) {
      const isValid = FlutterwaveRailProvider.verifyWebhookSignature(
        rawBody,
        signature,
      );

      if (!isValid) {
        console.warn("[FlutterwaveWebhook] Invalid signature, rejecting webhook");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 },
        );
      }
    } else {
      // In development/test, we might skip signature verification
      // In production, always require signature
      if (process.env.NODE_ENV === "production") {
        console.warn("[FlutterwaveWebhook] Missing signature header in production");
        return NextResponse.json(
          { error: "Missing signature" },
          { status: 401 },
        );
      }
    }

    const eventType: string = payload.event || payload.type;

    // Handle virtual account credit (deposit)
    if (eventType === "virtual_account_credit" || eventType === "charge.completed") {
      await FlutterwaveRailProvider.handleVirtualAccountCreditWebhook(payload);
      return NextResponse.json({ received: true, event: eventType });
    }

    // Handle transfer events (for payouts)
    if (eventType === "transfer.completed" || eventType === "transfer.failed") {
      // TODO: Implement payout status updates
      console.log("[FlutterwaveWebhook] Transfer event received:", payload);
      return NextResponse.json({ received: true, event: eventType });
    }

    // Ignore other event types
    console.log("[FlutterwaveWebhook] Ignoring unsupported event type:", eventType);
    return NextResponse.json({ received: true, ignored: true });
  } catch (error: any) {
    console.error("[FlutterwaveWebhook] Error handling webhook:", error);
    return NextResponse.json(
      { error: error.message ?? "Webhook handling failed" },
      { status: 500 },
    );
  }
}

