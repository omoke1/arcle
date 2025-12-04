import { NextResponse } from "next/server";
import { LocalAccountsService } from "@/lib/db/services/localAccounts";
import { getSupabaseAdmin } from "@/lib/db/supabase";

async function getUserFromRequest(request: Request) {
  const authHeader = request.headers.get("x-arcle-user-id");
  if (!authHeader) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", authHeader)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as { id: string };
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const accounts = await LocalAccountsService.listUserAccounts(user.id);
    return NextResponse.json({ accounts });
  } catch (error: any) {
    console.error("[LocalAccountsAPI] GET error:", error);
    return NextResponse.json(
      { error: error.message ?? "Failed to load local accounts" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const currency: string = body.currency || "NGN";

    const account = await LocalAccountsService.getOrCreateAccount({
      userId: user.id,
      currency,
      displayName: body.displayName,
    });

    return NextResponse.json({ account });
  } catch (error: any) {
    console.error("[LocalAccountsAPI] POST error:", error);
    return NextResponse.json(
      { error: error.message ?? "Failed to create local account" },
      { status: 500 },
    );
  }
}


