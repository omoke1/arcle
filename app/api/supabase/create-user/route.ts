/**
 * API Route: Create Supabase User
 * 
 * This route uses the admin client to create users, bypassing RLS policies.
 * It's called from the client when we need to create a user record for a Circle userId.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { circleUserId, walletAddress } = body;

    if (!circleUserId) {
      return NextResponse.json(
        { error: "circleUserId is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // First, try to find existing user by circle_user_id directly (if column exists)
    // This is more efficient than querying preferences
    const { data: existingUserByCircleId } = await supabase
      .from("users")
      .select("id")
      .eq("circle_user_id", circleUserId)
      .maybeSingle();

    if (existingUserByCircleId?.id) {
      return NextResponse.json({ userId: existingUserByCircleId.id });
    }
    
    // Fallback: try to find by preferences (for backwards compatibility)
    const { data: allPrefs, error: prefError } = await supabase
      .from("preferences")
      .select("user_id, value")
      .eq("key", "circle_user_id");

    if (!prefError) {
      // Filter to find matching circleUserId
      const matching = allPrefs?.find(p => {
        if (!p.value) return false;
        let val: string;
        if (typeof p.value === 'string') {
          val = p.value;
        } else if (typeof p.value === 'number') {
          val = String(p.value);
        } else {
          val = JSON.stringify(p.value);
        }
        const cleanVal = val.replace(/^"|"$/g, '');
        return cleanVal === circleUserId;
      });

      if (matching?.user_id) {
        return NextResponse.json({ userId: matching.user_id });
      }
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
        return NextResponse.json({ userId: existingUser.id });
      }
    }

    // Create new user record
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
      return NextResponse.json(
        { error: `Failed to create user: ${createError?.message ?? "unknown error"}` },
        { status: 500 }
      );
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

    return NextResponse.json({ userId: newUser.id });
  } catch (error: any) {
    console.error("[API] Error creating user:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create user" },
      { status: 500 }
    );
  }
}

