/**
 * Admin API: Get Invite Code Usage Statistics
 * 
 * GET /api/admin/invite-stats
 * Returns server-side usage data for all invite codes
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllUsedCodes } from "@/lib/auth/used-codes-store";
import { DAILY_INVITE_CODES } from "@/lib/auth/invite-codes";

export async function GET(request: NextRequest) {
  try {
    // Get all used codes from server
    const usedCodes = await getAllUsedCodes();
    
    // Create a map for quick lookup
    const usedCodesMap = new Map(
      usedCodes.map(entry => [entry.code.toUpperCase(), entry])
    );

    // Build status for each code
    const codeStatuses = DAILY_INVITE_CODES.map(code => {
      const usedEntry = usedCodesMap.get(code.toUpperCase());
      return {
        code,
        isUsed: !!usedEntry,
        usedAt: usedEntry?.usedAt || null,
        ipAddress: usedEntry?.ipAddress || null,
        userAgent: usedEntry?.userAgent || null,
      };
    });

    return NextResponse.json({
      totalCodes: DAILY_INVITE_CODES.length,
      usedCount: usedCodes.length,
      remainingCount: DAILY_INVITE_CODES.length - usedCodes.length,
      codes: codeStatuses,
      recentUsage: usedCodes
        .sort((a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime())
        .slice(0, 10),
    });
  } catch (error) {
    console.error("[Admin] Error fetching invite stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch invite statistics" },
      { status: 500 }
    );
  }
}

