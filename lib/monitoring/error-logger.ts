/**
 * Centralized Error Logging System
 * 
 * Provides structured error logging with context, categorization, and severity levels
 */

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ErrorCategory = 
  | 'transaction' 
  | 'authentication' 
  | 'network' 
  | 'validation' 
  | 'database' 
  | 'api' 
  | 'bridge' 
  | 'defi' 
  | 'wallet' 
  | 'system' 
  | 'unknown';

export interface ErrorContext {
  userId?: string;
  walletId?: string;
  transactionId?: string;
  endpoint?: string;
  action?: string;
  [key: string]: any;
}

export interface ErrorLogEntry {
  id: string;
  timestamp: number;
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  error: {
    name: string;
    message: string;
    stack?: string;
    code?: string | number;
    status?: number;
  };
  context: ErrorContext;
  userAgent?: string;
  url?: string;
}

/**
 * Error Logger Class
 */
class ErrorLogger {
  private logs: ErrorLogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 errors in memory
  private enableConsole = true;
  private enableRemote = false; // Can be extended to send to external service

  /**
   * Log an error with context
   */
  public log(
    error: Error | unknown,
    options: {
      severity?: ErrorSeverity;
      category?: ErrorCategory;
      context?: ErrorContext;
      message?: string;
    } = {}
  ): string {
    const entry = this.createLogEntry(error, options);
    
    // Add to in-memory logs
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Remove oldest
    }

    // Console logging based on severity
    if (this.enableConsole) {
      this.logToConsole(entry);
    }

    // Remote logging (can be extended)
    if (this.enableRemote) {
      this.logToRemote(entry).catch(err => {
        console.error('[ErrorLogger] Failed to send to remote:', err);
      });
    }

    return entry.id;
  }

  /**
   * Log a critical error (highest priority)
   */
  public critical(
    error: Error | unknown,
    context?: ErrorContext,
    message?: string
  ): string {
    return this.log(error, {
      severity: 'critical',
      context,
      message,
    });
  }

  /**
   * Log a high severity error
   */
  public high(
    error: Error | unknown,
    category: ErrorCategory = 'unknown',
    context?: ErrorContext,
    message?: string
  ): string {
    return this.log(error, {
      severity: 'high',
      category,
      context,
      message,
    });
  }

  /**
   * Log a medium severity error
   */
  public medium(
    error: Error | unknown,
    category: ErrorCategory = 'unknown',
    context?: ErrorContext,
    message?: string
  ): string {
    return this.log(error, {
      severity: 'medium',
      category,
      context,
      message,
    });
  }

  /**
   * Log a low severity error
   */
  public low(
    error: Error | unknown,
    category: ErrorCategory = 'unknown',
    context?: ErrorContext,
    message?: string
  ): string {
    return this.log(error, {
      severity: 'low',
      category,
      context,
      message,
    });
  }

  /**
   * Get recent error logs
   */
  public getRecentLogs(
    limit: number = 50,
    filters?: {
      severity?: ErrorSeverity;
      category?: ErrorCategory;
      userId?: string;
    }
  ): ErrorLogEntry[] {
    let filtered = [...this.logs].reverse(); // Most recent first

    if (filters) {
      if (filters.severity) {
        filtered = filtered.filter(log => log.severity === filters.severity);
      }
      if (filters.category) {
        filtered = filtered.filter(log => log.category === filters.category);
      }
      if (filters.userId) {
        filtered = filtered.filter(log => log.context.userId === filters.userId);
      }
    }

    return filtered.slice(0, limit);
  }

  /**
   * Get error statistics
   */
  public getStatistics(): {
    total: number;
    bySeverity: Record<ErrorSeverity, number>;
    byCategory: Record<ErrorCategory, number>;
    recentCritical: number;
  } {
    const stats = {
      total: this.logs.length,
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      } as Record<ErrorSeverity, number>,
      byCategory: {} as Record<ErrorCategory, number>,
      recentCritical: 0,
    };

    const last24Hours = Date.now() - 24 * 60 * 60 * 1000;

    for (const log of this.logs) {
      stats.bySeverity[log.severity]++;
      
      if (!stats.byCategory[log.category]) {
        stats.byCategory[log.category] = 0;
      }
      stats.byCategory[log.category]++;

      if (log.severity === 'critical' && log.timestamp > last24Hours) {
        stats.recentCritical++;
      }
    }

    return stats;
  }

  /**
   * Clear all logs
   */
  public clear(): void {
    this.logs = [];
  }

  /**
   * Configure logger
   */
  public configure(options: {
    enableConsole?: boolean;
    enableRemote?: boolean;
    maxLogs?: number;
  }): void {
    if (options.enableConsole !== undefined) {
      this.enableConsole = options.enableConsole;
    }
    if (options.enableRemote !== undefined) {
      this.enableRemote = options.enableRemote;
    }
    if (options.maxLogs !== undefined) {
      this.maxLogs = options.maxLogs;
    }
  }

  /**
   * Create a log entry from error
   */
  private createLogEntry(
    error: Error | unknown,
    options: {
      severity?: ErrorSeverity;
      category?: ErrorCategory;
      context?: ErrorContext;
      message?: string;
    }
  ): ErrorLogEntry {
    const err = error instanceof Error ? error : new Error(String(error));
    
    // Auto-detect category from error
    const category = options.category || this.detectCategory(err);
    
    // Auto-detect severity from error
    const severity = options.severity || this.detectSeverity(err, category);

    // Extract error details
    const errorDetails: ErrorLogEntry['error'] = {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };

    // Extract status/code from error if available
    if ('status' in err && typeof err.status === 'number') {
      errorDetails.status = err.status;
    }
    if ('code' in err) {
      errorDetails.code = err.code as string | number;
    }
    if ('response' in err && err.response && typeof err.response === 'object') {
      const response = err.response as any;
      if (response.status) {
        errorDetails.status = response.status;
      }
    }

    return {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      severity,
      category,
      message: options.message || err.message,
      error: errorDetails,
      context: {
        ...options.context,
        ...(typeof window !== 'undefined' && {
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
      },
    };
  }

  /**
   * Detect error category from error
   */
  private detectCategory(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (message.includes('transaction') || name.includes('transaction')) {
      return 'transaction';
    }
    if (message.includes('auth') || message.includes('token') || message.includes('unauthorized')) {
      return 'authentication';
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return 'network';
    }
    if (message.includes('validation') || message.includes('invalid') || message.includes('missing')) {
      return 'validation';
    }
    if (message.includes('database') || message.includes('supabase') || message.includes('prisma')) {
      return 'database';
    }
    if (message.includes('api') || message.includes('circle')) {
      return 'api';
    }
    if (message.includes('bridge')) {
      return 'bridge';
    }
    if (message.includes('defi') || message.includes('yield') || message.includes('usyc')) {
      return 'defi';
    }
    if (message.includes('wallet')) {
      return 'wallet';
    }

    return 'unknown';
  }

  /**
   * Detect error severity from error
   */
  private detectSeverity(error: Error, category: ErrorCategory): ErrorSeverity {
    const message = error.message.toLowerCase();
    
    // Critical: Authentication failures, system errors
    if (
      category === 'authentication' ||
      message.includes('critical') ||
      message.includes('fatal') ||
      ('status' in error && (error as any).status === 500)
    ) {
      return 'critical';
    }

    // High: Transaction failures, network issues
    if (
      category === 'transaction' ||
      category === 'network' ||
      message.includes('failed') ||
      ('status' in error && (error as any).status && (error as any).status >= 400)
    ) {
      return 'high';
    }

    // Medium: Validation errors, API errors
    if (
      category === 'validation' ||
      category === 'api' ||
      ('status' in error && (error as any).status && (error as any).status >= 300)
    ) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Log to console with appropriate level
   */
  private logToConsole(entry: ErrorLogEntry): void {
    const prefix = `[${entry.severity.toUpperCase()}] [${entry.category}]`;
    const contextStr = Object.keys(entry.context).length > 0
      ? `\nContext: ${JSON.stringify(entry.context, null, 2)}`
      : '';

    const logMessage = `${prefix} ${entry.message}${contextStr}\nError: ${entry.error.name}: ${entry.error.message}`;

    switch (entry.severity) {
      case 'critical':
      case 'high':
        console.error(logMessage, entry.error.stack || '');
        break;
      case 'medium':
        console.warn(logMessage);
        break;
      case 'low':
        console.info(logMessage);
        break;
    }
  }

  /**
   * Log to remote service (can be extended)
   */
  private async logToRemote(entry: ErrorLogEntry): Promise<void> {
    // TODO: Implement remote logging (e.g., Sentry, LogRocket, custom endpoint)
    // For now, this is a placeholder
  }
}

// Singleton instance
export const errorLogger = new ErrorLogger();

// Convenience functions
export function logError(
  error: Error | unknown,
  options?: {
    severity?: ErrorSeverity;
    category?: ErrorCategory;
    context?: ErrorContext;
    message?: string;
  }
): string {
  return errorLogger.log(error, options);
}

export function logCritical(
  error: Error | unknown,
  context?: ErrorContext,
  message?: string
): string {
  return errorLogger.critical(error, context, message);
}

export function logHigh(
  error: Error | unknown,
  category: ErrorCategory = 'unknown',
  context?: ErrorContext,
  message?: string
): string {
  return errorLogger.high(error, category, context, message);
}


