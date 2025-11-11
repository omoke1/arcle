/**
 * Real-Time Notification Service
 * 
 * Monitors wallet events and generates AI-powered notifications
 * Uses polling to check for transaction status changes and balance updates
 */

export interface Notification {
  id: string;
  type: "transaction" | "balance" | "security" | "system";
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  data?: any; // Additional data (transaction ID, amount, etc.)
}

export interface NotificationPreferences {
  transactionNotifications: boolean;
  balanceChangeNotifications: boolean;
  securityAlerts: boolean;
  systemNotifications: boolean;
  minBalanceChange: number; // Minimum balance change to notify (in USDC)
}

const NOTIFICATIONS_STORAGE_KEY = "arcle_notifications";
const PREFERENCES_STORAGE_KEY = "arcle_notification_preferences";
const MAX_NOTIFICATIONS = 100;

const DEFAULT_PREFERENCES: NotificationPreferences = {
  transactionNotifications: true,
  balanceChangeNotifications: true,
  securityAlerts: true,
  systemNotifications: true,
  minBalanceChange: 0.01, // Notify on changes >= $0.01
};

/**
 * Get all notifications
 */
export function getAllNotifications(): Notification[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    return JSON.parse(stored) as Notification[];
  } catch (error) {
    console.error("Error loading notifications:", error);
    return [];
  }
}

/**
 * Save notifications to storage
 */
function saveNotifications(notifications: Notification[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    // Keep only last MAX_NOTIFICATIONS
    const trimmed = notifications.slice(-MAX_NOTIFICATIONS);
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error("Error saving notifications:", error);
  }
}

/**
 * Add a new notification
 */
export function addNotification(notification: Omit<Notification, "id" | "timestamp" | "read">): Notification {
  const notifications = getAllNotifications();
  
  const newNotification: Notification = {
    ...notification,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    read: false,
  };

  notifications.push(newNotification);
  saveNotifications(notifications);

  return newNotification;
}

/**
 * Mark notification as read
 */
export function markAsRead(notificationId: string): boolean {
  const notifications = getAllNotifications();
  const notification = notifications.find((n) => n.id === notificationId);
  
  if (!notification) {
    return false;
  }

  notification.read = true;
  saveNotifications(notifications);
  return true;
}

/**
 * Mark all notifications as read
 */
export function markAllAsRead(): void {
  const notifications = getAllNotifications();
  notifications.forEach((n) => (n.read = true));
  saveNotifications(notifications);
}

/**
 * Delete notification
 */
export function deleteNotification(notificationId: string): boolean {
  const notifications = getAllNotifications();
  const filtered = notifications.filter((n) => n.id !== notificationId);
  
  if (filtered.length === notifications.length) {
    return false; // Notification not found
  }

  saveNotifications(filtered);
  return true;
}

/**
 * Get unread notifications count
 */
export function getUnreadCount(): number {
  const notifications = getAllNotifications();
  return notifications.filter((n) => !n.read).length;
}

/**
 * Get notification preferences
 */
export function getNotificationPreferences(): NotificationPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_PREFERENCES;
  }

  try {
    const stored = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_PREFERENCES;
    }
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
  } catch (error) {
    console.error("Error loading notification preferences:", error);
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Update notification preferences
 */
export function updateNotificationPreferences(
  updates: Partial<NotificationPreferences>
): NotificationPreferences {
  const current = getNotificationPreferences();
  const updated = { ...current, ...updates };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error("Error saving notification preferences:", error);
    }
  }

  return updated;
}

/**
 * Create transaction notification
 */
export function createTransactionNotification(
  transactionId: string,
  status: "pending" | "confirmed" | "failed",
  amount: string,
  to: string,
  hash?: string
): Notification {
  const preferences = getNotificationPreferences();
  
  if (!preferences.transactionNotifications) {
    // Return a notification but it won't be shown if preferences are off
    return addNotification({
      type: "transaction",
      title: "Transaction Update",
      message: `Transaction ${status}: ${amount} USDC`,
      data: { transactionId, status, amount, to, hash },
    });
  }

  let title = "";
  let message = "";

  if (status === "confirmed") {
    title = "✅ Transaction Confirmed!";
    message = `Your transaction of ${amount} USDC to ${to.substring(0, 6)}...${to.substring(38)} has been confirmed on Arc!`;
    if (hash) {
      message += `\n\n🔗 [View on ArcScan](https://testnet.arcscan.app/tx/${hash})`;
    }
  } else if (status === "failed") {
    title = "❌ Transaction Failed";
    message = `Your transaction of ${amount} USDC failed. Please check the transaction details and try again.`;
  } else {
    title = "⏳ Transaction Pending";
    message = `Your transaction of ${amount} USDC is being processed. I'll notify you when it's confirmed.`;
  }

  return addNotification({
    type: "transaction",
    title,
    message,
    data: { transactionId, status, amount, to, hash },
  });
}

/**
 * Create balance change notification
 */
export function createBalanceChangeNotification(
  oldBalance: string,
  newBalance: string,
  change: string,
  reason?: string
): Notification | null {
  const preferences = getNotificationPreferences();
  
  if (!preferences.balanceChangeNotifications) {
    return null;
  }

  const changeNum = parseFloat(change);
  const minChange = preferences.minBalanceChange;

  // Only notify if change is significant enough
  if (Math.abs(changeNum) < minChange) {
    return null;
  }

  const isIncrease = changeNum > 0;
  const title = isIncrease ? "💰 Balance Increased!" : "💸 Balance Decreased";
  const message = isIncrease
    ? `Your balance increased by ${change} USDC!\n\nNew balance: ${newBalance} USDC${reason ? `\nReason: ${reason}` : ""}`
    : `Your balance decreased by ${Math.abs(changeNum)} USDC.\n\nNew balance: ${newBalance} USDC${reason ? `\nReason: ${reason}` : ""}`;

  return addNotification({
    type: "balance",
    title,
    message,
    data: { oldBalance, newBalance, change, reason },
  });
}

/**
 * Create security alert notification
 */
export function createSecurityAlert(
  title: string,
  message: string,
  data?: any
): Notification {
  return addNotification({
    type: "security",
    title: `🚨 ${title}`,
    message,
    data,
  });
}

/**
 * Create system notification
 */
export function createSystemNotification(
  title: string,
  message: string,
  data?: any
): Notification {
  const preferences = getNotificationPreferences();
  
  if (!preferences.systemNotifications) {
    return addNotification({
      type: "system",
      title,
      message,
      data,
    });
  }

  return addNotification({
    type: "system",
    title,
    message,
    data,
  });
}

