/**
 * Health Check API Endpoint
 * 
 * Provides system health status, performance metrics, and error statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { performanceMonitor } from "@/lib/monitoring/performance-monitor";
import { errorLogger } from "@/lib/monitoring/error-logger";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { circleApiRequest } from "@/lib/circle";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const detailed = searchParams.get("detailed") === "true";

  try {
    const health: {
      status: "healthy" | "degraded" | "unhealthy";
      timestamp: number;
      uptime: number;
      services: {
        database: "healthy" | "unhealthy";
        circle: "healthy" | "unhealthy";
      };
      performance?: any;
      errors?: any;
    } = {
      status: "healthy",
      timestamp: Date.now(),
      uptime: process.uptime ? Math.floor(process.uptime()) : 0,
      services: {
        database: "healthy",
        circle: "healthy",
      },
    };

    // Check database connectivity
    try {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseAdmin();
        const { error } = await supabase.from("users").select("id").limit(1);
        if (error) {
          health.services.database = "unhealthy";
          health.status = "degraded";
        }
      }
    } catch (error) {
      health.services.database = "unhealthy";
      health.status = "degraded";
    }

    // Check Circle API connectivity
    try {
      // Simple health check - try to get app info
      await circleApiRequest("/v1/w3s/app/info");
    } catch (error: any) {
      // 404 is okay (endpoint might not exist), but other errors indicate issues
      if (error?.response?.status && error.response.status !== 404) {
        health.services.circle = "unhealthy";
        health.status = "degraded";
      }
    }

    // Add detailed metrics if requested
    if (detailed) {
      const perfSummary = performanceMonitor.getHealthSummary();
      const errorStats = errorLogger.getStatistics();

      health.performance = {
        summary: perfSummary,
        endpoints: performanceMonitor.getAllStats(5 * 60 * 1000), // Last 5 minutes
      };

      health.errors = {
        statistics: errorStats,
        recent: errorLogger.getRecentLogs(20, { severity: "high" }),
      };

      // Update overall status based on performance
      if (perfSummary.overall === "unhealthy") {
        health.status = "unhealthy";
      } else if (perfSummary.overall === "degraded" && health.status === "healthy") {
        health.status = "degraded";
      }
    }

    const responseTime = Date.now() - startTime;

    return NextResponse.json(
      {
        ...health,
        responseTime,
      },
      {
        status: health.status === "unhealthy" ? 503 : 200,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: Date.now(),
        error: error.message || "Health check failed",
      },
      { status: 503 }
    );
  }
}

