/**
 * Monitoring Statistics API
 * 
 * Provides detailed performance and error statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { performanceMonitor } from "@/lib/monitoring/performance-monitor";
import { errorLogger } from "@/lib/monitoring/error-logger";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeWindow = parseInt(searchParams.get("window") || "3600000", 10); // Default 1 hour
    const endpoint = searchParams.get("endpoint");
    const method = searchParams.get("method") || "GET";
    const errorSeverity = searchParams.get("severity") as any;
    const errorCategory = searchParams.get("category") as any;

    // Get performance stats
    let performanceStats;
    if (endpoint) {
      performanceStats = performanceMonitor.getStats(endpoint, method, timeWindow);
    } else {
      performanceStats = performanceMonitor.getAllStats(timeWindow);
    }

    // Get error stats
    const errorStats = errorLogger.getStatistics();
    const recentErrors = errorLogger.getRecentLogs(100, {
      severity: errorSeverity,
      category: errorCategory,
    });

    // Get health summary
    const healthSummary = performanceMonitor.getHealthSummary();

    return NextResponse.json({
      success: true,
      data: {
        performance: {
          stats: performanceStats,
          health: healthSummary,
        },
        errors: {
          statistics: errorStats,
          recent: recentErrors,
        },
        timeWindow,
        timestamp: Date.now(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch monitoring stats",
      },
      { status: 500 }
    );
  }
}

