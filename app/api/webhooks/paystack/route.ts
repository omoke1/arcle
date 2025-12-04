import { NextResponse } from "next/server";
import { PaystackRailProvider } from "@/lib/local-accounts/paystackRailProvider";

// TODO: For a production webhook you should verify the Paystack signature
// header (x-paystack-signature) using your PAYSTACK_SECRET_KEY and the raw body.

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    const eventType: string = payload.event;

    if (eventType === "charge.success") {
      await PaystackRailProvider.handleChargeSuccessWebhook(payload);
    } else {
      console.log("[PaystackWebhook] Ignoring unsupported event type:", eventType);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[PaystackWebhook] Error handling webhook:", error);
    return NextResponse.json(
      { error: error.message ?? "Webhook handling failed" },
      { status: 500 },
    );
  }
}


