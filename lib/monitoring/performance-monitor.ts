/**
 * Performance Monitoring System
 * 
 * Tracks response times, throughput, and system health
 */

export interface PerformanceMetric {
  endpoint: string;
  method: string;
  responseTime: number; // milliseconds
  statusCode: number;
  timestamp: number;
  error?: boolean;
}

export interface PerformanceStats {
  endpoint: string;
  method: string;
  totalRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  errorRate: number;
  requestsPerMinute: number;
  p50: number; // 50th percentile
  p95: number; // 95th percentile
  p99: number; // 99th percentile
}

/**
 * Performance Monitor Class
 */
class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 10000; // Keep last 10k metrics
  private timeWindow = 60 * 60 * 1000; // 1 hour window for stats

  /**
   * Record a performance metric
   */
  public record(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: Date.now(),
    };

    this.metrics.push(fullMetric);

    // Trim old metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Remove metrics older than time window
    const cutoff = Date.now() - this.timeWindow;
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
  }

  /**
   * Get performance statistics for an endpoint
   */
  public getStats(
    endpoint: string,
    method: string = 'GET',
    timeWindow?: number
  ): PerformanceStats | null {
    const window = timeWindow || this.timeWindow;
    const cutoff = Date.now() - window;
    
    const relevantMetrics = this.metrics.filter(
      m => m.endpoint === endpoint && 
           m.method === method && 
           m.timestamp > cutoff
    );

    if (relevantMetrics.length === 0) {
      return null;
    }

    const responseTimes = relevantMetrics
      .map(m => m.responseTime)
      .sort((a, b) => a - b);

    const errors = relevantMetrics.filter(m => m.error || m.statusCode >= 400);
    const totalRequests = relevantMetrics.length;
    const errorRate = errors.length / totalRequests;

    const sum = responseTimes.reduce((a, b) => a + b, 0);
    const average = sum / responseTimes.length;
    const min = responseTimes[0];
    const max = responseTimes[responseTimes.length - 1];

    // Calculate percentiles
    const p50 = this.percentile(responseTimes, 50);
    const p95 = this.percentile(responseTimes, 95);
    const p99 = this.percentile(responseTimes, 99);

    // Calculate requests per minute
    const windowMinutes = window / (60 * 1000);
    const requestsPerMinute = totalRequests / windowMinutes;

    return {
      endpoint,
      method,
      totalRequests,
      averageResponseTime: Math.round(average),
      minResponseTime: min,
      maxResponseTime: max,
      errorRate: Math.round(errorRate * 10000) / 100, // Percentage with 2 decimals
      requestsPerMinute: Math.round(requestsPerMinute * 100) / 100,
      p50: Math.round(p50),
      p95: Math.round(p95),
      p99: Math.round(p99),
    };
  }

  /**
   * Get all endpoint statistics
   */
  public getAllStats(timeWindow?: number): PerformanceStats[] {
    const window = timeWindow || this.timeWindow;
    const cutoff = Date.now() - window;
    
    const relevantMetrics = this.metrics.filter(m => m.timestamp > cutoff);
    
    // Group by endpoint and method
    const grouped = new Map<string, PerformanceMetric[]>();
    
    for (const metric of relevantMetrics) {
      const key = `${metric.method}:${metric.endpoint}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(metric);
    }

    const stats: PerformanceStats[] = [];
    
    for (const [key, metrics] of grouped.entries()) {
      const [method, endpoint] = key.split(':');
      const stat = this.getStats(endpoint, method, window);
      if (stat) {
        stats.push(stat);
      }
    }

    return stats.sort((a, b) => b.totalRequests - a.totalRequests);
  }

  /**
   * Get system health summary
   */
  public getHealthSummary(): {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    slowEndpoints: Array<{ endpoint: string; avgResponseTime: number }>;
    highErrorEndpoints: Array<{ endpoint: string; errorRate: number }>;
  } {
    const last5Minutes = 5 * 60 * 1000;
    const cutoff = Date.now() - last5Minutes;
    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoff);

    if (recentMetrics.length === 0) {
      return {
        overall: 'healthy',
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        slowEndpoints: [],
        highErrorEndpoints: [],
      };
    }

    const totalRequests = recentMetrics.length;
    const errors = recentMetrics.filter(m => m.error || m.statusCode >= 400);
    const errorRate = errors.length / totalRequests;

    const responseTimes = recentMetrics.map(m => m.responseTime);
    const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

    // Find slow endpoints (avg > 2000ms)
    const endpointStats = this.getAllStats(last5Minutes);
    const slowEndpoints = endpointStats
      .filter(s => s.averageResponseTime > 2000)
      .map(s => ({ endpoint: s.endpoint, avgResponseTime: s.averageResponseTime }))
      .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
      .slice(0, 5);

    // Find high error endpoints (error rate > 5%)
    const highErrorEndpoints = endpointStats
      .filter(s => s.errorRate > 5)
      .map(s => ({ endpoint: s.endpoint, errorRate: s.errorRate }))
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 5);

    // Determine overall health
    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (errorRate > 0.1 || averageResponseTime > 5000) {
      overall = 'unhealthy';
    } else if (errorRate > 0.05 || averageResponseTime > 2000) {
      overall = 'degraded';
    }

    return {
      overall,
      totalRequests,
      averageResponseTime: Math.round(averageResponseTime),
      errorRate: Math.round(errorRate * 10000) / 100,
      slowEndpoints,
      highErrorEndpoints,
    };
  }

  /**
   * Clear all metrics
   */
  public clear(): void {
    this.metrics = [];
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Middleware to track API performance
 */
export function trackPerformance(
  endpoint: string,
  method: string,
  handler: () => Promise<Response> | Response
): () => Promise<Response> | Response {
  return async () => {
    const startTime = Date.now();
    let statusCode = 200;
    let error = false;

    try {
      const response = await handler();
      
      if (response instanceof Response) {
        statusCode = response.status;
        error = response.status >= 400;
      }

      const responseTime = Date.now() - startTime;
      
      performanceMonitor.record({
        endpoint,
        method,
        responseTime,
        statusCode,
        error,
      });

      return response;
    } catch (err) {
      error = true;
      statusCode = 500;
      const responseTime = Date.now() - startTime;
      
      performanceMonitor.record({
        endpoint,
        method,
        responseTime,
        statusCode,
        error: true,
      });

      throw err;
    }
  };
}


