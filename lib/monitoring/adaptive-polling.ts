/**
 * Adaptive Polling System
 * 
 * Implements intelligent polling with activity-based intervals
 * - Faster polling when user is active
 * - Slower polling when idle
 * - Automatic pause during inactivity
 */

export interface PollingConfig {
  activeInterval: number; // Polling interval when active (ms)
  idleInterval: number; // Polling interval when idle (ms)
  idleThreshold: number; // Time before considered idle (ms)
  pauseAfterIdle: number; // Pause polling after this idle time (ms, 0 = never pause)
  onPoll: () => Promise<void> | void;
  onError?: (error: Error) => void;
}

export interface PollingState {
  isActive: boolean;
  isPaused: boolean;
  lastActivity: number;
  lastPoll: number;
  errorCount: number;
  consecutiveErrors: number;
}

/**
 * Adaptive Polling Manager
 * Manages polling intervals based on user activity
 */
export class AdaptivePollingManager {
  private config: PollingConfig;
  private state: PollingState;
  private intervalId: NodeJS.Timeout | null = null;
  private activityListeners: Array<() => void> = [];
  private isDestroyed = false;

  constructor(config: PollingConfig) {
    this.config = {
      activeInterval: config.activeInterval || 3000,
      idleInterval: config.idleInterval || 15000,
      idleThreshold: config.idleThreshold || 30000, // 30 seconds
      pauseAfterIdle: config.pauseAfterIdle || 300000, // 5 minutes
      onPoll: config.onPoll,
      onError: config.onError,
    };

    this.state = {
      isActive: true,
      isPaused: false,
      lastActivity: Date.now(),
      lastPoll: 0,
      errorCount: 0,
      consecutiveErrors: 0,
    };

    // Track user activity
    this.setupActivityTracking();
  }

  /**
   * Start polling
   */
  public start(): void {
    if (this.isDestroyed) return;
    
    this.state.isPaused = false;
    this.state.lastActivity = Date.now();
    this.scheduleNextPoll();
  }

  /**
   * Stop polling
   */
  public stop(): void {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    this.state.isPaused = true;
  }

  /**
   * Mark user activity (resets idle timer)
   */
  public markActivity(): void {
    if (this.isDestroyed) return;
    
    const wasIdle = !this.state.isActive;
    this.state.lastActivity = Date.now();
    this.state.isActive = true;

    // If was idle and now active, restart polling if paused
    if (wasIdle && this.state.isPaused) {
      this.start();
    } else if (wasIdle) {
      // Reschedule with active interval
      this.scheduleNextPoll();
    }
  }

  /**
   * Get current polling state
   */
  public getState(): Readonly<PollingState> {
    return { ...this.state };
  }

  /**
   * Update polling configuration
   */
  public updateConfig(updates: Partial<PollingConfig>): void {
    this.config = { ...this.config, ...updates };
    // Reschedule if currently polling
    if (this.intervalId && !this.state.isPaused) {
      this.scheduleNextPoll();
    }
  }

  /**
   * Destroy the polling manager
   */
  public destroy(): void {
    this.stop();
    this.removeActivityListeners();
    this.isDestroyed = true;
  }

  /**
   * Schedule the next poll based on current state
   */
  private scheduleNextPoll(): void {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
    }

    if (this.isDestroyed || this.state.isPaused) {
      return;
    }

    const now = Date.now();
    const timeSinceActivity = now - this.state.lastActivity;
    const timeSinceLastPoll = now - this.state.lastPoll;

    // Check if should pause due to extended idle time
    if (this.config.pauseAfterIdle > 0 && timeSinceActivity > this.config.pauseAfterIdle) {
      this.state.isPaused = true;
      this.state.isActive = false;
      return;
    }

    // Determine if currently idle
    this.state.isActive = timeSinceActivity < this.config.idleThreshold;

    // Calculate next poll interval
    // Use exponential backoff if there are consecutive errors
    let interval = this.state.isActive 
      ? this.config.activeInterval 
      : this.config.idleInterval;

    // Exponential backoff for errors (max 60 seconds)
    if (this.state.consecutiveErrors > 0) {
      const backoffMultiplier = Math.min(Math.pow(2, this.state.consecutiveErrors), 8);
      interval = Math.min(interval * backoffMultiplier, 60000);
    }

    // Don't poll more frequently than the interval
    const timeUntilNextPoll = Math.max(0, interval - timeSinceLastPoll);

    this.intervalId = setTimeout(() => {
      this.executePoll();
    }, timeUntilNextPoll);
  }

  /**
   * Execute a poll
   */
  private async executePoll(): Promise<void> {
    if (this.isDestroyed || this.state.isPaused) {
      return;
    }

    try {
      this.state.lastPoll = Date.now();
      await this.config.onPoll();
      
      // Reset error count on success
      this.state.consecutiveErrors = 0;
    } catch (error) {
      this.state.errorCount++;
      this.state.consecutiveErrors++;
      
      if (this.config.onError) {
        this.config.onError(error instanceof Error ? error : new Error(String(error)));
      } else {
        console.error('[AdaptivePolling] Poll error:', error);
      }

      // If too many consecutive errors, pause temporarily
      if (this.state.consecutiveErrors >= 5) {
        console.warn('[AdaptivePolling] Too many consecutive errors, pausing for 60 seconds');
        this.state.isPaused = true;
        setTimeout(() => {
          if (!this.isDestroyed) {
            this.state.isPaused = false;
            this.state.consecutiveErrors = 0;
            this.scheduleNextPoll();
          }
        }, 60000);
        return;
      }
    }

    // Schedule next poll
    this.scheduleNextPoll();
  }

  /**
   * Setup activity tracking (mouse, keyboard, scroll, focus)
   */
  private setupActivityTracking(): void {
    if (typeof window === 'undefined') return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'focus'];
    
    const activityHandler = () => {
      this.markActivity();
    };

    events.forEach(event => {
      window.addEventListener(event, activityHandler, { passive: true });
      this.activityListeners.push(() => {
        window.removeEventListener(event, activityHandler);
      });
    });

    // Track visibility changes
    const visibilityHandler = () => {
      if (document.hidden) {
        // Page is hidden, reduce polling
        this.state.isActive = false;
      } else {
        // Page is visible, mark activity
        this.markActivity();
      }
    };

    document.addEventListener('visibilitychange', visibilityHandler);
    this.activityListeners.push(() => {
      document.removeEventListener('visibilitychange', visibilityHandler);
    });
  }

  /**
   * Remove all activity listeners
   */
  private removeActivityListeners(): void {
    this.activityListeners.forEach(remove => remove());
    this.activityListeners = [];
  }
}

/**
 * Create an adaptive polling manager
 */
export function createAdaptivePolling(config: PollingConfig): AdaptivePollingManager {
  return new AdaptivePollingManager(config);
}

